export class Spawner {
  constructor() {
    this.superTimer = 30;
    this.saucerTimer = 15;
  }
  reset() {
    this.superTimer = 30;
    this.saucerTimer = 15;
  }
  update(dt, world) {
    const level = world.level;
    const target = Math.min(10 + level * 3, 28);
    let rockCount = 0;
    for (const a of world.asteroids) if (a.alive) rockCount++;
    if (rockCount < target) world.spawnAsteroid('large');
    this.superTimer -= dt;
    if (this.superTimer <= 0) {
      this.superTimer = 45 + Math.random() * 25;
      let hasSuper = false;
      for (const a of world.asteroids) if (a.alive && a.tier === 'super') hasSuper = true;
      if (!hasSuper) world.spawnAsteroid('super');
    }
    this.saucerTimer -= dt;
    if (this.saucerTimer <= 0) {
      this.saucerTimer = Math.max(7, 20 - level * 1.5) * (0.75 + Math.random() * 0.6);
      const cap = level >= 4 ? 2 : 1;
      if (world.saucers.length < cap) world.spawnSaucer(level);
    }
  }
}
