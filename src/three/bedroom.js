/*
name: src/three/bedroom.js

This module creates a fully 3D, performant, stylized pink gamer-bedroom intended to be added
into an existing Three.js scene. It builds geometry procedurally, uses instancing for the plush
carpet tufts, sets up emissive neon with bloom (optional composer integrated), and exposes an API:

  const bedroom = await addBedroom(scene, camera, renderer, {quality:'high'});
  // on each frame
  bedroom.update(delta);

It returns an object: { group, update, composer (optional), dispose }

Notes:
- This file does not include heavy external textures; it generates lightweight canvas textures
  and uses instanced geometry for performance. Replace the canvas textures with KTX2 / compressed
  textures for higher quality in production.
- The neon UwU sign uses selective bloom via a simple composer created for you. If your app
  already uses an EffectComposer, extract and merge its passes with yours and add bedroom.bloomLayer
  to your rendering logic.
*/

import * as THREE from 'three';
import { InstancedMesh } from 'three';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export async function addBedroom(scene, camera, renderer, opts = {}) {
  const quality = opts.quality || 'balanced'; // 'low'|'balanced'|'high'
  const group = new THREE.Group();
  group.name = 'BedroomGroup';

  // Scales / counts based on quality
  const settings = {
    low: { tuftCount: 800, carpetResolution: 256, shadowMapSize: 1024 },
    balanced: { tuftCount: 1600, carpetResolution: 512, shadowMapSize: 2048 },
    high: { tuftCount: 3200, carpetResolution: 1024, shadowMapSize: 4096 }
  }[quality];

  // Shared colors
  const COLORS = {
    softPink: 0xffb6c1,
    pastelPurple: 0xe6c8f2,
    white: 0xffffff,
    neonPink: new THREE.Color(0xff6ea1)
  };

  // Enable nice shadows on renderer
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;

  // Room dimensions
  const ROOM = { w: 8, h: 3.2, d: 6 };

  // Utility: simple canvas texture generator for wallpaper/wood/sky
  function canvasTexture(drawFn, size = 1024) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    drawFn(ctx, size);
    const tex = new THREE.CanvasTexture(c);
    tex.encoding = THREE.sRGBEncoding;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }

  // Wallpaper: subtle diagonal stripes using soft pink/purple
  const wallpaperTex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#ffdfe8'; ctx.fillRect(0, 0, s, s);
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#f0d1f0';
    for (let i = -s; i < s * 2; i += 60) {
      ctx.fillRect(i, 0, 30, s);
    }
  }, 1024);
  wallpaperTex.repeat.set(ROOM.w / 2, ROOM.h / 1.5);

  // Floor wood texture (very subtle, desaturated)
  const floorTex = canvasTexture((ctx, s) => {
    ctx.fillStyle = '#fff6f8'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#ffeaf0';
    for (let i = 0; i < 6; i++) {
      const y = (i / 6) * s;
      ctx.fillRect(0, y, s, s / 12);
    }
  }, 512);
  floorTex.repeat.set(ROOM.d / 1.5, ROOM.w / 1.5);

  // Create walls
  const wallMat = new THREE.MeshStandardMaterial({
    map: wallpaperTex,
    color: 0xffeaf0,
    roughness: 0.9,
    metalness: 0
  });
  // back wall
  const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.h), wallMat);
  back.position.set(0, ROOM.h / 2, -ROOM.d / 2);
  group.add(back);
  // left wall
  const left = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-ROOM.w / 2, ROOM.h / 2, 0);
  group.add(left);
  // right wall
  const right = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.d, ROOM.h), wallMat);
  right.rotation.y = -Math.PI / 2;
  right.position.set(ROOM.w / 2, ROOM.h / 2, 0);
  group.add(right);
  // ceiling
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xfff7fb, roughness: 0.98 });
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, ROOM.h, 0);
  group.add(ceiling);

  // Floor
  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.w, ROOM.d), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);

  // Door (right wall, near back)
  (function addDoor() {
    const doorW = 0.9, doorH = 2.1;
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.06), new THREE.MeshStandardMaterial({ color: 0xffeef2, metalness: 0.05, roughness: 0.8 }));
    door.position.set(ROOM.w / 2 - doorW / 2 - 0.05, doorH / 2, -ROOM.d / 2 + 0.5);
    door.rotation.y = -Math.PI / 2;
    door.castShadow = true;
    group.add(door);
    // frame
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const frameGeom = new THREE.BoxGeometry(doorW + 0.1, doorH + 0.1, 0.08);
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.copy(door.position);
    frame.rotation.copy(door.rotation);
    frame.receiveShadow = true;
    group.add(frame);
  })();

  // Windows (back wall) - two windows
  const windowGroup = new THREE.Group();
  function createWindow(x) {
    const w = 1.2, h = 1.0;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.08, h + 0.08, 0.06), frameMat);
    frame.position.set(x, ROOM.h / 2, -ROOM.d / 2 + 0.01);
    frame.rotation.y = Math.PI;

    // glass with soft sky texture + emissive to simulate evening glow
    const skyTex = canvasTexture((ctx, s) => {
      const g = ctx.createLinearGradient(0, 0, 0, s);
      g.addColorStop(0, '#ffdff1');
      g.addColorStop(1, '#b7a8ff');
      ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
      // quick skyline silhouette
      ctx.fillStyle = 'rgba(20,12,30,0.5)';
      for (let i = 0; i < 6; i++) {
        const bw = Math.random() * 0.2 + 0.05;
        ctx.fillRect(i * (s / 6), s * 0.6 + Math.random() * s * 0.15, s * bw, s * 0.4);
      }
    }, 512);
    const glassMat = new THREE.MeshStandardMaterial({ map: skyTex, metalness: 0, roughness: 1, transparent: true, opacity: 0.95, emissive: 0xffdfea, emissiveIntensity: 0.02 });
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), glassMat);
    glass.position.copy(frame.position);
    glass.rotation.y = Math.PI;

    windowGroup.add(frame, glass);
  }
  createWindow(-1.6);
  createWindow(1.6);
  group.add(windowGroup);

  // Soft ambient lights
  const hemi = new THREE.HemisphereLight(0xffeaf4, 0x665577, 0.8);
  group.add(hemi);

  // Key directional light to simulate window sun/moon
  const key = new THREE.DirectionalLight(0xfff0f8, 0.6);
  key.position.set(-2, 3, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(settings.shadowMapSize, settings.shadowMapSize);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 10;
  group.add(key);

  // Gaming desk
  const desk = new THREE.Group();
  const deskW = 2.2, deskD = 0.8, deskH = 0.75;
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(deskW, 0.06, deskD), new THREE.MeshStandardMaterial({ color: 0xfff1f6, roughness: 0.6 }));
  deskTop.position.y = deskH;
  deskTop.castShadow = true; deskTop.receiveShadow = true;
  desk.add(deskTop);
  // legs
  const legMat = new THREE.MeshStandardMaterial({ color: 0xffe9ef, metalness: 0.2, roughness: 0.5 });
  const legGeom = new THREE.BoxGeometry(0.06, deskH, 0.06);
  const legPositions = [[-deskW / 2 + 0.08, deskH / 2, -deskD / 2 + 0.08], [deskW / 2 - 0.08, deskH / 2, -deskD / 2 + 0.08], [-deskW / 2 + 0.08, deskH / 2, deskD / 2 - 0.08], [deskW / 2 - 0.08, deskH / 2, deskD / 2 - 0.08]];
  legPositions.forEach(p => { const l = new THREE.Mesh(legGeom, legMat); l.position.set(p[0], p[1], p[2]); l.castShadow = true; desk.add(l); });

  // Position desk along back wall
  desk.position.set(0, 0, -ROOM.d / 2 + deskD / 2 + 0.15);
  group.add(desk);

  // Monitors (triple setup)
  const monitorGroup = new THREE.Group();
  const monitorMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2, metalness: 0.3 });
  const screenMatTemplate = new THREE.MeshBasicMaterial({ map: null, toneMapped: false });

  // small function to create a canvas screen showing a stylized wallpaper and subtle UI rectangles
  function createScreenTexture(w, h, accentColor = '#ff7fbf') {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    // gradient
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#ffcee8'); g.addColorStop(1, '#cdb2ff');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // some UI boxes
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 6; i++) ctx.fillRect(10 + i * 40, h - 60, 30, 18);
    // subtle glow shape
    ctx.fillStyle = accentColor; ctx.globalAlpha = 0.06; ctx.fillRect(w / 4, h / 4, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(c); tex.encoding = THREE.sRGBEncoding;
    return tex;
  }
  const screenTexMain = createScreenTexture(1024, 512, '#ff8bbf');
  const screenTexSide = createScreenTexture(512, 256, '#ffc0e6');

  const monitorCount = 3;
  for (let i = 0; i < monitorCount; i++) {
    const w = i === 1 ? 0.9 : 0.6;
    const h = i === 1 ? 0.55 : 0.4;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({map: i===1?screenTexMain:screenTexSide, toneMapped:false}));
    screen.position.set((i-1)*0.75, deskH + h/2 + 0.02, 0.28);
    screen.castShadow = false; screen.receiveShadow = false;
    monitorGroup.add(screen);
    // monitor rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(w+0.06, h+0.06, 0.06), monitorMat);
    rim.position.copy(screen.position);
    rim.position.z = screen.position.z - 0.05;
    rim.castShadow = true;
    monitorGroup.add(rim);
  }
  monitorGroup.position.z = desk.position.z + 0.08;
  group.add(monitorGroup);

  // RGB keyboard & mouse (stylized)
  (function addPeripherals() {
    const kb = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.02, 0.18), new THREE.MeshStandardMaterial({ color: 0x222, metalness: 0.1 }));
    kb.position.set(0, desk.position.y + deskH + 0.03, 0.38);
    kb.castShadow = true; group.add(kb);
    // tiny RGB keys via texture
    const keyTex = canvasTexture((ctx, s) => {
      ctx.fillStyle = '#000'; ctx.fillRect(0,0,s,s);
      for(let x=0;x<14;x++){
        for(let y=0;y<3;y++){
          ctx.fillStyle = `hsl(${(x*20 + y*40) % 360},80%,60%)`; ctx.fillRect(4 + x*(s/14), 4 + y*(s/5), s/18, s/8);
        }
      }
    }, 256);
    kb.material.map = keyTex; kb.material.needsUpdate = true;

    const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.07), new THREE.MeshStandardMaterial({ color: 0xff93bd, emissive: 0xff85b6, emissiveIntensity: 0.1 }));
    mouse.position.set(0.42, kb.position.y, 0.35); mouse.castShadow = true; group.add(mouse);
  })();

  // Gaming chair (stylized simple shape)
  (function addChair(){
    const chair = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.55), new THREE.MeshStandardMaterial({ color: 0xffcfdc, metalness: 0.05 }));
    seat.position.set(0, 0.5, 0.2);
    seat.castShadow = true; chair.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.12), new THREE.MeshStandardMaterial({ color: 0xffc0d9 }));
    back.position.set(0, 0.95, 0.0); back.castShadow = true; chair.add(back);
    // base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), new THREE.MeshStandardMaterial({ color:0x333333 }));
    base.position.set(0, 0.28, 0.2); base.rotation.x = Math.PI/2; chair.add(base);
    chair.position.set(0, 0, 1.1);
    chair.rotation.y = Math.PI;
    group.add(chair);
  })();

  // Fluffy carpet using Instanced tufts
  (function addCarpet(){
    const carpetGroup = new THREE.Group();
    const carpetRadiusX = 1.8, carpetRadiusZ = 1.4;
    // base plane colored
    const base = new THREE.Mesh(new THREE.PlaneGeometry(carpetRadiusX*2, carpetRadiusZ*2, 1,1), new THREE.MeshStandardMaterial({color: COLORS.softPink, roughness: 0.95}));
    base.rotation.x = -Math.PI/2; base.position.y = 0.01; base.receiveShadow = true; carpetGroup.add(base);

    // tuft geometry (low poly cone)
    const tuftGeom = new THREE.ConeGeometry(0.025, 0.08, 6);
    tuftGeom.translate(0, -0.04, 0); // pivot at base
    const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffc1d6, roughness: 0.9, metalness: 0 });

    const tufts = new THREE.InstancedMesh(tuftGeom, tuftMat, settings.tuftCount);
    tufts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    let i = 0;
    const dummy = new THREE.Object3D();
    for (let xi = 0; xi < Math.sqrt(settings.tuftCount); xi++){
      for (let zi = 0; zi < Math.sqrt(settings.tuftCount); zi++){
        if (i >= settings.tuftCount) break;
        const x = (xi / Math.sqrt(settings.tuftCount) - 0.5) * carpetRadiusX*2 + (Math.random()-0.5)*0.02;
        const z = (zi / Math.sqrt(settings.tuftCount) - 0.5) * carpetRadiusZ*2 + (Math.random()-0.5)*0.02;
        const s = 0.6 + Math.random()*0.8;
        dummy.position.set(x, 0.04 + Math.random()*0.02, z);
        dummy.scale.setScalar(s);
        dummy.rotation.x = (Math.random()-0.5)*0.4;
        dummy.rotation.z = (Math.random()-0.5)*0.4;
        dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
        i++;
      }
    }
    tufts.castShadow = true; carpetGroup.add(tufts);

    carpetGroup.position.set(0, 0.01, 0.3);
    group.add(carpetGroup);
  })();

  // Shelves, plushies and small decor
  (function addDecor(){
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.06, 0.18), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    shelf.position.set(-ROOM.w/2 + 0.2 + 0.8, ROOM.h - 0.5, -ROOM.d/2 + 0.4);
    shelf.castShadow = true; group.add(shelf);
    // plushie (simple stylized cat)
    const plush = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 12), new THREE.MeshStandardMaterial({ color: 0xffc6dc, roughness: 0.85 }));
    plush.position.set(shelf.position.x - 0.4, shelf.position.y - 0.12, shelf.position.z);
    plush.castShadow = true; group.add(plush);
    const earL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.08, 6), new THREE.MeshStandardMaterial({color:0xff8fb8})); earL.position.set(plush.position.x-0.05, plush.position.y+0.09, plush.position.z-0.03); earL.rotation.x = Math.PI; group.add(earL);
    const earR = earL.clone(); earR.position.x = plush.position.x + 0.05; group.add(earR);

    // small plant
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06,0.06,0.08,12), new THREE.MeshStandardMaterial({color:0xffffff}));
    pot.position.set(shelf.position.x + 0.5, shelf.position.y - 0.06, shelf.position.z);
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({color:0x9fe6a9})); leaf.position.set(pot.position.x, pot.position.y+0.05, pot.position.z); group.add(pot, leaf);

    // wall posters (simple planes with stylized art)
    const posterTex = canvasTexture((ctx,s)=>{
      ctx.fillStyle = '#ffdff5'; ctx.fillRect(0,0,s,s);
      ctx.fillStyle = '#eaa4e6'; ctx.fillRect(20,20,s-40,s-40);
    },512);
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(0.5,0.7), new THREE.MeshStandardMaterial({map:posterTex}));
    poster.position.set(-1.8, 1.6, -ROOM.d/2 + 0.02); poster.rotation.y = Math.PI; group.add(poster);
  })();

  // Neon UwU sign (text geometry) + glow sprite
  let bloomLayer = new THREE.Layers();
  bloomLayer.set(1); // we'll put bright emissive stuff on layer 1
  let composer = null;
  (async function addNeon(){
    // load a lightweight font from three's included fonts if available or fallback
    const fontLoader = new FontLoader();
    const font = await new Promise((resolve) => {
      fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', resolve, null, () => resolve(null));
    });
    const textGeom = font ? new TextGeometry('UwU', { font, size: 0.28, height: 0.04, curveSegments: 8 }) : new THREE.TextGeometry('UwU', { size:0.28, height:0.04, curveSegments:8 });
    textGeom.center();
    const neonMat = new THREE.MeshBasicMaterial({ color: COLORS.neonPink, toneMapped: false });
    const neonMesh = new THREE.Mesh(textGeom, neonMat);
    neonMesh.position.set(0, 1.6, -ROOM.d/2 + 0.06);
    neonMesh.layers.enable(1);
    group.add(neonMesh);

    // add a soft point light to slightly illuminate nearby walls
    const p = new THREE.PointLight(COLORS.neonPink.getHex(), 0.8, 2.5, 2);
    p.position.copy(neonMesh.position).add(new THREE.Vector3(0, 0, 0.05));
    p.layers.enable(1);
    group.add(p);

    // small glow sprite (billboard) behind the neon to produce soft halo
    const spriteTex = canvasTexture((ctx,s)=>{
      const g = ctx.createRadialGradient(s/2, s/2, 0, s/2, s/2, s/1.6);
      g.addColorStop(0, 'rgba(255,110,161,0.55)'); g.addColorStop(1,'rgba(255,110,161,0)');
      ctx.fillStyle = g; ctx.fillRect(0,0,s,s);
    }, 256);
    const spriteMat = new THREE.SpriteMaterial({ map: spriteTex, color: 0xffffff, transparent: true, toneMapped: false });
    const sprite = new THREE.Sprite(spriteMat); sprite.scale.set(1.6, 0.6, 1); sprite.position.copy(neonMesh.position).add(new THREE.Vector3(0, 0, 0.02));
    sprite.layers.enable(1);
    group.add(sprite);

    // Setup simple composer for bloom if renderer provided
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.9, 0.6, 0.85);
    bloomPass.threshold = 0.1; bloomPass.strength = 1.2; bloomPass.radius = 0.4;
    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
  })();

  // Place Luna anchor point at center of room so character sits naturally
  const anchor = new THREE.Object3D(); anchor.position.set(0, 0, 0.5); group.add(anchor);

  // Add final touches: small ambient occlusion fake and overall warm fill
  const fill = new THREE.AmbientLight(0xffe8f2, 0.18); group.add(fill);

  // Shadows config for group children
  group.traverse((o) => { if (o.isMesh) { o.castShadow = o.castShadow !== false; o.receiveShadow = o.receiveShadow !== false; } });

  // Add to scene
  scene.add(group);

  // Parallax behavior for window skyline: slight movement depending on camera
  const skyline = windowGroup.children.find(c => c.isMesh && c.geometry.type === 'PlaneGeometry');

  // update function
  let time = 0;
  function update(dt) {
    time += dt;
    // small breathing animation: monitors subtle bob
    monitorGroup.position.y = 0.02 * Math.sin(time * 0.6);

    // parallax: move skyline slightly based on camera rotation (screen-space)
    if (camera) {
      const targetOffset = (camera.position.x / 10);
      windowGroup.position.x += (targetOffset - windowGroup.position.x) * 0.05;
    }

    // if composer exists, we should render with it (the module can own rendering or let user integrate)
    // We'll not call composer.render here to avoid double-rendering if user integrates elsewhere.
  }

  // Provide a disposable helper
  function dispose() {
    group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m=>m.dispose()); else o.material.dispose();
      }
      if (o.texture) o.texture.dispose();
    });
    if (composer) composer.dispose();
    scene.remove(group);
  }

  return { group, anchor, update, dispose, composer, bloomLayer };
}
