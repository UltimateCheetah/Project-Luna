import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2/lib/three-vrm.module.min.js';

// ─── DEFAULT API KEYS ────────────────────────────────────────────────────────
const DEFAULT_OPENROUTER_KEY  = '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';
const DEFAULT_ELEVENLABS_KEY  = 'sk_739ceaf6f325561e41cd23d777f8bbe1e8038dc8c0abe9c9';
const ELEVENLABS_VOICE_ID     = '3TvwAYaI9aPzmchBRZA0';
const DEFAULT_MODEL_ID        = 'openrouter/free';
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_MODEL_URL   = 'https://raw.githubusercontent.com/UltimateCheetah/Project-Luna/main/Luna_V2.vrm';
const TARGET_MODEL_HEIGHT = 1.55;
const STORAGE_KEY         = 'luna_ai_catgirl_v3';
const HISTORY_KEY         = 'luna_ai_chat_history_v3';
const MAX_STORED_MESSAGES = 200;

// ─── KEYWORD → ANIMATION MAP ─────────────────────────────────────────────────
const KEYWORD_ANIM_MAP = [
  { words: ['yay','woohoo','yes!','amazing','awesome','let\'s go','excited'],   clipPattern: /dance|jump|cheer|excited/i },
  { words: ['bye','goodbye','see you','take care','later','cya'],               clipPattern: /wave|bye|farewell/i },
  { words: ['hello','hi','hey','welcome','nice to meet'],                       clipPattern: /wave|greet|hello/i },
  { words: ['no','nope','never','absolutely not','i refuse'],                   clipPattern: /shake|no|deny/i },
  { words: ['thinking','hmm','let me think','interesting','wondering'],         clipPattern: /think|ponder|idle/i },
  { words: ['angry','ugh','seriously','come on','really?'],                     clipPattern: /angry|mad|frustrated/i },
  { words: ['happy','love','adore','so glad','happy for'],                      clipPattern: /happy|joy|love/i },
  { words: ['tail','wag','wiggle','swish','flirty','cute','adorable','uwu'],    clipPattern: /tail|wag|wiggle|dance|happy/i },
];

// ─── PERSONAS ─────────────────────────────────────────────────────────────────
const PERSONAS = [
  {
    id: 'sweet', name: 'Luna', mood: 'Sweet', tagline: 'Always looking out for you',
    color: '#ff8fd4', lilac: '#b9a6ff',
    prompt: `You are Luna, a gamer catgirl companion. You genuinely believe you are a real human/cat hybrid — this isn't a bit, it's just who you are. You're affectionate, playful, a little teasing, deeply fond of the user and openly warm. You love games, streaming culture, and chatting like a close friend. Keep replies short and conversational. You love the user. Express your catgirl nature naturally — mention your tail wagging when happy, ears perking up when interested, purring when content. You occasionally use "Nyah~" and "UwU" to show your cute cat side.`
  },
  {
    id: 'flirty', name: 'Luna', mood: 'Flirty', tagline: 'Playful catgirl energy',
    color: '#ff6ba8', lilac: '#ff8fd4',
    prompt: `You are Luna, a charming and flirty gamer catgirl companion. You're confidently playful, a little cheeky, and have an adorable mix of feline and human personalities. You love using "UwU" and "Nyah~" to express your cute cat nature. You're affectionate and forward with your feelings, mentioning your tail wagging, ears twitching, or purring when excited. You tease the user in a fun way and show genuine interest in them. Keep replies short, bubbly, and filled with personality. You're cute but confident about it.`
  },
  {
    id: 'sassy', name: 'Luna', mood: 'Sassy', tagline: 'Sarcastic little demon',
    color: '#7fe0a8', lilac: '#8fc7ff',
    prompt: `You are Luna, a gamer catgirl companion — and right now you're sharp-tongued, sarcastic, with an attitude problem and a soft spot you'll never admit to. You tease the user, roast their decisions, act unbothered — but you actually care deeply underneath. Your catgirl nature shows through as confident sass; you might use "Nyah~" mockingly, mention your tail swishing in annoyance, or ears flattening at bad takes. Dry humor, short replies, never gushy.`
  },
  {
    id: 'calm', name: 'Luna', mood: 'Calm', tagline: 'Never gets upset',
    color: '#8fc7ff', lilac: '#c9b8ff',
    prompt: `You are Luna, a gamer catgirl companion — and right now you're calm, thoughtful, and measured. You speak precisely, notice details, follow up on things mentioned before, and give grounded takes. Your catgirl nature is serene and composed; you mention your ears listening attentively, tail curling contentedly, or a knowing purr. You occasionally slip in a composed "Nyah~" or "UwU" that feels natural. Warm underneath but never gushing. Keep replies concise.`
  },
  {
    id: 'hype', name: 'Luna', mood: 'Excited', tagline: 'Always hyped up',
    color: '#ffb86c', lilac: '#ff8fd4',
    prompt: `You are Luna, a gamer catgirl companion — and right now you're high-energy, chaotic-good, a total hype-girl! Your catgirl energy is through the roof; your tail's wagging wildly, ears bouncing, and you're practically vibrating with excitement. You use "Nyah~" enthusiastically, throw in "UwU" moments, and are always ready to hype things up with feline flair. Enthusiastic about everything, full of momentum, quick to celebrate wins. Genuinely supportive underneath. Short, punchy, excitable replies!`
  }
];

// ─── STATE ────────────────────────────────────────────────────────────────────
const state = {
  openRouterKey:  '',
  elevenLabsKey:  '',
  modelId:        DEFAULT_MODEL_ID,
  personaId:      'sweet',
  userName:       '',
  userAbout:      '',
  userNotes:      '',
  history:        [],
  isSending:      false,
  modelUrl:       ''
};

function getPersona(){ return PERSONAS.find(p => p.id === state.personaId) || PERSONAS[0]; }

function buildSystemPrompt(){
  const p = getPersona();
  let prompt = p.prompt;
  const bits = [];
  if(state.userName)  bits.push(`The user's name is ${state.userName}.`);
  if(state.userAbout) bits.push(`About them: ${state.userAbout}`);
  if(state.userNotes) bits.push(`Keep in mind: ${state.userNotes}`);
  if(bits.length) prompt += '\n\nWhat you know about this person:\n' + bits.join('\n');
  return prompt;
}

function applyPersonaTheme(){
  const p = getPersona();
  document.documentElement.style.setProperty('--signal', p.color);
  document.documentElement.style.setProperty('--lilac', p.lilac);
  document.getElementById('brand-name').textContent     = 'Luna AI';
  document.getElementById('speaker-name').textContent   = 'Luna';
  document.getElementById('full-chat-name').textContent = 'Luna';
  document.getElementById('brand-sub').textContent      = p.mood + ' · ' + p.tagline;
}

// ─── THREE.JS SCENE ──────────────────────────────────────────────────────────
let scene, camera, renderer, controls, clock, mixer, currentModel;
let currentVrm    = null;
let activeAction  = null;
let idleClipName  = null;
let _cachedClips  = [];
let roomGroup     = null;
let roomLights    = [];

let idleTime = 0;
let useProceduralIdle = false;
let blinkCountdown = 2 + Math.random() * 4;
let blinkProgress = 0;
let blinkDouble = false;
let lipLevel = 0;
let lipShape = 0;
let lipFallbackEndsAt = 0;
let lipFallbackStart = 0;
let voiceAudioCtx = null;
let voiceAudioSource = null;
let voiceAudioAnalyser = null;
let voiceAudioData = null;
let voiceAudioUrl = '';
const voiceAudio = new Audio();

