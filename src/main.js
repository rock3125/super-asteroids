import * as THREE from 'three';
import { createGfx } from './gfx.js';
import { AudioEngine } from './audio.js';
import { World } from './world.js';
import { Spawner } from './spawner.js';

const gfx = createGfx();
const audio = new AudioEngine();
const world = new World(gfx, audio);
const spawner = new Spawner();

const hudScore = document.getElementById('score');
const hudLives = document.getElementById('lives');
const hudLevel = document.getElementById('level');
const hudPower = document.getElementById('power');
const overlay = document.getElementById('overlay');
const gameover = document.getElementById('gameover');
const finalScore = document.getElementById('final');
const paused = document.getElementById('paused');

const input = { turn: 0, thrust: false, fire: false };

function setKey(key, down) {
  if (key === 'ArrowLeft' || key === 'a' || key === 'A') input.turn += down ? -1 : 1;
  else if (key === 'ArrowRight' || key === 'd' || key === 'D') input.turn += down ? 1 : -1;
  else if (key === 'ArrowDown' || key === 's' || key === 'S') input.thrust = down;
  else if (key === ' ' || key === 'ArrowUp' || key === 'w' || key === 'W') input.fire = down;
  input.turn = Math.max(-1, Math.min(1, input.turn));
}

window.addEventListener('keydown', (e) => {
  if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault();
  if (e.repeat) return;
  if (e.key === 'Enter') startOrRestart();
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
  setKey(e.key, true);
});
window.addEventListener('keyup', (e) => setKey(e.key, false));
window.addEventListener('pointerdown', () => startOrRestart());

function startOrRestart() {
  if (world.phase === 'menu') {
    audio.init();
    overlay.style.display = 'none';
    world.start();
  } else if (world.phase === 'over') {
    world.reset();
    spawner.reset();
    overShown = false;
    gameover.style.display = 'none';
    world.start();
  }
}

function togglePause() {
  if (world.phase === 'playing') {
    world.phase = 'paused';
    paused.style.display = 'flex';
  } else if (world.phase === 'paused') {
    world.phase = 'playing';
    paused.style.display = 'none';
  }
}

const POWER_LABELS = { laser: 'LASER', shield: 'SHIELD', multishot: 'MULTISHOT' };
const POWER_COLORS = { laser: '#ffe14d', shield: '#53ffd0', multishot: '#ff9a3c' };

function updateHud() {
  hudScore.textContent = `SCORE ${world.score}`;
  hudLives.textContent = `SHIPS ${'▲'.repeat(Math.max(0, world.lives))}`;
  hudLevel.textContent = `WAVE ${world.level}`;
  const up = world.activeUpgrade;
  if (world.startShield > 0) {
    hudPower.style.display = '';
    hudPower.textContent = `SHIELD ${Math.ceil(world.startShield)}`;
    hudPower.style.color = POWER_COLORS.shield;
  } else if (up) {
    hudPower.style.display = '';
    hudPower.textContent = `${POWER_LABELS[up.type]} ${Math.ceil(up.timer)}`;
    hudPower.style.color = POWER_COLORS[up.type];
  } else {
    hudPower.style.display = 'none';
  }
}

const clock = new THREE.Clock();
let overShown = false;
let overTime = 0;

function backToMenu() {
  world.reset();
  spawner.reset();
  overShown = false;
  overTime = 0;
  gameover.style.display = 'none';
  overlay.style.display = 'flex';
}

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  gfx.title.group.visible = world.phase === 'menu';
  if (world.phase === 'playing') {
    world.update(dt, input);
    spawner.update(dt, world);
    audio.setEngine(
      world.player.alive ? Math.min(world.player.vel.length(), 500) : 0,
      world.player.thrust
    );
    audio.setSaucer(world.saucers.length > 0);
    updateHud();
  } else if (world.phase === 'menu') {
    world.updateAmbient(dt);
    spawner.update(dt, world);
    audio.setSaucer(world.saucers.length > 0);
    updateHud();
  } else if (world.phase === 'over') {
    if (!overShown) {
      overShown = true;
      overTime = 0;
      finalScore.textContent = `FINAL SCORE ${world.score}`;
      gameover.style.display = 'flex';
    }
    overTime += dt;
    if (overTime >= 10) backToMenu();
    audio.setEngine(0, 0);
    audio.setSaucer(false);
  }
  gfx.render(dt);
}

frame();
