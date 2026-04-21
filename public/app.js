const screens = {
  auth: document.getElementById("auth-screen"),
  menu: document.getElementById("menu-screen"),
  game: document.getElementById("game-screen"),
};

const loginForm = document.getElementById("login-form");
const registerForm = document.getElementById("register-form");
const loginMessage = document.getElementById("login-message");
const registerMessage = document.getElementById("register-message");

const profileUsername = document.getElementById("profile-username");
const profileMeta = document.getElementById("profile-meta");
const profileUnits = document.getElementById("profile-units");
const levelList = document.getElementById("level-list");
const shopList = document.getElementById("shop-list");
const shopMessage = document.getElementById("shop-message");
const startLevelButton = document.getElementById("start-level");
const logoutButton = document.getElementById("logout-button");

const hudLevel = document.getElementById("hud-level");
const hudBoss = document.getElementById("hud-boss");
const hudCoins = document.getElementById("hud-coins");
const hudUnits = document.getElementById("hud-units");
const hudUpgrade = document.getElementById("hud-upgrade");
const unitSelect = document.getElementById("unit-select");
const sendUnitButton = document.getElementById("send-unit");
const upgradeUnitButton = document.getElementById("upgrade-unit");
const exitLevelButton = document.getElementById("exit-level");

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const resultPanel = document.getElementById("result-panel");
const resultTitle = document.getElementById("result-title");
const resultSummary = document.getElementById("result-summary");
const resultBack = document.getElementById("result-back");

const UNIT_TYPES = {
  leo: {
    name: "Leonardo",
    color: "#2f81f7",
    metaCost: 0,
    stats: { hp: 110, damage: 8, speed: 68, attackRate: 0.8 },
  },
  mike: {
    name: "Michelangelo",
    color: "#f2cc60",
    metaCost: 0,
    stats: { hp: 95, damage: 7, speed: 75, attackRate: 0.75 },
  },
  don: {
    name: "Donatello",
    color: "#a371f7",
    metaCost: 0,
    stats: { hp: 100, damage: 9, speed: 65, attackRate: 0.85 },
  },
  raph: {
    name: "Raphael",
    color: "#f85149",
    metaCost: 0,
    stats: { hp: 115, damage: 8, speed: 64, attackRate: 0.8 },
  },
  splinter: {
    name: "Mistr Tříska",
    color: "#7ee787",
    metaCost: 220,
    stats: { hp: 140, damage: 12, speed: 58, attackRate: 0.9 },
  },
  april: {
    name: "April",
    color: "#ffa657",
    metaCost: 160,
    stats: { hp: 85, damage: 6, speed: 78, attackRate: 0.7 },
  },
  casey: {
    name: "Casey",
    color: "#c9d1d9",
    metaCost: 190,
    stats: { hp: 125, damage: 10, speed: 62, attackRate: 0.85 },
  },
};

const LEVELS = [
  { id: 1, boss: "Bebop", bossHp: 260, towers: 4 },
  { id: 2, boss: "Rocksteady", bossHp: 320, towers: 5 },
  { id: 3, boss: "Rat King", bossHp: 380, towers: 6 },
  { id: 4, boss: "Leatherhead", bossHp: 450, towers: 7 },
  { id: 5, boss: "Krang", bossHp: 520, towers: 8 },
  { id: 6, boss: "Tokka & Rahzar", bossHp: 620, towers: 9 },
  { id: 7, boss: "Trhač", bossHp: 760, towers: 10 },
];

const PATH_POINTS = [
  { x: 60, y: 470 },
  { x: 220, y: 470 },
  { x: 220, y: 120 },
  { x: 520, y: 120 },
  { x: 520, y: 380 },
  { x: 760, y: 380 },
  { x: 760, y: 180 },
  { x: 860, y: 180 },
];

const PATH_SEGMENTS = PATH_POINTS.slice(0, -1).map((point, index) => {
  const next = PATH_POINTS[index + 1];
  const dx = next.x - point.x;
  const dy = next.y - point.y;
  const length = Math.hypot(dx, dy);
  return { start: point, end: next, dx, dy, length };
});

let profile = null;
let selectedLevel = 1;
let gameState = null;
let lastFrame = null;

const request = async (path, options = {}) => {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error || "Server error";
    throw new Error(message);
  }
  return payload;
};

const showScreen = (screen) => {
  Object.values(screens).forEach((section) => section.classList.add("hidden"));
  screens[screen].classList.remove("hidden");
};

const setMessage = (node, text, color = "#f85149") => {
  node.textContent = text;
  node.style.color = color;
};

const loadProfile = async () => {
  const data = await request("/api/profile");
  profile = data.profile;
  renderMenu();
  showScreen("menu");
};