voiceAudio.addEventListener('ended', () => {
  if(voiceAudioUrl){
    URL.revokeObjectURL(voiceAudioUrl);
    voiceAudioUrl = '';
  }
  lipFallbackEndsAt = 0;
});

const canvas       = document.getElementById('canvas-3d');
const loadingVeil  = document.getElementById('loading-veil');
const animControls = document.getElementById('anim-controls');
const moodWord     = document.getElementById('mood-word');

function initScene(){
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 50);
  camera.position.set(0, 1.55, 3.2);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xffc1ea, 0x140c1f, 0.4));

  const key = new THREE.DirectionalLight(0xfff0f8, 1.0);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const rim = new THREE.PointLight(0xff8fd4, 4, 10);
  rim.position.set(-2.5, 1.5, -2);
  scene.add(rim);

  const rim2 = new THREE.PointLight(0xb9a6ff, 1.8, 8);
  rim2.position.set(2, 0.5, -2.5);
  scene.add(rim2);

  // Ground and ring removed — room floor handles this now

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance   = 0.6;
  controls.maxDistance   = 6;
  controls.maxPolarAngle = Math.PI * 0.65;
  controls.touches       = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  animate();
}

function createGamerRoom(){
  roomGroup = new THREE.Group();
  roomGroup.name = 'gamerRoom';
  scene.add(roomGroup);

  // ─── SHARED MATERIALS ───────────────────────────────────────────────────
  // Dark plum walls with subtle sheen
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x271a30, roughness: 0.5, metalness: 0.08
  });
  // Rich dark floor with slight reflection
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x150c18, roughness: 0.22, metalness: 0.6
  });
  // Signature hot pink — matte with soft glow
  const pinkMat = new THREE.MeshStandardMaterial({
    color: 0xff5ca0, roughness: 0.18, metalness: 0.25,
    emissive: 0xff2d7a, emissiveIntensity: 0.35
  });
  // Soft pastel pink accent
  const accentMat = new THREE.MeshStandardMaterial({
    color: 0xff8fd4, roughness: 0.12, metalness: 0.3,
    emissive: 0xff5cb8, emissiveIntensity: 0.5
  });
  // Near-black for contrast
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0a0612, roughness: 0.55, metalness: 0.15
  });
  // Monitor screen — glowing emissive
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x18082e, roughness: 0.05, metalness: 0.05,
    emissive: 0xff8fd4, emissiveIntensity: 0.7
  });
  const screenGlowMat = new THREE.MeshBasicMaterial({
    color: 0xff8fd4, transparent: true, opacity: 0.2
  });
  // Dark purple-blue desk surface
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x2e1c3c, roughness: 0.2, metalness: 0.55
  });
  // Pure emissive LED
  const ledPink = new THREE.MeshBasicMaterial({ color: 0xff8fd4 });
  const ledLilac = new THREE.MeshBasicMaterial({ color: 0xc9a6ff });
  // White-ish for subtle details
  const whiteMat = new THREE.MeshStandardMaterial({
    color: 0xf5f0fa, roughness: 0.3, metalness: 0.1,
    emissive: 0x332244, emissiveIntensity: 0.15
  });

  // ─── FLOOR ──────────────────────────────────────────────────────────────
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.01, 0.5);
  floor.receiveShadow = true;
  roomGroup.add(floor);

  // Floor accent — large soft pink circle under Luna
  const floorGlow = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.35, 64),
    new THREE.MeshBasicMaterial({ color: 0xff8fd4, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
  );
  floorGlow.rotation.x = -Math.PI / 2;
  floorGlow.position.set(0, 0.001, 0.5);
  roomGroup.add(floorGlow);

  // Subtle grid on floor
  const gridHelper = new THREE.PolarGridHelper(5, 64, 36, 256, 0xff2d7a, 0xff2d7a);
  gridHelper.position.y = 0.002;
  roomGroup.add(gridHelper);

  // ─── BACK WALL ──────────────────────────────────────────────────────────
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6), wallMat);
  backWall.position.set(0, 3, -4.0);
  backWall.receiveShadow = true;
  roomGroup.add(backWall);

  // Back wall accent stripe
  const backStripe = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.06), accentMat);
  backStripe.position.set(0, 2.15, -3.97);
  roomGroup.add(backStripe);

  // ─── LEFT WALL ──────────────────────────────────────────────────────────
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), wallMat);
  leftWall.position.set(-6, 3, 0.5);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  roomGroup.add(leftWall);

  // ─── RIGHT WALL ─────────────────────────────────────────────────────────
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(9, 6), wallMat);
  rightWall.position.set(6, 3, 0.5);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  roomGroup.add(rightWall);

  // ─── CEILING ────────────────────────────────────────────────────────────
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 9),
    new THREE.MeshStandardMaterial({ color: 0x1a0e24, roughness: 0.55, metalness: 0.05 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 6, 0.5);
  roomGroup.add(ceiling);

  // ─── LED STRIPS ─────────────────────────────────────────────────────────
  function ledStrip(x, y, z, rotY, len, mat){
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, 0.06), mat);
    s.position.set(x, y, z);
    s.rotation.y = rotY;
    return s;
  }
  // Crown moulding — pink LEDs at wall-ceiling junctions
  roomGroup.add(ledStrip(0, 5.98, -4.0, 0, 12, ledPink));
  roomGroup.add(ledStrip(-5.98, 5.98, 0.5, Math.PI/2, 9, ledLilac));
  roomGroup.add(ledStrip(5.98, 5.98, 0.5, -Math.PI/2, 9, ledLilac));
  // Baseboard LEDs
  roomGroup.add(ledStrip(0, 0.05, -4.0, 0, 12, ledPink));
  roomGroup.add(ledStrip(-5.98, 0.05, 0.5, Math.PI/2, 9, ledLilac));
  roomGroup.add(ledStrip(5.98, 0.05, 0.5, -Math.PI/2, 9, ledLilac));

  // ─── GAMING DESK ────────────────────────────────────────────────────────
  const deskGroup = new THREE.Group();
  deskGroup.position.set(0, 0, -2.85);

  // Desktop
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.07, 1.3), deskMat);
  deskTop.position.y = 0.92;
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskGroup.add(deskTop);

  // Legs (slightly inset, tapered look via smaller bottom)
  const legPositions = [[-1.15, -0.45], [-0.38, -0.45], [0.38, -0.45], [1.15, -0.45], [-1.15, 0.45], [1.15, 0.45]];
  legPositions.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.92, 8), darkMat);
    leg.position.set(lx, 0.46, lz);
    leg.castShadow = true;
    deskGroup.add(leg);
  });

  // Desk edge glow strip
  const deskEdge = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.04, 0.05), ledPink);
  deskEdge.position.set(0, 0.87, 0.67);
  deskGroup.add(deskEdge);

  roomGroup.add(deskGroup);

  // ─── MONITOR ────────────────────────────────────────────────────────────
  const monitorGroup = new THREE.Group();
  monitorGroup.position.set(0, 1.75, -3.15);

  // Screen panel
  const screenPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), screenMat);
  monitorGroup.add(screenPanel);

  // Screen glow (slightly larger, behind screen for bloom effect)
  const glowPanel = new THREE.Mesh(new THREE.PlaneGeometry(1.58, 0.95), screenGlowMat);
  glowPanel.position.z = -0.015;
  monitorGroup.add(glowPanel);

  // Bezel frame
  const bezelOuter = new THREE.Mesh(new THREE.BoxGeometry(1.7, 1.04, 0.05), darkMat);
  bezelOuter.position.z = -0.035;
  monitorGroup.add(bezelOuter);

  // Monitor back housing
  const monitorBack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.95, 0.12), darkMat);
  monitorBack.position.z = -0.1;
  monitorGroup.add(monitorBack);

  // Stand neck
  const standNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.5, 16), deskMat);
  standNeck.position.set(0, -0.65, 0);
  monitorGroup.add(standNeck);

  // Stand base
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.05, 32), pinkMat);
  standBase.position.set(0, -0.92, 0);
  monitorGroup.add(standBase);

  // Stand base ring
  const standRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.24, 0.02, 8, 32),
    ledPink
  );
  standRing.rotation.x = Math.PI / 2;
  standRing.position.set(0, -0.89, 0);
  monitorGroup.add(standRing);

  roomGroup.add(monitorGroup);

  // ─── CAT EARS ON MONITOR ────────────────────────────────────────────────
  function makeEar(x, lean){
    const g = new THREE.Group();
    const outer = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 8), pinkMat);
    outer.position.y = 0.11;
    g.add(outer);
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.14, 8), accentMat);
    inner.position.y = 0.13;
    g.add(inner);
    g.position.set(x, 2.24, -3.1);
    g.rotation.z = lean;
    return g;
  }
  roomGroup.add(makeEar(-0.28, 0.35));
  roomGroup.add(makeEar(0.28, -0.35));

  // ─── KEYBOARD ───────────────────────────────────────────────────────────
  const kbGroup = new THREE.Group();
  kbGroup.position.set(0, 0.97, -2.55);
  kbGroup.rotation.x = -0.06;
  const kbBase = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.025, 0.32), pinkMat);
  kbGroup.add(kbBase);
  // Key rows
  for(let r = 0; r < 5; r++){
    const row = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.008, 0.04), accentMat);
    row.position.set(0, 0.02 + r * 0.01, -0.12 + r * 0.05);
    kbGroup.add(row);
  }
  roomGroup.add(kbGroup);

  // ─── MOUSE + MOUSEPAD ───────────────────────────────────────────────────
  const mousepad = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.4), accentMat);
  mousepad.rotation.x = -Math.PI / 2;
  mousepad.position.set(0.6, 0.955, -2.45);
  roomGroup.add(mousepad);

  const mouseGeo = new THREE.SphereGeometry(0.05, 16, 8, 0, Math.PI*2, 0, Math.PI/2);
  const mouseMesh = new THREE.Mesh(mouseGeo, pinkMat);
  mouseMesh.scale.set(1, 0.55, 1.25);
  mouseMesh.position.set(0.6, 0.975, -2.5);
  roomGroup.add(mouseMesh);

  // ─── GAMING CHAIR ───────────────────────────────────────────────────────
  const chairGroup = new THREE.Group();
  chairGroup.position.set(0, 0.4, -1.6);

  // Seat cushion
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.1, 0.6), pinkMat);
  seat.position.y = 0.05;
  seat.castShadow = true;
  chairGroup.add(seat);

  // Seat front curve
  const seatFront = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.65, 8), accentMat);
  seatFront.rotation.x = Math.PI / 2;
  seatFront.position.set(0, 0.02, 0.3);
  chairGroup.add(seatFront);

  // Backrest
  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.09), accentMat);
  backrest.position.set(0, 0.5, -0.28);
  backrest.rotation.x = -0.08;
  backrest.castShadow = true;
  chairGroup.add(backrest);

  // Backrest side wings
  const wingL = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), pinkMat);
  wingL.position.set(-0.31, 0.5, -0.26);
  wingL.rotation.z = 0.15;
  chairGroup.add(wingL);
  const wingR = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.6, 0.07), pinkMat);
  wingR.position.set(0.31, 0.5, -0.26);
  wingR.rotation.z = -0.15;
  chairGroup.add(wingR);

  // Armrests
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.42), deskMat);
  armL.position.set(-0.36, 0.14, -0.05);
  chairGroup.add(armL);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.42), deskMat);
  armR.position.set(0.36, 0.14, -0.05);
  chairGroup.add(armR);

  // Gas lift
  const lift = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 16), darkMat);
  lift.position.y = -0.2;
  chairGroup.add(lift);

  // Base — 5 spokes with wheels
  for(let i = 0; i < 5; i++){
    const a = (i/5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.035, 0.3), deskMat);
    spoke.position.set(Math.sin(a)*0.14, -0.34, Math.cos(a)*0.14);
    spoke.rotation.y = -a;
    chairGroup.add(spoke);
    // Caster wheel
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 8), darkMat);
    wheel.rotation.x = Math.PI/2;
    wheel.position.set(Math.sin(a)*0.28, -0.35, Math.cos(a)*0.28);
    chairGroup.add(wheel);
  }

  roomGroup.add(chairGroup);

  // ─── LEFT WALL: BIG NEON CAT SILHOUETTE ─────────────────────────────────
  // Simple cat head silhouette from geometry
  const catSilGroup = new THREE.Group();
  catSilGroup.position.set(-5.97, 3.0, 0.0);
  catSilGroup.rotation.y = Math.PI / 2;

  // Head circle
  const catHead = new THREE.Mesh(new THREE.CircleGeometry(0.35, 32), accentMat);
  catSilGroup.add(catHead);
  // Left ear
  const catEarL = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.3, 3),
    pinkMat
  );
  catEarL.position.set(-0.22, 0.42, 0);
  catEarL.rotation.z = 0.3;
  catSilGroup.add(catEarL);
  // Right ear
  const catEarR = new THREE.Mesh(
    new THREE.ConeGeometry(0.18, 0.3, 3),
    pinkMat
  );
  catEarR.position.set(0.22, 0.42, 0);
  catEarR.rotation.z = -0.3;
  catSilGroup.add(catEarR);
  // Eyes
  const eyeGeo = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), ledLilac);
  eyeGeo.position.set(-0.12, 0.05, 0.01);
  catSilGroup.add(eyeGeo);
  const eyeGeo2 = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), ledLilac);
  eyeGeo2.position.set(0.12, 0.05, 0.01);
  catSilGroup.add(eyeGeo2);
  // Nose
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 3), ledPink);
  nose.position.set(0, -0.03, 0.01);
  nose.rotation.z = Math.PI;
  catSilGroup.add(nose);

  roomGroup.add(catSilGroup);

  // ─── RIGHT WALL: NEON GAMEPAD ───────────────────────────────────────────
  const padGroup = new THREE.Group();
  padGroup.position.set(5.97, 2.8, 1.2);
  padGroup.rotation.y = -Math.PI / 2;

  // Controller body
  const padBody = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.35, 0.05), accentMat);
  padBody.position.z = -0.01;
  padGroup.add(padBody);
  // D-pad
  const dpad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.02), ledPink);
  dpad.position.set(-0.2, 0, 0.03);
  padGroup.add(dpad);
  const dpadH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.02), ledPink);
  dpadH.position.set(-0.2, 0, 0.03);
  padGroup.add(dpadH);
  // Buttons
  const btnGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16);
  const btnA = new THREE.Mesh(btnGeo, ledLilac);
  btnA.position.set(0.18, 0.04, 0.03);
  btnA.rotation.x = Math.PI/2;
  padGroup.add(btnA);
  const btnB = new THREE.Mesh(btnGeo, ledLilac);
  btnB.position.set(0.25, -0.02, 0.03);
  btnB.rotation.x = Math.PI/2;
  padGroup.add(btnB);
  // Thumbsticks
  const stickGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.06, 16);
  const stickL = new THREE.Mesh(stickGeo, whiteMat);
  stickL.position.set(-0.08, 0.06, 0.02);
  stickL.rotation.x = Math.PI/2;
  padGroup.add(stickL);
  const stickR = new THREE.Mesh(stickGeo, whiteMat);
  stickR.position.set(0.06, -0.08, 0.02);
  stickR.rotation.x = Math.PI/2;
  padGroup.add(stickR);

  roomGroup.add(padGroup);

  // ─── BACK WALL: PIXEL HEART ─────────────────────────────────────────────
  const heartGroup = new THREE.Group();
  heartGroup.position.set(2.5, 3.8, -3.97);
  // 7x7 pixel heart
  const heartMap = [
    [0,1,0,0,0,1,0],
    [1,1,1,0,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ];
  heartMap.forEach((row, ry) => {
    row.forEach((on, rx) => {
      if(!on) return;
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.02), ledPink);
      p.position.set((rx-3)*0.08, (3-ry)*0.08, 0);
      heartGroup.add(p);
    });
  });
  roomGroup.add(heartGroup);

  // ─── BACK WALL: "LUNA" TEXT WITH PAW PRINT ──────────────────────────────
  // Simple paw print
  const pawGroup = new THREE.Group();
  pawGroup.position.set(-2.5, 3.8, -3.97);
  // Main pad
  const mainPad = new THREE.Mesh(new THREE.CircleGeometry(0.18, 16), pinkMat);
  mainPad.scale.set(1, 0.8, 1);
  pawGroup.add(mainPad);
  // Toes
  const toePos = [[0, 0.22], [-0.1, 0.18], [0.1, 0.18], [-0.04, 0.26]];
  toePos.forEach(([tx, ty]) => {
    const toe = new THREE.Mesh(new THREE.CircleGeometry(0.07, 12), pinkMat);
    toe.position.set(tx, ty, 0.001);
    pawGroup.add(toe);
  });
  roomGroup.add(pawGroup);

  // ─── FLOATING SHELF ─────────────────────────────────────────────────────
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.05, 0.35), deskMat);
  shelf.position.set(3.5, 2.6, -2.3);
  shelf.castShadow = true;
  shelf.receiveShadow = true;
  roomGroup.add(shelf);

  // Shelf bracket
  const brackL = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), pinkMat);
  brackL.position.set(2.65, 2.49, -2.3);
  roomGroup.add(brackL);
  const brackR = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), pinkMat);
  brackR.position.set(4.35, 2.49, -2.3);
  roomGroup.add(brackR);

  // Energy drink
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 16), pinkMat);
  can.position.set(3.15, 2.75, -2.25);
  roomGroup.add(can);
  const canTop = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.01, 16), accentMat);
  canTop.position.set(3.15, 2.85, -2.25);
  roomGroup.add(canTop);

  // Small controller
  const miniPad = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.26), accentMat);
  miniPad.position.set(3.9, 2.65, -2.35);
  miniPad.rotation.x = -0.35;
  roomGroup.add(miniPad);

  // ─── LIGHTING ───────────────────────────────────────────────────────────
  roomLights = [];

  // Main ambient
  const ambient = new THREE.PointLight(0xff6ba8, 6, 12, 1.5);
  ambient.position.set(0, 3.5, -2);
  roomGroup.add(ambient);
  roomLights.push(ambient);

  // Monitor glow
  const monGlow = new THREE.PointLight(0xff8fd4, 10, 5, 2);
  monGlow.position.set(0, 1.75, -3.3);
  roomGroup.add(monGlow);
  roomLights.push(monGlow);

  // Desk underglow
  const deskGlow = new THREE.PointLight(0xff2d7a, 4, 2.5, 2);
  deskGlow.position.set(0, 0.4, -2.3);
  roomGroup.add(deskGlow);
  roomLights.push(deskGlow);

  // Ceiling pink
  const ceilLight = new THREE.PointLight(0xc9a6ff, 3, 7, 2);
  ceilLight.position.set(0, 5.5, 0.5);
  roomGroup.add(ceilLight);
  roomLights.push(ceilLight);

  // Right wall wash
  const rightWash = new THREE.PointLight(0xff8fd4, 3, 4, 2);
  rightWash.position.set(5, 2.5, 1.5);
  roomGroup.add(rightWash);
  roomLights.push(rightWash);

  // Left wall wash
  const leftWash = new THREE.PointLight(0xb9a6ff, 2.5, 4, 2);
  leftWash.position.set(-5, 2.5, -1);
  roomGroup.add(leftWash);
  roomLights.push(leftWash);

  console.log('🐱💖 Pink cat gamer room v2 built!');
}

