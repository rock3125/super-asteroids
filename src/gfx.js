import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VIEW_HALF_HEIGHT } from './config.js';

export function createGfx() {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -80, 80);
  camera.position.z = 10;

  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const starfield = createStarfield();
  scene.add(starfield.group);

  const title = createTitle();
  scene.add(title.group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight), 0.85, 0.5, 0
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let shake = 0;
  let aspect = window.innerWidth / window.innerHeight;

  function applyAspect() {
    const halfW = VIEW_HALF_HEIGHT * aspect;
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = VIEW_HALF_HEIGHT;
    camera.bottom = -VIEW_HALF_HEIGHT;
    camera.updateProjectionMatrix();
    title.fit(halfW);
  }
  applyAspect();

  const gfx = {
    renderer,
    scene,
    camera,
    worldGroup,
    composer,
    bloom,
    title,
    addShake(m) {
      shake = Math.min(shake + m, 42);
    },
    viewportRadius() {
      return Math.hypot(VIEW_HALF_HEIGHT * aspect, VIEW_HALF_HEIGHT);
    },
    resize() {
      aspect = window.innerWidth / window.innerHeight;
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
      applyAspect();
    },
    render(dt) {
      shake *= Math.exp(-dt * 5.5);
      camera.position.x = (Math.random() * 2 - 1) * shake;
      camera.position.y = (Math.random() * 2 - 1) * shake;
      starfield.update(dt, -worldGroup.position.x, -worldGroup.position.y);
      title.update(dt);
      composer.render();
    },
  };

  window.addEventListener('resize', gfx.resize);
  return gfx;
}

function createStarfield() {
  const group = new THREE.Group();
  group.position.z = -5;
  const layers = [
    { count: 220, size: 2, speed: 1.5, min: 0.12, parallax: 0.1 },
    { count: 70, size: 3.4, speed: 2.4, min: 0.18, parallax: 0.28 },
  ];
  const halfExtent = VIEW_HALF_HEIGHT * 6;
  const extent = halfExtent * 2;
  const state = [];
  for (const layer of layers) {
    const pos = new Float32Array(layer.count * 3);
    const col = new Float32Array(layer.count * 3);
    const base = new Float32Array(layer.count * 3);
    const bx = new Float32Array(layer.count);
    const by = new Float32Array(layer.count);
    const phase = new Float32Array(layer.count);
    const speed = new Float32Array(layer.count);
    const max = new Float32Array(layer.count);
    for (let i = 0; i < layer.count; i++) {
      bx[i] = (Math.random() * 2 - 1) * halfExtent;
      by[i] = (Math.random() * 2 - 1) * halfExtent;
      pos[i * 3] = bx[i];
      pos[i * 3 + 1] = by[i];
      pos[i * 3 + 2] = 0;
      phase[i] = Math.random() * Math.PI * 2;
      speed[i] = layer.speed * (0.4 + Math.random() * 1.6);
      max[i] = 0.45 + Math.random() * 0.55;
      const warm = Math.random() < 0.22;
      const r = warm ? 1 : 0.75 + Math.random() * 0.25;
      const g = warm ? 0.85 + Math.random() * 0.15 : 0.8 + Math.random() * 0.2;
      const b = warm ? 0.6 + Math.random() * 0.2 : 1;
      base[i * 3] = r;
      base[i * 3 + 1] = g;
      base[i * 3 + 2] = b;
      col[i * 3] = r;
      col[i * 3 + 1] = g;
      col[i * 3 + 2] = b;
    }
    const geom = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    const colAttr = new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage);
    geom.setAttribute('position', posAttr);
    geom.setAttribute('color', colAttr);
    const mat = new THREE.PointsMaterial({
      size: layer.size,
      vertexColors: true,
      sizeAttenuation: false,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const points = new THREE.Points(geom, mat);
    points.frustumCulled = false;
    group.add(points);
    state.push({
      count: layer.count,
      posAttr,
      colAttr,
      bx,
      by,
      base,
      phase,
      speed,
      max,
      min: layer.min,
      parallax: layer.parallax,
    });
  }
  let time = 0;
  return {
    group,
    update(dt, px, py) {
      time += dt;
      for (const s of state) {
        const a = s.posAttr.array;
        const c = s.colAttr.array;
        const ox = px * s.parallax;
        const oy = py * s.parallax;
        for (let i = 0; i < s.count; i++) {
          let x = s.bx[i] - ox;
          let y = s.by[i] - oy;
          x = ((x + halfExtent) % extent + extent) % extent - halfExtent;
          y = ((y + halfExtent) % extent + extent) % extent - halfExtent;
          a[i * 3] = x;
          a[i * 3 + 1] = y;
          const tw = Math.pow(0.5 + 0.5 * Math.sin(time * s.speed[i] + s.phase[i]), 3);
          const v = s.min + s.max[i] * tw;
          c[i * 3] = s.base[i * 3] * v;
          c[i * 3 + 1] = s.base[i * 3 + 1] * v;
          c[i * 3 + 2] = s.base[i * 3 + 2] * v;
        }
        s.posAttr.needsUpdate = true;
        s.colAttr.needsUpdate = true;
      }
    },
  };
}

const TITLE_FONT = {
  S: ['.XXX.', 'X...X', 'X....', '.XXX.', '....X', 'X...X', '.XXX.'],
  U: ['X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  P: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X....', 'X....', 'X....'],
  E: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'XXXXX'],
  R: ['XXXX.', 'X...X', 'X...X', 'XXXX.', 'X.X..', 'X..X.', 'X...X'],
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  T: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', '..X..'],
  O: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', '.XXX.'],
  I: ['XXXXX', '..X..', '..X..', '..X..', '..X..', '..X..', 'XXXXX'],
  D: ['XXXX.', 'X...X', 'X...X', 'X...X', 'X...X', 'X...X', 'XXXX.'],
};

