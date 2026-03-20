import { getStore } from "@netlify/blobs";

const NOTIFY_EMAIL = "miguel.sandoval@neo-stat.com";
const FROM_EMAIL   = "OneMedic <onboarding@resend.dev>";

async function sendNotification(entry) {
  const apiKey = Netlify.env.get("RESEND_API_KEY");
  if (!apiKey) return;
  const tipo   = entry.tipo === "ingreso" ? "Ingreso" : "Gasto";
  const monto  = "$" + Math.round(entry.monto).toLocaleString("es-MX") + " MXN";
  const fecha  = new Date(entry.ts).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
  const asunto = `${entry.tipo === "ingreso" ? "✅" : "🔴"} ${tipo} — ${monto} · ${entry.paramedico || "OneMedic"}`;
  const color  = entry.tipo === "ingreso" ? "#27AE60" : "#E53945";
  const rows   = [
    ["Paramédico",    entry.paramedico || "—"],
    ["Concepto",      entry.concepto   || "—"],
    ["Forma de pago", entry.pago       || "—"],
    ["Cliente/Prov.", entry.cliente    || "—"],
    ["Categoría",     entry.cat        || "—"],
    ["Fecha",         fecha],
    ["Notas",         entry.notas      || "—"],
  ].map(([k,v],i) => `<tr style="background:${i%2===0?"#F9FAFB":"white"}"><td style="padding:10px 14px;font-size:12px;color:#6B7280;font-weight:600;width:130px">${k}</td><td style="padding:10px 14px;font-size:13px;color:#111827">${v}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#F4F6F8;font-family:sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F6F8;padding:32px 0"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:white;border-radius:12px;overflow:hidden"><tr><td style="background:#0D2137;padding:20px 28px;border-bottom:3px solid #3B9BA7"><table width="100%"><tr><td><span style="font-size:20px;font-weight:800;color:white">OneMedic</span><br><span style="font-size:11px;color:rgba(255,255,255,0.5)">Sistema de Finanzas</span></td><td align="right"><span style="background:${entry.tipo==="ingreso"?"#EAF8EF":"#FEF0F0"};color:${color};padding:5px 14px;border-radius:20px;font-size:12px;font-weight:700">${tipo}</span></td></tr></table></td></tr><tr><td style="padding:28px;text-align:center"><div style="font-size:42px;font-weight:900;color:${color};line-height:1">${monto}</div><div style="font-size:13px;color:#888;margin-top:6px">${entry.cat||"—"}</div></td></tr><tr><td style="padding:0 28px 24px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden">${rows}</table></td></tr><tr><td style="background:#F9FAFB;padding:14px 28px;border-top:1px solid #E5E7EB;text-align:center"><span style="font-size:11px;color:#9CA3AF">OneMedic · Homero 223, Polanco, CDMX · 55 3953 6059</span></td></tr></table></td></tr></table></body></html>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, to: [NOTIFY_EMAIL], subject: asunto, html }),
  });
  console.log("Email status:", res.status);
}

export default async (req, context) => {
  const store  = getStore({ name: "finanzas", consistency: "strong" });
  const method = req.method;
  const url    = new URL(req.url);
  if (method === "OPTIONS") return new Response(null, { status: 204 });
  try {
    if (method === "GET") {
      const raw = await store.get("entries", { type: "json" }).catch(() => []);
      return new Response(JSON.stringify(Array.isArray(raw) ? raw : []), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (method === "POST") {
      const body     = await req.json();
      const existing = await store.get("entries", { type: "json" }).catch(() => []);
      const entries  = Array.isArray(existing) ? existing : [];
      const newEntry = { ...body, id: Date.now(), ts: new Date().toISOString() };
      entries.unshift(newEntry);
      await store.setJSON("entries", entries);
      sendNotification(newEntry).catch(e => console.error("Email error:", e));
      return new Response(JSON.stringify(newEntry), { status: 201, headers: { "Content-Type": "application/json" } });
    }
    if (method === "DELETE") {
      const id       = parseInt(url.searchParams.get("id"));
      const existing = await store.get("entries", { type: "json" }).catch(() => []);
      const entries  = (Array.isArray(existing) ? existing : []).filter(e => e.id !== id);
      await store.setJSON("entries", entries);
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};

export const config = { path: "/api/data" };
