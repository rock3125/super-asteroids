export const LAYER = {
  NONE: 0,
  PLAYER: 1,
  BULLET: 2,
  ASTEROID: 4,
  SAUCER: 8,
  UPGRADE: 16,
};

export const COLLISION_MATRIX = {
  [LAYER.PLAYER]: { [LAYER.ASTEROID]: 1, [LAYER.SAUCER]: 1, [LAYER.UPGRADE]: 1 },
  [LAYER.BULLET]: { [LAYER.ASTEROID]: 1, [LAYER.SAUCER]: 1 },
  [LAYER.ASTEROID]: { [LAYER.PLAYER]: 1, [LAYER.BULLET]: 1 },
  [LAYER.SAUCER]: { [LAYER.PLAYER]: 1, [LAYER.BULLET]: 1 },
  [LAYER.UPGRADE]: { [LAYER.PLAYER]: 1 },
};

export const canCollide = (a, b) =>
  !!(COLLISION_MATRIX[a.layer] && COLLISION_MATRIX[a.layer][b.layer]);

export const VIEW_HALF_HEIGHT = 540;
export const DRAG_PER_FRAME = 0.95;
export const PLAYER_THRUST = 1500;
export const PLAYER_MAX_SPEED = 500;
export const PLAYER_TURN_SPEED = 4.4;
export const PLAYER_RADIUS = 13;
export const FIRE_COOLDOWN = 0.16;
export const BULLET_SPEED = 720;
export const BULLET_LIFETIME = 1.8;
export const BULLET_RADIUS = 3;

export const SAUCER_RADIUS = 24;
export const SAUCER_HP = 1;
export const SAUCER_SPEED = 130;
export const SAUCER_SCORE = 500;
export const SAUCER_FIRE_INTERVAL = 1.3;
export const SAUCER_BULLET_SPEED = 480;

export const ASTEROID_TIERS = {
  super: { radius: 96, hp: 12, speed: 20, spin: 0.35, score: 1000, child: 'large', children: 2, color: 0xff5c8a, jitter: 0.32 },
  large: { radius: 58, hp: 4, speed: 46, spin: 0.7, score: 100, child: 'medium', children: 2, color: 0x8fbcff, jitter: 0.28 },
  medium: { radius: 32, hp: 2, speed: 66, spin: 1.1, score: 50, child: 'small', children: 2, color: 0x9ecbff, jitter: 0.26 },
  small: { radius: 15, hp: 1, speed: 98, spin: 1.6, score: 20, child: null, children: 0, color: 0xbfe0ff, jitter: 0.24 },
};

export const SPAWN_MIN_FACTOR = 1.15;
export const SPAWN_MAX_FACTOR = 1.6;
export const DESPAWN_FACTOR = 2.4;
export const NEAR_RADIUS_FACTOR = 1.8;
export const NEAR_TARGET_BASE = 9;
export const NEAR_TARGET_PER_LEVEL = 2;
export const NEAR_TARGET_MAX = 18;
export const ROCK_TRICKLE_INTERVAL = 0.35;
export const ROCK_BURST_INTERVAL = 0.12;
export const MAX_PARTICLES = 600;
export const MAX_FUMES = 300;
export const FUME_PALETTE = [0x7ef9ff, 0x8fbcff, 0x53ffd0, 0xb07fff, 0xffa94d];
export const START_LIVES = 3;
export const RESPAWN_TIME = 1.6;
export const START_SHIELD_TIME = 5;

export const UPGRADE_CHANCE = 0.25;
export const UPGRADE_DURATION = 30;
export const UPGRADE_LIFETIME = 12;
export const UPGRADE_RADIUS = 13;
export const LASER_COOLDOWN = 0.28;
export const LASER_DAMAGE = 5;
export const LASER_RANGE = 900;
export const LASER_BEAM_LIFE = 0.3;
export const LASER_SWEEP = (10 * Math.PI) / 180;
export const SHIELD_RADIUS = 27;
export const SHIELD_SPIN = 1.8;
export const MULTISHOT_SPREAD = 0.16;
export const UPGRADE_TYPES = {
  laser: 0xffe14d,
  shield: 0x53ffd0,
  multishot: 0xff9a3c,
};
