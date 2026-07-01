import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VRMLoaderPlugin, VRMUtils } from 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@2/lib/three-vrm.module.min.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

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
let bloomComposer;
let currentVrm    = null;
let activeAction  = null;
let idleClipName  = null;
let _cachedClips  = [];

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

// ─── CARPET TEXTURE ──────────────────────────────────────────────────────────
function createCarpetTexture(){
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffb6c1';
  ctx.fillRect(0, 0, 512, 512);
  for(let i = 0; i < 50000; i++){
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const l = 80 + Math.random() * 25;
    ctx.fillStyle = `hsl(340, ${60 + Math.random() * 30}%, ${l}%)`;
    ctx.fillRect(x, y, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

// ─── BEDROOM BUILDER ─────────────────────────────────────────────────────────
function buildBedroom(){
  const R = new THREE.Group();
  R.name = 'bedroom';

  // ── MATERIALS ──────────────────────────────────────────────────────────────
  const matFloor = new THREE.MeshStandardMaterial({ color: 0x3d2820, roughness: 0.8, metalness: 0.05 });
  const matWall = new THREE.MeshStandardMaterial({ color: 0xf5e6f0, roughness: 0.95, metalness: 0 });
  const matCeiling = new THREE.MeshStandardMaterial({ color: 0xfaf0f5, roughness: 0.95, metalness: 0 });
  const matAccentWall = new THREE.MeshStandardMaterial({ color: 0x2a1f35, roughness: 0.85, metalness: 0.05 });
  const matCarpet = new THREE.MeshStandardMaterial({ map: createCarpetTexture(), color: 0xffb6c1, roughness: 1.0, metalness: 0 });
  const matDesk = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.3, metalness: 0.4 });
  const matDeskPink = new THREE.MeshStandardMaterial({ color: 0xff8fd4, roughness: 0.4, metalness: 0.2 });
  const matMonitor = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.15, metalness: 0.7 });
  const matScreen = new THREE.MeshStandardMaterial({ color: 0x1a1a3e, emissive: 0x2233aa, emissiveIntensity: 0.5, roughness: 0.05, metalness: 0.1 });
  const matChair = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.3 });
  const matChairPink = new THREE.MeshStandardMaterial({ color: 0xff8fd4, roughness: 0.5, metalness: 0.1 });
  const matChairChrome = new THREE.MeshStandardMaterial({ color: 0xccccdd, roughness: 0.1, metalness: 0.9 });
  const matDoor = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.2 });
  const matDoorHandle = new THREE.MeshStandardMaterial({ color: 0xff8fd4, roughness: 0.2, metalness: 0.8 });
  const matFrame = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.5, metalness: 0.3 });
  const matGlass = new THREE.MeshStandardMaterial({ color: 0xffe0f0, transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.1, emissive: 0xff8fd4, emissiveIntensity: 0.15, side: THREE.DoubleSide });
  const matPlushPink = new THREE.MeshStandardMaterial({ color: 0xffb6c1, roughness: 0.9, metalness: 0 });
  const matPlushPurple = new THREE.MeshStandardMaterial({ color: 0xb9a6ff, roughness: 0.9, metalness: 0 });
  const matPlantPot = new THREE.MeshStandardMaterial({ color: 0xff8fd4, roughness: 0.6, metalness: 0.1 });
  const matPlantLeaf = new THREE.MeshStandardMaterial({ color: 0x7dcea0, roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const matShelf = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.4, metalness: 0.3 });
  const matLed = new THREE.MeshBasicMaterial({ color: 0xff8fd4 });
  const matLedBlue = new THREE.MeshBasicMaterial({ color: 0x8fc7ff });
  const matLedPurple = new THREE.MeshBasicMaterial({ color: 0xb9a6ff });
  const matNeon = new THREE.MeshBasicMaterial({ color: 0xff1493, transparent: true, opacity: 0.95 });
  const matBaseboard = new THREE.MeshStandardMaterial({ color: 0xf0dce8, roughness: 0.5, metalness: 0.1 });

  // ── ROOM SHELL ─────────────────────────────────────────────────────────────
  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), matFloor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  floor.receiveShadow = true;
  R.add(floor);

  // Ceiling
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(7, 6), matCeiling);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 3;
  R.add(ceiling);

  // Back wall (accent, z = -3)
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(7, 3), matAccentWall);
  backWall.position.set(0, 1.5, -3);
  backWall.receiveShadow = true;
  R.add(backWall);

  // Front wall (z = 3) — with door opening
  const frontL = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3), matWall);
  frontL.position.set(-2.5, 1.5, 3);
  frontL.rotation.y = Math.PI;
  R.add(frontL);
  const frontR = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 3), matWall);
  frontR.position.set(2.5, 1.5, 3);
  frontR.rotation.y = Math.PI;
  R.add(frontR);
  const frontTop = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), matWall);
  frontTop.position.set(0, 2.75, 3);
  frontTop.rotation.y = Math.PI;
  R.add(frontTop);

  // Left wall (x = -3.5)
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), matWall);
  leftWall.position.set(-3.5, 1.5, 0);
  leftWall.rotation.y = Math.PI / 2;
  leftWall.receiveShadow = true;
  R.add(leftWall);

  // Right wall (x = 3.5)
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), matWall);
  rightWall.position.set(3.5, 1.5, 0);
  rightWall.rotation.y = -Math.PI / 2;
  rightWall.receiveShadow = true;
  R.add(rightWall);

  // Baseboards
  [[-3.49, 0.06, 0, 0, Math.PI / 2, 6], [3.49, 0.06, 0, 0, -Math.PI / 2, 6],
   [0, 0.06, -2.99, 0, 0, 7], [0, 0.06, 2.99, 0, Math.PI, 7]].forEach(([x, y, z, rx, ry, w]) => {
    const bb = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.04), matBaseboard);
    bb.position.set(x, y, z);
    bb.rotation.y = ry;
    R.add(bb);
  });

  // ── FLUFFY PINK CARPET ─────────────────────────────────────────────────────
  const carpetGroup = new THREE.Group();
  carpetGroup.name = 'carpet';
  const carpet = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.6, 64, 64), matCarpet);
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.005;
  carpet.receiveShadow = true;
  carpetGroup.add(carpet);

  // Carpet fringe around edges
  const fringeMat = new THREE.MeshStandardMaterial({ color: 0xffd0dd, roughness: 1.0, side: THREE.DoubleSide });
  for(let i = -1.5; i <= 1.5; i += 0.06){
    const f1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.08), fringeMat);
    f1.position.set(i, 0.004, 1.34);
    carpetGroup.add(f1);
    const f2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.08), fringeMat);
    f2.position.set(i, 0.004, -1.34);
    carpetGroup.add(f2);
  }
  for(let i = -1.2; i <= 1.2; i += 0.06){
    const f3 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.02), fringeMat);
    f3.position.set(1.64, 0.004, i);
    carpetGroup.add(f3);
    const f4 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.008, 0.02), fringeMat);
    f4.position.set(-1.64, 0.004, i);
    carpetGroup.add(f4);
  }
  R.add(carpetGroup);

  // ── GAMER DESK ─────────────────────────────────────────────────────────────
  const deskGroup = new THREE.Group();
  deskGroup.name = 'desk';
  deskGroup.position.set(0, 0, -2.5);

  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 0.9), matDesk);
  deskTop.position.y = 0.75;
  deskTop.castShadow = true;
  deskTop.receiveShadow = true;
  deskGroup.add(deskTop);

  // Desk pink trim
  const deskTrim = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.025, 0.025), matDeskPink);
  deskTrim.position.set(0, 0.735, 0.45);
  deskGroup.add(deskTrim);

  // Desk legs
  const legGeo = new THREE.BoxGeometry(0.05, 0.75, 0.05);
  [[-1.5, 0.375, -0.37], [1.5, 0.375, -0.37], [-1.5, 0.375, 0.37], [1.5, 0.375, 0.37]].forEach(p => {
    const leg = new THREE.Mesh(legGeo, matDesk);
    leg.position.set(...p);
    leg.castShadow = true;
    deskGroup.add(leg);
  });

  // Under-desk support bar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.03, 0.03), matDesk);
  bar.position.set(0, 0.15, 0);
  deskGroup.add(bar);

  // Under-desk cable tray
  const tray = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.02, 0.25), matDesk);
  tray.position.set(0, 0.55, -0.2);
  deskGroup.add(tray);

  R.add(deskGroup);

  // ── MONITORS ───────────────────────────────────────────────────────────────
  const monitorsGroup = new THREE.Group();
  monitorsGroup.name = 'monitors';

  // Main monitor (ultrawide)
  const mainScreen = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.72, 0.03), matScreen);
  mainScreen.position.set(0, 1.47, -2.47);
  mainScreen.castShadow = true;
  monitorsGroup.add(mainScreen);
  const mainBezel = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.76, 0.025), matMonitor);
  mainBezel.position.set(0, 1.47, -2.485);
  monitorsGroup.add(mainBezel);
  const mainStand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 8), matMonitor);
  mainStand.position.set(0, 1.05, -2.45);
  monitorsGroup.add(mainStand);
  const mainBase = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.015, 16), matMonitor);
  mainBase.position.set(0, 0.91, -2.45);
  monitorsGroup.add(mainBase);

  // Side monitor
  const sideScreen = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.38, 0.025), matScreen);
  sideScreen.position.set(-0.95, 1.3, -2.45);
  sideScreen.rotation.y = 0.25;
  monitorsGroup.add(sideScreen);
  const sideBezel = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.02), matMonitor);
  sideBezel.position.set(-0.95, 1.3, -2.465);
  sideBezel.rotation.y = 0.25;
  monitorsGroup.add(sideBezel);
  const sideStand = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 8), matMonitor);
  sideStand.position.set(-0.92, 1.05, -2.42);
  monitorsGroup.add(sideStand);
  const sideBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.012, 12), matMonitor);
  sideBase.position.set(-0.92, 0.94, -2.42);
  monitorsGroup.add(sideBase);

  R.add(monitorsGroup);

  // ── KEYBOARD & MOUSE ───────────────────────────────────────────────────────
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.016, 0.16), matMonitor);
  kb.position.set(-0.1, 0.8, -2.3);
  kb.castShadow = true;
  R.add(kb);

  const kbLed = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.005, 0.16), matLed);
  kbLed.position.set(-0.1, 0.815, -2.3);
  R.add(kbLed);

  const mousePad = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.004, 0.24),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.6, metalness: 0.1 }));
  mousePad.position.set(0.6, 0.785, -2.25);
  R.add(mousePad);

  const mouse = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.1), matMonitor);
  mouse.position.set(0.6, 0.81, -2.25);
  mouse.castShadow = true;
  R.add(mouse);

  // ── DESK RGB LED STRIPS ────────────────────────────────────────────────────
  const ledStrip1 = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.012, 0.012), matLed);
  ledStrip1.position.set(0, 0.72, 0.46);
  R.add(ledStrip1);
  const ledStrip2 = new THREE.Mesh(new THREE.BoxGeometry(3.22, 0.012, 0.012), matLedBlue);
  ledStrip2.position.set(0, 0.72, -0.46);
  R.add(ledStrip2);

  // ── GAMING CHAIR ───────────────────────────────────────────────────────────
  const chairGroup = new THREE.Group();
  chairGroup.name = 'chair';
  chairGroup.position.set(0, 0, -1.4);

  // Seat
  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.5), matChair);
  seat.position.y = 0.5;
  seat.castShadow = true;
  chairGroup.add(seat);
  const seatPink = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.015, 0.5), matChairPink);
  seatPink.position.y = 0.548;
  chairGroup.add(seatPink);

  // Backrest
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.07), matChair);
  back.position.set(0, 0.9, -0.22);
  back.castShadow = true;
  chairGroup.add(back);
  const backPink = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.015), matChairPink);
  backPink.position.set(0, 0.9, -0.18);
  chairGroup.add(backPink);

  // Headrest
  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.05), matChair);
  headrest.position.set(0, 1.32, -0.22);
  chairGroup.add(headrest);

  // Side bolsters
  const bolsterGeo = new THREE.BoxGeometry(0.05, 0.55, 0.06);
  const bolsterL = new THREE.Mesh(bolsterGeo, matChairPink);
  bolsterL.position.set(-0.24, 0.88, -0.2);
  chairGroup.add(bolsterL);
  const bolsterR = new THREE.Mesh(bolsterGeo, matChairPink);
  bolsterR.position.set(0.24, 0.88, -0.2);
  chairGroup.add(bolsterR);

  // Armrests
  const armGeo = new THREE.BoxGeometry(0.06, 0.025, 0.28);
  const armL = new THREE.Mesh(armGeo, matChair);
  armL.position.set(-0.3, 0.7, -0.05);
  chairGroup.add(armL);
  const armR = new THREE.Mesh(armGeo, matChair);
  armR.position.set(0.3, 0.7, -0.05);
  chairGroup.add(armR);

  // Armrest supports
  const armSupGeo = new THREE.BoxGeometry(0.035, 0.2, 0.035);
  const armSupL = new THREE.Mesh(armSupGeo, matChairChrome);
  armSupL.position.set(-0.3, 0.6, -0.05);
  chairGroup.add(armSupL);
  const armSupR = new THREE.Mesh(armSupGeo, matChairChrome);
  armSupR.position.set(0.3, 0.6, -0.05);
  chairGroup.add(armSupR);

  // Gas lift column
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.35, 12), matChairChrome);
  column.position.y = 0.28;
  chairGroup.add(column);

  // Chair base (star)
  for(let i = 0; i < 5; i++){
    const angle = (i / 5) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.25), matChairChrome);
    spoke.position.set(Math.sin(angle) * 0.12, 0.1, Math.cos(angle) * 0.12);
    spoke.rotation.y = -angle;
    chairGroup.add(spoke);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), matMonitor);
    wheel.position.set(Math.sin(angle) * 0.24, 0.02, Math.cos(angle) * 0.24);
    chairGroup.add(wheel);
  }

  R.add(chairGroup);

  // ── DOOR ───────────────────────────────────────────────────────────────────
  const doorGroup = new THREE.Group();
  doorGroup.name = 'door';
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.15, 0.06), matDoor);
  doorPanel.position.set(0, 1.1, 0);
  doorPanel.castShadow = true;
  doorGroup.add(doorPanel);

  // Door frame
  const frameMat = matFrame;
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.25, 0.1), frameMat);
  frameL.position.set(-0.5, 1.15, 0);
  doorGroup.add(frameL);
  const frameR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.25, 0.1), frameMat);
  frameR.position.set(0.5, 1.15, 0);
  doorGroup.add(frameR);
  const frameTop = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.06, 0.1), frameMat);
  frameTop.position.set(0, 2.27, 0);
  doorGroup.add(frameTop);

  // Door handle
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 8), matDoorHandle);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.35, 1.05, 0.04);
  doorGroup.add(handle);
  const handlePlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.01), matDoorHandle);
  handlePlate.position.set(0.35, 1.05, 0.04);
  doorGroup.add(handlePlate);

  // Door panel details (rectangular inset)
  const panelDetail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.005),
    new THREE.MeshStandardMaterial({ color: 0x222240, roughness: 0.5, metalness: 0.2 }));
  panelDetail.position.set(0, 1.45, 0.035);
  doorGroup.add(panelDetail);

  doorGroup.position.set(0.5, 0, 2.97);
  R.add(doorGroup);

  // ── NEON "UwU" SIGN ────────────────────────────────────────────────────────
  const neonGroup = new THREE.Group();
  neonGroup.name = 'neon-uwu';

  function makeNeonTube(pts, radius = 0.02){
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 48, radius, 8, false), matNeon);
  }

  // U letter
  const uPts = [
    new THREE.Vector3(-0.29, 0.13, 0), new THREE.Vector3(-0.29, 0.04, 0),
    new THREE.Vector3(-0.29, -0.06, 0), new THREE.Vector3(-0.22, -0.12, 0),
    new THREE.Vector3(-0.15, -0.13, 0), new THREE.Vector3(-0.08, -0.12, 0),
    new THREE.Vector3(-0.01, -0.06, 0), new THREE.Vector3(-0.01, 0.04, 0),
    new THREE.Vector3(-0.01, 0.13, 0)
  ];
  neonGroup.add(makeNeonTube(uPts));

  // w letter
  const wPts = [
    new THREE.Vector3(0.05, 0.13, 0), new THREE.Vector3(0.05, 0.02, 0),
    new THREE.Vector3(0.05, -0.08, 0), new THREE.Vector3(0.09, -0.13, 0),
    new THREE.Vector3(0.13, -0.06, 0), new THREE.Vector3(0.17, -0.13, 0),
    new THREE.Vector3(0.21, -0.06, 0), new THREE.Vector3(0.25, -0.13, 0),
    new THREE.Vector3(0.29, -0.08, 0), new THREE.Vector3(0.29, 0.02, 0),
    new THREE.Vector3(0.29, 0.13, 0)
  ];
  neonGroup.add(makeNeonTube(wPts));

  // U letter (second)
  const u2Pts = [
    new THREE.Vector3(0.35, 0.13, 0), new THREE.Vector3(0.35, 0.04, 0),
    new THREE.Vector3(0.35, -0.06, 0), new THREE.Vector3(0.42, -0.12, 0),
    new THREE.Vector3(0.49, -0.13, 0), new THREE.Vector3(0.56, -0.12, 0),
    new THREE.Vector3(0.63, -0.06, 0), new THREE.Vector3(0.63, 0.04, 0),
    new THREE.Vector3(0.63, 0.13, 0)
  ];
  neonGroup.add(makeNeonTube(u2Pts));

  // Neon glow backing plate
  const neonBack = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.38, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.8, metalness: 0.2, transparent: true, opacity: 0.6 }));
  neonBack.position.set(0.17, 0, -0.02);
  neonGroup.add(neonBack);

  neonGroup.position.set(0, 2.3, -2.95);
  R.add(neonGroup);

  // ── WINDOWS ────────────────────────────────────────────────────────────────
  function makeWindow(x, z, ry){
    const g = new THREE.Group();

    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.06), matFrame);
    g.add(frame);

    // Cross bars
    const hBar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.07), matFrame);
    hBar.position.z = 0.01;
    g.add(hBar);
    const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.0, 0.07), matFrame);
    vBar.position.z = 0.01;
    g.add(vBar);

    // Glass panes
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), matGlass);
    glass.position.set(-0.33, 0.28, 0.02);
    g.add(glass);
    const glass2 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), matGlass);
    glass2.position.set(0.33, 0.28, 0.02);
    g.add(glass2);
    const glass3 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), matGlass);
    glass3.position.set(-0.33, -0.28, 0.02);
    g.add(glass3);
    const glass4 = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.45), matGlass);
    glass4.position.set(0.33, -0.28, 0.02);
    g.add(glass4);

    // Skyline backdrop
    const skyGroup = new THREE.Group();
    const skyBg = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.0),
      new THREE.MeshBasicMaterial({ color: 0x2a1540 }));
    skyBg.position.z = -0.06;
    skyGroup.add(skyBg);

    const skyGrad = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x4a2560, transparent: true, opacity: 0.7 }));
    skyGrad.position.set(0, 0.2, -0.055);
    skyGroup.add(skyGrad);

    // Stars
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for(let i = 0; i < 8; i++){
      const star = new THREE.Mesh(new THREE.SphereGeometry(0.003, 4, 4), starMat);
      star.position.set(-0.55 + Math.random() * 1.1, 0.1 + Math.random() * 0.35, -0.05);
      skyGroup.add(star);
    }

    // City skyline buildings
    const bMat = new THREE.MeshBasicMaterial({ color: 0x1a0a2e });
    const bMatLit = new THREE.MeshBasicMaterial({ color: 0x2a1540 });
    for(let i = 0; i < 12; i++){
      const bx = -0.55 + i * 0.095 + (Math.random() - 0.5) * 0.03;
      const bh = 0.04 + Math.random() * 0.16;
      const bw = 0.04 + Math.random() * 0.05;
      const building = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.01), Math.random() > 0.3 ? bMat : bMatLit);
      building.position.set(bx, -0.5 + bh / 2, -0.045);
      skyGroup.add(building);

      // Window lights
      if(bh > 0.08 && Math.random() > 0.4){
        const winCount = Math.floor(Math.random() * 3) + 1;
        for(let w = 0; w < winCount; w++){
          const win = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.006, 0.001),
            new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xffd700 : 0xff8fd4 }));
          win.position.set(bx + (Math.random() - 0.5) * bw * 0.6, -0.5 + 0.02 + Math.random() * (bh - 0.04), -0.04);
          skyGroup.add(win);
        }
      }
    }

    // Moon
    const moon = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16),
      new THREE.MeshBasicMaterial({ color: 0xffeedd }));
    moon.position.set(0.4, 0.35, -0.05);
    skyGroup.add(moon);

    // Clouds
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0x5a3570, transparent: true, opacity: 0.35 });
    for(let i = 0; i < 3; i++){
      const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.04 + Math.random() * 0.03, 8, 6), cloudMat);
      cloud.scale.set(1.8, 0.6, 0.5);
      cloud.position.set(-0.4 + Math.random() * 0.8, 0.15 + Math.random() * 0.2, -0.05);
      skyGroup.add(cloud);
    }

    skyGroup.position.z = -0.03;
    g.add(skyGroup);

    // Window sill
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.12), matFrame);
    sill.position.set(0, -0.58, 0.06);
    g.add(sill);

    g.position.set(x, 1.7, z);
    g.rotation.y = ry;
    return g;
  }

  R.add(makeWindow(-3.45, -1, Math.PI / 2));
  R.add(makeWindow(-3.45, 1, Math.PI / 2));
  R.add(makeWindow(3.45, -1, -Math.PI / 2));
  R.add(makeWindow(3.45, 1, -Math.PI / 2));

  // ── WALL SHELVES ───────────────────────────────────────────────────────────
  function makeShelf(x, y, z, ry, w = 0.7){
    const g = new THREE.Group();
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(w, 0.035, 0.18), matShelf);
    shelf.castShadow = true;
    g.add(shelf);
    const bracketL = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.14), matShelf);
    bracketL.position.set(-w / 2 + 0.08, -0.075, 0);
    g.add(bracketL);
    const bracketR = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.12, 0.14), matShelf);
    bracketR.position.set(w / 2 - 0.08, -0.075, 0);
    g.add(bracketR);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    return g;
  }

  // Left wall shelves
  R.add(makeShelf(-3.38, 1.8, -0.8, Math.PI / 2, 0.8));
  R.add(makeShelf(-3.38, 2.2, 0.6, Math.PI / 2, 0.6));

  // Right wall shelf
  R.add(makeShelf(3.38, 2.0, 0.5, -Math.PI / 2, 0.7));

  // ── PLUSHIES & CAT DECORATIONS ─────────────────────────────────────────────
  // Cat plushie 1 (on left shelf)
  const plushie1 = new THREE.Group();
  const pBody1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), matPlushPink);
  pBody1.scale.set(1, 0.85, 0.9);
  plushie1.add(pBody1);
  const pEarL1 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), matPlushPink);
  pEarL1.position.set(-0.05, 0.08, 0);
  pEarL1.rotation.z = -0.2;
  plushie1.add(pEarL1);
  const pEarR1 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 4), matPlushPink);
  pEarR1.position.set(0.05, 0.08, 0);
  pEarR1.rotation.z = 0.2;
  plushie1.add(pEarR1);
  const pEyeL1 = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pEyeL1.position.set(-0.03, 0.02, 0.07);
  plushie1.add(pEyeL1);
  const pEyeR1 = new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pEyeR1.position.set(0.03, 0.02, 0.07);
  plushie1.add(pEyeR1);
  const pNose1 = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff6ba8 }));
  pNose1.position.set(0, -0.01, 0.075);
  plushie1.add(pNose1);
  plushie1.position.set(-3.25, 1.92, -0.8);
  R.add(plushie1);

  // Cat plushie 2 (on right shelf)
  const plushie2 = new THREE.Group();
  const pBody2 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), matPlushPurple);
  pBody2.scale.set(1, 0.9, 0.85);
  plushie2.add(pBody2);
  const pEarL2 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), matPlushPurple);
  pEarL2.position.set(-0.04, 0.07, 0);
  pEarL2.rotation.z = -0.2;
  plushie2.add(pEarL2);
  const pEarR2 = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.05, 4), matPlushPurple);
  pEarR2.position.set(0.04, 0.07, 0);
  pEarR2.rotation.z = 0.2;
  plushie2.add(pEarR2);
  const pEyeL2 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pEyeL2.position.set(-0.025, 0.015, 0.06);
  plushie2.add(pEyeL2);
  const pEyeR2 = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: 0x111111 }));
  pEyeR2.position.set(0.025, 0.015, 0.06);
  plushie2.add(pEyeR2);
  plushie2.position.set(3.25, 2.12, 0.5);
  R.add(plushie2);

  // ── PLANTS ─────────────────────────────────────────────────────────────────
  function makePlant(x, y, z, scale = 1){
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 10), matPlantPot);
    g.add(pot);
    const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.015, 10),
      new THREE.MeshStandardMaterial({ color: 0x3d2820, roughness: 1 }));
    soil.position.y = 0.04;
    g.add(soil);
    for(let i = 0; i < 5; i++){
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 6), matPlantLeaf);
      leaf.scale.set(0.6, 1.2, 0.6);
      leaf.position.set(
        (Math.random() - 0.5) * 0.06,
        0.08 + Math.random() * 0.06,
        (Math.random() - 0.5) * 0.06
      );
      leaf.rotation.set(Math.random() * 0.4 - 0.2, Math.random() * Math.PI, Math.random() * 0.3);
      g.add(leaf);
    }
    g.position.set(x, y, z);
    g.scale.setScalar(scale);
    return g;
  }

  // Plants on window sills and shelves
  R.add(makePlant(-3.25, 1.15, -1, 0.9));
  R.add(makePlant(3.25, 1.15, 1, 0.8));
  R.add(makePlant(-3.25, 2.32, 0.6, 0.7));
  R.add(makePlant(1.55, 0.78, -2.5, 0.6));

  // ── WALL POSTERS ───────────────────────────────────────────────────────────
  function makePoster(x, y, z, ry, w, h, color){
    const g = new THREE.Group();
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }));
    g.add(poster);
    const border = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.03, h + 0.03),
      new THREE.MeshStandardMaterial({ color: 0xf0dce8, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide }));
    border.position.z = -0.003;
    g.add(border);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    return g;
  }

  // Posters on back wall
  R.add(makePoster(-1.8, 1.9, -2.97, 0, 0.5, 0.7, 0xffb6c1));
  R.add(makePoster(1.8, 1.9, -2.97, 0, 0.5, 0.7, 0xb9a6ff));

  // Poster on left wall
  R.add(makePoster(-3.47, 1.8, 1.8, Math.PI / 2, 0.6, 0.45, 0xff8fd4));

  // ── CEILING LIGHT ──────────────────────────────────────────────────────────
  const ceilLight = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.04, 16), matDeskPink);
  ceilLight.position.set(0, 2.98, -0.5);
  R.add(ceilLight);
  const ceilBulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfff5f8 }));
  ceilBulb.position.set(0, 2.92, -0.5);
  R.add(ceilBulb);

  // ── DESK LAMP ──────────────────────────────────────────────────────────────
  const lampGroup = new THREE.Group();
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.02, 12), matDeskPink);
  lampGroup.add(lampBase);
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3, 8), matChairChrome);
  lampPole.position.y = 0.16;
  lampGroup.add(lampPole);
  const lampHead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.08, 12, 1, true), matDeskPink);
  lampHead.position.y = 0.33;
  lampHead.rotation.x = Math.PI;
  lampGroup.add(lampHead);
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff5f8 }));
  lampBulb.position.y = 0.3;
  lampGroup.add(lampBulb);
  lampGroup.position.set(1.3, 0.78, -2.5);
  R.add(lampGroup);

  // ── CAT-EAR HEADPHONES ─────────────────────────────────────────────────────
  const hpGroup = new THREE.Group();
  const hpBand = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.008, 8, 16, Math.PI), matMonitor);
  hpBand.rotation.x = Math.PI;
  hpBand.position.y = 0.06;
  hpGroup.add(hpBand);
  const hpCupL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 10), matDeskPink);
  hpCupL.position.set(-0.08, 0, 0);
  hpCupL.rotation.z = Math.PI / 2;
  hpGroup.add(hpCupL);
  const hpCupR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 10), matDeskPink);
  hpCupR.position.set(0.08, 0, 0);
  hpCupR.rotation.z = Math.PI / 2;
  hpGroup.add(hpCupR);
  // Cat ears on headphones
  const hpEarL = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), matDeskPink);
  hpEarL.position.set(-0.06, 0.08, 0);
  hpGroup.add(hpEarL);
  const hpEarR = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 4), matDeskPink);
  hpEarR.position.set(0.06, 0.08, 0);
  hpGroup.add(hpEarR);
  hpGroup.position.set(-0.7, 0.82, -2.4);
  hpGroup.rotation.y = 0.3;
  R.add(hpGroup);

  // ── SMALL DECORATIVE ITEMS ─────────────────────────────────────────────────
  // Cat figurine on shelf
  const catFig = new THREE.Group();
  const catBody2 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 8), matDeskPink);
  catBody2.scale.set(1, 0.8, 1.2);
  catFig.add(catBody2);
  const catHead2 = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), matDeskPink);
  catHead2.position.set(0, 0.04, 0.03);
  catFig.add(catHead2);
  const catEarL2 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 4), matDeskPink);
  catEarL2.position.set(-0.02, 0.07, 0.03);
  catFig.add(catEarL2);
  const catEarR2 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.025, 4), matDeskPink);
  catEarR2.position.set(0.02, 0.07, 0.03);
  catFig.add(catEarR2);
  catFig.position.set(-3.25, 2.32, 0.6);
  catFig.scale.setScalar(1.2);
  R.add(catFig);

  // ── RGB LED ACCENT STRIPS ──────────────────────────────────────────────────
  // Under-desk LED
  const underLed = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.008, 0.008), matLed);
  underLed.position.set(0, 0.74, 0.44);
  R.add(underLed);

  // Floor LED strips (along walls)
  const floorLed1 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 6), matLedPurple);
  floorLed1.position.set(-3.48, 0.01, 0);
  R.add(floorLed1);
  const floorLed2 = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 6), matLedPurple);
  floorLed2.position.set(3.48, 0.01, 0);
  R.add(floorLed2);
  const floorLed3 = new THREE.Mesh(new THREE.BoxGeometry(7, 0.008, 0.008), matLed);
  floorLed3.position.set(0, 0.01, -2.98);
  R.add(floorLed3);

  // ── LED ACCENT LIGHTS AROUND DESK ──────────────────────────────────────────
  const accentLight1 = new THREE.PointLight(0xff8fd4, 2.5, 3);
  accentLight1.position.set(0, 1.0, -2.0);
  R.add(accentLight1);

  const accentLight2 = new THREE.PointLight(0xb9a6ff, 1.5, 2.5);
  accentLight2.position.set(-1.2, 1.2, -2.3);
  R.add(accentLight2);

  const accentLight3 = new THREE.PointLight(0x8fc7ff, 1.2, 2);
  accentLight3.position.set(1.2, 1.2, -2.3);
  R.add(accentLight3);

  // ── SOFT ROOM FILL LIGHTS ──────────────────────────────────────────────────
  const roomFill1 = new THREE.PointLight(0xffc1ea, 1.0, 5);
  roomFill1.position.set(0, 2.5, 0);
  R.add(roomFill1);

  const roomFill2 = new THREE.PointLight(0xffe0f0, 0.6, 4);
  roomFill2.position.set(-2, 1.5, 1);
  R.add(roomFill2);

  const roomFill3 = new THREE.PointLight(0xffe0f0, 0.6, 4);
  roomFill3.position.set(2, 1.5, 1);
  R.add(roomFill3);

  scene.add(R);
}

