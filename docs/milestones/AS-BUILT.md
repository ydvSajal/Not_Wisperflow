# As-Built Milestones (M0–M6)

Contract of what each layer does and how to re-verify it after changes.
File paths are the authority; see `docs/HANDOFF.md` for the full map.

## M0 — Scaffold
electron-vite (ESM main, two renderer entries `index.html`/`bar.html`), React 19,
TS strict (split `tsconfig.node.json` / `tsconfig.web.json`), Tailwind v4 via
`@tailwindcss/vite`, ESLint 9 flat config, icon generator (`scripts/gen-icons.mjs`).
**Verify:** `pnpm typecheck && pnpm lint && pnpm build` clean; `pnpm dev` opens both windows (bar hidden until recording).

## M1 — Transcription core
`TranscriptionProvider` interface; local = worker thread running transformers.js q8 ONNX
(`whisper-worker.ts` is its own bundle entry — keep it in `electron.vite.config.ts` inputs);
cloud = `/audio/transcriptions` fetch; model cache detection under `<userData>/models`;
download progress events end-to-end (worker → `local-whisper.ts` 'progress' → `EVT.modelProgress` → `ModelList`).
**Verify:** `pnpm test:whisper` passes; downloading a model in Settings shows a moving percent and flips to Downloaded.

## M2 — Dictation loop
Hotkey toggle → `DictationController` → bar capture → transcribe → paste. Bar window is
`focusable:false` + `showInactive()` — never break this, paste depends on the target app
keeping focus. Esc cancels only while recording (global registration is scoped).
Session counter invalidates stale async results after cancel. 5-min recording cap.
**Verify:** README checklist steps 3–4; also: press hotkey twice fast (no crash), Esc mid-recording (bar hides, nothing pasted), dictate silence (error "No speech detected", nothing saved).

## M3 — Settings + Onboarding
All settings persist via one `settings.set` path and broadcast `EVT.settingsChanged`;
hotkey changes validate-then-rollback (`ipc.ts`); launch-at-login syncs to the OS.
Onboarding gates on `settings.onboarded`.
**Verify:** change hotkey to a combo owned by another app → toast + old hotkey still works; delete `settings.json` → onboarding reruns; every toggle survives an app restart.

## M4 — History + Stats
`node:sqlite` table `transcriptions` (see `db.ts`); WPM = words / duration-minutes,
computed at insert. Stats aggregates in SQL + local-day grouping in JS (streak, 30-day chart).
**Verify:** dictation appears in History instantly (EVT.dictationDone), search filters, delete/clear work, Stats numbers change accordingly; day boundaries use local time.

## M5 — Cleanup + polish
Optional LLM cleanup (`cleanup/index.ts`) — must never throw; raw text is the fallback.
Sounds are WebAudio chirps in the bar (no audio assets). Errors surface in the bar
(capture/model/key issues) or as toasts (settings tests).
**Verify:** enable cleanup with a bad key → dictation still pastes raw text; sounds toggle silences chirps.

## M7 — Stage 2 features (former roadmap L1–L5)
**Translation hotkey:** second accelerator (`translateHotkey`, empty = disabled) →
`dictation.toggle('translate')` → `translateText()` in `cleanup/index.ts` (same
OpenAI-compatible config as cleanup, falls back to untranslated). Validate/rollback
mirrors the main hotkey in `ipc.ts`; bar shows a `→ XX` chip.
**Tray quick controls:** `tray.ts` builds its menu from `settings.get()` and rebuilds on
the store's `'changed'` event; the settings broadcast to renderers now lives in that same
listener in `ipc.ts` (single source — do not re-add a broadcast in the `settingsSet` handler).
**Dictionary:** `replacements` table + CRUD in `db.ts`; `applyReplacements()` runs after
cleanup/translate in both dictation and import paths; invalid regex rejected at insert.
**Audio import:** History page drag-and-drop / picker → `lib/audio-import.ts` decodes and
resamples to 16 kHz mono via OfflineAudioContext (no ffmpeg) → `importAudio()` in
`dictation.ts` (shared post-processing, no paste). 30-minute cap.
**Notes:** `notes` table + CRUD; Notes page (list, search, autosave editor, delete);
`AppendToNote` popover on history rows.
**Verify:** translate-dictate pastes the target language and History keeps the raw
transcript; tray toggles reflect in Settings instantly and vice versa; a dictionary entry
rewrites the next dictation; dropping a 30 s mp3 creates a history entry; append-to-note
from History lands in the note; all data survives restart.

## M6 — Packaging + docs
`electron-builder.yml`: `asar:false` and `npmRebuild:false` are load-bearing (worker-thread
module resolution / no-compile guarantee). Icons generated, not committed as binaries.
**Verify:** `pnpm dist:win` on Windows produces a working installer; installed app passes the README checklist.
