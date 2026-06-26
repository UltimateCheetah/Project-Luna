# Project Luna

Project Luna is a dark, pink-tinted web experience featuring a 3D avatar scene and a chat panel powered by OpenRouter.

## Features
- Dark UI with pink highlights and glassy panels
- Three.js scene loading the VRM model from the repository URL
- Idle motion for the avatar, including gentle body sway and tail movement
- Message box for chatting with Luna
- OpenRouter API integration for model responses

## Files
- index.html: main page structure
- style.css: visual styling
- script.js: Three.js scene, animation, and OpenRouter chat logic

## Run locally
1. Start a simple static server from the project folder:
   - Python: `python3 -m http.server 8000`
2. Open http://localhost:8000 in your browser.
3. Enter an OpenRouter API key and send a message.

## Notes
- The avatar model is loaded from:
  https://raw.githubusercontent.com/UltimateCheetah/Project-Luna/main/Luna_V2.vrm
- A browser with WebGL support is required for the 3D scene.
- The OpenRouter request uses the `openai/gpt-4o-mini` model by default.