const renderMenu = () => {
  if (!profile) return;
  profileUsername.textContent = profile.username;
  profileMeta.textContent = profile.meta_currency;
  profileUnits.textContent = profile.unlocked_units
    .map((unit) => UNIT_TYPES[unit]?.name || unit)
    .join(", ");

  renderLevels();
  renderShop();
};

const renderLevels = () => {
  levelList.innerHTML = "";
  LEVELS.forEach((level) => {
    const card = document.createElement("div");
    card.className = "level-card";
    const locked = level.id > profile.max_level;
    card.innerHTML = `
      <strong>Level ${level.id}</strong>
      <div>Boss: ${level.boss}</div>
      <div>${locked ? "Uzamčeno" : "Odemčeno"}</div>
    `;
    const button = document.createElement("button");
    button.textContent = locked ? "Zamčeno" : "Vybrat";
    button.disabled = locked;
    button.addEventListener("click", () => {
      selectedLevel = level.id;
      [...levelList.querySelectorAll("button")].forEach((btn) =>
        btn.classList.remove("selected")
      );
      button.classList.add("selected");
    });
    card.appendChild(button);
    levelList.appendChild(card);
  });
};

const renderShop = () => {
  shopList.innerHTML = "";
  shopMessage.textContent = "";
  Object.entries(UNIT_TYPES).forEach(([key, unit]) => {
    if (unit.metaCost === 0) return;
    const item = document.createElement("div");
    item.className = "shop-item";
    const unlocked = profile.unlocked_units.includes(key);
    item.innerHTML = `
      <strong>${unit.name}</strong>
      <div>Cena: ${unit.metaCost} krystalů</div>
      <div>${unlocked ? "Odemčeno" : "Uzamčeno"}</div>
    `;
    const button = document.createElement("button");
    button.textContent = unlocked ? "Odemčeno" : "Koupit";
    button.disabled = unlocked || profile.meta_currency < unit.metaCost;
    button.addEventListener("click", async () => {
      try {
        if (profile.meta_currency < unit.metaCost) return;
        const updatedUnits = [...profile.unlocked_units, key];
        const updatedMeta = profile.meta_currency - unit.metaCost;
        const result = await request("/api/profile", {
          method: "POST",
          body: JSON.stringify({
            unlocked_units: updatedUnits,
            meta_currency: updatedMeta,
          }),
        });
        profile = result.profile;
        renderMenu();
        setMessage(shopMessage, "Jednotka odemčena!", "#7ee787");
      } catch (error) {
        setMessage(shopMessage, error.message);
      }
    });
    item.appendChild(button);
    shopList.appendChild(item);
  });
};

const getUnitStats = (unitId, upgradeLevel) => {
  const base = UNIT_TYPES[unitId].stats;
  const boost = 1 + 0.12 * (upgradeLevel - 1);
  return {
    hp: Math.round(base.hp * boost),
    damage: Math.round(base.damage * boost),
    speed: base.speed * (1 + 0.05 * (upgradeLevel - 1)),
    attackRate: Math.max(0.45, base.attackRate * (1 - 0.04 * (upgradeLevel - 1))),
  };
};

