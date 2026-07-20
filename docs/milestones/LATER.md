# Later Roadmap — Guided Tasks for Implementation Models

> Each task below is self-contained and written imperatively for a Sonnet-class model.
> Before starting any task: read `docs/HANDOFF.md` fully, then run
> `pnpm typecheck && pnpm lint && pnpm build` to confirm a clean baseline.
> After finishing: run the same three commands, plus the task's own verification list.
> One task = one branch = one focused diff. Do not drift into neighboring features.

---

## L1 — Translation hotkey

**Goal:** a second global shortcut that dictates in any language and pastes the text translated to a target language.

- Add to `AppSettings` (`src/shared/types.ts`): `translateHotkey: string` (default `''` = disabled) and `translateTarget: string` (default `'en'`). Extend `DEFAULT_SETTINGS` in `src/main/settings.ts`.
- `src/main/hotkeys.ts`: register the second accelerator when non-empty; route to `dictation.toggle({ translate: true })`. Mirror the validate/rollback pattern used for `hotkey` in `src/main/ipc.ts`.
- `src/main/dictation.ts`: thread a `mode` through the state machine. After transcription, when mode is translate, call a new `translateText(text, target, cfg)` in `src/main/cleanup/index.ts` (same OpenAI-compatible chat pattern as `cleanupText`; system prompt: translate only, output nothing else; falls back to the untranslated text on failure).
- Settings UI (`pages/Settings.tsx`): second `HotkeyRecorder` + target-language `Select` inside the Shortcut card, only active when a cleanup/cloud API key exists.
- **Verify:** dictate in Hindi with target English → English text pasted; History stores the pasted (translated) text in `text` and the raw transcript in `rawText`; disabling the hotkey (empty) unregisters it.

## L2 — Tray quick controls

**Goal:** make the tray menu useful without opening the main window.

- `src/main/tray.ts`: add checkbox items for Auto-paste, Sounds, AI cleanup, and a radio group Local/Cloud engine, all reading `settings.get()` and writing `settings.set(...)`. Rebuild the menu on the store's `'changed'` event so external changes stay in sync.
- Show current model/engine as a disabled info row.
- **Verify:** toggling from the tray updates the Settings page live (settingsChanged event) and vice versa.

## L3 — Custom vocabulary / replacements

**Goal:** user-defined text replacements applied after transcription (e.g. "agen pay" → "AgenPay").

- New table `replacements(id, pattern TEXT, replacement TEXT, is_regex INTEGER)` in `src/main/db.ts` with CRUD functions; new IPC channels + `WhisprApi` methods (follow the history pattern end-to-end: `types.ts` → `ipc-channels.ts` → `api.ts` → `preload/index.ts` → `ipc.ts`).
- Apply replacements in `DictationController.onAudio` after cleanup, before `insertTranscription`.
- New "Dictionary" card in Settings: list, add, delete rows.
- **Verify:** add replacement, dictate the source phrase, pasted text contains the replacement; invalid regex rows are rejected with a toast, not a crash.

## L4 — Audio file import

**Goal:** drop an audio file on the History page → it is transcribed into history.

- Renderer: drag-and-drop zone on `pages/History.tsx`; read the file as ArrayBuffer, send over a new IPC channel.
- Main: decode to 16 kHz mono Float32. WAV: parse directly (extend `wav.ts` with a decoder). Other formats: decode in the renderer with `AudioContext.decodeAudioData` (OfflineAudioContext resample to 16 kHz) so no ffmpeg dependency is added — then send PCM as today.
- Reuse the existing `transcribe()` router; insert with `engine` as configured, `durationMs` from the decoded buffer length.
- **Verify:** a 30s wav and a .mp3 both produce history entries; a 20-minute file shows progress (transcribing state) and completes (chunking is already handled by `chunk_length_s`).

## L5 — Notes system (OpenWhispr parity, larger)

**Goal:** a Notes page where dictations can be appended into named notes.

- New tables `notes(id, title, body, updated_at)`; IPC CRUD; Notes page with list + TipTap-free plain `contentEditable`/textarea editor (do NOT add heavy editor deps without approval).
- "Append last dictation to note…" action in History rows.
- **Verify:** create/edit/search notes; append flows; data survives app restart.

## L6 — Meeting transcription (largest; split before starting)

Continuous transcription of system audio with the bar pinned. Requires per-OS loopback
capture (Electron `desktopCapturer` audio on Windows) and chunked streaming through the
existing worker. Write a design doc in `docs/milestones/` and get it approved before
implementing. Do not attempt speaker diarization in v1.

## L7 — Auto-updater

Only when the repo has public releases: `electron-updater` + GitHub provider, check on
launch, menu item "Check for updates". Keep it out of the dictation path entirely.

---

## Bug-fix protocol (any model, any time)

1. Reproduce first; paste the exact error into your notes. Isolate the failing module —
   the pipeline is deliberately modular (recorder → IPC → router → provider → cleanup →
   db → paste); test the failing stage alone before rewriting anything.
2. The fix must not violate the five hard rules in `docs/HANDOFF.md`.
3. Add the edge case to the relevant milestone doc's verification list.
