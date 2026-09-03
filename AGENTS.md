# IPM Codex Working Policy

## Default autonomy

For normal IPM development work, proceed without asking the user for confirmation at every intermediate step.

When asked to fix, build, change, implement, investigate and fix, test, or deploy to staging:

- Inspect the relevant code.
- Make the requested in-scope changes.
- Run appropriate tests, linters, type checks, and builds.
- Resolve ordinary in-scope failures caused by the work.
- Commit completed work and push it to the explicitly assigned non-production branch.
- Deploy to staging when staging deployment or verification is explicitly requested or clearly required.
- Verify the staging result and prefer one final report over repeated intermediate approval requests.

Routine reads, searches, isolated-worktree creation, in-scope edits, tests, builds, local commits, remote fetches, non-production pushes, read-only staging checks, and explicitly requested staging deployments do not require repeated user confirmation.

## Git safety

- Treat GitHub remote branches as the source of truth.
- Use isolated worktrees for independent workstreams.
- Do not reuse obsolete or divergent local staging branches.
- Never overwrite newer staging work.
- Never force-push or rewrite shared history without explicit approval.
- Never merge all of staging into main merely to promote one feature.
- Prefer narrowly scoped feature promotion.

## Protected actions

Obtain explicit user approval before:

- Deploying production or pushing or merging to main unless already explicitly authorized.
- Modifying production data or applying production database writes.
- Performing destructive resets, deleting branches with unrecovered work, or deleting user/project data.
- Rotating or changing secrets or credentials.
- Making purchases or other paid external actions.
- Materially expanding scope or guessing where ambiguity could damage production behavior.

Unless explicitly authorized, do not modify production environment configuration, deploy production, write production databases, or push or merge to main.

## Failures

Investigate and resolve ordinary in-scope test, lint, build, and merge-conflict failures. Stop when required source data is missing and guessing would be unsafe, production risk is involved, resolution requires unrelated or destructive changes, or the acceptance criteria cannot safely be met.
