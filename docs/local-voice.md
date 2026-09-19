# Local character voices

The game uses sherpa-onnx-node and Kokoro v1.1 Chinese. Inference runs in a
server worker thread on CPU; Chrome receives WAV audio from the same origin.
No remote speech API or browser system voice is used.

## Windows

1. Run `npm ci`.
2. Download the official model archive:
   https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-multi-lang-v1_1.tar.bz2
3. Extract it under `models/`. The resulting path must be
   `models/kokoro-multi-lang-v1_1/model.onnx`. Keep the accompanying voices,
   lexicons, tokens and espeak-ng-data directory together with the model.
4. Run `npm start`, open http://localhost:5173 in Chrome, open the pause menu,
   and enable character voices or press the dialogue preview button.

The first synthesis takes longer; subsequent identical requests use
`data/voice-cache`. Audio starts only after an explicit user interaction.
Run `npm run voice:warm` before starting the server to generate common lines.
The initial voice setting is on; the first click or key press unlocks audio.
Volume, skip and preview controls are in
the pause menu. Missing models or synthesis errors do not block gameplay.

## Linux

Use a supported Node.js release and a glibc-based distribution such as Debian
or Ubuntu. Install dependencies on the target architecture with `npm ci`;
do not copy Windows node_modules. Linux x64 and arm64 are supported upstream.
For the pinned package layout, configure the native library path before start:

```sh
export LD_LIBRARY_PATH="$PWD/node_modules/sherpa-onnx-linux-$(node -p process.arch):${LD_LIBRARY_PATH:-}"
npm start
```

Set `TTS_MODEL_DIR` to use an absolute model directory outside the application.
Persist `data/voice-cache` between deployments. Ship dependencies and the full
model beforehand for offline deployment. No downloads happen on server startup.
The server generates files and does not need an audio device.

## API and operation

- `GET /api/voice/status`: readiness and loading/failure description.
- `POST /api/voice`: JSON `{ "text": "...", "role": "mentor" }`; returns audio/wav.
- Roles: hero, mentor, enemy. Their speaker IDs and speed are in voice-service.js.
- Maximum 220 UTF-16 code units per request, 12 pending unique synthesis jobs.
- Duplicate pending requests share one synthesis; successful audio is cached.
- Cache keys include model revision, text and voice settings. Bump the revision
  when replacing model files to avoid reusing old audio.

Before public deployment, place the API behind the game's access controls and
rate limits. This prototype accepts arbitrary short text; cache storage needs a
retention policy if opened to untrusted traffic. Do not expose model directories.

Linux execution has not yet been validated on a Linux machine. CPU latency and
memory must be measured on the intended server before choosing concurrency.

Upstream references:
- https://k2-fsa.github.io/sherpa/onnx/javascript-api/install.html
- https://k2-fsa.github.io/sherpa/onnx/tts/all/Chinese-English/kokoro-multi-lang-v1_1.html
- https://huggingface.co/hexgrad/Kokoro-82M-v1.1-zh

Preserve the license notices shipped with the runtime and model when packaging.
