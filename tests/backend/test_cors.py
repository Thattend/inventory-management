"""
Tests for the CORS policy and the server bind address.

The API has no authentication, so only the local frontend may call it from a
browser. A wildcard origin with credentials would let any website the
developer visits read and change data through the browser.
"""
import pytest

import main

ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
FOREIGN_ORIGINS = ["http://evil.example", "http://localhost:3001", "null"]


class TestCorsPolicy:
    """Test suite for CORS behaviour on simple and preflight requests."""

    @pytest.mark.parametrize("origin", ALLOWED_ORIGINS)
    def test_allowed_origin_is_echoed(self, client, origin):
        response = client.get("/api/tasks", headers={"Origin": origin})
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == origin

    @pytest.mark.parametrize("origin", FOREIGN_ORIGINS)
    def test_foreign_origin_gets_no_cors_headers(self, client, origin):
        response = client.get("/api/tasks", headers={"Origin": origin})
        assert "access-control-allow-origin" not in response.headers

    @pytest.mark.parametrize("origin", ALLOWED_ORIGINS)
    def test_credentials_are_not_allowed(self, client, origin):
        # The client sends no cookies or auth headers, so there is nothing to
        # share; enabling credentials would only widen the attack surface.
        response = client.get("/api/tasks", headers={"Origin": origin})
        assert "access-control-allow-credentials" not in response.headers

    @pytest.mark.parametrize("method", ["POST", "PATCH", "DELETE"])
    def test_preflight_allowed_for_frontend_methods(self, client, method):
        response = client.options(
            "/api/tasks",
            headers={
                "Origin": ALLOWED_ORIGINS[0],
                "Access-Control-Request-Method": method,
                "Access-Control-Request-Headers": "content-type",
            },
        )
        assert response.status_code == 200
        assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGINS[0]
        assert method in response.headers["access-control-allow-methods"]

    def test_preflight_rejected_for_foreign_origin(self, client):
        response = client.options(
            "/api/tasks",
            headers={
                "Origin": "http://evil.example",
                "Access-Control-Request-Method": "POST",
            },
        )
        assert response.status_code == 400
        assert "access-control-allow-origin" not in response.headers

    def test_preflight_rejects_unused_methods(self, client):
        response = client.options(
            "/api/tasks",
            headers={
                "Origin": ALLOWED_ORIGINS[0],
                "Access-Control-Request-Method": "PUT",
            },
        )
        assert response.status_code == 400

    def test_same_origin_requests_without_origin_header_still_work(self, client):
        # curl, tests and server-side callers send no Origin header
        assert client.get("/api/tasks").status_code == 200


class TestServerBinding:
    def test_server_binds_to_loopback_only(self):
        # 0.0.0.0 would expose the unauthenticated API to the whole LAN
        assert main.SERVER_HOST == "127.0.0.1"
