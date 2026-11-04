import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const STUB = 'https://luluboard.app/#p:p_' + 'd'.repeat(64);

const root = path.join(__dirname, '../..');
const pack = fs.readFileSync(path.join(root, 'skills/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills/sketch/SKILL.md'), 'utf8');
const template = fs.readFileSync(path.join(root, 'skills/sketch/references/template.md'), 'utf8');
const script = path.join(root, 'skills/sketch/scripts/sketch_control.py');

// The entry
assert.match(pack, /`sketch\/`/, 'pack lists sketch/');
assert.match(pack, /One Sketch diagram/, 'pack names sketch a diagram');
assert.doesNotMatch(pack, /picture/, 'pack no longer says picture');
assert.doesNotMatch(skill, /picture/, 'skill names the drawing a diagram');
assert.match(skill, /Done when a tool `url` is shown/, 'done is a tool url');
assert.match(skill, /\| `\$SKETCH_CTL` \| `python3 scripts\/sketch_control\.py` \|/, 'one macro row');
assert.match(skill, /CLI contract: `\$SKETCH_CTL --help`/, 'the CLI contract lives in --help');
assert.doesNotMatch(skill, /docs\//, 'an installed skill cites no repo docs');

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
assert.match(skill, /Use \*\*cloud mode\*\* only when the `whoami` MCP tool is listed and one of these holds/, 'cloud needs whoami and a reason');
assert.match(skill, /the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams/, 'cloud on explicit intent');
assert.match(skill, /the user pastes a `#b:` link/, 'a pasted #b: link means cloud');
assert.match(skill, /this session already created the diagram in cloud mode/, 'cloud sticks within a session');
assert.match(skill, /listed but a tool call fails, use \*\*short-link mode\*\*/, 'failed MCP falls back to short link');
assert.match(skill, /Load \[cloud\]\(\.\.\/references\/cloud\.md\)/, 'cloud mode loads cloud.md');
assert.match(skill, /load \[pointers\]\(\.\.\/references\/pointers\.md\)/, 'a pasted viewer URL loads pointers.md');
assert.ok(fs.existsSync(path.join(root, 'skills/references/cloud.md')), 'cloud.md ships in the install root');
assert.ok(fs.existsSync(path.join(root, 'skills/references/pointers.md')), 'pointers.md ships in the install root');

// Short link flow
assert.match(skill, /## Short link flow/, 'skill has the short link flow');
assert.match(skill, /`\.cache\/sketch\/<name>\.html`/, 'the fragment goes to a named html file');
assert.match(skill, /\$SKETCH_CTL preview --html <file> --title <title>/, 'preview takes the html file and a title');
assert.match(skill, /Always write a short title that names the diagram/, 'skill asks for a title');
assert.match(skill, /Show only the `url` field and stop/, 'show uses the url field');
assert.match(skill, /creates a new short url/, 'change mints a new short url');
assert.match(skill, /To keep, use cloud mode \(`#b:`\)/, 'keep uses cloud mode');

// Cloud flow
assert.match(skill, /## Cloud flow/, 'skill has the cloud flow');
assert.match(skill, /`sketch "<title>"`, `style`, and `content`/, 'skill names the three lines');
assert.match(skill, /`content` is the encoded HTML\. Only `\$SKETCH_CTL encode` writes it and `\$SKETCH_CTL decode` reads it/, 'content goes through encode and decode only');
for (const tool of ['create_diagram', 'get_diagram', 'save_diagram']) {
  assert.match(skill, new RegExp('`' + tool + '`'), 'cloud flow uses ' + tool);
}
assert.match(skill, /\$SKETCH_CTL encode --html <file> --title <title>/, 'new: encode the html file');
assert.match(skill, /\$SKETCH_CTL decode --skt <file>/, 'read: decode the skt file');
assert.match(skill, /--style "<style>"/, 'save: the style from decode goes back');
assert.match(skill, /When `decode` returns an empty `title`, write a short title/, 'an empty decoded title is named before encode');
assert.doesNotMatch(skill, /base64/i, 'skill does not say how content is encoded');
assert.doesNotMatch(skill, /--kind|--file/, 'skill uses only the current flags');
assert.doesNotMatch(skill, /edit token|edit_token/, 'no edit token');
assert.doesNotMatch(skill, /sketch ""/, 'no example with an empty title');

// The CLI
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sketch-entry-'));
const realDir = fs.realpathSync(dir);
const html = '<style>.d{color:red}</style><div class="d">你好 "world"</div>\n';
const htmlFile = path.join(dir, 'demo.html');
fs.writeFileSync(htmlFile, html);
const runCli = (args, env) => execFileSync('python3', [script, ...args], {
  encoding: 'utf8',
  env: Object.assign({}, process.env, env || {}),
});

const help = runCli(['--help']);
for (const word of ['preview', 'encode', 'decode', '{"url"', '{"skt"', '{"title"']) {
  assert.ok(help.includes(word), '--help states ' + word);
}

const previewed = JSON.parse(runCli(['preview', '--html', htmlFile, '--title', 'A quiet board'], { LULU_BOARD_SHORT_LINK_STUB: STUB }));
assert.deepStrictEqual(previewed, { url: STUB }, 'preview prints the returned short url as json');

const style = 'eyJ2aWV3cG9ydCI6eyJzY2FsZSI6MX19';
const encoded = JSON.parse(runCli(['encode', '--html', htmlFile, '--title', 'A "quoted" 标题', '--style', style]));
assert.strictEqual(encoded.skt, realDir + '/demo.skt', 'encode writes the skt file beside the html');

// The viewer's own parsers read what the CLI wrote.
const text = fs.readFileSync(encoded.skt, 'utf8');
const StyleLine = (await import(pathToFileURL(path.join(root, 'packages/drawer-app/src/core/style-line.js')).href)).default;
const { diagramTitleFromBody } = await import(pathToFileURL(path.join(root, 'packages/board-core/document-format.js')).href);
assert.strictEqual(StyleLine.bodyKind(text), 'sketch', 'the viewer reads the file as a sketch');
assert.strictEqual(diagramTitleFromBody(text), "A 'quoted' 标题", 'the viewer reads the cleaned title');
assert.strictEqual(StyleLine.decodeSketchContent(text), html, 'the viewer decodes the fragment');
assert.strictEqual(StyleLine.splitRendererStyle(text).token, style, 'the viewer reads the style token');

// decode brings the html back unchanged.
fs.unlinkSync(htmlFile);
const decoded = JSON.parse(runCli(['decode', '--skt', encoded.skt]));
assert.deepStrictEqual(
  decoded,
  { title: "A 'quoted' 标题", style: style, html: realDir + '/demo.html' },
  'decode returns title, style, and the html path',
);
assert.strictEqual(fs.readFileSync(decoded.html, 'utf8'), html, 'decode restores the html unchanged');
fs.rmSync(dir, { recursive: true, force: true });

console.log('ok sketch-entry skill');
