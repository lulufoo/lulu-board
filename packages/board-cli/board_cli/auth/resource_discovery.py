"""Find the authorization server from the metadata address the MCP server gave.

That address comes from outside (the 401 challenge, handed in by the caller), so
nothing in it is believed until it checks out:

1. The address must be https.
2. The document there must name the built-in MCP address as its resource (RFC 9728,
   section 3.3). One that names another resource is refused before anything is
   registered or opened.
3. Only then is its authorization server believed. That server's own document must
   name itself as its issuer (RFC 8414, section 3.3), give every endpoint login
   needs over https, and offer PKCE S256.
"""
from __future__ import annotations

import urllib.parse

from board_cli.core import mcp_address
from board_cli.core.http_json import send_request

# Tests add "http" for their loopback servers. Production never does.
SCHEMES = ("https",)
ENDPOINTS = ("authorization_endpoint", "token_endpoint", "registration_endpoint")
SERVER_METADATA_PATH = "/.well-known/oauth-authorization-server"
SHOWN_LIMIT = 120


def check_https_url(url: object, what: str) -> str:
    """The address, when it is an https address with a host. Anything else is a RuntimeError."""
    parts = urllib.parse.urlparse(url) if isinstance(url, str) else None
    if parts is None or parts.scheme not in SCHEMES or not parts.netloc:
        raise RuntimeError(f"the address of {what} must be https: {str(url)[:SHOWN_LIMIT]}")
    return url


def fetch_document(url: str, what: str) -> dict:
    """The JSON object at an https address. Redirects are not followed."""
    check_https_url(url, what)
    reply = send_request("GET", url, {"Accept": "application/json"})
    document = reply.read_json() if reply.status == 200 else None
    if document is None:
        raise RuntimeError(f"{what} unavailable: HTTP {reply.status}")
    return document


def build_server_metadata_url(issuer: str) -> str:
    """Where an issuer's metadata lives: the well-known path goes between the host and the issuer's path (RFC 8414, 3.1)."""
    parts = urllib.parse.urlparse(check_https_url(issuer, "the authorization server"))
    if parts.query or parts.fragment:
        raise RuntimeError(f"the authorization server must not carry a query or fragment: {issuer[:SHOWN_LIMIT]}")
    path = SERVER_METADATA_PATH + parts.path.rstrip("/")
    return urllib.parse.urlunparse((parts.scheme, parts.netloc, path, "", "", ""))


def pick_authorization_server(resource: dict) -> str:
    """The first authorization server the resource metadata lists."""
    servers = resource.get("authorization_servers")
    if not isinstance(servers, list) or not servers or not isinstance(servers[0], str):
        raise RuntimeError("the resource metadata names no authorization server")
    return servers[0]


def check_server_metadata(metadata: dict, issuer: str) -> None:
    """Refuse a document that is not the issuer's own, lacks an endpoint, or offers no PKCE S256."""
    if metadata.get("issuer") != issuer:
        raise RuntimeError(f"the authorization server's metadata names another issuer: {str(metadata.get('issuer'))[:SHOWN_LIMIT]}")
    for name in ENDPOINTS:
        if not isinstance(metadata.get(name), str):
            raise RuntimeError(f"the authorization server's metadata lacks {name}")
        check_https_url(metadata[name], f"the authorization server's {name}")
    methods = metadata.get("code_challenge_methods_supported")
    if not isinstance(methods, list) or "S256" not in methods:
        raise RuntimeError("the authorization server does not offer PKCE S256")


def discover_authorization_server(resource_metadata_url: str) -> dict:
    """The authorization server's metadata, reached through the resource metadata at this address.

    Raises RuntimeError at the first check that fails; nothing has been registered by then.
    """
    resource = fetch_document(resource_metadata_url, "the resource metadata")
    if resource.get("resource") != mcp_address.MCP_URL:
        raise RuntimeError(
            f"the metadata is for another resource ({str(resource.get('resource'))[:SHOWN_LIMIT]}), "
            f"not {mcp_address.MCP_URL}; refusing to log in")
    issuer = pick_authorization_server(resource)
    metadata = fetch_document(build_server_metadata_url(issuer), "the authorization server metadata")
    check_server_metadata(metadata, issuer)
    return metadata
