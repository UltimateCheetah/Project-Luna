# Project Luna

Project Luna is a polished web companion experience that pairs a live 3D avatar with conversational AI. The app uses vanilla JavaScript, Three.js, and OpenRouter so it stays lightweight while still feeling expressive and playful.

## Features
- Five personality modes: Sweet, Flirty, Sassy, Calm, and Excited
- A Three.js viewport that loads a VRM model from a public URL
- Blink, lip-sync, and mood-driven avatar reactions
- A chat panel with quick actions for regenerate, continue, and stop
- OpenRouter chat replies plus optional ElevenLabs voice playback
- Local browser storage for settings, chat history, and profile notes

## Setup
1. Serve the project directory and open it in a browser with WebGL enabled. A quick way to run a local server from the project root is:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# Then open http://localhost:8000 in your browser
```

2. Enter an OpenRouter API key in the settings sheet or the first-run prompt (required for chat replies).
3. Optionally add an ElevenLabs API key for TTS voice playback.
4. Start chatting with Luna.

## Customize
Click the gear icon in the top-right corner to tweak:
- Personality style
- OpenRouter model and key
- ElevenLabs voice settings
- The 3D model URL
- Personal notes about the user
 - Relationship role: `Friend` (default), `Family`, `Crush`, or `Partner` — controls how romantic or familial Luna's tone should be.
 - Relationship role: `Friend` (default), `Sister`, `Crush`, `Partner`, or `Hater` — controls how Luna's tone should be. Luna may suggest role changes during conversation; you'll be asked to accept or decline them.

## Changing the avatar model
1. Create or download a rigged .vrm or .glb file.
2. Host it somewhere public, such as GitHub raw or a simple CDN.
3. Paste the direct URL into the model field in Settings.
4. If the model is on GitHub, use a raw URL rather than a blob URL.

## Quick verification checklist

1. Load the app and confirm the default VRM model renders in the 3D viewport.
2. Paste an OpenRouter key and send a message — confirm a chat reply appears.
3. If you added an ElevenLabs key, test voice playback and lip-sync behavior.
4. Paste a different model URL in Settings and verify load success or an informative error.

## Roadmap (next steps implemented)

- Added small bone-driven gestures and mood-triggered reactions to complement animation clips.
- Responsive layout tweaks for improved mobile composition and controls.
- Better onboarding notes and local server instructions in this README.

For details on internal behavior and how moods map to gestures, see `script.js`.

## Current roadmap
- Improve model loading feedback and CORS guidance
- Add richer avatar gestures and facial expression transitions
- Refine mobile chat spacing and onboarding flow
- Keep the experience lightweight and dependency-friendly

## Notes
- The default avatar model is loaded from the repository’s VRM file.
- A browser with WebGL support is required for the 3D scene.
