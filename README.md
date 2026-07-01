# Project Luna

Project Luna is a polished web companion experience that pairs a live 3D avatar with conversational AI. The app uses vanilla JavaScript, Three.js, and OpenRouter so it stays lightweight while still featuring rich interactions.

## Features
- Five personality modes: Sweet, Flirty, Sassy, Calm, and Excited
- A Three.js viewport that loads a VRM model from a public URL
- Blink, lip-sync, and mood-driven avatar reactions
- A chat panel with quick actions for regenerate, continue, and stop
- OpenRouter chat replies plus optional ElevenLabs voice playback
- Local browser storage for settings, chat history, and profile notes

## Quick Start

Visit **[Project Luna Live](https://ultimatecheetah.github.io/Project-Luna)** to chat with Luna right now!

### First Time Setup

1. Open https://ultimatecheetah.github.io/Project-Luna in your browser (WebGL support required)
2. Enter an OpenRouter API key in the settings panel or first-run prompt (required for chat replies)
3. Optionally add an ElevenLabs API key for text-to-speech voice playback
4. Start chatting with Luna!

## Customize

Click the gear icon in the top-right corner to tweak:
- Personality style
- OpenRouter model and key
- ElevenLabs voice settings
- The 3D model URL
- Personal notes about the user
- Relationship role: `Friend` (default), `Family`, `Crush`, or `Partner` — controls how romantic or familial Luna's tone should be.

## Running Locally

To run Project Luna locally for development:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
# Then open http://localhost:8000 in your browser
```

## Changing the Avatar Model

1. Create or download a rigged .vrm or .glb file
2. Host it somewhere public with CORS enabled, such as:
   - GitHub raw content
   - A CDN service (e.g., Cloudflare, Vercel)
   - Your own server
3. Paste the direct URL into the model field in Settings
4. If the model is on GitHub, use a raw URL rather than a blob URL

## Quick Verification Checklist

1. Load the app and confirm the default VRM model renders in the 3D viewport
2. Paste an OpenRouter key and send a message — confirm a chat reply appears
3. If you added an ElevenLabs key, test voice playback and lip-sync behavior
4. Paste a different model URL in Settings and verify load success or an informative error

## Roadmap (Completed)

- Added small bone-driven gestures and mood-triggered reactions to complement animation clips
- Responsive layout tweaks for improved mobile composition and controls
- Better onboarding notes and setup instructions

For details on internal behavior and how moods map to gestures, see `script.js`.

## Current Roadmap

- Improve model loading feedback and CORS guidance
- Add richer avatar gestures and facial expression transitions
- Refine mobile chat spacing and onboarding flow
- Keep the experience lightweight and dependency-friendly

## Notes

- The default avatar model is loaded from the repository's VRM file
- A browser with WebGL support is required for the 3D scene
- Project Luna is hosted at https://ultimatecheetah.github.io/Project-Luna
