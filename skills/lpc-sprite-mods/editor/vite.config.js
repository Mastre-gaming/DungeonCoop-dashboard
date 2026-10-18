import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

const STAMP = new Date().toISOString().slice(0, 16).replace('T', ' ');

// While `npm run dev` runs, the editor's Import button posts here and the importer renders the character in a
// headless Edge (tools/lpc_import.mjs). A built copy has no helper: it edits characters already imported.
function lpcImport() {
  return {
    name: 'lpc-import',
    configureServer(server) {
      server.middlewares.use('/api/import', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
        let body = '';
        req.on('data', (d) => { body += d; });
        req.on('end', async () => {
          res.setHeader('content-type', 'application/json');
          try {
            const { importCharacter } = await import('./tools/lpc_import.mjs');
            const meta = await importCharacter(JSON.parse(body || '{}'), (line) => console.log(`[import] ${line}`));
            res.end(JSON.stringify(meta));
          } catch (error) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: error.message }));
          }
        });
      });
    },
  };
}

// A timestamped copy of src/ outside the project on every build, when the workspace keeps backups (../_backups).
function backup() {
  return {
    name: 'backup-src',
    apply: 'build',
    closeBundle() {
      if (!fs.existsSync(path.resolve('..', '_backups'))) return;
      const to = path.resolve('..', '_backups', 'sprite-painter', STAMP.replace(/[: ]/g, '-'));
      fs.cpSync('src', path.join(to, 'src'), { recursive: true });
      fs.cpSync('tools', path.join(to, 'tools'), { recursive: true });
    },
  };
}

export default defineConfig({
  base: './',
  define: { __BUILD_STAMP__: JSON.stringify(STAMP) },
  plugins: [lpcImport(), backup()],
});