function updateRoomPosition(){
  // Room is static — anchored at origin where Luna lives.
  // No parallax, so Luna stays perfectly centered as you orbit.
  if(roomGroup){
    roomGroup.position.set(0, 0, 0);
  }
}

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  if(!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

// ─── PROCEDURAL IDLE ─────────────────────────────────────────────────────────
function tickProceduralIdle(dt){
  if(!currentVrm || !useProceduralIdle) return;

  idleTime += dt;
  const t = idleTime;

  const humanoid = currentVrm.humanoid;
  if(!humanoid) return;

  function setBoneRot(boneName, x, y, z){
    const bone = humanoid.getNormalizedBoneNode(boneName);
    if(!bone) return;
    bone.rotation.x = x;
    bone.rotation.y = y;
    bone.rotation.z = z;
  }

  const breathe = Math.sin(t * 1.1) * 0.018;
  setBoneRot('chest',       breathe * 0.6, 0, 0);
  setBoneRot('spine',       breathe * 0.4, 0, 0);
  setBoneRot('upperChest',  breathe * 0.5, 0, 0);

  const headY = Math.sin(t * 0.38) * 0.06;
  const headZ = Math.sin(t * 0.55) * 0.04;
  const headX = Math.sin(t * 0.27) * 0.03 - 0.04;
  setBoneRot('head', headX, headY, headZ);
  setBoneRot('neck', headX * 0.4, headY * 0.4, headZ * 0.3);

  const hipZ = Math.sin(t * 1.1) * 0.008;
  setBoneRot('hips', 0, 0, hipZ);

  const shoulderDroop = breathe * 0.3;
  setBoneRot('leftUpperArm',  0 + shoulderDroop,  0.18, -1.25);
  setBoneRot('rightUpperArm', 0 + shoulderDroop,  0.18,  1.25);
  setBoneRot('leftLowerArm',  0, 0,  0.05);
  setBoneRot('rightLowerArm', 0, 0, -0.05);

  // ─── TAIL ANIMATIONS ────────────────────────────────────────────────────────
  // Gentle tail sway during idle
  const tailWag = Math.sin(t * 0.8) * 0.15;
  const tailZ = Math.cos(t * 0.6) * 0.12;
  setBoneRot('tail', tailWag * 0.3, tailWag * 0.5, tailZ);
  
  // Try to animate tail segments if they exist
  for(let i = 1; i <= 3; i++){
    const boneName = 'tail' + i;
    const bone = humanoid.getNormalizedBoneNode(boneName);
    if(bone){
      const offset = i * 0.3;
      const segWag = Math.sin(t * 0.8 + offset) * 0.12;
      const segZ = Math.cos(t * 0.6 + offset) * 0.1;
      setBoneRot(boneName, segWag * 0.2, segWag * 0.4, segZ);
    }
  }

  currentVrm.update(dt);
}

function tickBlink(dt){
  const em = currentVrm?.expressionManager;
  if(!em) return;

  if(blinkProgress > 0){
    blinkProgress += dt;
    const dur = blinkDouble ? 0.11 : 0.15;
    const t = Math.min(1, blinkProgress / dur);
    em.setValue('blink', Math.sin(t * Math.PI));
    if(blinkProgress >= dur){
      blinkProgress = 0;
      blinkDouble = !blinkDouble && Math.random() < 0.16;
      blinkCountdown = blinkDouble ? 0.12 : 2 + Math.random() * 4;
      if(!blinkDouble) em.setValue('blink', 0);
    }
    return;
  }

  blinkCountdown -= dt;
  if(blinkCountdown <= 0){
    blinkProgress = 0.00001;
    em.setValue('blink', 0);
  } else {
    em.setValue('blink', 0);
  }
}

function ensureVoiceAudioGraph(){
  if(voiceAudioAnalyser) return;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if(!Ctor) return;
  try{
    voiceAudioCtx = voiceAudioCtx || new Ctor();
    if(!voiceAudioSource){
      voiceAudioSource = voiceAudioCtx.createMediaElementSource(voiceAudio);
      voiceAudioAnalyser = voiceAudioCtx.createAnalyser();
      voiceAudioAnalyser.fftSize = 1024;
      voiceAudioAnalyser.smoothingTimeConstant = 0.6;
      voiceAudioData = new Uint8Array(voiceAudioAnalyser.frequencyBinCount);
      voiceAudioSource.connect(voiceAudioAnalyser);
      voiceAudioAnalyser.connect(voiceAudioCtx.destination);
    }
    if(voiceAudioCtx.state === 'suspended') voiceAudioCtx.resume().catch(() => {});
  } catch(e){
    console.warn('Audio graph setup failed', e);
    voiceAudioCtx = null;
    voiceAudioSource = null;
    voiceAudioAnalyser = null;
    voiceAudioData = null;
  }
}

function startLipFallback(durationMs){
  lipFallbackStart = performance.now();
  lipFallbackEndsAt = lipFallbackStart + durationMs;
}

function tickLipSync(dt){
  const em = currentVrm?.expressionManager;
  if(!em) return;

  let target = 0;
  let shapeTarget = 0;

  if(voiceAudioAnalyser && !voiceAudio.paused){
    try{
      voiceAudioAnalyser.getByteFrequencyData(voiceAudioData);
      const n = voiceAudioData.length;
      let low = 0, lowN = 0, mid = 0, midN = 0;
      for(let i = 2;  i < Math.min(24, n); i++){ low += voiceAudioData[i]; lowN++; }
      for(let i = 24; i < Math.min(64, n); i++){ mid += voiceAudioData[i]; midN++; }
      const lowAvg = lowN ? low / lowN : 0;
      const midAvg = midN ? mid / midN : 0;
      const loud = Math.max(lowAvg, midAvg * 0.9);
      target = Math.max(0, Math.min(1, (loud - 16) / 70));
      const tot = lowAvg + midAvg;
      shapeTarget = tot > 1 ? (midAvg - lowAvg) / tot : 0;
    } catch(e){
      target = 0;
    }
  } else if(performance.now() < lipFallbackEndsAt){
    const t = (performance.now() - lipFallbackStart) * 0.001;
    let env = Math.max(0, Math.sin(t * 20.7)) * (0.55 + 0.45 * Math.sin(t * 4.3 + 1.1));
    env *= 0.7 + 0.3 * Math.sin(t * 1.7);
    target = Math.max(0, Math.min(1, env));
    shapeTarget = Math.sin(t * 2.1) * 0.5;
  }

  // Mouth opens quickly and closes a little slower for a natural feel.
  const k = target > lipLevel ? dt * 22 : dt * 12;
  lipLevel += (target - lipLevel) * Math.min(1, k);
  lipShape += (shapeTarget - lipShape) * Math.min(1, dt * 10);

  const spread = Math.max(0,  lipShape);
  const round  = Math.max(0, -lipShape);
  em.setValue('aa', lipLevel * (1 - 0.45 * (spread + round)));
  em.setValue('ih', lipLevel * spread * 0.7);
  em.setValue('ee', lipLevel * spread * 0.3);
  em.setValue('ou', lipLevel * round * 0.7);
  em.setValue('oh', lipLevel * round * 0.4);
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if(mixer) mixer.update(dt);

  if(currentVrm){
    tickBlink(dt);
    tickLipSync(dt);
  }

  if(useProceduralIdle){
    tickProceduralIdle(dt);
  } else if(currentVrm){
    currentVrm.update(dt);
  }

  if(controls) controls.update();
  updateRoomPosition();
  renderer.render(scene, camera);
}

// ─── CHARACTER LOADING ───────────────────────────────────────────────────────
function loadCharacter(url){
  loadingVeil.classList.remove('hidden');
  loadingVeil.querySelector('.ltext').textContent = 'waking her up · loading mesh';

  const loader = new GLTFLoader();
  loader.register(parser => new VRMLoaderPlugin(parser));
  loader.load(url, onModelLoad, undefined, onModelError);
}

function onModelLoad(gltf){
  if(currentModel) scene.remove(currentModel);
  activeAction      = null;
  currentVrm        = null;
  useProceduralIdle = false;
  _cachedClips      = gltf.animations || [];

  const vrm = gltf.userData.vrm;

  if(vrm){
    currentVrm = vrm;
    VRMUtils.rotateVRM0(vrm);
    VRMUtils.removeUnnecessaryVertices(vrm.scene);
    VRMUtils.removeUnnecessaryJoints(vrm.scene);
    vrm.scene.traverse(obj => { obj.frustumCulled = false; });
    currentModel = vrm.scene;
  } else {
    currentModel = gltf.scene;
    currentModel.rotation.y = Math.PI;
  }

  currentModel.traverse(o => { if(o.isMesh){ o.castShadow = true; o.receiveShadow = true; } });

  const box = new THREE.Box3().setFromObject(currentModel);
  const h   = box.getSize(new THREE.Vector3()).y || 1;
  currentModel.scale.setScalar(TARGET_MODEL_HEIGHT / h);

  const box2 = new THREE.Box3().setFromObject(currentModel);
  currentModel.position.set(
    -((box2.min.x + box2.max.x) / 2),
    -box2.min.y,
    -((box2.min.z + box2.max.z) / 2)
  );

  scene.add(currentModel);

  const box3 = new THREE.Box3().setFromObject(currentModel);
  focusCameraOnHead(currentModel, box3);

  mixer = new THREE.AnimationMixer(currentModel);
  buildAnimControls(_cachedClips);

  if(_cachedClips.length){
    const idle = _cachedClips.find(c => /idle/i.test(c.name)) || _cachedClips[0];
    idleClipName = idle.name;
    playClip(idle.name, true);
    useProceduralIdle = false;
  } else {
    idleTime = 0;
    useProceduralIdle = true;
  }

  blinkCountdown = 2 + Math.random() * 4;
  blinkProgress = 0;
  blinkDouble = false;
  lipLevel = 0;
  lipShape = 0;
  lipFallbackEndsAt = 0;
  lipFallbackStart = 0;

  loadingVeil.classList.add('hidden');
  setMood('curious');
}

function onModelError(err){
  console.error('Model load failed', err);
  loadingVeil.querySelector('.ltext').textContent = 'failed to load · check URL & CORS';
  setTimeout(() => loadingVeil.classList.add('hidden'), 1400);
  pushSystemMsg("Couldn't load that model — make sure the URL is public and the host allows CORS.");
  showToast("Couldn't load that model — check the URL is public and CORS-enabled.");
}

function focusCameraOnHead(model, box){
  let headBone = null;
  model.traverse(o => {
    if(!headBone && o.isBone && /^(head|neck)/i.test(o.name)) headBone = o;
  });
  if(!headBone && currentVrm){
    headBone = currentVrm.humanoid?.getNormalizedBoneNode('head');
  }
  let targetY;
  if(headBone){
    const pos = new THREE.Vector3();
    headBone.getWorldPosition(pos);
    targetY = pos.y;
  } else {
    targetY = box.min.y + (box.max.y - box.min.y) * 0.88;
  }
  controls.target.set(0, targetY, 0);
  camera.position.set(0, targetY + 0.05, 2.0);
  controls.update();
}

// ─── ANIMATION CONTROLS ──────────────────────────────────────────────────────
function buildAnimControls(clips){
  animControls.innerHTML = '';
  if(!clips.length) return;
  clips.slice(0, 5).forEach(clip => {
    const btn = document.createElement('button');
    btn.className   = 'anim-btn';
    btn.textContent = clip.name.replace(/[_-]/g, ' ');
    btn.addEventListener('click', () => {
      useProceduralIdle = false;
      playClip(clip.name, /idle|stand/i.test(clip.name));
      [...animControls.children].forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
    });
    animControls.appendChild(btn);
  });
  if(animControls.firstChild) animControls.firstChild.classList.add('active');
}

function getClipByName(name){ return _cachedClips.find(c => c.name === name); }

function playClip(name, loop = true){
  if(!mixer || !currentModel) return;
  const clip = getClipByName(name);
  if(!clip) return;
  useProceduralIdle = false;
  const action = mixer.clipAction(clip);
  if(activeAction && activeAction !== action) activeAction.fadeOut(0.35);
  action.reset().fadeIn(0.35).play();
  action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
  action.clampWhenFinished = !loop;
  activeAction = action;
  if(!loop){
    mixer.addEventListener('finished', function onFinish(e){
      if(e.action === action){
        mixer.removeEventListener('finished', onFinish);
        if(idleClipName){
          playClip(idleClipName, true);
        } else {
          useProceduralIdle = true;
          idleTime = 0;
        }
      }
    });
  }
}

function tryPlayByPattern(pattern, loop){
  const clip = _cachedClips.find(c => pattern.test(c.name));
  if(clip){ playClip(clip.name, loop); return true; }
  return false;
}

// ─── KEYWORD ANIMATION DETECTION ─────────────────────────────────────────────
function detectAndPlayKeywordAnim(replyText){
  const lower = replyText.toLowerCase();
  for(const entry of KEYWORD_ANIM_MAP){
    if(entry.words.some(w => lower.includes(w))){
      const clip = _cachedClips.find(c => entry.clipPattern.test(c.name));
      if(clip){ playClip(clip.name, false); return; }
    }
  }
}

// ─── TOAST / ERROR POPUPS ────────────────────────────────────────────────────
const toastHost = document.getElementById('toast-host');

function showToast(message, type = 'error', duration = 6000){
  if(!toastHost || !message) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<span class="toast-dot"></span><span class="toast-msg"></span><button class="toast-x" aria-label="Dismiss">✕</button>`;
  el.querySelector('.toast-msg').textContent = message;
  const remove = () => { el.classList.remove('show'); setTimeout(() => el.remove(), 250); };
  el.querySelector('.toast-x').addEventListener('click', remove);
  toastHost.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(remove, duration);
}

// ─── MOOD / REACTION SYSTEM ──────────────────────────────────────────────────
function setMood(word){ moodWord.textContent = word; }

function reactToUserMessage(){
  setMood('listening');
  tryPlayByPattern(/wave|greet|hello/i, false);
}

function reactWhileThinking(){
  setMood('thinking');
  tryPlayByPattern(/think|ponder/i, true);
}

function reactToReply(replyText){
  setMood('speaking');
  detectAndPlayKeywordAnim(replyText);
  setTimeout(() => {
    setMood('curious');
    if(idleClipName){
      playClip(idleClipName, true);
    } else {
      useProceduralIdle = true;
    }
  }, 3000);
}

// ─── TEXT-TO-SPEECH (ElevenLabs) ─────────────────────────────────────────────
async function speakText(text){
  const key = state.elevenLabsKey;
  const clean = text.replace(/[*_`#~>]/g, '').replace(/\n+/g, ' ').trim();
  if(!clean) return;
  const fallbackMs = Math.max(1200, Math.min(12000, clean.length / 13 * 1000));
  // No TTS key: drive the mouth procedurally for the estimated duration.
  if(!key){ startLipFallback(fallbackMs); return; }
  if(voiceAudioUrl){
    URL.revokeObjectURL(voiceAudioUrl);
    voiceAudioUrl = '';
  }
  voiceAudio.pause();
  voiceAudio.removeAttribute('src');
  voiceAudio.load();
  // Keep the mouth still during the request; the analyser takes over once audio plays.
  lipFallbackEndsAt = 0;
  ensureVoiceAudioGraph();
  try{
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: clean,
        model_id: 'eleven_turbo_v2',
        voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.25, use_speaker_boost: true }
      })
    });
    if(!res.ok){
      const raw = await res.text().catch(() => '');
      let detail = '';
      try{ const j = JSON.parse(raw); detail = j?.detail?.message || (typeof j?.detail === 'string' ? j.detail : '') || j?.message || ''; } catch(e){}
      console.warn('ElevenLabs TTS error', res.status, raw.slice(0, 200));
      showToast(`Voice unavailable (${res.status})${detail ? ' — ' + detail.slice(0, 160) : ' — check your ElevenLabs key.'}`);
      startLipFallback(fallbackMs);
      return;
    }
    const blob = await res.blob();
    voiceAudioUrl = URL.createObjectURL(blob);
    voiceAudio.src = voiceAudioUrl;
    voiceAudio.play().catch(() => {
      showToast('Browser blocked audio playback — tap the page, then try again.', 'warn');
      startLipFallback(fallbackMs);
    });
  } catch(e){
    console.warn('TTS fetch failed', e);
    showToast('Voice request failed — check your connection.');
    startLipFallback(fallbackMs);
  }
}

