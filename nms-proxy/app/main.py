"""
NMS Proxy — FastAPI

Menjembatani dashboard (browser) dengan NMS API yang ada di jaringan
internal. Dashboard tidak pernah menyimpan kredensial/token NMS —
semua itu dipegang oleh proxy ini di sisi server.

Jalankan:
    uvicorn app.main:app --reload --port 8000

Endpoint:
    GET  /health
    GET  /live/system-status
    GET  /live/ports/summary
    GET  /live/ports?search=&status=&smu_type=&limit=&offset=&ordering=
    GET  /live/connections
    GET  /live/queue
    GET  /live/inventory
    POST /control/connect          (nonaktif kecuali ENABLE_CONTROL_ENDPOINTS=true)
    POST /control/disconnect
    POST /control/disconnect/{connection_id}
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json

import httpx
from fastapi import Depends, FastAPI, Header, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

try:
    from .config import Settings, get_settings
    from .nms_client import NMSAuthError, NMSClient
    from .db.seed import init_db_and_seed
    from .db.routers.business import router as business_router
    from .services.telemetry_poller import telemetry_worker
except (ImportError, ValueError):
    from config import Settings, get_settings
    from nms_client import NMSAuthError, NMSClient
    from db.seed import init_db_and_seed
    from db.routers.business import router as business_router
    from services.telemetry_poller import telemetry_worker

_client: NMSClient | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _client
    # Inisialisasi skema basis data & seed data awal
    init_db_and_seed()
    settings = get_settings()
    _client = NMSClient(settings)
    # Jalankan background telemetry poller worker
    telemetry_worker.start(_client)
    try:
        yield
    finally:
        telemetry_worker.stop()
        await _client.aclose()



app = FastAPI(title="NMS Proxy", version="1.0.0", lifespan=lifespan)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


def get_client() -> NMSClient:
    assert _client is not None, "NMS client belum siap"
    return _client


def require_api_key(x_api_key: str = Header(default="")):
    """Semua endpoint /live/* dan /control/* wajib pakai header X-API-Key."""
    if x_api_key != settings.proxy_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key tidak valid")


def require_control_enabled():
    if not settings.enable_control_endpoints:
        raise HTTPException(
            status_code=403,
            detail="Endpoint controlling dinonaktifkan. Set ENABLE_CONTROL_ENDPOINTS=true untuk mengaktifkan.",
        )


async def _passthrough(coro):
    try:
        return await coro
    except NMSAuthError as e:
        raise HTTPException(status_code=502, detail=str(e))
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except httpx.RequestError as e:
        raise HTTPException(status_code=504, detail=f"NMS tidak dapat dihubungi: {e}")


# ---------------- Health ----------------

@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------- Monitoring (read-only) ----------------

@app.get("/live/system-status", dependencies=[Depends(require_api_key)])
async def live_system_status(client: NMSClient = Depends(get_client)):
    return await _passthrough(client.get("/system/status"))


@app.get("/live/ports/summary", dependencies=[Depends(require_api_key)])
async def live_ports_summary(client: NMSClient = Depends(get_client)):
    return await _passthrough(client.get("/ports/summary"))


@app.get("/live/ports", dependencies=[Depends(require_api_key)])
async def live_ports(
    search: str | None = None,
    status: list[str] | None = Query(default=None),
    smu_type: str | None = None,
    limit: int = 288,
    offset: int = 0,
    ordering: str = "asc",
    client: NMSClient = Depends(get_client),
):
    params = {"limit": limit, "offset": offset, "ordering": ordering}
    if search:
        params["search"] = search
    if smu_type:
        params["smu_type"] = smu_type
    if status:
        params["status"] = status
    return await _passthrough(client.get("/ports/", params=params))


@app.get("/live/connections", dependencies=[Depends(require_api_key)])
async def live_connections(client: NMSClient = Depends(get_client)):
    return await _passthrough(client.get("/connectivity/connections"))


@app.get("/live/queue", dependencies=[Depends(require_api_key)])
async def live_queue(client: NMSClient = Depends(get_client)):
    return await _passthrough(client.get("/connectivity/queues", use_cache=False))


@app.get("/live/inventory", dependencies=[Depends(require_api_key)])
async def live_inventory(client: NMSClient = Depends(get_client)):
    return await _passthrough(client.get("/inventory/"))


# ---------------- Real-Time Streaming (SSE & WebSocket) ----------------

@app.get("/live/stream")
async def live_stream(
    api_key: str = Query(default="", alias="api_key"),
    x_api_key: str = Header(default="", alias="X-API-Key"),
    client: NMSClient = Depends(get_client),
):
    """Server-Sent Events (SSE) telemetry stream untuk live dashboard."""
    key = x_api_key or api_key
    if key != settings.proxy_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key tidak valid")

    async def event_generator():
        while True:
            try:
                sum_data = await client.get("/ports/summary", use_cache=True)
                sys_data = await client.get("/system/status", use_cache=True)
                conn_data = await client.get("/connectivity/connections", use_cache=True)
                q_data = await client.get("/connectivity/queues", use_cache=False)

                packet = {
                    "type": "telemetry",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "summary": sum_data,
                    "systemStatus": sys_data,
                    "connections": conn_data,
                    "queue": q_data,
                }
                yield f"data: {json.dumps(packet)}\n\n"
            except asyncio.CancelledError:
                break
            except Exception as e:
                err_packet = {
                    "type": "heartbeat",
                    "error": str(e),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }
                yield f"data: {json.dumps(err_packet)}\n\n"

            await asyncio.sleep(2.0)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket, client: NMSClient = Depends(get_client)):
    """Bidirectional WebSocket stream untuk live telemetry sub-detik."""
    await websocket.accept()
    try:
        while True:
            try:
                sum_data = await client.get("/ports/summary", use_cache=True)
                sys_data = await client.get("/system/status", use_cache=True)
                conn_data = await client.get("/connectivity/connections", use_cache=True)
                q_data = await client.get("/connectivity/queues", use_cache=False)
                packet = {
                    "type": "telemetry",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "summary": sum_data,
                    "systemStatus": sys_data,
                    "connections": conn_data,
                    "queue": q_data,
                }
                await websocket.send_json(packet)
            except asyncio.CancelledError:
                break
            except Exception as err:
                await websocket.send_json({"type": "ping", "error": str(err)})
            await asyncio.sleep(2.0)
    except WebSocketDisconnect:
        pass


# ---------------- Authentication / Session ----------------

@app.post("/auth/logout", dependencies=[Depends(require_api_key)])
@app.delete("/auth/logout", dependencies=[Depends(require_api_key)])
async def auth_logout(client: NMSClient = Depends(get_client)):
    """Logout sesi NMS secara bersih dan reset token."""
    return await client.logout()


# ---------------- Controlling (write) — nonaktif secara default ----------------

class ConnectRequest(BaseModel):
    source_panel_name: str
    source_port_no: list[int]
    target_panel_name: str
    target_port_no: list[int]
    start_date: str | None = None
    route: int = 0
    customer: str | None = None


class DisconnectRequest(BaseModel):
    panel_name: str
    port_no: int | None = None
    source_port_no: list[int] | None = None
    target_port_no: list[int] | None = None
    confirm_interlock: bool = False


@app.post(
    "/control/connect",
    dependencies=[Depends(require_api_key), Depends(require_control_enabled)],
)
async def control_connect(body: ConnectRequest, client: NMSClient = Depends(get_client)):
    return await _passthrough(client.post("/connectivity/connect", body.model_dump(exclude_none=True)))


@app.post(
    "/control/disconnect",
    dependencies=[Depends(require_api_key), Depends(require_control_enabled)],
)
async def control_disconnect(body: DisconnectRequest, client: NMSClient = Depends(get_client)):
    if not body.confirm_interlock:
        raise HTTPException(
            status_code=428,
            detail="Safety Interlock Engaged: Circuit is actively carrying production traffic. Two-step confirmation with confirm_interlock=true required.",
        )
    payload = body.model_dump(exclude_none=True)
    payload.pop("confirm_interlock", None)
    return await _passthrough(client.post("/connectivity/disconnect", payload))


class DisconnectByIdRequest(BaseModel):
    confirm_interlock: bool = False


@app.post(
    "/control/disconnect/{connection_id}",
    dependencies=[Depends(require_api_key), Depends(require_control_enabled)],
)
async def control_disconnect_by_id(
    connection_id: int,
    confirm_interlock: bool = Query(default=False),
    body: DisconnectByIdRequest | None = None,
    client: NMSClient = Depends(get_client),
):
    is_confirmed = confirm_interlock or (body is not None and body.confirm_interlock)
    if not is_confirmed:
        raise HTTPException(
            status_code=428,
            detail="Safety Interlock Engaged: Connection circuit is active. Two-step confirmation with confirm_interlock=true required.",
        )
    return await _passthrough(client.post(f"/connectivity/connections/{connection_id}/disconnect"))


# ---------------- Business & Persistence Layer (Sprint 2) ----------------

app.include_router(
    business_router,
    prefix="/business",
    tags=["Business Layer"],
    dependencies=[Depends(require_api_key)],
)
