# Palette rollouts across independent ports

Ports freeze their own palette inputs. Editing core does not change installed themes, run application generators or
silently publish new colors. To apply a palette change consistently, adopting ports must regenerate and validate
separately. You do not have to type the same commands in every checkout: the opt-in batch command below delegates
to each port's own maintenance commands. There is no central application compiler or registry.

## 1. Prepare and commit core

Edit `palette/flavors.mjs`, then run in core:

```sh
pnpm build
pnpm check
pnpm test
# Review and commit the palette/math inputs AND their generated exports.
git rev-parse HEAD
```

The batch selects that exact core HEAD. Its committed `exports/ports/palette.json`, data fingerprint and three
palette/resolver/math input hashes must agree with both Git and the working files. Uncommitted core documentation
or tooling changes are allowed; dirty palette inputs and exports are not. You can require a particular full SHA
with `--revision <40-hex-sha>`.

## 2. Prepare the selected port checkouts

Review/commit existing work first. **Tracked, staged and untracked changes block a port**, including new local
maintenance files. There is no `--force` or `--allow-dirty` escape hatch. Never discard work to make this check pass.

Each port needs its committed pin, generator, generated-file allowlist, standard maintenance scripts, package and
lockfile. It must define `palette:update`, `build`, `check` and `test`. Install required dependencies separately with
`pnpm install --frozen-lockfile`. The orchestrator does not install packages or fetch/pull repositories.

If core's color-math implementation changed, do not blindly copy it to every port. Review/adopt the math and palette
together in each affected port as an explicit migration, then commit that reviewed change. This batch handles
compatible palette adoption, not an automatic math-code migration.

## 3. Plan, then apply explicitly

Run from core. Select specific checkouts:

```sh
pnpm palette:update:ports ../kitty ../nvim ../vscode
pnpm palette:update:ports ../kitty ../nvim ../vscode --apply
```

Or scan immediate child directories containing a root `port.json`:

```sh
pnpm palette:update:ports --ports-root ..
pnpm palette:update:ports --ports-root .. --apply
```

The scan is local, non-recursive and does not follow directory symlinks. Core, landing and other directories without
`port.json` are not selected. It does not list GitHub or hard-code application names. Use explicit paths if a parent
contains ports you do not want to update. Duplicate selections and non-root repository directories are refused.

The default is a **read-only plan**, not an update. An invalid/dirty checkout makes the plan fail. Apply preflights
**the entire selection before any port command runs**. One blocked port blocks the whole batch rather than
silently updating a subset. It acquires exclusive per-checkout locks, then revalidates the plan before proceeding.

For each selected port, apply runs in order:

```text
pnpm run palette:update /absolute/path/to/core
pnpm run build
pnpm run check
pnpm run test
```

Two ports run concurrently by default; `--concurrency 1` through `4` is supported. Pin adoption is checked against the
selected export/revision, and port HEAD/index must remain unchanged. Only `palette/theme.json` and the port's exact
reviewed generated-file allowlist may have tracked/unignored changes. Documentation, captures, workflows, package
metadata and maintenance controls are protected. This is not a sandbox: run only trusted, reviewed port scripts;
ignored caches and arbitrary external side effects cannot be constrained by Git-diff checks.

Apply currently requires Linux, macOS or WSL. It uses POSIX process groups so cancellation or a failed/timed-out
command cannot leave normal descendants generating files after its lock has been released. Every command has a
180-second timeout and a 4 MiB captured-output limit. Only a bounded diagnostic tail is included in failed reports.

## 4. Read the result and review each diff

Each port is reported as `planned`, `blocked`, `updated`, `unchanged`, `failed` or `skipped`.

- Preflight/lock failure: no port commands run. Resolve the reported issue and plan again.
- An ordinary build/check/test failure: that port stops; other selected ports are still checked.
- Core changes mid-run, unexpected writes, HEAD/index changes or cancellation: not-yet-started work stops;
  in-flight work is drained before locks are released.
- Runtime failures leave their partial pin/generated diffs intact for diagnosis. **There is no cross-repository
  transaction or automatic rollback/reset.** Do not mistake a partial update for a release-ready port.

For machine-readable output:

```sh
pnpm palette:update:ports --ports-root .. --apply --json > /tmp/palette-rollout.json
```

Choose a report location outside selected port checkouts, otherwise creating the redirected file can make one dirty
before preflight. `ready` means the preflight succeeded, not that every subsequent phase passed. Check each port's
status/steps. Nonzero exit means blocked, failed, skipped or interrupted work; interruption exits 130.

Inspect each port's pin, generated files and semantic/native-format tests. Some tests intentionally pin role
contracts and may need a reviewed expectation update when policy changes. Refresh real application captures when
colors visibly change. Then commit/push reviewed changes and create releases where required by that app's channel.
The command never creates branches, commits, pushes, submits PRs, publishes packages, bumps versions or refreshes
screenshots. A second run refuses those uncommitted diffs until they are reviewed/committed.

A live batch uses `living-code-palette.lock` inside each checkout's Git directory (including a linked worktree's own
Git directory). Never remove a live lock. If a process was killed, check the recorded PID before manually removing
its stale lock. The tool never steals one. Coordinate with other Git/build operations; locks only coordinate this
orchestrator, not arbitrary editors or commands.

## Individual adoption remains available

In a single port:

```sh
pnpm palette:update /path/to/core
pnpm build
pnpm check
pnpm test
```

Ordinary builds read only the checked-in pin. Individual maintainer operations can be used for a deliberately
staggered rollout or a special math/mapping migration. No central tool owns the application's generator.

## Update the website's own palette separately

After building and committing core:

```sh
pnpm export:landing --landing ../landing
```

Review/commit the delivered theme inputs in landing and let its validation/deployment workflow publish them.
Port discovery updates the website after port pushes; it does not export a new website palette from core.
R2 is independent of all of this: it stores immutable website capture assets, not palette inputs or generators.
