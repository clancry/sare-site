// Generates the tender spec sheet PDFs (EN, FR) from the site's i18n files.
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.join(here, "..", "..");
const IMG0 = path.join(ROOT, "site", "img");
import { execFileSync } from "node:child_process";
const TMP = path.join(here, ".pdfimg"); fs.mkdirSync(TMP, { recursive: true });
const small = f => { const o = path.join(TMP, f); if (!fs.existsSync(o)) execFileSync("python3", ["-c", `from PIL import Image;im=Image.open("${path.join(IMG0, f)}");im.thumbnail((1400,1400));im.convert("RGB").save("${o}",quality=80)`]); return o; };
const FD = path.join(here, "..", "fonts");
const OUT = path.join(here, "..", "public", "docs");
const LBL = {
  en: { doc: "Superyacht tender · Spec sheet", specs: "The boat", aboard: "On board", missions: "What we do for your yacht", how: "How it works", terms: "Rate", contact: "Your handlers", req: "Request the tender", foot: "Available for the winter season in Sint Maarten, Saint-Barth and Anguilla." },
  fr: { doc: "Tender pour superyacht · Fiche technique", specs: "Le bateau", aboard: "À bord", missions: "Ce que nous faisons pour votre yacht", how: "Le principe", terms: "Tarif", contact: "Vos interlocuteurs", req: "Demander le tender", foot: "Disponible pour la saison d'hiver à Saint-Martin, Saint-Barth et Anguilla." },
};
const C = { hull: "#25252c", slate: "#54677f", mist: "#c8ccdb", muted: "#7a7d86", line: "#dcdad3", paper: "#f5f3ef" };
for (const l of ["en", "fr"]) {
  const d = JSON.parse(fs.readFileSync(path.join(ROOT, "i18n", l + ".json"), "utf8")), t = d.tender, y = d.yacht, L = LBL[l];
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: "SARE · " + L.doc, Author: "SARE Caribbean Breeze" } });
  doc.registerFont("S", path.join(FD, "DejaVuSans.ttf")); doc.registerFont("SB", path.join(FD, "DejaVuSans-Bold.ttf")); doc.registerFont("R", path.join(FD, "DejaVuSerif.ttf"));
  const file = path.join(OUT, `SARE-Tender-${l.toUpperCase()}.pdf`); doc.pipe(fs.createWriteStream(file));
  const W = doc.page.width, H = doc.page.height, M = 46;
  const eyebrow = (s, x, yy, col = C.slate) => doc.fillColor(col).font("SB").fontSize(7.5).text(s.toUpperCase(), x, yy, { characterSpacing: 1.8 });
  // ---- page 1
  doc.rect(0, 0, W, 92).fill(C.hull);
  doc.fillColor("#f1efea").font("R").fontSize(26).text("S A R E", M, 26);
  doc.fillColor(C.mist).font("S").fontSize(7).text("CARIBBEAN BREEZE", M, 62, { characterSpacing: 2.4 });
  doc.fillColor(C.mist).font("S").fontSize(8.5).text(L.doc, W - M - 260, 40, { width: 260, align: "right" });
  doc.save().rect(0, 92, W, 262).clip().image(small("p-profile-wide.jpg"), 0, 92, { cover: [W, 262], align: "center", valign: "center" }).restore();
  let yy = 374;
  eyebrow(t.eyebrow, M, yy); yy += 16;
  doc.fillColor(C.hull).font("R").fontSize(22).text(t.title, M, yy, { width: W - 2 * M }); yy = doc.y + 8;
  doc.fillColor("#3b3e46").font("S").fontSize(9.5).text(t.hook + " " + t.intro, M, yy, { width: W - 2 * M, lineGap: 2 }); yy = doc.y + 16;
  // specs grid
  eyebrow(L.specs, M, yy); yy += 14; doc.moveTo(M, yy).lineTo(W - M, yy).lineWidth(.6).strokeColor(C.line).stroke(); yy += 8;
  const cw = (W - 2 * M) / 4;
  y.specs.forEach(([k, v, u], i) => { const x = M + (i % 4) * cw, r = yy + Math.floor(i / 4) * 46;
    doc.fillColor(C.muted).font("S").fontSize(7).text(k.toUpperCase(), x, r, { characterSpacing: 1.2 });
    doc.fillColor(C.hull).font("R").fontSize(15).text(v, x, r + 10, { width: cw - 8 });
    doc.fillColor(C.muted).font("S").fontSize(7.5).text(u, x, r + 29, { width: cw - 8 }); });
  yy += 98;
  // two columns: how it works / rate
  const colW = (W - 2 * M - 24) / 2;
  eyebrow(L.how, M, yy); eyebrow(L.terms, M + colW + 24, yy); yy += 14;
  let ly = yy;
  for (const [h, x] of t.how.slice(0, 4)) { doc.fillColor(C.hull).font("SB").fontSize(8.5).text(h, M, ly, { width: colW }); ly = doc.y + 1; doc.fillColor("#3b3e46").font("S").fontSize(8).text(x, M, ly, { width: colW, lineGap: 1 }); ly = doc.y + 7; }
  let ry = yy;
  for (const [k, v] of t.terms) { doc.fillColor(C.hull).font("S").fontSize(8.5).text(k, M + colW + 24, ry, { width: colW - 100 }); const ka = doc.y; doc.fillColor(C.slate).font("SB").fontSize(8).text(v, M + colW + 24 + colW - 95, ry, { width: 95, align: "right" }); ry = Math.max(doc.y, ka, ry + 12) + 6; doc.moveTo(M + colW + 24, ry - 3).lineTo(W - M, ry - 3).lineWidth(.4).strokeColor(C.line).stroke(); }
  ry += 8; doc.fillColor(C.muted).font("S").fontSize(7.5).text(t.asideNote || "", M + colW + 24, ry, { width: colW });
  // footer
  doc.rect(0, H - 40, W, 40).fill(C.paper);
  doc.fillColor(C.muted).font("S").fontSize(7.5).text("SARE · Caribbean Breeze · Porto Cupecoy, Sint Maarten · contact@sare-exclusive.com · www.sare-exclusive.com", M, H - 25, { width: W - 2 * M, align: "center" });
  // ---- page 2
  doc.addPage({ size: "A4", margin: 0 });
  const ph = (f, x, y0, w, h) => doc.save().rect(x, y0, w, h).clip().image(small(f), x, y0, { cover: [w, h], align: "center", valign: "center" }).restore();
  ph("p-stern-portrait.jpg", 0, 0, W * 0.42, 330); ph("p-bow-lounge.jpg", W * 0.42 + 4, 0, W * 0.58 - 4, 163); ph("p-engines.jpg", W * 0.42 + 4, 167, W * 0.58 - 4, 163);
  yy = 352; eyebrow(L.missions, M, yy); yy += 14; doc.moveTo(M, yy).lineTo(W - M, yy).lineWidth(.6).strokeColor(C.line).stroke(); yy += 10;
  const mw = (W - 2 * M - 24) / 2; let c1 = yy, c2 = yy;
  t.missions.forEach(([h, x], i) => { const left = i % 2 === 0, X = left ? M : M + mw + 24, Y = left ? c1 : c2;
    doc.fillColor(C.hull).font("R").fontSize(11).text(h, X, Y, { width: mw }); let ny = doc.y + 2; doc.fillColor("#3b3e46").font("S").fontSize(8).text(x, X, ny, { width: mw, lineGap: 1 }); ny = doc.y + 10;
    if (left) c1 = ny; else c2 = ny; });
  yy = Math.max(c1, c2) + 6;
  eyebrow(L.aboard, M, yy); yy += 14; doc.moveTo(M, yy).lineTo(W - M, yy).lineWidth(.6).strokeColor(C.line).stroke(); yy += 8;
  y.onboard.forEach((x, i) => { const X = M + (i % 2) * (mw + 24), Y = yy + Math.floor(i / 2) * 16; doc.fillColor(C.slate).font("S").fontSize(8.5).text("—  ", X, Y, { continued: true }).fillColor("#3b3e46").text(x); });
  yy += Math.ceil(y.onboard.length / 2) * 16 + 18;
  // contact band
  doc.rect(M, yy, W - 2 * M, 96).fill(C.hull);
  eyebrow(L.contact, M + 20, yy + 16, C.mist);
  doc.fillColor("#f1efea").font("R").fontSize(13).text("Cédric  +1 954 955 1740", M + 20, yy + 32).text("Rebecca  +1 954 661 4414", M + 20, yy + 52);
  doc.fillColor(C.mist).font("S").fontSize(8).text("WhatsApp · contact@sare-exclusive.com", M + 20, yy + 74);
  doc.fillColor("#f1efea").font("SB").fontSize(8).text(L.req.toUpperCase(), W - M - 220, yy + 34, { width: 200, align: "right", characterSpacing: 1.5 });
  doc.fillColor(C.mist).font("S").fontSize(9).text("www.sare-exclusive.com/" + (l === "fr" ? "fr/" : "") + "tender-yacht", W - M - 220, yy + 50, { width: 200, align: "right", link: "https://www.sare-exclusive.com/" + (l === "fr" ? "fr/" : "") + "tender-yacht" });
  doc.fillColor(C.muted).font("S").fontSize(7.5).text(L.foot, M, yy + 108, { width: W - 2 * M, align: "center" });
  doc.end();
  console.log("written", file);
}
