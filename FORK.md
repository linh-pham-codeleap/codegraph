# CodeGraph — ColdFusion (CFML) fork

This is a fork of [colbymchenry/codegraph](https://github.com/colbymchenry/codegraph) with extra CFML support that isn't in an official release yet:

- **`<cfinvoke>` calls are indexed.** `<cfinvoke component="a.b.Svc" method="run">` links to `Svc.run` (or the method `Svc` inherits), so `callers`, `impact` and `codegraph_explore` see calls made through `<cfinvoke>`. This includes component paths with a runtime prefix (`component="#application.cfcRoot#.Svc"`) and `<cfinvoke method="run">` without a component.
- Everything merged upstream since the last release, such as the `createObject("component", …)` and `<cfinclude>` fixes. The fork syncs with upstream `main` through a daily PR.

Everything else works exactly as upstream; see the [main README](README.md).

## Install

You need **Git** and **Node.js 22.12 or later, below 25** (`node --version`).

```bash
git clone https://github.com/linh-pham-codeleap/codegraph.git
cd codegraph
npm ci
npm run build
npm install -g .
```

`npm install -g .` links the global `codegraph` command to this folder, so **keep the folder**: deleting or moving it breaks the command.

### If you already have the official CodeGraph

The official installer puts `codegraph` in `~/.local/bin` (macOS/Linux) and that usually comes before npm's global bin on `PATH`, so you would keep running the official build. Check which one runs:

```bash
which -a codegraph   # first line is the one that runs
```

To use the fork, remove the official CLI's launcher and its bundled versions. Your agent setup and project indexes are left alone. Then check again:

```bash
rm ~/.local/bin/codegraph
rm -rf ~/.codegraph/versions
which codegraph       # should now be inside npm's global bin (npm prefix -g)
```

(Don't use `codegraph uninstall` for this: it also removes CodeGraph from your agents.)

> **Don't run `codegraph upgrade`.** It installs the official release over this fork. Update with the steps below instead.

### Connect your agent

If CodeGraph isn't set up in your agent yet (Claude Code, Cursor, Codex, …):

```bash
codegraph install
```

Agents start `codegraph` by name from `PATH`, so once `which codegraph` points to the fork they use it too. Restart the agent afterwards.

## Index your project

The fork extracts more than the official build did, so rebuild any existing index once:

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
cd /path/to/codegraph   # the folder you cloned
git pull
npm ci
npm run build
```

There's no need to reinstall, since the global command already points here. Then rebuild your project indexes with `codegraph index -f .`.

## Uninstall

```bash
npm uninstall -g @colbymchenry/codegraph
```

Then delete the cloned folder. To go back to the official build, run its installer: `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`.

## Known gaps (CFML)

- A component in a variable (`component="#oSvc#"`) or a method named at runtime (`method="#m#"`) can't be linked.
- A bare component name that two components share is left unlinked rather than guessed.
- A dotted path whose case doesn't match the file name (`api.myService` for `api/MyService.cfc`) doesn't resolve.
- `invoke("svc", "run")` and script-style `cfinvoke(…)` aren't covered yet.
