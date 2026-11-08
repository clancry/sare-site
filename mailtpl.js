// Pretty notification e-mail (HTML) + PDF request sheet for SARE
import PDFDocument from "pdfkit";
import path from "node:path";
const FD = path.join(path.dirname(new URL(import.meta.url).pathname), "fonts");


const T = {
  fr: { loc:"fr-FR", charter:"Demande · Day charter", tender:"Demande · Tender yacht", client:"Client", name:"Nom", role:"Rôle", contact:"Contact", lang:"Langue", yacht:"Yacht", length:"Longueur", anchor:"Mouillage", period:"Période", from:"Du", to:"Au", guests:"Invités", services:"Services", asked:"Demandés", msg:"Message", outing:"Sortie", formula:"Formule", date:"Date", dep:"Départ", occ:"Occasion", opts:"Options & tarif", options:"Options", est:"Estimation", pickup:"Prise en charge demandée",
    subj:"Votre demande SARE est bien reçue", hello:"Bonjour", thanks:"Merci pour votre demande. Nous l'avons bien reçue et nous revenons vers vous très rapidement, en général dans les heures qui suivent, pour confirmer la disponibilité et finaliser les détails.", recap:"Récapitulatif", estNote:"Estimation indicative. Le devis définitif vous sera confirmé par votre handler.", next:"Et maintenant ?", steps:["Nous vérifions la disponibilité du bateau et d'un capitaine de notre flotte.","Cédric ou Rebecca vous contacte pour affiner votre journée.","Une fois validée, nous vous envoyons le lien de réservation."], reach:"Une question ? Vos handlers sont joignables directement :", pdf:"Votre récapitulatif est joint en PDF.", sign:"À très bientôt en mer,", team:"L'équipe SARE" },
  en: { loc:"en-US", charter:"Request · Day charter", tender:"Request · Tender yacht", client:"Guest", name:"Name", role:"Role", contact:"Contact", lang:"Language", yacht:"Yacht", length:"Length", anchor:"Anchorage", period:"Period", from:"From", to:"To", guests:"Guests", services:"Services", asked:"Requested", msg:"Message", outing:"Your day", formula:"Experience", date:"Date", dep:"Departure", occ:"Occasion", opts:"Options & rate", options:"Options", est:"Estimate", pickup:"Pick-up requested",
    subj:"Your SARE request has been received", hello:"Dear", thanks:"Thank you for your request. We have received it and will be back to you very shortly, usually within a few hours, to confirm availability and finalise the details.", recap:"Summary", estNote:"Indicative estimate. Your final quote will be confirmed by your handler.", next:"What happens next", steps:["We check the availability of the boat and a captain from our fleet.","Cédric or Rebecca contacts you to tailor your day.","Once confirmed, we send you the booking link."], reach:"Any question? Your handlers are reachable directly:", pdf:"Your summary is attached as a PDF.", sign:"See you soon at sea,", team:"The SARE team" },
  es: { loc:"es-ES", charter:"Solicitud · Charter de día", tender:"Solicitud · Tender yacht", client:"Cliente", name:"Nombre", role:"Cargo", contact:"Contacto", lang:"Idioma", yacht:"Yate", length:"Eslora", anchor:"Fondeo", period:"Periodo", from:"Desde", to:"Hasta", guests:"Invitados", services:"Servicios", asked:"Solicitados", msg:"Mensaje", outing:"Su día", formula:"Fórmula", date:"Fecha", dep:"Salida", occ:"Ocasión", opts:"Opciones y tarifa", options:"Opciones", est:"Estimación", pickup:"Recogida solicitada",
    subj:"Hemos recibido su solicitud SARE", hello:"Estimado/a", thanks:"Gracias por su solicitud. La hemos recibido y le responderemos muy pronto, normalmente en pocas horas, para confirmar la disponibilidad y concretar los detalles.", recap:"Resumen", estNote:"Estimación orientativa. Su handler le confirmará el presupuesto definitivo.", next:"¿Y ahora?", steps:["Comprobamos la disponibilidad del barco y de un capitán de nuestra flota.","Cédric o Rebecca se pone en contacto para preparar su día.","Una vez confirmado, le enviamos el enlace de reserva."], reach:"¿Alguna pregunta? Puede contactar directamente con sus handlers:", pdf:"Adjuntamos su resumen en PDF.", sign:"Hasta pronto en el mar,", team:"El equipo SARE" },
  ru: { loc:"ru-RU", charter:"Запрос · Дневная прогулка", tender:"Запрос · Тендер", client:"Гость", name:"Имя", role:"Должность", contact:"Контакт", lang:"Язык", yacht:"Яхта", length:"Длина", anchor:"Стоянка", period:"Период", from:"С", to:"По", guests:"Гости", services:"Услуги", asked:"Запрошено", msg:"Сообщение", outing:"Ваш день", formula:"Формат", date:"Дата", dep:"Отправление", occ:"Повод", opts:"Опции и цена", options:"Опции", est:"Оценка", pickup:"Запрошен трансфер",
    subj:"Ваш запрос в SARE получен", hello:"Здравствуйте,", thanks:"Спасибо за ваш запрос. Мы его получили и очень скоро свяжемся с вами, обычно в течение нескольких часов, чтобы подтвердить наличие и уточнить детали.", recap:"Сводка", estNote:"Ориентировочная оценка. Окончательную стоимость подтвердит ваш менеджер.", next:"Что дальше?", steps:["Мы проверяем наличие катера и капитана из нашей команды.","Седрик или Ребекка свяжется с вами, чтобы продумать ваш день.","После подтверждения мы пришлём ссылку для бронирования."], reach:"Есть вопросы? Ваши менеджеры на связи:", pdf:"Сводка во вложении в формате PDF.", sign:"До встречи в море,", team:"Команда SARE" },
  pt: { loc:"pt-BR", charter:"Solicitação · Passeio de um dia", tender:"Solicitação · Tender yacht", client:"Cliente", name:"Nome", role:"Função", contact:"Contato", lang:"Idioma", yacht:"Iate", length:"Comprimento", anchor:"Ancoragem", period:"Período", from:"De", to:"Até", guests:"Convidados", services:"Serviços", asked:"Solicitados", msg:"Mensagem", outing:"Seu dia", formula:"Fórmula", date:"Data", dep:"Partida", occ:"Ocasião", opts:"Opções e valor", options:"Opções", est:"Estimativa", pickup:"Busca solicitada",
    subj:"Recebemos sua solicitação SARE", hello:"Olá", thanks:"Obrigado pela sua solicitação. Nós a recebemos e responderemos muito em breve, normalmente em poucas horas, para confirmar a disponibilidade e acertar os detalhes.", recap:"Resumo", estNote:"Estimativa indicativa. O orçamento final será confirmado pelo seu handler.", next:"E agora?", steps:["Verificamos a disponibilidade do barco e de um capitão da nossa frota.","Cédric ou Rebecca entra em contato para preparar o seu dia.","Após a confirmação, enviamos o link de reserva."], reach:"Alguma dúvida? Fale diretamente com seus handlers:", pdf:"Seu resumo está anexado em PDF.", sign:"Até breve no mar,", team:"Equipe SARE" },
  nl: { loc:"nl-NL", charter:"Aanvraag · Dagcharter", tender:"Aanvraag · Tender yacht", client:"Gast", name:"Naam", role:"Functie", contact:"Contact", lang:"Taal", yacht:"Jacht", length:"Lengte", anchor:"Ankerplaats", period:"Periode", from:"Van", to:"Tot", guests:"Gasten", services:"Diensten", asked:"Gevraagd", msg:"Bericht", outing:"Uw dag", formula:"Formule", date:"Datum", dep:"Vertrek", occ:"Gelegenheid", opts:"Opties & tarief", options:"Opties", est:"Schatting", pickup:"Ophalen gevraagd",
    subj:"Uw SARE-aanvraag is ontvangen", hello:"Beste", thanks:"Dank u voor uw aanvraag. We hebben die ontvangen en nemen zeer snel contact met u op, meestal binnen enkele uren, om de beschikbaarheid te bevestigen en de details af te ronden.", recap:"Overzicht", estNote:"Indicatieve schatting. Uw handler bevestigt de definitieve offerte.", next:"Hoe nu verder?", steps:["We controleren de beschikbaarheid van de boot en een kapitein uit onze vloot.","Cédric of Rebecca neemt contact op om uw dag samen te stellen.","Na bevestiging sturen we u de boekingslink."], reach:"Vragen? Uw handlers zijn direct bereikbaar:", pdf:"Uw overzicht is als pdf bijgevoegd.", sign:"Tot snel op zee,", team:"Het SARE-team" },
};
const HANDLERS = [["Cédric", "+1 954 955 1740"], ["Rebecca", "+1 954 661 4414"]];
const tl = l => T[l] || T.en;
const LANG_NAMES = { en: "English", fr: "Français", es: "Español", ru: "Русский", pt: "Português", nl: "Nederlands" };
const eur = n => n == null || n === "" ? "" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(n)).replace(/[\u202f\u00a0]/g, " ");
const fdate = (d, loc = "fr-FR") => { if (!d) return ""; const x = new Date(d + (String(d).length <= 10 ? "T12:00:00" : "")); return isNaN(x) ? String(d) : x.toLocaleDateString(loc, { weekday: "long", day: "numeric", month: "long", year: "numeric" }); };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const list = v => Array.isArray(v) ? v.filter(Boolean).join(", ") : (v || "");

