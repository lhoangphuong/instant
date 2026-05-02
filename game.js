(() => {
  const Core = SnakeGameCore;
  const { COLS, ROWS } = Core.CONST;
  const LOGICAL = 400;
  const CELL = LOGICAL / COLS;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const levelEl = document.getElementById("level");
  const speedEl = document.getElementById("speed");
  const bonusStatusEl = document.getElementById("bonus-status");
  const comboEl = document.getElementById("combo");
  const hazardEl = document.getElementById("hazards");
  const restartBtn = document.getElementById("restart");
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay.querySelector(".overlay__title");
  const hintEl = document.getElementById("hint");
  const BEST_SCORE_KEY = "snake.bestScore";

  /** @type {ReturnType<Core["createState"]>} */
  let state;
  let bestScore = loadBestScore();
  let ticks = 0;
  let running = false;
  let paused = false;
  let started = false;
  /** @type {{ x: number, y: number } | null} */
  let pointerStart = null;

  function rng() {
    return Math.random();
  }

  function syncCanvasToDpr() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== LOGICAL * dpr || canvas.height !== LOGICAL * dpr) {
      canvas.width = LOGICAL * dpr;
      canvas.height = LOGICAL * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  syncCanvasToDpr();
  window.addEventListener("resize", syncCanvasToDpr);

  const palette = {
    field: "#060c09",
    grid: "rgba(74, 222, 128, 0.09)",
    food: "#ef4444",
    foodCore: "#fca5a5",
    hazard: "#dc2626",
    hazardCore: "#fecaca",
    hazardGlow: "rgba(220, 38, 38, 0.28)",
    snakeHead: { r: 74, g: 222, b: 128 },
    snakeTail: { r: 21, g: 128, b: 61 },
  };

  function loadBestScore() {
    try {
      const saved = window.localStorage.getItem(BEST_SCORE_KEY);
      return Math.max(0, Number.parseInt(saved || "0", 10) || 0);
    } catch {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      window.localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    } catch {
      // Storage can be unavailable in private or embedded browsing contexts.
    }
  }

  function syncBestScoreUi() {
    if (state.score > bestScore) {
      bestScore = state.score;
      saveBestScore();
    }
    bestScoreEl.textContent = String(bestScore);
  }

  function setHint(text, idle = false) {
    hintEl.textContent = text;
    hintEl.classList.toggle("idle", idle);
  }

  function syncUiFromState() {
    scoreEl.textContent = String(state.score);
    levelEl.textContent = String(state.level);
    speedEl.textContent = String(Core.currentSpeed(state.level));
    comboEl.textContent = state.combo > 1 ? `${state.combo}x` : "1x";
    hazardEl.textContent = String(state.hazards.length);

    if (state.bonusFood) {
      bonusStatusEl.textContent = `Bonus ${state.bonusTicks}`;
    } else {
      const untilBonus = Math.max(state.nextBonusScore - state.score, 0);
      bonusStatusEl.textContent = untilBonus === 0 ? "Bonus ready" : `Bonus in ${untilBonus}`;
    }
    syncBestScoreUi();
  }

  function reset() {
    state = Core.createState(rng);
    ticks = 0;
    running = false;
    paused = false;
    started = false;
    overlay.hidden = true;
    overlayTitle.textContent = "Game over";
    setHint("Press arrows, swipe, or use pad to move");
    syncUiFromState();
  }

  function endGame() {
    running = false;
    paused = false;
    overlay.hidden = false;
    overlayTitle.textContent = state.overlayTitle || "Game over";
    syncBestScoreUi();
    setHint(
      state.overlayTitle === "Hazard hit"
        ? "You hit a red hazard · tap Play again"
        : state.win
          ? "Perfect run · tap Play again"
          : "Game over · tap Play again",
      true,
    );
  }

  function step() {
    if (state.dead || state.win) return;
    Core.stepOnce(state, rng);
    syncUiFromState();
    if (state.dead) {
      endGame();
      return;
    }
  }

  /** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, w, h, rr);
    } else {
      ctx.moveTo(x + rr, y);
      ctx.lineTo(x + w - rr, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
      ctx.lineTo(x + w, y + h - rr);
      ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
      ctx.lineTo(x + rr, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
      ctx.lineTo(x, y + rr);
      ctx.quadraticCurveTo(x, y, x + rr, y);
      ctx.closePath();
    }
  }

  function draw() {
    syncCanvasToDpr();

    ctx.fillStyle = palette.field;
    ctx.fillRect(0, 0, LOGICAL, LOGICAL);

    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL + 0.5, 0);
      ctx.lineTo(x * CELL + 0.5, LOGICAL);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL + 0.5);
      ctx.lineTo(LOGICAL, y * CELL + 0.5);
      ctx.stroke();
    }

    state.hazards.forEach((hazard, i) => {
      const x = hazard.x * CELL + 3;
      const y = hazard.y * CELL + 3;
      const spin = (ticks + i * 3) % 8;

      ctx.save();
      ctx.translate(x + CELL / 2 - 3, y + CELL / 2 - 3);
      ctx.rotate((Math.PI / 16) * spin);
      roundRect(-6, -6, 12, 12, 3);
      ctx.fillStyle = palette.hazard;
      ctx.fill();
      roundRect(-3, -3, 6, 6, 2);
      ctx.fillStyle = palette.hazardCore;
      ctx.fill();
      ctx.restore();
    });

    const fx = state.food.x * CELL + CELL / 2;
    const fy = state.food.y * CELL + CELL / 2;
    const fr = CELL * 0.38;

    ctx.fillStyle = palette.food;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.foodCore;
    ctx.beginPath();
    ctx.arc(fx - fr * 0.18, fy - fr * 0.2, fr * 0.32, 0, Math.PI * 2);
    ctx.fill();

    if (state.bonusFood) {
      const bx = state.bonusFood.x * CELL + CELL / 2;
      const by = state.bonusFood.y * CELL + CELL / 2;
      const pulse = 0.7 + Math.sin(ticks * 0.7) * 0.08;

      ctx.fillStyle = "rgba(134, 239, 172, 0.26)";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * 0.36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#bbf7d0";
      ctx.beginPath();
      ctx.arc(bx - CELL * 0.08, by - CELL * 0.1, CELL * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    const { snakeHead: sh, snakeTail: st } = palette;
    state.snake.forEach((seg, i) => {
      const t = i / Math.max(state.snake.length - 1, 1);
      const pad = i === 0 ? 2.25 : 3;
      const w = CELL - pad * 2;
      const h = CELL - pad * 2;
      const x = seg.x * CELL + pad;
      const y = seg.y * CELL + pad;
      const radius = i === 0 ? 5 : 4;

      const r = Math.round(sh.r + (st.r - sh.r) * t);
      const g = Math.round(sh.g + (st.g - sh.g) * t);
      const b = Math.round(sh.b + (st.b - sh.b) * t);
      const fill = `rgb(${r}, ${g}, ${b})`;

      roundRect(x, y, w, h, radius);
      ctx.fillStyle = fill;
      ctx.fill();
      if (i === 0) {
        roundRect(x, y, w, h, radius);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  function loop(ts) {
    const speed = Core.currentSpeed(state.level);
    const frame = Math.floor(ts / (1000 / speed));
    if (frame > ticks && running) {
      ticks = frame;
      step();
    }
    draw();
    requestAnimationFrame(loop);
  }

  /**
   * @param {{ x: number, y: number } | null} d
   * @param {Event | null} ev
   */
  function trySetDirection(d, ev) {
    if (!d) return;
    if (ev) ev.preventDefault();

    if (!running && !paused && overlay.hidden && !state.dead) {
      running = true;
      paused = false;
      started = true;
    }
    Core.trySetNextDirection(state, d);
    setHint(paused ? "Paused · press Space or P to resume" : "Space or P pauses", true);
  }

  function togglePause() {
    if (!started || !overlay.hidden) return;
    paused = !paused;
    running = !paused;
    setHint(paused ? "Paused · press Space or P to resume" : "Space or P pauses", true);
  }

  function directionFromName(name) {
    if (name === "up") return { x: 0, y: -1 };
    if (name === "down") return { x: 0, y: 1 };
    if (name === "left") return { x: -1, y: 0 };
    if (name === "right") return { x: 1, y: 0 };
    return null;
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key.toLowerCase() === "p") {
      e.preventDefault();
      togglePause();
      return;
    }

    let d = null;
    switch (e.key) {
      case "ArrowUp":
        d = directionFromName("up");
        break;
      case "ArrowDown":
        d = directionFromName("down");
        break;
      case "ArrowLeft":
        d = directionFromName("left");
        break;
      case "ArrowRight":
        d = directionFromName("right");
        break;
      default:
        return;
    }
    trySetDirection(d, e);
  });

  document.querySelectorAll(".dpad__btn[data-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      trySetDirection(directionFromName(btn.getAttribute("data-dir")), null);
    });
  });

  canvas.addEventListener("pointerdown", (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener("pointerup", (e) => {
    if (!pointerStart) return;

    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    const distance = Math.hypot(dx, dy);
    pointerStart = null;

    if (distance < 24) return;
    const dir = Math.abs(dx) > Math.abs(dy)
      ? directionFromName(dx > 0 ? "right" : "left")
      : directionFromName(dy > 0 ? "down" : "up");
    trySetDirection(dir, e);
  });

  restartBtn.addEventListener("click", () => {
    reset();
    draw();
  });

  reset();
  requestAnimationFrame(loop);
})();
