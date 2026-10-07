"""
Background Telemetry Poller Worker.
Menjalankan polling berkala terhadap status matriks port dan koneksi Xenoptics NMS,
mendeteksi event Optical LOS / degradasi, serta mencatat ke tabel outage_incidents.
"""
import asyncio
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any

try:
    from app.nms_client import NMSClient
    from app.db.session import SessionLocal
    from app.db.models import OutageIncident, Circuit
except (ImportError, ValueError):
    from nms_client import NMSClient
    from db.session import SessionLocal
    from db.models import OutageIncident, Circuit

logger = logging.getLogger(__name__)


class TelemetryPollerWorker:
    def __init__(self, interval_seconds: float = 15.0):
        self.interval_seconds = interval_seconds
        self.is_running: bool = False
        self._task: Optional[asyncio.Task] = None
        self.poll_count: int = 0
        self.last_poll_time: Optional[datetime] = None
        self.last_error: Optional[str] = None
        self.last_summary: Optional[Dict[str, Any]] = None

    async def poll_once(self, client: NMSClient) -> Dict[str, Any]:
        """Melakukan satu siklus polling terhadap endpoint telemetri NMS."""
        try:
            ports_summary = await client.get("/ports/summary", use_cache=False)
            connections = await client.get("/connectivity/connections", use_cache=False)

            self.poll_count += 1
            self.last_poll_time = datetime.now(timezone.utc)
            self.last_error = None
            self.last_summary = {
                "ports_summary": ports_summary,
                "connections_count": len(connections) if isinstance(connections, list) else 0,
            }

            # Evaluasi integritas sirkuit di database
            self._evaluate_telemetry_health(connections)

            return self.last_summary
        except Exception as e:
            self.last_error = str(e)
            logger.warning(f"Telemetry Poller cycle error: {e}")
            return {"error": str(e)}

    def _evaluate_telemetry_health(self, live_conns: Any):
        """Memeriksa apakah terdapat koneksi terputus dan mencatat ke database."""
        if not isinstance(live_conns, list):
            return

        db = SessionLocal()
        try:
            # Cari sirkuit yang tercatat di database
            circuits = db.query(Circuit).all()
            for ckt in circuits:
                # Periksa apakah ada insiden aktif yang belum terselesaikan
                active_incident = (
                    db.query(OutageIncident)
                    .filter(
                        OutageIncident.circuit_id == ckt.id,
                        OutageIncident.resolved_at.is_(None),
                    )
                    .first()
                )

                # Jika sirkuit berstatus degraded/disconnected secara lokal, pastikan tercatat
                if ckt.operational_status in ["Degraded", "Disconnected"] and not active_incident:
                    new_incident = OutageIncident(
                        id=f"INC-{datetime.now(timezone.utc).strftime('%H%M%S')}-{ckt.id[-4:]}",
                        circuit_id=ckt.id,
                        severity="Critical" if ckt.operational_status == "Disconnected" else "Warning",
                        started_at=datetime.now(timezone.utc),
                        resolved_at=None,
                        duration_seconds=0,
                        root_cause=f"Telemetry Poller: Optical LOS on {ckt.source_panel}:P{ckt.source_port}",
                    )
                    db.add(new_incident)
                    db.commit()
                    logger.info(f"Otomasi Poller: Mencatat insiden baru {new_incident.id} untuk sirkuit {ckt.id}")

                elif ckt.operational_status == "Connected" and active_incident:
                    # Sirkuit telah pulih, tandai insiden sebagai resolved
                    now = datetime.now(timezone.utc)
                    active_incident.resolved_at = now
                    delta = (now - active_incident.started_at.replace(tzinfo=timezone.utc)).total_seconds()
                    active_incident.duration_seconds = max(60, int(delta))
                    db.commit()
                    logger.info(f"Otomasi Poller: Sirkuit {ckt.id} pulih, insiden {active_incident.id} diselesaikan.")
        except Exception as err:
            db.rollback()
            logger.error(f"Gagal mengevaluasi telemetri sirkuit: {err}")
        finally:
            db.close()

    async def _run_loop(self, client: NMSClient):
        logger.info(f"Telemetry Poller loop dimulai (Interval: {self.interval_seconds} detik)")
        self.is_running = True
        try:
            while self.is_running:
                await self.poll_once(client)
                await asyncio.sleep(self.interval_seconds)
        except asyncio.CancelledError:
            logger.info("Telemetry Poller loop dihentikan secara bersih.")
        finally:
            self.is_running = False

    def start(self, client: NMSClient):
        """Memulai background poller task."""
        if self._task and not self._task.done():
            logger.warning("Telemetry poller sudah berjalan.")
            return
        self._task = asyncio.create_task(self._run_loop(client))

    def stop(self):
        """Menghentikan background poller task secara graceful."""
        self.is_running = False
        if self._task and not self._task.done():
            self._task.cancel()

    def get_status(self) -> Dict[str, Any]:
        """Mengambil data detak jantung status poller."""
        return {
            "is_running": self.is_running,
            "interval_seconds": self.interval_seconds,
            "poll_count": self.poll_count,
            "last_poll_time": self.last_poll_time.isoformat() if self.last_poll_time else None,
            "last_error": self.last_error,
            "has_data": self.last_summary is not None,
        }


# Singleton worker instance
telemetry_worker = TelemetryPollerWorker(interval_seconds=15.0)