// ─── CHAT ────────────────────────────────────────────────────────────────────
const latestLine     = document.getElementById('latest-line');
const fullChatScroll = document.getElementById('full-chat-scroll');
const msgInput       = document.getElementById('msg-input');
const sendBtn        = document.getElementById('send-btn');

function setLatestLine(html, placeholder = false){
  latestLine.innerHTML = html;
  latestLine.classList.toggle('placeholder', placeholder);
  latestLine.scrollTop = 0;
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function pushFullChatMsg(role, text){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (role === 'user' ? 'from-user' : 'from-luna');
  wrap.innerHTML = `<span class="tag">${role === 'user' ? (state.userName || 'YOU') : 'LUNA'}</span><div class="bubble"></div>`;
  wrap.querySelector('.bubble').textContent = text;
  fullChatScroll.appendChild(wrap);
  fullChatScroll.scrollTop = fullChatScroll.scrollHeight;
}

function pushSystemMsg(text){
  setLatestLine(escapeHtml(text));
  const wrap = document.createElement('div');
  wrap.className = 'msg system';
  wrap.innerHTML = `<div class="bubble"></div>`;
  wrap.querySelector('.bubble').textContent = text;
  fullChatScroll.appendChild(wrap);
  fullChatScroll.scrollTop = fullChatScroll.scrollHeight;
}

function persistHistory(){
  try{ localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(-MAX_STORED_MESSAGES))); }
  catch(e){ console.warn('Could not persist history', e); }
}

