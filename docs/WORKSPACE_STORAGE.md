# Workspace storage maintenance

## Worktree budget

Keep 3–4 active worktrees; the normal maximum is 5, including the primary checkout.
A completed branch or open PR does not need a permanent checkout. Before opening a
worktree or installing large tools, run `git worktree list` and
`df -h /workspaces/ipm-event /tmp`. These paths can use separate filesystems.

Below 8 GiB free workspace space, review storage and retire completed checkouts.
Below 5 GiB, pause new installs/builds until reviewed maintenance restores headroom.
Never discard unique source or evidence to meet a storage target. Do not prune
Docker volumes or stopped database containers automatically.

This maintenance change removes generated Metro caches from tracking. Historical
branches may still track them. Create those worktrees without populating the cache:

```sh
git worktree add --no-checkout -b YOUR_BRANCH .worktrees/YOUR_TASK origin/staging
git -C .worktrees/YOUR_TASK sparse-checkout set --no-cone '/*' '!/frontend/.metro-cache/'
git -C .worktrees/YOUR_TASK read-tree -mu HEAD
```

Fetch remote refs first. Prefer sparse checkouts for documentation/backend-only
work. Preserve committed/pushed work and unique local files before retiring a
checkout; retain its branch. Do not reuse a divergent checkout for unrelated work.

## Shared download caches

Run local tooling through the wrapper from inside the target worktree:

```sh
python /path/to/scripts/with_tool_cache.py -- npm ci
python /path/to/scripts/with_tool_cache.py -- python -m pytest
python /path/to/scripts/with_tool_cache.py --browser-install -- npx --no-install playwright install chromium
python /path/to/scripts/with_tool_cache.py -- npx --no-install playwright test
```

It sets NPM_CONFIG_CACHE, PLAYWRIGHT_BROWSERS_PATH and PIP_CACHE_DIR below the
private, user-owned `/tmp/ipm-tool-cache-<uid>` directory. Override its root with
IPM_TOOL_CACHE_ROOT when another suitable cache filesystem is available. No global
settings or deployed environment configuration are changed.

Share only download caches and browser binaries. Each worktree must own its
node_modules, Python environment, browser profiles and compiled output. Never
symlink dependencies between concurrent worktrees. Keep the known-working
installation until a replacement is proven. Existing lockfile reproducibility
issues require a separate task; this change does not repair lockfiles or upgrade
packages. The wrapper does not make an incomplete lockfile reproducible.

Wrapped commands take a shared worktree lock; cleanup requires exclusive access.
Browser installation/garbage collection takes an exclusive browser lock against
other wrapped commands. Tools started outside the wrapper are not covered: stop
them before cleanup or browser maintenance. Install only needed browser engines.
Do not evict shared caches while tools run; automatic eviction is not enabled.

## Generated artifacts and retention

Put new transient screenshots, traces, videos, browser profiles and exports in the
worktree-root `.artifacts/` directory. Review these after acceptance or within seven
days: preserve the final report and reproduction steps, then remove only confirmed
reproducible artifacts. This mixed-purpose directory is not automatically deleted.

Do not blanket-ignore or delete diagnostics, source archives, event media,
manifests, migrations or security reports. Historically tracked frontend/dist
files remain tracked and are protected by the maintenance tool. Use disposable
build copies or a supported separate output directory for validation.

`/tmp/ipm-*` is not a deletion allowlist. Inspect every directory for Git metadata,
unique source and evidence before removing it. Keep important reports, patches and
recovery manifests on persistent storage. Only reproducible copies and download
caches may live exclusively in /tmp. Sensitive diagnostics, credentials and raw
dumps must stay private and must not be staged with maintenance documentation.

## Maintenance routine

Run the dry-run weekly and before large builds:

```sh
python scripts/workspace_maintenance.py --repo /workspaces/ipm-event
```

Review its candidates and stop unwrapped builds before explicit cleanup:

```sh
python scripts/workspace_maintenance.py --repo /workspaces/ipm-event --apply
```

Only known, ignored, regeneratable directories older than seven days are eligible.
The tool reports estimated allocated bytes and the observed filesystem free-space
delta. Concurrent unrelated filesystem activity may affect that delta.

It never runs git clean, deletes node_modules, deletes arbitrary untracked source,
prunes branches, or blanket-cleans /tmp. It refuses tracked files, unignored paths,
symlinks, nested repositories/filesystems, active locks and ambiguous Git operations.

Worktree retirement is a separate mode, requiring reviewed clean status, no ignored
files, current remote ancestry evidence and explicit confirmation of the full HEAD:

```sh
python scripts/workspace_maintenance.py --repo /workspaces/ipm-event --remove-worktree /absolute/completed-worktree
python scripts/workspace_maintenance.py --repo /workspaces/ipm-event --remove-worktree /absolute/completed-worktree --apply --confirm-head FULL_REVIEWED_SHA
```

Review dependencies and unique ignored files separately before retirement. Preserve
needed files with checksums in private persistent recovery storage; never bypass a
refusal with force. The current checkout and primary checkout cannot be removed by
this mode. At workstream completion, verify the remote commit and final evidence,
retire the clean checkout, and retain the branch for review or later recovery.
