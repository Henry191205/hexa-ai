# Hexa AI

Hexa AI now includes a full front-page launch experience plus a production-style app update with workflow parity across
ChatGPT-style, Claude-style, and Perplexity-style usage.

## What changed
- Visual landing page upgrade in [launch.html](/Users/sandeepkumar/Documents/learn/hexa-ai/launch.html)
- App-level UI refinement in [styles.css](/Users/sandeepkumar/Documents/learn/hexa-ai/styles.css)
- Streaming answer UX, template engine, memory panel, and API routing in [app.js](/Users/sandeepkumar/Documents/learn/hexa-ai/app.js)
- Updated launch style in [launch.css](/Users/sandeepkumar/Documents/learn/hexa-ai/launch.css)

## New app capabilities
1. **Visual 1) UX polish**
   - Animated launch hero
   - Premium black-violet visual direction across app + launch surfaces
   - Stronger gradients, typography, and contrast
   - Better typography and card transitions

2. **Real app behavior 2) Streaming + actions**
   - Assistant placeholder now streams text progressively
   - Better stop flow and render continuity
   - Status labels and source cards per response

3. **Feature upgrades 3)
   - Prompt templates per mode
   - Session memory panel for reusable context
   - Better attachment handling and message source rendering
   - Richer local workflow tools (`base64`, `text_stats`, `regex_find`, `uuid`, `timestamp`, ...)

4. **Launch readiness 4)
   - PWA metadata and install support
   - OG/favicons in launch page
   - Cleaner mobile behavior

5. **Backend/API upgrade 5)
   - Provider presets: OpenAI-compatible, Anthropic-compatible, Perplexity-style, DeepSeek-compatible, Google Gemini-compatible
   - Provider aliases added for ChatGPT, Claude, Groq, and xAI Grok
   - Per-provider endpoint/key/model settings
   - Local deterministic tool graph (`/tool` and `/workflow`) plus provider function-call loop
   - Multi-step workflow mode for chained execution and result aggregation
   - Retry + timeout controls in Settings
   - Provider fallback chain based on selected mode

## Files
- [launch.html](/Users/sandeepkumar/Documents/learn/hexa-ai/launch.html)
- [launch.css](/Users/sandeepkumar/Documents/learn/hexa-ai/launch.css)
- [index.html](/Users/sandeepkumar/Documents/learn/hexa-ai/index.html)
- [styles.css](/Users/sandeepkumar/Documents/learn/hexa-ai/styles.css)
- [app.js](/Users/sandeepkumar/Documents/learn/hexa-ai/app.js)
- [manifest.webmanifest](/Users/sandeepkumar/Documents/learn/hexa-ai/manifest.webmanifest)
- [sw.js](/Users/sandeepkumar/Documents/learn/hexa-ai/sw.js)

## How to run
1. Open [launch.html](/Users/sandeepkumar/Documents/learn/hexa-ai/launch.html) in browser.
2. Open [index.html](/Users/sandeepkumar/Documents/learn/hexa-ai/index.html) for the app.
3. In Settings, choose Provider, set endpoint/model, API key, timeout, and retry values.
4. Optional: open **Provider** dropdown for quick workflow routing and templates for each mode.

## Notes
- This is still a client-side workspace; you must supply valid API credentials.
- If no provider endpoints are set, Hexa uses graceful fallback responses.
