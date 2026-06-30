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
  openRouterKey:   '',
  elevenLabsKey:   '',
  modelId:         DEFAULT_MODEL_ID,
  personaId:       'sweet',
  userName:        '',
  userAbout:       '',
  userNotes:       '',
  history:         [],        // { role, content, ts? }
  isSending:       false,
  modelUrl:        '',
  lastMessageTime: null,      // Date of the last message sent/received
};

function getPersona(){ return PERSONAS.find(p => p.id === state.personaId) || PERSONAS[0]; }

// ─── TIME AWARENESS ──────────────────────────────────────────────────────────
function getTimeContext(){
  const now = new Date();
  const dayNames  = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const monthNames= ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const dayName   = dayNames[now.getDay()];
  const monthName = monthNames[now.getMonth()];
  const day       = now.getDate();
  const year      = now.getFullYear();
  let   hours     = now.getHours();
  const minutes   = String(now.getMinutes()).padStart(2,'0');
  const ampm      = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const timeStr   = `${hours}:${minutes} ${ampm}`;

  let timeOfDay = 'late night';
  const h24 = now.getHours();
  if(h24 >= 5  && h24 < 12) timeOfDay = 'morning';
  else if(h24 >= 12 && h24 < 17) timeOfDay = 'afternoon';
  else if(h24 >= 17 && h24 < 21) timeOfDay = 'evening';
  else if(h24 >= 21)             timeOfDay = 'night';

  let gapNote = '';
  if(state.lastMessageTime){
    const gapMs  = now - state.lastMessageTime;
    const gapMin = Math.floor(gapMs / 60000);
    const gapHr  = Math.floor(gapMin / 60);
    const gapDay = Math.floor(gapHr  / 24);

    if     (gapDay >= 2)  gapNote = `It has been ${gapDay} days since the user last spoke to you.`;
    else if(gapDay === 1) gapNote = `It has been about a day since the user last spoke to you.`;
    else if(gapHr  >= 2)  gapNote = `It has been about ${gapHr} hours since the user last spoke to you.`;
    else if(gapHr  === 1) gapNote = `It has been about an hour since the user last spoke to you.`;
    else if(gapMin >= 10) gapNote = `It has been ${gapMin} minutes since the user last spoke to you.`;
  }

  return (
    `Current time: ${timeStr} on ${dayName}, ${monthName} ${day}, ${year} (${timeOfDay}).` +
    (gapNote ? ' ' + gapNote : '')
  );
}

