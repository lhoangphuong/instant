/**
 * Node runner for SnakeGameCore assertions (game rules only).
 * Usage: node tests/game-tests-runner.mjs
 */

import vm from "node:vm";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CORE = fs.readFileSync(path.join(ROOT, "game-core.js"), "utf8");

const sandbox = { console };
vm.createContext(sandbox);
sandbox.globalThis = sandbox;
vm.runInContext(CORE, sandbox);

const Core = sandbox.SnakeGameCore;
if (
  !Core
  || !Core.CONST
  || typeof Core.createState !== "function"
  || typeof Core.stepOnce !== "function"
) {
  console.log(
    JSON.stringify({
      exitCode: 1,
      tests: [{
        ok: false,
        name: "runner",
        detail: "SnakeGameCore not found after loading game-core.js",
      }],
      passed: 0,
      failed: 1,
    }),
  );
  process.exit(1);
}

const { CONST } = Core;
const results = [];

function record(name, cond, detail) {
  results.push({ ok: Boolean(cond), name, ...(detail ? { detail } : {}) });
}

(() => {
  const rng = () => 0.11;
  const st = Core.createState(rng);
  Core.trySetNextDirection(st, { x: 1, y: 0 });
  while (!st.dead) Core.stepOnce(st, rng);
  record("wall-death", st.overlayTitle === "Game over");
})();

(() => {
  const rng = () => 0.11;
  const st = Core.createState(rng);
  Core.trySetNextDirection(st, { x: 1, y: 0 });
  Core.stepOnce(st, rng);
  const x1 = st.snake[0].x;
  Core.trySetNextDirection(st, { x: -1, y: 0 });
  Core.stepOnce(st, rng);
  record("no-instant-reverse", st.snake[0].x > x1);
})();

(() => {
  const rng = () => 0.11;
  const st = Core.createState(rng);
  Core.trySetNextDirection(st, { x: 1, y: 0 });
  const hx = st.snake[0].x + 1;
  const hy = st.snake[0].y;
  st.hazards.push({ x: hx, y: hy });
  Core.stepOnce(st, rng);
  record("hazard-hit", st.dead && st.overlayTitle === "Hazard hit");
})();

record("level-score-0", Core.computeLevel(0) === 1);
record("level-score-5", Core.computeLevel(5) === 2);
record("speed-level-1", Core.currentSpeed(1) === CONST.BASE_SPEED);

const failed = results.filter((r) => !r.ok).length;

console.log(
  JSON.stringify({
    exitCode: failed === 0 ? 0 : 1,
    passed: results.length - failed,
    failed,
    tests: results,
  }),
);

process.exit(failed === 0 ? 0 : 1);
