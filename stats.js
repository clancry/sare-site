// Cookieless visit statistics: daily aggregates only, no cookies, no personal data stored.
// A visitor is counted once per day through a salted hash of IP + user agent that rotates daily and is never written to disk.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

let FILE, resolve = p => p, data = { days: {} }, dirty = false, salt = crypto.randomBytes(16).toString("hex"), saltDay = "", seen = new Set();
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|headless|lighthouse|pingdom|uptime|curl|wget|python|node-fetch|axios|monitor/i;
const day = () => new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10); // AST
const inc = (o, k, n = 1) => { if (!k) return; o[k] = (o[k] || 0) + n; };

export function init(dir, res) {
  if (res) resolve = res;
  FILE = path.join(dir, "stats.json");
  try { data = JSON.parse(fs.readFileSync(FILE, "utf8")); data.days ||= {}; } catch {}
  setInterval(flush, 60e3).unref();
  process.on("SIGTERM", () => { flush(); process.exit(0); });
}
function flush() {
  if (!dirty) return; dirty = false;
  const keys = Object.keys(data.days).sort(); while (keys.length > 400) delete data.days[keys.shift()];
  const tmp = FILE + ".tmp"; fs.writeFileSync(tmp, JSON.stringify(data)); fs.renameSync(tmp, FILE);
}
function refHost(r, host) {
  try { const h = new URL(r).hostname.replace(/^www\./, ""); if (!h || h === host.replace(/^www\./, "")) return "";
    if (/google\./.test(h)) return "Google"; if (/bing\./.test(h)) return "Bing"; if (/instagram\./.test(h)) return "Instagram"; if (/facebook\.|fb\./.test(h)) return "Facebook"; if (/whatsapp/.test(h)) return "WhatsApp"; if (/yahoo\./.test(h)) return "Yahoo"; if (/duckduckgo/.test(h)) return "DuckDuckGo"; if (/chatgpt|openai/.test(h)) return "ChatGPT"; if (/claude\.ai|perplexity/.test(h)) return "IA"; return h; } catch { return ""; }
}

export function hit(req, ip, b) {
  const ua = String(req.headers["user-agent"] || "");
  if (!ua || BOT.test(ua)) return;
  const p0 = b.e ? "" : String(b.p || "/").slice(0, 120).split("?")[0], p = b.e ? "" : resolve(p0);
  if (!b.e && !p) return;
  const d = day(); if (d !== saltDay) { saltDay = d; seen = new Set(); salt = crypto.randomBytes(16).toString("hex"); }
  const D = data.days[d] ||= { v: 0, u: 0, pages: {}, refs: {}, langs: {}, dev: {}, ctry: {}, ev: {} };
  if (b.e) { inc(D.ev, String(b.e).slice(0, 40)); dirty = true; return; }
  D.v++; inc(D.pages, p);
  const h = crypto.createHash("sha256").update(salt + ip + ua).digest("hex").slice(0, 16);
  if (!seen.has(h)) {
    seen.add(h); D.u++;
    inc(D.refs, refHost(String(b.r || ""), String(req.headers.host || "")) || "Direct");
    inc(D.dev, /Mobi|Android|iPhone/.test(ua) ? "mobile" : /iPad|Tablet/.test(ua) ? "tablette" : "ordinateur");
    inc(D.ctry, String(req.headers["cf-ipcountry"] || "").slice(0, 2) || (String(req.headers["accept-language"] || "").match(/-([A-Z]{2})/) || [])[1]);
  }
  inc(D.langs, p.split("|")[1]);
  dirty = true;
}

export function summary(days = 30) {
  const out = { days: [], pages: {}, refs: {}, langs: {}, dev: {}, ctry: {}, ev: {}, v: 0, u: 0 };
  const now = Date.now() - 4 * 3600e3;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 864e5).toISOString().slice(0, 10), D = data.days[d];
    out.days.push({ d, v: D?.v || 0, u: D?.u || 0 });
    if (!D) continue; out.v += D.v; out.u += D.u;
    for (const k of ["pages", "refs", "langs", "dev", "ctry", "ev"]) for (const [a, n] of Object.entries(D[k] || {})) inc(out[k], a, n);
  }
  const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 12);
  for (const k of ["pages", "refs", "langs", "dev", "ctry", "ev"]) out[k] = top(out[k]);
  return out;
}
