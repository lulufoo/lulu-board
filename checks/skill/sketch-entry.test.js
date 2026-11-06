import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '../..');
const cliDir = path.join(root, 'packages/board-cli');
const pack = fs.readFileSync(path.join(root, 'skills/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills/sketch/SKILL.md'), 'utf8');
const template = fs.readFileSync(path.join(root, 'skills/sketch/references/template.md'), 'utf8');
const cloudFlow = fs.readFileSync(path.join(root, 'skills/sketch/references/cloud-flow.md'), 'utf8');
const sharedCloud = fs.readFileSync(path.join(root, 'skills/references/cloud.md'), 'utf8');
const cliVersion = fs.readFileSync(path.join(cliDir, 'board_cli/core/version.py'), 'utf8').match(/VERSION = "(\d+(?:\.\d+)*)"/)[1];

const asNumbers = (version) => version.split('.').map(Number);
const isAtMost = (a, b) => {
  const [left, right] = [asNumbers(a), asNumbers(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const [x, y] = [left[i] || 0, right[i] || 0];
    if (x !== y) return x < y;
  }
  return true;
};

// The entry
assert.match(pack, /`sketch\/`/, 'pack lists sketch/');
assert.match(pack, /One Sketch diagram/, 'pack names sketch a diagram');
assert.doesNotMatch(pack, /picture/, 'pack no longer says picture');
assert.doesNotMatch(skill, /picture/, 'skill names the drawing a diagram');
assert.match(skill, /Done when a tool `url` is shown/, 'done is a tool url');
assert.doesNotMatch(skill + cloudFlow, /docs\//, 'an installed skill cites no repo docs');

// The program macro and its install
assert.match(skill, /\| `\$BOARD_CLI` \| `~\/\.local\/bin\/board-cli` \|/, 'one macro row for the installed program');
assert.match(skill, /CLI contract: `\$BOARD_CLI --help`/, 'the CLI contract lives in --help');
const minimum = skill.match(/Minimum version: `(\d+(?:\.\d+)*)`/);
assert.ok(minimum, 'skill declares a minimum version');
const install = skill.match(/\| `\$INSTALL_BOARD_CLI` \| `([^`]+)` \|/);
assert.ok(install, 'one macro row installs the program');
assert.ok(
  install[1].includes('/releases/download/board-cli-v' + minimum[1] + '/board-cli.pyz'),
  'install downloads the release of the minimum version',
);
assert.match(install[1], /-o ~\/\.local\/bin\/board-cli && chmod \+x ~\/\.local\/bin\/board-cli$/, 'install puts the program where the macro points and makes it executable');
assert.ok(isAtMost(minimum[1], cliVersion), 'the minimum version is not newer than the package version');
assert.match(skill, /Before the first `\$BOARD_CLI` call of a session, run `\$BOARD_CLI --version`/, 'the version is checked before the first call');
assert.match(skill, /is missing or its `version` is below the minimum, run `\$INSTALL_BOARD_CLI`/, 'a missing or old program is installed');
assert.ok(!fs.existsSync(path.join(root, 'skills/sketch/scripts/sketch_control.py')), 'the old entry is gone');
assert.ok(!fs.existsSync(path.join(root, 'skills/scripts/sketch_schema.py')), 'the old schema copy is gone');
assert.doesNotMatch(skill + cloudFlow, /SKETCH_CTL|sketch_control|\b(?:create|get|save|search)_diagram|MCP/, 'sketch no longer names the old entry or the MCP tools');

// Writing the HTML
assert.match(skill, /`:root`, `html`, and `body` selectors act on that document/, 'root selectors act on the frame document');
assert.match(skill, /## Render Environment/, 'skill names the render environment');
assert.match(skill, /sandboxed `iframe`/, 'fragment renders in a sandboxed iframe');
assert.match(skill, /No network/, 'skill states there is no network');
assert.match(skill, /Scripts run when the sketch mounts/, 'skill says scripts run');
assert.match(skill, /takes no pointer input by default, so `:hover` and drag do nothing\. A sketch may use click handlers\./, 'hover and drag do nothing; click handlers allowed');
assert.doesNotMatch(skill, /does not run scripts|The picture is static/, 'skill no longer says scripts are unsupported');
assert.doesNotMatch(skill, /Present mode|data-sketch-mode|click handlers and `:hover` do nothing/, 'skill does not describe the modes');
assert.match(skill, /## Performance/, 'skill has a performance section');
assert.match(skill, /Add animation only when the user asks for it/, 'skill limits animation');
assert.match(skill, /Animate only `transform` and `opacity`/, 'skill limits what may animate');
assert.match(skill, /Avoid `filter`, `backdrop-filter`/, 'skill avoids costly effects');
assert.match(skill, /\]\(\.\/references\/template\.md\)/, 'skill loads the template reference');
assert.doesNotMatch(template, /data-sketch-mode|lulu-sketch-mode|Present|## Click/, 'template does not describe the modes');
assert.match(template, /\n## Theme\n\nThe sketch follows the Board theme\.\n\n1\. [\s\S]*\n## Board\n\n[^\n]+\n\n```html\n[\s\S]*\n```\n$/, 'template holds the Theme rules, then ends with the Board block alone');
assert.doesNotMatch(template, /\]\([^)]*template\.md\)/, 'template does not load itself');
assert.match(template, /The fragment is the diagram\.\nThe diagram is one 16:9 slide\. Keep it landscape\./, 'template keeps the diagram as one 16:9 slide');
assert.match(template, /## Fragment[\s\S]*\n3\. Excludes `<iframe>`, `<object>`, `<embed>`, `<link>`, and `<a>`\. Board removes them before mounting\. Put CSS in `<style>`\.\n[\s\S]*## Theme/, 'template fragment lists the tags Board removes, links included');

// Mode
assert.match(skill, /## Mode\n\nPick short link or cloud\. Short link is the default\./, 'short link is the default');
assert.match(skill, /Use \*\*cloud mode\*\* only when one of these holds/, 'cloud needs a reason');
assert.match(skill, /the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams/, 'cloud on explicit intent');
assert.match(skill, /the user pastes a `#b:` link/, 'a pasted #b: link means cloud');
assert.match(skill, /this session already created the diagram in cloud mode/, 'cloud sticks within a session');
assert.match(skill, /Run `\$BOARD_CLI whoami`\. When `logged_in` is false, run `\$BOARD_CLI login`/, 'cloud mode checks the login and logs in');
assert.match(skill, /If `login` fails or times out, use \*\*short-link mode\*\* and tell the user why/, 'a failed login falls back to short link');
assert.match(skill, /Load \[cloud flow\]\(\.\/references\/cloud-flow\.md\)/, 'cloud mode loads the sketch cloud flow');
assert.match(skill, /load \[pointers\]\(\.\.\/references\/pointers\.md\)/, 'a pasted viewer URL loads pointers.md');
assert.ok(fs.existsSync(path.join(root, 'skills/references/pointers.md')), 'pointers.md ships in the install root');
assert.match(sharedCloud, /Shared cloud flow for Boxes and Mermaid\./, 'the shared cloud file serves Boxes and Mermaid');
assert.doesNotMatch(sharedCloud, /Sketch/, 'the shared cloud file no longer names Sketch');

// Short link flow
assert.match(skill, /## Short link flow/, 'skill has the short link flow');
assert.match(skill, /`\.cache\/sketch\/<name>\.html`/, 'the fragment goes to a named html file');
assert.match(skill, /\$BOARD_CLI encode-source --file <file> --out \.cache\/sketch --title <title>/, 'encode the html file into .cache/sketch');
assert.match(skill, /\$BOARD_CLI preview-diagram --file <skt>/, 'publish the skt file');
assert.match(skill, /Always write a short title that names the diagram/, 'skill asks for a title');
assert.match(skill, /Show only the `url` field and stop/, 'show uses the url field');
assert.match(skill, /creates a new short url/, 'change mints a new short url');
assert.match(skill, /To keep, use cloud mode \(`#b:`\)/, 'keep uses cloud mode');

// Cloud flow
assert.match(cloudFlow, /SKT Source in a `\.skt` file/, 'cloud flow names the file it works with');
for (const command of ['create-diagram', 'get-diagram', 'save-diagram', 'get-group', 'search-diagrams', 'encode-source', 'decode-source']) {
  assert.match(cloudFlow, new RegExp('\\$BOARD_CLI ' + command + ' '), 'cloud flow runs ' + command);
}
assert.match(cloudFlow, /--expected-version <version>/, 'save gives back the version that was read');
assert.match(cloudFlow, /--style <style>/, 'save: the style from decode-source goes back');
assert.match(cloudFlow, /When `decode-source` returned an empty `title`, write a short title/, 'an empty decoded title is named before encode');
assert.match(cloudFlow, /A command that exits 4 needs a login: run `\$BOARD_CLI login`, then repeat that command once/, 'exit 4 means login and one retry');
assert.match(cloudFlow, /When `login` fails or times out, use short-link mode/, 'a failed login falls back to short link');
assert.match(cloudFlow, /Exit 3 means the cloud holds a newer `latest_version`/, 'exit 3 is the version conflict');
assert.match(cloudFlow, /does not end in `\.skt`, the diagram is not a Sketch/, 'a diagram of another type is left to its own skill');
assert.match(cloudFlow, /\(\.\.\/\.\.\/references\/pointers\.md\)/, 'cloud flow reaches the shared pointers file');
assert.ok(fs.existsSync(path.resolve(root, 'skills/sketch/references', '../../references/pointers.md')), 'that pointers path resolves');
assert.doesNotMatch(skill + cloudFlow, /base64/i, 'skill does not say how content is encoded');
assert.doesNotMatch(skill + cloudFlow, /--kind|--html/, 'skill uses only the current flags');
assert.doesNotMatch(skill + cloudFlow, /edit token|edit_token/, 'no edit token');
assert.doesNotMatch(skill + cloudFlow, /sketch ""/, 'no example with an empty title');

// The CLI writes what the viewer reads
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-entry-'));
const html = '<style>.d{color:red}</style><div class="d">你好 "world"</div>\n';
const htmlFile = path.join(dir, 'demo.html');
fs.writeFileSync(htmlFile, html);
const runCli = (args) => JSON.parse(execFileSync('python3', ['-m', 'board_cli', ...args], {
  cwd: cliDir,
  encoding: 'utf8',
  env: Object.assign({}, process.env, { PYTHONDONTWRITEBYTECODE: '1' }),
}));

const style = 'eyJ2aWV3cG9ydCI6eyJzY2FsZSI6MX19';
const encoded = runCli(['encode-source', '--file', htmlFile, '--out', dir, '--title', 'A "quoted" 标题', '--style', style]);
assert.strictEqual(path.dirname(encoded.file), fs.realpathSync(dir), 'encode-source writes into --out');
assert.match(path.basename(encoded.file), /^\d{8}-\d{6}-\d{3}\.skt$/, 'encode-source names the file by time');
assert.deepStrictEqual([encoded.title, encoded.style], ["A 'quoted' 标题", style], 'encode-source returns the cleaned title and the style');

const text = fs.readFileSync(encoded.file, 'utf8');
const StyleLine = (await import(pathToFileURL(path.join(root, 'packages/board-app/workspace/src/core/style-line.js')).href)).default;
const { diagramTitleFromBody } = await import(pathToFileURL(path.join(root, 'packages/board-core/document-format.js')).href);
assert.strictEqual(StyleLine.bodyKind(text), 'sketch', 'the viewer reads the file as a sketch');
assert.strictEqual(diagramTitleFromBody(text), "A 'quoted' 标题", 'the viewer reads the cleaned title');
assert.strictEqual(StyleLine.decodeSketchContent(text), html, 'the viewer decodes the fragment');
assert.strictEqual(StyleLine.splitRendererStyle(text).token, style, 'the viewer reads the style token');

const decoded = runCli(['decode-source', '--file', encoded.file, '--out', dir]);
assert.deepStrictEqual([decoded.title, decoded.style], ["A 'quoted' 标题", style], 'decode-source returns title and style');
assert.match(path.basename(decoded.file), /^\d{8}-\d{6}-\d{3}\.html$/, 'decode-source names the file by time');
assert.strictEqual(fs.readFileSync(decoded.file, 'utf8'), html, 'decode-source restores the html unchanged');
fs.rmSync(dir, { recursive: true, force: true });

console.log('ok sketch-entry skill');
