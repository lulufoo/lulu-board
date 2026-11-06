import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const pack = fs.readFileSync(path.join(root, 'skills/SKILL.md'), 'utf8');
const skill = fs.readFileSync(path.join(root, 'skills/mermaid/SKILL.md'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'skills/references/cloud.md'), 'utf8');
const pointers = fs.readFileSync(path.join(root, 'skills/references/pointers.md'), 'utf8');

assert.match(pack, /`boxes\/`/, 'pack lists boxes/');
assert.match(pack, /`mermaid\/`/, 'pack lists mermaid/');
assert.match(skill, /Author Mermaid 12\.1\.0/, 'syntax is Mermaid 12.1.0');
assert.match(skill, /Pele 1\.7\.0/, 'renderer is Pele 1.7.0');
assert.match(skill, /not\s+Mermaid\.js/, 'does not load Mermaid.js');
assert.match(skill, /\*\*Open\*\* is `flowchart`[\s\S]*Design group/, 'flowchart, mindmap, and Design are open');
assert.match(skill, /`sequence`[\s\S]*`railroad`/, 'Design kinds are named in route');
assert.match(skill, /A closed type/, 'closed types stop');

// The program macro and its install
const asNumbers = (version) => version.split('.').map(Number);
const isAtMost = (a, b) => {
  const [left, right] = [asNumbers(a), asNumbers(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const [x, y] = [left[i] || 0, right[i] || 0];
    if (x !== y) return x < y;
  }
  return true;
};
const cliVersion = fs.readFileSync(path.join(root, 'packages/board-cli/board_cli/core/version.py'), 'utf8').match(/VERSION = "(\d+(?:\.\d+)*)"/)[1];
assert.match(skill, /\| `\$BOARD_CLI` \| `~\/\.local\/bin\/board-cli` \|/, 'one macro row for the installed program');
assert.match(skill, /CLI contract: `\$BOARD_CLI --help`/, 'the CLI contract lives in --help');
const minimum = skill.match(/Minimum version: `(\d+(?:\.\d+)*)`/);
assert.ok(minimum, 'skill declares a minimum version');
const install = skill.match(/\| `\$INSTALL_BOARD_CLI` \| `([^`]+)` \|/);
assert.ok(install, 'one macro row installs the program');
assert.ok(install[1].includes('/releases/download/board-cli-v' + minimum[1] + '/board-cli.pyz'), 'install downloads the release of the minimum version');
assert.match(install[1], /-o ~\/\.local\/bin\/board-cli && chmod \+x ~\/\.local\/bin\/board-cli$/, 'install puts the program where the macro points and makes it executable');
assert.ok(isAtMost(minimum[1], cliVersion), 'the minimum version is not newer than the package version');
assert.match(skill, /Before the first `\$BOARD_CLI` call of a session, run `\$BOARD_CLI --version`/, 'the version is checked before the first call');
assert.match(skill, /is missing or its `version` is below the minimum, run `\$INSTALL_BOARD_CLI`/, 'a missing or old program is installed');

// Mode
assert.match(skill, /## Mode\n\nPick short link or cloud\. Short link is the default\./, 'short link is the default');
assert.match(skill, /Use \*\*cloud mode\*\* only when one of these holds/, 'cloud needs a reason');
assert.match(skill, /the user asks to save, keep, or update a cloud diagram, or to search cloud diagrams/, 'cloud on explicit intent');
assert.match(skill, /the user pastes a `#b:` link/, 'a pasted #b: link means cloud');
assert.match(skill, /this session already created the diagram in cloud mode/, 'cloud sticks within a session');
assert.doesNotMatch(skill, /\bwhoami\b/, 'cloud mode runs the command directly, with no whoami first');
assert.match(skill, /If `login` fails or times out, use \*\*short-link mode\*\* and tell the user why/, 'a failed login falls back to short link');
assert.match(skill, /Load \[cloud\]\(\.\.\/references\/cloud\.md\)/, 'cloud mode loads cloud.md');
assert.match(skill, /load \[pointers\]\(\.\.\/references\/pointers\.md\)/, 'a pasted viewer URL loads pointers.md');

// Short link flow
assert.match(skill, /## Short link flow/, 'short link flow remains');
assert.match(skill, /show `https:\/\/luluboard\.app\/` and stop/, 'no scene shows the blank board address');
assert.match(skill, /Run `\$BOARD_CLI preview-diagram --file <file>`/, 'publish the source file');
assert.match(skill, /`\.cache\/mermaid\/<name>\.mmd`/, 'the source goes to a named mmd file');
assert.match(skill, /Show only the `url` field and stop/, 'short-link mode prints only the returned url');
assert.match(skill, /creates a new short url/, 'change mints a new short url');
assert.match(skill, /To keep, use cloud mode/, 'keep uses #b:');

// Cloud flow
assert.match(cloud, /Shared cloud flow for Boxes and Mermaid\./, 'the shared cloud file serves Boxes and Mermaid');
for (const command of ['create-diagram', 'get-diagram', 'save-diagram', 'get-group', 'search-diagrams']) {
  assert.match(cloud, new RegExp('\\$BOARD_CLI ' + command + ' '), 'cloud flow runs ' + command);
}
assert.match(cloud, /--expected-version <version>/, 'save gives back the version that was read');
assert.match(cloud, /A command that exits 4 needs a login\. Its stdout JSON holds `resource_metadata`\./, 'exit 4 carries the address in stdout');
assert.match(cloud, /Run `\$BOARD_CLI login --resource-metadata-url <resource_metadata>`: the user approves in the browser\. Then repeat that command once\./, 'login takes that address, then one retry');
assert.doesNotMatch(skill + cloud, /\$BOARD_CLI login(?! --resource-metadata-url <resource_metadata>)/, 'no login command without the address');
assert.match(cloud, /Exit 3 means the cloud holds a newer `latest_version`/, 'exit 3 is the version conflict');
assert.match(cloud, /the diagram belongs to another skill: leave this one/, 'a diagram of another type is left to its own skill');
assert.doesNotMatch(cloud, /Sketch/, 'the shared cloud file does not name Sketch');

// Pointers
assert.match(pointers, /#b:<diagram_id>/, 'pointers document the #b: URL');
assert.match(pointers, /\| `#p:` \|/, 'pointers table has #p:');
assert.match(pointers, /It does not encode `#z:`/, 'CLI does not encode #z:');
assert.match(pointers, /It never mints `#b:`/, 'preview stays unsigned');

// No MCP, no old entry
assert.doesNotMatch(skill + cloud + pointers, /DRAWER_CTL|drawer_control|\bMCP\b|\b(?:create|get|save|search)_diagram|\bwhoami\b[^`]*listed/, 'no MCP tool names and no old entry');
assert.doesNotMatch(pointers + skill, /edit token|edit_token/, 'no edit token');

assert.doesNotMatch(skill, /MMD ID/, 'does not keep local MMD ID');
assert.doesNotMatch(skill, /history\/\*\.mmd/, 'does not use local mermaid history');

console.log('ok mermaid-entry skill');