// ─── SCENE INIT ──────────────────────────────────────────────────────────────
function initScene(){
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 100);
  camera.position.set(0, 1.45, 2.0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  // ── LIGHTING ─────────────────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffe0f0, 0.35));
  scene.add(new THREE.HemisphereLight(0xffc1ea, 0x140c1f, 0.5));

  const key = new THREE.DirectionalLight(0xfff0f8, 1.0);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 15;
  key.shadow.camera.left = -5;
  key.shadow.camera.right = 5;
  key.shadow.camera.top = 5;
  key.shadow.camera.bottom = -5;
  key.shadow.bias = -0.0005;
  scene.add(key);

  const rim = new THREE.PointLight(0xff8fd4, 4, 12);
  rim.position.set(-2.5, 1.5, -2);
  scene.add(rim);

  const rim2 = new THREE.PointLight(0xb9a6ff, 2, 10);
  rim2.position.set(2, 0.5, -2.5);
  scene.add(rim2);

  // ── BUILD BEDROOM ──────────────────────────────────────────────────────
  buildBedroom();

  // ── POST-PROCESSING (BLOOM) ────────────────────────────────────────────
  bloomComposer = new EffectComposer(renderer);
  bloomComposer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.7,   // strength
    0.4,   // radius
    0.85   // threshold
  );
  bloomComposer.addPass(bloomPass);

  // ── CONTROLS ───────────────────────────────────────────────────────────
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance   = 0.6;
  controls.maxDistance   = 5;
  controls.maxPolarAngle = Math.PI * 0.55;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.touches       = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  controls.update();

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 200));
  animate();
}

