import * as THREE from 'three';
import {
  LAYER,
  DRAG_PER_FRAME,
  PLAYER_THRUST,
  PLAYER_MAX_SPEED,
  PLAYER_TURN_SPEED,
  PLAYER_RADIUS,
  BULLET_LIFETIME,
  BULLET_RADIUS,
  SAUCER_RADIUS,
  SAUCER_HP,
  SAUCER_FIRE_INTERVAL,
  ASTEROID_TIERS,
  UPGRADE_TYPES,
  UPGRADE_RADIUS,
  UPGRADE_LIFETIME,
  LASER_RANGE,
  LASER_BEAM_LIFE,
  LASER_SWEEP,
  SHIELD_RADIUS,
  SHIELD_SPIN,
} from './config.js';
import { makeLine, makeLineLoop, vec3 } from './gfx.js';

const WHITE = new THREE.Color(0xffffff);

let noiseTexture = null;
function getNoiseTexture() {
  if (noiseTexture) return noiseTexture;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 22;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.1 + Math.random() * 0.3;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  noiseTexture = new THREE.CanvasTexture(c);
  noiseTexture.wrapS = noiseTexture.wrapT = THREE.RepeatWrapping;
  return noiseTexture;
}

const SHIP_POINTS = [[0, 18], [12, -12], [5, -9], [-5, -9], [-12, -12], [0, 18]];
const FLAME_POINTS = [[0, 0], [0, -20]];
const SAUCER_BODY = [[-19, 0], [19, 0], [13, 7], [-13, 7], [-19, 0]];
const SAUCER_DOME = [[-9, 7], [0, 15], [9, 7]];

