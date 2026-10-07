"""
Tests for Safety Interlock on disconnect endpoints.
Ensures that accidental or unconfirmed disconnects are blocked with HTTP 428 Precondition Required.
"""
from unittest.mock import AsyncMock
import pytest
from fastapi.testclient import TestClient

from app.main import app, get_client
from app.config import get_settings

settings = get_settings()
settings.enable_control_endpoints = True

mock_client = AsyncMock()
mock_client.post.return_value = {"status": "success", "message": "Circuit disconnected"}

app.dependency_overrides[get_client] = lambda: mock_client

client = TestClient(app)
HEADERS = {"X-API-Key": settings.proxy_api_key}


def test_disconnect_blocked_without_confirm_interlock():
    """Memverifikasi bahwa disconnect ditolak dengan HTTP 428 jika confirm_interlock tidak disertakan atau False."""
    mock_client.reset_mock()
    payload = {
        "panel_name": "ODF-01",
        "port_no": 12,
        # confirm_interlock default is False
    }
    response = client.post("/control/disconnect", json=payload, headers=HEADERS)
    assert response.status_code == 428
    assert "Safety Interlock Engaged" in response.json()["detail"]
    mock_client.post.assert_not_called()


def test_disconnect_blocked_with_explicit_false_interlock():
    """Memverifikasi bahwa disconnect ditolak dengan HTTP 428 jika confirm_interlock=False."""
    mock_client.reset_mock()
    payload = {
        "panel_name": "ODF-01",
        "port_no": 12,
        "confirm_interlock": False,
    }
    response = client.post("/control/disconnect", json=payload, headers=HEADERS)
    assert response.status_code == 428
    assert "Two-step confirmation" in response.json()["detail"]
    mock_client.post.assert_not_called()


def test_disconnect_by_id_blocked_without_interlock():
    """Memverifikasi bahwa disconnect by ID ditolak dengan HTTP 428 jika confirm_interlock tidak bernilai true."""
    mock_client.reset_mock()
    response = client.post("/control/disconnect/101", headers=HEADERS)
    assert response.status_code == 428
    assert "Safety Interlock Engaged" in response.json()["detail"]
    mock_client.post.assert_not_called()


def test_disconnect_passes_interlock_when_confirmed():
    """Memverifikasi bahwa ketika confirm_interlock=True, request lolos validasi interlock (tidak lagi 428)."""
    mock_client.reset_mock()
    payload = {
        "panel_name": "ODF-01",
        "port_no": 12,
        "confirm_interlock": True,
    }

    response = client.post("/control/disconnect", json=payload, headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    # Memastikan payload yang dikirim ke Xenoptics hardware tidak mengandung confirm_interlock
    mock_client.post.assert_called_once_with(
        "/connectivity/disconnect",
        {"panel_name": "ODF-01", "port_no": 12},
    )


def test_disconnect_by_id_passes_interlock_when_confirmed():
    """Memverifikasi bahwa disconnect by ID lolos interlock ketika ?confirm_interlock=true."""
    mock_client.reset_mock()
    response = client.post("/control/disconnect/101?confirm_interlock=true", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] == "success"
    mock_client.post.assert_called_once_with("/connectivity/connections/101/disconnect")