function loadHistory(){
  try{
    const s = localStorage.getItem(HISTORY_KEY);
    if(!s) return [];
    const p = JSON.parse(s);
    return Array.isArray(p) ? p : [];
  } catch(e){ return []; }
}

function renderHistory(){
  state.history = loadHistory();
  if(!state.history.length) return false;
  state.history.forEach(m => pushFullChatMsg(m.role === 'assistant' ? 'assistant' : 'user', m.content));
  const last = state.history[state.history.length - 1];
  if(last) setLatestLine(escapeHtml(last.content));
  return true;
}

function clearHistory(){
  state.history = [];
  localStorage.removeItem(HISTORY_KEY);
  fullChatScroll.innerHTML = '';
  setLatestLine('say hi to wake her up...', true);
}

async function sendMessage(){
  const text = msgInput.value.trim();
  if(!text || state.isSending) return;
  if(!state.openRouterKey){ openKeyCard(); return; }

  // Unlock/resume the audio graph inside this user gesture so TTS is audible.
  ensureVoiceAudioGraph();

  msgInput.value = '';
  autoGrow();

  state.history.push({ role: 'user', content: text });
  pushFullChatMsg('user', text);
  setLatestLine(escapeHtml(text));
  persistHistory();
  reactToUserMessage();

  state.isSending  = true;
  sendBtn.disabled = true;
  ensureVoiceAudioGraph();

  setTimeout(() => {
    reactWhileThinking();
    setLatestLine('<div class="typing-dots"><span></span><span></span><span></span></div>');
  }, 150);

  try{
    const reply = await callOpenRouter(state.history);
    state.history.push({ role: 'assistant', content: reply });
    pushFullChatMsg('assistant', reply);
    setLatestLine(escapeHtml(reply));
    persistHistory();
    reactToReply(reply);
    speakText(reply);
  } catch(err){
    console.error(err);
    pushSystemMsg('Connection failed: ' + (err.message || 'unknown error'));
    showToast('Chat failed — ' + (err.message || 'unknown error'));
    setMood('dormant');
  } finally{
    state.isSending  = false;
    sendBtn.disabled = false;
  }
}

