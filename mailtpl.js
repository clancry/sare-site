// Pretty notification e-mail (HTML) + PDF request sheet for SARE
import PDFDocument from "pdfkit";
import path from "node:path";
const FD = path.join(path.dirname(new URL(import.meta.url).pathname), "fonts");

const LANG_NAMES = { en: "English", fr: "Français", es: "Español", ru: "Русский", pt: "Português", nl: "Nederlands" };
const eur = n => n == null || n === "" ? "" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n)).replace(/[\u202f\u00a0]/g, " ");
const fdate = d => { if (!d) return ""; const x = new Date(d + (String(d).length <= 10 ? "T12:00:00" : "")); return isNaN(x) ? String(d) : x.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const list = v => Array.isArray(v) ? v.filter(Boolean).join(", ") : (v || "");

export function rows(r) {
  const contact = r.email || r.contact || "";
  if (r.type === "tender") return {
    title: "Demande · Tender yacht",
    groups: [
      ["Client", [["Nom", r.name], ["Rôle", r.role], ["Contact", contact], ["Langue", LANG_NAMES[r.lang] || r.lang]]],
      ["Yacht", [["Yacht", r.yacht], ["Longueur", r.length ? r.length + " m" : ""], ["Mouillage", r.anchor]]],
      ["Période", [["Du", fdate(r.from)], ["Au", fdate(r.to)], ["Invités", r.guests]]],
      ["Services", [["Demandés", list(r.services)], ["Message", r.notes]]],
    ],
  };
  return {
    title: "Demande · Day charter",
    groups: [
      ["Client", [["Nom", r.name], ["Contact", contact], ["Langue", LANG_NAMES[r.lang] || r.lang]]],
      ["Sortie", [["Formule", r.formula], ["Date", fdate(r.date)], ["Invités", r.guests], ["Départ", r.port === "Pick-up requested" ? "Prise en charge demandée" : r.port], ["Occasion", r.occasion]]],
      ["Options & tarif", [["Options", list(r.options)], ["Estimation", eur(r.estimate)], ["Message", r.notes]]],
    ],
  };
}

export function html(r, site) {
  const { title, groups } = rows(r);
  const contact = r.email || r.contact || "";
  const tel = String(r.contact || "").replace(/[^\d+]/g, "");
  const btn = (href, label, dark) => `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 20px;font:600 11px/1 Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;${dark ? "background:#25252c;color:#f1efea" : "border:1px solid #25252c;color:#25252c"}">${label}</a>`;
  const actions = [
    /@/.test(contact) ? btn(`mailto:${contact}?subject=${encodeURIComponent("SARE · Votre demande " + r.ref)}`, "Répondre", true) : "",
    tel.length > 6 ? btn(`https://wa.me/${tel.replace(/\D/g, "")}`, "WhatsApp", !/@/.test(contact)) : "",
    btn(site + "/admin", "Toutes les demandes"),
  ].join("");
  const sec = groups.map(([h, items]) => {
    const tr = items.filter(([, v]) => v !== "" && v != null).map(([k, v]) => `<tr><td style="padding:9px 0;width:130px;color:#7a7d86;font:12px Arial,sans-serif;vertical-align:top">${esc(k)}</td><td style="padding:9px 0;color:#25252c;font:15px Arial,sans-serif;vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
    return tr ? `<tr><td style="padding:26px 0 6px;font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#54677f;border-bottom:1px solid #dcdad3">${esc(h)}</td></tr><tr><td><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${tr}</table></td></tr>` : "";
  }).join("");
  const big = r.type === "tender" ? `${fdate(r.from)}${r.to ? " → " + fdate(r.to) : ""}` : `${r.formula || ""} · ${fdate(r.date)}`;
  return `<!doctype html><html><body style="margin:0;background:#efede8;padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#25252c;padding:28px 36px"><div style="font:300 30px Georgia,serif;letter-spacing:.12em;color:#f1efea">SARE</div><div style="font:10px Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#c8ccdb;margin-top:4px">Caribbean Breeze</div></td></tr>
<tr><td style="padding:32px 36px 8px"><div style="font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#54677f">${esc(title)} · ${esc(r.ref || "")}</div>
<div style="font:300 28px/1.25 Georgia,serif;color:#25252c;margin-top:12px">${esc(r.name || "")}</div>
<div style="font:16px Arial,sans-serif;color:#54677f;margin-top:6px">${esc(big)}</div>
${r.estimate ? `<div style="font:300 24px Georgia,serif;color:#25252c;margin-top:14px">${eur(r.estimate)} <span style="font:11px Arial,sans-serif;color:#7a7d86;letter-spacing:.1em;text-transform:uppercase">estimation</span></div>` : ""}
<div style="margin-top:22px">${actions}</div></td></tr>
<tr><td style="padding:0 36px 32px"><table width="100%" cellpadding="0" cellspacing="0">${sec}</table></td></tr>
<tr><td style="background:#f5f3ef;padding:18px 36px;font:11px Arial,sans-serif;color:#7a7d86">Reçue le ${esc(new Date(r.receivedAt).toLocaleString("fr-FR", { timeZone: "America/Martinique" }))} · fiche PDF jointe · sare-exclusive.com</td></tr>
</table></td></tr></table></body></html>`;
}

export function text(r) {
  const { title, groups } = rows(r);
  return `${title} · ${r.ref}\n\n` + groups.map(([h, items]) => `${h.toUpperCase()}\n` + items.filter(([, v]) => v !== "" && v != null).map(([k, v]) => `  ${k} : ${v}`).join("\n")).join("\n\n");
}

export function pdf(r) {
  return new Promise(resolve => {
    const { title, groups } = rows(r);
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `SARE ${r.ref}` } });
    doc.registerFont("Sans", path.join(FD, "DejaVuSans.ttf")); doc.registerFont("SansB", path.join(FD, "DejaVuSans-Bold.ttf")); doc.registerFont("Serif", path.join(FD, "DejaVuSerif.ttf"));
    const bufs = []; doc.on("data", b => bufs.push(b)); doc.on("end", () => resolve(Buffer.concat(bufs)));
    const W = doc.page.width, M = 56;
    doc.rect(0, 0, W, 110).fill("#25252c");
    doc.fillColor("#f1efea").font("Serif").fontSize(32).text("S A R E", M, 34);
    doc.fillColor("#c8ccdb").font("Sans").fontSize(8).text("CARIBBEAN BREEZE", M, 74, { characterSpacing: 2.5 });
    doc.fillColor("#c8ccdb").fontSize(9).text(r.ref || "", W - M - 200, 40, { width: 200, align: "right" });
    doc.text(new Date(r.receivedAt).toLocaleDateString("fr-FR"), W - M - 200, 56, { width: 200, align: "right" });
    let y = 140;
    doc.fillColor("#54677f").font("SansB").fontSize(8).text(title.toUpperCase(), M, y, { characterSpacing: 2 }); y += 20;
    doc.fillColor("#25252c").font("Serif").fontSize(26).text(r.name || "", M, y); y += 36;
    const big = r.type === "tender" ? `${fdate(r.from)}${r.to ? "  →  " + fdate(r.to) : ""}` : `${r.formula || ""}  ·  ${fdate(r.date)}`;
    doc.fillColor("#54677f").font("Sans").fontSize(12).text(big, M, y); y += 22;
    if (r.estimate) { doc.fillColor("#25252c").font("Serif").fontSize(20).text(eur(r.estimate), M, y); const w = doc.widthOfString(eur(r.estimate)); doc.font("Sans").fontSize(8).fillColor("#7a7d86").text("ESTIMATION", M + w + 10, y + 9, { characterSpacing: 1.5 }); y += 32; }
    for (const [h, items] of groups) {
      const it = items.filter(([, v]) => v !== "" && v != null); if (!it.length) continue;
      y += 14; doc.fillColor("#54677f").font("SansB").fontSize(8).text(h.toUpperCase(), M, y, { characterSpacing: 2 }); y += 14;
      doc.moveTo(M, y).lineTo(W - M, y).lineWidth(.6).strokeColor("#dcdad3").stroke(); y += 10;
      for (const [k, v] of it) {
        doc.fillColor("#7a7d86").font("Sans").fontSize(9).text(k, M, y, { width: 110 });
        const hgt = doc.font("Sans").fontSize(11).heightOfString(String(v), { width: W - M * 2 - 120 });
        doc.fillColor("#25252c").text(String(v), M + 120, y - 1, { width: W - M * 2 - 120 }); y += Math.max(18, hgt + 8);
      }
    }
    doc.rect(0, doc.page.height - 50, W, 50).fill("#f5f3ef");
    doc.fillColor("#7a7d86").font("Sans").fontSize(8).text("SARE Caribbean Breeze · Porto Cupecoy, Sint Maarten · contact@sare-exclusive.com · sare-exclusive.com", M, doc.page.height - 30, { width: W - M * 2, align: "center" });
    doc.end();
  });
}
