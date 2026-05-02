/**
 * Snake game rules (pure state). Loaded before game.js; exposed on globalThis.SnakeGameCore.
 */
(function (g) {
  const C = {
    COLS: 20,
    ROWS: 20,
    POINTS_PER_LEVEL: 5,
    BASE_SPEED: 8,
    MAX_SPEED: 14,
    BONUS_VALUE: 3,
    BONUS_LIFETIME: 34,
    COMBO_WINDOW: 22,
    MAX_HAZARDS: 12,
  };

  function sameCell(a, b) {
    return a && b && a.x === b.x && a.y === b.y;
  }

  function overlapsSnake(state, cell) {
    return state.snake.some((s) => sameCell(s, cell));
  }

  function overlapsHazard(state, cell) {
    return state.hazards.some((h) => sameCell(h, cell));
  }

  function isOccupied(state, cell) {
    return (
      overlapsSnake(state, cell)
      || overlapsHazard(state, cell)
      || sameCell(state.food, cell)
      || sameCell(state.bonusFood, cell)
    );
  }

  function spawnOpenCell(state, random01) {
    let cell;
    let guard = 0;
    do {
      cell = {
        x: Math.floor(random01() * C.COLS),
        y: Math.floor(random01() * C.ROWS),
      };
      guard += 1;
      if (guard > C.COLS * C.ROWS * 4) {
        throw new Error("spawnOpenCell: no free cell");
      }
    } while (isOccupied(state, cell));
    return cell;
  }

  function spawnFood(state, random01) {
    let f;
    let guard = 0;
    do {
      f = {
        x: Math.floor(random01() * C.COLS),
        y: Math.floor(random01() * C.ROWS),
      };
      guard += 1;
      if (guard > C.COLS * C.ROWS * 4) {
        throw new Error("spawnFood: no free cell");
      }
    } while (
      overlapsSnake(state, f)
      || overlapsHazard(state, f)
      || sameCell(state.bonusFood, f)
    );
    return f;
  }

  function ensureHazards(state, random01) {
    const target = Math.min(C.MAX_HAZARDS, Math.max(0, state.level - 2) * 2);
    while (state.hazards.length < target) {
      state.hazards.push(spawnOpenCell(state, random01));
    }
    if (state.hazards.length > target) {
      state.hazards.length = target;
    }
  }

  function computeLevel(score) {
    return Math.floor(score / C.POINTS_PER_LEVEL) + 1;
  }

  function currentSpeed(level) {
    return Math.min(C.MAX_SPEED, C.BASE_SPEED + level - 1);
  }

  /**
   * @returns {{ snake: {{x:number,y:number}}[], direction: object, nextDirection: object,
   *   food: object, bonusFood: object|null, hazards: object[], score: number, level: number,
   *   bonusTicks: number, nextBonusScore: number, combo: number, comboTicks: number,
   *   dead: boolean, win: boolean, overlayTitle: string|null }}
   */
  function createState(random01) {
    const mid = { x: Math.floor(C.COLS / 2), y: Math.floor(C.ROWS / 2) };
    const snake = [mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }];
    const state = {
      snake,
      direction: { x: 1, y: 0 },
      nextDirection: { x: 1, y: 0 },
      food: { x: 0, y: 0 },
      bonusFood: null,
      hazards: [],
      score: 0,
      level: 1,
      bonusTicks: 0,
      nextBonusScore: C.POINTS_PER_LEVEL,
      combo: 0,
      comboTicks: 0,
      dead: false,
      win: false,
      overlayTitle: null,
    };
    state.food = spawnFood(state, random01);
    ensureHazards(state, random01);
    return state;
  }

  function resetState(state, random01) {
    const mid = { x: Math.floor(C.COLS / 2), y: Math.floor(C.ROWS / 2) };
    state.snake = [mid, { x: mid.x - 1, y: mid.y }, { x: mid.x - 2, y: mid.y }];
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
    state.bonusFood = null;
    state.hazards = [];
    state.score = 0;
    state.level = 1;
    state.bonusTicks = 0;
    state.nextBonusScore = C.POINTS_PER_LEVEL;
    state.combo = 0;
    state.comboTicks = 0;
    state.dead = false;
    state.win = false;
    state.overlayTitle = null;
    state.food = spawnFood(state, random01);
    ensureHazards(state, random01);
  }

  function syncLevelFromScore(state, random01) {
    const nextLevel = computeLevel(state.score);
    const leveledUp = nextLevel > state.level;
    state.level = nextLevel;
    ensureHazards(state, random01);
    return leveledUp;
  }

  function maybeSpawnBonus(state, random01) {
    if (state.bonusFood || state.score < state.nextBonusScore) return;
    state.bonusFood = spawnOpenCell(state, random01);
    state.bonusTicks = C.BONUS_LIFETIME;
    state.nextBonusScore += C.POINTS_PER_LEVEL;
    syncLevelFromScore(state, random01);
  }

  function opposites(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function stepOnce(state, random01) {
    if (state.dead || state.win) return;

    state.direction = { ...state.nextDirection };
    const head = state.snake[0];
    const nx = head.x + state.direction.x;
    const ny = head.y + state.direction.y;

    if (nx < 0 || nx >= C.COLS || ny < 0 || ny >= C.ROWS) {
      state.dead = true;
      state.overlayTitle = "Game over";
      return;
    }

    const nextHead = { x: nx, y: ny };
    if (state.snake.slice(0, -1).some((s) => s.x === nx && s.y === ny)) {
      state.dead = true;
      state.overlayTitle = "Game over";
      return;
    }
    if (overlapsHazard(state, nextHead)) {
      state.dead = true;
      state.overlayTitle = "Hazard hit";
      return;
    }

    state.snake.unshift(nextHead);

    const ateFood = nx === state.food.x && ny === state.food.y;
    const ateBonus = state.bonusFood && nx === state.bonusFood.x && ny === state.bonusFood.y;

    if (ateFood || ateBonus) {
      state.combo = state.comboTicks > 0 ? state.combo + 1 : 1;
      state.comboTicks = C.COMBO_WINDOW;
      const basePoints = ateBonus ? C.BONUS_VALUE : 1;
      const comboBonus = Math.max(0, state.combo - 1);
      const gained = basePoints + comboBonus;
      state.score += gained;
      if (ateBonus) {
        state.bonusFood = null;
        state.bonusTicks = 0;
      }
      syncLevelFromScore(state, random01);
      if (state.snake.length + state.hazards.length === C.COLS * C.ROWS) {
        state.win = true;
        state.dead = true;
        state.overlayTitle = "Board cleared";
        return;
      }
      if (ateFood) state.food = spawnFood(state, random01);
      maybeSpawnBonus(state, random01);
    } else {
      state.snake.pop();
      if (state.comboTicks > 0) {
        state.comboTicks -= 1;
        if (state.comboTicks === 0) state.combo = 0;
        syncLevelFromScore(state, random01);
      }
    }

    if (state.bonusFood && state.bonusTicks > 0) {
      state.bonusTicks -= 1;
      if (state.bonusTicks === 0) {
        state.bonusFood = null;
      }
      syncLevelFromScore(state, random01);
    }
  }

  function trySetNextDirection(state, d) {
    if (!d) return;
    if (!opposites(d, state.direction)) {
      state.nextDirection = d;
    }
  }

  g.SnakeGameCore = {
    CONST: C,
    sameCell,
    createState,
    resetState,
    syncLevelFromScore,
    stepOnce,
    trySetNextDirection,
    computeLevel,
    currentSpeed,
    spawnFood,
    spawnOpenCell,
    ensureHazards,
    maybeSpawnBonus,
    opposites,
    _isOccupiedForTest: isOccupied,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
