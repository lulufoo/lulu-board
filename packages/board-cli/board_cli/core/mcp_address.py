"""The address of the Lulu Board MCP server.

It is built in and nothing overrides it: no environment variable, no option. A login
and every cloud call can only go where this says; every other address comes from a
server's own answer and is checked against this one first.
"""
from __future__ import annotations

MCP_URL = "https://mcp.luluboard.app/mcp"
