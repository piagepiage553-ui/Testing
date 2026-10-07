// The AI Compass: response store, served at /api/dots.
//
//   GET    -> { sources: ["direct", "betteroffline", ...], points: [x, y, sourceIndex, ...] }
//   POST   {id, x, y, source, peeked} -> places a new dot or moves this respondent's dot
//   DELETE {id}                       -> removes this respondent's dot
//
// Each dot is one Netlify Blobs key, d/<id>/<time>/<x>/<y>/<source>/<peeked>, so the
// whole data set is read with a single list() call and respondents never overwrite
// each other. Respondent IDs are never returned, so nobody can move someone else's dot.

import { getStore } from "@netlify/blobs";

const ID_RE = /^v[0-9a-f]{12,40}$/;

const clamp = (v) => Math.max(-100, Math.min(100, Math.round(v)));
const cleanSource = (s) => String(s || "").toLowerCase().replace(/^\/?r\//, "").replace(/[^a-z0-9_]/g, "").slice(0, 30) || "direct";

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
  });

export async function listDots(store) {
  const { blobs } = await store.list({ prefix: "d/" });
  const latest = new Map(); // id -> [time, x, y, source]
  for (const { key } of blobs) {
    const [, id, time, x, y, source] = key.split("/");
    const t = Number(time), px = Number(x), py = Number(y);
    if (!id || !Number.isFinite(t) || !Number.isFinite(px) || !Number.isFinite(py)) continue;
    const prev = latest.get(id);
    if (!prev || t > prev[0]) latest.set(id, [t, clamp(px), clamp(py), cleanSource(source)]);
  }
  const sources = [], index = new Map(), points = [];
  for (const [, x, y, source] of latest.values()) {
    if (!index.has(source)) { index.set(source, sources.length); sources.push(source); }
    points.push(x, y, index.get(source));
  }
  return { sources, points };
}

async function removeDot(store, id) {
  const { blobs } = await store.list({ prefix: `d/${id}/` });
  await Promise.all(blobs.map((b) => store.delete(b.key)));
}

export async function handle(req, store) {
  if (req.method === "GET") {
    return json(await listDots(store), 200, {
      "Cache-Control": "public, max-age=0, must-revalidate",
      "Netlify-CDN-Cache-Control": "public, s-maxage=15, stale-while-revalidate=30",
    });
  }

  if (req.method !== "POST" && req.method !== "DELETE") return json({ ok: false, error: "method" }, 405);

  let data;
  try {
    data = JSON.parse(await req.text());
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const id = String(data?.id || "");
  if (!ID_RE.test(id)) return json({ ok: false, error: "bad_id" }, 400);

  if (req.method === "DELETE") {
    await removeDot(store, id);
    return json({ ok: true });
  }

  const x = Number(data.x), y = Number(data.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return json({ ok: false, error: "bad_point" }, 400);

  const { blobs: existing } = await store.list({ prefix: `d/${id}/` });
  // Moving a dot keeps the source and peeked flag it was first submitted with.
  const first = existing[0]?.key.split("/");
  const source = first ? cleanSource(first[5]) : cleanSource(data.source);
  const peeked = first ? (first[6] === "1" ? 1 : 0) : (data.peeked ? 1 : 0);

  await store.set(`d/${id}/${Date.now()}/${clamp(x)}/${clamp(y)}/${source}/${peeked}`, "");
  await Promise.all(existing.map((b) => store.delete(b.key)));
  return json({ ok: true });
}

export default async (req) => handle(req, getStore({ name: "dots", consistency: "strong" }));

export const config = { path: "/api/dots" };
