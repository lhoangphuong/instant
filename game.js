(() => {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const scoreEl = document.getElementById("score");
  const restartBtn = document.getElementById("restart");
  const hintEl = document.getElementById("hint");

  const CELL = 20;
  const COLS = canvas.width / CELL;
  const ROWS = canvas.height / CELL;

  let snake;
  let direction;
  let nextDirection;
  let food;
  let score;
  let ticks;
  let running;

  const randomCell = () => ({
    x: Math.floor(Math.random() * COLS),
    y: Math.floor(Math.random() * ROWS),
  });

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
    scoreEl.textContent = "0";
    restartBtn.hidden = true;
    hintEl.textContent = "Press any arrow key to start";
    hintEl.classList.remove("fade");
  }

  function gameOver() {
    running = false;
    hintEl.textContent = "Game over";
    restartBtn.hidden = false;
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
    if (snake.some((s) => s.x === nx && s.y === ny)) {
      gameOver();
      return;
    }

    snake.unshift({ x: nx, y: ny });

    if (nx === food.x && ny === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      food = spawnFood();
    } else {
      snake.pop();
    }
  }

  function draw() {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const gridAlpha = 0.06;
    ctx.strokeStyle = `rgba(148, 163, 184, ${gridAlpha})`;
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
      ctx.beginPath();
      ctx.moveTo(x * CELL, 0);
      ctx.lineTo(x * CELL, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * CELL);
      ctx.lineTo(canvas.width, y * CELL);
      ctx.stroke();
    }

    ctx.fillStyle = "#f43f5e";
    ctx.beginPath();
    ctx.arc(
      food.x * CELL + CELL / 2,
      food.y * CELL + CELL / 2,
      CELL * 0.35,
      0,
      Math.PI * 2
    );
    ctx.fill();

    snake.forEach((seg, i) => {
      const t = i / Math.max(snake.length - 1, 1);
      const g = 80 + Math.floor(120 * (1 - t));
      ctx.fillStyle = `rgb(56, ${g + 60}, 180)`;
      const pad = i === 0 ? 2 : 3;
      ctx.fillRect(
        seg.x * CELL + pad,
        seg.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2
      );
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

  document.addEventListener("keydown", (e) => {
    const opposites = (a, b) => a.x === -b.x && a.y === -b.y;
    let d = null;
    switch (e.key) {
      case "ArrowUp":
        d = { x: 0, y: -1 };
        break;
      case "ArrowDown":
        d = { x: 0, y: 1 };
        break;
      case "ArrowLeft":
        d = { x: -1, y: 0 };
        break;
      case "ArrowRight":
        d = { x: 1, y: 0 };
        break;
      default:
        return;
    }
    e.preventDefault();
    if (!running && restartBtn.hidden) running = true;
    if (!opposites(d, direction)) nextDirection = d;
    hintEl.classList.add("fade");
  });

  restartBtn.addEventListener("click", () => {
    reset();
    draw();
  });

  reset();
  requestAnimationFrame(loop);
})();
