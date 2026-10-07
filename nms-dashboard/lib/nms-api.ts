// Modul ini hanya boleh diimpor dari kode sisi server (Route Handler,
// Server Component). Jangan pernah diimpor dari komponen "use client" —
// NMS_PROXY_API_KEY harus tetap di server.

const PROXY_BASE_URL = process.env.NMS_PROXY_BASE_URL ?? "http://localhost:8000";
const PROXY_API_KEY = process.env.NMS_PROXY_API_KEY ?? "";

export class NmsProxyError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function nmsProxyFetch<T>(
  path: string,
  searchParams?: Record<string, string | number | string[] | undefined>
): Promise<T> {
  const url = new URL(path, PROXY_BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url, {
    headers: { "X-API-Key": PROXY_API_KEY },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new NmsProxyError(`Proxy ${path} gagal (${res.status}): ${body}`, res.status);
  }

  return res.json() as Promise<T>;
}

export async function nmsProxyPost<T>(
  path: string,
  body?: unknown,
  searchParams?: Record<string, string | number | string[] | undefined>
): Promise<T> {
  const url = new URL(path, PROXY_BASE_URL);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }
  const headers: Record<string, string> = {
    "X-API-Key": PROXY_API_KEY,
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NmsProxyError(`Proxy ${path} gagal (${res.status}): ${text}`, res.status);
  }

  return res.json() as Promise<T>;
}

export async function nmsProxyPatch<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const url = new URL(path, PROXY_BASE_URL);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": PROXY_API_KEY,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NmsProxyError(`Proxy ${path} gagal (${res.status}): ${text}`, res.status);
  }

  return res.json() as Promise<T>;
}

export async function nmsProxyDelete<T>(
  path: string,
  body?: unknown
): Promise<T> {
  const url = new URL(path, PROXY_BASE_URL);
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": PROXY_API_KEY,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new NmsProxyError(`Proxy ${path} gagal (${res.status}): ${text}`, res.status);
  }

  const text = await res.text();
  return (text ? JSON.parse(text) : { status: "ok" }) as T;
}


