"""Lulu Board CLI.

Sketch source files and short links for now. Python 3.9 or newer, standard
library only.

  --version
      stdout: {"version": "X.Y.Z"}. Dotted integers, so a caller can compare it
      with a minimum version.

  whoami
      Report the login state from the local credential file. No network, no login.
      stdout: {"logged_in": false} or
              {"logged_in": true, "email": "...", "user_id": "..."}
      email and user_id come from the stored access token and are left out when
      it holds none. A stored refresh token counts as logged in even after the
      access token has expired; a file that holds only the client_id does not.
      Both results exit 0. A damaged credential file is an ordinary error.

  login
      Approve the CLI on the Lulu Board consent page in the browser, then store
      the tokens. The link is also printed on stderr, in case the browser does not
      open. It waits 300 seconds for the approval and then fails (exit 1).
      The callback port is fixed, 127.0.0.1:48621; when another program holds it,
      login fails before it registers anything. The client is registered once per
      machine and its client_id is kept in the credential file; a client the
      server no longer knows is registered again. Authorization code with PKCE.
      stdout: the same object as whoami reports once logged in.

  get-diagram --diagram-id ID --out DIR
      Login needed. Write the source of one cloud diagram, exactly as the server
      holds it, to DIR/<diagram_id>.<extension>; DIR is made when missing, and
      getting the same diagram again overwrites the earlier file. The extension
      comes from the first statement of the source, skipping blank lines, comments
      (#, //, %%), meta and style lines: "boxes " gives .bmd, "sketch" gives .skt,
      anything else gives .mmd. A diagram id is b_ and 8 lowercase hex digits.
      stdout: {"diagram_id", "title", "version", "updated_at", "group_id", "url",
               "file": "<path of the source file>"}
      There is no type field: read the type from the extension of file. The source
      is in the file and never in the output. version is the number to give back to
      save-diagram.

  get-group --diagram-id ID
      Login needed. The group the diagram belongs to, and its members in display
      order. The API wants a diagram id; a group id does not work.
      stdout: {"group_id", "members": [{"diagram_id", "title", "sort_order", "url"}]}
      A member whose sort_order is missing comes last, with sort_order 9007199254740991.

  search-diagrams --query TEXT
      Login needed. Search your own diagrams; other people's are left out. TEXT is
      trimmed and must not be empty.
      stdout: {"results": [{"diagram_id", "title", "url"}]}

  preview-diagram --file FILE
      Publish the source in FILE as an anonymous short link. No login.
      The extension names the type: .skt (Sketch), .bmd (Boxes), .mmd (Mermaid).
      Any other extension fails, including .html: run encode-source first.
      A .skt file must parse as SKT Source; .bmd and .mmd go up as written.
      stdout: {"url": "<short link>"}

  encode-source --file FILE.html --out DIR --title TEXT [--style TOKEN]
      Pack the Sketch HTML fragment in FILE into SKT Source.
      stdout: {"title": "...", "style": "...", "file": "<path of the new .skt file>"}

  decode-source --file FILE.skt --out DIR
      Unpack SKT Source into its HTML fragment.
      stdout: {"title": "...", "style": "...", "file": "<path of the new .html file>"}

encode-source and decode-source serve Sketch only. Each creates one new file in
DIR (made when missing) and leaves FILE alone. The file name is the local time
down to the millisecond, YYYYMMDD-HHMMSS-mmm, plus .skt or .html. It does not
depend on the input name, so a diagram that has no id yet can use them. A name
that already exists fails; run again.

--title is required. A double quote in it becomes a single quote and a line
break becomes a space. --style is the token decode-source returned: pass it back
unchanged on an update, or omit it (or pass "") when there is none. The title,
style, and file that decode-source returns fit encode-source's --title, --style,
and --file. A title that decodes empty needs a new one before encode-source.
decode-source fails when the content is damaged.

Credentials
  ~/.config/lulu-board/credentials.json (directory 0700, file 0600): the access
  token, the refresh token, and the OAuth client_id. Commands never print them.

Cloud commands
  get-diagram, get-group, and search-diagrams call the Lulu Board API with the
  stored login. An access token that has expired, or ends within 60 seconds, is
  refreshed before the call, and the new refresh token is stored at once. A 401
  from the server causes one refresh and one retry. Processes refresh one at a
  time (a lock on
  credentials.lock beside the credential file); a process that waited reuses the
  token the other one stored. A refresh the server refuses keeps the stored tokens.
  A login is needed when there is no credential file or token, the refresh token
  is missing or refused, or the retry gets 401 again: that is exit 4.
  A refresh that fails for another reason (no network, a 5xx) is an ordinary error.

Output
  stdout is one JSON object and never holds source text.
  exit 0  success
  exit 1  ordinary error: one line on stderr, stdout empty
  exit 2  command-line usage error: usage on stderr, stdout empty
  exit 4  login required: stdout {"login_required": true}, one line on stderr
          telling the user to run login. Only commands that call the API give it.
"""
from __future__ import annotations

import argparse
import sys

from board_cli import account_commands, login_commands, preview_commands, read_commands, source_commands
from board_cli.cli_errors import LoginRequired
from board_cli.cli_output import emit
from board_cli.version import VersionAction


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="board-cli",
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--version", action=VersionAction, help="print the version as JSON and exit")
    sub = parser.add_subparsers(dest="command", required=True)
    account_commands.register_commands(sub)
    login_commands.register_commands(sub)
    read_commands.register_commands(sub)
    preview_commands.register_commands(sub)
    source_commands.register_commands(sub)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        args.run(args)
    except LoginRequired as err:
        emit({"login_required": True})
        print(str(err), file=sys.stderr)
        return 4
    except (RuntimeError, OSError) as err:
        print(str(err), file=sys.stderr)
        return 1
    return 0


def run() -> None:
    """Entry for python3 -m board_cli and the .pyz: exit with main()'s code."""
    raise SystemExit(main())
