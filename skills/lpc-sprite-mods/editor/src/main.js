import { createGame } from './skills/core/module/06_game.js';
import * as painter from './04_app.js';

const game = createGame({ storage: null });
game.use(painter, { character: game.query.get('character') });
game.start();
