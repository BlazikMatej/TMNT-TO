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
const characterStatsList = document.getElementById("character-stats-list");
const characterStatsMessage = document.getElementById("character-stats-message");
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

const UNIT_LEVEL_MAX = 20;
const UNIT_TYPES = {
  leo: {
    name: "Leonardo",
    color: "#2f81f7",
    metaCost: 0,
    upgradeBaseCost: 25,
    stats: { hp: 92, damage: 6, speed: 62, attackRate: 0.95 },
  },
  mike: {
    name: "Michelangelo",
    color: "#f2cc60",
    metaCost: 0,
    upgradeBaseCost: 23,
    stats: { hp: 80, damage: 6, speed: 72, attackRate: 0.92 },
  },
  don: {
    name: "Donatello",
    color: "#a371f7",
    metaCost: 0,
    upgradeBaseCost: 27,
    stats: { hp: 88, damage: 7, speed: 58, attackRate: 0.98 },
  },
  raph: {
    name: "Raphael",
    color: "#f85149",
    metaCost: 0,
    upgradeBaseCost: 25,
    stats: { hp: 96, damage: 7, speed: 60, attackRate: 0.96 },
  },
  splinter: {
    name: "Mistr Tříska",
    color: "#7ee787",
    metaCost: 300,
    upgradeBaseCost: 36,
    stats: { hp: 120, damage: 10, speed: 56, attackRate: 0.98 },
  },
  april: {
    name: "April",
    color: "#ffa657",
    metaCost: 240,
    upgradeBaseCost: 31,
    stats: { hp: 74, damage: 6, speed: 76, attackRate: 0.86 },
  },
  casey: {
    name: "Casey",
    color: "#c9d1d9",
    metaCost: 280,
    upgradeBaseCost: 34,
    stats: { hp: 110, damage: 9, speed: 57, attackRate: 1 },
  },
};

const LEVELS = [
  { id: 1, boss: "Bebop", bossHp: 760, towers: 6 },
  { id: 2, boss: "Rocksteady", bossHp: 1080, towers: 7 },
  { id: 3, boss: "Fishface", bossHp: 1450, towers: 8 },
  { id: 4, boss: "Dogpound", bossHp: 1880, towers: 9 },
  { id: 5, boss: "Tiger Claw", bossHp: 2380, towers: 10 },
  { id: 6, boss: "Karai", bossHp: 2950, towers: 11 },
  { id: 7, boss: "Trhač", bossHp: 3700, towers: 12 },
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

const createDefaultUnitUpgrades = () =>
  Object.keys(UNIT_TYPES).reduce((acc, unitId) => {
    acc[unitId] = 1;
    return acc;
  }, {});

const normalizeProfile = (rawProfile) => {
  const normalized = { ...rawProfile };
  normalized.meta_currency = Number.isInteger(rawProfile.meta_currency)
    ? Math.max(0, rawProfile.meta_currency)
    : 0;
  normalized.max_level = Number.isInteger(rawProfile.max_level)
    ? Math.max(1, rawProfile.max_level)
    : 1;
  normalized.unlocked_units = Array.isArray(rawProfile.unlocked_units)
    ? rawProfile.unlocked_units.filter((unitId) => UNIT_TYPES[unitId])
    : ["leo", "mike", "don", "raph"];
  normalized.unit_upgrades = createDefaultUnitUpgrades();

  if (rawProfile.unit_upgrades && typeof rawProfile.unit_upgrades === "object") {
    Object.entries(rawProfile.unit_upgrades).forEach(([unitId, level]) => {
      if (!UNIT_TYPES[unitId] || !Number.isInteger(level)) return;
      normalized.unit_upgrades[unitId] = Math.min(UNIT_LEVEL_MAX, Math.max(1, level));
    });
  }

  return normalized;
};

const loadProfile = async () => {
  const data = await request("/api/profile");
  profile = normalizeProfile(data.profile);
  renderMenu();
  showScreen("menu");
};

const getUnitLevel = (unitId, sourceProfile = profile) =>
  sourceProfile?.unit_upgrades?.[unitId] || 1;

const getUpgradeCost = (unitId, currentLevel) => {
  const base = UNIT_TYPES[unitId].upgradeBaseCost || 25;
  return Math.round(base * Math.pow(1.45, currentLevel - 1));
};

const getUnitStats = (unitId, level) => {
  const base = UNIT_TYPES[unitId].stats;
  const hpBoost = 1 + 0.19 * (level - 1);
  const damageBoost = 1 + 0.17 * (level - 1);
  const speedBoost = 1 + 0.035 * (level - 1);
  const attackBoost = 1 - 0.02 * (level - 1);

  return {
    hp: Math.round(base.hp * hpBoost),
    damage: Math.round(base.damage * damageBoost),
    speed: Math.round(base.speed * speedBoost),
    attackRate: Math.max(0.45, Number((base.attackRate * attackBoost).toFixed(2))),
  };
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
  renderCharacterStats();
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
            unit_upgrades: profile.unit_upgrades,
          }),
        });
        profile = normalizeProfile(result.profile);
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

