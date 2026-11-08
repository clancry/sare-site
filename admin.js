// SARE back office: users & roles, bookings, maintenance, expenses, availability.
// Storage: one JSON document in DATA_DIR (small volumes; atomic writes + daily backup).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import * as tpl from "./mailtpl.js";

const ROLES = ["owner", "concierge", "captain"];
const COLLS = ["bookings", "maintenance", "expenses", "blocks"];
const BOOKING_STATUS = ["request", "option", "confirmed", "done", "cancelled"];
const BUSY = new Set(["option", "confirmed"]);

let ctx, FILE, db;

/* ---------------- storage ---------------- */
function load() {
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { db = {}; }
  db.meta ||= {}; db.users ||= []; db.archived ||= []; db.deletedReqs ||= [];
  db.settings ||= {}; db.settings.cardFeePct ??= 2.5; db.settings.depositPct ??= 30; db.settings.wireDiscountPct ??= 0; db.settings.bank ||= {}; db.settings.company ||= {};
  for (const c of COLLS) db[c] ||= [];
  db.meta.secret ||= crypto.randomBytes(32).toString("hex");
}
function save() {
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE);
  const day = new Date().toISOString().slice(0, 10), bk = FILE.replace(/\.json$/, `.${day}.bak.json`);
  if (!fs.existsSync(bk)) { try { fs.copyFileSync(FILE, bk); } catch {} }
}
const uid = () => crypto.randomBytes(9).toString("base64url");
const now = () => new Date().toISOString();

/* ---------------- auth ---------------- */
function hash(pw, salt = crypto.randomBytes(16).toString("hex")) { return { salt, hash: crypto.scryptSync(pw, salt, 64).toString("hex") }; }
function check(pw, u) { if (!u.hash) return false; const h = crypto.scryptSync(pw, u.salt, 64); const b = Buffer.from(u.hash, "hex"); return b.length === h.length && crypto.timingSafeEqual(b, h); }
function sign(v) { return crypto.createHmac("sha256", db.meta.secret).update(v).digest("base64url"); }
function makeSession(u) { const p = Buffer.from(JSON.stringify({ u: u.id, e: Date.now() + 30 * 864e5, v: u.sv || 0 })).toString("base64url"); return p + "." + sign(p); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || "").split(/;\s*/).filter(Boolean).map(c => { const i = c.indexOf("="); return [c.slice(0, i), decodeURIComponent(c.slice(i + 1))]; })); }
function currentUser(req) {
  const t = cookies(req).sare_s; if (!t) return null;
  const [p, s] = t.split("."); if (!p || !s || sign(p) !== s) return null;
  let o; try { o = JSON.parse(Buffer.from(p, "base64url").toString()); } catch { return null; }
  if (o.e < Date.now()) return null;
  const u = db.users.find(x => x.id === o.u && x.active !== false);
  return u && (u.sv || 0) === o.v ? u : null;
}
let reqProto = "https";
const setCookie = (res, v, maxAge) => res.setHeader("Set-Cookie", `sare_s=${v}; Path=/; HttpOnly;${reqProto === "https" ? " Secure;" : ""} SameSite=Lax; Max-Age=${maxAge}`);
const pubUser = u => ({ id: u.id, email: u.email, name: u.name, role: u.role, phone: u.phone || "", active: u.active !== false, pending: !u.hash, invitedAt: u.invitedAt, lastLogin: u.lastLogin });

