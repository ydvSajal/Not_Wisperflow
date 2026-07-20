# Later Roadmap — Guided Tasks for Implementation Models

> Each task below is self-contained and written imperatively for a Sonnet-class model.
> Before starting any task: read `docs/HANDOFF.md` fully, then run
> `pnpm typecheck && pnpm lint && pnpm build` to confirm a clean baseline.
> After finishing: run the same three commands, plus the task's own verification list.
> One task = one branch = one focused diff. Do not drift into neighboring features.

> **Shipped in stage 2** (specs preserved in `AS-BUILT.md` § M7): L1 translation hotkey,
> L2 tray quick controls, L3 custom vocabulary, L4 audio file import, L5 notes system.

---

## L6 — Meeting transcription (largest; split before starting)

Continuous transcription of system audio with the bar pinned. Requires per-OS loopback
capture (Electron `desktopCapturer` audio on Windows) and chunked streaming through the
existing worker. Write a design doc in `docs/milestones/M-MEETINGS-DESIGN.md` and get it
approved before implementing. Do not attempt speaker diarization in v1.

## L7 — Auto-updater

Only when the repo has public releases: `electron-updater` + GitHub provider, check on
launch, menu item "Check for updates". Keep it out of the dictation path entirely.

## Candidate follow-ups (unscoped — scope them like the tasks above before starting)

- Per-app paste profiles (e.g. append a trailing space in editors, plain Enter in chats)
- Whisper GPU acceleration via onnxruntime DirectML/CUDA execution providers
- Export history/notes to Markdown files
- Local semantic search over history (embeddings, still no cloud requirement)

---

## Bug-fix protocol (any model, any time)

1. Reproduce first; paste the exact error into your notes. Isolate the failing module —
   the pipeline is deliberately modular (recorder → IPC → router → provider → cleanup →
   replacements → db → paste); test the failing stage alone before rewriting anything.
2. The fix must not violate the five hard rules in `docs/HANDOFF.md`.
3. Add the edge case to the relevant milestone doc's verification list.