const createUnit = (unitId) => {
  const stats = getUnitStats(unitId, gameState.upgradeLevel);
  return {
    id: `${unitId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    unitId,
    ...stats,
    maxHp: stats.hp,
    segmentIndex: 0,
    distanceOnSegment: 0,
    x: PATH_POINTS[0].x,
    y: PATH_POINTS[0].y,
    attackCooldown: 0,
    atBoss: false,
  };
};

const createBoss = (level) => ({
  name: level.boss,
  hp: level.bossHp,
  maxHp: level.bossHp,
  x: PATH_POINTS[PATH_POINTS.length - 1].x + 25,
  y: PATH_POINTS[PATH_POINTS.length - 1].y,
  damage: 10 + level.id * 2,
  attackRate: 1.4,
  cooldown: 0,
});

const createTowers = (level) => {
  const towers = [];
  const totalSegments = PATH_SEGMENTS.length;
  for (let i = 0; i < level.towers; i += 1) {
    const segmentIndex = i % totalSegments;
    const segment = PATH_SEGMENTS[segmentIndex];
    const ratio = 0.2 + (i % 4) * 0.18;
    const x = segment.start.x + segment.dx * ratio;
    const y = segment.start.y + segment.dy * ratio;
    const offset = i % 2 === 0 ? 40 : -40;
    towers.push({
      x: x + offset,
      y: y + offset * 0.4,
      range: 110 + level.id * 4,
      damage: 6 + level.id * 1.5,
      rate: 1.1 + level.id * 0.05,
      cooldown: Math.random(),
    });
  }
  return towers;
};

const startLevel = (levelId) => {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) return;
  gameState = {
    level,
    boss: createBoss(level),
    units: [],
    towers: createTowers(level),
    coins: 0,
    coinTimer: 0,
    upgradeLevel: 1,
    upgradeCost: 25,
    unitsRemaining: 12 + level.id * 2,
    running: true,
  };

  lastFrame = null;
  resultPanel.classList.add("hidden");
  updateHud();
  populateUnitSelect();
  showScreen("game");
  requestAnimationFrame(gameLoop);
};

const updateHud = () => {
  if (!gameState) return;
  hudLevel.textContent = gameState.level.id;
  hudBoss.textContent = gameState.boss.name;
  hudCoins.textContent = gameState.coins;
  hudUnits.textContent = gameState.unitsRemaining;
  hudUpgrade.textContent = `Lv ${gameState.upgradeLevel}`;
  upgradeUnitButton.textContent = `Upgrade (${gameState.upgradeCost})`;
};

const populateUnitSelect = () => {
  unitSelect.innerHTML = "";
  profile.unlocked_units.forEach((unitId) => {
    const option = document.createElement("option");
    option.value = unitId;
    option.textContent = UNIT_TYPES[unitId]?.name || unitId;
    unitSelect.appendChild(option);
  });
};

const sendUnit = () => {
  if (!gameState || !gameState.running) return;
  if (gameState.unitsRemaining <= 0) return;
  const unitId = unitSelect.value;
  if (!unitId) return;
  gameState.units.push(createUnit(unitId));
  gameState.unitsRemaining -= 1;
  updateHud();
};

const applyUpgrade = () => {
  if (!gameState || !gameState.running) return;
  if (gameState.coins < gameState.upgradeCost) return;
  gameState.coins -= gameState.upgradeCost;
  gameState.upgradeLevel += 1;
  gameState.upgradeCost = Math.round(25 + (gameState.upgradeLevel - 1) * 18);
  gameState.units = gameState.units.map((unit) => {
    const stats = getUnitStats(unit.unitId, gameState.upgradeLevel);
    const hpIncrease = stats.hp - unit.maxHp;
    return {
      ...unit,
      ...stats,
      maxHp: stats.hp,
      hp: Math.min(unit.hp + hpIncrease, stats.hp),
    };
  });
  updateHud();
};

const moveUnit = (unit, delta) => {
  let remaining = unit.speed * delta;
  while (remaining > 0 && !unit.atBoss) {
    const segment = PATH_SEGMENTS[unit.segmentIndex];
    if (!segment) {
      unit.atBoss = true;
      unit.x = gameState.boss.x - 30;
      unit.y = gameState.boss.y + (Math.random() * 40 - 20);
      break;
    }
    const left = segment.length - unit.distanceOnSegment;
    if (remaining >= left) {
      unit.distanceOnSegment = 0;
      unit.segmentIndex += 1;
      remaining -= left;
    } else {
      unit.distanceOnSegment += remaining;
      remaining = 0;
    }
    if (!unit.atBoss && PATH_SEGMENTS[unit.segmentIndex]) {
      const seg = PATH_SEGMENTS[unit.segmentIndex];
      const ratio = unit.distanceOnSegment / seg.length;
      unit.x = seg.start.x + seg.dx * ratio;
      unit.y = seg.start.y + seg.dy * ratio;
    }
  }
};

const updateUnits = (delta) => {
  gameState.units.forEach((unit) => {
    if (!unit.atBoss) {
      moveUnit(unit, delta);
      return;
    }
    unit.attackCooldown -= delta;
    if (unit.attackCooldown <= 0) {
      gameState.boss.hp -= unit.damage;
      unit.attackCooldown = unit.attackRate;
    }
  });
  gameState.units = gameState.units.filter((unit) => unit.hp > 0);
};

const updateTowers = (delta) => {
  gameState.towers.forEach((tower) => {
    tower.cooldown -= delta;
    if (tower.cooldown > 0) return;
    const target = gameState.units.find((unit) => {
      const dx = unit.x - tower.x;
      const dy = unit.y - tower.y;
      return Math.hypot(dx, dy) <= tower.range;
    });
    if (target) {
      target.hp -= tower.damage;
      tower.cooldown = 1 / tower.rate;
    }
  });
};

const updateBoss = (delta) => {
  gameState.boss.cooldown -= delta;
  if (gameState.boss.cooldown > 0) return;
  const target = gameState.units.find((unit) => unit.atBoss);
  if (!target) return;
  target.hp -= gameState.boss.damage;
  gameState.boss.cooldown = gameState.boss.attackRate;
};

const updateCoins = (delta) => {
  gameState.coinTimer += delta;
  if (gameState.coinTimer >= 1) {
    const alive = gameState.units.length;
    gameState.coins += alive;
    gameState.coinTimer -= 1;
  }
};

const checkEnd = async () => {
  if (!gameState.running) return;
  if (gameState.boss.hp <= 0) {
    await endLevel(true);
    return;
  }
  if (gameState.unitsRemaining === 0 && gameState.units.length === 0) {
    await endLevel(false);
  }
};

const endLevel = async (won) => {
  gameState.running = false;
  const metaEarned =
    Math.floor(gameState.coins / 10) +
    (won ? 25 : 5) +
    (won ? gameState.unitsRemaining * 2 : 0);
  const newMeta = profile.meta_currency + metaEarned;
  const newMax =
    won &&
    profile.max_level === gameState.level.id &&
    gameState.level.id < LEVELS.length
      ? profile.max_level + 1
      : profile.max_level;

  try {
    const result = await request("/api/profile", {
      method: "POST",
      body: JSON.stringify({
        meta_currency: newMeta,
        max_level: newMax,
      }),
    });
    profile = result.profile;
  } catch (error) {
    profile.meta_currency = newMeta;
    profile.max_level = newMax;
  }

  resultTitle.textContent = won ? "Výhra!" : "Prohra!";
  resultSummary.textContent = `Získáno ${metaEarned} krystalů.`;
  resultPanel.classList.remove("hidden");

  if (!won) {
    setTimeout(() => {
      showScreen("menu");
      renderMenu();
    }, 1800);
  }
};

const drawPath = () => {
  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.beginPath();
  PATH_POINTS.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
};

const drawTowers = () => {
  gameState.towers.forEach((tower) => {
    ctx.fillStyle = "#ff7b72";
    ctx.fillRect(tower.x - 10, tower.y - 10, 20, 20);
  });
};

const drawBoss = () => {
  const boss = gameState.boss;
  ctx.fillStyle = "#f85149";
  ctx.beginPath();
  ctx.arc(boss.x, boss.y, 30, 0, Math.PI * 2);
  ctx.fill();

  const barWidth = 120;
  const barHeight = 8;
  const x = boss.x - barWidth / 2;
  const y = boss.y - 50;
  ctx.fillStyle = "#21262d";
  ctx.fillRect(x, y, barWidth, barHeight);
  ctx.fillStyle = "#2ea043";
  ctx.fillRect(x, y, (boss.hp / boss.maxHp) * barWidth, barHeight);
};

const drawUnits = () => {
  gameState.units.forEach((unit) => {
    ctx.fillStyle = UNIT_TYPES[unit.unitId]?.color || "#58a6ff";
    ctx.beginPath();
    ctx.arc(unit.x, unit.y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#0d1117";
    ctx.fillRect(unit.x - 12, unit.y - 18, 24, 4);
    ctx.fillStyle = "#7ee787";
    ctx.fillRect(
      unit.x - 12,
      unit.y - 18,
      (unit.hp / unit.maxHp) * 24,
      4
    );
  });
};

const render = () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawPath();
  drawTowers();
  drawBoss();
  drawUnits();
};

const gameLoop = (timestamp) => {
  if (!gameState || !gameState.running) {
    render();
    return;
  }
  if (!lastFrame) lastFrame = timestamp;
  const delta = Math.min(0.05, (timestamp - lastFrame) / 1000);
  lastFrame = timestamp;

  updateUnits(delta);
  updateTowers(delta);
  updateBoss(delta);
  updateCoins(delta);
  updateHud();
  render();
  checkEnd();
  requestAnimationFrame(gameLoop);
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(loginMessage, "");
  const form = new FormData(loginForm);
  try {
    await request("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    await loadProfile();
  } catch (error) {
    setMessage(loginMessage, error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage(registerMessage, "");
  const form = new FormData(registerForm);
  try {
    await request("/api/register", {
      method: "POST",
      body: JSON.stringify({
        username: form.get("username"),
        password: form.get("password"),
      }),
    });
    await loadProfile();
  } catch (error) {
    setMessage(registerMessage, error.message);
  }
});

logoutButton.addEventListener("click", async () => {
  await request("/api/logout", { method: "POST" });
  profile = null;
  showScreen("auth");
});

startLevelButton.addEventListener("click", () => {
  startLevel(selectedLevel);
});

sendUnitButton.addEventListener("click", sendUnit);
upgradeUnitButton.addEventListener("click", applyUpgrade);
exitLevelButton.addEventListener("click", () => {
  gameState.running = false;
  showScreen("menu");
});

resultBack.addEventListener("click", () => {
  showScreen("menu");
  renderMenu();
});

const init = async () => {
  try {
    await loadProfile();
  } catch (error) {
    showScreen("auth");
  }
};

init();
