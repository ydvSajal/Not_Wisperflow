# NotWhisperFlow

Free, personal voice-dictation desktop app — a from-scratch clone of the OpenWhispr core loop.
Press a global shortcut anywhere, talk, and your words are transcribed by Whisper and pasted
into whatever app you're using. Local-first, zero subscriptions, zero required API keys.

Windows · macOS · Linux · Electron 37 + React 19 · MIT

---

## Table of contents

- [What it does](#what-it-does)
- [Install](#install)
  - [Run from source](#run-from-source)
  - [Build an installer](#build-an-installer)
  - [Windows: SmartScreen and Smart App Control](#windows-smartscreen-and-smart-app-control)
  - [Linux auto-paste dependencies](#linux-auto-paste-dependencies)
- [Using it](#using-it)
- [Transcription engines](#transcription-engines)
  - [Local (offline, default)](#local-offline-default)
  - [Cloud (OpenAI-compatible)](#cloud-openai-compatible)
  - [Sarvam (Indian languages)](#sarvam-indian-languages)
- [Settings reference](#settings-reference)
- [Features in detail](#features-in-detail)
- [Where your data lives](#where-your-data-lives)
- [Privacy](#privacy)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [Built with](#built-with)
- [License](#license)

---

## What it does

- 🎙️ **Global hotkey** (configurable) toggles dictation from any app; `Esc` cancels.
- 🫧 **Floating bar** — always-on-top, with live waveform, timer, transcript preview and
  errors. It never steals focus from the app you are typing into.
- 🧠 **Three engines**, switchable in Settings: local Whisper ONNX (offline), any
  OpenAI-compatible cloud endpoint, or Sarvam AI.
- 📋 **Auto-paste** into the focused app, with the previous clipboard restored afterwards.
- ✨ **Optional AI cleanup** pass — punctuation, capitalisation, filler-word removal — via
  any OpenAI-compatible LLM.
- 🌐 **Translation hotkey** — a second shortcut dictates in any language and pastes the
  translation.
- 📚 **Dictionary** — plain or regex replacements that fix words Whisper keeps mishearing.
- 🗂️ **History** with search, copy and delete, plus drag-and-drop **audio file import**
  (wav/mp3/ogg/m4a) transcribed straight into history.
- 📝 **Notes** — append dictations into named notes; autosaving editor with search.
- 📊 **Stats** — total words, average WPM, speaking time, day streak, 30-day chart.
- 🖱️ **Tray quick controls** — engine, auto-paste, sounds, AI cleanup without opening
  the window.
- 🚀 **Onboarding wizard** on first run: mic check → model download → shortcut → live test.
- 🖥️ Tray app, launch-at-login, single instance.

No native compile step on any OS: SQLite comes from Node's built-in `node:sqlite`, and the
ONNX runtime ships prebuilt binaries. No `node-gyp`, no `electron-rebuild`.

---

## Install

Requires **Node 22+** and **pnpm** (`npm i -g pnpm`).

### Run from source

```bash
git clone https://github.com/ydvSajal/Not_Wisperflow.git
cd Not_Wisperflow
pnpm install        # downloads Electron; no build tools needed
pnpm dev            # launches the app with hot reload
```

First launch opens the onboarding wizard.

### Build an installer

```bash
pnpm dist:win       # release/NotWhisperFlow-<version>-Setup.exe (NSIS)
pnpm dist:mac       # release/*.dmg
pnpm dist:linux     # release/*.AppImage
```

Unpacked output also lands in `release/win-unpacked/` (and platform equivalents), which is
runnable directly without installing.

### Windows: SmartScreen and Smart App Control

The installer is **not code-signed** (signing certificates cost money; this is a free
personal project). Windows therefore treats it as an unknown app, in one of two ways
depending on your machine.

**SmartScreen** — a blue "Windows protected your PC" dialog. Click **More info → Run
anyway**. This is the common case and there is nothing else to do.

**Smart App Control** — blocks the app outright with no "Run anyway" option. It only runs
code signed by a known publisher or already trusted by Microsoft's reputation service, and
it has no per-app allow list. It is on by default only on some clean installs of Windows 11.

If Smart App Control is blocking it, you have two options:

**Option 1 — run it without the installer (recommended).** Build it yourself with
`pnpm dist:win` and run `release\win-unpacked\NotWhisperFlow.exe` directly. Copy that folder
anywhere you like and make a shortcut to the `.exe`. Code you compiled on your own machine
isn't subject to the same download-reputation checks, so nothing needs to be turned off.

**Option 2 — turn Smart App Control off.** Windows Security → **App & browser control** →
**Smart App Control settings** → **Off**.

> ⚠️ **This is a one-way change.** Once Smart App Control is set to Off, Windows will not let
> you turn it back on — re-enabling it requires a clean reinstall or reset of Windows. It
> also switches that protection off for *every* program on the machine, not just this one.
> Only do this if you understand and accept that trade-off; otherwise use Option 1.

Each release publishes the SHA-256 of its installer. Verify your download matches before
running it:

```powershell
Get-FileHash .\NotWhisperFlow-*-Setup.exe -Algorithm SHA256
```

### Linux auto-paste dependencies

Auto-paste sends a Ctrl+V keystroke to the focused window, which needs one of:

- X11: `xdotool`
- Wayland: `wtype`

Without either, transcriptions still land on the clipboard — the bar tells you so, and you
paste manually.

---

## Using it

1. Press the hotkey (default **`Ctrl+Shift+Space`**, `Cmd+Shift+Space` on macOS) in any app.
   The floating bar appears and starts recording. Your focused app keeps its cursor.
2. Speak. The waveform and timer confirm the mic is live. Recording is capped at 5 minutes.
3. Press the hotkey again to stop. The bar shows *transcribing*, then the transcript, and
   the text is pasted into the app you were in.
4. Press **`Esc`** while recording to cancel — nothing is transcribed, saved or pasted.

**Translation:** set a second shortcut and a target language in Settings → Shortcuts. That
shortcut dictates in any language and pastes the translated text instead.

**Audio files:** drag a `.wav` / `.mp3` / `.ogg` / `.m4a` file onto the History page. It is
transcribed and saved to history (not pasted).

**Tray menu:** open the window, start/stop dictation, switch engine, and toggle auto-paste,
sounds and AI cleanup without opening the main window.

If a paste fails for any reason, the text is always on your clipboard and the error is shown
on the bar. A dictation is never silently lost.

---

## Transcription engines

Switch in **Settings → Transcription engine**. The tray menu also switches between local and
cloud.

### Local (offline, default)

Whisper ONNX running on your CPU via `@huggingface/transformers` (q8 quantised), in a
worker thread so the UI never blocks. No network, no key, nothing leaves your machine.

Curated models (Settings → Transcription engine → download):

| Model | Size | Notes |
| --- | --- | --- |
| `onnx-community/whisper-tiny` | ~45 MB | Fastest, rough |
| `onnx-community/whisper-base` | ~85 MB | **Recommended default** |
| `onnx-community/whisper-small` | ~250 MB | Better accuracy |
| `onnx-community/whisper-large-v3-turbo` | ~500 MB | Best, very slow on CPU |

Downloads are resumable and verified. A model interrupted mid-download is reported as
**corrupt** rather than ready, and the UI offers a repair instead of failing later at
dictation time.

### Cloud (OpenAI-compatible)

Any endpoint that implements `POST /audio/transcriptions`. Configure base URL, API key and
model; **Test connection** validates the key before you rely on it.

Defaults point at Groq's free tier:

- Base URL `https://api.groq.com/openai/v1`
- Model `whisper-large-v3-turbo`
- Key from <https://console.groq.com>

OpenAI works with base URL `https://api.openai.com/v1` and model `whisper-1`.

### Sarvam (Indian languages)

`api.sarvam.ai/speech-to-text`, useful for Hindi and other Indian languages. Configure API
key, model (default `saarika:v2.5`) and a BCP-47 language code (`hi-IN`, `en-IN`, …) or
`unknown` to auto-detect.

---

## Settings reference

Stored as JSON at `<userData>/settings.json` (see [Where your data lives](#where-your-data-lives)).
Every field is editable in the Settings UI; the file is written by the app, so edit it only
while the app is closed.

| Setting | Default | Meaning |
| --- | --- | --- |
| `hotkey` | `CommandOrControl+Shift+Space` | Electron accelerator that toggles dictation |
| `translateHotkey` | `""` | Second accelerator: dictate → translate → paste. Empty disables it |
| `translateTarget` | `en` | ISO-639-1 target language for the translate hotkey |
| `engine` | `local` | `local` \| `cloud` \| `sarvam` |
| `localModel` | `onnx-community/whisper-base` | Which downloaded ONNX model to use |
| `language` | `auto` | `auto` or an ISO-639-1 code (`en`, `hi`, …) |
| `cloud.baseUrl` | `https://api.groq.com/openai/v1` | OpenAI-compatible transcription endpoint |
| `cloud.apiKey` | `""` | Your key; never leaves this file |
| `cloud.model` | `whisper-large-v3-turbo` | Cloud transcription model id |
| `sarvam.apiKey` / `.model` / `.languageCode` | `""` / `saarika:v2.5` / `unknown` | Sarvam config |
| `cleanup.enabled` | `false` | Run the LLM cleanup pass before pasting |
| `cleanup.baseUrl` | `https://api.groq.com/openai/v1` | OpenAI-compatible chat-completions endpoint |
| `cleanup.apiKey` | `""` | Key for the cleanup LLM |
| `cleanup.model` | `llama-3.3-70b-versatile` | Cleanup model id |
| `autoPaste` | `true` | Off = transcript goes to the clipboard only |
| `restoreClipboard` | `true` | Restore your previous clipboard ~1.2s after pasting |
| `launchAtLogin` | `false` | Register the app as a login item |
| `sounds` | `true` | Start/stop chirps |
| `onboarded` | `false` | Set once the wizard completes |

Invalid or conflicting hotkeys are rejected and rolled back to the previous working one.

**Environment variables** (development only, all optional — see `.env.example`):

| Variable | Effect |
| --- | --- |
| `WHISPRFLOW_MODEL_DIR` | Override where ONNX models are cached |
| `WHISPRFLOW_NO_HOTKEY=1` | Skip registering global shortcuts (headless/CI) |

---

## Features in detail

**Dictionary.** Settings → Dictionary. Each entry is a pattern → replacement pair. Plain
patterns match whole words, case-insensitively; tick *regex* for full regular-expression
patterns. Replacements run after transcription and after AI cleanup, so they always win.

**AI cleanup.** Optional post-pass through any OpenAI-compatible chat model that fixes
punctuation and strips filler words. It can never lose your text: on any failure it returns
the raw transcript unchanged.

**History.** Every dictation is stored with raw text, cleaned text, word count, duration,
WPM, engine and model. Searchable; entries can be copied or deleted.

**Notes.** Named notes with an autosaving editor. Any dictation can be appended to a note
from the result view.

**Stats.** Total words, dictation count, speaking time, average WPM, consecutive-day streak
and a 30-day bar chart, computed from the history table.

---

## Where your data lives

Everything is local to your machine, in Electron's `userData` folder:

| OS | Path |
| --- | --- |
| Windows | `%APPDATA%\NotWhisperFlow\` |
| macOS | `~/Library/Application Support/NotWhisperFlow/` |
| Linux | `~/.config/NotWhisperFlow/` |

| File | Contents |
| --- | --- |
| `settings.json` | All settings, including API keys |
| `whisprflow.db` | SQLite: transcriptions, replacements, notes |
| `models/` | Downloaded Whisper ONNX checkpoints |

Deleting that folder resets the app completely.

---

## Privacy

- **Local engine: fully offline.** Audio never leaves the machine; the only network access
  is the one-time model download from Hugging Face.
- **Cloud / Sarvam engines:** audio is uploaded to the endpoint *you* configure, and nothing
  else. There is no vendor SDK and no default account.
- **AI cleanup:** sends the transcript text (not audio) to the endpoint you configure, only
  when you enable it.
- **No telemetry, no analytics, no accounts.** API keys are stored in `settings.json` in your
  user-data folder — in plain text, like most desktop apps — and are never sent anywhere but
  the endpoint they belong to.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Hotkey does nothing | Another app owns that combination. Pick a different one in Settings → Shortcuts. |
| Bar appears but the waveform is flat | Mic permission denied or the wrong input device is default. Re-run the mic check in onboarding; on macOS grant Microphone access in System Settings → Privacy. |
| "No speech detected" | Recording too short or too quiet — speak before pressing stop. |
| Text lands on the clipboard but is not pasted | Linux: install `xdotool` (X11) or `wtype` (Wayland). macOS: grant Accessibility permission to the app. |
| Model shows as corrupt | Interrupted download. Use the repair/re-download button in Settings → Transcription engine. |
| Local transcription is very slow | Use a smaller model (Base or Tiny), or switch to the cloud engine. Large v3 Turbo on CPU is slow by design. |
| Cloud engine errors with 401 | Wrong or expired key. Use *Test connection* in Settings. |
| Paste goes into the wrong window | Click into the target app before pressing the hotkey; the bar deliberately never takes focus. |

---

## Development

```bash
pnpm dev                     # hot-reload dev build
pnpm typecheck && pnpm lint && pnpm build   # must all pass before committing
```

Standalone assert scripts (no test framework by design):

```bash
pnpm test:whisper            # downloads whisper-tiny, runs a real ONNX inference
pnpm test:resample           # audio resampling
pnpm test:model-cache        # model cache / corruption detection
pnpm test:model-download     # resumable download logic
pnpm test:hotkey             # key-repeat debouncing
```

Project layout:

```
src/shared/    types, IPC channel names, the typed window.api contract
src/main/      Electron main: dictation state machine, hotkeys, paste, db,
               settings, tray, transcription/ (local | cloud | sarvam), cleanup/
src/preload/   contextBridge → window.api
src/renderer/  two React roots: the floating bar and the main window
scripts/       icon generator + assert-based test scripts
```

Architecture, the full file map, hard rules and the roadmap live in
[`docs/HANDOFF.md`](docs/HANDOFF.md) — read it before changing code.

Changes touching audio, hotkeys or paste cannot be verified in CI; run the flow in
[Using it](#using-it) on a real desktop before shipping.

---

## Built with

- [Electron](https://www.electronjs.org/) 37 — cross-platform desktop shell
- [React](https://react.dev/) 19 — both UI roots (floating bar, main window)
- [electron-vite](https://electron-vite.org/) / [Vite](https://vitejs.dev/) — build and dev server
- [TypeScript](https://www.typescriptlang.org/) — end to end, main/preload/renderer
- [Tailwind CSS](https://tailwindcss.com/) 4 — styling
- [🤗 Transformers.js](https://huggingface.co/docs/transformers.js) — local Whisper ONNX inference
- [ONNX Runtime](https://onnxruntime.ai/) — CPU inference backend for local models
- [onnx-community Whisper checkpoints](https://huggingface.co/onnx-community) — quantised model weights
- Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) — history/notes storage, no native build step
- [electron-builder](https://www.electron.build/) — Windows/macOS/Linux installers
- [Groq](https://groq.com/) & [OpenAI](https://openai.com/) — optional cloud Whisper/LLM endpoints (OpenAI-compatible)
- [Sarvam AI](https://www.sarvam.ai/) — optional Indian-language transcription endpoint
- [Lucide](https://lucide.dev/) — icons
- [ESLint](https://eslint.org/) — linting
- [pnpm](https://pnpm.io/) — package manager

Inspired by [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT); this is an
independent, from-scratch implementation.

---

## Contributing

Personal project, open to contributions. Fork it, branch, run
`pnpm typecheck && pnpm lint && pnpm build` before opening a PR. See
[`docs/HANDOFF.md`](docs/HANDOFF.md) for architecture and ground rules.

---

## License

MIT — see [LICENSE](LICENSE).
