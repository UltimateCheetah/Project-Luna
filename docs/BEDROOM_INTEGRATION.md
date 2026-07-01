# Bedroom integration guide

This document explains how to integrate the new pink gamer-bedroom into your existing Three.js app.

Files added:
- `src/three/bedroom.js` - procedural bedroom builder and integration API

Basic usage
-----------

1. Import and create the bedroom after your scene, camera, and renderer are initialized:

```js
import { addBedroom } from './src/three/bedroom.js';

let bedroom = null;
(async () => {
  bedroom = await addBedroom(scene, camera, renderer, { quality: 'balanced' });
})();
```

2. Update the bedroom each frame from your animation loop:

```js
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  if (bedroom) bedroom.update(dt);
  // If you want the neon bloom and you don't already use an EffectComposer in your app:
  if (bedroom && bedroom.composer) {
    // bedroom.composer includes a RenderPass and an UnrealBloomPass that produces the neon glow.
    bedroom.composer.render();
  } else {
    renderer.render(scene, camera);
  }
}
animate();
```

Composer integration (if your app already uses EffectComposer)
------------------------------------------------------------

If your main renderer already uses an EffectComposer, integrate the bloom pass from the bedroom module into your composer rather than using `bedroom.composer` directly. The bedroom places glow objects on a dedicated layer (bloomLayer). Use selective bloom rendering:

1. Render the scene normally but with the bloom layer disabled.
2. Render the scene to the bloom composer with non-bloom layers disabled.
3. Combine as usual.

The bedroom module exposes `bloomLayer` so you can toggle layers when rendering:

```js
// pseudo sequence
scene.traverse(obj => { /* ensure objects that should bloom have obj.layers.enable(bloomLayer) */ });
// render non-bloom layer
camera.layers.set(0);
renderer.render(scene, camera);
// render bloom layer to composer/bloomPass
camera.layers.set(bedroom.bloomLayer.mask);
bloomComposer.render();
```

Performance tuning
------------------

- quality: 'low' | 'balanced' | 'high' influences tuft counts and textures. Use 'low' for mobile.
- Replace procedural canvas textures with KTX2 compressed textures for faster GPU upload and better memory.
- Consider baking static AO/lightmaps for very high-quality stills (not included here).
- Reuse bedroom materials in your scene where possible to reduce draw calls.

Assets and improvements
----------------------

This starter implementation is procedural and lightweight. For a production release you might:
- Replace monitor screen canvases with animated video textures or WebGL layers.
- Swap simple geometry for optimized GLTF/GLB models for the chair, desk, and decor.
- Provide environment / IBL maps (compressed) for higher fidelity PBR shading.
- Add subtle animated dust particles or volumetric fog for atmosphere.

If you want, I can:
- Add GLTF loaders and place optimized assets into `assets/bedroom/` (you'll need to provide or approve the asset files).
- Convert carpet tufts into a baked normal-map + smooth displacement texture to reduce instances and improve mobile performance.

