import * as THREE from 'three';
import {
  LAYER,
  canCollide,
  ASTEROID_TIERS,
  SPAWN_MIN_FACTOR,
  SPAWN_MAX_FACTOR,
  DESPAWN_FACTOR,
  START_LIVES,
  RESPAWN_TIME,
  START_SHIELD_TIME,
  PLAYER_RADIUS,
  BULLET_SPEED,
  FIRE_COOLDOWN,
  SAUCER_RADIUS,
  SAUCER_SPEED,
  SAUCER_SCORE,
  SAUCER_BULLET_SPEED,
  MAX_PARTICLES,
  UPGRADE_CHANCE,
  UPGRADE_DURATION,
  UPGRADE_TYPES,
  LASER_COOLDOWN,
  LASER_DAMAGE,
  MULTISHOT_SPREAD,
} from './config.js';
import { Player, Bullet, Asteroid, Saucer, Upgrade, LaserBeam, ParticleSystem } from './entities.js';

export class World {
  constructor(gfx, audio) {
    this.gfx = gfx;
    this.audio = audio;
    this.player = new Player();
    this.particles = new ParticleSystem(MAX_PARTICLES);
    this.asteroids = [];
    this.bullets = [];
    this.saucers = [];
    this.upgrades = [];
    this.beams = [];
    this.activeUpgrade = null;
    this.startShield = 0;
    this.phase = 'menu';
    this.score = 0;
    this.lives = START_LIVES;
    this.time = 0;
    this.respawnTimer = 0;
    this.shake = 0;
    gfx.worldGroup.add(this.player.group);
    gfx.worldGroup.add(this.particles.mesh);
  }
  get level() {
    return 1 + Math.floor(this.time / 30);
  }
  start() {
    this.player.alive = true;
    this.player.invuln = 0;
    this.startShield = START_SHIELD_TIME;
    this.player.group.visible = true;
    this.phase = 'playing';
  }
  reset() {
    for (const e of [...this.asteroids, ...this.bullets, ...this.saucers, ...this.upgrades, ...this.beams]) {
      this.gfx.worldGroup.remove(e.mesh);
      e.dispose();
    }
    this.asteroids.length = 0;
    this.bullets.length = 0;
    this.saucers.length = 0;
    this.upgrades.length = 0;
    this.beams.length = 0;
    this.activeUpgrade = null;
    this.startShield = 0;
    this.particles.clear();
    this.player.reset();
    this.player.shieldActive = false;
    this.player.group.visible = false;
    this.score = 0;
    this.lives = START_LIVES;
    this.time = 0;
    this.respawnTimer = 0;
    this.shake = 0;
    this.phase = 'menu';
  }
  spawnAsteroid(tier, pos, vel) {
    const cfg = ASTEROID_TIERS[tier];
    if (!pos) {
      const vpr = this.gfx.viewportRadius();
      const r = vpr * (SPAWN_MIN_FACTOR + Math.random() * (SPAWN_MAX_FACTOR - SPAWN_MIN_FACTOR));
      const pv = this.player.vel;
      let an;
      if (pv.lengthSq() > 120 * 120) {
        an = Math.atan2(pv.y, pv.x) + (Math.random() * 2 - 1) * Math.PI * 0.6;
      } else {
        an = Math.random() * Math.PI * 2;
      }
      pos = this.player.pos.clone().add(
        new THREE.Vector2(Math.cos(an), Math.sin(an)).multiplyScalar(r)
      );
    }
    if (!vel) {
      const sp = cfg.speed * (1 + (this.level - 1) * 0.06);
      const toPlayer = new THREE.Vector2().subVectors(this.player.pos, pos);
      let an;
      if (toPlayer.lengthSq() > 1) {
        an = Math.atan2(toPlayer.y, toPlayer.x) + (Math.random() * 2 - 1) * Math.PI * 0.5;
      } else {
        an = Math.random() * Math.PI * 2;
      }
      vel = new THREE.Vector2(Math.cos(an), Math.sin(an)).multiplyScalar(sp);
    }
    const a = new Asteroid(tier, pos, vel);
    this.asteroids.push(a);
    this.gfx.worldGroup.add(a.mesh);
    return a;
  }
  spawnSaucer(level) {
    const vpr = this.gfx.viewportRadius();
    const r = vpr * (0.9 + Math.random() * 0.7);
    const an = Math.random() * Math.PI * 2;
    const pos = this.player.pos.clone().add(
      new THREE.Vector2(Math.cos(an), Math.sin(an)).multiplyScalar(r)
    );
    const s = new Saucer(pos, SAUCER_SPEED + level * 6);
    this.saucers.push(s);
    this.gfx.worldGroup.add(s.mesh);
  }
  spawnUpgrade(pos) {
    const keys = Object.keys(UPGRADE_TYPES);
    const type = keys[(Math.random() * keys.length) | 0];
    const u = new Upgrade(type, pos);
    this.upgrades.push(u);
    this.gfx.worldGroup.add(u.mesh);
    this.audio.blip(880, 1320, 0.18, 0.2, 'sine', 10);
  }
  firePlayer() {
    const p = this.player;
    if (p.cooldown > 0) return;
    const up = this.activeUpgrade;
    if (up && up.type === 'laser') {
      p.cooldown = LASER_COOLDOWN;
      const dir = p.heading();
      const pos = p.pos.clone().addScaledVector(dir, PLAYER_RADIUS + 8);
      const b = new LaserBeam(pos, dir);
      this.beams.push(b);
      this.gfx.worldGroup.add(b.mesh);
      this.audio.laser();
      return;
    }
    p.cooldown = FIRE_COOLDOWN;
    const count = up && up.type === 'multishot' ? 3 : 1;
    const spread = up && up.type === 'multishot' ? MULTISHOT_SPREAD : 0;
    for (let i = 0; i < count; i++) {
      const off = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
      const dir = p.heading().rotateAround(new THREE.Vector2(), off);
      const pos = p.pos.clone().addScaledVector(dir, PLAYER_RADIUS + 8);
      const vel = dir.clone().multiplyScalar(BULLET_SPEED).addScaledVector(p.vel, 0.4);
      const b = new Bullet(pos, vel, 0xaefbff, LAYER.BULLET);
      this.bullets.push(b);
      this.gfx.worldGroup.add(b.mesh);
    }
    this.audio.shoot();
  }
  saucerFire(s) {
    const aim = new THREE.Vector2().subVectors(this.player.pos, s.pos).normalize();
    const base = Math.atan2(aim.y, aim.x) + (Math.random() * 2 - 1) * 0.12;
    aim.set(Math.cos(base), Math.sin(base));
    const pos = s.pos.clone().addScaledVector(aim, SAUCER_RADIUS + 4);
    const vel = aim.multiplyScalar(SAUCER_BULLET_SPEED);
    const b = new Bullet(pos, vel, 0xff6b9d, LAYER.SAUCER);
    this.bullets.push(b);
    this.gfx.worldGroup.add(b.mesh);
    this.audio.saucerShot();
  }
  update(dt, input) {
    this.time += dt;
    const p = this.player;
    if (this.activeUpgrade) {
      this.activeUpgrade.timer -= dt;
      if (this.activeUpgrade.timer <= 0) this.activeUpgrade = null;
    }
    this.startShield = Math.max(0, this.startShield - dt);
    p.shieldActive = !!(
      p.alive &&
      (this.startShield > 0 ||
        (this.activeUpgrade && this.activeUpgrade.type === 'shield'))
    );
    if (p.alive) {
      p.update(dt, input);
      if (input.fire) this.firePlayer();
    } else if (this.respawnTimer > 0) {
      this.respawnTimer -= dt;
    } else if (this.lives > 0) {
      this.respawn();
    } else {
      this.phase = 'over';
    }
    for (const a of this.asteroids) a.update(dt);
    for (const b of this.bullets) b.update(dt);
    for (const s of this.saucers) {
      if (s.update(dt, p.pos) && p.alive) this.saucerFire(s);
    }
    for (const u of this.upgrades) u.update(dt);
    for (const b of this.beams) {
      b.update(dt);
      if (p.alive) {
        b.anchor(p.pos.clone().addScaledVector(p.heading(), PLAYER_RADIUS + 8));
      }
      for (const a of this.asteroids) {
        if (b.hits.has(a) || !b.hitTest(a.pos, a.radius)) continue;
        b.hits.add(a);
        this.hitAsteroid(a, b.closestPoint(a.pos), LASER_DAMAGE);
      }
      for (const s of this.saucers) {
        if (b.hits.has(s) || !b.hitTest(s.pos, s.radius)) continue;
        b.hits.add(s);
        this.destroySaucer(s);
      }
    }
    this.particles.update(dt);
    this.collide();
    this.cleanup();
    if (this.shake > 0) {
      this.gfx.addShake(this.shake);
      this.shake = 0;
    }
    this.gfx.worldGroup.position.set(-p.pos.x, -p.pos.y, 0);
  }
  updateAmbient(dt) {
    const p = this.player;
    for (const a of this.asteroids) a.update(dt);
    for (const s of this.saucers) s.update(dt, p.pos);
    for (const u of this.upgrades) u.update(dt);
    this.particles.update(dt);
    this.cleanup();
    this.gfx.worldGroup.position.set(-p.pos.x, -p.pos.y, 0);
  }
  collide() {
    const ents = [];
    const shielded =
      this.startShield > 0 ||
      (this.activeUpgrade && this.activeUpgrade.type === 'shield');
    if (this.player.alive && (this.player.invuln <= 0 || shielded)) ents.push(this.player);
    ents.push(...this.asteroids, ...this.bullets, ...this.saucers, ...this.upgrades);
    for (let i = 0; i < ents.length; i++) {
      for (let j = i + 1; j < ents.length; j++) {
        const a = ents[i];
        const b = ents[j];
        if (!canCollide(a, b)) continue;
        const dx = a.pos.x - b.pos.x;
        const dy = a.pos.y - b.pos.y;
        const rr = a.radius + b.radius;
        if (dx * dx + dy * dy > rr * rr) continue;
        this.resolve(a, b);
      }
    }
  }
  resolve(a, b) {
    const player = a === this.player || b === this.player ? this.player : null;
    const bullets = [];
    const rocks = [];
    const saucers = [];
    const upgrades = [];
    for (const e of [a, b]) {
      if (e instanceof Bullet) bullets.push(e);
      else if (e instanceof Asteroid) rocks.push(e);
      else if (e instanceof Saucer) saucers.push(e);
      else if (e instanceof Upgrade) upgrades.push(e);
    }
    if (player) {
      if (upgrades.length) {
        this.collectUpgrade(upgrades[0]);
        return;
      }
      const shielded =
        this.startShield > 0 ||
        (this.activeUpgrade && this.activeUpgrade.type === 'shield');
      if (rocks.length) {
        if (!shielded) this.killPlayer();
        this.destroyAsteroid(rocks[0], this.player.pos);
      } else if (saucers.length) {
        if (!shielded) this.killPlayer();
        this.destroySaucer(saucers[0]);
      } else if (bullets.length && bullets[0].layer === LAYER.SAUCER) {
        bullets.forEach((b) => this.destroyBullet(b));
        if (!shielded) this.killPlayer();
      }
      return;
    }
    if (bullets.length === 2) {
      bullets.forEach((b) => this.destroyBullet(b));
      return;
    }
    if (bullets.length && rocks.length) {
      const impact = bullets[0].pos.clone();
      bullets.forEach((b) => this.destroyBullet(b));
      this.hitAsteroid(rocks[0], impact);
      return;
    }
    if (bullets.length && saucers.length) {
      bullets.forEach((b) => this.destroyBullet(b));
      if (bullets[0].layer === LAYER.BULLET) this.destroySaucer(saucers[0]);
    }
  }
  collectUpgrade(u) {
    u.alive = false;
    this.activeUpgrade = { type: u.type, timer: UPGRADE_DURATION };
    this.particles.emit(u.pos, null, UPGRADE_TYPES[u.type], 0.6, 30, 180, 260);
    this.audio.pickup();
    this.shake = 6;
  }
  hitAsteroid(a, impact, dmg = 1) {
    if (a.damage(dmg)) {
      this.destroyAsteroid(a, impact);
    } else {
      this.audio.breakRock(0.3);
      this.particles.emit(impact, null, 0xffffff, 0.25, 4, 90, 60);
    }
  }
  destroyAsteroid(a, impact) {
    const cfg = ASTEROID_TIERS[a.tier];
    this.score += cfg.score;
    const vel = a.vel;
    const len = vel.length();
    const split = new THREE.Vector2();
    if (len > 1) {
      split.set(-vel.y / len, vel.x / len);
    } else {
      const an = Math.random() * Math.PI * 2;
      split.set(Math.cos(an), Math.sin(an));
    }
    this.particles.emit(a.pos, split, cfg.color, 0.5, Math.min(24, 6 + cfg.radius * 0.25), 90, cfg.radius * 1.6);
    if (cfg.child) {
      const childCfg = ASTEROID_TIERS[cfg.child];
      for (let k = 0; k < cfg.children; k++) {
        const sign = k === 0 ? 1 : -1;
        const pos = a.pos.clone().addScaledVector(split, cfg.radius * 0.4 * sign);
        const cvel = split.clone().multiplyScalar(childCfg.speed * sign * 0.9).addScaledVector(a.vel, 0.35);
        this.spawnAsteroid(cfg.child, pos, cvel);
      }
      if (Math.random() < UPGRADE_CHANCE) this.spawnUpgrade(a.pos);
    } else {
      this.particles.emit(a.pos, split, 0xbfe0ff, 0.6, 12, 140, 200);
    }
    this.audio.explode(a.tier === 'super');
    if (a.tier === 'super') this.shake = 26;
    a.alive = false;
  }
  destroyBullet(b) {
    b.alive = false;
  }
  destroySaucer(s) {
    this.score += SAUCER_SCORE;
    this.particles.emit(s.pos, null, 0xff6b9d, 0.55, 18, 120, 220);
    this.audio.explode(false);
    this.shake = 12;
    s.alive = false;
  }
  killPlayer() {
    this.particles.emit(this.player.pos, null, 0x7ef9ff, 0.9, 36, 160, 260);
    this.audio.playerDeath();
    this.shake = 30;
    this.player.alive = false;
    this.player.shieldActive = false;
    this.player.sync();
    this.lives -= 1;
    this.respawnTimer = RESPAWN_TIME;
  }
  respawn() {
    const shift = this.player.pos.clone().negate();
    for (const e of this.asteroids) e.pos.add(shift);
    for (const e of this.bullets) e.pos.add(shift);
    for (const e of this.saucers) e.pos.add(shift);
    for (const e of this.upgrades) e.pos.add(shift);
    for (const e of this.beams) e.pos.add(shift);
    this.particles.shift(shift.x, shift.y);
    const safe = 240;
    for (const a of this.asteroids) {
      const d = a.pos.length();
      if (d < safe) {
        const dir = d > 0.001 ? a.pos.clone().divideScalar(d) : new THREE.Vector2(1, 0);
        a.pos.copy(dir.multiplyScalar(safe));
      }
    }
    this.player.pos.set(0, 0);
    this.player.vel.set(0, 0);
    this.player.angle = Math.PI / 2;
    this.player.alive = true;
    this.player.invuln = 0;
    this.startShield = START_SHIELD_TIME;
    this.player.cooldown = 0;
    this.player.thrust = 0;
  }
  cleanup() {
    const vpr = this.gfx.viewportRadius() * DESPAWN_FACTOR;
    for (const list of [this.asteroids, this.bullets, this.saucers, this.upgrades, this.beams]) {
      for (let i = list.length - 1; i >= 0; i--) {
        const e = list[i];
        const dead = !e.alive || e.pos.distanceTo(this.player.pos) > vpr * 1.1;
        if (dead) {
          this.gfx.worldGroup.remove(e.mesh);
          e.dispose();
          list.splice(i, 1);
        }
      }
    }
  }
}
