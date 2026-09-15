import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CombatGradeShader, ScreenFx } from './screenFx.js';
import { ARENA_ENVS } from './environments.js';
import {
  addBackdropFadeY,
  bindBackdropAbyssFade,
  tintBackdropAbyss,
  tickBackdropAbyss,
  createAbyssLayer,
} from './abyss.js';
import { tickVfx } from './vfx/clock.js';
import { createAmbient } from './vfx/ambient.js';
import { CFG } from '../config.js';

const BACKDROP_TEX_KEYS = [
  'backdrop', 'backdrop_dusk', 'backdrop_ashen',
  'backdrop_void', 'backdrop_threshold', 'backdrop_abyss',
];

function prepBackdropTex(tex) {
  if (!tex) return null;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  // 只取画面上半段天空带，底部黑色山峦留给雾
  tex.repeat.set(1, 0.55);
  tex.offset.set(0, 0.34);
  return tex;
}

export function createWorld(container, assets) {
  const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05030c);
  scene.fog = new THREE.FogExp2(0x0a0616, 0.017);

  // ---- 相机（camPos 供动画驱动，shake 独立叠加）----
  const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 200);
  const camPos = { x: 0, y: 13.55, z: 12.35 };
  const camTarget = new THREE.Vector3(0, 0.98, -0.15);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);

  // ---- 灯光 ----
  const hemi = new THREE.HemisphereLight(0x4a5590, 0x140b18, 0.85);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xffe2b8, 2.3);
  key.position.set(6, 15, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -11; key.shadow.camera.right = 11;
  key.shadow.camera.top = 11; key.shadow.camera.bottom = -11;
  key.shadow.camera.far = 40;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x5a7bff, 1.5);
  rim.position.set(-8, 9, -11);
  scene.add(rim);

  const braziers = [];
  const BX = CFG.layout.brazier.x;
  const BZ = CFG.layout.brazier.z;
  const BY = CFG.layout.brazier.bowlY;
  for (const sx of [-1, 1]) {
    const p = new THREE.PointLight(0xff8438, 18, 14, 1.8);
    p.position.set(sx * BX, BY + 1.15, BZ);
    p.userData.base = 18;
    scene.add(p);
    braziers.push(p);
  }

  // ---- 竞技场台面 ----
  const arenaMatTop = new THREE.MeshStandardMaterial({
    map: assets.tex.arena, roughness: 0.82, metalness: 0.18,
  });
  const arenaMatSide = new THREE.MeshStandardMaterial({ color: 0x120d1e, roughness: 0.95 });
  const arena = new THREE.Mesh(
    new THREE.CylinderGeometry(9.4, 10.1, 0.7, 72),
    [arenaMatSide, arenaMatTop, arenaMatSide],
  );
  arena.position.y = -0.351;
  arena.receiveShadow = true;
  scene.add(arena);

  // 外缘符文脉冲细环（点缀，不与台面纹理抢戏）
  const runeRing = new THREE.Mesh(
    new THREE.RingGeometry(5.72, 5.96, 96),
    new THREE.MeshBasicMaterial({
      color: 0x3fe8ff, transparent: true, opacity: 0.08,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  runeRing.rotation.x = -Math.PI / 2;
  runeRing.position.y = 0.02;
  scene.add(runeRing);

  const lane = new THREE.Mesh(
    new THREE.PlaneGeometry(13.4, 2.55),
    new THREE.MeshBasicMaterial({
      color: 0x3fe8ff, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    }),
  );
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0.03, 1.95);
  lane.visible = false;
  scene.add(lane);

  // ---- 远景背景板（按阶段换图；帷幕盖住时切换，避免穿帮）----
  BACKDROP_TEX_KEYS.forEach((key) => prepBackdropTex(assets.tex[key]));
  let backdropMesh = null;
  {
    const startTex = assets.tex.backdrop_dusk || assets.tex.backdrop;
    if (startTex) {
      backdropMesh = new THREE.Mesh(
        addBackdropFadeY(new THREE.PlaneGeometry(96, 34)),
        new THREE.MeshBasicMaterial({ map: startTex, fog: false, depthWrite: false }),
      );
      backdropMesh.material.color.setRGB(0.98, 0.95, 0.9);
      backdropMesh.position.set(0, 4.6, -17.2);
      backdropMesh.rotation.x = -0.2;
      backdropMesh.renderOrder = -10;
      bindBackdropAbyssFade(backdropMesh, ARENA_ENVS.dusk);
      scene.add(backdropMesh);
    }
  }

  // ---- 星空 ----
  {
    const n = 420;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 46 + Math.random() * 40;
      const a = Math.random() * Math.PI * 2;
      const y = 6 + Math.random() * 42;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r - 12;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(g, new THREE.PointsMaterial({
      map: assets.glowTex, color: 0xbfd0ff, size: 0.7, transparent: true, opacity: 0.75,
      blending: THREE.AdditiveBlending, depthWrite: false, fog: false, sizeAttenuation: true,
    }));
    scene.add(stars);
  }

  // ---- 漂浮岩石 ----
  const rocks = [];
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x241b36, roughness: 1, metalness: 0 });
  {
    for (let i = 0; i < 10; i++) {
      const size = 0.6 + Math.random() * 1.9;
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 0), rockMat);
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const r = 14 + Math.random() * 11;
      rock.position.set(Math.cos(a) * r, 0.6 + Math.random() * 5.5, Math.sin(a) * r - 4);
      rock.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      rock.userData = {
        baseY: rock.position.y,
        spinX: (Math.random() - 0.5) * 0.12,
        spinY: (Math.random() - 0.5) * 0.2,
        bobA: Math.random() * Math.PI * 2,
        bobS: 0.35 + Math.random() * 0.5,
      };
      scene.add(rock);
      rocks.push(rock);
    }
  }

  // ---- 环境余烬粒子 ----
  let embers;
  {
    const n = 150;
    const pos = new Float32Array(n * 3);
    const vel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 19;
      pos[i * 3 + 1] = Math.random() * 7;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 17 - 1;
      vel[i] = 0.18 + Math.random() * 0.5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    embers = new THREE.Points(g, new THREE.PointsMaterial({
      map: assets.glowTex, color: 0xffa04d, size: 0.16, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    embers.userData.vel = vel;
    scene.add(embers);
  }

  const abyss = createAbyssLayer(scene, assets);
  const ambient = createAmbient(scene, assets);

  const iron = new THREE.MeshStandardMaterial({ color: 0x3a2d42, roughness: 0.42, metalness: 0.55 });
  const bronze = new THREE.MeshStandardMaterial({
    color: 0xb07a38, roughness: 0.28, metalness: 0.72, emissive: 0x3a2208, emissiveIntensity: 0.35,
  });
  for (const sx of [-1, 1]) {
    const x = sx * BX;
    const stand = new THREE.Group();
    stand.position.set(x, 0, BZ);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.64, 0.2, 10), iron);
    base.position.y = 0.1;
    base.castShadow = true;
    stand.add(base);

    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.32, 0.72, 8), iron);
    column.position.y = 0.56;
    column.castShadow = true;
    stand.add(column);

    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.02, 0.42, 0.36, 16), bronze);
    bowl.position.y = BY - 0.1;
    bowl.castShadow = true;
    stand.add(bowl);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.08, 8, 28), bronze);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = BY;
    stand.add(rim);

    const coal = new THREE.Mesh(
      new THREE.CircleGeometry(0.62, 16),
      new THREE.MeshBasicMaterial({
        color: 0xff5a18, transparent: true, opacity: 0.7,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    coal.rotation.x = -Math.PI / 2;
    coal.position.y = BY - 0.02;
    stand.add(coal);

    const heart = new THREE.Sprite(new THREE.SpriteMaterial({
      map: assets.glowTex, color: 0xff7a28, transparent: true, opacity: 0.48,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    heart.position.y = BY + 0.1;
    heart.scale.setScalar(0.38);
    stand.add(heart);
    scene.add(stand);
  }

  // ---- 后期合成 ----
  const rt = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.4, 0.52, 0.88);
  composer.addPass(bloom);
  const grade = new ShaderPass(CombatGradeShader);
  composer.addPass(grade);
  composer.addPass(new OutputPass());

  const screenFx = new ScreenFx({
    grade, bloom, camera,
    bleedEl: document.getElementById('fxBleed'),
  });

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // ---- 震屏 / 视差 / 台面受击脉冲 ----
  const pointerTarget = { x: 0, y: 0 };
  const pointerCur = { x: 0, y: 0 };
  let arenaPulse = 0;

  function setEnvironment(id) {
    const env = ARENA_ENVS[id] || ARENA_ENVS.dusk;
    const tex = assets.tex[env.backdrop] || assets.tex.backdrop;
    if (backdropMesh && tex) {
      backdropMesh.material.map = tex;
      backdropMesh.material.color.setRGB(env.bdTint[0], env.bdTint[1], env.bdTint[2]);
      backdropMesh.material.needsUpdate = true;
    }
    scene.background.setHex(env.bg);
    tintBackdropAbyss(backdropMesh, env);
    abyss.applyEnv(env);
    if (scene.fog) {
      scene.fog.color.setHex(env.fog);
      scene.fog.density = env.fogDen;
    }
    hemi.color.setHex(env.hemiSky);
    hemi.groundColor.setHex(env.hemiGround);
    hemi.intensity = env.hemiInt;
    key.color.setHex(env.key);
    key.intensity = env.keyInt;
    rim.color.setHex(env.rim);
    rim.intensity = env.rimInt;
    for (const p of braziers) {
      p.color.setHex(env.brazier);
      p.userData.base = env.brazierBase;
    }
    if (embers?.material) embers.material.color.setHex(env.ember);
    ambient.applyEnv(env);
    runeRing.material.color.setHex(env.rune);
    lane.material.color.setHex(env.rune);
    rockMat.color.setHex(env.rock);
    arenaMatSide.color.setHex(env.bg);
    if (screenFx) {
      screenFx.base.vignette = env.vignette;
      screenFx.base.sat = env.sat;
      screenFx.base.grain = env.grain ?? 0.028;
      screenFx.base.temperature = env.temp ?? 0.06;
      screenFx.u.uVignette.value = env.vignette;
      screenFx.u.uSat.value = env.sat;
      screenFx.u.uLift.value = env.lift;
      screenFx.u.uGrain.value = screenFx.base.grain;
      screenFx.u.uTemperature.value = screenFx.base.temperature;
    }
    if (world) world.envId = env.id;
    return env.id;
  }

  const world = {
    renderer, scene, camera, composer, bloom, grade, camPos, camTarget, screenFx,
    time: 0,
    envId: 'dusk',
    _laneOn: false,
    setEnvironment,
    shake(m, opts) { screenFx.shake(m, opts); },
    pulseArena(s) { arenaPulse = Math.max(arenaPulse, s); },
    setPointer(nx, ny) { pointerTarget.x = nx; pointerTarget.y = ny; },
    setPlayLane(on) {
      world._laneOn = !!on;
      lane.visible = !!on;
      if (!on) lane.material.opacity = 0;
    },
    update(dt) {
      world.time += dt;
      const t = world.time;
      tickVfx(t);
      screenFx.update(dt);
      tickBackdropAbyss(backdropMesh, t);
      abyss.update(dt, t);
      ambient.update(dt, t, arenaPulse);

      pointerCur.x += (pointerTarget.x - pointerCur.x) * Math.min(1, dt * 3.2);
      pointerCur.y += (pointerTarget.y - pointerCur.y) * Math.min(1, dt * 3.2);
      screenFx.applyCamera(camPos, pointerCur, camTarget);

      arenaPulse *= Math.pow(0.012, dt);
      runeRing.material.opacity = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(t * 1.35)) + arenaPulse * 0.42;
      runeRing.rotation.z = t * 0.05;
      if (world._laneOn) {
        lane.material.opacity = 0.11 + 0.035 * Math.sin(t * 3.2) + arenaPulse * 0.16;
      } else {
        lane.material.opacity = 0;
      }

      // 火光闪烁
      for (let i = 0; i < braziers.length; i++) {
        const p = braziers[i];
        p.intensity = p.userData.base * (0.8 + 0.2 * Math.sin(t * 9 + i * 7) * Math.sin(t * 5.3 + i * 3));
      }

      // 岩石漂浮
      for (const r of rocks) {
        const u = r.userData;
        r.rotation.x += u.spinX * dt;
        r.rotation.y += u.spinY * dt;
        r.position.y = u.baseY + Math.sin(t * u.bobS + u.bobA) * 0.4;
      }

      // 余烬上升
      {
        const p = embers.geometry.attributes.position;
        const vel = embers.userData.vel;
        for (let i = 0; i < vel.length; i++) {
          let y = p.getY(i) + vel[i] * dt;
          if (y > 7.5) y = 0;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.12);
        }
        p.needsUpdate = true;
      }

    },
    render() { composer.render(); },
  };

  setEnvironment('dusk');
  return world;
}
