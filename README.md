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

## Deploy as a website
This project is a static website and can be hosted on GitHub Pages, Netlify, Vercel, or any other static host.

### GitHub Pages
1. Push this repository to GitHub.
2. Open the repository settings and enable GitHub Pages.
3. Select the GitHub Actions workflow as the source if prompted.
4. Your site will be published at a GitHub Pages URL.

### Notes
- The avatar model is loaded from:
  https://raw.githubusercontent.com/UltimateCheetah/Project-Luna/main/Luna_V2.vrm
- A browser with WebGL support is required for the 3D scene.
- The OpenRouter request uses the `openai/gpt-4o-mini` model by default.
