# Kickoff Prompts — Copy-Paste to an Implementation Model

Paste one of these into a fresh Claude Code (Sonnet/Opus) session opened on this repo.
Each prompt is self-contained; the model gets its detailed spec from the docs.

## Universal preamble (always include first)

```text
You are implementing one scoped task in the WhisprFlow repo (an Electron dictation app).
Before writing any code:
1. Read docs/HANDOFF.md fully — its five hard rules are non-negotiable.
2. Read your task's section in docs/milestones/LATER.md.
3. Run: pnpm install && pnpm typecheck && pnpm lint && pnpm build — confirm a clean baseline.
Work only on your task. Follow existing patterns (trace the history feature end-to-end for
the IPC pattern: shared/types.ts → shared/ipc-channels.ts → shared/api.ts → preload/index.ts
→ main/ipc.ts → renderer). When done: typecheck + lint + build must pass, then report what
you changed, what you verified, and what needs manual desktop testing.
```

## Task prompts

**L1 — Translation hotkey**
```text
Implement task L1 (Translation hotkey) exactly as specified in docs/milestones/LATER.md.
Second global shortcut → dictate → translate via the OpenAI-compatible chat pattern in
src/main/cleanup/index.ts → paste translated text. Settings UI: second HotkeyRecorder +
target language Select. Do not touch the primary dictation path's behavior.
```

**L2 — Tray quick controls**
```text
Implement task L2 (Tray quick controls) from docs/milestones/LATER.md. Checkbox/radio
menu items bound to the settings store, rebuilt on its 'changed' event. Two-way sync
with the Settings page must work (EVT.settingsChanged already broadcasts).
```

**L3 — Custom vocabulary**
```text
Implement task L3 (Custom vocabulary / replacements) from docs/milestones/LATER.md.
New sqlite table + CRUD IPC (copy the history pattern), replacements applied in
DictationController.onAudio after cleanup, "Dictionary" card in Settings.
```

**L4 — Audio file import**
```text
Implement task L4 (Audio file import) from docs/milestones/LATER.md. Drag-and-drop on
the History page; decode/resample to 16 kHz mono Float32 in the renderer with
OfflineAudioContext (no ffmpeg dependency); reuse the existing transcribe() router.
```

**L5 — Notes system**
```text
Implement task L5 (Notes) from docs/milestones/LATER.md. Plain textarea editor —
no new heavy dependencies. Include "append last dictation to note" from History rows.
```

**L6 — Meeting transcription (design first)**
```text
Do NOT implement. Write a design doc at docs/milestones/M-MEETINGS-DESIGN.md for task L6
per the constraints in docs/milestones/LATER.md: loopback capture options per OS, chunked
streaming through the existing whisper worker, UI states, explicit v1 non-goals.
End with open questions for Sajal to decide.
```

**Bug fix template**
```text
Bug in WhisprFlow: <paste exact error / wrong behavior + steps>.
Read docs/HANDOFF.md first. Reproduce, then isolate the failing stage of the pipeline
(recorder → IPC → router → provider → cleanup → db → paste) before changing anything.
Smallest possible fix; no drive-by refactors. typecheck + lint + build must pass.
```
