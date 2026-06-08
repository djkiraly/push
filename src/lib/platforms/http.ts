import { request } from "undici";

export type HttpError = Error & {
  status: number;
  body: unknown;
};

function toHttpError(status: number, body: unknown): HttpError {
  const msg = typeof body === "object" && body && "error" in body
    ? JSON.stringify(body)
    : `HTTP ${status}`;
  const e = new Error(msg) as HttpError;
  e.status = status;
  e.body = body;
  return e;
}

export async function getJson<T = unknown>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await request(url, { method: "GET", headers });
  const text = await res.body.text();
  const parsed = text ? safeJson(text) : null;
  if (res.statusCode >= 400) throw toHttpError(res.statusCode, parsed);
  return parsed as T;
}

export async function postForm<T = unknown>(
  url: string,
  form: Record<string, string>,
  headers?: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams(form).toString();
  const res = await request(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...headers,
    },
    body,
  });
  const text = await res.body.text();
  const parsed = text ? safeJson(text) : null;
  if (res.statusCode >= 400) throw toHttpError(res.statusCode, parsed);
  return parsed as T;
}

export async function postJson<T = unknown>(
  url: string,
  body: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.body.text();
  const parsed = text ? safeJson(text) : null;
  if (res.statusCode >= 400) throw toHttpError(res.statusCode, parsed);
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// Multipart upload via the global fetch (undici). FormData is also global in
// Node 20. Built specifically for Facebook /photos and /videos endpoints
// which take a `source` file part.
export async function postMultipart<T = unknown>(
  url: string,
  fields: Record<string, string | Blob>,
  headers?: Record<string, string>,
): Promise<T> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v instanceof Blob) {
      form.append(k, v, (v as { name?: string }).name ?? "file");
    } else {
      form.append(k, v);
    }
  }
  const res = await fetch(url, { method: "POST", body: form, headers });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) throw toHttpError(res.status, parsed);
  return parsed as T;
}

export async function putBinary<T = unknown>(
  url: string,
  body: Buffer,
  headers: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    body: new Uint8Array(body),
    headers,
  });
  const text = await res.text();
  const parsed = text ? safeJson(text) : null;
  if (!res.ok) throw toHttpError(res.status, parsed);
  return parsed as T;
}