export function rows(r, l = "fr") {
  const t = tl(l), fd = d => fdate(d, t.loc);
  const contact = r.email || r.contact || "";
  if (r.type === "tender") return {
    title: t.tender,
    groups: [
      [t.client, [[t.name, r.name], [t.role, r.role], [t.contact, contact], [t.lang, LANG_NAMES[r.lang] || r.lang]]],
      [t.yacht, [[t.yacht, r.yacht], [t.length, r.length ? r.length + " m" : ""], [t.anchor, r.anchor]]],
      [t.period, [[t.from, fd(r.from)], [t.to, fd(r.to)], [t.guests, r.guests]]],
      [t.services, [[t.asked, list(r.services)], [t.msg, r.notes]]],
    ], big: `${fd(r.from)}${r.to ? "  →  " + fd(r.to) : ""}`,
  };
  return {
    title: t.charter,
    groups: [
      [t.client, [[t.name, r.name], [t.contact, contact], [t.lang, LANG_NAMES[r.lang] || r.lang]]],
      [t.outing, [[t.formula, r.formula], [t.date, fd(r.date)], [t.guests, r.guests], [t.dep, r.port === "Pick-up requested" ? t.pickup : r.port], [t.occ, r.occasion]]],
      [t.opts, [[t.options, list(r.options)], [t.est, eur(r.estimate)], [t.msg, r.notes]]],
    ], big: `${r.formula || ""}  ·  ${fd(r.date)}`,
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
  const big = rows(r).big;
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

export function pdf(r, l = "fr", titleOverride) {
  return new Promise(resolve => {
    const rr = rows(r, l), groups = rr.groups, big = rr.big, title = titleOverride || rr.title, t = tl(l);
    const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `SARE ${r.ref}` } });
    doc.registerFont("Sans", path.join(FD, "DejaVuSans.ttf")); doc.registerFont("SansB", path.join(FD, "DejaVuSans-Bold.ttf")); doc.registerFont("Serif", path.join(FD, "DejaVuSerif.ttf"));
    const bufs = []; doc.on("data", b => bufs.push(b)); doc.on("end", () => resolve(Buffer.concat(bufs)));
    const W = doc.page.width, M = 56;
    doc.rect(0, 0, W, 110).fill("#25252c");
    doc.fillColor("#f1efea").font("Serif").fontSize(32).text("S A R E", M, 34);
    doc.fillColor("#c8ccdb").font("Sans").fontSize(8).text("CARIBBEAN BREEZE", M, 74, { characterSpacing: 2.5 });
    doc.fillColor("#c8ccdb").fontSize(9).text(r.ref || "", W - M - 200, 40, { width: 200, align: "right" });
    doc.text(new Date(r.receivedAt).toLocaleDateString(t.loc), W - M - 200, 56, { width: 200, align: "right" });
    let y = 140;
    doc.fillColor("#54677f").font("SansB").fontSize(8).text(title.toUpperCase(), M, y, { characterSpacing: 2 }); y += 20;
    doc.fillColor("#25252c").font("Serif").fontSize(26).text(r.name || "", M, y); y += 36;
    doc.fillColor("#54677f").font("Sans").fontSize(12).text(big, M, y); y += 22;
    if (r.estimate) { doc.fillColor("#25252c").font("Serif").fontSize(20).text(eur(r.estimate), M, y); const w = doc.widthOfString(eur(r.estimate)); doc.font("Sans").fontSize(8).fillColor("#7a7d86").text(t.est.toUpperCase(), M + w + 10, y + 9, { characterSpacing: 1.5 }); y += 32; }
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

export function clientHtml(r) {
  const l = T[r.lang] ? r.lang : "en", t = tl(l), { groups, big } = rows(r, l);
  const first = String(r.name || "").trim().split(/\s+/)[0] || "";
  const sec = groups.filter(([h]) => h !== t.client).map(([h, items]) => {
    const tr = items.filter(([, v]) => v !== "" && v != null).map(([k, v]) => `<tr><td style="padding:8px 0;width:130px;color:#7a7d86;font:12px Arial,sans-serif;vertical-align:top">${esc(k)}</td><td style="padding:8px 0;color:#25252c;font:15px Arial,sans-serif;vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
    return tr ? `<tr><td style="padding:22px 0 6px;font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#54677f;border-bottom:1px solid #dcdad3">${esc(h)}</td></tr><tr><td><table width="100%" cellpadding="0" cellspacing="0">${tr}</table></td></tr>` : "";
  }).join("");
  const hs = HANDLERS.map(([n, p]) => `<a href="https://wa.me/${p.replace(/\D/g, "")}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 18px;border:1px solid #25252c;color:#25252c;text-decoration:none;font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">${n} · WhatsApp</a>`).join("");
  return `<!doctype html><html lang="${l}"><body style="margin:0;background:#efede8;padding:24px 12px">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#25252c;padding:28px 36px"><div style="font:300 30px Georgia,serif;letter-spacing:.12em;color:#f1efea">SARE</div><div style="font:10px Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#c8ccdb;margin-top:4px">Caribbean Breeze</div></td></tr>
<tr><td style="padding:34px 36px 6px">
<div style="font:300 26px/1.3 Georgia,serif;color:#25252c">${esc(t.hello)} ${esc(first)},</div>
<p style="font:15px/1.7 Arial,sans-serif;color:#3b3e46;margin:16px 0 0">${esc(t.thanks)}</p>
<div style="margin-top:26px;padding:20px 22px;background:#f5f3ef"><div style="font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#54677f">${esc(t.recap)} · ${esc(r.ref || "")}</div>
<div style="font:300 20px Georgia,serif;color:#25252c;margin-top:8px">${esc(big)}</div>
${r.estimate ? `<div style="font:300 22px Georgia,serif;color:#25252c;margin-top:8px">${eur(r.estimate)}</div><div style="font:12px Arial,sans-serif;color:#7a7d86;margin-top:4px">${esc(t.estNote)}</div>` : ""}</div>
</td></tr>
<tr><td style="padding:0 36px"><table width="100%" cellpadding="0" cellspacing="0">${sec}</table></td></tr>
<tr><td style="padding:28px 36px 6px"><div style="font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#54677f">${esc(t.next)}</div>
<ol style="font:14px/1.7 Arial,sans-serif;color:#3b3e46;padding-left:18px;margin:10px 0 0">${t.steps.map(x => `<li>${esc(x)}</li>`).join("")}</ol></td></tr>
<tr><td style="padding:22px 36px 8px"><p style="font:14px/1.6 Arial,sans-serif;color:#3b3e46;margin:0 0 12px">${esc(t.reach)}</p>${hs}</td></tr>
<tr><td style="padding:14px 36px 34px"><p style="font:14px/1.6 Arial,sans-serif;color:#3b3e46;margin:0">${esc(t.sign)}<br><span style="font:300 18px Georgia,serif;color:#25252c">${esc(t.team)}</span></p><p style="font:12px Arial,sans-serif;color:#7a7d86;margin:16px 0 0">${esc(t.pdf)}</p></td></tr>
<tr><td style="background:#25252c;padding:18px 36px;font:11px Arial,sans-serif;color:#c8ccdb">SARE · Caribbean Breeze · Porto Cupecoy, Sint Maarten · <a href="https://www.sare-exclusive.com" style="color:#c8ccdb">sare-exclusive.com</a></td></tr>
</table></td></tr></table></body></html>`;
}
export function clientText(r) {
  const l = T[r.lang] ? r.lang : "en", t = tl(l), { big } = rows(r, l);
  return `${t.hello} ${String(r.name || "").split(" ")[0]},\n\n${t.thanks}\n\n${t.recap} · ${r.ref}\n${big}${r.estimate ? "\n" + eur(r.estimate) + " — " + t.estNote : ""}\n\n${t.next}\n${t.steps.map((x, i) => `${i + 1}. ${x}`).join("\n")}\n\n${t.reach}\n${HANDLERS.map(([n, p]) => `${n}: ${p}`).join("\n")}\n\n${t.sign}\n${t.team}`;
}
export const clientSubject = r => `${tl(r.lang).subj} · ${r.ref || ""}`;

/* ---------- booking confirmation (sent from the back office) ---------- */
const C = {
  en: { subj: "Your SARE booking is confirmed", title: "Booking confirmed", hello: "Dear", intro: "We are delighted to confirm your booking. Here is everything you need for a perfect day at sea.", when: "Date", hours: "Times", pickup: "Meeting point", guests: "Guests", occ: "Occasion", opts: "Options", total: "Total", paid: "Already paid", due: "Remaining", depTitle: "Secure your booking", depText: "To finalise, please pay the deposit through our secure payment link (card, Apple Pay, Google Pay).", depBtn: "Pay the deposit", depAmt: "Deposit", balance: "The balance is settled before departure.", bring: "To bring: passports for every guest if we leave Sint Maarten waters, swimwear, sunscreen. Everything else is on board.", weather: "The day before, your captain will call you to confirm the time, the meeting point and the weather.", sign: "See you very soon at sea,", team: "The SARE team", pdfTitle: "Booking confirmation" },
  fr: { subj: "Votre réservation SARE est confirmée", title: "Réservation confirmée", hello: "Bonjour", intro: "Nous avons le plaisir de confirmer votre réservation. Voici tout ce qu'il faut savoir pour une journée parfaite en mer.", when: "Date", hours: "Horaires", pickup: "Lieu de rendez-vous", guests: "Invités", occ: "Occasion", opts: "Options", total: "Total", paid: "Déjà réglé", due: "Reste à régler", depTitle: "Bloquez votre réservation", depText: "Pour finaliser, merci de régler l'acompte via notre lien de paiement sécurisé (carte, Apple Pay, Google Pay).", depBtn: "Régler l'acompte", depAmt: "Acompte", balance: "Le solde est réglé avant le départ.", bring: "À prévoir : les passeports de tous les invités si nous quittons les eaux de Saint-Martin, maillots, crème solaire. Tout le reste est à bord.", weather: "La veille, votre capitaine vous appelle pour confirmer l'heure, le lieu de rendez-vous et la météo.", sign: "À très bientôt en mer,", team: "L'équipe SARE", pdfTitle: "Confirmation de réservation" },
  es: { subj: "Su reserva SARE está confirmada", title: "Reserva confirmada", hello: "Estimado/a", intro: "Nos complace confirmar su reserva. Aquí tiene todo lo necesario para un día perfecto en el mar.", when: "Fecha", hours: "Horario", pickup: "Punto de encuentro", guests: "Invitados", occ: "Ocasión", opts: "Opciones", total: "Total", paid: "Ya pagado", due: "Pendiente", depTitle: "Asegure su reserva", depText: "Para finalizar, abone el depósito mediante nuestro enlace de pago seguro (tarjeta, Apple Pay, Google Pay).", depBtn: "Pagar el depósito", depAmt: "Depósito", balance: "El saldo se abona antes de la salida.", bring: "Traiga: pasaportes de todos los invitados si salimos de aguas de Sint Maarten, bañador y protector solar. Todo lo demás está a bordo.", weather: "La víspera, su capitán le llamará para confirmar la hora, el punto de encuentro y el tiempo.", sign: "Hasta muy pronto en el mar,", team: "El equipo SARE", pdfTitle: "Confirmación de reserva" },
  ru: { subj: "Ваше бронирование SARE подтверждено", title: "Бронирование подтверждено", hello: "Здравствуйте,", intro: "Рады подтвердить ваше бронирование. Вот всё, что нужно для идеального дня в море.", when: "Дата", hours: "Время", pickup: "Место встречи", guests: "Гости", occ: "Повод", opts: "Опции", total: "Итого", paid: "Уже оплачено", due: "К оплате", depTitle: "Закрепите бронирование", depText: "Чтобы завершить бронирование, оплатите депозит по защищённой ссылке (карта, Apple Pay, Google Pay).", depBtn: "Оплатить депозит", depAmt: "Депозит", balance: "Остаток оплачивается до отправления.", bring: "Возьмите с собой: паспорта всех гостей, если мы покидаем воды Синт-Мартена, купальники, солнцезащитный крем. Всё остальное на борту.", weather: "Накануне капитан позвонит вам, чтобы подтвердить время, место встречи и погоду.", sign: "До скорой встречи в море,", team: "Команда SARE", pdfTitle: "Подтверждение бронирования" },
  pt: { subj: "Sua reserva SARE está confirmada", title: "Reserva confirmada", hello: "Olá", intro: "Temos o prazer de confirmar sua reserva. Aqui está tudo o que você precisa para um dia perfeito no mar.", when: "Data", hours: "Horário", pickup: "Ponto de encontro", guests: "Convidados", occ: "Ocasião", opts: "Opções", total: "Total", paid: "Já pago", due: "Restante", depTitle: "Garanta sua reserva", depText: "Para finalizar, pague o sinal pelo nosso link de pagamento seguro (cartão, Apple Pay, Google Pay).", depBtn: "Pagar o sinal", depAmt: "Sinal", balance: "O saldo é pago antes da saída.", bring: "Leve: passaportes de todos os convidados se sairmos das águas de Sint Maarten, roupa de banho e protetor solar. Todo o resto está a bordo.", weather: "Na véspera, seu capitão ligará para confirmar o horário, o ponto de encontro e o clima.", sign: "Até breve no mar,", team: "Equipe SARE", pdfTitle: "Confirmação de reserva" },
  nl: { subj: "Uw SARE-boeking is bevestigd", title: "Boeking bevestigd", hello: "Beste", intro: "Met genoegen bevestigen wij uw boeking. Hier vindt u alles voor een perfecte dag op zee.", when: "Datum", hours: "Tijden", pickup: "Ontmoetingspunt", guests: "Gasten", occ: "Gelegenheid", opts: "Opties", total: "Totaal", paid: "Al betaald", due: "Nog te betalen", depTitle: "Zeker uw boeking", depText: "Betaal ter afronding de aanbetaling via onze beveiligde betaallink (kaart, Apple Pay, Google Pay).", depBtn: "Aanbetaling betalen", depAmt: "Aanbetaling", balance: "Het saldo wordt vóór vertrek voldaan.", bring: "Meenemen: paspoorten van alle gasten als we de wateren van Sint Maarten verlaten, zwemkleding, zonnebrand. De rest is aan boord.", weather: "De dag ervoor belt uw kapitein om tijd, ontmoetingspunt en weer te bevestigen.", sign: "Tot zeer binnenkort op zee,", team: "Het SARE-team", pdfTitle: "Boekingsbevestiging" },
};
const loc = { en: "en-US", fr: "fr-FR", es: "es-ES", ru: "ru-RU", pt: "pt-BR", nl: "nl-NL" };
export function confirmEmail(b, link) {
  const l = C[b.client?.lang] ? b.client.lang : "en", c = C[l], L = loc[l];
  const fdd = d => d ? new Date(d + "T12:00:00").toLocaleDateString(L, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const paid = (b.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0), price = Number(b.price) || 0;
  const first = String(b.client?.name || "").trim().split(/\s+/)[0] || "";
  const rowsL = [[c.when, fdd(b.date) + (b.endDate && b.endDate !== b.date ? " → " + fdd(b.endDate) : "")], [c.hours, [b.start, b.end].filter(Boolean).join(" – ")], [c.pickup, b.pickup], [c.guests, b.guests], [c.occ, b.occasion], [c.opts, (b.options || []).join(", ")],
    ...(price ? [[c.total, eur(price)], [c.paid, paid ? eur(paid) : ""], [c.due, price - paid > 0 ? eur(price - paid) : ""]] : [])].filter(([, v]) => v !== "" && v != null);
  const tr = rowsL.map(([k, v]) => `<tr><td style="padding:9px 0;width:150px;color:#7a7d86;font:12px Arial,sans-serif;vertical-align:top;border-bottom:1px solid #eeebe5">${esc(k)}</td><td style="padding:9px 0;color:#25252c;font:15px Arial,sans-serif;vertical-align:top;border-bottom:1px solid #eeebe5">${esc(v)}</td></tr>`).join("");
  const dep = link?.url ? `<tr><td style="padding:8px 36px 4px"><div style="background:#25252c;color:#f1efea;padding:24px 26px"><div style="font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#c8ccdb">${esc(c.depTitle)}</div>
<p style="font:14px/1.6 Arial,sans-serif;margin:10px 0 0;color:#e7e5e0">${esc(c.depText)}</p><div style="font:300 26px Georgia,serif;margin-top:12px">${esc(c.depAmt)} · ${eur(link.amount)}</div>
<a href="${esc(link.url)}" style="display:inline-block;margin-top:16px;padding:13px 24px;background:#f1efea;color:#25252c;text-decoration:none;font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase">${esc(c.depBtn)}</a>
<p style="font:12px Arial,sans-serif;margin:14px 0 0;color:#c8ccdb">${esc(c.balance)}</p></div></td></tr>` : "";
  const hs = HANDLERS.map(([n, p]) => `<a href="https://wa.me/${p.replace(/\D/g, "")}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 16px;border:1px solid #25252c;color:#25252c;text-decoration:none;font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase">${n} · WhatsApp</a>`).join("");
  const html = `<!doctype html><html lang="${l}"><body style="margin:0;background:#efede8;padding:24px 12px"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff">
<tr><td style="background:#25252c;padding:28px 36px"><div style="font:300 30px Georgia,serif;letter-spacing:.12em;color:#f1efea">SARE</div><div style="font:10px Arial,sans-serif;letter-spacing:.3em;text-transform:uppercase;color:#c8ccdb;margin-top:4px">Caribbean Breeze</div></td></tr>
<tr><td style="padding:34px 36px 10px"><div style="font:600 10px Arial,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#2f7a4b">✔ ${esc(c.title)} · ${esc(b.ref || "")}</div>
<div style="font:300 26px/1.3 Georgia,serif;color:#25252c;margin-top:12px">${esc(c.hello)} ${esc(first)},</div><p style="font:15px/1.7 Arial,sans-serif;color:#3b3e46;margin:14px 0 0">${esc(c.intro)}</p>
<div style="font:300 22px Georgia,serif;color:#25252c;margin-top:20px">${esc(b.title || "")}</div></td></tr>
<tr><td style="padding:6px 36px 22px"><table width="100%" cellpadding="0" cellspacing="0">${tr}</table></td></tr>${dep}
<tr><td style="padding:22px 36px 6px"><p style="font:14px/1.7 Arial,sans-serif;color:#3b3e46;margin:0">${esc(c.weather)}</p><p style="font:14px/1.7 Arial,sans-serif;color:#3b3e46;margin:10px 0 16px">${esc(c.bring)}</p>${hs}</td></tr>
<tr><td style="padding:14px 36px 34px"><p style="font:14px/1.6 Arial,sans-serif;color:#3b3e46;margin:0">${esc(c.sign)}<br><span style="font:300 18px Georgia,serif;color:#25252c">${esc(c.team)}</span></p></td></tr>
<tr><td style="background:#25252c;padding:18px 36px;font:11px Arial,sans-serif;color:#c8ccdb">SARE · Caribbean Breeze · Porto Cupecoy, Sint Maarten · <a href="https://www.sare-exclusive.com" style="color:#c8ccdb">sare-exclusive.com</a></td></tr>
</table></td></tr></table></body></html>`;
  const text = `${c.hello} ${first},\n\n${c.intro}\n\n${b.title || ""}\n` + rowsL.map(([k, v]) => `${k} : ${v}`).join("\n") + (link?.url ? `\n\n${c.depTitle} — ${c.depAmt} ${eur(link.amount)} : ${link.url}\n${c.balance}` : "") + `\n\n${c.weather}\n${c.bring}\n\n${c.sign}\n${c.team}`;
  const asReq = { type: b.type === "tender" ? "tender" : "charter", ref: b.ref, lang: l, formula: b.title, date: b.date, from: b.date, to: b.endDate, guests: b.guests, port: b.pickup, occasion: b.occasion, options: b.options, estimate: b.price, name: b.client?.name, email: b.client?.email, contact: b.client?.phone, yacht: b.client?.company, receivedAt: new Date().toISOString() };
  return { lang: l, subject: `${c.subj} · ${b.ref || ""}`, html, text, pdf: () => pdf(asReq, l, c.pdfTitle) };
}
