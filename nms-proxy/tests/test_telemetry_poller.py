"""
Unit tests for Background Telemetry Poller Worker.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from app.services.telemetry_poller import TelemetryPollerWorker


def test_telemetry_poller_cycle():
    async def _test():
        worker = TelemetryPollerWorker(interval_seconds=1.0)
        mock_client = MagicMock()
        mock_client.get = AsyncMock(side_effect=[
            {"connected": 742, "available": 386, "disabled": 24},  # /ports/summary
            [],  # /connectivity/connections
        ])

        summary = await worker.poll_once(mock_client)
        assert "ports_summary" in summary
        assert worker.poll_count == 1
        assert worker.last_poll_time is not None
        assert worker.last_error is None

        status = worker.get_status()
        assert status["poll_count"] == 1
        assert status["has_data"] is True

    asyncio.run(_test())


def test_telemetry_poller_error_handling():
    async def _test():
        worker = TelemetryPollerWorker(interval_seconds=1.0)
        mock_client = MagicMock()
        mock_client.get = AsyncMock(side_effect=Exception("NMS Network Timeout"))

        summary = await worker.poll_once(mock_client)
        assert "error" in summary
        assert "NMS Network Timeout" in worker.last_error
        status = worker.get_status()
        assert status["last_error"] is not None

    asyncio.run(_test())

