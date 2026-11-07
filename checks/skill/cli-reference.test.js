import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const pack = read('skills/SKILL.md');
const cli = read('skills/references/cli.md');
const children = {
  boxes: read('skills/boxes/SKILL.md'),
  sketch: read('skills/sketch/SKILL.md'),
  mermaid: read('skills/mermaid/SKILL.md'),
};
const cliVersion = read('packages/board-cli/board_cli/core/version.py').match(/VERSION = "(\d+(?:\.\d+)*)"/)[1];

const asNumbers = (version) => version.split('.').map(Number);
const isAtMost = (a, b) => {
  const [left, right] = [asNumbers(a), asNumbers(b)];
  for (let i = 0; i < Math.max(left.length, right.length); i += 1) {
    const [x, y] = [left[i] || 0, right[i] || 0];
    if (x !== y) return x < y;
  }
  return true;
};

// The program macro and its install live in one shared reference
assert.match(cli, /\| `\$BOARD_CLI` \| `~\/\.local\/bin\/board-cli` \|/, 'one macro row for the installed program');
assert.match(cli, /Run `\$BOARD_CLI --help`/, 'the command list and contract live in --help');
const minimum = cli.match(/Minimum version: `(\d+(?:\.\d+)*)`/);
assert.ok(minimum, 'the reference declares a minimum version');
const install = cli.match(/\| `\$INSTALL_BOARD_CLI` \| `([^`]+)` \|/);
assert.ok(install, 'one macro row installs the program');
assert.ok(install[1].includes('/releases/download/board-cli-v' + minimum[1] + '/board-cli.pyz'), 'install downloads the release of the minimum version');
assert.match(install[1], /-o ~\/\.local\/bin\/board-cli && chmod \+x ~\/\.local\/bin\/board-cli$/, 'install puts the program where the macro points and makes it executable');
assert.ok(isAtMost(minimum[1], cliVersion), 'the minimum version is not newer than the package version');
assert.match(cli, /Before the first `\$BOARD_CLI` call of a session, run `\$BOARD_CLI --version`/, 'the version is checked before the first call');
assert.match(cli, /is missing or its `version` is below the minimum, run `\$INSTALL_BOARD_CLI`/, 'a missing or old program is installed');
assert.doesNotMatch(cli, /docs\//, 'an installed reference cites no repo docs');

// Each skill loads it and defines none of it
for (const [name, skill] of Object.entries(children)) {
  assert.match(skill, /Load \[cli\]\(\.\.\/references\/cli\.md\) before the first `\$BOARD_CLI` call of a session/, name + ' loads the shared CLI reference');
  assert.doesNotMatch(skill, /\| `\$(?:INSTALL_)?BOARD_CLI` \|/, name + ' does not define the CLI macros');
  assert.doesNotMatch(skill, /Minimum version|releases\/download\/board-cli/, name + ' does not carry the version or the install link');
}

// The root entry: a description that triggers, a reference to the CLI, no routing
const front = pack.match(/^---\n([\s\S]*?)\n---\n/)[1];
const description = front.split(/^description:/m)[1].replace(/\s+/g, ' ').trim().replace(/^>-\s*/, '');
assert.ok(description.length <= 1024, 'the description fits the Agent Skills limit');
assert.match(description, /pastes a luluboard\.app link/, 'the description triggers on a pasted Board link');
assert.match(description, /read, change, save, or find a Board diagram/, 'the description triggers on read, change, save, and search');
assert.doesNotMatch(description, /board-cli|\bCLI\b|\bMCP\b/i, 'the description names no tool');
assert.match(pack, /Load \[cli\]\(\.\/references\/cli\.md\)/, 'the root loads the shared CLI reference');
assert.ok(fs.existsSync(path.join(root, 'skills/references/cli.md')), 'cli.md ships in the install root');
assert.doesNotMatch(pack, /\| Skill \| Role \|/, 'the root has no skill table');
assert.doesNotMatch(pack, /chosen child skill/, 'the root does not route to a child skill');
assert.doesNotMatch(pack, /\$BOARD_CLI/, 'the root runs no command itself');

console.log('ok cli-reference skill');
