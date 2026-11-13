import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanAds, demoAds, googleEditorCsv, landingUrl, len, LIMITS } from "./format.ts";

const good = {
  google: {
    headlines: ["Garde-meubles à Lausanne", "Devis gratuit sous 24 h", "Box sécurisés dès 1 m³", "Accès 7 jours sur 7"],
    descriptions: ["Des box propres et surveillés, de 1 à 30 m³. Demandez votre devis en ligne.", "Location au mois, sans engagement. Notre équipe vous conseille sur la taille."],
    path1: "Garde-Meubles", path2: "lausanne", keywords: ["Garde-meubles Lausanne", "louer un box"], negatives: ["emploi"],
  },
  meta: { primaryTexts: ["Quelle taille de box choisir ? Notre guide vous aide à estimer le volume de vos affaires."], headline: "Garde-meubles : quelle taille ?", description: "Guide pratique", cta: "GET_QUOTE" },
};

test("une annonce correcte passe telle quelle, mots-clés et chemins normalisés", () => {
  const r = cleanAds(good);
  assert.ok(r.ok);
  assert.equal(r.ads.google.headlines.length, 4);
  assert.equal(r.ads.google.path1, "garde-meubles");
  assert.deepEqual(r.ads.google.keywords, ["garde-meubles lausanne", "louer un box"]);
  assert.equal(r.ads.meta.cta, "GET_QUOTE");
});

test("ce qui dépasse les limites est écarté, jamais coupé", () => {
  const r = cleanAds({ ...good, google: { ...good.google, headlines: [...good.google.headlines, "Un titre beaucoup trop long pour tenir dans trente caractères"], descriptions: [...good.google.descriptions, "x".repeat(91)], path1: "un-chemin-bien-trop-long" }, meta: { ...good.meta, description: "Une description bien trop longue pour Meta" } });
  assert.ok(r.ok);
  assert.ok(r.ads.google.headlines.every((h) => len(h) <= LIMITS.google.headline));
  assert.equal(r.ads.google.headlines.length, 4);
  assert.equal(r.ads.google.descriptions.length, 2);
  assert.equal(r.ads.google.path1, "");
  assert.equal(r.ads.meta.description, "");
});

test("règles de Google : pas de point d'exclamation ni de MAJUSCULES dans les titres, doublons retirés", () => {
  const r = cleanAds({ ...good, google: { ...good.google, headlines: ["Devis gratuit !!!", "DEVIS GRATUIT IMMEDIAT", "devis gratuit", "Box sécurisés dès 1 m³", "Accès 7 jours sur 7"], descriptions: ["Super offre !! Venez vite !", "Location au mois, sans engagement."] } });
  assert.ok(r.ok);
  assert.deepEqual(r.ads.google.headlines, ["Devis gratuit", "Box sécurisés dès 1 m³", "Accès 7 jours sur 7"]);
  assert.equal(r.ads.google.descriptions[0], "Super offre ! Venez vite.");
});

test("pas assez de matière : erreur lisible", () => {
  assert.equal(cleanAds({ ...good, google: { ...good.google, headlines: ["Un seul titre"] } }).ok, false);
  assert.equal(cleanAds({ ...good, meta: { ...good.meta, primaryTexts: ["x".repeat(126)] } }).ok, false);
  assert.equal(cleanAds({ ...good, meta: { ...good.meta, headline: "" } }).ok, false);
  assert.equal(cleanAds({}).ok, false);
  const cta = cleanAds({ ...good, meta: { ...good.meta, cta: "BUY_NOW_OR_ELSE" } });
  assert.ok(cta.ok && cta.ads.meta.cta === "LEARN_MORE");
});

test("annonces d'exemple : toujours dans les limites, même avec un titre très long", () => {
  const a = demoAds({ title: "Déménagement en fin de bail : le guide complet pour rendre votre logement sans mauvaise surprise", keyword: "déménagement fin de bail", siteName: "Déménagements du Léman et de la Riviera vaudoise", theme: "déménagement" });
  assert.ok(a.google.headlines.length >= 3 && a.google.headlines.every((h) => len(h) <= 30));
  assert.ok(a.google.descriptions.every((d) => len(d) <= 90));
  assert.ok(a.meta.primaryTexts.every((t) => len(t) <= 125) && len(a.meta.headline) <= 40);
});

test("adresse de destination avec suivi de campagne", () => {
  assert.equal(landingUrl("https://exemple.ch/garde-meubles/?x=1", "google", "garde-meubles"), "https://exemple.ch/garde-meubles/?x=1&utm_source=google&utm_medium=cpc&utm_campaign=garde-meubles");
  assert.match(landingUrl("https://exemple.ch/a/", "meta", "a"), /utm_source=meta&utm_medium=paid_social/);
});

test("export Google Ads Editor : campagne en pause, mots-clés en expression, pas de formule", () => {
  const r = cleanAds({ ...good, google: { ...good.google, keywords: ["=cmd|calc", "garde-meubles lausanne"] } });
  assert.ok(r.ok);
  const csv = googleEditorCsv({ campaign: 'Altiseo "test"', adGroup: "Garde-meubles", url: "https://exemple.ch/a/", ad: r.ads.google });
  const lines = csv.trim().split("\r\n");
  assert.equal(lines.length, 1 + 1 + 2 + 1);
  assert.ok(lines[1].startsWith('"Altiseo ""test""","Paused","Garde-meubles","Enabled","Responsive search ad","Paused"'));
  assert.ok(lines[2].includes(`"'=cmd|calc","Phrase"`), "une cellule qui commence par = est neutralisée");
  assert.ok(lines.at(-1)!.endsWith('"emploi","Negative Phrase"'));
  assert.equal(lines[0].split(",").length, lines[1].split('","').length);
});