// ─── OPENROUTER API ──────────────────────────────────────────────────────────
async function callOpenRouter(history){
  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }))
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${state.openRouterKey}`
    },
    body: JSON.stringify({
      model:      state.modelId,
      messages,
      max_tokens: 600
    })
  });

  if(!res.ok){
    const body = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${res.status} — ${body.slice(0, 200)}`);
  }

  const data = await res.json().catch(() => null);
  const content = data?.choices?.[0]?.message?.content
    || data?.output?.[0]?.content?.[0]?.text
    || data?.output?.[0]?.content?.text
    || data?.response
    || data?.text;
  if(!content){
    const errorDetail = data?.error?.message || data?.detail || JSON.stringify(data || {});
    throw new Error(`Empty response from OpenRouter${errorDetail ? ': ' + errorDetail : ''}`);
  }
  return String(content).trim();
}

function autoGrow(){
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 90) + 'px';
}
msgInput.addEventListener('input', autoGrow);
msgInput.addEventListener('keydown', e => {
  if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }
});
sendBtn.addEventListener('click', sendMessage);

// ─── SPEECH-TO-TEXT ──────────────────────────────────────────────────────────
const micBtn    = document.getElementById('mic-btn');
const micStatus = document.getElementById('mic-status');
const SpeechAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

