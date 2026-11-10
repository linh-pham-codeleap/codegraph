# CodeGraph — ColdFusion (CFML) fork

This is a fork of [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) with extra CFML support that isn't in an official release yet:

- **`<cfinvoke>` calls are indexed.** `<cfinvoke component="a.b.Svc" method="run">` links to `Svc.run` (or the method `Svc` inherits), so `callers`, `impact` and `codegraph_explore` see calls made through `<cfinvoke>`. This includes component paths with a runtime prefix (`component="#application.cfcRoot#.Svc"`) and `<cfinvoke method="run">` without a component.
- Everything merged upstream since the last official release, such as the `createObject("component", …)` and `<cfinclude>` fixes. The fork syncs with upstream `main` through a daily PR.

Releases are tagged **`vX.Y.Z-cf.N`**: upstream version `X.Y.Z` plus fork build `N`, for example `v1.6.2-cf.1`. A `-cf` version is never an official CodeGraph release. Everything else works as upstream does; see the [main README](README.md).

## Install

No Node, Git or build tools needed. The installer downloads a self-contained bundle from this fork's [Releases](https://github.com/linh-pham-codeleap/codegraph/releases).

**macOS / Linux**

```bash
curl -fsSL https://raw.githubusercontent.com/linh-pham-codeleap/codegraph/main/install.sh | sh
```

**Windows (PowerShell)**

```powershell
irm https://raw.githubusercontent.com/linh-pham-codeleap/codegraph/main/install.ps1 | iex
```

Check it:

```bash
codegraph --version   # e.g. 1.6.2-cf.1 — the -cf suffix means you're on the fork
```

**Already have the official CodeGraph?** Run the same command. It installs into the same place (`~/.codegraph`, launcher in `~/.local/bin`) and replaces the official build. Your agent setup and project indexes stay as they are. If you installed the official one with `npm i -g @colbymchenry/codegraph`, remove that first (`npm rm -g @colbymchenry/codegraph`), or it may stay first on `PATH`. The installer warns you when that happens.

Pin a version with `CODEGRAPH_VERSION=v1.6.2-cf.1` before `sh`.

### Connect your agent

If CodeGraph isn't set up in your agent yet (Claude Code, Cursor, Codex, …):

```bash
codegraph install
```

Agents start `codegraph` from `PATH`, so they use the fork once `codegraph --version` shows `-cf`. Restart the agent afterwards.

## Index your project

The fork extracts more than the official build, so rebuild any existing index once:

```bash
cd /path/to/your/cfml-project
codegraph index -f .      # or `codegraph init .` for a new project
codegraph status .
```

Quick check that `<cfinvoke>` calls are picked up:

```bash
codegraph callers <aMethodYouCallThroughCfinvoke>
```

## Update

```bash
codegraph upgrade
```

On the fork, `upgrade` installs the fork's latest `-cf` release (`codegraph upgrade --check` only reports it). Rebuild project indexes afterwards with `codegraph index -f .`.

## Uninstall / back to official

```bash
curl -fsSL https://raw.githubusercontent.com/linh-pham-codeleap/codegraph/main/install.sh | sh -s -- --uninstall
```

To go back to the official build instead, run its installer, which replaces the fork:

```bash
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
```

## Build from source (contributors)

You need Node.js 22.12 or later, below 25:

```bash
git clone https://github.com/linh-pham-codeleap/codegraph.git
cd codegraph
npm ci && npm run build
node dist/bin/codegraph.js --help
```

## Releasing (maintainer)

1. Merge what you want to ship, for example the daily upstream sync PR. Use a **merge commit**.
2. Go to Actions → **Fork release** → Run workflow.

The workflow tags `v<upstream version>-cf.<next N>` and builds bundles for macOS, Linux and Windows (x64 and arm64). It smoke-tests one bundle, then publishes the Release, which the installers and `codegraph upgrade` pick up. Bundles skip upstream's optional native Rust kernel and use the wasm extraction path, which gives the same graph a little slower.

## Known gaps (CFML)

- A component in a variable (`component="#oSvc#"`) or a method named at runtime (`method="#m#"`) can't be linked.
- A bare component name that two components share is left unlinked rather than guessed.
- A dotted path whose case doesn't match the file name (`api.myService` for `api/MyService.cfc`) doesn't resolve.
- `invoke("svc", "run")` and script-style `cfinvoke(…)` aren't covered yet.
