// A third-person camera that follows something from behind.
//
// It swings lazily round behind the way its target is heading, pulls back and widens its view with speed, lets the
// mouse look anywhere (and drifts back behind the target when the mouse is left alone), and can be told to cut
// (snap) instead of gliding. Every teleport, respawn, level change and cutscene's end needs that cut.
//
//   const cam = createFollowCamera(game.camera, { distance: 6, fov: 68 });
//   cam.snap(player);                                    // after any teleport
//   cam.update(dt, player, { mouseDX, mouseDY });        // player: { pos, fwd, speed } (+ grounded, to stop it swinging in the air)
//   cam.floor = (x, z) => heightAt(x, z);                // keep it above the ground
//   cam.confine = (position) => { ... };                 // keep it inside the walls (changes `position` in place)
//   cam.thump(impact); cam.shake = 0.3;                  // a landing's dip; a jolt
import { Vector3, MathUtils } from 'three';

export const CAMERA_DEFAULTS = {
  distance: 6,          // metres behind the target...
  distanceFast: 9.5,    // ...at full speed
  topSpeed: 60,         // what counts as full speed (m/s)
  pitch: 18,            // degrees it sits above the target
  viewTilt: 12,         // how far above the target the view is aimed (pitch - viewTilt = degrees looking down)
  lookHeight: 1.3,      // the height on the target it turns about
  fov: 68,
  fovFast: 104,         // the view widens with speed
  yawLag: 5,            // lower = lazier swing behind the target on turns
  followLag: 14,        // how tightly it follows across the ground...
  followLagY: 7,        // ...and up and down (slower, so a jump reads as a jump)
  sensitivity: 0.0022,  // radians per pixel of mouse
  recenterDelay: 2,     // seconds of the mouse left alone before the view drifts back behind the target...
  recenter: 1.5,        // ...at this rate
  zoomMin: 0.5, zoomMax: 2.6, zoomStep: 0.12,   // the mouse wheel: closest, furthest (multiples of the distance), and a click's worth
  clearance: 0.5,       // metres kept between the camera and the ground
};

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (rate, dt) => 1 - Math.exp(-rate * dt);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const look = new Vector3();

export function createFollowCamera(camera, settings = {}) {
  const c = { ...CAMERA_DEFAULTS, ...settings };
  const rig = {
    settings: c,
    focus: new Vector3(),   // the smoothed point it turns about
    yaw: 0,                 // the smoothed heading it sits behind
    lookYaw: 0, lookPitch: 0,   // where the mouse has turned it from there
    idle: 0, zoom: 1, zoomTarget: 1, fov: c.fov,
    dip: 0, shake: 0,
    floor: null, confine: null,

    snap(target) {
      rig.focus.copy(target.pos);
      rig.yaw = Math.atan2(target.fwd.x, target.fwd.z);
      rig.lookYaw = rig.lookPitch = 0;
      rig.idle = 0;
    },
    zoomBy(clicks) { rig.zoomTarget = MathUtils.clamp(rig.zoomTarget * (1 + c.zoomStep) ** clicks, c.zoomMin, c.zoomMax); },
    thump(impact, per = 0.03) { rig.dip = Math.min(0.7, impact * per); },

    // hold: keep the view still in the world while the target turns under it (aiming, shooting).
    update(dt, target, { mouseDX = 0, mouseDY = 0, hold = false, sensitivity = 1 } = {}) {
      const speed01 = Math.min(1, (target.speed ?? 0) / c.topSpeed);
      rig.lookYaw = wrap(rig.lookYaw - mouseDX * c.sensitivity * sensitivity);
      rig.lookPitch = MathUtils.clamp(rig.lookPitch + mouseDY * c.sensitivity * sensitivity, -0.9, 0.9);
      if (hold || mouseDX !== 0 || mouseDY !== 0) rig.idle = 0;
      else rig.idle += dt;

      // Swing behind the heading. Not in the air (a spin turns the target, not the view), and not when it points straight up or down.
      const f = target.fwd;
      if (target.grounded !== false && f.x * f.x + f.z * f.z > 0.1) {
        const step = wrap(Math.atan2(f.x, f.z) - rig.yaw) * damp(c.yawLag, dt);
        rig.yaw += step;
        if (hold) rig.lookYaw = wrap(rig.lookYaw - step);
      }
      if (rig.idle > c.recenterDelay) { const k = 1 - damp(c.recenter, dt); rig.lookYaw *= k; rig.lookPitch *= k; }

      const kxz = damp(c.followLag, dt), ky = damp(c.followLagY, dt);
      rig.focus.x = lerp(rig.focus.x, target.pos.x, kxz);
      rig.focus.z = lerp(rig.focus.z, target.pos.z, kxz);
      rig.focus.y = lerp(rig.focus.y, target.pos.y, ky);

      // It sits at `elevation` but looks out past the target toward the horizon, so what is ahead is in the middle of the screen.
      const yaw = rig.yaw + rig.lookYaw, pitch = MathUtils.degToRad(c.pitch) + rig.lookPitch;
      const elevation = Math.max(pitch, -0.08), viewPitch = MathUtils.degToRad(c.viewTilt) - pitch;
      rig.zoom = lerp(rig.zoom, rig.zoomTarget, damp(12, dt));
      const dist = lerp(c.distance, c.distanceFast, speed01) * rig.zoom;
      const p = camera.position;
      p.set(rig.focus.x - Math.sin(yaw) * Math.cos(elevation) * dist, rig.focus.y + c.lookHeight + Math.sin(elevation) * dist, rig.focus.z - Math.cos(yaw) * Math.cos(elevation) * dist);

      rig.confine?.(p);
      if (rig.floor) p.y = Math.max(p.y, rig.floor(p.x, p.z) + c.clearance);
      rig.dip *= 1 - damp(9, dt);
      rig.shake *= 1 - damp(6, dt);
      p.y -= rig.dip;
      p.x += (Math.random() - 0.5) * rig.shake;
      p.y += (Math.random() - 0.5) * rig.shake;

      look.set(Math.sin(yaw) * Math.cos(viewPitch), Math.sin(viewPitch), Math.cos(yaw) * Math.cos(viewPitch)).add(p);
      camera.lookAt(look);
      rig.fov = lerp(rig.fov, lerp(c.fov, c.fovFast, speed01 ** 1.3), damp(10, dt));
      camera.fov = rig.fov;
      camera.updateProjectionMatrix();
    },
  };
  return rig;
}
