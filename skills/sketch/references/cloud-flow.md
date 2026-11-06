# Cloud flow

Create, change, and search cloud Sketch diagrams with `$BOARD_CLI`. The Sketch
skill's Mode section loads this file. Done when the saved diagram's `url` or
the search hits are shown.

A cloud Sketch is SKT Source in a `.skt` file. `encode-source` and
`decode-source` convert it to and from the HTML fragment. Every `--out` is
`.cache/sketch`.

## Login

1. A command that exits 4 needs a login. Its stdout JSON holds `resource_metadata`.
2. Run `$BOARD_CLI login --resource-metadata-url <resource_metadata>`: the user approves in the browser. Then repeat that command once.
3. When `login` fails or times out, use short-link mode and tell the user why.

## New

1. Write the HTML file as in the short link flow. Run `$BOARD_CLI encode-source --file <html> --out .cache/sketch --title <title>`.
2. Run `$BOARD_CLI create-diagram --file <skt>`, where `<skt>` is the `file` that `encode-source` returned. Show `url`. Keep `diagram_id` and `version`.
3. To join the group of a pasted `#b:` link, run `$BOARD_CLI get-group --diagram-id <id>` and pass its `group_id` to `create-diagram` as `--group-id`.

## Change

1. The diagram is the `diagram_id` of this session's last diagram, or the one taken from a pasted `#b:` link ([pointers](../../references/pointers.md)).
2. Run `$BOARD_CLI get-diagram --diagram-id <id> --out .cache/sketch`. Keep `version`. When `file` does not end in `.skt`, the diagram is not a Sketch: leave this skill.
3. Run `$BOARD_CLI decode-source --file <skt> --out .cache/sketch`, where `<skt>` is the `file` that `get-diagram` returned. Edit the HTML file it returns.
4. When `decode-source` returned an empty `title`, write a short title that names the diagram. Run `$BOARD_CLI encode-source --file <html> --out .cache/sketch --title <title> --style <style>` with the `style` that `decode-source` returned; omit `--style` when it is empty.
5. Run `$BOARD_CLI save-diagram --diagram-id <id> --file <skt> --expected-version <version>`. Show `url`. Keep the returned `version`.

## Conflict

1. Exit 3 means the cloud holds a newer `latest_version`. Run Change again from `get-diagram`, redo the edit on that content, and save once.
2. A second exit 3: stop and tell the user.

## Search

1. Run `$BOARD_CLI search-diagrams --query <text>` with a non-empty `<text>`. Show each `title` and `url`.
2. To open one, follow Change.