export class Player {
  constructor() {
    this.pos = new THREE.Vector2(0, 0);
    this.vel = new THREE.Vector2(0, 0);
    this.angle = Math.PI / 2;
    this.thrust = 0;
    this.cooldown = 0;
    this.invuln = 0;
    this.alive = false;
    this.layer = LAYER.PLAYER;
    this.radius = PLAYER_RADIUS;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.ship = makeLineLoop(SHIP_POINTS.map(([x, y]) => vec3(x, y)), 0x7ef9ff);
    this.flame = makeLine(FLAME_POINTS.map(([x, y]) => vec3(x, y)), 0xffa94d);
    this.flame.position.set(0, -10, 0);
    this.group.add(this.ship);
    this.group.add(this.flame);
    this.shieldGroup = new THREE.Group();
    this.shieldSphere = new THREE.Mesh(
      new THREE.SphereGeometry(SHIELD_RADIUS, 32, 24),
      new THREE.MeshBasicMaterial({
        color: 0x53ffd0,
        map: getNoiseTexture(),
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.shieldGroup.add(this.shieldSphere);
    this.shieldGroup.visible = false;
    this.shieldActive = false;
    this.shieldPulse = 0;
    this.shieldSpin = 0;
    this.group.add(this.shieldGroup);
    this.sync();
  }
  heading() {
    return new THREE.Vector2(Math.sin(this.angle), Math.cos(this.angle));
  }
  update(dt, input) {
    const dir = this.heading();
    const boost = input.thrust ? 1 : 0;
    this.thrust += (boost - this.thrust) * Math.min(1, dt * 9);
    if (boost) this.vel.addScaledVector(dir, PLAYER_THRUST * dt);
    this.vel.multiplyScalar(Math.pow(DRAG_PER_FRAME, dt * 60));
    const sp = this.vel.length();
    if (sp > PLAYER_MAX_SPEED) this.vel.multiplyScalar(PLAYER_MAX_SPEED / sp);
    this.pos.addScaledVector(this.vel, dt);
    this.angle += input.turn * PLAYER_TURN_SPEED * dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shieldSpin += dt * SHIELD_SPIN;
    this.sync();
  }
  sync() {
    this.group.position.set(this.pos.x, this.pos.y, 0);
    this.group.rotation.z = -this.angle;
    const s = this.thrust > 0.02 ? this.thrust * (0.75 + Math.random() * 0.45) : 0;
    this.flame.visible = s > 0.05;
    this.flame.scale.y = Math.max(0.25, s);
    this.ship.visible = this.invuln <= 0 || Math.floor(this.invuln * 12) % 2 === 0;
    this.shieldPulse += 0.05;
    this.shieldGroup.visible = this.shieldActive;
    if (this.shieldActive) {
      this.shieldGroup.rotation.z = this.shieldSpin;
      this.shieldGroup.rotation.y = this.shieldSpin * 0.7;
      this.shieldGroup.scale.setScalar(1 + Math.sin(this.shieldPulse) * 0.05);
    }
  }
  reset() {
    this.pos.set(0, 0);
    this.vel.set(0, 0);
    this.angle = Math.PI / 2;
    this.thrust = 0;
    this.cooldown = 0;
    this.invuln = 0;
    this.alive = false;
    this.sync();
  }
}

export class Bullet {
  constructor(pos, vel, color, layer = LAYER.BULLET) {
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.layer = layer;
    this.radius = BULLET_RADIUS;
    this.life = BULLET_LIFETIME;
    this.alive = true;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([this.pos.x, this.pos.y, 0]), 3)
    );
    const mat = new THREE.PointsMaterial({
      size: layer === LAYER.SAUCER ? 8 : 6,
      color,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Points(geom, mat);
  }
  update(dt) {
    this.pos.addScaledVector(this.vel, dt);
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    const p = this.mesh.geometry.attributes.position;
    p.setXYZ(0, this.pos.x, this.pos.y, 0);
    p.needsUpdate = true;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

export class Asteroid {
  constructor(tier, pos, vel) {
    const cfg = ASTEROID_TIERS[tier];
    this.tier = tier;
    this.cfg = cfg;
    this.radius = cfg.radius;
    this.hp = cfg.hp;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.angle = Math.random() * Math.PI * 2;
    this.spin = (Math.random() * 2 - 1) * cfg.spin;
    this.layer = LAYER.ASTEROID;
    this.alive = true;
    this.hitFlash = 0;
    this.baseColor = new THREE.Color(cfg.color);
    const n = Math.max(9, Math.round(this.radius / 3.2));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = this.radius * (1 + (Math.random() * 2 - 1) * cfg.jitter);
      pts.push(vec3(Math.cos(a) * r, Math.sin(a) * r));
    }
    const geom = new THREE.BufferGeometry().setFromPoints(pts);
    this.mat = new THREE.LineBasicMaterial({
      color: cfg.color,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.LineLoop(geom, this.mat);
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
  }
  update(dt) {
    this.pos.addScaledVector(this.vel, dt);
    this.angle += this.spin * dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
    this.mesh.rotation.z = this.angle;
    if (this.hitFlash > 0) {
      this.mat.color.copy(this.baseColor).lerp(WHITE, Math.min(1, this.hitFlash / 0.12));
    }
  }
  damage(n) {
    this.hp -= n;
    this.hitFlash = 0.12;
    return this.hp <= 0;
  }
  dispose() {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

export class Saucer {
  constructor(pos, speed) {
    this.pos = pos.clone();
    this.vel = new THREE.Vector2(0, 0);
    this.dirAngle = Math.random() * Math.PI * 2;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.fireTimer = 1.2 + Math.random();
    this.life = 26 + Math.random() * 12;
    this.hp = SAUCER_HP;
    this.speed = speed;
    this.layer = LAYER.SAUCER;
    this.radius = SAUCER_RADIUS;
    this.alive = true;
    this.mesh = new THREE.Group();
    this.mesh.add(makeLineLoop(SAUCER_BODY.map(([x, y]) => vec3(x, y)), 0xff6b9d));
    this.mesh.add(makeLine(SAUCER_DOME.map(([x, y]) => vec3(x, y)), 0xff9dc3));
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
  }
  update(dt, playerPos) {
    const aimAngle = Math.atan2(playerPos.y - this.pos.y, playerPos.x - this.pos.x);
    let diff = aimAngle - this.dirAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.dirAngle += Math.max(-0.5 * dt, Math.min(0.5 * dt, diff));
    const wobble = Math.sin(this.wobblePhase) * 0.65;
    this.wobblePhase += dt * 2.6;
    const dir = new THREE.Vector2(Math.cos(this.dirAngle), Math.sin(this.dirAngle));
    const perp = new THREE.Vector2(-dir.y, dir.x);
    this.vel.copy(dir).addScaledVector(perp, wobble).normalize().multiplyScalar(this.speed);
    this.pos.addScaledVector(this.vel, dt);
    this.fireTimer -= dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
    this.mesh.scale.x = this.vel.x >= 0 ? 1 : -1;
    this.mesh.rotation.z = this.vel.x * 0.0004;
    if (this.fireTimer <= 0) {
      this.fireTimer = SAUCER_FIRE_INTERVAL * (0.7 + Math.random() * 0.7);
      return true;
    }
    return false;
  }
  dispose() {
    for (const child of this.mesh.children) {
      child.geometry.dispose();
      child.material.dispose();
    }
  }
}

export class Upgrade {
  constructor(type, pos) {
    this.type = type;
    this.pos = pos.clone();
    this.vel = new THREE.Vector2(
      (Math.random() - 0.5) * 40,
      (Math.random() - 0.5) * 40
    );
    this.radius = UPGRADE_RADIUS;
    this.layer = LAYER.UPGRADE;
    this.alive = true;
    this.life = UPGRADE_LIFETIME;
    this.pulse = Math.random() * Math.PI * 2;
    const color = UPGRADE_TYPES[type];
    this.mesh = new THREE.Group();
    this.core = new THREE.Mesh(
      new THREE.CircleGeometry(UPGRADE_RADIUS, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(UPGRADE_RADIUS * 2.1, 24),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    this.mesh.add(this.halo);
    this.mesh.add(this.core);
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
  }
  update(dt) {
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.pow(0.97, dt * 60));
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    this.pulse += dt * 5;
    const s = 1 + Math.sin(this.pulse) * 0.12;
    this.core.scale.setScalar(s);
    this.halo.scale.setScalar(2 - s);
    this.mesh.position.set(this.pos.x, this.pos.y, 0);
    this.mesh.visible = this.life > 3 || Math.floor(this.life * 10) % 2 === 0;
  }
  dispose() {
    this.core.geometry.dispose();
    this.core.material.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
  }
}

export class LaserBeam {
  constructor(pos, dir) {
    this.pos = pos.clone();
    this.baseAngle = Math.atan2(dir.y, dir.x);
    this.dir = new THREE.Vector2(Math.cos(this.baseAngle), Math.sin(this.baseAngle));
    this.life = LASER_BEAM_LIFE;
    this.maxLife = LASER_BEAM_LIFE;
    this.alive = true;
    this.hits = new Set();
    this.group = new THREE.Group();
    const line = makeLine([vec3(0, 0), vec3(LASER_RANGE, 0)], 0xffe14d);
    this.group.add(line);
    this.group.position.set(this.pos.x, this.pos.y, 0);
    this.mesh = this.group;
  }
  sweepAngle() {
    const t = 1 - this.life / this.maxLife;
    return LASER_SWEEP * Math.sin(t * Math.PI * 2);
  }
  closestPoint(p) {
    const t = THREE.MathUtils.clamp(
      (p.x - this.pos.x) * this.dir.x + (p.y - this.pos.y) * this.dir.y,
      0,
      LASER_RANGE
    );
    return this.pos.clone().addScaledVector(this.dir, t);
  }
  hitTest(p, r) {
    return p.distanceTo(this.closestPoint(p)) < r + 3;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
    const ang = this.baseAngle + this.sweepAngle();
    this.dir.set(Math.cos(ang), Math.sin(ang));
    this.group.rotation.z = ang;
    this.group.children[0].material.opacity = Math.min(
      1,
      this.life / (this.maxLife * 0.35)
    );
  }
  anchor(pos) {
    this.pos.copy(pos);
    this.group.position.set(this.pos.x, this.pos.y, 0);
  }
  dispose() {
    for (const child of this.group.children) {
      child.geometry.dispose();
      child.material.dispose();
    }
  }
}

export class ParticleSystem {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 2);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.attrPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', this.attrPos);
    geom.setAttribute('color', this.attrCol);
    this.geom = geom;
    const mat = new THREE.PointsMaterial({
      size: 3,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Points(geom, mat);
    this.mesh.frustumCulled = false;
  }
  emit(pos, dir, color, life, count, speed) {
    const c = new THREE.Color(color);
    for (let n = 0; n < count; n++) {
      const i = this.count < this.max ? this.count++ : (Math.random() * this.count) | 0;
      this.pos[i * 3] = pos.x + (Math.random() * 8 - 4);
      this.pos[i * 3 + 1] = pos.y + (Math.random() * 8 - 4);
      this.pos[i * 3 + 2] = 0;
      const sp = speed * (0.15 + Math.random() * 0.85);
      let vx;
      let vy;
      if (dir) {
        vx = dir.x + (Math.random() - 0.5) * 1.6;
        vy = dir.y + (Math.random() - 0.5) * 1.6;
      } else {
        const an = Math.random() * Math.PI * 2;
        vx = Math.cos(an);
        vy = Math.sin(an);
      }
      const vl = Math.hypot(vx, vy) || 1;
      this.vel[i * 2] = (vx / vl) * sp;
      this.vel[i * 2 + 1] = (vy / vl) * sp;
      this.base[i * 3] = c.r;
      this.base[i * 3 + 1] = c.g;
      this.base[i * 3 + 2] = c.b;
      const l = life * (0.4 + Math.random() * 0.6);
      this.life[i] = l;
      this.maxLife[i] = l;
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
    }
    this.attrPos.needsUpdate = true;
    this.attrCol.needsUpdate = true;
    this.geom.setDrawRange(0, this.count);
  }
  update(dt) {
    const drag = Math.pow(0.96, dt * 60);
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.removeAt(i);
        continue;
      }
      this.pos[i * 3] += this.vel[i * 2] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 2 + 1] * dt;
      this.vel[i * 2] *= drag;
      this.vel[i * 2 + 1] *= drag;
      const f = Math.max(0, this.life[i] / this.maxLife[i]);
      this.col[i * 3] = this.base[i * 3] * f;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * f;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * f;
    }
    this.attrPos.needsUpdate = true;
    this.attrCol.needsUpdate = true;
    this.geom.setDrawRange(0, this.count);
  }
  removeAt(i) {
    const last = --this.count;
    if (i === last) return;
    this.pos[i * 3] = this.pos[last * 3];
    this.pos[i * 3 + 1] = this.pos[last * 3 + 1];
    this.pos[i * 3 + 2] = this.pos[last * 3 + 2];
    this.base[i * 3] = this.base[last * 3];
    this.base[i * 3 + 1] = this.base[last * 3 + 1];
    this.base[i * 3 + 2] = this.base[last * 3 + 2];
    this.col[i * 3] = this.col[last * 3];
    this.col[i * 3 + 1] = this.col[last * 3 + 1];
    this.col[i * 3 + 2] = this.col[last * 3 + 2];
    this.vel[i * 2] = this.vel[last * 2];
    this.vel[i * 2 + 1] = this.vel[last * 2 + 1];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
  }
  shift(dx, dy) {
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3] += dx;
      this.pos[i * 3 + 1] += dy;
    }
    this.attrPos.needsUpdate = true;
  }
  clear() {
    this.count = 0;
    this.geom.setDrawRange(0, 0);
  }
}

let fumeTexture = null;
function getFumeTexture() {
  if (fumeTexture) return fumeTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.7, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  fumeTexture = new THREE.CanvasTexture(c);
  return fumeTexture;
}

export class FumeSystem {
  constructor(max) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.base = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 2);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.maxDist = new Float32Array(max);
    this.dist = new Float32Array(max);
    this.attrPos = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.attrCol = new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage);
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', this.attrPos);
    geom.setAttribute('color', this.attrCol);
    this.geom = geom;
    const mat = new THREE.PointsMaterial({
      size: 26,
      map: getFumeTexture(),
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.mesh = new THREE.Points(geom, mat);
    this.mesh.frustumCulled = false;
  }
  emit(pos, vel, color, maxDist) {
    const c = new THREE.Color(color);
    const i = this.count < this.max ? this.count++ : (Math.random() * this.count) | 0;
    this.pos[i * 3] = pos.x;
    this.pos[i * 3 + 1] = pos.y;
    this.pos[i * 3 + 2] = 0;
    this.vel[i * 2] = vel.x;
    this.vel[i * 2 + 1] = vel.y;
    this.dist[i] = 0;
    this.maxDist[i] = maxDist;
    const l = 2.2 + Math.random() * 1.8;
    this.life[i] = l;
    this.maxLife[i] = l;
    const v = 0.35 + Math.random() * 0.3;
    this.base[i * 3] = c.r * v;
    this.base[i * 3 + 1] = c.g * v;
    this.base[i * 3 + 2] = c.b * v;
    this.col[i * 3] = this.base[i * 3];
    this.col[i * 3 + 1] = this.base[i * 3 + 1];
    this.col[i * 3 + 2] = this.base[i * 3 + 2];
    this.attrPos.needsUpdate = true;
    this.attrCol.needsUpdate = true;
    this.geom.setDrawRange(0, this.count);
  }
  update(dt) {
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0 || this.dist[i] >= this.maxDist[i]) {
        this.removeAt(i);
        continue;
      }
      const dx = this.vel[i * 2] * dt;
      const dy = this.vel[i * 2 + 1] * dt;
      this.pos[i * 3] += dx;
      this.pos[i * 3 + 1] += dy;
      this.dist[i] += Math.hypot(dx, dy);
      this.vel[i * 2] *= Math.pow(0.94, dt * 60);
      this.vel[i * 2 + 1] *= Math.pow(0.94, dt * 60);
      this.vel[i * 2] += (Math.random() - 0.5) * 60 * dt;
      this.vel[i * 2 + 1] += (Math.random() - 0.5) * 60 * dt;
      const f = Math.max(0, 1 - this.dist[i] / this.maxDist[i]);
      const lf = Math.min(1, this.life[i] / (this.maxLife[i] * 0.4));
      const b = f * f * lf;
      this.col[i * 3] = this.base[i * 3] * b;
      this.col[i * 3 + 1] = this.base[i * 3 + 1] * b;
      this.col[i * 3 + 2] = this.base[i * 3 + 2] * b;
    }
    this.attrPos.needsUpdate = true;
    this.attrCol.needsUpdate = true;
    this.geom.setDrawRange(0, this.count);
  }
  removeAt(i) {
    const last = --this.count;
    if (i === last) return;
    this.pos[i * 3] = this.pos[last * 3];
    this.pos[i * 3 + 1] = this.pos[last * 3 + 1];
    this.pos[i * 3 + 2] = this.pos[last * 3 + 2];
    this.col[i * 3] = this.col[last * 3];
    this.col[i * 3 + 1] = this.col[last * 3 + 1];
    this.col[i * 3 + 2] = this.col[last * 3 + 2];
    this.base[i * 3] = this.base[last * 3];
    this.base[i * 3 + 1] = this.base[last * 3 + 1];
    this.base[i * 3 + 2] = this.base[last * 3 + 2];
    this.vel[i * 2] = this.vel[last * 2];
    this.vel[i * 2 + 1] = this.vel[last * 2 + 1];
    this.life[i] = this.life[last];
    this.maxLife[i] = this.maxLife[last];
    this.dist[i] = this.dist[last];
    this.maxDist[i] = this.maxDist[last];
  }
  shift(dx, dy) {
    for (let i = 0; i < this.count; i++) {
      this.pos[i * 3] += dx;
      this.pos[i * 3 + 1] += dy;
    }
    this.attrPos.needsUpdate = true;
  }
  clear() {
    this.count = 0;
    this.geom.setDrawRange(0, 0);
  }
}
