# Cloud

Shared cloud flow for Boxes and Mermaid. Create, change, and search cloud
diagrams with `$BOARD_CLI`. The Mode section of the boxes and mermaid skills
loads this file. Done when the saved diagram's `url` or the search hits are
shown.

A cloud diagram is its Source in a text file: `.bmd` for Boxes, `.mmd` for
Mermaid. `<dir>` is `.cache/boxes` in the boxes skill and `.cache/mermaid` in
the mermaid skill. Every `--out` is `<dir>`.

## Login

1. A command that exits 4 needs a login. Its stdout JSON holds `resource_metadata`.
2. Run `$BOARD_CLI login --resource-metadata-url <resource_metadata>`: the user approves in the browser. Then repeat that command once.
3. When `login` fails or times out, use short-link mode and tell the user why.

## New

1. Write the Source file as in the short link flow.
2. Run `$BOARD_CLI create-diagram --file <file>`. Show `url`. Keep `diagram_id` and `version`.
3. To join the group of a pasted `#b:` link, run `$BOARD_CLI get-group --diagram-id <id>` and pass its `group_id` to `create-diagram` as `--group-id`.

## Change

1. The diagram is the `diagram_id` of this session's last diagram, or the one taken from a pasted `#b:` link ([pointers](./pointers.md)).
2. Run `$BOARD_CLI get-diagram --diagram-id <id> --out <dir>`. Keep `version`. When `file` does not end in this skill's extension, the diagram belongs to another skill: leave this one.
3. Edit the file it returned. Leave the style lines unchanged.
4. Run `$BOARD_CLI save-diagram --diagram-id <id> --file <file> --expected-version <version>`. Show `url`. Keep the returned `version`.

## Conflict

1. Exit 3 means the cloud holds a newer `latest_version`. Run Change again from `get-diagram`, redo the edit on that content, and save once.
2. A second exit 3: stop and tell the user.

## Search

1. Run `$BOARD_CLI search-diagrams --query <text>` with a non-empty `<text>`. Show each `title` and `url`.
2. To open one, follow Change.
