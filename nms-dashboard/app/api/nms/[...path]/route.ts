// GET /api/nms/ports/summary      -> proxy GET /live/ports/summary
// GET /api/nms/connections        -> proxy GET /live/connections
// GET /api/nms/ports?search=...   -> proxy GET /live/ports?search=...
// dst — segmen path apa pun di bawah /api/nms/* diteruskan ke /live/* di proxy.
//
// Browser memanggil route ini (same-origin, tanpa API key). Route ini yang
// menambahkan header X-API-Key saat memanggil proxy, jadi kunci tidak pernah
// terkirim ke browser.

import { NextRequest, NextResponse } from "next/server";
import { NmsProxyError, nmsProxyFetch, nmsProxyPost, nmsProxyPatch, nmsProxyDelete } from "@/lib/nms-api";

function resolveTargetPath(pathSegments: string[]): string {
  if (pathSegments.length === 0) return "/health";
  const first = pathSegments[0];
  if (first === "control" || first === "live" || first === "auth" || first === "business") {
    return "/" + pathSegments.join("/");
  }
  return "/live/" + pathSegments.join("/");
}


export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const targetPath = resolveTargetPath(params.path);
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const data = await nmsProxyFetch(targetPath, searchParams);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NmsProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 502 });
    }
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const targetPath = resolveTargetPath(params.path);
  const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  try {
    const data = await nmsProxyPost(targetPath, body, searchParams);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NmsProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 502 });
    }
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const targetPath = resolveTargetPath(params.path);
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  try {
    const data = await nmsProxyPatch(targetPath, body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NmsProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 502 });
    }
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const targetPath = resolveTargetPath(params.path);
  let body: unknown = undefined;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }

  try {
    const data = await nmsProxyDelete(targetPath, body);
    return NextResponse.json(data);
  } catch (err) {
    if (err instanceof NmsProxyError) {
      return NextResponse.json({ error: err.message }, { status: err.status || 502 });
    }
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
