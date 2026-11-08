// SARE site: static files + booking requests (stored on disk, emailed, visible at /admin)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import nodemailer from "nodemailer";
import * as tpl from "./mailtpl.js";
import * as admin from "./admin.js";

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
const DATA_DIR = process.env.DATA_DIR || "/data";
const FILE = path.join(DATA_DIR, "requests.jsonl");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const NOTIFY_TO = process.env.NOTIFY_TO || "contact@sare-exclusive.com";
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "SARE <no-reply@sare-exclusive.com>";
const HEADS = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "heads.json"), "utf8"));
const BODY = fs.readFileSync(path.join(PUB, "_body.html"), "utf8");
const PAY_FILE = path.join(DATA_DIR, "payments.jsonl");
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WH = process.env.STRIPE_WEBHOOK_SECRET || "";
const DEPOSIT_PCT = Number(process.env.DEPOSIT_PCT || 30);
const SITE = process.env.SITE_URL || "https://www.sare-exclusive.com";
fs.mkdirSync(DATA_DIR, { recursive: true });

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_PORT || 465) === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml", ".pdf": "application/pdf" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hits = new Map();
function limited(ip) { const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < 3600e3); a.push(now); hits.set(ip, a); return a.length > 20; }

function readAll() {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
const keyOf = r => r.ref || r.receivedAt;
function readPays() {
  const m = new Map();
  if (!fs.existsSync(PAY_FILE)) return m;
  for (const l of fs.readFileSync(PAY_FILE, "utf8").split("\n")) { if (!l) continue; try { const p = JSON.parse(l); m.set(p.key, { ...(m.get(p.key) || {}), ...p }); } catch {} }
  return m;
}
const addPay = p => fs.appendFileSync(PAY_FILE, JSON.stringify({ ...p, at: new Date().toISOString() }) + "\n");
async function stripe(pathname, params) {
  const body = new URLSearchParams();
  const add = (k, v) => { if (v == null || v === "") return; if (typeof v === "object") { for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); } else body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params || {})) add(k, v);
  const r = await fetch("https://api.stripe.com/v1/" + pathname, { method: "POST", headers: { Authorization: "Bearer " + STRIPE_KEY, "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(15000) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || ("Stripe " + r.status));
  return j;
}
async function createDepositLink(r, amountEur, feePct = 0) {
  const label = [r.formula || r.type || "SARE", r.date].filter(Boolean).join(" · ");
  const price = await stripe("prices", { currency: "eur", unit_amount: Math.round(amountEur * 100), product_data: { name: `Deposit · SARE Caribbean Breeze · ${label}`.slice(0, 250) } });
  const items = { 0: { price: price.id, quantity: 1 } };
  const fee = Math.round(amountEur * feePct) / 100;
  if (fee > 0) { const fp = await stripe("prices", { currency: "eur", unit_amount: Math.round(fee * 100), product_data: { name: `Card processing fee (${feePct}%)` } }); items[1] = { price: fp.id, quantity: 1 }; }
  const link = await stripe("payment_links", {
    line_items: items,
    metadata: { ref: keyOf(r), name: r.name || "" },
    payment_intent_data: { description: `SARE deposit ${keyOf(r)} · ${r.name || ""}`.slice(0, 350), metadata: { ref: keyOf(r) } },
    after_completion: { type: "redirect", redirect: { url: SITE + "/#paid" } },
    billing_address_collection: "auto",
  });
  return link;
}
function verifyStripe(raw, header) {
  if (!STRIPE_WH || !header) return false;
  const parts = Object.fromEntries(header.split(",").map(x => x.split("=")));
  const sig = header.split(",").filter(x => x.startsWith("v1=")).map(x => x.slice(3));
  const exp = crypto.createHmac("sha256", STRIPE_WH).update(`${parts.t}.${raw}`).digest("hex");
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 600) return false;
  return sig.some(s => s.length === exp.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(exp)));
}
function summary(r) {
  const skip = new Set(["status", "lang", "createdAt"]);
  return Object.entries(r).filter(([k, v]) => !skip.has(k) && v !== "" && v != null && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
}
async function notify(r) {
  if (!mailer) return;
  const who = r.name || "";
  const when = r.type === "tender" ? (r.from || "") : (r.date || "");
  const subj = `SARE · Nouvelle demande ${r.type === "tender" ? "Tender" : "Day charter"} · ${who}${when ? " · " + when : ""}`;
  try {
    const att = await tpl.pdf(r).catch(e => { console.error("pdf", e.message); return null; });
    await mailer.sendMail({ from: MAIL_FROM, to: NOTIFY_TO, replyTo: /@/.test(r.email || r.contact || "") ? (r.email || r.contact) : undefined, subject: subj,
      html: tpl.html(r, SITE), text: tpl.text(r) + `\n\n${SITE}/admin`,
      attachments: att ? [{ filename: `SARE-${r.ref || "demande"}.pdf`, content: att, contentType: "application/pdf" }] : [] });
  } catch (e) { console.error("mail error", e.message); }
  const to = [r.email, r.contact].find(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(x || "").trim()));
  if (to) try {
    const att = await tpl.pdf(r, tpl_lang(r)).catch(() => null);
    await mailer.sendMail({ from: MAIL_FROM, to: to.trim(), replyTo: NOTIFY_TO, subject: tpl.clientSubject(r), html: tpl.clientHtml(r), text: tpl.clientText(r),
      attachments: att ? [{ filename: `SARE-${r.ref || "request"}.pdf`, content: att, contentType: "application/pdf" }] : [] });
  } catch (e) { console.error("client mail error", e.message); }
}
const tpl_lang = r => ["en", "fr", "es", "ru", "pt", "nl"].includes(r.lang) ? r.lang : "en";
function authed(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [, pass] = Buffer.from(h.slice(6), "base64").toString().split(":");
  const a = Buffer.from(pass || ""), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function adminPage(list, flash) {
  const pays = readPays();
  const money = n => n == null ? "" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
  const rows = list.slice().reverse().map(r => {
    const k = keyOf(r), p = pays.get(k) || {};
    const est = Number(r.estimate) || 0, def = est ? Math.round(est * DEPOSIT_PCT / 100) : "";
    let pay;
    if (p.status === "paid") pay = `<span class="ok">✔ Acompte payé</span><br><small>${money(p.amount)} · ${esc((p.paidAt || "").slice(0, 16).replace("T", " "))}</small>`;
    else if (p.url) {
      const msg = encodeURIComponent(`Bonjour ${r.name || ""}, voici le lien pour régler l'acompte de votre réservation SARE (${money(p.amount)}) : ${p.url}`);
      const tel = String(r.contact || r.phone || "").replace(/\D/g, "");
      pay = `<span class="wait">En attente · ${money(p.amount)}</span><br><input readonly value="${esc(p.url)}" onclick="this.select();navigator.clipboard&&navigator.clipboard.writeText(this.value)"><br>
      <a target="_blank" href="https://wa.me/${tel}?text=${msg}">WhatsApp</a> · <a href="mailto:${esc(r.email || "")}?subject=${encodeURIComponent("SARE · Acompte de réservation")}&body=${msg}">E-mail</a>`;
    } else pay = STRIPE_KEY ? `<form method="post" action="/admin/legacy/pay"><input type="hidden" name="key" value="${esc(k)}"><input name="amount" type="number" min="1" step="1" value="${def}" placeholder="€" required> € <button>Créer le lien d'acompte</button>${est ? `<br><small>${DEPOSIT_PCT} % de ${money(est)}</small>` : ""}</form>` : `<small>Stripe non configuré</small>`;
    return `<tr><td>${esc(r.receivedAt?.slice(0, 16).replace("T", " "))}</td><td><b>${esc(r.type)}</b></td><td>${esc(r.name)}<br><small>${esc(r.email || r.contact)}</small></td><td><pre>${esc(summary(r))}</pre></td><td class="pay">${pay}</td></tr>`;
  }).join("");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SARE · Requests</title>
<style>body{font:14px system-ui,sans-serif;margin:0;padding:24px;background:#f5f3ef;color:#1d1d1b}h1{font-weight:400}table{border-collapse:collapse;width:100%;background:#fff}td{border-bottom:1px solid #ddd;padding:10px;vertical-align:top}pre{white-space:pre-wrap;margin:0;font:12px ui-monospace,monospace}small{color:#666}.w{overflow-x:auto}.pay{min-width:230px}.pay input{width:90px;padding:6px}.pay input[readonly]{width:220px;font-size:11px;margin:6px 0}.pay button{padding:7px 10px;background:#25252c;color:#fff;border:0;cursor:pointer}.ok{color:#1d7a3a;font-weight:600}.wait{color:#9a6b00;font-weight:600}.flash{padding:10px 14px;background:#fff;border-left:3px solid #25252c;margin-bottom:16px}</style>
<h1>SARE · ${list.length} request${list.length === 1 ? "" : "s"}</h1>${flash ? `<div class="flash">${esc(flash)}</div>` : ""}<div class="w"><table>${rows || "<tr><td>No requests yet.</td></tr>"}</table></div>`;
}


// Indicative FX rates (ECB reference rates via frankfurter.app), cached 12 h
let fx = { at: 0, rates: null };
async function getRates() {
  if (fx.rates && Date.now() - fx.at < 12 * 3600e3) return fx.rates;
  try {
    const r = await fetch("https://api.frankfurter.app/latest?from=EUR&to=USD,GBP,CAD,CHF,BRL", { signal: AbortSignal.timeout(5000) });
    if (r.ok) { const j = await r.json(); if (j && j.rates) fx = { at: Date.now(), rates: { EUR: 1, ...j.rates } }; }
  } catch (e) { console.error("fx", e.message); }
  return fx.rates;
}

admin.init({ DATA_DIR, ADMIN_PASSWORD, NOTIFY_TO, MAIL_FROM, SITE, mailer, readRequests: readAll, readPays, addPay, keyOf, createDepositLink, stripeReady: () => !!STRIPE_KEY });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  if (await admin.handle(req, res, url, ip)) return;
  if (url.pathname === "/admin" || url.pathname === "/admin/") { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache", "X-Robots-Tag": "noindex", "X-Frame-Options": "DENY" }); return fs.createReadStream(path.join(PUB, "admin.html")).pipe(res); }
  if (req.method === "POST" && url.pathname === "/api/request") {
    if (limited(ip)) { res.writeHead(429); return res.end(); }
    let body = ""; for await (const c of req) { body += c; if (body.length > 50000) { res.writeHead(413); return res.end(); } }
    let r; try { r = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
    if (typeof r !== "object" || !r || !r.name) { res.writeHead(400); return res.end(); }
    r.receivedAt = new Date().toISOString(); r.ip = ip;
    fs.appendFileSync(FILE, JSON.stringify(r) + "\n");
    notify(r);
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"ok":true}');
  }
  if (req.method === "POST" && url.pathname === "/api/stripe/webhook") {
    let raw = ""; for await (const c of req) { raw += c; if (raw.length > 1e6) break; }
    if (!verifyStripe(raw, req.headers["stripe-signature"])) { res.writeHead(400); return res.end("bad signature"); }
    let ev; try { ev = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
    if (ev.type === "checkout.session.completed" && ev.data?.object?.payment_status === "paid") {
      const o = ev.data.object, linkId = o.payment_link;
      const pays = readPays(); let key = null;
      for (const [k, p] of pays) if (p.linkId === linkId) key = k;
      if (key) {
        const amount = (o.amount_total || 0) / 100;
        addPay({ key, status: "paid", paidAt: new Date().toISOString(), paidAmount: amount, session: o.id, email: o.customer_details?.email });
        admin.onPaid(key, amount, pays.get(key));
        stripe("payment_links/" + linkId, { active: "false" }).catch(e => console.error("deactivate", e.message));
        const bk = admin.bookingForKey(key);
        const r = bk ? { name: bk.client?.name, formula: bk.title, date: bk.date } : (readAll().find(x => keyOf(x) === key) || {});
        if (mailer) mailer.sendMail({ from: MAIL_FROM, to: NOTIFY_TO, subject: `SARE · Acompte reçu · ${r.name || ""} · ${amount} € (${key})`, text: `Acompte de ${amount} € reçu pour ${r.name || ""} (${r.formula || r.type || ""} ${r.date || ""}).\n\nhttps://sare-exclusive.com/admin` }).catch(e => console.error("mail", e.message));
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" }); return res.end('{"received":true}');
  }
  if (req.method === "POST" && url.pathname === "/admin/legacy/pay") {
    if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="SARE"' }); return res.end("Login required"); }
    let body = ""; for await (const c of req) { body += c; if (body.length > 5000) break; }
    const f = new URLSearchParams(body), key = f.get("key"), amount = Number(f.get("amount"));
    const r = readAll().find(x => keyOf(x) === key);
    let flash;
    if (!r || !(amount > 0) || !STRIPE_KEY) flash = "Impossible de créer le lien (demande ou montant invalide).";
    else try { const link = await createDepositLink(r, amount); addPay({ key, linkId: link.id, url: link.url, amount, status: "pending" }); flash = `Lien d'acompte créé pour ${r.name} : ${link.url}`; }
    catch (e) { console.error("stripe", e.message); flash = "Erreur Stripe : " + e.message; }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return res.end(adminPage(readAll(), flash));
  }
  if (url.pathname === "/admin/legacy" || url.pathname === "/admin.json") {
    if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="SARE"' }); return res.end("Login required"); }
    const list = readAll();
    if (url.pathname === "/admin.json") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(list)); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return res.end(adminPage(list));
  }
  if (url.pathname === "/api/rates") {
    const rates = await getRates();
    res.writeHead(rates ? 200 : 503, { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" });
    return res.end(JSON.stringify(rates ? { base: "EUR", rates } : { error: "unavailable" }));
  }
  if (url.pathname === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (url.pathname === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: https://www.sare-exclusive.com/sitemap.xml\n"); }
  if (!path.extname(url.pathname) && url.pathname !== "/") {
    let p = decodeURIComponent(url.pathname);
    const lp = p.replace(/\/+$/, "");
    if (/^\/(fr|es|ru|pt|nl)$/.test(lp) && p !== lp + "/") { res.writeHead(301, { Location: lp + "/" + url.search }); return res.end(); }
    const key = HEADS[p] ? p : (HEADS[lp] ? lp : null);
    if (key && key !== p) { res.writeHead(301, { Location: key + url.search }); return res.end(); }
    if (key) { res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" }); return res.end(HEADS[key] + BODY); }
    res.writeHead(301, { Location: "/" }); return res.end();
  }
  if (url.pathname === "/_body.html") { res.writeHead(404); return res.end("Not found"); }
  let p = decodeURIComponent(url.pathname); if (p === "/" || !path.extname(p)) p = "/index.html";
  const f = path.join(PUB, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("Not found"); }
  const ext = path.extname(f);
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800", "X-Content-Type-Options": "nosniff" });
  fs.createReadStream(f).pipe(res);
});
server.listen(PORT, () => console.log("SARE listening on", PORT, "mail:", mailer ? "on" : "off", "stripe:", STRIPE_KEY ? (STRIPE_KEY.startsWith("sk_live") ? "live" : "test") : "off"));
