# Kickoff Prompts — Copy-Paste to an Implementation Model

Paste one of these into a fresh Claude Code (Sonnet/Opus) session opened on this repo.
Each prompt is self-contained; the model gets its detailed spec from the docs.

## Universal preamble (always include first)

```text
You are implementing one scoped task in the WhisprFlow repo (an Electron dictation app).
Before writing any code:
1. Read docs/HANDOFF.md fully — its five hard rules are non-negotiable.
2. Read your task's section in docs/milestones/LATER.md (and AS-BUILT.md for context).
3. Run: pnpm install && pnpm typecheck && pnpm lint && pnpm build — confirm a clean baseline.
Work only on your task. Follow existing patterns (trace the history feature end-to-end for
the IPC pattern: shared/types.ts → shared/ipc-channels.ts → shared/api.ts → preload/index.ts
→ main/ipc.ts → renderer). When done: typecheck + lint + build must pass, then report what
you changed, what you verified, and what needs manual desktop testing.
```

## Task prompts

**L6 — Meeting transcription (design first)**
```text
Do NOT implement. Write a design doc at docs/milestones/M-MEETINGS-DESIGN.md for task L6
per the constraints in docs/milestones/LATER.md: loopback capture options per OS, chunked
streaming through the existing whisper worker, UI states, explicit v1 non-goals.
End with open questions for Sajal to decide.
```

**L7 — Auto-updater**
```text
Implement task L7 (Auto-updater) from docs/milestones/LATER.md, but only if the GitHub
repo has public releases configured. electron-updater + GitHub provider, check on launch,
tray item "Check for updates". Keep every code path out of the dictation pipeline.
```

**Bug fix template**
```text
Bug in WhisprFlow: <paste exact error / wrong behavior + steps>.
Read docs/HANDOFF.md first. Reproduce, then isolate the failing stage of the pipeline
(recorder → IPC → router → provider → cleanup → replacements → db → paste) before changing
anything. Smallest possible fix; no drive-by refactors. typecheck + lint + build must pass.
```

**New feature template**
```text
New WhisprFlow feature: <one-sentence outcome>.
First write a short spec in docs/milestones/LATER.md following the format of the existing
entries (files to touch, patterns to copy, verification list). Then implement it exactly.
Respect the five hard rules in docs/HANDOFF.md — especially: no provider lock-in, no
native compile steps.
```
