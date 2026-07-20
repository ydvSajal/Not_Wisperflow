# WhisprFlow — Handoff & Architecture Guide

> Audience: any developer or AI model (Sonnet-class and up) continuing work on this codebase.
> Read this file fully before changing code. It is the source of truth over chat history.

## Goal in one sentence

A free personal dictation desktop app: global hotkey → floating bar records speech →
Whisper transcribes (local ONNX by default, OpenAI-compatible cloud optional) →
optional LLM cleanup → text auto-pasted into the focused app → saved to history with stats.

## Stack

Electron 37 (ESM main process) · electron-vite 3 · React 19 + TypeScript strict ·
Tailwind CSS v4 · `node:sqlite` (built-in, no native modules) · `@huggingface/transformers`
(Whisper ONNX, CPU, q8) · electron-builder (NSIS/dmg/AppImage, asar disabled).

Hard rules:

1. **TypeScript strict must stay clean.** `pnpm typecheck && pnpm lint && pnpm build` before every commit.
2. **No provider lock-in.** All AI endpoints are OpenAI-compatible URLs from settings. Never import a provider SDK into business logic.
3. **No native compile steps.** Do not add dependencies that need node-gyp/electron-rebuild. (`better-sqlite3` was deliberately replaced by `node:sqlite` for this reason.)
4. **Secrets live only in the settings store** (`<userData>/settings.json`), never in code or repo.
5. **A dictation must never be silently lost.** Any failure after transcription falls back to clipboard + visible error.

## File map (what lives where)

```
src/shared/            Contracts shared by all processes
  types.ts             AppSettings, BarState, TranscriptionRecord, StatsSummary, ...
  ipc-channels.ts      IPC (invoke) and EVT (push) channel names
  api.ts               WhisprApi — the typed window.api surface

src/main/              Electron main process (ESM)
  index.ts             boot: single-instance, permissions, windows, tray, hotkey
  windows.ts           main window + floating bar (frameless, focusable:false, showInactive)
  dictation.ts         DictationController state machine — THE core flow
  hotkeys.ts           globalShortcut wrapper; Esc registered only while recording
  paste.ts             clipboard + platform keystroke (SendKeys/osascript/xdotool)
  settings.ts          typed JSON store with defaults + 'changed' events
  db.ts                node:sqlite: transcriptions table, history queries, stats aggregation
  ipc.ts               every ipcMain.handle + settings side-effects (hotkey re-apply, login item)
  tray.ts              tray icon + menu
  transcription/
    index.ts           router: settings.engine → local | cloud
    types.ts           TranscriptionProvider interface
    local-whisper.ts   worker-thread owner; emits 'progress' for model downloads
    whisper-worker.ts  separate bundle entry; runs transformers.js pipeline
    cloud.ts           OpenAI-compatible /audio/transcriptions + testCloudConfig
    model-manager.ts   curated model list + cache detection (<userData>/models)
    wav.ts             Float32 PCM → 16-bit WAV encoder
  cleanup/index.ts     optional LLM cleanup (never throws; returns raw text on failure)

src/preload/index.ts   contextBridge → window.api (implements WhisprApi)

src/renderer/
  index.html, bar.html two windows, two React roots
  src/bar/             floating bar UI: BarApp (phases, sounds, capture), Waveform
  src/lib/recorder.ts  MicRecorder: getUserMedia → AudioWorklet → 16kHz mono Float32
  src/lib/sounds.ts    WebAudio chirps   src/lib/format.ts  time/WPM/hotkey formatting
  src/main-window/     App shell + pages/ History, Stats, Settings, Onboarding
                       components/ HotkeyRecorder, ModelList
  src/components/      ui.tsx (Button/Card/Input/Select/Toggle/Field), Toast.tsx

scripts/gen-icons.mjs  zero-dependency PNG icon generator (build/icon.png, resources/tray.png)
scripts/test-whisper.mjs  headless local-whisper inference smoke test
electron-builder.yml   packaging (asar:false, npmRebuild:false — keep both)
```

## The core data flow (trace this before touching dictation)

1. `hotkeys.ts` fires → `DictationController.toggle()` (`dictation.ts`)
2. `startRecording()`: `showBar()` (showInactive — never steal focus), pushes
   `EVT.barState {phase:'recording'}`, sends `EVT.captureStart` to the bar renderer,
   registers Esc.
3. Bar (`BarApp.tsx`) starts `MicRecorder`; worklet chunks drive the waveform.
4. Hotkey again → `stopRecording()` → `EVT.captureStop {discard:false}` → bar calls
   `api.sendAudio(pcm, durationMs)` → IPC `dictation:audio`.
5. `onAudio()`: `transcribe()` router → worker thread (local) or fetch (cloud) →
   `cleanupText()` (optional) → `insertTranscription()` (db) → `pasteText()` →
   bar shows result 2.2s → idle. Main window gets `EVT.dictationDone` to refresh.
6. Cancel (Esc) bumps `this.session` — any in-flight result for an older session is dropped.

Edge cases already handled — preserve them: mic permission denied, no mic, model not
downloaded, missing/invalid cloud key, empty transcription, hotkey conflict (validate +
rollback in `ipc.ts`), 5-minute recording cap, paste helper failure (falls back to clipboard).

## Commands

```bash
pnpm dev            # hot-reload dev
pnpm typecheck / lint / build
pnpm test:whisper   # real ONNX inference with whisper-tiny (downloads once)
pnpm dist:win|mac|linux
```

Env vars (all optional, listed in `.env.example`): `WHISPRFLOW_MODEL_DIR`, `WHISPRFLOW_NO_HOTKEY`.

## Verification protocol for every change

1. `pnpm typecheck && pnpm lint && pnpm build` — non-negotiable.
2. If the change touches dictation/audio/paste: run the README "5-minute verification
   checklist" on a real desktop OS. CI containers cannot test hotkeys/mic/paste.
3. If it touches transcription: `pnpm test:whisper` must still pass.
4. State plainly in your report what you verified and what you could not.

## Known environment limitations (as of the initial build)

- The initial build container's network policy blocked `electronjs.org`, GitHub release
  binaries and `huggingface.co`, so Electron could not boot headlessly there and models
  could not download. Typecheck/lint/full build were verified; runtime flows must be
  verified on a real machine using the README checklist.
- pnpm 10 blocks dependency build scripts unless allow-listed — `pnpm.onlyBuiltDependencies`
  in `package.json` already covers electron/esbuild/sharp. Keep it updated if you add
  deps with install scripts.

## Roadmap ("Later" — see docs/milestones/LATER.md for per-task specs)

Translation hotkey · tray quick-toggles · dictionary/custom vocabulary · notes system ·
meeting transcription · audio-file import · auto-updater. Explicit non-goals for now:
auth, telemetry, code signing, paid services.
