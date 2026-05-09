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
    field: "#1a0a08",
    grid: "rgba(251, 146, 60, 0.12)",
    food: "#fb923c",
    foodCore: "#fef08a",
    hazard: "#292524",
    hazardCore: "#f97316",
    hazardGlow: "rgba(249, 115, 22, 0.35)",
    snakeHead: { r: 254, g: 240, b: 138 },
    snakeTail: { r: 127, g: 29, b: 29 },
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
        ? "You hit a hot coal · tap Play again"
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
      const cx = x + CELL / 2 - 3;
      const cy = y + CELL / 2 - 3;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((Math.PI / 16) * spin);

      ctx.fillStyle = palette.hazardGlow;
      ctx.beginPath();
      ctx.arc(0, 0, CELL * 0.42, 0, Math.PI * 2);
      ctx.fill();

      roundRect(-8, -8, 16, 16, 4);
      ctx.fillStyle = palette.hazard;
      ctx.fill();
      roundRect(-4, -4, 8, 8, 2);
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

      ctx.fillStyle = "rgba(253, 224, 71, 0.32)";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * 0.36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fffbeb";
      ctx.beginPath();
      ctx.arc(bx - CELL * 0.08, by - CELL * 0.1, CELL * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

    const { snakeHead: sh, snakeTail: st } = palette;
    const bodyR = CELL * 0.44;
    const headR = CELL * 0.48;

    state.snake.forEach((seg, i) => {
      const cx = seg.x * CELL + CELL / 2;
      const cy = seg.y * CELL + CELL / 2;
      const t = i / Math.max(state.snake.length - 1, 1);
      const r = i === 0 ? headR : bodyR;

      const rr = Math.round(sh.r + (st.r - sh.r) * t);
      const gg = Math.round(sh.g + (st.g - sh.g) * t);
      const bb = Math.round(sh.b + (st.b - sh.b) * t);
      const fill = `rgb(${rr}, ${gg}, ${bb})`;

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();

      if (i === 0) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 251, 235, 0.5)";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        const hx = state.direction.x;
        const hy = state.direction.y;
        const eyeFwd = CELL * 0.14;
        const eyeSide = CELL * 0.11;
        const px = -hy;
        const py = hx;
        const eyeR = Math.max(2.2, CELL * 0.055);
        const pupilR = eyeR * 0.48;
        const pupilShift = CELL * 0.045;

        const drawEye = (sx, sy) => {
          ctx.beginPath();
          ctx.arc(sx, sy, eyeR, 0, Math.PI * 2);
          ctx.fillStyle = "#fffbeb";
          ctx.fill();
          ctx.beginPath();
          ctx.arc(sx + hx * pupilShift, sy + hy * pupilShift, pupilR, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(28, 10, 8, 0.9)";
          ctx.fill();
        };

        drawEye(cx + hx * eyeFwd + px * eyeSide, cy + hy * eyeFwd + py * eyeSide);
        drawEye(cx + hx * eyeFwd - px * eyeSide, cy + hy * eyeFwd - py * eyeSide);
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
