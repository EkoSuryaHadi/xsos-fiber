import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const proxyUrl = process.env.NMS_PROXY_URL || "http://127.0.0.1:8000";
  const apiKey = process.env.NMS_PROXY_API_KEY || "nms-secret-key-remote-2026";

  try {
    const upstreamResponse = await fetch(`${proxyUrl}/live/stream`, {
      headers: {
        "X-API-Key": apiKey,
        Accept: "text/event-stream",
      },
      cache: "no-store",
    });

    if (!upstreamResponse.ok || !upstreamResponse.body) {
      return new Response("Failed to connect to backend telemetry stream", {
        status: upstreamResponse.status || 502,
      });
    }

    return new Response(upstreamResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    return new Response(`Stream connection error: ${String(err)}`, { status: 504 });
  }
}
