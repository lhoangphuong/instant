(() => {
  const LOGICAL = 400;
  const CELL = 20;
  const COLS = LOGICAL / CELL;
  const ROWS = LOGICAL / CELL;

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
  const POINTS_PER_LEVEL = 5;
  const BASE_SPEED = 8;
  const MAX_SPEED = 14;
  const BONUS_VALUE = 3;
  const BONUS_LIFETIME = 34;
  const COMBO_WINDOW = 22;
  const MAX_HAZARDS = 12;

  /** @type {{ x: number, y: number }[]} */
  let snake;
  /** @type {{ x: number, y: number }} */
  let direction;
  /** @type {{ x: number, y: number }} */
  let nextDirection;
  /** @type {{ x: number, y: number }} */
  let food;
  /** @type {{ x: number, y: number } | null} */
  let bonusFood = null;
  /** @type {{ x: number, y: number }[]} */
  let hazards = [];
  let score = 0;
  let bestScore = loadBestScore();
  let level = 1;
  let bonusTicks = 0;
  let nextBonusScore = POINTS_PER_LEVEL;
  let combo = 0;
  let comboTicks = 0;
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
    field: "#081523",
    grid: "rgba(163, 230, 190, 0.08)",
    food: "#ff7a45",
    foodCore: "#ffd39f",
    hazard: "#6d5dfc",
    hazardCore: "#b8b0ff",
    hazardGlow: "rgba(109, 93, 252, 0.24)",
    snakeHead: { r: 179, g: 255, b: 111 },
    snakeTail: { r: 47, g: 151, b: 102 },
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

  const sameCell = (a, b) => a && b && a.x === b.x && a.y === b.y;

  /** @param {{ x: number, y: number }} cell */
  const overlapsSnake = (cell) => snake.some((s) => sameCell(s, cell));

  /** @param {{ x: number, y: number }} cell */
  const overlapsHazard = (cell) => hazards.some((h) => sameCell(h, cell));

  /** @param {{ x: number, y: number }} cell */
  const isOccupied = (cell) => (
    overlapsSnake(cell)
    || overlapsHazard(cell)
    || sameCell(food, cell)
    || sameCell(bonusFood, cell)
  );

  const spawnOpenCell = () => {
    let cell;
    do {
      cell = randomCell();
    } while (isOccupied(cell));
    return cell;
  };

  const spawnFood = () => {
    let f;
    do {
      f = randomCell();
    } while (overlapsSnake(f) || overlapsHazard(f) || sameCell(bonusFood, f));
    return f;
  };

  function currentSpeed() {
    return Math.min(MAX_SPEED, BASE_SPEED + level - 1);
  }

  function syncLevelState() {
    const nextLevel = Math.floor(score / POINTS_PER_LEVEL) + 1;
    const leveledUp = nextLevel > level;
    level = nextLevel;
    ensureHazards();
    levelEl.textContent = String(level);
    speedEl.textContent = String(currentSpeed());
    comboEl.textContent = combo > 1 ? `${combo}x` : "1x";
    hazardEl.textContent = String(hazards.length);

    if (bonusFood) {
      bonusStatusEl.textContent = `Bonus ${bonusTicks}`;
    } else {
      const untilBonus = Math.max(nextBonusScore - score, 0);
      bonusStatusEl.textContent = untilBonus === 0 ? "Bonus ready" : `Bonus in ${untilBonus}`;
    }
    if (leveledUp && level > 1) setHint(`Level ${level} · hazards shifted`, true);
  }

  function maybeSpawnBonus() {
    if (bonusFood || score < nextBonusScore) return;
    bonusFood = spawnOpenCell();
    bonusTicks = BONUS_LIFETIME;
    nextBonusScore += POINTS_PER_LEVEL;
    syncLevelState();
    setHint(`Golden fruit appeared · +${BONUS_VALUE} points`, true);
  }

  function ensureHazards() {
    const target = Math.min(MAX_HAZARDS, Math.max(0, level - 2) * 2);
    while (hazards.length < target) hazards.push(spawnOpenCell());
    if (hazards.length > target) hazards = hazards.slice(0, target);
  }

  function reset() {
    const mid = { x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) };
    snake = [mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }];
    direction = { x: 1, y: 0 };
    nextDirection = { ...direction };
    bonusFood = null;
    hazards = [];
    food = spawnFood();
    score = 0;
    level = 1;
    bonusTicks = 0;
    nextBonusScore = POINTS_PER_LEVEL;
    combo = 0;
    comboTicks = 0;
    ticks = 0;
    running = false;
    paused = false;
    started = false;
    scoreEl.textContent = "0";
    syncBestScore();
    syncLevelState();
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
    const nextHead = { x: nx, y: ny };
    if (snake.slice(0, -1).some((s) => s.x === nx && s.y === ny)) {
      gameOver();
      return;
    }
    if (overlapsHazard(nextHead)) {
      endGame("Hazard hit", "You hit a prism hazard · tap Play again");
      return;
    }

    snake.unshift(nextHead);

    const ateFood = nx === food.x && ny === food.y;
    const ateBonus = bonusFood && nx === bonusFood.x && ny === bonusFood.y;

    if (ateFood || ateBonus) {
      combo = comboTicks > 0 ? combo + 1 : 1;
      comboTicks = COMBO_WINDOW;
      const basePoints = ateBonus ? BONUS_VALUE : 1;
      const comboBonus = Math.max(0, combo - 1);
      const gained = basePoints + comboBonus;
      score += gained;
      scoreEl.textContent = String(score);
      if (ateBonus) {
        bonusFood = null;
        bonusTicks = 0;
        setHint(`Bonus collected · +${gained}`, true);
      } else if (comboBonus > 0) {
        setHint(`Combo ${combo}x · +${gained}`, true);
      }
      syncBestScore();
      syncLevelState();
      if (snake.length + hazards.length === COLS * ROWS) {
        endGame("Board cleared", "Perfect run · tap Play again");
        return;
      }
      if (ateFood) food = spawnFood();
      maybeSpawnBonus();
    } else {
      snake.pop();
      if (comboTicks > 0) {
        comboTicks -= 1;
        if (comboTicks === 0) combo = 0;
        syncLevelState();
      }
    }

    if (bonusFood && bonusTicks > 0) {
      bonusTicks -= 1;
      if (bonusTicks === 0) {
        bonusFood = null;
      }
      syncLevelState();
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

    hazards.forEach((hazard, i) => {
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

    if (bonusFood) {
      const bx = bonusFood.x * CELL + CELL / 2;
      const by = bonusFood.y * CELL + CELL / 2;
      const pulse = 0.7 + Math.sin(ticks * 0.7) * 0.08;

      ctx.fillStyle = "rgba(255, 221, 117, 0.24)";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * pulse, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#ffcf4a";
      ctx.beginPath();
      ctx.arc(bx, by, CELL * 0.36, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(bx - CELL * 0.08, by - CELL * 0.1, CELL * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }

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
    const speed = currentSpeed();
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
