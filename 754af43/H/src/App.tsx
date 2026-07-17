import { useEffect, useRef, useState } from "react";

const VIEW_WIDTH = 480;
const VIEW_HEIGHT = 270;
const GROUND_Y = 226;
const PLAYER_HEIGHT = 29;
const PLAYER_DUCK_HEIGHT = 17;
const PLAYER_WIDTH = 18;
const MAX_HP = 100;
const MAX_LIVES = 3;
const GRAVITY = 760;
const PLAYER_SPEED = 96;
const JUMP_VELOCITY = -286;

type Direction = -1 | 1;
type GameMode = "title" | "intro" | "playing" | "stageClear" | "lifeLost" | "continue" | "victory";
type WeaponName = "pistol" | "lazer" | "missile" | "machineGun" | "uzi";
type EnemyKind = "rifle" | "grenadier" | "runner" | "helicopter" | "tank" | "baker" | "napoleon";
type StageTheme = "alps" | "city" | "mountain" | "capital";
type DestructibleKind = "box" | "barrel";
type InputAction = "left" | "right" | "down" | "shoot" | "grenade" | "jump";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Platform extends Rect {
  style?: "wood" | "stone" | "metal";
}

interface SpawnSpec {
  x: number;
  kind: EnemyKind;
  ground?: number;
  y?: number;
}

interface DestructibleSpec {
  x: number;
  kind: DestructibleKind;
  ground?: number;
}

interface BossSpec {
  kind: "baker" | "napoleon";
  start: number;
  name: string;
}

interface StageData {
  name: string;
  subtitle: string;
  theme: StageTheme;
  length: number;
  platforms: Platform[];
  spawns: SpawnSpec[];
  destructibles: DestructibleSpec[];
  boss?: BossSpec;
}

interface Player {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  facing: Direction;
  onGround: boolean;
  ducking: boolean;
  hp: number;
  lives: number;
  invuln: number;
  weapon: WeaponName;
  ammo: number;
  shootCooldown: number;
  grenadeCooldown: number;
  shootFlash: number;
  hurtFlash: number;
  anim: number;
  checkpoint: number;
}

interface Projectile extends Rect {
  vx: number;
  vy: number;
  damage: number;
  owner: "player" | "enemy";
  kind: string;
  life: number;
  pierce: number;
  explosive: number;
  gravity: number;
  spin: number;
}

interface Grenade extends Rect {
  vx: number;
  vy: number;
  life: number;
  damage: number;
  radius: number;
  owner: "player" | "enemy";
  kind: "codfish" | "grenade";
  spin: number;
}

interface Enemy extends Rect {
  id: number;
  kind: EnemyKind;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  dir: Direction;
  baseY: number;
  phase: number;
  shootTimer: number;
  burstShots: number;
  burstTimer: number;
  attackTimer: number;
  grenadeTimer: number;
  summonTimer: number;
  score: number;
  dead: boolean;
}

interface Destructible extends Rect {
  id: number;
  kind: DestructibleKind;
  hp: number;
  maxHp: number;
  opened: boolean;
}

