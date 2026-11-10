/**
 * Three ways tag-based CFML lost calls between components:
 *
 * - A dotted path spelled in another case than the file (`app.services.authservice`
 *   for `app/services/AuthService.cfc`) didn't resolve: CFML ignores case, the
 *   resolver matched the component's name exactly.
 * - A bare component name behind a runtime prefix (`#application.root#.userManager`)
 *   went to the same-named component beside the caller, even when that one lacks
 *   the method and another component of that name has it.
 * - The `cfml` grammar can lose a `<cffunction>` to error recovery (markup text with
 *   a stray quote, or a broken tag earlier in the file), so the function, its callers
 *   and its calls disappeared. Such functions are now parsed again on their own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CodeGraph } from '../src';

let dir = '';
let edges: string[] = [];
let methods: string[] = [];

const files: Record<string, string> = {
  'app/services/AuthService.cfc': `<cfcomponent>
\t<cffunction name="validateToken" access="public"><cfreturn true></cffunction>
</cfcomponent>
`,
  'app/services/MailService.cfc': `component {\n\tfunction send() {}\n}\n`,
  // Two components named userManager; only the shared one has getSettings.
  'app/api/userManager.cfc': `<cfcomponent>
\t<cffunction name="list" access="remote">
\t\t<cfinvoke component="#application.root#.userManager" method="getSettings">
\t</cffunction>
</cfcomponent>
`,
  'app/shared/UserManager.cfc': `<cfcomponent>
\t<cffunction name="getSettings" access="public"><cfreturn {}></cffunction>
\t<cffunction name="save" access="public"></cffunction>
</cfcomponent>
`,
  'app/legacy/UserManager.cfc': `<cfcomponent>
\t<cffunction name="save" access="public"></cffunction>
</cfcomponent>
`,
  'app/api/Orders.cfc': `<cfcomponent>
\t<cffunction name="list" access="remote">
\t\t<cfinvoke component="app.services.authservice" method="validateToken">
\t\t<cfinvoke component="APP.Services.MailService" method="send">
\t\t<cfinvoke component="#application.root#.userManager" method="save">
\t</cffunction>
</cfcomponent>
`,
  // `prompt`'s text has a stray quote in markup, which loses the function to
  // the grammar's error recovery; `<cfset … b="c>` in `broken` loses every
  // function after it.
  'app/api/Prompts.cfc': `<cfcomponent>
\t<cffunction name="prompt" access="remote">
\t\t<cfinvoke component="app.services.MailService" method="send">
\t\t<cfsavecontent variable="text"><div class="a>b</cfsavecontent>
\t\t<cfreturn text>
\t</cffunction>
\t<cffunction name="broken" access="private">
\t\t<cfset a = 1 b="c>
\t</cffunction>
\t<cffunction name="afterBroken" access="remote">
\t\t<cfinvoke component="app.services.AuthService" method="validateToken">
\t</cffunction>
\t<!--- <cffunction name="commentedOut"></cffunction> --->
\t<cffunction name="last" access="remote">
\t\t<cfinvoke component="app.services.MailService" method="send">
\t</cffunction>
</cfcomponent>
`,
};

beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfml-resolve-more-'));
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), body);
  }
  const cg = await CodeGraph.init(dir, { silent: true });
  await cg.indexAll();
  const db = (cg as any).db.db;
  edges = db
    .prepare(
      `SELECT s.qualified_name src, s.file_path sfile, t.qualified_name tgt, t.file_path file FROM edges e
         JOIN nodes s ON s.id = e.source JOIN nodes t ON t.id = e.target
        WHERE e.kind = 'calls'`
    )
    .all()
    .map((r: any) => `${r.sfile}::${r.src.split('::').pop()} -> ${r.file}::${r.tgt.split('::').pop()}`)
    .sort();
  methods = db
    .prepare(`SELECT name, start_line, end_line FROM nodes WHERE kind = 'method' AND file_path = 'app/api/Prompts.cfc' ORDER BY start_line`)
    .all()
    .map((r: any) => `${r.name} ${r.start_line}-${r.end_line}`);
  cg.close?.();
});

afterAll(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

describe('CFML resolution: case, runtime-prefixed names, functions the grammar loses', () => {
  it('resolves a dotted component path whatever its case', () => {
    expect(edges).toContain('app/api/Orders.cfc::list -> app/services/AuthService.cfc::validateToken');
    expect(edges).toContain('app/api/Orders.cfc::list -> app/services/MailService.cfc::send');
  });

  it('links a bare name to the one same-named component that has the method', () => {
    expect(edges).toContain('app/api/userManager.cfc::list -> app/shared/UserManager.cfc::getSettings');
  });

  it('leaves a bare name unlinked when several same-named components have the method', () => {
    expect(edges.filter((e) => e.endsWith('::save'))).toEqual([]);
  });

  it('declares every function the grammar lost, with its line range and its calls', () => {
    expect(methods).toEqual(['prompt 2-6', 'broken 7-9', 'afterBroken 10-12', 'last 14-16']);
    expect(edges).toContain('app/api/Prompts.cfc::prompt -> app/services/MailService.cfc::send');
    expect(edges).toContain('app/api/Prompts.cfc::afterBroken -> app/services/AuthService.cfc::validateToken');
    expect(edges).toContain('app/api/Prompts.cfc::last -> app/services/MailService.cfc::send');
  });

  it('leaves the component no calls that belong to its functions', () => {
    expect(edges.filter((e) => e.startsWith('app/api/Prompts.cfc::Prompts '))).toEqual([]);
  });
});
