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
- 🌐 Translation hotkey: a second shortcut that dictates in any language and pastes the
  translation (target language configurable)
- 📚 Dictionary: custom replacements (plain or regex) fix words Whisper keeps mishearing
- 🗂️ History with search, copy, delete — plus drag-and-drop **audio file import**
  (wav/mp3/ogg/m4a) transcribed straight into history
- 📝 Notes: append dictations into named notes, autosaving editor with search
- 📊 Stats: total words, average WPM, speaking time, day streak, 30-day chart
- 🖱️ Tray quick controls: engine, auto-paste, sounds, AI cleanup without opening the app
- 🚀 First-run onboarding: mic check → model download → shortcut → live test
- 🖥️ Tray app, launch-at-login, single instance

No native compile step on any OS: SQLite comes from Node's built-in `node:sqlite`,
and ONNX runtime ships prebuilt binaries.

## Run it (Windows, macOS, Linux)

Requires Node 22+ and pnpm (`npm i -g pnpm`).

```bash
pnpm install        # downloads Electron; no build tools needed
pnpm dev            # launches the app with hot reload
```

First launch opens the onboarding wizard. Package an installer with:

```bash
pnpm dist:win       # release/NotWhisperFlow-*-Setup.exe (NSIS)
pnpm dist:mac       # dmg    |  pnpm dist:linux  # AppImage
```

## Installing on Windows: SmartScreen and Smart App Control

The installer is **not code-signed** (signing certificates cost money; this is a
free personal project). Windows therefore treats it as an unknown app, in one of
two ways depending on your machine.

**SmartScreen** — a blue "Windows protected your PC" dialog. Click **More info →
Run anyway**. This is the common case and there is nothing else to do.

**Smart App Control** — blocks the app outright with no "Run anyway" option. It
only runs code that is signed by a known publisher or already trusted by
Microsoft's reputation service, and it has no per-app allow list. It is on by
default only on some clean installs of Windows 11.

If Smart App Control is blocking it, you have two options:

**Option 1 — run it without the installer (recommended).** Build it yourself with
`pnpm dist:win` and run `release\win-unpacked\NotWhisperFlow.exe` directly. Copy
that folder anywhere you like and make a shortcut to the `.exe`. Code you compiled
on your own machine isn't subject to the same download-reputation checks, so
nothing needs to be turned off.

**Option 2 — turn Smart App Control off.** Windows Security → **App & browser
control** → **Smart App Control settings** → **Off**.

> ⚠️ **This is a one-way change.** Once Smart App Control is set to Off, Windows
> will not let you turn it back on — re-enabling it requires a clean reinstall or
> reset of Windows. It also switches that protection off for *every* program on
> the machine, not just this one. Only do this if you understand and accept that
> trade-off; otherwise use Option 1.

Each release publishes the SHA-256 of its installer. Verify your download matches
before running it:

```powershell
Get-FileHash .\NotWhisperFlow-*-Setup.exe -Algorithm SHA256
```

## 5-minute verification checklist

1. `pnpm install && pnpm dev` — main window opens with onboarding.
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