function onResize(){
  const w = window.innerWidth, h = window.innerHeight;
  if(!w || !h) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  if(bloomComposer) bloomComposer.setSize(w, h);
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
  const tailWag = Math.sin(t * 0.8) * 0.15;
  const tailZ = Math.cos(t * 0.6) * 0.12;
  setBoneRot('tail', tailWag * 0.3, tailWag * 0.5, tailZ);

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
  if(bloomComposer){
    bloomComposer.render();
  } else {
    renderer.render(scene, camera);
  }
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
  if(!key){ startLipFallback(fallbackMs); return; }
  if(voiceAudioUrl){
    URL.revokeObjectURL(voiceAudioUrl);
    voiceAudioUrl = '';
  }
  voiceAudio.pause();
  voiceAudio.removeAttribute('src');
  voiceAudio.load();
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
const orKeyInput     = document.getElementById('gemini-key');
const elKeyInput     = document.getElementById('elevenlabs-key');
const modelUrlInput  = document.getElementById('model-url-input');
const statusPill     = document.getElementById('status-pill');
const statusText     = document.getElementById('status-text');
const keyCardInput   = document.getElementById('key-card-input');

(function relabelKeyField(){
  const label = document.querySelector('label[for="gemini-key"]');
  if(label) label.textContent = 'OpenRouter API key';
  const note = orKeyInput?.closest('.field')?.querySelector('.note');
  if(note) note.innerHTML = 'Free at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener">openrouter.ai/keys</a>. Default model: <code>' + DEFAULT_MODEL_ID + '</code>.';
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
    } else {
      state.elevenLabsKey = DEFAULT_ELEVENLABS_KEY;
    }
  }
  applyPersonaTheme();
  updateStatus();
  if(!state.openRouterKey) setTimeout(openKeyCard, 600);
})();

initScene();
loadCharacter(state.modelUrl || DEFAULT_MODEL_URL);
modelUrlInput.value = state.modelUrl || '';

if(!renderHistory()) setLatestLine('say hi to wake her up...', true);
