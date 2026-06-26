import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
import { OrbitControls } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin } from 'https://cdn.jsdelivr.net/npm/@pixiv/three-vrm@1.0.0/lib/three-vrm.module.js';

const canvas = document.getElementById('scene-canvas');
const messageLog = document.getElementById('message-log');
const chatForm = document.getElementById('chat-form');
const apiKeyInput = document.getElementById('api-key');
const promptInput = document.getElementById('prompt-input');

const modelUrl = 'https://raw.githubusercontent.com/UltimateCheetah/Project-Luna/main/Luna_V2.vrm';
let renderer;
let scene;
let camera;
let controls;
let model;
let tailBones = [];
let idleTime = 0;

function appendMessage(role, text) {
  const bubble = document.createElement('div');
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;
  messageLog.appendChild(bubble);
  messageLog.scrollTop = messageLog.scrollHeight;
}

function initScene() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth || 800, canvas.clientHeight || 560);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x05030a, 0.035);

  camera = new THREE.PerspectiveCamera(35, (canvas.clientWidth || 800) / (canvas.clientHeight || 560), 0.01, 100);
  camera.position.set(0, 1.2, 3.2);

  const ambient = new THREE.AmbientLight(0xffc0de, 0.7);
  scene.add(ambient);

  const directional = new THREE.DirectionalLight(0xff8ebf, 1.5);
  directional.position.set(3, 4, 2);
  scene.add(directional);

  const fill = new THREE.PointLight(0x7a4cff, 18, 20);
  fill.position.set(-2, 1.5, -1.5);
  scene.add(fill);

  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(6, 64),
    new THREE.MeshStandardMaterial({ color: 0x140c1d, roughness: 0.95, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.8;
  scene.add(floor);

  const grid = new THREE.GridHelper(10, 20, 0xff4fa3, 0x2f2338);
  grid.material.opacity = 0.3;
  grid.material.transparent = true;
  grid.position.y = -0.79;
  scene.add(grid);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 0.7, 0);
  controls.minDistance = 1.8;
  controls.maxDistance = 7;
  controls.maxPolarAngle = Math.PI / 1.7;
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.016, 0.016); 
  idleTime += delta;

  if (model) {
    model.rotation.y = Math.sin(idleTime * 0.6) * 0.15 + 0.2;
    model.position.y = -0.45 + Math.sin(idleTime * 1.7) * 0.03;

    tailBones.forEach((bone, index) => {
      const sway = Math.sin(idleTime * (1.2 + index * 0.18) + index * 0.35) * 0.18;
      bone.rotation.z = sway;
    });
  }

  controls.update();
  renderer.render(scene, camera);
}

function loadModel() {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));

  loader.load(
    modelUrl,
    (gltf) => {
      model = gltf.scene;
      model.scale.set(1.35, 1.35, 1.35);
      model.position.set(0, -0.5, 0);
      scene.add(model);

      tailBones = [];
      model.traverse((object) => {
        if (object.isBone && /tail/i.test(object.name)) {
          tailBones.push(object);
        }
      });

      if (!tailBones.length) {
        model.traverse((object) => {
          if (object.isBone && /spine|neck|shoulder/i.test(object.name)) {
            tailBones.push(object);
          }
        });
      }
    },
    undefined,
    (error) => {
      console.error(error);
      appendMessage('assistant', 'The avatar model could not be loaded. Please check the URL or your network connection.');
    }
  );
}

function resizeRenderer() {
  const width = canvas.clientWidth || 800;
  const height = canvas.clientHeight || 560;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

chatForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const prompt = promptInput.value.trim();
  const apiKey = apiKeyInput.value.trim();

  if (!prompt) {
    return;
  }

  if (!apiKey) {
    appendMessage('assistant', 'Please enter an OpenRouter API key to talk to Luna.');
    return;
  }

  appendMessage('user', prompt);
  promptInput.value = '';
  appendMessage('assistant', 'Thinking…');

  try {
    const siteUrl = window.location.href || 'https://project-luna.example';
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': siteUrl,
        'X-Title': 'Project Luna'
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Luna, a warm and playful AI companion. Keep answers concise and charming.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 220
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || 'Request failed');
    }

    const reply = data.choices?.[0]?.message?.content || 'No reply returned.';
    messageLog.lastElementChild.textContent = reply;
  } catch (error) {
    messageLog.lastElementChild.textContent = `Request failed: ${error.message}`;
  }
});

window.addEventListener('resize', resizeRenderer);

appendMessage('assistant', 'Hello! I am Luna. Ask me anything and I will answer using your OpenRouter key.');
initScene();
loadModel();
animate();
resizeRenderer();
