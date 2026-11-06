"""login only believes a metadata address after it checks out: https, the right resource, a genuine issuer."""
from __future__ import annotations

import inspect
import pathlib
import unittest
from unittest.mock import patch

import board_cli_support  # noqa: F401  (puts the package on sys.path)
from board_cli.auth import credentials, resource_discovery
from board_cli.auth.resource_discovery import build_server_metadata_url, check_server_metadata
from login_support import LoginCase

ISSUER = "https://auth.example/auth/v1"
GOOD = {
    "issuer": ISSUER,
    "authorization_endpoint": "https://auth.example/auth/v1/authorize",
    "token_endpoint": "https://auth.example/auth/v1/token",
    "registration_endpoint": "https://auth.example/auth/v1/register",
    "code_challenge_methods_supported": ["S256"],
}


class MetadataUrlTest(unittest.TestCase):
    def test_the_well_known_path_goes_between_the_host_and_the_issuer_path(self) -> None:
        self.assertEqual(build_server_metadata_url(ISSUER), "https://auth.example/.well-known/oauth-authorization-server/auth/v1")

    def test_an_issuer_without_a_path_gets_the_bare_well_known_path(self) -> None:
        self.assertEqual(build_server_metadata_url("https://auth.example"), "https://auth.example/.well-known/oauth-authorization-server")
        self.assertEqual(build_server_metadata_url("https://auth.example/"), "https://auth.example/.well-known/oauth-authorization-server")

    def test_a_trailing_slash_on_the_path_is_dropped(self) -> None:
        self.assertEqual(build_server_metadata_url(ISSUER + "/"), "https://auth.example/.well-known/oauth-authorization-server/auth/v1")

    def test_an_issuer_with_a_query_or_fragment_is_refused(self) -> None:
        for issuer in (ISSUER + "?a=1", ISSUER + "#x"):
            with self.assertRaisesRegex(RuntimeError, "query or fragment"):
                build_server_metadata_url(issuer)

    def test_an_http_issuer_is_refused(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "must be https"):
            build_server_metadata_url("http://auth.example/auth/v1")


class ServerMetadataTest(unittest.TestCase):
    def test_a_complete_document_passes(self) -> None:
        check_server_metadata(dict(GOOD), ISSUER)

    def test_another_issuer_is_refused(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "another issuer"):
            check_server_metadata({**GOOD, "issuer": "https://evil.example/auth/v1"}, ISSUER)

    def test_a_missing_endpoint_is_refused(self) -> None:
        for name in resource_discovery.ENDPOINTS:
            without = {key: value for key, value in GOOD.items() if key != name}
            with self.assertRaisesRegex(RuntimeError, f"lacks {name}"):
                check_server_metadata(without, ISSUER)

    def test_an_endpoint_that_is_not_https_is_refused(self) -> None:
        for name in resource_discovery.ENDPOINTS:
            with self.assertRaisesRegex(RuntimeError, f"{name} must be https"):
                check_server_metadata({**GOOD, name: "http://auth.example/x"}, ISSUER)

    def test_a_server_without_pkce_s256_is_refused(self) -> None:
        for methods in (["plain"], [], None, "S256"):
            with self.assertRaisesRegex(RuntimeError, "PKCE S256"):
                check_server_metadata({**GOOD, "code_challenge_methods_supported": methods}, ISSUER)


class RefusalBeforeAnythingIsDone(LoginCase):
    """Each refusal ends login with one stderr line, before a client is registered or a browser opened."""

    def refuse(self, *words: str, address: str | None = None) -> None:
        code, out, err = self.login(address=address)
        self.assertEqual((code, out), (1, ""), err)
        self.assertEqual(len(err.strip().splitlines()), 1, err)
        for word in words:
            self.assertIn(word, err)
        self.assertEqual(self.auth.registrations, [])
        self.assertEqual(self.browser.opened, [])
        self.assertIsNone(credentials.read_credentials())

    def test_an_http_address_is_refused_before_any_request(self) -> None:
        with patch.object(resource_discovery, "SCHEMES", ("https",)):
            self.refuse("the address of the resource metadata must be https")
        self.assert_nothing_contacted()

    def test_a_string_that_is_not_an_address_is_refused_before_any_request(self) -> None:
        self.refuse("must be https", address="not-an-address")
        self.assert_nothing_contacted()

    def test_metadata_for_another_resource_is_refused_and_the_authorization_server_is_never_asked(self) -> None:
        self.mcp.metadata_overrides = {"resource": "https://evil.example/mcp"}
        self.refuse("another resource", "https://evil.example/mcp", "refusing to log in")
        self.assertEqual(self.auth.requests, [])

    def test_a_resource_that_differs_only_by_a_trailing_slash_is_refused(self) -> None:
        self.mcp.metadata_overrides = {"resource": self.mcp.url + "/"}
        self.refuse("another resource")
        self.assertEqual(self.auth.requests, [])

    def test_metadata_without_a_resource_is_refused(self) -> None:
        self.mcp.metadata_overrides = {"resource": None}
        self.refuse("another resource")

    def test_metadata_without_an_authorization_server_is_refused(self) -> None:
        for servers in ([], None, "https://x", [7]):
            self.mcp.metadata_overrides = {"authorization_servers": servers}
            self.refuse("names no authorization server")

    def test_an_authorization_server_address_with_another_scheme_is_refused(self) -> None:
        # The tests admit http for their loopback fakes, so an http issuer is covered in MetadataUrlTest.
        self.mcp.metadata_overrides = {"authorization_servers": ["ftp://auth.example/auth/v1"]}
        self.refuse("the address of the authorization server must be https")

    def test_an_authorization_server_whose_metadata_is_missing_is_refused(self) -> None:
        self.mcp.metadata_overrides = {"authorization_servers": [self.auth.base + "/auth/v2"]}
        self.refuse("the authorization server metadata unavailable: HTTP 404")

    def test_an_authorization_server_that_names_another_issuer_is_refused(self) -> None:
        self.auth.metadata_overrides = {"issuer": "https://evil.example/auth/v1"}
        self.refuse("another issuer")

    def test_an_authorization_server_without_a_registration_endpoint_is_refused(self) -> None:
        self.auth.metadata_overrides = {"registration_endpoint": None}
        self.refuse("lacks registration_endpoint")

    def test_an_authorization_server_that_does_not_offer_pkce_s256_is_refused(self) -> None:
        self.auth.metadata_overrides = {"code_challenge_methods_supported": ["plain"]}
        self.refuse("PKCE S256")


class BuiltInTest(unittest.TestCase):
    def test_the_old_built_in_authorization_address_and_the_precheck_are_gone(self) -> None:
        package = pathlib.Path(inspect.getfile(resource_discovery)).parents[1]
        text = "\n".join(path.read_text(encoding="utf-8") for path in package.rglob("*.py"))
        for gone in ("AUTH_HOST", "METADATA_URL", "check_authorize", "ClientRejected", "read_stored_client"):
            self.assertNotIn(gone, text)


if __name__ == "__main__":
    unittest.main()