interface Pickup extends Rect {
  id: number;
  kind: "weapon" | "food";
  weapon?: WeaponName;
  heal?: number;
  label: string;
  vy: number;
  bob: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

interface BossArena {
  left: number;
  right: number;
}

interface Inputs {
  left: boolean;
  right: boolean;
  down: boolean;
  shoot: boolean;
  grenade: boolean;
  jump: boolean;
}

interface GameState {
  mode: GameMode;
  stageIndex: number;
  stage: StageData;
  player: Player;
  bullets: Projectile[];
  enemyBullets: Projectile[];
  grenades: Grenade[];
  enemies: Enemy[];
  destructibles: Destructible[];
  pickups: Pickup[];
  particles: Particle[];
  keys: Inputs;
  jumpQueued: boolean;
  grenadeQueued: boolean;
  cameraX: number;
  spawnCursor: number;
  time: number;
  missionTime: number;
  introTime: number;
  modeTimer: number;
  message: string;
  messageTimer: number;
  score: number;
  continueCount: number;
  entityId: number;
  shake: number;
  bossActive: boolean;
  bossDefeated: boolean;
  bossArena: BossArena | null;
  bossEndTimer: number;
}

interface HudSnapshot {
  mode: GameMode;
  stage: number;
  stageName: string;
  stageSubtitle: string;
  hp: number;
  lives: number;
  weaponLabel: string;
  ammoLabel: string;
  score: number;
  message: string;
  continueCount: number;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
}

interface WeaponStats {
  label: string;
  cooldown: number;
  speed: number;
  damage: number;
  ammo: number;
  w: number;
  h: number;
  color: string;
  pierce: number;
  explosive: number;
  spread: number;
}

const WEAPONS: Record<WeaponName, WeaponStats> = {
  pistol: { label: "Pistol", cooldown: 0.24, speed: 360, damage: 11, ammo: 0, w: 5, h: 2, color: "#fff0a6", pierce: 0, explosive: 0, spread: 0 },
  lazer: { label: "Lazer", cooldown: 0.18, speed: 640, damage: 25, ammo: 32, w: 20, h: 3, color: "#6ff8ff", pierce: 3, explosive: 0, spread: 0 },
  missile: { label: "Missile Launcher", cooldown: 0.54, speed: 250, damage: 42, ammo: 14, w: 10, h: 4, color: "#f6d7a7", pierce: 0, explosive: 36, spread: 0 },
  machineGun: { label: "Machine Gun", cooldown: 0.075, speed: 430, damage: 8, ammo: 90, w: 6, h: 2, color: "#ffe37a", pierce: 0, explosive: 0, spread: 14 },
  uzi: { label: "Uzi", cooldown: 0.048, speed: 390, damage: 6, ammo: 130, w: 4, h: 2, color: "#ffd25f", pierce: 0, explosive: 0, spread: 34 },
};

const UPGRADE_WEAPONS: WeaponName[] = ["lazer", "missile", "machineGun", "uzi"];

const STAGES: StageData[] = [
  {
    name: "Alpine Wake-Up",
    subtitle: "Chalets, cowbells, and tricolor checkpoints",
    theme: "alps",
    length: 2300,
    platforms: [
      { x: 310, y: 180, w: 120, h: 12, style: "wood" }, { x: 520, y: 150, w: 86, h: 12, style: "wood" },
      { x: 750, y: 191, w: 96, h: 12, style: "stone" }, { x: 955, y: 160, w: 152, h: 12, style: "wood" },
      { x: 1235, y: 181, w: 118, h: 12, style: "stone" }, { x: 1500, y: 150, w: 104, h: 12, style: "wood" },
      { x: 1778, y: 177, w: 182, h: 12, style: "stone" },
    ],
    spawns: [
      { x: 260, kind: "rifle" }, { x: 360, kind: "runner" }, { x: 520, kind: "grenadier", ground: 150 },
      { x: 650, kind: "rifle" }, { x: 780, kind: "runner" }, { x: 910, kind: "rifle" },
      { x: 1010, kind: "grenadier", ground: 160 }, { x: 1175, kind: "helicopter", y: 72 },
      { x: 1290, kind: "rifle" }, { x: 1440, kind: "runner" }, { x: 1570, kind: "rifle", ground: 150 },
      { x: 1710, kind: "tank" }, { x: 1890, kind: "grenadier", ground: 177 }, { x: 2060, kind: "rifle" },
    ],
    destructibles: [
      { x: 235, kind: "barrel" }, { x: 420, kind: "box", ground: 180 }, { x: 690, kind: "box" },
      { x: 820, kind: "barrel", ground: 191 }, { x: 1120, kind: "box" }, { x: 1335, kind: "barrel" },
      { x: 1602, kind: "box", ground: 150 }, { x: 1980, kind: "box" },
    ],
  },
  {
    name: "Occupied Geneva",
    subtitle: "Fight down the riverfront to the hostile bakery",
    theme: "city",
    length: 2680,
    platforms: [
      { x: 260, y: 173, w: 132, h: 12, style: "stone" }, { x: 470, y: 140, w: 108, h: 12, style: "stone" },
      { x: 670, y: 188, w: 136, h: 12, style: "metal" }, { x: 925, y: 154, w: 154, h: 12, style: "stone" },
      { x: 1190, y: 184, w: 96, h: 12, style: "metal" }, { x: 1390, y: 148, w: 178, h: 12, style: "stone" },
      { x: 1690, y: 184, w: 130, h: 12, style: "metal" }, { x: 1955, y: 157, w: 150, h: 12, style: "stone" },
    ],
    spawns: [
      { x: 230, kind: "rifle" }, { x: 315, kind: "rifle", ground: 173 }, { x: 460, kind: "grenadier" },
      { x: 560, kind: "runner", ground: 140 }, { x: 720, kind: "rifle" }, { x: 840, kind: "helicopter", y: 66 },
      { x: 990, kind: "grenadier", ground: 154 }, { x: 1130, kind: "runner" }, { x: 1275, kind: "tank" },
      { x: 1450, kind: "rifle", ground: 148 }, { x: 1570, kind: "grenadier", ground: 148 },
      { x: 1740, kind: "rifle", ground: 184 }, { x: 1870, kind: "runner" }, { x: 2030, kind: "tank" },
      { x: 2140, kind: "rifle" },
    ],
    destructibles: [
      { x: 210, kind: "box" }, { x: 385, kind: "barrel", ground: 173 }, { x: 610, kind: "box" },
      { x: 790, kind: "barrel", ground: 188 }, { x: 1085, kind: "box" }, { x: 1310, kind: "barrel" },
      { x: 1510, kind: "box", ground: 148 }, { x: 1835, kind: "barrel" }, { x: 2110, kind: "box", ground: 157 },
    ],
    boss: { kind: "baker", start: 2260, name: "Croissant Commandant" },
  },
  {
    name: "Gotthard Fireline",
    subtitle: "A frozen pass with bunkers, rails, tanks, and gunships",
    theme: "mountain",
    length: 2520,
    platforms: [
      { x: 280, y: 186, w: 126, h: 12, style: "stone" }, { x: 520, y: 154, w: 132, h: 12, style: "metal" },
      { x: 730, y: 122, w: 82, h: 12, style: "metal" }, { x: 920, y: 188, w: 154, h: 12, style: "stone" },
      { x: 1190, y: 150, w: 128, h: 12, style: "metal" }, { x: 1460, y: 180, w: 162, h: 12, style: "stone" },
      { x: 1740, y: 142, w: 118, h: 12, style: "metal" }, { x: 2010, y: 180, w: 210, h: 12, style: "stone" },
    ],
    spawns: [
      { x: 240, kind: "runner" }, { x: 340, kind: "rifle", ground: 186 }, { x: 500, kind: "grenadier" },
      { x: 610, kind: "rifle", ground: 154 }, { x: 790, kind: "helicopter", y: 62 }, { x: 940, kind: "tank" },
      { x: 1060, kind: "grenadier" }, { x: 1245, kind: "rifle", ground: 150 }, { x: 1370, kind: "runner" },
      { x: 1510, kind: "tank" }, { x: 1630, kind: "helicopter", y: 78 }, { x: 1780, kind: "grenadier", ground: 142 },
      { x: 1940, kind: "rifle" }, { x: 2120, kind: "tank", ground: 180 }, { x: 2290, kind: "rifle" },
    ],
    destructibles: [
      { x: 190, kind: "barrel" }, { x: 405, kind: "box", ground: 186 }, { x: 675, kind: "barrel" },
      { x: 840, kind: "box" }, { x: 1115, kind: "box" }, { x: 1320, kind: "barrel", ground: 150 },
      { x: 1665, kind: "box" }, { x: 1905, kind: "barrel" }, { x: 2225, kind: "box", ground: 180 },
    ],
  },
  {
    name: "Bern Last Stand",
    subtitle: "Old town streets, barricades, and Napoleon's final cannon",
    theme: "capital",
    length: 3040,
    platforms: [
      { x: 260, y: 174, w: 118, h: 12, style: "stone" }, { x: 450, y: 142, w: 142, h: 12, style: "stone" },
      { x: 690, y: 188, w: 156, h: 12, style: "metal" }, { x: 950, y: 154, w: 126, h: 12, style: "stone" },
      { x: 1180, y: 182, w: 160, h: 12, style: "metal" }, { x: 1450, y: 148, w: 150, h: 12, style: "stone" },
      { x: 1740, y: 185, w: 132, h: 12, style: "metal" }, { x: 1985, y: 150, w: 180, h: 12, style: "stone" },
      { x: 2260, y: 184, w: 144, h: 12, style: "metal" },
    ],
    spawns: [
      { x: 220, kind: "rifle" }, { x: 320, kind: "grenadier", ground: 174 }, { x: 470, kind: "runner" },
      { x: 540, kind: "rifle", ground: 142 }, { x: 710, kind: "tank" }, { x: 860, kind: "helicopter", y: 70 },
      { x: 1010, kind: "grenadier", ground: 154 }, { x: 1160, kind: "runner" }, { x: 1275, kind: "rifle", ground: 182 },
      { x: 1440, kind: "tank" }, { x: 1540, kind: "rifle", ground: 148 }, { x: 1710, kind: "helicopter", y: 56 },
      { x: 1840, kind: "grenadier" }, { x: 2025, kind: "rifle", ground: 150 }, { x: 2180, kind: "tank" },
      { x: 2320, kind: "runner", ground: 184 }, { x: 2440, kind: "grenadier" },
    ],
    destructibles: [
      { x: 180, kind: "box" }, { x: 380, kind: "barrel", ground: 174 }, { x: 640, kind: "box" },
      { x: 835, kind: "barrel", ground: 188 }, { x: 1090, kind: "box" }, { x: 1360, kind: "barrel" },
      { x: 1620, kind: "box", ground: 148 }, { x: 1885, kind: "barrel" }, { x: 2165, kind: "box", ground: 150 },
      { x: 2420, kind: "barrel" },
    ],
    boss: { kind: "napoleon", start: 2580, name: "Napoleon Bonaparte" },
  },
];

function createInputs(): Inputs {
  return { left: false, right: false, down: false, shoot: false, grenade: false, jump: false };
}

function createPlayer(x = 46): Player {
  return {
    x, y: GROUND_Y - PLAYER_HEIGHT, w: PLAYER_WIDTH, h: PLAYER_HEIGHT, vx: 0, vy: 0, facing: 1,
    onGround: true, ducking: false, hp: MAX_HP, lives: MAX_LIVES, invuln: 0, weapon: "pistol", ammo: 0,
    shootCooldown: 0, grenadeCooldown: 0, shootFlash: 0, hurtFlash: 0, anim: 0, checkpoint: x,
  };
}

function createGame(): GameState {
  const stage = STAGES[0];
  return {
    mode: "title", stageIndex: 0, stage, player: createPlayer(), bullets: [], enemyBullets: [], grenades: [], enemies: [],
    destructibles: stage.destructibles.map((spec, index) => createDestructible(spec, index + 1)), pickups: [], particles: [],
    keys: createInputs(), jumpQueued: false, grenadeQueued: false, cameraX: 0, spawnCursor: 0, time: 0, missionTime: 0,
    introTime: 0, modeTimer: 0, message: "", messageTimer: 0, score: 0, continueCount: 0, entityId: 100,
    shake: 0, bossActive: false, bossDefeated: false, bossArena: null, bossEndTimer: 0,
  };
}

function createDestructible(spec: DestructibleSpec, id: number): Destructible {
  const isBarrel = spec.kind === "barrel";
  const w = isBarrel ? 18 : 20;
  const h = isBarrel ? 24 : 18;
  const ground = spec.ground ?? GROUND_Y;
  return { id, kind: spec.kind, x: spec.x, y: ground - h, w, h, hp: isBarrel ? 32 : 24, maxHp: isBarrel ? 32 : 24, opened: false };
}

function nextId(game: GameState): number {
  game.entityId += 1;
  return game.entityId;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distance(aX: number, aY: number, bX: number, bY: number): number {
  return Math.hypot(aX - bX, aY - bY);
}

function directionFromTo(from: number, to: number): Direction {
  return to < from ? -1 : 1;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function choose<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function projectileColor(kind: string): string {
  if (kind === "pistol" || kind === "lazer" || kind === "missile" || kind === "machineGun" || kind === "uzi") return WEAPONS[kind].color;
  return "#ffe37a";
}

function bossName(kind: EnemyKind): string {
  if (kind === "baker") return "Croissant Commandant";
  if (kind === "napoleon") return "Napoleon Bonaparte";
  return "Boss";
}

function createHud(game: GameState): HudSnapshot {
  const boss = game.enemies.find((enemy) => (enemy.kind === "baker" || enemy.kind === "napoleon") && !enemy.dead);
  const weapon = WEAPONS[game.player.weapon];
  return {
    mode: game.mode, stage: game.stageIndex + 1, stageName: game.stage.name, stageSubtitle: game.stage.subtitle,
    hp: Math.max(0, Math.ceil(game.player.hp)), lives: game.player.lives, weaponLabel: weapon.label,
    ammoLabel: game.player.weapon === "pistol" ? "INF" : String(Math.max(0, game.player.ammo)), score: game.score,
    message: game.messageTimer > 0 ? game.message : "", continueCount: game.continueCount,
    bossName: boss ? bossName(boss.kind) : "", bossHp: boss ? Math.max(0, boss.hp) : 0, bossMaxHp: boss ? boss.maxHp : 1,
  };
}

function initialHud(): HudSnapshot {
  return createHud(createGame());
}

function beginIntro(game: GameState): void {
  game.mode = "intro";
  game.introTime = 0;
  game.modeTimer = 0;
  game.message = "Ze wakes up in a hurry.";
  game.messageTimer = 2;
}

function beginStage(game: GameState, stageIndex: number, fullReset: boolean): void {
  const stage = STAGES[stageIndex];
  const lives = fullReset ? MAX_LIVES : game.player.lives;
  const hp = fullReset ? MAX_HP : Math.min(MAX_HP, Math.max(game.player.hp + 25, 65));
  const score = fullReset ? 0 : game.score;
  const continues = game.continueCount;
  const weapon = fullReset ? "pistol" : game.player.weapon;
  const ammo = fullReset ? 0 : game.player.ammo;
  game.stageIndex = stageIndex;
  game.stage = stage;
  game.player = createPlayer(46);
  game.player.lives = lives;
  game.player.hp = hp;
  game.player.weapon = weapon;
  game.player.ammo = ammo;
  game.player.invuln = 1.4;
  game.score = score;
  game.continueCount = continues;
  game.bullets = [];
  game.enemyBullets = [];
  game.grenades = [];
  game.enemies = [];
  game.destructibles = stage.destructibles.map((spec) => createDestructible(spec, nextId(game)));
  game.pickups = [];
  game.particles = [];
  game.spawnCursor = 0;
  game.cameraX = 0;
  game.missionTime = 0;
  game.mode = "playing";
  game.modeTimer = 0;
  game.message = `Stage ${stageIndex + 1}: ${stage.name}`;
  game.messageTimer = 3.2;
  game.shake = 0;
  game.bossActive = false;
  game.bossDefeated = false;
  game.bossArena = null;
  game.bossEndTimer = 0;
}

function restartAfterLifeLost(game: GameState): void {
  const lives = game.player.lives;
  const score = game.score;
  const continues = game.continueCount;
  beginStage(game, game.stageIndex, false);
  game.player.lives = lives;
  game.player.hp = MAX_HP;
  game.player.weapon = "pistol";
  game.player.ammo = 0;
  game.score = score;
  game.continueCount = continues;
  game.message = "Ze gets back up. Pistol ready.";
  game.messageTimer = 2.4;
}

function continueGame(game: GameState): void {
  const score = game.score;
  game.continueCount += 1;
  beginStage(game, game.stageIndex, false);
  game.player.lives = MAX_LIVES;
  game.player.hp = MAX_HP;
  game.player.weapon = "pistol";
  game.player.ammo = 0;
  game.score = score;
  game.message = "Continue accepted. Infinite courage.";
  game.messageTimer = 2.8;
}

function completeStage(game: GameState): void {
  game.mode = "stageClear";
  game.modeTimer = 0;
  game.message = game.stageIndex === STAGES.length - 1 ? "Swizerland is saved." : "Stage clear.";
  game.messageTimer = 99;
  game.bullets = [];
  game.enemyBullets = [];
  game.grenades = [];
}

function advanceAfterClear(game: GameState): void {
  if (game.stageIndex >= STAGES.length - 1) {
    game.mode = "victory";
    game.modeTimer = 0;
    game.message = "Ze Saves Swizerland";
    game.messageTimer = 99;
    return;
  }
  beginStage(game, game.stageIndex + 1, false);
}

function resetToTitle(game: GameState): void {
  Object.assign(game, createGame());
}

function handlePrimaryAction(game: GameState): void {
  if (game.mode === "title") beginIntro(game);
  else if (game.mode === "intro") beginStage(game, 0, true);
  else if (game.mode === "stageClear") advanceAfterClear(game);
  else if (game.mode === "continue") continueGame(game);
  else if (game.mode === "victory") resetToTitle(game);
}

function keyToAction(key: string): InputAction | "start" | undefined {
  const normalized = key.toLowerCase();
  if (normalized === "arrowleft") return "left";
  if (normalized === "arrowright") return "right";
  if (normalized === "arrowdown" || normalized === "c") return "down";
  if (normalized === "d") return "shoot";
  if (normalized === "a") return "grenade";
  if (normalized === "s") return "jump";
  if (normalized === "enter" || normalized === " ") return "start";
  return undefined;
}

function updateGame(game: GameState, dt: number): void {
  game.time += dt;
  game.shake = Math.max(0, game.shake - dt);
  game.messageTimer = Math.max(0, game.messageTimer - dt);

  if (game.mode === "title") {
    updateParticles(game, dt);
    return;
  }
  if (game.mode === "intro") {
    game.introTime += dt;
    if (game.introTime > 11.6) beginStage(game, 0, true);
    return;
  }
  if (game.mode === "lifeLost") {
    game.modeTimer += dt;
    updateParticles(game, dt);
    if (game.modeTimer > 1.55) {
      if (game.player.lives > 0) restartAfterLifeLost(game);
      else {
        game.mode = "continue";
        game.modeTimer = 0;
        game.message = "Continue? Press Enter. Continues are infinite.";
        game.messageTimer = 99;
      }
    }
    return;
  }
  if (game.mode === "stageClear" || game.mode === "continue" || game.mode === "victory") {
    game.modeTimer += dt;
    updateParticles(game, dt);
    return;
  }
  updatePlaying(game, dt);
}

function updatePlaying(game: GameState, dt: number): void {
  game.missionTime += dt;
  updatePlayer(game, dt);
  spawnScheduledEnemies(game);
  maybeStartBoss(game);
  updateEnemies(game, dt);
  updateProjectiles(game, dt);
  updateGrenades(game, dt);
  updatePickups(game, dt);
  updateParticles(game, dt);
  updateCamera(game, dt);
  cleanupEntities(game);

  if (game.player.hp <= 0 && game.mode === "playing") {
    game.player.lives -= 1;
    game.mode = "lifeLost";
    game.modeTimer = 0;
    game.message = game.player.lives > 0 ? "Ze is down." : "No lives left.";
    game.messageTimer = 99;
    game.shake = 0.45;
    burstParticles(game, game.player.x + game.player.w / 2, game.player.y + game.player.h / 2, "#ff6050", 28, 78);
    return;
  }
  if (game.bossDefeated) {
    game.bossEndTimer += dt;
    if (game.bossEndTimer > 2.2) completeStage(game);
    return;
  }
  if (!game.stage.boss && game.player.x > game.stage.length - 95) completeStage(game);
}

function updatePlayer(game: GameState, dt: number): void {
  const player = game.player;
  const oldY = player.y;
  player.anim += dt;
  player.invuln = Math.max(0, player.invuln - dt);
  player.shootCooldown = Math.max(0, player.shootCooldown - dt);
  player.grenadeCooldown = Math.max(0, player.grenadeCooldown - dt);
  player.shootFlash = Math.max(0, player.shootFlash - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt);

  const shouldDuck = game.keys.down && player.onGround;
  if (player.ducking !== shouldDuck) {
    const bottom = player.y + player.h;
    player.ducking = shouldDuck;
    player.h = shouldDuck ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT;
    player.y = bottom - player.h;
  }

  const move = (game.keys.right ? 1 : 0) - (game.keys.left ? 1 : 0);
  if (move !== 0) player.facing = move > 0 ? 1 : -1;
  player.vx = player.ducking ? 0 : move * PLAYER_SPEED;

  if (game.jumpQueued && player.onGround) {
    player.vy = JUMP_VELOCITY;
    player.onGround = false;
    player.ducking = false;
    player.h = PLAYER_HEIGHT;
    dustPuff(game, player.x + player.w / 2, player.y + player.h);
  }
  game.jumpQueued = false;

  if (game.keys.shoot) shootWeapon(game);
  if (game.grenadeQueued || game.keys.grenade) throwCodfish(game);
  game.grenadeQueued = false;

  player.x += player.vx * dt;
  const bounds = getPlayerBounds(game);
  player.x = clamp(player.x, bounds.left, bounds.right);
  player.vy += GRAVITY * dt;
  player.y += player.vy * dt;
  resolvePlayerGrounding(game, oldY);
  player.checkpoint = Math.max(player.checkpoint, player.x - 80);
}

function getPlayerBounds(game: GameState): BossArena {
  if (game.bossActive && game.bossArena) return { left: game.bossArena.left + 14, right: game.bossArena.right - PLAYER_WIDTH - 14 };
  return { left: 12, right: game.stage.length - PLAYER_WIDTH - 22 };
}

function resolvePlayerGrounding(game: GameState, oldY: number): void {
  const player = game.player;
  player.onGround = false;
  for (const platform of game.stage.platforms) {
    const wasAbove = oldY + player.h <= platform.y + 3;
    const insideX = player.x + player.w > platform.x + 3 && player.x < platform.x + platform.w - 3;
    if (player.vy >= 0 && wasAbove && player.y + player.h >= platform.y && insideX) {
      player.y = platform.y - player.h;
      player.vy = 0;
      player.onGround = true;
      return;
    }
  }
  if (player.y + player.h >= GROUND_Y) {
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
  }
}

function shootWeapon(game: GameState): void {
  const player = game.player;
  if (player.shootCooldown > 0) return;
  if (player.weapon !== "pistol" && player.ammo <= 0) {
    player.weapon = "pistol";
    player.ammo = 0;
  }
  const stats = WEAPONS[player.weapon];
  player.shootCooldown = stats.cooldown;
  player.shootFlash = 0.085;
  if (player.weapon !== "pistol") player.ammo -= 1;
  const muzzleX = player.x + (player.facing === 1 ? player.w + 1 : -stats.w - 1);
  const muzzleY = player.y + (player.ducking ? 8 : 12);
  game.bullets.push({
    x: muzzleX, y: muzzleY, w: stats.w, h: stats.h, vx: player.facing * stats.speed, vy: randomBetween(-stats.spread, stats.spread),
    damage: stats.damage, owner: "player", kind: player.weapon, life: player.weapon === "missile" ? 2.6 : 1.25,
    pierce: stats.pierce, explosive: stats.explosive, gravity: 0, spin: 0,
  });
  addMuzzleParticles(game, muzzleX + (player.facing === 1 ? 5 : 0), muzzleY + 1, player.facing, stats.color);
  if (player.weapon !== "pistol" && player.ammo <= 0) {
    game.message = `${stats.label} empty. Back to pistol.`;
    game.messageTimer = 1.6;
    player.weapon = "pistol";
    player.ammo = 0;
  }
}

function throwCodfish(game: GameState): void {
  const player = game.player;
  if (player.grenadeCooldown > 0) return;
  player.grenadeCooldown = 0.74;
  const x = player.x + (player.facing === 1 ? player.w + 2 : -12);
  const y = player.y + (player.ducking ? 4 : 7);
  game.grenades.push({ x, y, w: 13, h: 7, vx: player.facing * 164, vy: -218, life: 2.05, damage: 52, radius: 40, owner: "player", kind: "codfish", spin: 0 });
  for (let i = 0; i < 6; i += 1) addParticle(game, x, y + 4, -player.facing * randomBetween(16, 45), randomBetween(-34, 20), "#ff8d2a", randomBetween(1.5, 3), 0.3, 90);
}

function spawnScheduledEnemies(game: GameState): void {
  const triggerX = game.player.x + 360;
  while (game.spawnCursor < game.stage.spawns.length && game.stage.spawns[game.spawnCursor].x < triggerX) {
    const spawn = game.stage.spawns[game.spawnCursor];
    spawnEnemy(game, spawn.kind, spawn.x, spawn);
    game.spawnCursor += 1;
  }
}

function maybeStartBoss(game: GameState): void {
  const boss = game.stage.boss;
  if (!boss || game.bossActive || game.bossDefeated || game.player.x < boss.start) return;
  const left = clamp(boss.start - 120, 0, game.stage.length - VIEW_WIDTH);
  const right = Math.min(game.stage.length - 20, left + 540);
  game.bossArena = { left, right };
  game.bossActive = true;
  game.cameraX = left;
  game.player.x = Math.max(game.player.x, left + 50);
  spawnEnemy(game, boss.kind, right - 118, { x: right - 118, kind: boss.kind });
  game.message = `${boss.name} blocks the road.`;
  game.messageTimer = 3.2;
  game.shake = 0.35;
}

function spawnEnemy(game: GameState, kind: EnemyKind, x: number, spawn: SpawnSpec): void {
  const sizes: Record<EnemyKind, { w: number; h: number; hp: number; score: number }> = {
    rifle: { w: 18, h: 28, hp: 28, score: 120 }, grenadier: { w: 18, h: 28, hp: 32, score: 150 },
    runner: { w: 17, h: 27, hp: 22, score: 100 }, helicopter: { w: 50, h: 22, hp: 94, score: 420 },
    tank: { w: 54, h: 30, hp: 170, score: 620 }, baker: { w: 42, h: 54, hp: 520, score: 2400 },
    napoleon: { w: 44, h: 58, hp: 680, score: 3200 },
  };
  const size = sizes[kind];
  const y = kind === "helicopter" ? spawn.y ?? 70 : (spawn.ground ?? GROUND_Y) - size.h;
  game.enemies.push({
    id: nextId(game), kind, x, y, w: size.w, h: size.h, vx: 0, vy: 0, hp: size.hp, maxHp: size.hp,
    dir: kind === "baker" || kind === "napoleon" ? -1 : 1, baseY: y, phase: randomBetween(0, Math.PI * 2),
    shootTimer: randomBetween(0.4, 1.5), burstShots: 0, burstTimer: 0, attackTimer: randomBetween(0.8, 1.8),
    grenadeTimer: randomBetween(1.0, 2.5), summonTimer: randomBetween(5, 8), score: size.score, dead: false,
  });
}

function updateEnemies(game: GameState, dt: number): void {
  for (const enemy of game.enemies) {
    if (enemy.dead) continue;
    if (enemy.kind !== "helicopter" && enemy.kind !== "baker" && enemy.kind !== "napoleon") enemy.dir = directionFromTo(enemy.x, game.player.x);
    if (enemy.kind === "rifle") updateRifleEnemy(game, enemy, dt);
    else if (enemy.kind === "grenadier") updateGrenadierEnemy(game, enemy, dt);
    else if (enemy.kind === "runner") updateRunnerEnemy(game, enemy, dt);
    else if (enemy.kind === "helicopter") updateHelicopterEnemy(game, enemy, dt);
    else if (enemy.kind === "tank") updateTankEnemy(game, enemy, dt);
    else if (enemy.kind === "baker") updateBakerBoss(game, enemy, dt);
    else updateNapoleonBoss(game, enemy, dt);
  }
}

function updateRifleEnemy(game: GameState, enemy: Enemy, dt: number): void {
  const gap = Math.abs(game.player.x - enemy.x);
  enemy.vx = gap > 126 ? enemy.dir * 28 : 0;
  enemy.x += enemy.vx * dt;
  enemy.shootTimer -= dt;
  enemy.burstTimer -= dt;
  if (enemy.burstShots <= 0 && enemy.shootTimer <= 0 && gap < 285) {
    enemy.burstShots = 3 + Math.floor(Math.random() * 3);
    enemy.burstTimer = 0;
  }
  if (enemy.burstShots > 0 && enemy.burstTimer <= 0) {
    fireEnemyBullet(game, enemy, "rifle");
    enemy.burstShots -= 1;
    enemy.burstTimer = 0.13;
    if (enemy.burstShots <= 0) enemy.shootTimer = randomBetween(1.0, 2.0);
  }
}

function updateGrenadierEnemy(game: GameState, enemy: Enemy, dt: number): void {
  const gap = Math.abs(game.player.x - enemy.x);
  enemy.vx = gap < 92 ? -enemy.dir * 25 : enemy.dir * 16;
  enemy.x += enemy.vx * dt;
  enemy.grenadeTimer -= dt;
  if (enemy.grenadeTimer <= 0 && gap < 330) {
    throwEnemyGrenade(game, enemy);
    enemy.grenadeTimer = randomBetween(1.8, 3.0);
  }
}

function updateRunnerEnemy(game: GameState, enemy: Enemy, dt: number): void {
  enemy.phase += dt * 8;
  enemy.vx = enemy.dir * (54 + Math.sin(enemy.phase) * 16);
  enemy.x += enemy.vx * dt;
  enemy.attackTimer -= dt;
  if (enemy.attackTimer <= 0 && rectsOverlap(enemy, game.player)) {
    damagePlayer(game, 14, enemy.x + enemy.w / 2, enemy.y + 12);
    enemy.attackTimer = 0.72;
  }
}

function updateHelicopterEnemy(game: GameState, enemy: Enemy, dt: number): void {
  enemy.phase += dt * 2.5;
  enemy.dir = directionFromTo(enemy.x, game.player.x);
  enemy.x += enemy.dir * 28 * dt;
  enemy.y = enemy.baseY + Math.sin(enemy.phase) * 13;
  enemy.shootTimer -= dt;
  if (enemy.shootTimer <= 0 && Math.abs(enemy.x - game.player.x) < 350) {
    fireEnemyBullet(game, enemy, "heli");
    fireEnemyBullet(game, enemy, "heli");
    enemy.shootTimer = randomBetween(1.1, 1.7);
  }
}

function updateTankEnemy(game: GameState, enemy: Enemy, dt: number): void {
  const gap = Math.abs(game.player.x - enemy.x);
  enemy.vx = gap > 170 ? enemy.dir * 16 : 0;
  enemy.x += enemy.vx * dt;
  enemy.shootTimer -= dt;
  if (enemy.shootTimer <= 0 && gap < 390) {
    fireEnemyBullet(game, enemy, "tankShell");
    enemy.shootTimer = randomBetween(2.0, 3.1);
    game.shake = Math.max(game.shake, 0.12);
  }
}

function updateBakerBoss(game: GameState, enemy: Enemy, dt: number): void {
  const arena = game.bossArena;
  if (!arena) return;
  enemy.phase += dt;
  enemy.dir = -1;
  enemy.x = arena.right - 120 + Math.sin(enemy.phase * 1.25) * 18;
  enemy.attackTimer -= dt;
  enemy.grenadeTimer -= dt;
  enemy.summonTimer -= dt;
  if (enemy.attackTimer <= 0) {
    throwBakeryProjectile(game, enemy, "croissant");
    if (enemy.hp < enemy.maxHp * 0.55) throwBakeryProjectile(game, enemy, "croissantHigh");
    enemy.attackTimer = enemy.hp < enemy.maxHp * 0.35 ? 0.62 : 0.9;
  }
  if (enemy.grenadeTimer <= 0) {
    throwBakeryProjectile(game, enemy, "baguette");
    enemy.grenadeTimer = enemy.hp < enemy.maxHp * 0.45 ? 1.35 : 2.05;
  }
  if (enemy.summonTimer <= 0 && enemy.hp < enemy.maxHp * 0.75) {
    spawnEnemy(game, "runner", arena.right - 62, { x: arena.right - 62, kind: "runner" });
    enemy.summonTimer = 6.5;
  }
}

function updateNapoleonBoss(game: GameState, enemy: Enemy, dt: number): void {
  const arena = game.bossArena;
  if (!arena) return;
  enemy.phase += dt;
  enemy.dir = -1;
  enemy.x = arena.right - 134 + Math.sin(enemy.phase * 1.7) * 26;
  enemy.attackTimer -= dt;
  enemy.grenadeTimer -= dt;
  enemy.summonTimer -= dt;
  if (enemy.attackTimer <= 0) {
    fireEnemyBullet(game, enemy, "cannonball");
    game.shake = Math.max(game.shake, 0.2);
    enemy.attackTimer = enemy.hp < enemy.maxHp * 0.45 ? 1.25 : 1.75;
  }
  if (enemy.grenadeTimer <= 0) {
    fireNapoleonVolley(game, enemy);
    enemy.grenadeTimer = enemy.hp < enemy.maxHp * 0.5 ? 1.7 : 2.45;
  }
  if (enemy.summonTimer <= 0) {
    const kind: EnemyKind = enemy.hp < enemy.maxHp * 0.5 ? "grenadier" : "rifle";
    spawnEnemy(game, kind, arena.right - 70, { x: arena.right - 70, kind });
    enemy.summonTimer = 7.0;
  }
}

function fireEnemyBullet(game: GameState, enemy: Enemy, kind: string): void {
  const player = game.player;
  const originX = enemy.x + (enemy.dir === 1 ? enemy.w : -6);
  const originY = enemy.y + enemy.h * 0.45;
  let projectile: Projectile;
  if (kind === "tankShell") {
    projectile = { x: originX, y: enemy.y + 10, w: 10, h: 7, vx: enemy.dir * 130, vy: 0, damage: 24, owner: "enemy", kind, life: 4, pierce: 0, explosive: 32, gravity: 0, spin: 0 };
  } else if (kind === "cannonball") {
    projectile = { x: enemy.x - 10, y: enemy.y + 28, w: 12, h: 12, vx: -158, vy: -18, damage: 30, owner: "enemy", kind, life: 4, pierce: 0, explosive: 42, gravity: 80, spin: 0 };
  } else if (kind === "heli") {
    const dx = player.x - enemy.x;
    projectile = { x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h, w: 5, h: 5, vx: clamp(dx * 0.55, -105, 105), vy: 132, damage: 12, owner: "enemy", kind, life: 2.2, pierce: 0, explosive: 0, gravity: 0, spin: 0 };
  } else {
    projectile = { x: originX, y: originY, w: 5, h: 2, vx: enemy.dir * 205, vy: randomBetween(-16, 16), damage: 9, owner: "enemy", kind: "rifle", life: 2.2, pierce: 0, explosive: 0, gravity: 0, spin: 0 };
  }
  game.enemyBullets.push(projectile);
  addMuzzleParticles(game, projectile.x, projectile.y, enemy.dir, kind === "cannonball" ? "#ff7d2a" : "#ffdd73");
}

function fireNapoleonVolley(game: GameState, enemy: Enemy): void {
  for (let i = 0; i < 3; i += 1) {
    game.enemyBullets.push({ x: enemy.x - 8, y: enemy.y + 14 + i * 8, w: 7, h: 3, vx: -185, vy: -28 + i * 24, damage: 11, owner: "enemy", kind: "volley", life: 2.4, pierce: 0, explosive: 0, gravity: 0, spin: 0 });
  }
}

function throwEnemyGrenade(game: GameState, enemy: Enemy): void {
  const dir = directionFromTo(enemy.x, game.player.x);
  game.grenades.push({ x: enemy.x + (dir === 1 ? enemy.w : -8), y: enemy.y + 7, w: 8, h: 8, vx: dir * randomBetween(88, 124), vy: -randomBetween(185, 238), life: 2.0, damage: 22, radius: 32, owner: "enemy", kind: "grenade", spin: 0 });
}

function throwBakeryProjectile(game: GameState, enemy: Enemy, kind: "croissant" | "croissantHigh" | "baguette"): void {
  if (kind === "baguette") {
    game.enemyBullets.push({ x: enemy.x - 8, y: enemy.y + 26, w: 20, h: 5, vx: -178, vy: randomBetween(-12, 12), damage: 16, owner: "enemy", kind: "baguette", life: 3, pierce: 0, explosive: 0, gravity: 0, spin: 0 });
    return;
  }
  game.enemyBullets.push({ x: enemy.x - 4, y: enemy.y + 20, w: 10, h: 8, vx: -randomBetween(120, 150), vy: kind === "croissantHigh" ? -170 : -116, damage: 13, owner: "enemy", kind: "croissant", life: 3, pierce: 0, explosive: 0, gravity: 250, spin: 0 });
}

function updateProjectiles(game: GameState, dt: number): void {
  updatePlayerBullets(game, dt);
  updateEnemyBullets(game, dt);
}

function updatePlayerBullets(game: GameState, dt: number): void {
  const alive: Projectile[] = [];
  for (const bullet of game.bullets) {
    bullet.life -= dt;
    bullet.vy += bullet.gravity * dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.spin += dt * 10;
    let keep = bullet.life > 0 && bullet.x > game.cameraX - 80 && bullet.x < game.cameraX + VIEW_WIDTH + 180;
    if (!keep) continue;
    for (const destructible of game.destructibles) {
      if (!keep || destructible.opened) continue;
      if (rectsOverlap(bullet, destructible)) {
        damageDestructible(game, destructible, bullet.damage, bullet.x, bullet.y);
        if (bullet.explosive > 0) explode(game, bullet.x, bullet.y, bullet.explosive, bullet.damage, "player");
        keep = consumeProjectilePierce(bullet);
      }
    }
    for (const enemy of game.enemies) {
      if (!keep || enemy.dead) continue;
      if (rectsOverlap(bullet, enemy)) {
        damageEnemy(game, enemy, bullet.damage, bullet.x, bullet.y, bullet.kind);
        if (bullet.explosive > 0) explode(game, bullet.x, bullet.y, bullet.explosive, bullet.damage, "player");
        keep = consumeProjectilePierce(bullet);
      }
    }
    if (keep) alive.push(bullet);
  }
  game.bullets = alive;
}

function consumeProjectilePierce(bullet: Projectile): boolean {
  if (bullet.pierce > 0) {
    bullet.pierce -= 1;
    return true;
  }
  return false;
}

function updateEnemyBullets(game: GameState, dt: number): void {
  const alive: Projectile[] = [];
  for (const bullet of game.enemyBullets) {
    bullet.life -= dt;
    bullet.vy += bullet.gravity * dt;
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.spin += dt * 8;
    let keep = bullet.life > 0 && bullet.x > game.cameraX - 120 && bullet.x < game.cameraX + VIEW_WIDTH + 160;
    if (bullet.y + bullet.h >= GROUND_Y && bullet.explosive > 0) {
      explode(game, bullet.x, GROUND_Y, bullet.explosive, bullet.damage, "enemy");
      keep = false;
    }
    if (keep && game.player.invuln <= 0 && rectsOverlap(bullet, game.player)) {
      if (bullet.explosive > 0) explode(game, bullet.x, bullet.y, bullet.explosive, bullet.damage, "enemy");
      else damagePlayer(game, bullet.damage, bullet.x, bullet.y);
      keep = false;
    }
    if (keep) alive.push(bullet);
  }
  game.enemyBullets = alive;
}

function updateGrenades(game: GameState, dt: number): void {
  const alive: Grenade[] = [];
  for (const grenade of game.grenades) {
    grenade.life -= dt;
    grenade.vy += GRAVITY * 0.72 * dt;
    grenade.x += grenade.vx * dt;
    grenade.y += grenade.vy * dt;
    grenade.spin += dt * 12;
    if (grenade.kind === "codfish") addParticle(game, grenade.x + grenade.w / 2, grenade.y + grenade.h / 2, randomBetween(-18, 18), randomBetween(-36, 12), "#ff8a2b", randomBetween(1.5, 3), 0.24, 80);
    let shouldExplode = grenade.life <= 0 || grenade.y + grenade.h >= GROUND_Y;
    if (!shouldExplode && grenade.owner === "player") {
      for (const enemy of game.enemies) {
        if (!enemy.dead && rectsOverlap(grenade, enemy)) {
          shouldExplode = true;
          break;
        }
      }
    }
    if (!shouldExplode && grenade.owner === "enemy" && game.player.invuln <= 0 && rectsOverlap(grenade, game.player)) shouldExplode = true;
    if (shouldExplode) explode(game, grenade.x + grenade.w / 2, grenade.y + grenade.h / 2, grenade.radius, grenade.damage, grenade.owner);
    else if (grenade.x > game.cameraX - 100 && grenade.x < game.cameraX + VIEW_WIDTH + 160) alive.push(grenade);
  }
  game.grenades = alive;
}

function explode(game: GameState, x: number, y: number, radius: number, damage: number, owner: "player" | "enemy"): void {
  game.shake = Math.max(game.shake, owner === "player" ? 0.2 : 0.3);
  burstParticles(game, x, y, owner === "player" ? "#ffb33b" : "#ff5d46", 24, radius * 2.2);
  if (owner === "player") {
    for (const enemy of game.enemies) {
      if (enemy.dead) continue;
      const d = distance(x, y, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2);
      if (d < radius) damageEnemy(game, enemy, damage * (1 - d / radius) + damage * 0.35, x, y, "explosion");
    }
    for (const destructible of game.destructibles) {
      if (destructible.opened) continue;
      if (distance(x, y, destructible.x + destructible.w / 2, destructible.y + destructible.h / 2) < radius) damageDestructible(game, destructible, damage, x, y);
    }
  } else {
    const player = game.player;
    const d = distance(x, y, player.x + player.w / 2, player.y + player.h / 2);
    if (d < radius && player.invuln <= 0) damagePlayer(game, damage * (1 - d / radius) + 8, x, y);
  }
}

function damageEnemy(game: GameState, enemy: Enemy, amount: number, x: number, y: number, source: string): void {
  if (enemy.dead) return;
  enemy.hp -= amount;
  burstParticles(game, x, y, source === "lazer" ? "#70f9ff" : "#ffe07a", source === "lazer" ? 8 : 5, 32);
  if (enemy.hp > 0) return;
  enemy.dead = true;
  enemy.hp = 0;
  game.score += enemy.score;
  burstParticles(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, "#f15b42", enemy.kind === "tank" || enemy.kind === "helicopter" ? 36 : 18, 88);
  if (enemy.kind === "tank" || enemy.kind === "helicopter") maybeDropFood(game, enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, 0.45);
  else if (enemy.kind === "baker" || enemy.kind === "napoleon") {
    game.bossDefeated = true;
    game.bossActive = false;
    game.message = enemy.kind === "baker" ? "The bakery line is broken." : "Napoleon retreats in defeat.";
    game.messageTimer = 3.5;
    game.score += 1000;
  } else maybeDropFood(game, enemy.x + enemy.w / 2, enemy.y, 0.12);
}

function damageDestructible(game: GameState, destructible: Destructible, amount: number, x: number, y: number): void {
  if (destructible.opened) return;
  destructible.hp -= amount;
  burstParticles(game, x, y, destructible.kind === "barrel" ? "#ff9b33" : "#c89b66", 5, 28);
  if (destructible.hp > 0) return;
  destructible.opened = true;
  game.score += 40;
  if (destructible.kind === "barrel") explode(game, destructible.x + destructible.w / 2, destructible.y + destructible.h / 2, 34, 28, "player");
  dropFromDestructible(game, destructible);
}

function dropFromDestructible(game: GameState, destructible: Destructible): void {
  const roll = Math.random();
  if (roll < 0.48) spawnPickup(game, destructible.x + destructible.w / 2, destructible.y - 8, "weapon", choose(UPGRADE_WEAPONS));
  else if (roll < 0.9) spawnPickup(game, destructible.x + destructible.w / 2, destructible.y - 8, "food");
  else {
    spawnPickup(game, destructible.x + destructible.w / 2 - 8, destructible.y - 8, "food");
    spawnPickup(game, destructible.x + destructible.w / 2 + 8, destructible.y - 8, "weapon", choose(UPGRADE_WEAPONS));
  }
}

function maybeDropFood(game: GameState, x: number, y: number, chance: number): void {
  if (Math.random() < chance) spawnPickup(game, x, y, "food");
}

function spawnPickup(game: GameState, x: number, y: number, kind: "weapon" | "food", weapon?: WeaponName): void {
  const chosenWeapon = weapon ?? choose(UPGRADE_WEAPONS);
  const foodLabels = ["Chocolate", "Fondue", "Rosti", "Cheese"];
  game.pickups.push({
    id: nextId(game), kind, weapon: kind === "weapon" ? chosenWeapon : undefined, heal: kind === "food" ? 28 + Math.floor(Math.random() * 18) : undefined,
    label: kind === "weapon" ? WEAPONS[chosenWeapon].label : choose(foodLabels), x: x - 8, y, w: kind === "weapon" ? 18 : 14,
    h: kind === "weapon" ? 12 : 12, vy: -150, bob: randomBetween(0, 6),
  });
}

function updatePickups(game: GameState, dt: number): void {
  const alive: Pickup[] = [];
  for (const pickup of game.pickups) {
    pickup.bob += dt * 5;
    pickup.vy += GRAVITY * 0.62 * dt;
    pickup.y += pickup.vy * dt;
    const floor = getFloorForRect(game, pickup);
    if (pickup.y + pickup.h > floor) {
      pickup.y = floor - pickup.h;
      pickup.vy = 0;
    }
    if (rectsOverlap(pickup, game.player)) collectPickup(game, pickup);
    else alive.push(pickup);
  }
  game.pickups = alive;
}

function getFloorForRect(game: GameState, rect: Rect): number {
  let floor = GROUND_Y;
  for (const platform of game.stage.platforms) {
    const overX = rect.x + rect.w > platform.x + 2 && rect.x < platform.x + platform.w - 2;
    if (overX && rect.y + rect.h <= platform.y + 16 && platform.y < floor) floor = platform.y;
  }
  return floor;
}

function collectPickup(game: GameState, pickup: Pickup): void {
  if (pickup.kind === "weapon" && pickup.weapon) {
    game.player.weapon = pickup.weapon;
    game.player.ammo = WEAPONS[pickup.weapon].ammo;
    game.message = `${WEAPONS[pickup.weapon].label} acquired.`;
    game.messageTimer = 2;
    game.score += 80;
  } else {
    const heal = pickup.heal ?? 30;
    game.player.hp = Math.min(MAX_HP, game.player.hp + heal);
    game.message = `${pickup.label} restores HP.`;
    game.messageTimer = 1.8;
    game.score += 55;
  }
  burstParticles(game, pickup.x + pickup.w / 2, pickup.y + pickup.h / 2, pickup.kind === "weapon" ? "#68f7ff" : "#7dff72", 12, 42);
}

function damagePlayer(game: GameState, amount: number, x: number, y: number): void {
  const player = game.player;
  if (player.invuln > 0 || game.mode !== "playing") return;
  player.hp = Math.max(0, player.hp - amount);
  player.invuln = 0.78;
  player.hurtFlash = 0.3;
  game.shake = Math.max(game.shake, 0.18);
  burstParticles(game, x, y, "#ff5149", 11, 52);
}

function updateCamera(game: GameState, dt: number): void {
  let target = game.player.x - VIEW_WIDTH * 0.38;
  if (game.bossActive && game.bossArena) target = clamp(game.player.x - 150, game.bossArena.left, Math.max(game.bossArena.left, game.bossArena.right - VIEW_WIDTH));
  target = clamp(target, 0, Math.max(0, game.stage.length - VIEW_WIDTH));
  game.cameraX += (target - game.cameraX) * Math.min(1, dt * 7);
}

function cleanupEntities(game: GameState): void {
  game.enemies = game.enemies.filter((enemy) => !enemy.dead);
  game.destructibles = game.destructibles.filter((destructible) => !destructible.opened);
  game.particles = game.particles.filter((particle) => particle.life > 0);
}

function updateParticles(game: GameState, dt: number): void {
  for (const particle of game.particles) {
    particle.life -= dt;
    particle.vy += particle.gravity * dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
  }
}

function addParticle(game: GameState, x: number, y: number, vx: number, vy: number, color: string, size: number, life: number, gravity: number): void {
  game.particles.push({ x, y, vx, vy, color, size, life, maxLife: life, gravity });
}

function burstParticles(game: GameState, x: number, y: number, color: string, count: number, force: number): void {
  for (let i = 0; i < count; i += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(force * 0.2, force);
    addParticle(game, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, randomBetween(1.5, 4), randomBetween(0.25, 0.8), 130);
  }
}

function addMuzzleParticles(game: GameState, x: number, y: number, dir: Direction, color: string): void {
  for (let i = 0; i < 4; i += 1) addParticle(game, x, y, dir * randomBetween(28, 80), randomBetween(-18, 18), color, randomBetween(1.5, 3.5), 0.16, 0);
}

function dustPuff(game: GameState, x: number, y: number): void {
  for (let i = 0; i < 7; i += 1) addParticle(game, x, y, randomBetween(-34, 34), randomBetween(-32, -5), "#d7c8a6", randomBetween(1, 3), 0.34, 160);
}

function drawScene(ctx: CanvasRenderingContext2D, game: GameState): void {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  if (game.mode === "title") {
    drawTitle(ctx, game);
    return;
  }
  if (game.mode === "intro") {
    drawIntro(ctx, game);
    return;
  }
  const shakeX = game.shake > 0 ? randomBetween(-2.5, 2.5) : 0;
  const shakeY = game.shake > 0 ? randomBetween(-1.8, 1.8) : 0;
  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));
  drawBackground(ctx, game.stage, game.cameraX, game.time);
  drawPlatforms(ctx, game.stage, game.cameraX);
  drawDestructibles(ctx, game.destructibles, game.cameraX);
  drawPickups(ctx, game.pickups, game.cameraX, game.time);
  drawGrenades(ctx, game.grenades, game.cameraX);
  drawProjectiles(ctx, game.bullets, game.enemyBullets, game.cameraX);
  drawEnemies(ctx, game.enemies, game.cameraX, game.time);
  drawPlayer(ctx, game.player, game.cameraX, game.time);
  drawParticles(ctx, game.particles, game.cameraX);
  drawForeground(ctx, game.stage, game.cameraX, game.time);
  ctx.restore();
  drawCanvasMessage(ctx, game);
}

function pixelRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = "left"): void {
  ctx.font = `700 ${size}px Courier New, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#111827";
  ctx.fillText(text, x + 1, y + 1);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

function drawTitle(ctx: CanvasRenderingContext2D, game: GameState): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#91c9e8");
  drawAlpineLayers(ctx, game.time * 10, 0.15);
  pixelRect(ctx, 0, 188, VIEW_WIDTH, 82, "#2d563f");
  drawSwissFlag(ctx, 70, 153, 18, false);
  drawFrenchFlag(ctx, 390, 151, 20, false);
  for (let x = 18; x < VIEW_WIDTH; x += 58) drawChalet(ctx, x, 164, x % 3 === 0);
  drawZeSprite(ctx, 221, 160, 1, false, 0, false, game.time);
  drawCat(ctx, 196, 205, game.time);
  drawText(ctx, "ZE SAVES", VIEW_WIDTH / 2, 42, 26, "#fff7d6", "center");
  drawText(ctx, "SWIZERLAND", VIEW_WIDTH / 2, 73, 31, "#f4483e", "center");
  drawText(ctx, "Local browser pixel shooter", VIEW_WIDTH / 2, 116, 10, "#f7fbff", "center");
  if (Math.floor(game.time * 2.4) % 2 === 0) drawText(ctx, "Press Enter or Start to wake Ze", VIEW_WIDTH / 2, 236, 10, "#fff4a8", "center");
}

function drawIntro(ctx: CanvasRenderingContext2D, game: GameState): void {
  const t = game.introTime;
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#1d2638");
  if (t < 3) {
    drawBedroom(ctx, t);
    drawIntroCaption(ctx, "6:05. Ze gets out of bed.", "Batman the cat is already awake.");
  } else if (t < 6.1) {
    drawWindowScene(ctx, t - 3);
    drawIntroCaption(ctx, "At the window, Ze sees tricolor flags.", "The French are invading Switzerland.");
  } else if (t < 9.1) {
    drawTableScene(ctx, t - 6.1);
    drawIntroCaption(ctx, "No time for coffee.", "Ze grabs his pistol and keys.");
  } else {
    drawDoorScene(ctx, t - 9.1);
    drawIntroCaption(ctx, "Batman guards the apartment.", "The game starts after this.");
  }
  drawText(ctx, "Press Enter to skip", VIEW_WIDTH - 14, 246, 9, "#e6edf7", "right");
}

function drawBedroom(ctx: CanvasRenderingContext2D, t: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, 162, "#26344e");
  pixelRect(ctx, 0, 162, VIEW_WIDTH, 108, "#4b342a");
  pixelRect(ctx, 38, 92, 156, 58, "#693b37");
  pixelRect(ctx, 48, 78, 54, 24, "#f0d4b3");
  pixelRect(ctx, 86, 105, 98, 38, "#b5212f");
  pixelRect(ctx, 96, 111, 20, 20, "#ffffff");
  pixelRect(ctx, 104, 111, 4, 20, "#b5212f");
  pixelRect(ctx, 96, 119, 20, 4, "#b5212f");
  drawZeSprite(ctx, 105 + Math.min(44, t * 22), t < 1.3 ? 105 : 124, 1, false, 0, false, t);
  drawCat(ctx, 210 + Math.sin(t * 5) * 4, 137, t);
  drawWindow(ctx, 315, 50, false);
  drawKeys(ctx, 286, 138, t);
  drawPistolIcon(ctx, 314, 142, 1);
}

function drawWindowScene(ctx: CanvasRenderingContext2D, t: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#334762");
  drawWindow(ctx, 118, 30, true);
  drawFrenchSoldiersTiny(ctx, 139, 96, t);
  drawFrenchFlag(ctx, 248, 73, 22, false);
  drawSwissFlag(ctx, 190, 82, 18, true);
  drawZeSprite(ctx, 310, 145, -1, false, 0, false, t);
  drawCat(ctx, 345, 199, t);
  pixelRect(ctx, 84, 144, 210, 8, "#141a29");
}

function drawTableScene(ctx: CanvasRenderingContext2D, t: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, 166, "#2a3850");
  pixelRect(ctx, 0, 166, VIEW_WIDTH, 104, "#51362a");
  pixelRect(ctx, 180, 140, 132, 12, "#8a583a");
  pixelRect(ctx, 190, 152, 8, 44, "#5a3526");
  pixelRect(ctx, 294, 152, 8, 44, "#5a3526");
  drawPistolIcon(ctx, 220, 132, t > 1.5 ? 0.2 : 1);
  drawKeys(ctx, 264, 133, t);
  drawZeSprite(ctx, 112 + t * 34, 132, 1, false, t > 1.4 ? 0.1 : 0, false, t);
  drawCat(ctx, 88, 201, t);
  drawWindow(ctx, 340, 54, false);
}

function drawDoorScene(ctx: CanvasRenderingContext2D, t: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#1c283c");
  pixelRect(ctx, 320, 48, 70, 150, "#5b392b");
  pixelRect(ctx, 326, 54, 58, 138, "#2a1c18");
  pixelRect(ctx, 372, 122, 5, 5, "#f0c35a");
  drawZeSprite(ctx, 222 + Math.sin(t * 5) * 2, 151, 1, false, 0.15, false, t);
  drawCat(ctx, 190, 205, t);
  drawSwissFlag(ctx, 74, 60, 36, false);
  drawText(ctx, "ZE", 235, 132, 13, "#fff7d6", "center");
}

function drawIntroCaption(ctx: CanvasRenderingContext2D, line1: string, line2: string): void {
  pixelRect(ctx, 24, 214, VIEW_WIDTH - 48, 40, "rgba(8, 13, 24, 0.86)");
  drawText(ctx, line1, VIEW_WIDTH / 2, 221, 11, "#fff7d6", "center");
  drawText(ctx, line2, VIEW_WIDTH / 2, 237, 9, "#d7e5ff", "center");
}

function drawBackground(ctx: CanvasRenderingContext2D, stage: StageData, cameraX: number, time: number): void {
  if (stage.theme === "alps") drawAlpsBackground(ctx, cameraX, time);
  else if (stage.theme === "city") drawCityBackground(ctx, cameraX, time);
  else if (stage.theme === "mountain") drawMountainBackground(ctx, cameraX, time);
  else drawCapitalBackground(ctx, cameraX, time);
}

function drawAlpsBackground(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#8fc8e4");
  pixelRect(ctx, 0, 0, VIEW_WIDTH, 70, "#bce5ff");
  drawAlpineLayers(ctx, cameraX, 0.2);
  drawClouds(ctx, cameraX, time, "#eef8ff");
  drawParallaxHouses(ctx, cameraX, "alps");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y, "#355b3a");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, 5, "#6daa4d");
}

function drawCityBackground(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#7fb0c9");
  drawClouds(ctx, cameraX, time, "#ddecf5");
  pixelRect(ctx, 0, 150, VIEW_WIDTH, 42, "#4d91a3");
  for (let x = -((cameraX * 0.3) % 98) - 20; x < VIEW_WIDTH + 120; x += 98) {
    pixelRect(ctx, x, 92, 76, 82, "#67554b");
    pixelRect(ctx, x + 7, 81, 62, 13, "#7e6a5b");
    for (let i = 0; i < 4; i += 1) {
      pixelRect(ctx, x + 12 + i * 14, 106, 7, 10, "#f1d79b");
      pixelRect(ctx, x + 12 + i * 14, 130, 7, 10, "#d8e8ef");
    }
    drawFrenchFlag(ctx, x + 50, 83, 14, false);
  }
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y, "#3d3c45");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, 4, "#77737a");
}

function drawMountainBackground(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#8aaec6");
  drawClouds(ctx, cameraX, time, "#edf6fb");
  for (let x = -((cameraX * 0.12) % 180) - 80; x < VIEW_WIDTH + 220; x += 180) {
    drawTriangle(ctx, x, 182, x + 92, 34, x + 205, 182, "#6c7781");
    drawTriangle(ctx, x + 45, 98, x + 92, 34, x + 136, 98, "#eef5f8");
  }
  for (let x = -((cameraX * 0.45) % 170) - 60; x < VIEW_WIDTH + 200; x += 170) {
    pixelRect(ctx, x, 154, 130, 48, "#4b535b");
    pixelRect(ctx, x + 12, 139, 80, 16, "#5e6670");
    drawSwissFlag(ctx, x + 92, 131, 12, false);
  }
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y, "#4c5660");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, 5, "#dbe9ef");
}

function drawCapitalBackground(ctx: CanvasRenderingContext2D, cameraX: number, time: number): void {
  pixelRect(ctx, 0, 0, VIEW_WIDTH, VIEW_HEIGHT, "#7d96ac");
  drawClouds(ctx, cameraX, time, "#c7d9e6");
  for (let x = -((cameraX * 0.22) % 130) - 50; x < VIEW_WIDTH + 170; x += 130) {
    pixelRect(ctx, x, 102, 90, 84, "#5c4b45");
    drawTriangle(ctx, x - 6, 102, x + 45, 66, x + 96, 102, "#7b322b");
    for (let i = 0; i < 4; i += 1) pixelRect(ctx, x + 12 + i * 16, 121, 8, 12, "#f0d69b");
    drawFrenchFlag(ctx, x + 70, 78, 14, false);
  }
  const towerX = 265 - ((cameraX * 0.18) % 520);
  pixelRect(ctx, towerX, 68, 34, 118, "#59483e");
  pixelRect(ctx, towerX - 6, 58, 46, 12, "#7b322b");
  pixelRect(ctx, towerX + 10, 86, 13, 13, "#f6d687");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, VIEW_HEIGHT - GROUND_Y, "#413b3e");
  pixelRect(ctx, 0, GROUND_Y, VIEW_WIDTH, 5, "#8c7c72");
}

function drawAlpineLayers(ctx: CanvasRenderingContext2D, cameraX: number, factor: number): void {
  for (let x = -((cameraX * factor) % 220) - 80; x < VIEW_WIDTH + 240; x += 220) {
    drawTriangle(ctx, x, 176, x + 80, 48, x + 184, 176, "#687e8c");
    drawTriangle(ctx, x + 31, 98, x + 80, 48, x + 126, 98, "#f2f8fb");
    drawTriangle(ctx, x + 92, 178, x + 176, 70, x + 270, 178, "#536e7f");
    drawTriangle(ctx, x + 140, 111, x + 176, 70, x + 216, 111, "#e9f4f8");
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, cameraX: number, time: number, color: string): void {
  for (let i = 0; i < 4; i += 1) {
    const x = ((i * 160 - (cameraX * 0.08 + time * 5)) % 620) - 70;
    const y = 22 + i * 11;
    pixelRect(ctx, x, y, 36, 8, color);
    pixelRect(ctx, x + 10, y - 6, 32, 8, color);
    pixelRect(ctx, x + 34, y + 2, 24, 7, color);
  }
}

function drawParallaxHouses(ctx: CanvasRenderingContext2D, cameraX: number, theme: StageTheme): void {
  for (let x = -((cameraX * 0.48) % 120) - 40; x < VIEW_WIDTH + 140; x += 120) {
    if (theme === "alps") drawChalet(ctx, x, 170, Math.floor(x) % 2 === 0);
  }
}

function drawPlatforms(ctx: CanvasRenderingContext2D, stage: StageData, cameraX: number): void {
  for (const platform of stage.platforms) {
    const x = platform.x - cameraX;
    if (x + platform.w < -20 || x > VIEW_WIDTH + 20) continue;
    const topColor = platform.style === "metal" ? "#90a5ae" : platform.style === "stone" ? "#879093" : "#9a6840";
    const sideColor = platform.style === "metal" ? "#536870" : platform.style === "stone" ? "#555d62" : "#5f3a29";
    pixelRect(ctx, x, platform.y, platform.w, platform.h, sideColor);
    pixelRect(ctx, x, platform.y, platform.w, 4, topColor);
    for (let brace = 10; brace < platform.w; brace += 28) pixelRect(ctx, x + brace, platform.y + 4, 4, platform.h + 10, sideColor);
  }
}

function drawDestructibles(ctx: CanvasRenderingContext2D, destructibles: Destructible[], cameraX: number): void {
  for (const item of destructibles) {
    const x = item.x - cameraX;
    if (x + item.w < -20 || x > VIEW_WIDTH + 20) continue;
    if (item.kind === "barrel") {
      pixelRect(ctx, x + 2, item.y, item.w - 4, item.h, "#813129");
      pixelRect(ctx, x, item.y + 4, item.w, item.h - 8, "#b84730");
      pixelRect(ctx, x + 2, item.y + 6, item.w - 4, 3, "#f0c15b");
      pixelRect(ctx, x + 2, item.y + item.h - 9, item.w - 4, 3, "#f0c15b");
    } else {
      pixelRect(ctx, x, item.y, item.w, item.h, "#9d6b3e");
      pixelRect(ctx, x + 2, item.y + 2, item.w - 4, item.h - 4, "#c28a4f");
      pixelRect(ctx, x + 2, item.y + 8, item.w - 4, 3, "#6d452b");
      pixelRect(ctx, x + 8, item.y + 2, 3, item.h - 4, "#6d452b");
    }
  }
}

function drawPickups(ctx: CanvasRenderingContext2D, pickups: Pickup[], cameraX: number, time: number): void {
  for (const pickup of pickups) {
    const x = pickup.x - cameraX;
    const y = pickup.y + Math.sin(pickup.bob + time * 4) * 2;
    if (x + pickup.w < -20 || x > VIEW_WIDTH + 20) continue;
    if (pickup.kind === "weapon") {
      const color = pickup.weapon === "lazer" ? "#65f5ff" : pickup.weapon === "missile" ? "#ff8d4b" : "#ffd95e";
      pixelRect(ctx, x, y, pickup.w, pickup.h, "#182536");
      pixelRect(ctx, x + 2, y + 2, pickup.w - 4, pickup.h - 4, color);
      drawText(ctx, pickup.weapon === "missile" ? "M" : pickup.weapon === "lazer" ? "L" : pickup.weapon === "uzi" ? "U" : "G", x + pickup.w / 2, y + 1, 8, "#111827", "center");
    } else {
      pixelRect(ctx, x + 2, y + 2, pickup.w - 4, pickup.h - 2, "#f2d06b");
      pixelRect(ctx, x, y + 5, pickup.w, 4, "#fff2a8");
      pixelRect(ctx, x + 4, y, 6, 4, "#8bd45a");
    }
  }
}

function drawProjectiles(ctx: CanvasRenderingContext2D, bullets: Projectile[], enemyBullets: Projectile[], cameraX: number): void {
  for (const bullet of bullets) {
    const x = bullet.x - cameraX;
    const color = projectileColor(bullet.kind);
    if (bullet.kind === "missile") {
      pixelRect(ctx, x, bullet.y, bullet.w, bullet.h, "#d7d5c8");
      pixelRect(ctx, x - Math.sign(bullet.vx) * 4, bullet.y + 1, 4, 2, "#ff6f30");
    } else if (bullet.kind === "lazer") {
      pixelRect(ctx, x, bullet.y - 1, bullet.w, bullet.h + 2, "#164a5c");
      pixelRect(ctx, x, bullet.y, bullet.w, bullet.h, color);
    } else pixelRect(ctx, x, bullet.y, bullet.w, bullet.h, color);
  }
  for (const bullet of enemyBullets) {
    const x = bullet.x - cameraX;
    if (bullet.kind === "croissant") drawCroissant(ctx, x, bullet.y, bullet.spin);
    else if (bullet.kind === "baguette") drawBaguette(ctx, x, bullet.y);
    else if (bullet.kind === "tankShell" || bullet.kind === "cannonball") {
      pixelRect(ctx, x, bullet.y, bullet.w, bullet.h, "#1b1d22");
      pixelRect(ctx, x + 2, bullet.y + 2, bullet.w - 4, bullet.h - 4, "#5b6470");
    } else pixelRect(ctx, x, bullet.y, bullet.w, bullet.h, "#ff5f3d");
  }
}

function drawGrenades(ctx: CanvasRenderingContext2D, grenades: Grenade[], cameraX: number): void {
  for (const grenade of grenades) {
    const x = grenade.x - cameraX;
    if (grenade.kind === "codfish") drawCodfish(ctx, x, grenade.y, grenade.spin);
    else {
      pixelRect(ctx, x, grenade.y, 8, 8, "#596747");
      pixelRect(ctx, x + 2, grenade.y + 2, 4, 4, "#a2b36b");
    }
  }
}

function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[], cameraX: number, time: number): void {
  for (const enemy of enemies) {
    const x = enemy.x - cameraX;
    if (x + enemy.w < -80 || x > VIEW_WIDTH + 80) continue;
    if (enemy.kind === "rifle") drawSoldier(ctx, enemy, x, time, "rifle");
    else if (enemy.kind === "grenadier") drawSoldier(ctx, enemy, x, time, "grenadier");
    else if (enemy.kind === "runner") drawSoldier(ctx, enemy, x, time, "runner");
    else if (enemy.kind === "helicopter") drawHelicopter(ctx, enemy, x, time);
    else if (enemy.kind === "tank") drawTank(ctx, enemy, x, time);
    else if (enemy.kind === "baker") drawBaker(ctx, enemy, x, time);
    else drawNapoleon(ctx, enemy, x, time);
    drawEnemyHp(ctx, enemy, x);
  }
}

function drawSoldier(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, time: number, variant: "rifle" | "grenadier" | "runner"): void {
  const walk = Math.sin(time * 12 + enemy.phase) * (Math.abs(enemy.vx) > 2 ? 2 : 0);
  const y = enemy.y;
  pixelRect(ctx, x + 5, y + 23, 4, 5, "#22242b");
  pixelRect(ctx, x + 11, y + 23, 4, 5, "#22242b");
  pixelRect(ctx, x + 5, y + 14, 4, 10 + walk, "#cc2e35");
  pixelRect(ctx, x + 11, y + 14, 4, 10 - walk, "#cc2e35");
  pixelRect(ctx, x + 4, y + 8, 12, 10, variant === "grenadier" ? "#344b79" : "#293f70");
  pixelRect(ctx, x + 6, y + 2, 9, 7, "#f2c09a");
  pixelRect(ctx, x + 5, y, 11, 4, "#1c2d58");
  pixelRect(ctx, x + 6, y + 3, 2, 2, "#2b1a16");
  if (variant === "grenadier") pixelRect(ctx, x + (enemy.dir === 1 ? 1 : 14), y + 9, 4, 8, "#4d5e49");
  if (variant === "runner") {
    pixelRect(ctx, x + (enemy.dir === 1 ? 15 : -5), y + 11, 9, 2, "#d6d7d0");
    pixelRect(ctx, x + (enemy.dir === 1 ? 23 : -7), y + 10, 3, 4, "#f7f7f0");
  } else pixelRect(ctx, x + (enemy.dir === 1 ? 15 : -8), y + 12, 11, 3, "#2b2d34");
}

function drawHelicopter(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, time: number): void {
  const y = enemy.y;
  pixelRect(ctx, x + 6, y + 8, 34, 12, "#31415f");
  pixelRect(ctx, x + 17, y + 3, 17, 8, "#80d7f1");
  pixelRect(ctx, x + 39, y + 12, 12, 4, "#273247");
  pixelRect(ctx, x + 46, y + 8, 4, 12, "#273247");
  pixelRect(ctx, x + 10, y + 18, 30, 3, "#202838");
  const rotor = Math.floor(time * 16) % 2 === 0;
  pixelRect(ctx, x + (rotor ? 4 : 14), y, rotor ? 46 : 28, 2, "#dce5e9");
  drawFrenchFlag(ctx, x + 9, y + 10, 7, false);
}

function drawTank(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, time: number): void {
  const y = enemy.y;
  pixelRect(ctx, x + 4, y + 8, 36, 12, "#364a45");
  pixelRect(ctx, x + 13, y + 1, 20, 10, "#415b52");
  pixelRect(ctx, x + (enemy.dir === 1 ? 32 : -8), y + 5, 20, 4, "#26342f");
  pixelRect(ctx, x, y + 18, 52, 10, "#1e2628");
  for (let i = 0; i < 5; i += 1) pixelRect(ctx, x + 5 + i * 9, y + 20 + Math.sin(time * 8 + i) * 1, 5, 5, "#778078");
  drawFrenchFlag(ctx, x + 7, y + 9, 8, false);
}

function drawBaker(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, time: number): void {
  const y = enemy.y;
  pixelRect(ctx, x + 8, y + 48, 8, 6, "#33241f");
  pixelRect(ctx, x + 26, y + 48, 8, 6, "#33241f");
  pixelRect(ctx, x + 9, y + 24, 24, 27, "#f4efe6");
  pixelRect(ctx, x + 13, y + 28, 4, 16, "#d8292f");
  pixelRect(ctx, x + 21, y + 28, 4, 16, "#315bad");
  pixelRect(ctx, x + 12, y + 11, 18, 16, "#f0c099");
  pixelRect(ctx, x + 8, y + 5 + Math.sin(time * 5) * 1, 26, 9, "#ffffff");
  pixelRect(ctx, x + 11, y, 7, 8, "#ffffff");
  pixelRect(ctx, x + 20, y, 7, 8, "#ffffff");
  pixelRect(ctx, x + 13, y + 19, 16, 3, "#5c3529");
  pixelRect(ctx, x - 12, y + 31, 20, 4, "#c28a4f");
  drawCroissant(ctx, x + 34, y + 20, time * 8);
}

function drawNapoleon(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number, time: number): void {
  const y = enemy.y;
  pixelRect(ctx, x + 4, y + 52, 10, 6, "#1f232b");
  pixelRect(ctx, x + 26, y + 52, 10, 6, "#1f232b");
  pixelRect(ctx, x + 10, y + 24, 22, 30, "#263f75");
  pixelRect(ctx, x + 14, y + 27, 4, 21, "#f3e6c7");
  pixelRect(ctx, x + 23, y + 27, 4, 21, "#d8b35c");
  pixelRect(ctx, x + 12, y + 12, 18, 15, "#f1c09b");
  pixelRect(ctx, x + 5, y + 6, 32, 8, "#111722");
  pixelRect(ctx, x + 9, y + 2, 24, 7, "#111722");
  pixelRect(ctx, x + 13, y + 17, 14, 3, "#3e241f");
  pixelRect(ctx, x - 28, y + 34 + Math.sin(time * 5) * 1, 34, 8, "#262d33");
  pixelRect(ctx, x - 34, y + 36, 8, 5, "#14181d");
  drawFrenchFlag(ctx, x + 31, y + 18, 10, false);
}

function drawEnemyHp(ctx: CanvasRenderingContext2D, enemy: Enemy, x: number): void {
  if (enemy.hp >= enemy.maxHp || enemy.kind === "baker" || enemy.kind === "napoleon") return;
  const pct = clamp(enemy.hp / enemy.maxHp, 0, 1);
  pixelRect(ctx, x, enemy.y - 5, enemy.w, 3, "#321b20");
  pixelRect(ctx, x, enemy.y - 5, enemy.w * pct, 3, pct > 0.45 ? "#f5e665" : "#ff4c4c");
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Player, cameraX: number, time: number): void {
  drawCat(ctx, player.x - cameraX - player.facing * 22, GROUND_Y - 13, time);
  if (player.invuln > 0 && Math.floor(time * 18) % 2 === 0) return;
  drawZeSprite(ctx, player.x - cameraX, player.y, player.facing, player.ducking, player.shootFlash, player.hurtFlash > 0, time + player.anim);
}

function drawZeSprite(ctx: CanvasRenderingContext2D, x: number, y: number, facing: Direction, ducking: boolean, shootFlash: number, hurt: boolean, time: number): void {
  const coat = hurt ? "#ff7166" : "#d92332";
  const skin = "#e9b38f";
  if (ducking) {
    pixelRect(ctx, x + 3, y + 12, 12, 5, "#22242a");
    pixelRect(ctx, x + 5, y + 5, 11, 9, coat);
    pixelRect(ctx, x + 8, y - 1, 8, 8, skin);
    pixelRect(ctx, x + 7, y - 3, 10, 3, "#2a1a18");
    pixelRect(ctx, x + 8, y + 8, 3, 3, "#ffffff");
    pixelRect(ctx, x + 6, y + 9, 8, 2, "#ffffff");
    pixelRect(ctx, x + (facing === 1 ? 15 : -8), y + 8, 10, 3, "#2d323a");
    if (shootFlash > 0) pixelRect(ctx, x + (facing === 1 ? 25 : -13), y + 7, 5, 5, "#ffe272");
    return;
  }
  const step = Math.sin(time * 10) * 2;
  pixelRect(ctx, x + 4, y + 24, 5, 5, "#20242a");
  pixelRect(ctx, x + 11, y + 24, 5, 5, "#20242a");
  pixelRect(ctx, x + 5, y + 15, 4, 10 + step, "#23304c");
  pixelRect(ctx, x + 11, y + 15, 4, 10 - step, "#23304c");
  pixelRect(ctx, x + 4, y + 8, 13, 12, coat);
  pixelRect(ctx, x + 8, y + 10, 3, 8, "#ffffff");
  pixelRect(ctx, x + 6, y + 12, 8, 3, "#ffffff");
  pixelRect(ctx, x + 6, y + 1, 10, 9, skin);
  pixelRect(ctx, x + 5, y, 11, 4, "#2c1a17");
  pixelRect(ctx, x + (facing === 1 ? 13 : 0), y + 5, 2, 2, "#2b1c16");
  pixelRect(ctx, x + (facing === 1 ? 16 : -8), y + 12, 11, 3, "#2d323a");
  pixelRect(ctx, x + (facing === 1 ? 23 : -10), y + 10, 4, 3, "#555e66");
  if (shootFlash > 0) pixelRect(ctx, x + (facing === 1 ? 27 : -16), y + 9, 6, 6, "#ffe272");
}

function drawCat(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const tail = Math.sin(time * 6) * 2;
  pixelRect(ctx, x + 2, y + 4, 14, 7, "#08090d");
  pixelRect(ctx, x + 12, y, 7, 7, "#08090d");
  pixelRect(ctx, x + 12, y - 2, 3, 3, "#08090d");
  pixelRect(ctx, x + 16, y - 2, 3, 3, "#08090d");
  pixelRect(ctx, x + 17, y + 2, 1, 1, "#8cf08c");
  pixelRect(ctx, x, y + 1 + tail, 3, 8, "#08090d");
  pixelRect(ctx, x + 4, y + 10, 3, 3, "#08090d");
  pixelRect(ctx, x + 12, y + 10, 3, 3, "#08090d");
}

function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[], cameraX: number): void {
  for (const particle of particles) {
    const alpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.globalAlpha = alpha;
    pixelRect(ctx, particle.x - cameraX, particle.y, particle.size, particle.size, particle.color);
    ctx.globalAlpha = 1;
  }
}

function drawForeground(ctx: CanvasRenderingContext2D, stage: StageData, cameraX: number, time: number): void {
  for (let x = -((cameraX * 0.92) % 96) - 20; x < VIEW_WIDTH + 120; x += 96) {
    if (stage.theme === "alps") {
      pixelRect(ctx, x, GROUND_Y - 8, 18, 8, "#2f4b32");
      pixelRect(ctx, x + 34, GROUND_Y - 5, 10, 5, "#d5d9cf");
    } else {
      pixelRect(ctx, x, GROUND_Y - 8, 32, 8, "#3b3230");
      pixelRect(ctx, x + 12, GROUND_Y - 18, 4, 10, "#5c4236");
    }
  }
  if (Math.floor(time * 2) % 2 === 0) {
    for (let x = -((cameraX * 0.7) % 180); x < VIEW_WIDTH + 180; x += 180) {
      pixelRect(ctx, x + 70, 132, 5, 18, "rgba(60, 60, 60, 0.35)");
      pixelRect(ctx, x + 68, 128, 9, 8, "rgba(85, 85, 85, 0.25)");
    }
  }
}

function drawCanvasMessage(ctx: CanvasRenderingContext2D, game: GameState): void {
  if (game.messageTimer > 0 && game.message) {
    pixelRect(ctx, 90, 22, 300, 24, "rgba(9, 14, 24, 0.78)");
    drawText(ctx, game.message, VIEW_WIDTH / 2, 29, 10, "#fff4b8", "center");
  }
  if (game.mode === "stageClear") {
    pixelRect(ctx, 92, 84, 296, 92, "rgba(8, 13, 22, 0.88)");
    drawText(ctx, "STAGE CLEAR", VIEW_WIDTH / 2, 101, 20, "#fff1a8", "center");
    drawText(ctx, "Press Enter for the next push", VIEW_WIDTH / 2, 134, 10, "#d7e5ff", "center");
  } else if (game.mode === "lifeLost") {
    pixelRect(ctx, 104, 102, 272, 54, "rgba(8, 13, 22, 0.88)");
    drawText(ctx, "ZE IS DOWN", VIEW_WIDTH / 2, 116, 18, "#ff776c", "center");
  } else if (game.mode === "continue") {
    pixelRect(ctx, 72, 76, 336, 118, "rgba(8, 13, 22, 0.9)");
    drawText(ctx, "CONTINUE?", VIEW_WIDTH / 2, 94, 22, "#fff1a8", "center");
    drawText(ctx, "Infinite continues. Press Enter.", VIEW_WIDTH / 2, 130, 10, "#d7e5ff", "center");
    drawText(ctx, `Continues used: ${game.continueCount}`, VIEW_WIDTH / 2, 150, 9, "#9fb5d1", "center");
  } else if (game.mode === "victory") {
    pixelRect(ctx, 54, 62, 372, 144, "rgba(8, 13, 22, 0.9)");
    drawText(ctx, "ZE SAVES SWIZERLAND", VIEW_WIDTH / 2, 83, 21, "#fff1a8", "center");
    drawText(ctx, "Batman approves. The invasion is over.", VIEW_WIDTH / 2, 121, 10, "#d7e5ff", "center");
    drawText(ctx, `Final score: ${game.score}`, VIEW_WIDTH / 2, 146, 11, "#f9d263", "center");
    drawText(ctx, "Press Enter to return to title", VIEW_WIDTH / 2, 173, 9, "#9fb5d1", "center");
  }
}

function drawTriangle(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.lineTo(Math.round(x3), Math.round(y3));
  ctx.closePath();
  ctx.fill();
}

function drawSwissFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, damaged: boolean): void {
  pixelRect(ctx, x, y, size, size, "#d5232f");
  pixelRect(ctx, x + size * 0.42, y + size * 0.2, size * 0.16, size * 0.6, "#ffffff");
  pixelRect(ctx, x + size * 0.2, y + size * 0.42, size * 0.6, size * 0.16, "#ffffff");
  if (damaged) pixelRect(ctx, x + size * 0.65, y + size * 0.64, size * 0.28, size * 0.2, "#26344e");
}

function drawFrenchFlag(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hanging: boolean): void {
  const w = hanging ? size : size + 4;
  const h = hanging ? size + 8 : size;
  pixelRect(ctx, x, y, w / 3, h, "#244c9f");
  pixelRect(ctx, x + w / 3, y, w / 3, h, "#f5f0e8");
  pixelRect(ctx, x + (w / 3) * 2, y, w / 3, h, "#d72f3f");
  pixelRect(ctx, x - 2, y, 2, h + 9, "#35241f");
}

function drawChalet(ctx: CanvasRenderingContext2D, x: number, y: number, flag: boolean): void {
  pixelRect(ctx, x + 8, y, 40, 32, "#8d5938");
  drawTriangle(ctx, x, y + 3, x + 28, y - 18, x + 56, y + 3, "#5d2f25");
  pixelRect(ctx, x + 14, y + 12, 8, 8, "#f6d58b");
  pixelRect(ctx, x + 34, y + 12, 8, 8, "#f6d58b");
  pixelRect(ctx, x + 25, y + 18, 8, 14, "#3a241d");
  if (flag) drawFrenchFlag(ctx, x + 42, y - 21, 9, false);
}

function drawWindow(ctx: CanvasRenderingContext2D, x: number, y: number, invasion: boolean): void {
  pixelRect(ctx, x, y, 110, 72, "#111827");
  pixelRect(ctx, x + 6, y + 6, 98, 60, invasion ? "#9ac7df" : "#4f6f8e");
  pixelRect(ctx, x + 53, y + 6, 4, 60, "#111827");
  pixelRect(ctx, x + 6, y + 34, 98, 4, "#111827");
  if (invasion) pixelRect(ctx, x + 6, y + 54, 98, 12, "#48633b");
}

function drawFrenchSoldiersTiny(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  for (let i = 0; i < 4; i += 1) {
    const px = x + i * 18 + Math.sin(time * 5 + i) * 2;
    pixelRect(ctx, px, y + 10, 6, 10, "#273f76");
    pixelRect(ctx, px + 1, y + 4, 4, 6, "#f0c09a");
    pixelRect(ctx, px, y + 2, 6, 3, "#1b2a52");
    pixelRect(ctx, px + 1, y + 20, 2, 7, "#c83337");
    pixelRect(ctx, px + 5, y + 20, 2, 7, "#c83337");
  }
}

function drawPistolIcon(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  ctx.globalAlpha = alpha;
  pixelRect(ctx, x, y, 22, 5, "#3f4854");
  pixelRect(ctx, x + 13, y + 5, 6, 10, "#2b3038");
  pixelRect(ctx, x + 2, y + 4, 6, 3, "#6f7a83");
  ctx.globalAlpha = 1;
}

function drawKeys(ctx: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  pixelRect(ctx, x, y + Math.sin(time * 5) * 1, 8, 5, "#f5ca55");
  pixelRect(ctx, x + 7, y + 2, 12, 2, "#f5ca55");
  pixelRect(ctx, x + 16, y + 4, 2, 4, "#f5ca55");
}

function drawCroissant(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
  const wobble = Math.sin(spin) * 1;
  pixelRect(ctx, x, y + 3 + wobble, 3, 4, "#d68a36");
  pixelRect(ctx, x + 3, y + 1, 5, 7, "#efb45d");
  pixelRect(ctx, x + 8, y + 2 - wobble, 3, 5, "#d68a36");
  pixelRect(ctx, x + 4, y + 5, 4, 2, "#8f5429");
}

function drawBaguette(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  pixelRect(ctx, x, y + 1, 20, 4, "#d69345");
  pixelRect(ctx, x + 3, y, 5, 2, "#f2c47a");
  pixelRect(ctx, x + 11, y, 5, 2, "#f2c47a");
}

function drawCodfish(ctx: CanvasRenderingContext2D, x: number, y: number, spin: number): void {
  const bob = Math.sin(spin) * 1.5;
  pixelRect(ctx, x - 3, y + 2, 4, 4, "#ff5d2e");
  pixelRect(ctx, x, y + 1 + bob, 10, 5, "#f0d8a6");
  pixelRect(ctx, x + 9, y + 2 + bob, 4, 3, "#d9bd85");
  pixelRect(ctx, x + 2, y + 5 + bob, 4, 2, "#ad8b61");
  pixelRect(ctx, x + 2, y - 1 + bob, 3, 2, "#ffb03b");
}

function progressPercent(hp: number, maxHp: number): number {
  return clamp((hp / maxHp) * 100, 0, 100);
}

function primaryLabel(mode: GameMode): string {
  if (mode === "title") return "Start";
  if (mode === "intro") return "Skip Intro";
  if (mode === "stageClear") return "Next Stage";
  if (mode === "continue") return "Continue";
  if (mode === "victory") return "Title";
  return "";
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<GameState | null>(null);
  const [hud, setHud] = useState<HudSnapshot>(() => initialHud());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    if (!ctx) return undefined;
    const game = createGame();
    gameRef.current = game;
    let last = performance.now();
    let frameId = 0;
    let hudTimer = 0;

    const onKeyDown = (event: KeyboardEvent) => {
      const action = keyToAction(event.key);
      if (!action) return;
      event.preventDefault();
      if (action === "start") {
        if (!event.repeat) handlePrimaryAction(game);
        return;
      }
      game.keys[action] = true;
      if (!event.repeat && action === "jump") game.jumpQueued = true;
      if (!event.repeat && action === "grenade") game.grenadeQueued = true;
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const action = keyToAction(event.key);
      if (!action || action === "start") return;
      event.preventDefault();
      game.keys[action] = false;
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp, { passive: false });
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000 || 0);
      last = now;
      updateGame(game, dt);
      drawScene(ctx, game);
      hudTimer += dt;
      if (hudTimer > 0.08) {
        setHud(createHud(game));
        hudTimer = 0;
      }
      frameId = requestAnimationFrame(loop);
    };
    drawScene(ctx, game);
    setHud(createHud(game));
    frameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      gameRef.current = null;
    };
  }, []);

  const onPrimaryClick = () => {
    const game = gameRef.current;
    if (!game) return;
    handlePrimaryAction(game);
    setHud(createHud(game));
  };

  const actionLabel = primaryLabel(hud.mode);
  const hpWidth = `${progressPercent(hud.hp, MAX_HP)}%`;
  const bossWidth = `${progressPercent(hud.bossHp, hud.bossMaxHp)}%`;

  return (
    <main className="min-h-screen bg-[#0a101b] px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.32em] text-red-300">Local browser game</p>
            <h1 className="font-mono text-3xl font-black tracking-tight text-white sm:text-5xl">Ze Saves Swizerland</h1>
          </div>
          <div className="font-mono text-xs text-slate-300 sm:text-right">
            <p>D shoot | A flaming codfish grenade | S jump</p>
            <p>Arrow keys move | Arrow Down or C duck</p>
          </div>
        </header>

        <section className="relative overflow-hidden border-4 border-slate-700 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)]">
          <canvas ref={canvasRef} width={VIEW_WIDTH} height={VIEW_HEIGHT} className="block aspect-[16/9] w-full bg-black [image-rendering:pixelated]" aria-label="Ze Saves Swizerland game canvas" />

          {hud.mode === "playing" || hud.mode === "lifeLost" || hud.mode === "stageClear" ? (
            <div className="pointer-events-none absolute left-3 right-3 top-3 flex flex-col gap-2 font-mono text-[10px] text-white sm:text-xs">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-48 bg-black/55 px-2 py-1 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-red-200">HP</span>
                    <div className="h-2 flex-1 bg-red-950"><div className="h-full bg-red-400" style={{ width: hpWidth }} /></div>
                    <span>{hud.hp}</span>
                  </div>
                  <div className="mt-1 flex justify-between gap-4 text-slate-200">
                    <span>Lives {hud.lives}</span><span>{hud.weaponLabel}</span><span>Ammo {hud.ammoLabel}</span>
                  </div>
                </div>
                <div className="bg-black/55 px-2 py-1 text-right backdrop-blur-sm">
                  <p>Stage {hud.stage}: {hud.stageName}</p>
                  <p className="text-slate-300">Score {hud.score}</p>
                </div>
              </div>
              {hud.bossName ? (
                <div className="mx-auto w-full max-w-xl bg-black/65 px-2 py-1 backdrop-blur-sm">
                  <div className="mb-1 flex justify-between text-red-100"><span>{hud.bossName}</span><span>{Math.ceil(hud.bossHp)}</span></div>
                  <div className="h-2 bg-red-950"><div className="h-full bg-amber-300" style={{ width: bossWidth }} /></div>
                </div>
              ) : null}
            </div>
          ) : null}

          {actionLabel ? (
            <button type="button" onClick={onPrimaryClick} className="absolute bottom-4 left-1/2 -translate-x-1/2 border-2 border-amber-200 bg-red-700 px-5 py-2 font-mono text-sm font-black uppercase tracking-[0.18em] text-white shadow-[0_0_0_4px_rgba(0,0,0,0.35)] transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-amber-200">
              {actionLabel}
            </button>
          ) : null}
        </section>

        <footer className="grid gap-2 font-mono text-xs text-slate-300 sm:grid-cols-3">
          <p>Four side-scrolling stages across invaded Swiss scenery, with parallax villages, cities, mountains, and Bern.</p>
          <p>Break barrels and boxes for lazer, missile launcher, machine gun, Uzi, and HP food drops.</p>
          <p>Bosses: the croissant-and-baguette baker in stage 2, and Napoleon in stage 4. You have 3 lives and infinite continues.</p>
        </footer>
      </div>
    </main>
  );
}