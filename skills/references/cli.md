# CLI

Install and run `board-cli`, the Lulu Board command-line program.
Done when `$BOARD_CLI --version` reports the minimum version or newer.

## Script Macros

| Macro | CLI |
|---|---|
| `$BOARD_CLI` | `~/.local/bin/board-cli` |
| `$INSTALL_BOARD_CLI` | `mkdir -p ~/.local/bin && curl -fsSL https://github.com/lulufoo/lulu-board/releases/download/board-cli-v0.3.0/board-cli.pyz -o ~/.local/bin/board-cli && chmod +x ~/.local/bin/board-cli` |

## Version

`$BOARD_CLI` is the installed `board-cli` program. Minimum version: `0.3.0`.

1. Before the first `$BOARD_CLI` call of a session, run `$BOARD_CLI --version`.
2. When the command is missing or its `version` is below the minimum, run `$INSTALL_BOARD_CLI`, then continue.

## Commands

The command list and the output contract live in the program.

1. Run `$BOARD_CLI --help`.