/* ---------------- role filtering ---------------- */
const CAPTAIN_BOOKING_FIELDS = ["id", "ref", "status", "type", "title", "date", "endDate", "start", "end", "guests", "pickup", "occasion", "options", "itinerary", "crewNotes", "captainId", "conciergeId"];
function viewBooking(b, u) {
  if (u.role !== "captain") return b;
  const o = {}; for (const k of CAPTAIN_BOOKING_FIELDS) o[k] = b[k];
  const c = b.client || {}; o.client = { name: String(c.name || "").split(/\s+/)[0], phone: c.phone || "", lang: c.lang || "" };
  return o;
}
function bundle(u) {
  const out = { me: { ...pubUser(u), ical: u.icalToken ? `${ctx.SITE}/api/ical/${u.icalToken}.ics` : "" }, roles: ROLES };
  const staff = db.users.filter(x => x.active !== false).map(x => ({ id: x.id, name: x.name, role: x.role, phone: x.phone || "" }));
  out.staff = staff;
  out.blocks = db.blocks;
  if (u.role === "captain") {
    out.bookings = db.bookings.filter(b => b.captainId === u.id && b.status !== "cancelled").map(b => viewBooking(b, u));
    out.maintenance = db.maintenance.map(m => { const { cost, vendor, ...rest } = m; return rest; });
    return out;
  }
  out.bookings = db.bookings;
  const pays = ctx.readPays();
  out.payments = Object.fromEntries([...pays].filter(([k]) => k.startsWith("bk:")).map(([k, v]) => [k.slice(3), v]));
  const archived = new Set(db.archived);
  const del = new Set(db.deletedReqs);
  out.requests = ctx.readRequests().filter(r => !del.has(ctx.keyOf(r))).map(r => ({ ...r, key: ctx.keyOf(r), archived: archived.has(ctx.keyOf(r)) })).reverse();
  out.lastBackup = db.meta.lastBackup || "";
  out.settings = { cardFeePct: db.settings.cardFeePct, depositPct: db.settings.depositPct, wireDiscountPct: db.settings.wireDiscountPct, hasBank: !!db.settings.bank.iban };
  if (u.role === "owner") { out.maintenance = db.maintenance; out.expenses = db.expenses; out.users = db.users.map(pubUser); out.settings = db.settings; }
  return out;
}

/* ---------------- sanitizing ---------------- */
const str = (v, n = 2000) => v == null ? "" : String(v).slice(0, n);
const num = v => v === "" || v == null || isNaN(Number(v)) ? null : Math.round(Number(v) * 100) / 100;
const date = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v || "")) ? String(v) : "";
const time = v => /^\d{2}:\d{2}$/.test(String(v || "")) ? String(v) : "";
const arr = v => (Array.isArray(v) ? v : String(v || "").split(",")).map(x => str(x, 120).trim()).filter(Boolean).slice(0, 40);
const SAN = {
  bookings: (o, u) => ({
    status: BOOKING_STATUS.includes(o.status) ? o.status : "option", type: ["charter", "tender", "transfer", "voyage", "other"].includes(o.type) ? o.type : "charter",
    title: str(o.title, 160), date: date(o.date), endDate: date(o.endDate), start: time(o.start), end: time(o.end), guests: num(o.guests),
    pickup: str(o.pickup, 200), occasion: str(o.occasion, 120), options: arr(o.options), itinerary: str(o.itinerary), crewNotes: str(o.crewNotes), notes: str(o.notes),
    client: { name: str(o.client?.name, 160), email: str(o.client?.email, 200), phone: str(o.client?.phone, 60), lang: str(o.client?.lang, 5), company: str(o.client?.company, 160) },
    price: num(o.price), deposit: num(o.deposit), payments: (Array.isArray(o.payments) ? o.payments : []).slice(0, 50).map(p => ({ date: date(p.date), amount: num(p.amount), method: str(p.method, 40), note: str(p.note, 200) })).filter(p => p.amount),
    captainId: str(o.captainId, 40), conciergeId: str(o.conciergeId, 40), requestKey: str(o.requestKey, 80),
  }),
  maintenance: (o, u) => ({
    date: date(o.date), kind: ["service", "repair", "inspection", "cleaning", "issue", "other"].includes(o.kind) ? o.kind : "service",
    title: str(o.title, 200), engineHours: num(o.engineHours), notes: str(o.notes), nextDate: date(o.nextDate), nextHours: num(o.nextHours), done: !!o.done,
    ...(u.role === "owner" ? { cost: num(o.cost), vendor: str(o.vendor, 160) } : {}),
  }),
  expenses: o => ({ date: date(o.date), category: ["fuel", "maintenance", "marina", "insurance", "crew", "cleaning", "provisions", "fees", "marketing", "other"].includes(o.category) ? o.category : "other", label: str(o.label, 200), amount: num(o.amount), bookingId: str(o.bookingId, 40), notes: str(o.notes) }),
  blocks: o => ({ date: date(o.date), endDate: date(o.endDate), reason: str(o.reason, 200) }),
};
const CAN_WRITE = { bookings: ["owner", "concierge"], maintenance: ["owner", "captain"], expenses: ["owner"], blocks: ["owner", "concierge"] };

