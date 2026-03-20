import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const store = getStore({ name: "finanzas", consistency: "strong" });
  const method = req.method;
  const url = new URL(req.url);

  if (method === "OPTIONS") return new Response(null, { status: 204 });

  try {
    if (method === "GET") {
      const raw = await store.get("entries", { type: "json" }).catch(() => []);
      return new Response(JSON.stringify(Array.isArray(raw) ? raw : []), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (method === "POST") {
      const body = await req.json();
      const existing = await store.get("entries", { type: "json" }).catch(() => []);
      const entries = Array.isArray(existing) ? existing : [];
      const newEntry = { ...body, id: Date.now(), ts: new Date().toISOString() };
      entries.unshift(newEntry);
      await store.setJSON("entries", entries);
      return new Response(JSON.stringify(newEntry), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (method === "DELETE") {
      const id = parseInt(url.searchParams.get("id"));
      const existing = await store.get("entries", { type: "json" }).catch(() => []);
      const entries = (Array.isArray(existing) ? existing : []).filter(e => e.id !== id);
      await store.setJSON("entries", entries);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = { path: "/api/data" };
