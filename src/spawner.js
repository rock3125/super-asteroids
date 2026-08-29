import {
  NEAR_RADIUS_FACTOR,
  NEAR_TARGET_BASE,
  NEAR_TARGET_PER_LEVEL,
  NEAR_TARGET_MAX,
  ROCK_TRICKLE_INTERVAL,
  ROCK_BURST_INTERVAL,
  SUPER_CAP_MAX,
  SAUCER_CAP_MAX,
} from './config.js';

export class Spawner {
  constructor() {
    this.superTimer = 30;
    this.saucerTimer = 15;
    this.rockTimer = 0;
  }
  reset() {
    this.superTimer = 30;
    this.saucerTimer = 15;
    this.rockTimer = 0;
  }
  update(dt, world) {
    const level = world.level;
    const nearRadius = world.gfx.viewportRadius() * NEAR_RADIUS_FACTOR;
    const target = Math.min(NEAR_TARGET_BASE + level * NEAR_TARGET_PER_LEVEL, NEAR_TARGET_MAX);
    let nearCount = 0;
    for (const a of world.asteroids) {
      if (a.alive && a.pos.distanceTo(world.player.pos) < nearRadius) nearCount++;
    }
    this.rockTimer -= dt;
    if (nearCount < target && this.rockTimer <= 0) {
      world.spawnAsteroid('large');
      this.rockTimer = nearCount < target * 0.5 ? ROCK_BURST_INTERVAL : ROCK_TRICKLE_INTERVAL;
    }
    this.superTimer -= dt;
    if (this.superTimer <= 0) {
      this.superTimer = 35 + Math.random() * 20;
      const superCap = Math.min(1 + Math.floor(level / 3), SUPER_CAP_MAX);
      let superCount = 0;
      for (const a of world.asteroids) if (a.alive && a.tier === 'super') superCount++;
      if (superCount < superCap) world.spawnAsteroid('super');
    }
    this.saucerTimer -= dt;
    if (this.saucerTimer <= 0) {
      this.saucerTimer = Math.max(4, 18 - level * 1.5) * (0.75 + Math.random() * 0.6);
      const cap = Math.min(1 + Math.floor(level / 2), SAUCER_CAP_MAX);
      if (world.saucers.length < cap) world.spawnSaucer(level);
    }
  }
}
