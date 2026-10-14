// SARE site: static files + booking requests (stored on disk, emailed, visible at /admin)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import nodemailer from "nodemailer";

const PORT = process.env.PORT || 3000;
const PUB = path.join(path.dirname(new URL(import.meta.url).pathname), "public");
const DATA_DIR = process.env.DATA_DIR || "/data";
const FILE = path.join(DATA_DIR, "requests.jsonl");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const NOTIFY_TO = process.env.NOTIFY_TO || "contact@sare-exclusive.com";
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER || "SARE <no-reply@sare-exclusive.com>";
fs.mkdirSync(DATA_DIR, { recursive: true });

const mailer = process.env.SMTP_HOST ? nodemailer.createTransport({
  host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 465),
  secure: String(process.env.SMTP_PORT || 465) === "465",
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
}) : null;

const TYPES = { ".html": "text/html; charset=utf-8", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".xml": "application/xml" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const hits = new Map();
function limited(ip) { const now = Date.now(); const a = (hits.get(ip) || []).filter(t => now - t < 3600e3); a.push(now); hits.set(ip, a); return a.length > 20; }

function readAll() {
  if (!fs.existsSync(FILE)) return [];
  return fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}
function summary(r) {
  const skip = new Set(["status", "lang", "createdAt"]);
  return Object.entries(r).filter(([k, v]) => !skip.has(k) && v !== "" && v != null && !(Array.isArray(v) && !v.length))
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`).join("\n");
}
async function notify(r) {
  if (!mailer) return;
  const subj = `SARE · ${r.type || "request"} · ${r.name || ""} · ${r.date || r.from || ""} (${r.ref})`;
  try { await mailer.sendMail({ from: MAIL_FROM, to: NOTIFY_TO, replyTo: /@/.test(r.email || r.contact || "") ? (r.email || r.contact) : undefined, subject: subj, text: summary(r) + `\n\nReceived ${r.receivedAt}\nAll requests: https://sare-exclusive.com/admin` }); }
  catch (e) { console.error("mail error", e.message); }
}
function authed(req) {
  if (!ADMIN_PASSWORD) return false;
  const h = req.headers.authorization || "";
  if (!h.startsWith("Basic ")) return false;
  const [, pass] = Buffer.from(h.slice(6), "base64").toString().split(":");
  const a = Buffer.from(pass || ""), b = Buffer.from(ADMIN_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function adminPage(list) {
  const rows = list.slice().reverse().map(r => `<tr><td>${esc(r.receivedAt?.slice(0, 16).replace("T", " "))}</td><td><b>${esc(r.type)}</b></td><td>${esc(r.name)}<br><small>${esc(r.email || r.contact)}</small></td><td><pre>${esc(summary(r))}</pre></td></tr>`).join("");
  return `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SARE · Requests</title>
<style>body{font:14px system-ui,sans-serif;margin:0;padding:24px;background:#f5f3ef;color:#1d1d1b}h1{font-weight:400}table{border-collapse:collapse;width:100%;background:#fff}td{border-bottom:1px solid #ddd;padding:10px;vertical-align:top}pre{white-space:pre-wrap;margin:0;font:12px ui-monospace,monospace}small{color:#666}.w{overflow-x:auto}</style>
<h1>SARE · ${list.length} request${list.length === 1 ? "" : "s"}</h1><div class="w"><table>${rows || "<tr><td>No requests yet.</td></tr>"}</table></div>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
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
  if (url.pathname === "/admin" || url.pathname === "/admin.json") {
    if (!authed(req)) { res.writeHead(401, { "WWW-Authenticate": 'Basic realm="SARE"' }); return res.end("Login required"); }
    const list = readAll();
    if (url.pathname === "/admin.json") { res.writeHead(200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(list)); }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); return res.end(adminPage(list));
  }
  if (url.pathname === "/healthz") { res.writeHead(200); return res.end("ok"); }
  if (url.pathname === "/robots.txt") { res.writeHead(200, { "Content-Type": "text/plain" }); return res.end("User-agent: *\nDisallow: /admin\nSitemap: https://sare-exclusive.com/sitemap.xml\n"); }
  if (url.pathname === "/sitemap.xml") { res.writeHead(200, { "Content-Type": "application/xml" }); return res.end('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://sare-exclusive.com/</loc></url></urlset>'); }
  let p = decodeURIComponent(url.pathname); if (p === "/" || !path.extname(p)) p = "/index.html";
  const f = path.join(PUB, path.normalize(p).replace(/^(\.\.[/\\])+/, ""));
  if (!f.startsWith(PUB) || !fs.existsSync(f)) { res.writeHead(404); return res.end("Not found"); }
  const ext = path.extname(f);
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=604800", "X-Content-Type-Options": "nosniff" });
  fs.createReadStream(f).pipe(res);
});
server.listen(PORT, () => console.log("SARE listening on", PORT, "mail:", mailer ? "on" : "off"));