const renderCharacterStats = () => {
  characterStatsList.innerHTML = "";
  characterStatsMessage.textContent = "";

  profile.unlocked_units.forEach((unitId) => {
    const card = document.createElement("div");
    card.className = "unit-stat-card";

    const level = getUnitLevel(unitId);
    const stats = getUnitStats(unitId, level);
    const maxed = level >= UNIT_LEVEL_MAX;
    const nextCost = maxed ? 0 : getUpgradeCost(unitId, level);

    card.innerHTML = `
      <strong>${UNIT_TYPES[unitId].name} (Lv ${level})</strong>
      <div class="meta">HP ${stats.hp} · DMG ${stats.damage} · SPD ${stats.speed} · ATK ${stats.attackRate}s</div>
      <div class="meta">${maxed ? "MAX úroveň" : `Cena upgradu: ${nextCost} krystalů`}</div>
    `;

    const button = document.createElement("button");
    button.textContent = maxed ? "MAX" : `Upgrade na Lv ${level + 1}`;
    button.disabled = maxed || profile.meta_currency < nextCost;
    button.addEventListener("click", async () => {
      if (maxed || profile.meta_currency < nextCost) return;
      try {
        const nextUpgrades = {
          ...profile.unit_upgrades,
          [unitId]: level + 1,
        };
        const result = await request("/api/profile", {
          method: "POST",
          body: JSON.stringify({
            meta_currency: profile.meta_currency - nextCost,
            unit_upgrades: nextUpgrades,
          }),
        });
        profile = normalizeProfile(result.profile);
        renderMenu();
        setMessage(characterStatsMessage, `${UNIT_TYPES[unitId].name} vylepšen.`, "#7ee787");
      } catch (error) {
        setMessage(characterStatsMessage, error.message);
      }
    });

    card.appendChild(button);
    characterStatsList.appendChild(card);
  });
};

const getAvailableDeployments = () =>
  profile.unlocked_units.reduce((acc, unitId) => {
    acc[unitId] = false;
    return acc;
  }, {});

const countUndeployedUnits = (deployments) =>
  Object.values(deployments).filter((used) => !used).length;

const createUnit = (unitId) => {
  const stats = getUnitStats(unitId, getUnitLevel(unitId));
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
  damage: 16 + level.id * 2.5,
  attackRate: Math.max(0.7, 1.15 - level.id * 0.04),
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
    const offset = i % 2 === 0 ? 42 : -42;
    towers.push({
      x: x + offset,
      y: y + offset * 0.4,
      range: 128 + level.id * 5,
      damage: 12 + level.id * 2.2,
      rate: 1.35 + level.id * 0.08,
      cooldown: Math.random(),
    });
  }
  return towers;
};

const startLevel = (levelId) => {
  const level = LEVELS.find((item) => item.id === levelId);
  if (!level) return;

  const deployments = getAvailableDeployments();
  gameState = {
    level,
    boss: createBoss(level),
    units: [],
    towers: createTowers(level),
    coins: 0,
    coinTimer: 0,
    deployedUnits: deployments,
    unitsRemaining: countUndeployedUnits(deployments),
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
  hudUpgrade.textContent = "Meta upgrade v menu";
  upgradeUnitButton.disabled = true;
};

const populateUnitSelect = () => {
  unitSelect.innerHTML = "";
  const availableUnits = profile.unlocked_units.filter(
    (unitId) => !gameState.deployedUnits[unitId]
  );

  availableUnits.forEach((unitId) => {
    const option = document.createElement("option");
    option.value = unitId;
    option.textContent = `${UNIT_TYPES[unitId]?.name || unitId} (Lv ${getUnitLevel(unitId)})`;
    unitSelect.appendChild(option);
  });

  sendUnitButton.disabled = availableUnits.length === 0;
};

const sendUnit = () => {
  if (!gameState || !gameState.running) return;
  const unitId = unitSelect.value;
  if (!unitId || gameState.deployedUnits[unitId]) return;
  gameState.units.push(createUnit(unitId));
  gameState.deployedUnits[unitId] = true;
  gameState.unitsRemaining = countUndeployedUnits(gameState.deployedUnits);
  populateUnitSelect();
  updateHud();
};

const applyUpgrade = () => {
  return;
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
    gameState.coins += Math.max(1, alive);
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
  const baseReward = won ? 40 + gameState.level.id * 18 : 8 + gameState.level.id * 4;
  const coinBonus = Math.floor(gameState.coins / 6);
  const surviveBonus = won ? gameState.units.length * 3 : 0;
  const metaEarned = baseReward + coinBonus + surviveBonus;
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
        unit_upgrades: profile.unit_upgrades,
      }),
    });
    profile = normalizeProfile(result.profile);
  } catch (error) {
    profile.meta_currency = newMeta;
    profile.max_level = newMax;
  }

  resultTitle.textContent = won ? "Výhra!" : "Prohra!";
  resultSummary.textContent = `Získáno ${metaEarned} krystalů. Jednotky můžeš vylepšit v menu.`;
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
  ctx.fillRect(x, y, Math.max(0, boss.hp / boss.maxHp) * barWidth, barHeight);
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
      Math.max(0, unit.hp / unit.maxHp) * 24,
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
  if (gameState) {
    gameState.running = false;
  }
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
