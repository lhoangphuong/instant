(() => {
  const LOGICAL = 400;
  const CELL = 20;
  const COLS = LOGICAL / CELL;
  const ROWS = LOGICAL / CELL;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const bestScoreEl = document.getElementById("best-score");
  const restartBtn = document.getElementById("restart");
  const overlay = document.getElementById("overlay");
  const overlayTitle = overlay.querySelector(".overlay__title");
  const hintEl = document.getElementById("hint");
  const BEST_SCORE_KEY = "snake.bestScore";

  /** @type {{ x: number, y: number }[]} */
  let snake;
  /** @type {{ x: number, y: number }} */
  let direction;
  /** @type {{ x: number, y: number }} */
  let nextDirection;
  /** @type {{ x: number, y: number }} */
  let food;
  let score = 0;
  let bestScore = loadBestScore();
  let ticks = 0;
  let running = false;
  let paused = false;
  let started = false;
  /** @type {{ x: number, y: number } | null} */
  let pointerStart = null;

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
    field: "#d8cfc3",
    grid: "rgba(52, 47, 42, 0.07)",
    food: "#c55a2d",
    foodCore: "#e8a574",
    snakeHead: { r: 118, g: 148, b: 96 },
    snakeTail: { r: 56, g: 72, b: 52 },
  };

  const randomCell = () => ({
    x: Math.floor(Math.random() * COLS),
    y: Math.floor(Math.random() * ROWS),
  });

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

  function syncBestScore() {
    if (score > bestScore) {
      bestScore = score;
      saveBestScore();
    }
    bestScoreEl.textContent = String(bestScore);
  }

  function setHint(text, idle = false) {
    hintEl.textContent = text;
    hintEl.classList.toggle("idle", idle);
  }

  /** @param {{ x: number, y: number }} f */
  const foodOverlapsSnake = (f) => snake.some((s) => s.x === f.x && s.y === f.y);

  const spawnFood = () => {
    let f;
    do {
      f = randomCell();
    } while (foodOverlapsSnake(f));
    return f;
  };

  function reset() {
    const mid = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
    snake = [mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }];
    direction = { x: 1, y: 0 };
    nextDirection = { ...direction };
    food = spawnFood();
    score = 0;
    ticks = 0;
    running = false;
    paused = false;
    started = false;
    scoreEl.textContent = "0";
    syncBestScore();
    overlay.hidden = true;
    overlayTitle.textContent = "Game over";
    setHint("Press arrows, swipe, or use pad to move");
  }

  function endGame(title, hint) {
    running = false;
    paused = false;
    overlay.hidden = false;
    overlayTitle.textContent = title;
    syncBestScore();
    setHint(hint, true);
  }

  function gameOver() {
    endGame("Game over", "Game over · tap Play again");
  }

  function step() {
    direction = nextDirection;
    const head = snake[0];
    const nx = head.x + direction.x;
    const ny = head.y + direction.y;

    if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
      gameOver();
      return;
    }
    if (snake.slice(0, -1).some((s) => s.x === nx && s.y === ny)) {
      gameOver();
      return;
    }

    snake.unshift({ x: nx, y: ny });

    if (nx === food.x && ny === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      syncBestScore();
      if (snake.length === COLS * ROWS) {
        endGame("Board cleared", "Perfect run · tap Play again");
        return;
      }
      food = spawnFood();
    } else {
      snake.pop();
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

    const fx = food.x * CELL + CELL / 2;
    const fy = food.y * CELL + CELL / 2;
    const fr = CELL * 0.38;

    ctx.fillStyle = palette.food;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = palette.foodCore;
    ctx.beginPath();
    ctx.arc(fx - fr * 0.18, fy - fr * 0.2, fr * 0.32, 0, Math.PI * 2);
    ctx.fill();

    const { snakeHead: sh, snakeTail: st } = palette;
    snake.forEach((seg, i) => {
      const t = i / Math.max(snake.length - 1, 1);
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
    const speed = 8;
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

    const opposites = (a, b) => a.x === -b.x && a.y === -b.y;
    if (!running && !paused && overlay.hidden) {
      running = true;
      paused = false;
      started = true;
    }
    if (!opposites(d, direction)) nextDirection = d;
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
