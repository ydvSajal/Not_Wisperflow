# WhisprFlow

Free, personal voice-dictation desktop app — a from-scratch clone of the OpenWhispr core loop.
Press a global shortcut anywhere, talk, and your words are transcribed by Whisper and pasted
into whatever app you're using. Local-first, zero subscriptions, zero required API keys.

**Features**

- 🎙️ Global hotkey (configurable) toggles dictation from any app; Esc cancels
- 🫧 Floating always-on-top bar with live waveform, timer, transcript preview and errors —
  it never steals focus from the app you're typing into
- 🧠 Two engines, switchable in Settings:
  - **Local** — Whisper ONNX on your CPU (`@huggingface/transformers`), fully offline
  - **Cloud** — any OpenAI-compatible endpoint (Groq free tier, OpenAI) with your own key
- 📋 Auto-paste into the focused app (clipboard restored afterwards, optional)
- ✨ Optional AI cleanup pass (punctuation, filler-word removal) via any OpenAI-compatible LLM
- 🗂️ History with search, copy, delete
- 📊 Stats: total words, average WPM, speaking time, day streak, 30-day chart
- 🚀 First-run onboarding: mic check → model download → shortcut → live test
- 🖥️ Tray app, launch-at-login, single instance

No native compile step on any OS: SQLite comes from Node's built-in `node:sqlite`,
and ONNX runtime ships prebuilt binaries.

## Run it (Windows, macOS, Linux)

Requires Node 22+ and pnpm (`npm i -g pnpm`).

```bash
pnpm install        # downloads Electron; no build tools needed
pnpm gen:icons      # generates app/tray icons (committed script, run once)
pnpm dev            # launches the app with hot reload
```

First launch opens the onboarding wizard. Package an installer with:

```bash
pnpm dist:win       # release/WhisprFlow-*.exe (NSIS)
pnpm dist:mac       # dmg    |  pnpm dist:linux  # AppImage
```

## 5-minute verification checklist

1. `pnpm install && pnpm gen:icons && pnpm dev` — main window opens with onboarding.
2. Complete onboarding: mic meter moves, download **Whisper Base** (~85 MB, one time),
   keep or change the shortcut (default `Ctrl+Shift+Space`).
3. Open Notepad, click into it, press the shortcut → floating bar appears with waveform.
   Speak a sentence, press the shortcut again → text is pasted into Notepad.
4. Check **History** (entry with words/WPM) and **Stats** (totals updated).
5. In **Settings**, switch engine to Cloud, paste a free Groq key
   (console.groq.com), hit *Test connection*, dictate again — faster and more accurate.

Linux auto-paste needs `xdotool` (X11) or `wtype` (Wayland) installed.

## Development

```bash
pnpm typecheck && pnpm lint && pnpm build   # must all pass before committing
pnpm test:whisper                            # downloads whisper-tiny, runs a real inference
```

Architecture, file map, and the guided roadmap for AI-assisted development live in
[`docs/HANDOFF.md`](docs/HANDOFF.md).

## License

MIT. Inspired by [OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT); this is an
independent implementation for personal use.