function buildSystemPrompt(){
  const p = getPersona();
  let prompt = p.prompt;
  const bits = [];
  if(state.userName)  bits.push(`The user's name is ${state.userName}.`);
  if(state.userAbout) bits.push(`About them: ${state.userAbout}`);
  if(state.userNotes) bits.push(`Keep in mind: ${state.userNotes}`);
  if(bits.length) prompt += '\n\nWhat you know about this person:\n' + bits.join('\n');
  prompt += '\n\n' + getTimeContext();
  prompt += '\nUse your knowledge of the current time and day naturally in conversation when relevant — e.g. if it\'s very late, you might notice. If the user has been away a long time, you can acknowledge it warmly without making it weird.';
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

let idleTime = 0;
let useProceduralIdle = false;

const canvas       = document.getElementById('canvas-3d');
const loadingVeil  = document.getElementById('loading-veil');
const animControls = document.getElementById('anim-controls');
const moodWord     = document.getElementById('mood-word');

function initScene(){
  scene  = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(35, window.innerWidth / Math.max(window.innerHeight, 1), 0.1, 100);
  camera.position.set(0, 1.45, 2.0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;

  scene.add(new THREE.HemisphereLight(0xffc1ea, 0x140c1f, 0.7));

  const key = new THREE.DirectionalLight(0xfff0f8, 1.4);
  key.position.set(2.5, 4, 3);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  scene.add(key);

  const rim = new THREE.PointLight(0xff8fd4, 6, 12);
  rim.position.set(-2.5, 1.5, -2);
  scene.add(rim);

  const rim2 = new THREE.PointLight(0xb9a6ff, 2.6, 10);
  rim2.position.set(2, 0.5, -2.5);
  scene.add(rim2);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(2.6, 64),
    new THREE.MeshStandardMaterial({ color: 0x150e1c, metalness: 0.6, roughness: 0.35, emissive: 0x230f1d, emissiveIntensity: 0.4 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.55, 2.62, 64),
    new THREE.MeshBasicMaterial({ color: 0xff8fd4, side: THREE.DoubleSide, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.001;
  scene.add(ring);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.45, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance   = 0.6;
  controls.maxDistance   = 4;
  controls.maxPolarAngle = Math.PI * 0.6;
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
}

// ─── FACIAL EXPRESSIONS (VRM BlendShapes) ────────────────────────────────────
// Mood → blend shape preset name mappings (VRM 0.x and 1.x names)
const EXPR_MAP = {
  happy:     ['happy',    'Joy'],
  sad:       ['sad',      'Sorrow'],
  angry:     ['angry',    'Angry'],
  surprised: ['surprised','Surprised'],
  thinking:  ['relaxed',  'Relaxed'],   // closest "pondering" neutral
  neutral:   ['neutral',  'Neutral'],
  blink:     ['blink',    'Blink'],
  blinkL:    ['blinkLeft','BlinkLeft'],
  blinkR:    ['blinkRight','BlinkRight'],
};

// Current expression target and current values for lerping
let exprTarget  = 'neutral';
let exprCurrent = {};   // name → current weight 0‒1
let exprBlinkTimer = 0;
let exprBlinkState = 'open';  // 'open' | 'closing' | 'opening'
let exprBlinkT     = 0;
const BLINK_INTERVAL_MIN = 2.5;
const BLINK_INTERVAL_MAX = 7.0;
let nextBlink = randomBlinkDelay();

function randomBlinkDelay(){ return BLINK_INTERVAL_MIN + Math.random() * (BLINK_INTERVAL_MAX - BLINK_INTERVAL_MIN); }

// Return the VRM expression manager (works for VRM 0 and 1)
function getExprManager(){
  if(!currentVrm) return null;
  return currentVrm.expressionManager || currentVrm.blendShapeProxy || null;
}

// Set a named VRM expression to a weight, trying all alias names
function setVRMExpr(manager, names, weight){
  if(!manager) return;
  for(const n of names){
    try{ manager.setValue(n, weight); } catch(e){}
  }
}

// Kick off a mood expression (fades out after `duration` ms, default 4s)
function setFacialExpression(mood, duration = 4000){
  if(!getExprManager()) return;
  exprTarget = mood;
  if(duration > 0){
    setTimeout(() => { if(exprTarget === mood) exprTarget = 'neutral'; }, duration);
  }
}

// Tick expressions every frame — lerps between neutral and target
function tickExpressions(dt){
  const manager = getExprManager();
  if(!manager) return;

  const ALL_MOODS = ['happy','sad','angry','surprised','thinking','neutral'];
  const targetNames = EXPR_MAP[exprTarget] || EXPR_MAP['neutral'];

  for(const mood of ALL_MOODS){
    const names   = EXPR_MAP[mood];
    const isTarget = (mood === exprTarget);
    const cur      = exprCurrent[mood] || 0;
    const goal     = isTarget ? 1 : 0;
    const speed    = isTarget ? 3.5 : 2.5;
    const next     = cur + (goal - cur) * Math.min(1, dt * speed);
    exprCurrent[mood] = next;
    setVRMExpr(manager, names, Math.max(0, Math.min(1, next)));
  }

  // Auto-blink
  exprBlinkTimer += dt;
  if(exprBlinkState === 'open' && exprBlinkTimer >= nextBlink){
    exprBlinkState = 'closing';
    exprBlinkT     = 0;
    nextBlink      = randomBlinkDelay();
    exprBlinkTimer = 0;
  }
  if(exprBlinkState === 'closing'){
    exprBlinkT += dt * 10;
    const w = Math.min(1, exprBlinkT);
    setVRMExpr(manager, EXPR_MAP['blink'],  w);
    setVRMExpr(manager, EXPR_MAP['blinkL'], w);
    setVRMExpr(manager, EXPR_MAP['blinkR'], w);
    if(exprBlinkT >= 1){ exprBlinkState = 'opening'; exprBlinkT = 0; }
  } else if(exprBlinkState === 'opening'){
    exprBlinkT += dt * 8;
    const w = Math.max(0, 1 - exprBlinkT);
    setVRMExpr(manager, EXPR_MAP['blink'],  w);
    setVRMExpr(manager, EXPR_MAP['blinkL'], w);
    setVRMExpr(manager, EXPR_MAP['blinkR'], w);
    if(exprBlinkT >= 1){ exprBlinkState = 'open'; exprBlinkT = 0; }
  }
}

// Derive facial expression from reply text keywords
function exprFromReply(text){
  const l = text.toLowerCase();
  if(/\b(yay|woohoo|amazing|awesome|love|happy|hehe|nyah|uwu|excited|hype|wag)\b/.test(l))   return 'happy';
  if(/\b(ugh|seriously|annoying|stop it|come on|eye.?roll|sigh)\b/.test(l))                   return 'angry';
  if(/\b(oh no|sad|sorry|miss|miss you|:(|aww)\b/.test(l))                                    return 'sad';
  if(/\b(wait|what|really|no way|omg|seriously\?|whoa|wow)\b/.test(l))                        return 'surprised';
  if(/\b(hmm|interesting|thinking|wonder|well|actually|honestly)\b/.test(l))                  return 'thinking';
  return 'neutral';
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

  // Tail sway
  const tailWag = Math.sin(t * 0.8) * 0.15;
  const tailZ = Math.cos(t * 0.6) * 0.12;
  setBoneRot('tail', tailWag * 0.3, tailWag * 0.5, tailZ);
  for(let i = 1; i <= 3; i++){
    const boneName = 'tail' + i;
    const bone = humanoid.getNormalizedBoneNode(boneName);
    if(bone){
      const offset = i * 0.3;
      setBoneRot(boneName, Math.sin(t * 0.8 + offset) * 0.12 * 0.2, Math.sin(t * 0.8 + offset) * 0.12 * 0.4, Math.cos(t * 0.6 + offset) * 0.1);
    }
  }

  currentVrm.update(dt);
}

function animate(){
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if(mixer) mixer.update(dt);

  if(useProceduralIdle){
    tickProceduralIdle(dt);
  } else if(currentVrm){
    currentVrm.update(dt);
  }

  // Facial expressions tick every frame regardless of anim mode
  tickExpressions(dt);

  if(controls) controls.update();
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
  exprCurrent       = {};
  exprTarget        = 'neutral';

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

  loadingVeil.classList.add('hidden');
  setMood('curious');
  setFacialExpression('neutral', 0);
}

function onModelError(err){
  console.error('Model load failed', err);
  loadingVeil.querySelector('.ltext').textContent = 'failed to load · check URL & CORS';
  setTimeout(() => loadingVeil.classList.add('hidden'), 1400);
  pushSystemMsg("Couldn't load that model — make sure the URL is public and the host allows CORS.");
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

// ─── MOOD / REACTION SYSTEM ──────────────────────────────────────────────────
function setMood(word){ moodWord.textContent = word; }

function reactToUserMessage(){
  setMood('listening');
  setFacialExpression('neutral', 0);
  tryPlayByPattern(/wave|greet|hello/i, false);
}

function reactWhileThinking(){
  setMood('thinking');
  setFacialExpression('thinking', 0);
  tryPlayByPattern(/think|ponder/i, true);
}

function reactToReply(replyText){
  setMood('speaking');
  const expr = exprFromReply(replyText);
  setFacialExpression(expr, 4500);
  detectAndPlayKeywordAnim(replyText);
  setTimeout(() => {
    setMood('curious');
    setFacialExpression('neutral', 0);
    if(idleClipName){
      playClip(idleClipName, true);
    } else {
      useProceduralIdle = true;
    }
  }, 3000);
}

// ─── TEXT-TO-SPEECH (ElevenLabs) ─────────────────────────────────────────────
let currentAudio = null;

async function speakText(text){
  const key = state.elevenLabsKey;
  if(!key || !text) return;
  if(currentAudio){ currentAudio.pause(); currentAudio = null; }
  const clean = text.replace(/[*_`#~>]/g, '').replace(/\n+/g, ' ').trim();
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
    if(!res.ok){ console.warn('ElevenLabs TTS error', res.status); return; }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    currentAudio = new Audio(url);
    currentAudio.play();
    currentAudio.addEventListener('ended', () => { URL.revokeObjectURL(url); currentAudio = null; });
  } catch(e){ console.warn('TTS fetch failed', e); }
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

// ─── REGEN / CONTINUE BUTTONS ────────────────────────────────────────────────
let lastLunaBubble = null;   // tracks the most recent Luna .bubble element

function addRegenContinueButtons(msgWrap){
  // Remove buttons from any previously last Luna message
  const old = fullChatScroll.querySelectorAll('.regen-bar');
  old.forEach(el => el.remove());

  const bar = document.createElement('div');
  bar.className = 'regen-bar';

  const regenBtn = document.createElement('button');
  regenBtn.className   = 'ghost-btn regen-action';
  regenBtn.innerHTML   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg><span>Regenerate</span>`;
  regenBtn.title       = 'Regenerate this reply';
  regenBtn.addEventListener('click', () => regenerateLastReply());

  const contBtn = document.createElement('button');
  contBtn.className   = 'ghost-btn regen-action';
  contBtn.innerHTML   = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="9 18 15 12 9 6"/></svg><span>Continue</span>`;
  contBtn.title       = 'Ask her to continue';
  contBtn.addEventListener('click', () => continueLastReply());

  bar.appendChild(regenBtn);
  bar.appendChild(contBtn);
  msgWrap.appendChild(bar);
}

async function regenerateLastReply(){
  // Pop the last assistant message from history, re-send
  if(state.isSending) return;
  const lastIdx = [...state.history].reverse().findIndex(m => m.role === 'assistant');
  if(lastIdx === -1) return;
  const realIdx = state.history.length - 1 - lastIdx;
  state.history.splice(realIdx, 1);

  // Remove last Luna message from UI
  const lunaMessages = fullChatScroll.querySelectorAll('.msg.from-luna');
  if(lunaMessages.length) lunaMessages[lunaMessages.length - 1].remove();
  // Remove any stale regen bars
  fullChatScroll.querySelectorAll('.regen-bar').forEach(el => el.remove());

  await dispatchReply();
}

async function continueLastReply(){
  if(state.isSending) return;
  // Inject a silent user prod so Luna knows to keep going
  const silentProd = { role: 'user', content: '[continue your thought — keep going]' };
  const historyWithProd = [...state.history, silentProd];
  await dispatchReply(historyWithProd, /*skipPush=*/true);
}

// Core function that calls the API and pushes Luna's reply to UI
// historyOverride: optionally use a different history array for the call
// skipHistoryPush: don't push the user message (for continue)
async function dispatchReply(historyOverride, skipHistoryPush = false){
  if(state.isSending) return;
  if(!state.openRouterKey){ openKeyCard(); return; }

  state.isSending  = true;
  sendBtn.disabled = true;
  reactWhileThinking();
  setLatestLine('<div class="typing-dots"><span></span><span></span><span></span></div>');

  try{
    const reply = await callOpenRouter(historyOverride || state.history);
    state.history.push({ role: 'assistant', content: reply, ts: Date.now() });
    state.lastMessageTime = new Date();
    const msgWrap = pushFullChatMsg('assistant', reply);
    setLatestLine(escapeHtml(reply));
    persistHistory();
    reactToReply(reply);
    speakText(reply);
    if(msgWrap) addRegenContinueButtons(msgWrap);
  } catch(err){
    console.error(err);
    pushSystemMsg('Connection failed: ' + (err.message || 'unknown error'));
    setMood('dormant');
  } finally{
    state.isSending  = false;
    sendBtn.disabled = false;
  }
}

function pushFullChatMsg(role, text){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (role === 'user' ? 'from-user' : 'from-luna');
  wrap.innerHTML = `<span class="tag">${role === 'user' ? (state.userName || 'YOU') : 'LUNA'}</span><div class="bubble"></div>`;
  wrap.querySelector('.bubble').textContent = text;
  fullChatScroll.appendChild(wrap);
  fullChatScroll.scrollTop = fullChatScroll.scrollHeight;
  return wrap;
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
  try{
    const toStore = state.history.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(toStore));
    // Also persist the last message timestamp so time gap survives refresh
    if(state.lastMessageTime){
      localStorage.setItem(HISTORY_KEY + '_lastTs', String(state.lastMessageTime.getTime()));
    }
  } catch(e){ console.warn('Could not persist history', e); }
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

  // Restore last message timestamp for time-gap awareness
  const savedTs = localStorage.getItem(HISTORY_KEY + '_lastTs');
  if(savedTs){
    const ms = parseInt(savedTs, 10);
    if(!isNaN(ms)) state.lastMessageTime = new Date(ms);
  }

  if(!state.history.length) return false;
  state.history.forEach(m => pushFullChatMsg(m.role === 'assistant' ? 'assistant' : 'user', m.content));
  const last = state.history[state.history.length - 1];
  if(last) setLatestLine(escapeHtml(last.content));

  // Re-attach regen/continue to the last Luna message
  const lunaMessages = fullChatScroll.querySelectorAll('.msg.from-luna');
  if(lunaMessages.length) addRegenContinueButtons(lunaMessages[lunaMessages.length - 1]);

  return true;
}

function clearHistory(){
  state.history        = [];
  state.lastMessageTime= null;
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(HISTORY_KEY + '_lastTs');
  fullChatScroll.innerHTML = '';
  setLatestLine('say hi to wake her up...', true);
}

// ─── SEND MESSAGE ─────────────────────────────────────────────────────────────
async function sendMessage(){
  const text = msgInput.value.trim();
  if(!text || state.isSending) return;
  if(!state.openRouterKey){ openKeyCard(); return; }

  msgInput.value = '';
  autoGrow();

  const ts = Date.now();
  state.history.push({ role: 'user', content: text, ts });
  state.lastMessageTime = new Date(ts);
  pushFullChatMsg('user', text);
  setLatestLine(escapeHtml(text));
  persistHistory();
  reactToUserMessage();

  await dispatchReply();
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

// ─── SAVE / LOAD CHAT ────────────────────────────────────────────────────────
function saveChatToFile(){
  if(!state.history.length){
    pushSystemMsg('Nothing to save yet — start chatting first!');
    return;
  }
  const payload = {
    version:   3,
    savedAt:   new Date().toISOString(),
    personaId: state.personaId,
    userName:  state.userName,
    messages:  state.history
  };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,10);
  a.href     = url;
  a.download = `luna-chat-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  pushSystemMsg('Chat saved! Check your downloads folder.');
}

function loadChatFromFile(){
  const input = document.createElement('input');
  input.type   = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if(!file) return;
    try{
      const text    = await file.text();
      const payload = JSON.parse(text);
      if(!Array.isArray(payload.messages)){
        throw new Error('Invalid chat file — no messages array found.');
      }
      // Clear current chat, load saved messages
      clearHistory();
      state.history = payload.messages;
      if(payload.personaId){
        state.personaId = payload.personaId;
        applyPersonaTheme();
        buildPersonaGrid();
      }
      if(payload.userName && !state.userName){
        state.userName = payload.userName;
      }
      // Restore last timestamp from the file if available
      const lastMsg = [...payload.messages].reverse().find(m => m.ts);
      if(lastMsg?.ts) state.lastMessageTime = new Date(lastMsg.ts);

      // Render messages
      payload.messages.forEach(m => pushFullChatMsg(m.role === 'assistant' ? 'assistant' : 'user', m.content));
      const last = payload.messages[payload.messages.length - 1];
      if(last) setLatestLine(escapeHtml(last.content));

      // Re-attach regen/continue to last Luna message
      const lunaMessages = fullChatScroll.querySelectorAll('.msg.from-luna');
      if(lunaMessages.length) addRegenContinueButtons(lunaMessages[lunaMessages.length - 1]);

      persistHistory();
      pushSystemMsg(`Chat loaded! ${payload.messages.length} messages restored from ${payload.savedAt?.slice(0,10) || 'file'}.`);
    } catch(err){
      pushSystemMsg('Could not load chat: ' + (err.message || 'invalid file'));
    }
  });
  document.body.appendChild(input);
  input.click();
  document.body.removeChild(input);
}

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

// ── Relabel the Gemini key field to OpenRouter in the UI ──────────────────────
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

// ── Inject Save/Load buttons into the settings sheet ────────────────────────
(function injectSaveLoadButtons(){
  const sheetActions = document.querySelector('#settings-sheet .sheet-actions');
  if(!sheetActions) return;

  // Save chat button
  const saveBtn = document.createElement('button');
  saveBtn.className   = 'btn';
  saveBtn.textContent = 'Save chat';
  saveBtn.title       = 'Download chat history as JSON';
  saveBtn.addEventListener('click', () => { closeSettings(); saveChatToFile(); });

  // Load chat button
  const loadBtn = document.createElement('button');
  loadBtn.className   = 'btn';
  loadBtn.textContent = 'Load chat';
  loadBtn.title       = 'Import a previously saved chat JSON';
  loadBtn.addEventListener('click', () => { closeSettings(); loadChatFromFile(); });

  // Insert before "Clear chat"
  sheetActions.insertBefore(saveBtn, sheetActions.firstChild);
  sheetActions.insertBefore(loadBtn, saveBtn.nextSibling);
})();

// ── Inject CSS for regen bar & save/load into <head> ────────────────────────
(function injectStyles(){
  const style = document.createElement('style');
  style.textContent = `
    .regen-bar {
      display: flex;
      gap: 6px;
      margin-top: 6px;
      margin-left: 2px;
    }
    .regen-action {
      font-size: 0.58rem;
      padding: 5px 9px;
      gap: 4px;
      opacity: 0.65;
      transition: opacity 0.15s ease;
    }
    .regen-action:hover { opacity: 1; }
    .regen-action svg { flex-shrink: 0; }
    /* Constrain settings actions to wrap gracefully */
    .sheet-actions { flex-wrap: wrap; }
  `;
  document.head.appendChild(style);
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