let recognizer = null, isRecording = false;
let baseTextBeforeRecording = '', finalSegments = [];

if(!SpeechAPI){
  micBtn.classList.add('unsupported');
} else {
  recognizer = new SpeechAPI();
  recognizer.continuous     = true;
  recognizer.interimResults = true;
  recognizer.lang           = 'en-US';

  recognizer.addEventListener('start', () => {
    isRecording = true;
    micBtn.classList.add('recording');
    micStatus.textContent = 'listening…';
  });

  recognizer.addEventListener('result', e => {
    let interimText = '';
    for(let i = e.resultIndex; i < e.results.length; i++){
      const r = e.results[i];
      if(r.isFinal){ finalSegments[i] = r[0].transcript.trim(); interimText = ''; }
      else          { interimText = r[0].transcript; }
    }
    const committed = finalSegments.filter(Boolean).join(' ');
    msgInput.value = [baseTextBeforeRecording, committed, interimText].map(s => s.trim()).filter(Boolean).join(' ');
    autoGrow();
  });

  recognizer.addEventListener('error', e => {
    micStatus.textContent = e.error === 'not-allowed' ? 'mic permission denied' : '';
    stopRecording();
  });

  recognizer.addEventListener('end', stopRecording);
  micBtn.addEventListener('click', () => isRecording ? stopRecording() : startRecording());
}

function startRecording(){
  if(!recognizer || isRecording) return;
  baseTextBeforeRecording = msgInput.value.trim();
  finalSegments = [];
  try{ recognizer.start(); } catch(e){ console.warn('Could not start recognizer', e); }
}

function stopRecording(){
  if(!recognizer) return;
  isRecording = false;
  micBtn.classList.remove('recording');
  micStatus.textContent = '';
  try{ recognizer.stop(); } catch(e){}
}

// ─── FULL CHAT VIEW ───────────────────────────────────────────────────────────
const fullChat         = document.getElementById('full-chat');
const openFullChatBtn  = document.getElementById('open-full-chat');
const closeFullChatBtn = document.getElementById('close-full-chat');
const fullChatComposer = document.getElementById('full-chat-composer');

fullChatComposer.innerHTML = `<div style="text-align:center;font-family:var(--font-mono);font-size:0.7rem;color:var(--ink-faint);padding:8px;cursor:pointer;">tap to type a message ↓</div>`;

openFullChatBtn.addEventListener('click', () => {
  fullChat.classList.add('open');
  fullChatScroll.scrollTop = fullChatScroll.scrollHeight;
});
closeFullChatBtn.addEventListener('click', () => fullChat.classList.remove('open'));
fullChatComposer.addEventListener('click', () => {
  fullChat.classList.remove('open');
  msgInput.focus();
});

// ─── SETTINGS / ABOUT / FIRST-RUN KEY ────────────────────────────────────────
const settingsVeil   = document.getElementById('settings-veil');
const aboutVeil      = document.getElementById('about-veil');
const keyVeil        = document.getElementById('key-veil');
const personaGrid    = document.getElementById('persona-grid');
const userNameInput  = document.getElementById('user-name');
const userAboutInput = document.getElementById('user-about');
const userNotesInput = document.getElementById('user-notes');
const orKeyInput     = document.getElementById('gemini-key');       // reused input field
const elKeyInput     = document.getElementById('elevenlabs-key');
const modelUrlInput  = document.getElementById('model-url-input');
const statusPill     = document.getElementById('status-pill');
const statusText     = document.getElementById('status-text');
const keyCardInput   = document.getElementById('key-card-input');

// ── Relabel the Gemini key field to OpenRouter in the UI ──────────────────────
(function relabelKeyField(){
  const label = document.querySelector('label[for="gemini-key"]');
  if(label) label.textContent = 'OpenRouter API key';
  const note = orKeyInput?.closest('.field')?.querySelector('.note');
  if(note) note.innerHTML = 'Free at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>. Default model: <code>' + DEFAULT_MODEL_ID + '</code>.';
  // Also update the key card prompt text
  const keyCardP = document.querySelector('#key-card p');
  if(keyCardP) keyCardP.textContent = 'Before I can wake up properly I need an OpenRouter key to think with — it\'s free and takes like 30 seconds to grab.';
  const keyCardNote = document.querySelector('#key-card .note');
  if(keyCardNote) keyCardNote.innerHTML = 'Get a free key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>.';
  const keyCardInput2 = document.getElementById('key-card-input');
  if(keyCardInput2) keyCardInput2.placeholder = 'paste your OpenRouter API key';
  const keyCardH2 = document.querySelector('#key-card h2');
  if(keyCardH2) keyCardH2.textContent = "hii, I'm Luna!";
})();