/* ---------------- availability ---------------- */
function* days(a, b) { const d = new Date(a + "T12:00:00Z"), e = new Date((b || a) + "T12:00:00Z"); let n = 0; while (d <= e && n++ < 400) { yield d.toISOString().slice(0, 10); d.setUTCDate(d.getUTCDate() + 1); } }
export function busyDays() {
  const s = new Set(), today = new Date().toISOString().slice(0, 10);
  for (const b of db.bookings) if (BUSY.has(b.status) && b.date) for (const d of days(b.date, b.endDate)) if (d >= today) s.add(d);
  for (const b of db.blocks) if (b.date) for (const d of days(b.date, b.endDate)) if (d >= today) s.add(d);
  return [...s].sort();
}


/* ---------------- iCalendar feed ---------------- */
const icsEsc = s => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const fold = l => { const out = []; let x = l; while (Buffer.byteLength(x) > 74) { let i = 74; while (Buffer.byteLength(x.slice(0, i)) > 74) i--; out.push(x.slice(0, i)); x = " " + x.slice(i); } out.push(x); return out.join("\r\n"); };
const ymd = d => d.replace(/-/g, "");
const nextDay = d => { const x = new Date(d + "T12:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
const utc = (d, t) => { const x = new Date(`${d}T${t}:00-04:00`); return x.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }; // Caribbean time (AST, UTC-4, no DST)
const TYPE_FR = { charter: "Day charter", tender: "Tender", transfer: "Transfert", voyage: "Voyage", other: "Sortie" };
function ics(u) {
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SARE Caribbean Breeze//Back office//FR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:SARE · " + (u.role === "captain" ? "Mes sorties" : "Planning"), "X-WR-TIMEZONE:America/Lower_Princes", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const list = db.bookings.filter(b => b.date && b.status !== "cancelled" && (u.role !== "captain" || b.captainId === u.id));
  for (const b0 of list) {
    const b = viewBooking(b0, u), c = b.client || {};
    const summary = `${b.status === "option" ? "[Option] " : ""}${b.title || TYPE_FR[b.type] || "Sortie"}${c.name ? " · " + c.name : ""}${b.guests ? " · " + b.guests + " pers." : ""}`;
    const desc = [b.ref, b.start && b.end ? `${b.start} – ${b.end}` : "", b.pickup ? "Prise en charge : " + b.pickup : "", b.occasion ? "Occasion : " + b.occasion : "", (b.options || []).length ? "Options : " + b.options.join(", ") : "",
      c.phone ? "Client : " + [c.name, c.phone].filter(Boolean).join(" ") : "", u.role !== "captain" && c.email ? "E-mail : " + c.email : "", u.role !== "captain" && b0.price ? `Prix : ${b0.price} €` : "",
      b.itinerary ? "Programme : " + b.itinerary : "", b.crewNotes ? "Notes : " + b.crewNotes : "", `${ctx.SITE}/admin`].filter(Boolean).join("\n");
    L.push("BEGIN:VEVENT", `UID:${b.id}@sare-exclusive.com`, `DTSTAMP:${stamp}`);
    const multi = b.endDate && b.endDate > b.date;
    if (b.start && !multi) { L.push(`DTSTART:${utc(b.date, b.start)}`, `DTEND:${utc(b.date, b.end && b.end > b.start ? b.end : b.start)}`); }
    else { L.push(`DTSTART;VALUE=DATE:${ymd(b.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(b.endDate || b.date))}`); }
    L.push(fold("SUMMARY:" + icsEsc(summary)), fold("DESCRIPTION:" + icsEsc(desc)), b.pickup ? fold("LOCATION:" + icsEsc(b.pickup)) : "", `STATUS:${b.status === "option" ? "TENTATIVE" : "CONFIRMED"}`, "END:VEVENT");
  }
  for (const k of db.blocks) if (k.date) L.push("BEGIN:VEVENT", `UID:block-${k.id}@sare-exclusive.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(k.date)}`, `DTEND;VALUE=DATE:${ymd(nextDay(k.endDate || k.date))}`, fold("SUMMARY:" + icsEsc("⛔ Indisponible" + (u.role !== "captain" && k.reason ? " · " + k.reason : ""))), "TRANSP:TRANSPARENT", "END:VEVENT");
  L.push("END:VCALENDAR");
  return L.filter(Boolean).join("\r\n") + "\r\n";
}

/* ---------------- mail ---------------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function frame(title, body) {
  return `<!doctype html><body style="margin:0;background:#efede8;padding:24px 12px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center"><table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff">
<tr><td style="background:#25252c;padding:24px 32px"><div style="font:300 28px Georgia,serif;letter-spacing:.12em;color:#f1efea">SARE</div><div style="font:10px Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#c8ccdb;margin-top:4px">Caribbean Breeze</div></td></tr>
<tr><td style="padding:30px 32px;font:15px/1.6 Arial,sans-serif;color:#3b3e46"><div style="font:300 24px Georgia,serif;color:#25252c;margin-bottom:14px">${esc(title)}</div>${body}</td></tr></table></td></tr></table></body>`;
}
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;margin-top:18px;padding:13px 22px;background:#25252c;color:#f1efea;text-decoration:none;font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase">${esc(label)}</a>`;
const ROLE_FR = { owner: "propriétaire", concierge: "concierge", captain: "capitaine" };
async function sendMail(to, subject, html, text) { if (!ctx.mailer) return false; try { await ctx.mailer.sendMail({ from: ctx.MAIL_FROM, to, subject, html, text }); return true; } catch (e) { console.error("admin mail", e.message); return false; } }
function inviteMail(u, by) {
  const link = `${ctx.SITE}/admin#invite=${u.inviteToken}`;
  return sendMail(u.email, "SARE · Votre accès au back office", frame(`Bonjour ${u.name || ""},`,
    `<p>${esc(by?.name || "Cédric")} vous invite à rejoindre le back office SARE en tant que <b>${ROLE_FR[u.role]}</b>.</p><p>Vous y trouverez le planning des sorties et toutes les informations utiles pour chaque prestation.</p>${button(link, "Créer mon mot de passe")}<p style="font-size:12px;color:#7a7d86;margin-top:22px">Ce lien est valable 7 jours.</p>`),
    `Bonjour ${u.name || ""}, vous êtes invité(e) au back office SARE (${ROLE_FR[u.role]}). Créez votre mot de passe : ${link}`);
}
const fdate = d => d ? new Date(d + "T12:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
function sheetMail(b, cap) {
  const c = b.client || {};
  const rows = [["Date", fdate(b.date) + (b.endDate && b.endDate !== b.date ? " → " + fdate(b.endDate) : "")], ["Horaires", [b.start, b.end].filter(Boolean).join(" – ")], ["Prise en charge", b.pickup], ["Invités", b.guests], ["Occasion", b.occasion], ["Options", (b.options || []).join(", ")], ["Client", [String(c.name || "").split(/\s+/)[0], c.phone].filter(Boolean).join(" · ")], ["Programme", b.itinerary], ["Notes équipage", b.crewNotes]]
    .filter(([, v]) => v !== "" && v != null).map(([k, v]) => `<tr><td style="padding:7px 0;width:120px;color:#7a7d86;font-size:12px;vertical-align:top">${k}</td><td style="padding:7px 0;color:#25252c;vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
  return sendMail(cap.email, `SARE · Fiche de sortie · ${b.date} · ${b.title || b.ref || ""}`, frame(`Fiche de sortie · ${b.title || ""}`, `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>${button(ctx.SITE + "/admin", "Ouvrir le back office")}`), rows.replace(/<[^>]+>/g, " "));
}

async function makeLink(bk, base) {
  const pct = Number(db.settings.cardFeePct) || 0, fee = Math.round(base * pct) / 100;
  const l = await ctx.createDepositLink({ ref: "bk:" + bk.id, name: bk.client?.name, formula: bk.title || bk.type, date: bk.date }, base, pct);
  ctx.addPay({ key: "bk:" + bk.id, linkId: l.id, url: l.url, amount: base, fee, card: Math.round((base + fee) * 100) / 100, status: "pending" });
  return { url: l.url, amount: base, fee, card: Math.round((base + fee) * 100) / 100 };
}
/* ---------------- off-site backup ---------------- */
function backupFiles() {
  const out = [{ filename: "backoffice.json", content: JSON.stringify(db, null, 1) }];
  for (const f of ["requests.jsonl", "payments.jsonl", "stats.json"]) { const p = path.join(ctx.DATA_DIR, f); if (fs.existsSync(p)) out.push({ filename: f, content: fs.readFileSync(p) }); }
  return out;
}
async function sendBackup(reason) {
  if (!ctx.mailer) return false;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await ctx.mailer.sendMail({ from: ctx.MAIL_FROM, to: ctx.NOTIFY_TO, subject: `SARE · Sauvegarde du back office · ${day}`,
      text: `Sauvegarde ${reason === "manual" ? "manuelle" : "hebdomadaire"} du back office SARE (réservations, clients, maintenance, frais, demandes).\n\nConservez cet e-mail : en cas de problème sur le serveur, ces fichiers permettent de tout restaurer.\n\n${db.bookings.length} réservations · ${db.expenses.length} dépenses · ${db.maintenance.length} entrées de maintenance.`,
      attachments: backupFiles().map(f => ({ ...f, filename: f.filename.replace(/^/, `sare-${day}-`) })) });
    db.meta.lastBackup = now(); save(); return true;
  } catch (e) { console.error("backup", e.message); return false; }
}
function backupTick() {
  const ast = new Date(Date.now() - 4 * 3600e3); // Caribbean time
  const last = db.meta.lastBackup ? Date.parse(db.meta.lastBackup) : 0;
  if (ast.getUTCDay() === 1 && ast.getUTCHours() >= 7 && Date.now() - last > 5 * 864e5) sendBackup("weekly");
}
/* ---------------- http helpers ---------------- */
async function body(req, max = 200000) { let s = ""; for await (const c of req) { s += c; if (s.length > max) throw new Error("too large"); } return s ? JSON.parse(s) : {}; }
const json = (res, code, o) => { res.writeHead(code, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(o)); return true; };
const tries = new Map();
function throttled(ip) { const n = Date.now(), a = (tries.get(ip) || []).filter(t => n - t < 9e5); a.push(n); tries.set(ip, a); return a.length > 12; }

/* ---------------- public API for server.js ---------------- */
export function init(c) {
  ctx = c; FILE = path.join(c.DATA_DIR, "backoffice.json"); load();
  if (!db.users.length && c.ADMIN_PASSWORD) { // first start: owner account
    db.users.push({ id: uid(), email: c.NOTIFY_TO.toLowerCase(), name: "Cédric", role: "owner", ...hash(c.ADMIN_PASSWORD), active: true, createdAt: now() });
    save(); console.log("backoffice: owner account created for", c.NOTIFY_TO);
  }
  setInterval(backupTick, 3600e3); setTimeout(backupTick, 60e3);
}
export function onPaid(key, amount, pay) {
  if (!key?.startsWith("bk:")) return;
  const b = db.bookings.find(x => x.id === key.slice(3)); if (!b) return;
  const base = pay?.amount && pay?.fee ? pay.amount : amount;
  b.payments ||= []; b.payments.push({ date: now().slice(0, 10), amount: base, method: "Stripe", note: "Acompte carte en ligne" + (pay?.fee ? ` (+${pay.fee} € de frais carte)` : "") });
  if (b.status === "option") b.status = "confirmed";
  b.updatedAt = now(); save();
}
export function bookingForKey(key) { return key?.startsWith("bk:") ? db.bookings.find(x => x.id === key.slice(3)) : null; }

export async function handle(req, res, url, ip) {
  const p = url.pathname;
  if (p === "/api/availability") { res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "public, max-age=300" }); res.end(JSON.stringify({ busy: busyDays() })); return true; }
  const ic = p.match(/^\/api\/ical\/([\w-]{20,})\.ics$/);
  if (ic) {
    const u = db.users.find(x => x.icalToken === ic[1] && x.active !== false);
    if (!u) { res.writeHead(404); res.end("Not found"); return true; }
    res.writeHead(200, { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-cache", "Content-Disposition": 'inline; filename="sare.ics"' }); res.end(ics(u)); return true;
  }
  if (!p.startsWith("/api/admin/")) return false;
  const m = req.method;
  reqProto = String(req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http")).split(",")[0];
  try {
    if (p === "/api/admin/login" && m === "POST") {
      if (throttled(ip)) return json(res, 429, { error: "Trop d'essais, réessayez dans 15 minutes." });
      const b = await body(req); const u = db.users.find(x => x.email === String(b.email || "").trim().toLowerCase() && x.active !== false);
      if (!u || !check(String(b.password || ""), u)) return json(res, 401, { error: "E-mail ou mot de passe incorrect." });
      u.lastLogin = now(); save(); setCookie(res, makeSession(u), 30 * 86400); return json(res, 200, { ok: true });
    }
    if (p === "/api/admin/logout") { setCookie(res, "", 0); return json(res, 200, { ok: true }); }
    const inv = p.match(/^\/api\/admin\/invite\/([\w-]{20,})$/);
    if (inv) {
      const u = db.users.find(x => x.inviteToken === inv[1] && x.inviteExp > Date.now());
      if (!u) return json(res, 404, { error: "Lien d'invitation invalide ou expiré." });
      if (m === "GET") return json(res, 200, { email: u.email, name: u.name, role: u.role });
      const b = await body(req); if (String(b.password || "").length < 8) return json(res, 400, { error: "8 caractères minimum." });
      Object.assign(u, hash(String(b.password)), { inviteToken: null, inviteExp: null, active: true, lastLogin: now() }); save();
      setCookie(res, makeSession(u), 30 * 86400); return json(res, 200, { ok: true });
    }

    const u = currentUser(req);
    if (!u) return json(res, 401, { error: "auth" });
    if (p === "/api/admin/data" && m === "GET") return json(res, 200, bundle(u));
    if (p === "/api/admin/password" && m === "POST") {
      const b = await body(req);
      if (!check(String(b.current || ""), u)) return json(res, 400, { error: "Mot de passe actuel incorrect." });
      if (String(b.next || "").length < 8) return json(res, 400, { error: "8 caractères minimum." });
      Object.assign(u, hash(String(b.next))); u.sv = (u.sv || 0) + 1; save(); setCookie(res, makeSession(u), 30 * 86400); return json(res, 200, { ok: true });
    }

    if (p === "/api/admin/ical" && m === "POST") {
      const b = await body(req);
      u.icalToken = b.off ? null : crypto.randomBytes(24).toString("base64url"); save();
      return json(res, 200, { ok: true, url: u.icalToken ? `${ctx.SITE}/api/ical/${u.icalToken}.ics` : "" });
    }
    if (p === "/api/admin/stats") {
      if (u.role === "captain") return json(res, 403, { error: "forbidden" });
      const n = Math.min(400, Math.max(1, Number(url.searchParams.get("days")) || 30));
      return json(res, 200, ctx.stats ? ctx.stats(n) : { days: [] });
    }
    if (p.startsWith("/api/admin/backup")) {
      if (u.role !== "owner") return json(res, 403, { error: "forbidden" });
      if (m === "POST") return json(res, 200, { ok: await sendBackup("manual") });
      const day = new Date().toISOString().slice(0, 10);
      res.writeHead(200, { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="sare-backup-${day}.json"`, "Cache-Control": "no-store" });
      const files = backupFiles(); res.end(JSON.stringify({ exportedAt: now(), backoffice: db, requests: String(files.find(f => f.filename === "requests.jsonl")?.content || ""), payments: String(files.find(f => f.filename === "payments.jsonl")?.content || "") }));
      return true;
    }
    if (p === "/api/admin/settings" && m === "POST") {
      if (u.role !== "owner") return json(res, 403, { error: "forbidden" });
      const b = await body(req), S = db.settings;
      const pct = v => { const n = num(v); return n == null ? 0 : Math.max(0, Math.min(10, n)); };
      if (b.cardFeePct != null) S.cardFeePct = pct(b.cardFeePct);
      if (b.wireDiscountPct != null) S.wireDiscountPct = pct(b.wireDiscountPct);
      if (b.depositPct != null) S.depositPct = Math.max(0, Math.min(100, num(b.depositPct) ?? 30));
      if (b.bank) S.bank = { holder: str(b.bank.holder, 120), bank: str(b.bank.bank, 120), iban: str(b.bank.iban, 50).toUpperCase(), bic: str(b.bank.bic, 20).toUpperCase(), address: str(b.bank.address, 200) };
      if (b.company) S.company = Object.fromEntries(["name", "form", "address", "reg", "vat", "director", "phone", "email", "capital"].map(k => [k, str(b.company[k], 200)]));
      save(); return json(res, 200, { ok: true, settings: S });
    }
    // users (owner only)
    if (p.startsWith("/api/admin/users")) {
      if (u.role !== "owner") return json(res, 403, { error: "forbidden" });
      const id = p.split("/")[4], b = m === "DELETE" ? {} : await body(req);
      if (!id && m === "POST") {
        const email = String(b.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(res, 400, { error: "E-mail invalide." });
        if (db.users.some(x => x.email === email)) return json(res, 400, { error: "Cet e-mail a déjà un accès." });
        const nu = { id: uid(), email, name: str(b.name, 80), role: ROLES.includes(b.role) && b.role !== "owner" ? b.role : "captain", phone: str(b.phone, 40), active: true, invitedAt: now(), inviteToken: crypto.randomBytes(24).toString("base64url"), inviteExp: Date.now() + 7 * 864e5 };
        db.users.push(nu); save(); const sent = await inviteMail(nu, u);
        return json(res, 200, { ok: true, sent, link: `${ctx.SITE}/admin#invite=${nu.inviteToken}`, user: pubUser(nu) });
      }
      const t = db.users.find(x => x.id === id); if (!t) return json(res, 404, { error: "not found" });
      if (m === "DELETE") { if (t.id === u.id) return json(res, 400, { error: "Impossible de supprimer votre propre accès." }); db.users = db.users.filter(x => x !== t); save(); return json(res, 200, { ok: true }); }
      if (p.endsWith("/reinvite")) { t.inviteToken = crypto.randomBytes(24).toString("base64url"); t.inviteExp = Date.now() + 7 * 864e5; t.invitedAt = now(); save(); const sent = await inviteMail(t, u); return json(res, 200, { ok: true, sent, link: `${ctx.SITE}/admin#invite=${t.inviteToken}` }); }
      if (t.id !== u.id && ROLES.includes(b.role)) t.role = b.role;
      if (b.name != null) t.name = str(b.name, 80); if (b.phone != null) t.phone = str(b.phone, 40);
      if (b.active != null && t.id !== u.id) { t.active = !!b.active; t.sv = (t.sv || 0) + 1; }
      save(); return json(res, 200, { ok: true, user: pubUser(t) });
    }

    // request archive
    const ra = p.match(/^\/api\/admin\/requests\/archive$/);
    if (ra && m === "POST") {
      if (u.role === "captain") return json(res, 403, { error: "forbidden" });
      const b = await body(req); const k = str(b.key, 120);
      db.archived = b.archived ? [...new Set([...db.archived, k])] : db.archived.filter(x => x !== k); save(); return json(res, 200, { ok: true });
    }

    if (p === "/api/admin/requests/delete" && m === "POST") {
      if (u.role === "captain") return json(res, 403, { error: "forbidden" });
      const b = await body(req); db.deletedReqs = [...new Set([...db.deletedReqs, str(b.key, 120)])]; save(); return json(res, 200, { ok: true });
    }
    // booking actions
    const ba = p.match(/^\/api\/admin\/bookings\/([\w-]+)\/(deposit|sheet|confirm)$/);
    if (ba && m === "POST") {
      if (u.role === "captain") return json(res, 403, { error: "forbidden" });
      const bk = db.bookings.find(x => x.id === ba[1]); if (!bk) return json(res, 404, { error: "not found" });
      if (ba[2] === "confirm") {
        const to = String(bk.client?.email || "").trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return json(res, 400, { error: "Ajoutez l'e-mail du client." });
        if (!ctx.mailer) return json(res, 400, { error: "L'envoi d'e-mails n'est pas configuré." });
        const b = await body(req);
        const paid = (bk.payments || []).reduce((s, x) => s + (Number(x.amount) || 0), 0);
        let link = null; const pay = ctx.readPays().get("bk:" + bk.id);
        const want = num(b.deposit) ?? bk.deposit;
        const due = want > 0 && paid < want ? Math.round((want - paid) * 100) / 100 : 0;
        if (pay?.url && pay.status !== "paid" && pay.amount === due) link = { url: pay.url, amount: pay.amount, fee: pay.fee || 0, card: pay.card || pay.amount };
        if (!link && due && ctx.stripeReady()) link = await makeLink(bk, due);
        const st = db.settings, wire = due && st.bank?.iban ? { amount: Math.round(due * (1 - (Number(st.wireDiscountPct) || 0) / 100) * 100) / 100, discount: Number(st.wireDiscountPct) || 0, bank: st.bank } : null;
        if (!link && due && !wire) link = null;
        const m2 = tpl.confirmEmail(bk, link, wire, due); const att = await m2.pdf().catch(() => null);
        await ctx.mailer.sendMail({ from: ctx.MAIL_FROM, to, replyTo: ctx.NOTIFY_TO, subject: m2.subject, html: m2.html, text: m2.text, attachments: att ? [{ filename: `SARE-${bk.ref}.pdf`, content: att, contentType: "application/pdf" }] : [] });
        bk.confirmSentAt = now(); if (bk.status === "option") bk.status = "confirmed"; save();
        return json(res, 200, { ok: true, deposit: !!link, wire: !!wire });
      }
      if (ba[2] === "sheet") {
        const cap = db.users.find(x => x.id === bk.captainId); if (!cap) return json(res, 400, { error: "Aucun capitaine assigné." });
        return json(res, 200, { ok: await sheetMail(bk, cap) });
      }
      const b = await body(req); const amount = num(b.amount);
      if (!(amount > 0)) return json(res, 400, { error: "Montant invalide." });
      if (!ctx.stripeReady()) return json(res, 400, { error: "Stripe n'est pas encore configuré." });
      const link = await makeLink(bk, amount);
      return json(res, 200, { ok: true, url: link.url, card: link.card, fee: link.fee });
    }

    // generic collections
    const cm = p.match(/^\/api\/admin\/(bookings|maintenance|expenses|blocks)(?:\/([\w-]+))?$/);
    if (cm) {
      const [, coll, id] = cm;
      if (!CAN_WRITE[coll].includes(u.role)) return json(res, 403, { error: "forbidden" });
      const list = db[coll];
      if (m === "DELETE") {
        const it = list.find(x => x.id === id); if (!it) return json(res, 404, { error: "not found" });
        if (coll === "maintenance" && u.role === "captain" && it.by !== u.id) return json(res, 403, { error: "forbidden" });
        db[coll] = list.filter(x => x !== it); save(); return json(res, 200, { ok: true });
      }
      if (m === "POST") {
        const b = await body(req), clean = SAN[coll](b, u);
        let it = id && list.find(x => x.id === id);
        if (it) {
          if (coll === "maintenance" && u.role === "captain" && it.by !== u.id) return json(res, 403, { error: "forbidden" });
          Object.assign(it, clean, { updatedAt: now(), updatedBy: u.id });
        } else {
          it = { id: uid(), ...clean, createdAt: now(), by: u.id };
          if (coll === "bookings") it.ref = "SARE-" + crypto.randomBytes(3).toString("hex").toUpperCase();
          list.push(it);
          if (coll === "bookings" && it.requestKey) db.archived = [...new Set([...db.archived, it.requestKey])];
        }
        save(); return json(res, 200, { ok: true, item: coll === "bookings" ? viewBooking(it, u) : it });
      }
    }
    return json(res, 404, { error: "not found" });
  } catch (e) { console.error("admin", e.message); return json(res, 500, { error: e.message }); }
}