function createTitle() {
  const group = new THREE.Group();
  const CELL = 13;
  const DEPTH = 10;
  const GAP = 6;
  const cells = [];
  let cx = 0;
  for (const ch of 'SUPER ASTEROIDS') {
    if (ch === ' ') {
      cx += 3;
      continue;
    }
    const glyph = TITLE_FONT[ch];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (glyph[r][c] === 'X') cells.push([cx + c, r]);
      }
    }
    cx += GAP;
  }
  const boxGeom = new THREE.BoxGeometry(CELL, CELL, DEPTH);
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0x0d2b3d,
    transparent: true,
    opacity: 0.85,
  });
  const boxes = new THREE.InstancedMesh(boxGeom, faceMat, cells.length);
  const m = new THREE.Matrix4();
  const maxX = cells.reduce((mx, [x]) => Math.max(mx, x), 0);
  const width = (maxX + 1) * CELL;
  const ox = -(maxX * CELL) / 2;
  cells.forEach(([x, y], i) => {
    m.makeTranslation(x * CELL + ox, (3.5 - y) * CELL, 0);
    boxes.setMatrixAt(i, m);
  });
  boxes.instanceMatrix.needsUpdate = true;
  boxes.frustumCulled = false;
  group.add(boxes);
  const c = CELL / 2;
  const d = DEPTH / 2;
  const corners = [
    [-c, -c, -d], [c, -c, -d], [c, c, -d], [-c, c, -d],
    [-c, -c, d], [c, -c, d], [c, c, d], [-c, c, d],
  ];
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const edgePos = new Float32Array(cells.length * 12 * 2 * 3);
  let e = 0;
  cells.forEach(([x, y]) => {
    const tx = x * CELL + ox;
    const ty = (3.5 - y) * CELL;
    for (const [p, q] of edges) {
      for (const v of [corners[p], corners[q]]) {
        edgePos[e++] = v[0] + tx;
        edgePos[e++] = v[1] + ty;
        edgePos[e++] = v[2];
      }
    }
  });
  const edgeGeom = new THREE.BufferGeometry();
  edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));
  const edgeMat = new THREE.LineBasicMaterial({
    color: 0x7ef9ff,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const edgesMesh = new THREE.LineSegments(edgeGeom, edgeMat);
  edgesMesh.frustumCulled = false;
  group.add(edgesMesh);
  group.position.set(0, 150, 0);
  group.rotation.x = -0.42;
  let scale = 1;
  let time = 0;
  return {
    group,
    fit(halfW) {
      const width = (cells[Math.max(0, cells.length - 1)][0] + 1) * CELL;
      scale = Math.min(1, (halfW * 1.7) / width);
      group.scale.setScalar(scale);
    },
    update(dt) {
      time += dt;
      group.rotation.y = Math.sin(time * 0.3) * 0.06;
      group.position.y = 150 + Math.sin(time * 0.5) * 8;
    },
  };
}

export function vec3(x, y) {
  return new THREE.Vector3(x, y, 0);
}

export function makeLineLoop(points, color) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.LineLoop(geom, mat);
}

export function makeLine(points, color) {
  const geom = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  return new THREE.Line(geom, mat);
}
