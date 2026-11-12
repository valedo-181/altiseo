import { test } from "node:test";
import assert from "node:assert/strict";
import { alertMessage, applyCheck, DOMAIN_THRESHOLDS, dueThreshold, parseEmails, rdapExpiry, registrableDomain, SSL_THRESHOLDS, uptime } from "./watch.ts";

const T0 = new Date("2026-11-12T10:00:00Z");
const ok = { ok: true, code: 200, ms: 300, error: null };
const ko = { ok: false, code: 502, ms: 120, error: "Erreur 502" };

test("un échec isolé n'est pas une panne ; deux de suite, oui ; le retour ferme la panne", () => {
  const a = applyCheck({ status: "up", fails: 0, downSince: null }, ko, T0);
  assert.deepEqual([a.next.status, a.next.fails, a.event], ["up", 1, null]);
  const b = applyCheck(a.next, ko, new Date(T0.getTime() + 300_000));
  assert.equal(b.event, "down");
  assert.equal(b.next.status, "down");
  assert.equal(b.next.downSince, T0.toISOString(), "la panne commence au premier échec");
  const c = applyCheck(b.next, ko, new Date(T0.getTime() + 600_000));
  assert.equal(c.event, null, "pas de nouvelle alerte pendant la panne");
  const d = applyCheck(c.next, ok, new Date(T0.getTime() + 1_200_000));
  assert.equal(d.event, "up");
  assert.equal(d.downtimeMs, 1_200_000);
  assert.deepEqual(d.next, { status: "up", fails: 0, downSince: null });
  assert.equal(applyCheck({ status: "up", fails: 1, downSince: null }, ok, T0).event, null, "un raté puis un succès : rien à dire");
});

test("seuils SSL : 30, 7 puis 1 jour(s), une seule fois chacun ; un renouvellement repart à zéro", () => {
  const until = "2026-12-05T10:00:00Z"; // 23 jours
  assert.equal(dueThreshold(until, SSL_THRESHOLDS, undefined, T0), 30);
  assert.equal(dueThreshold(until, SSL_THRESHOLDS, { until, threshold: 30 }, T0), null);
  const soon = "2026-11-17T10:00:00Z"; // 5 jours
  assert.equal(dueThreshold(soon, SSL_THRESHOLDS, { until: soon, threshold: 30 }, T0), 7);
  assert.equal(dueThreshold("2027-02-12T10:00:00Z", SSL_THRESHOLDS, { until, threshold: 7 }, T0), null, "renouvelé : plus d'alerte");
  assert.equal(dueThreshold("2026-12-01T00:00:00Z", DOMAIN_THRESHOLDS, { until: "2025-12-01T00:00:00Z", threshold: 7 }, T0), 30, "nouvelle échéance : on annonce de nouveau");
  assert.equal(dueThreshold(null, SSL_THRESHOLDS, undefined, T0), null);
});

test("RDAP : date d'expiration lue, absente pour un registre qui ne la publie pas", () => {
  assert.equal(rdapExpiry({ events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }, { eventAction: "expiration", eventDate: "2027-03-14T10:00:00Z" }] }), "2027-03-14");
  assert.equal(rdapExpiry({ events: [{ eventAction: "registration", eventDate: "2010-01-01T00:00:00Z" }] }), null);
  assert.equal(rdapExpiry(null), null);
  assert.equal(registrableDomain("www.blog.domevia.ch"), "domevia.ch");
  assert.equal(registrableDomain("shop.exemple.co.uk"), "exemple.co.uk");
});

test("disponibilité : vérifications réussies sur le total, temps moyen des réussies", () => {
  assert.deepEqual(uptime([{ day: "2026-11-11", checks: 288, failures: 2, totalMs: 286 * 300 }, { day: "2026-11-12", checks: 100, failures: 0, totalMs: 100 * 200 }]), { pct: 99.48, avgMs: 274, checks: 388 });
  assert.deepEqual(uptime([]), { pct: null, avgMs: null, checks: 0 });
});

test("adresses d'alerte : 3 au plus, valides, sans doublon", () => {
  assert.deepEqual(parseEmails("A@x.ch, b@y.ch a@x.ch"), { ok: true, value: ["a@x.ch", "b@y.ch"] });
  assert.equal(parseEmails("a@x.ch,b@x.ch,c@x.ch,d@x.ch").ok, false);
  assert.deepEqual(parseEmails("pas-une-adresse"), { ok: false, error: "Cette adresse n'est pas valide : pas-une-adresse" });
  assert.deepEqual(parseEmails(""), { ok: true, value: [] });
});

test("e-mails d'alerte : sujet clair et lien vers la page", () => {
  const site = { name: "Domevia", url: "https://domevia.ch" };
  const down = alertMessage({ kind: "down", code: 502, error: null }, site, "https://app.exemple");
  assert.equal(down.subject, "Votre site ne répond plus : Domevia");
  assert.ok(down.text.includes("erreur 502") && down.text.includes("https://app.exemple/app/gardien"));
  assert.ok(alertMessage({ kind: "up", downtimeMs: 75 * 60_000 }, site, "x").text.includes("1 heure 15 min"));
  assert.equal(alertMessage({ kind: "ssl", days: 1, until: "2026-11-13T10:00:00Z" }, site, "x").subject, "Certificat SSL : expire demain (Domevia)");
});