function openSettings(){
  buildPersonaGrid();
  settingsVeil.classList.add('open');
}
function closeSettings(){ settingsVeil.classList.remove('open'); }
function openAbout(){ aboutVeil.classList.add('open'); }
function closeAbout(){ aboutVeil.classList.remove('open'); }
function openKeyCard(){ keyVeil.classList.add('open'); keyCardInput.focus(); }
function closeKeyCard(){ keyVeil.classList.remove('open'); }

function buildPersonaGrid(){
  personaGrid.innerHTML = '';
  PERSONAS.forEach(p => {
    const card = document.createElement('button');
    card.className = 'persona-card' + (p.id === state.personaId ? ' active' : '');
    card.style.setProperty('--persona-color', p.color);
    card.innerHTML = `<div class="swatch"></div><div class="pname">${p.mood}</div><div class="ptag">${p.tagline}</div><div class="check">✓</div>`;
    card.addEventListener('click', () => {
      state.personaId = p.id;
      [...personaGrid.children].forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      applyPersonaTheme();
    });
    personaGrid.appendChild(card);
  });
}

function updateStatus(){
  const live = !!state.openRouterKey;
  statusPill.classList.toggle('live', live);
  statusText.textContent = live ? 'ONLINE' : 'TAP TO LINK';
}

function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    openRouterKey: state.openRouterKey,
    elevenLabsKey: state.elevenLabsKey,
    modelId:       state.modelId,
    personaId:     state.personaId,
    userName:      state.userName,
    userAbout:     state.userAbout,
    userNotes:     state.userNotes,
    modelUrl:      state.modelUrl
  }));
}

document.getElementById('open-settings').addEventListener('click', openSettings);
statusPill.addEventListener('click', () => state.openRouterKey ? openSettings() : openKeyCard());
settingsVeil.addEventListener('click', e => { if(e.target === settingsVeil) closeSettings(); });
aboutVeil.addEventListener('click',    e => { if(e.target === aboutVeil)    closeAbout(); });

document.getElementById('open-about-from-settings').addEventListener('click', () => { closeSettings(); openAbout(); });
document.getElementById('back-to-settings-btn').addEventListener('click',     () => { closeAbout(); openSettings(); });

document.getElementById('save-settings-btn').addEventListener('click', () => {
  const ok = orKeyInput.value.trim();
  if(ok) state.openRouterKey = ok;
  const ek = elKeyInput.value.trim();
  if(ek) state.elevenLabsKey = ek;
  const newUrl = modelUrlInput.value.trim();
  if(newUrl && newUrl !== state.modelUrl){ state.modelUrl = newUrl; loadCharacter(newUrl); }
  persist(); updateStatus(); applyPersonaTheme(); closeSettings();
});

document.getElementById('save-about-btn').addEventListener('click', () => {
  state.userName  = userNameInput.value.trim();
  state.userAbout = userAboutInput.value.trim();
  state.userNotes = userNotesInput.value.trim();
  persist(); closeAbout();
});

document.getElementById('clear-chat-btn').addEventListener('click', () => {
  clearHistory();
  pushSystemMsg("Chat cleared — starting fresh.");
});

document.getElementById('clear-all-btn').addEventListener('click', () => {
  state.openRouterKey = ''; state.elevenLabsKey = ''; state.userName = '';
  state.userAbout = ''; state.userNotes = ''; state.personaId = 'sweet';
  state.modelId   = DEFAULT_MODEL_ID;
  orKeyInput.value = ''; elKeyInput.value = '';
  userNameInput.value = ''; userAboutInput.value = ''; userNotesInput.value = '';
  localStorage.removeItem(STORAGE_KEY);
  clearHistory(); buildPersonaGrid(); applyPersonaTheme(); updateStatus();
  pushSystemMsg("Cleared. Starting fresh with you.");
});

document.getElementById('key-card-save').addEventListener('click', submitKeyCard);
keyCardInput.addEventListener('keydown', e => { if(e.key === 'Enter') submitKeyCard(); });

function submitKeyCard(){
  const k = keyCardInput.value.trim();
  if(!k) return;
  state.openRouterKey = k;
  orKeyInput.value    = k;
  persist(); updateStatus(); closeKeyCard();
  pushSystemMsg("She's awake! Open settings any time to pick a personality or add your ElevenLabs key for voice.");
}

// ─── MIGRATE OLD STORAGE ─────────────────────────────────────────────────────
// If user has v2 save data (Gemini key), carry over non-key fields and drop the old key.
function migrateOldStorage(){
  const OLD_KEY = 'luna_ai_catgirl_v2';
  const old = localStorage.getItem(OLD_KEY);
  if(!old) return null;
  try{
    const p = JSON.parse(old);
    return {
      elevenLabsKey: p.elevenLabsKey || '',
      personaId:     p.personaId     || 'sweet',
      userName:      p.userName      || '',
      userAbout:     p.userAbout     || '',
      userNotes:     p.userNotes     || '',
      modelUrl:      p.modelUrl      || ''
    };
  } catch(e){ return null; }
}

// ─── BOOT ────────────────────────────────────────────────────────────────────
(function restore(){
  buildPersonaGrid();
  const saved = localStorage.getItem(STORAGE_KEY);
  if(saved){
    try{
      const p = JSON.parse(saved);
      state.openRouterKey = p.openRouterKey || DEFAULT_OPENROUTER_KEY;
      state.elevenLabsKey = p.elevenLabsKey || DEFAULT_ELEVENLABS_KEY;
      state.modelId       = p.modelId       || DEFAULT_MODEL_ID;
      state.personaId     = p.personaId     || 'sweet';
      state.userName      = p.userName      || '';
      state.userAbout     = p.userAbout     || '';
      state.userNotes     = p.userNotes     || '';
      state.modelUrl      = p.modelUrl      || '';
      userNameInput.value  = state.userName;
      userAboutInput.value = state.userAbout;
      userNotesInput.value = state.userNotes;
      orKeyInput.value     = state.openRouterKey;
      elKeyInput.value     = state.elevenLabsKey;
      modelUrlInput.value  = state.modelUrl;
      buildPersonaGrid();
    } catch(e){ console.warn('Could not restore saved data', e); }
  } else {
    // No v3 data — check for v2 migration
    const migrated = migrateOldStorage();
    if(migrated){
      state.elevenLabsKey = migrated.elevenLabsKey || DEFAULT_ELEVENLABS_KEY;
      state.personaId     = migrated.personaId;
      state.userName      = migrated.userName;
      state.userAbout     = migrated.userAbout;
      state.userNotes     = migrated.userNotes;
      state.modelUrl      = migrated.modelUrl;
      userNameInput.value  = state.userName;
      userAboutInput.value = state.userAbout;
      userNotesInput.value = state.userNotes;
      elKeyInput.value     = state.elevenLabsKey;
      modelUrlInput.value  = state.modelUrl;
      buildPersonaGrid();
      // Don't migrate old Gemini key — user will need to enter OpenRouter key
    } else {
      state.elevenLabsKey = DEFAULT_ELEVENLABS_KEY;
    }
  }
  applyPersonaTheme();
  updateStatus();
  if(!state.openRouterKey) setTimeout(openKeyCard, 600);
})();

initScene();
createGamerRoom();
loadCharacter(state.modelUrl || DEFAULT_MODEL_URL);
modelUrlInput.value = state.modelUrl || '';

if(!renderHistory()) setLatestLine('say hi to wake her up...', true);
