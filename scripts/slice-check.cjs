/**
 * Parcours complet de la tranche verticale dans un vrai navigateur (Playwright).
 *   ALTISEO_DEMO_FILE=/tmp/x.json npx next start -p 3100 &   puis   node scripts/slice-check.cjs
 * Échoue (code 1) à la première étape qui ne se passe pas comme prévu.
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:3100";
const SHOTS = process.env.SHOTS_DIR || null;
const assert = (c, m) => { if (!c) throw new Error("ÉCHEC : " + m); console.log("  ok  " + m); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  const shot = async (name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const email = `alice+${Date.now()}@exemple.ch`;

  console.log("F01 inscription → calendrier");
  await page.goto(BASE + "/");
  await shot("S01");
  await page.getByRole("link", { name: "Essai gratuit" }).click();
  await page.waitForURL("**/inscription");
  await shot("S03");
  await page.getByLabel("Votre nom").fill("Alice");
  await page.getByLabel("E-mail professionnel").fill(email);
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await page.waitForURL("**/onboarding/site");

  await page.getByLabel("Adresse de votre site").fill("localhost");
  await page.getByRole("button", { name: "Analyser mon site" }).click();
  await page.getByText("Indiquez l'adresse publique du site").waitFor();
  assert(true, "adresse invalide refusée avec un message clair");
  await page.getByLabel("Adresse de votre site").fill("Demenagements-Leman.ch/");
  await page.getByRole("button", { name: "Analyser mon site" }).click();
  await page.waitForURL("**/onboarding/activite");
  assert((await page.getByLabel("Nom de l'entreprise").inputValue()) === "Demenagements Leman", "nom deviné depuis le domaine");
  await shot("S05");
  await page.getByLabel("Thème principal").fill("déménagement");
  await page.getByLabel("Votre activité en quelques phrases").fill("Déménagements et garde-meubles dans la région lémanique depuis 1998.");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL("**/onboarding/concurrents");
  await page.getByRole("textbox", { name: "Concurrent 1", exact: true }).fill("concurrent-exemple.ch");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL("**/onboarding/langue");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL("**/onboarding/publication");
  await page.getByLabel("Nom d'utilisateur WordPress").fill("alice");
  await page.getByLabel("Mot de passe d'application").fill("mot-de-passe");
  await page.getByRole("button", { name: "Connecter WordPress" }).click();
  await page.getByText("Ce n'est pas un mot de passe d'application").waitFor();
  assert(true, "mauvais mot de passe d'application refusé");
  await page.getByLabel("Mot de passe d'application").fill("abcd EFGH ijkl MNOP qrst UVWX");
  await page.getByRole("button", { name: "Connecter WordPress" }).click();
  await page.waitForURL("**/onboarding/planning");
  await shot("S09");
  await page.getByRole("button", { name: "Continuer" }).click();
  await page.waitForURL("**/onboarding/offre");
  await page.getByRole("button", { name: "Démarrer l'essai et préparer mes sujets" }).click();
  await page.waitForURL("**/app/calendrier?nouveau=1");
  const cards = page.locator("main li.card");
  assert((await cards.count()) === 30, "30 sujets au calendrier");
  await shot("S12");

  console.log("F02 changer et approuver un sujet");
  const first = cards.first();
  const before = await first.locator("p.font-semibold").innerText();
  await first.getByRole("button", { name: /Changer/ }).click();
  await page.waitForFunction(([b]) => document.querySelector("main li.card p.font-semibold")?.textContent !== b, [before]);
  assert((await first.getByRole("button", { name: /Changer \(1\/5\)/ }).count()) === 1, "sujet changé, compteur 1/5");
  await first.getByRole("button", { name: "Approuver" }).click();
  await first.getByText("Approuvé").waitFor();
  assert(true, "sujet approuvé");

  console.log("F03 écrire l'article maintenant");
  await first.getByRole("button", { name: "Écrire maintenant" }).click();
  await page.waitForURL(/\/app\/articles\/[0-9a-f-]+\?ecrit=1/);
  const articleUrl = page.url().split("?")[0];
  assert(await page.locator("#panel-preview h2").count() >= 3, "article écrit, avec intertitres");
  await shot("S14");

  console.log("F04 relire, corriger, envoyer");
  await page.getByRole("tab", { name: "Modifier le texte" }).click();
  const body = page.getByLabel("Texte de l'article");
  await body.fill((await body.inputValue()) + "\n\n## Notre conseil final\n\nAppelez-nous au **021 000 00 00**.");
  assert(await page.getByText("Modifications non enregistrées").isVisible(), "modifications signalées");
  assert(await page.getByRole("button", { name: "Envoyer à WordPress" }).isDisabled(), "envoi bloqué tant que ce n'est pas enregistré");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByText("Modifications enregistrées.").waitFor();
  await page.getByRole("tab", { name: "Aperçu" }).click();
  assert(await page.locator("#panel-preview h2", { hasText: "Notre conseil final" }).count() === 1, "correction visible dans l'aperçu");
  await page.getByRole("button", { name: "Envoyer à WordPress" }).click();
  await page.getByText("Envoyé en brouillon sur WordPress (simulation).").waitFor();
  assert(await page.getByText(/Envoyé à WordPress le/).count() === 1, "publication enregistrée");

  console.log("Image de l'article");
  await page.goto(articleUrl);
  assert(await page.locator("section[aria-labelledby=h-image] img").count() === 1, "l'article a reçu une image");
  assert(await page.getByText("Image d'exemple :").count() === 1, "l'image d'exemple est annoncée");
  await page.getByRole("button", { name: "Changer l'image" }).click();
  await page.getByText("Image d'exemple ajoutée.").waitFor();
  assert(await page.getByText(/Encore 3 essais/).count() === 1, "essais restants comptés");
  await shot("S14-image");
  await page.getByRole("button", { name: "Retirer l'image" }).click();
  await page.getByText("Cet article n'a pas d'image.").waitFor();
  await page.getByRole("button", { name: "Créer une image" }).click();
  await page.locator("section[aria-labelledby=h-image] img").waitFor();
  assert(true, "retirer puis recréer l'image");

  console.log("Listes, tableau de bord, autres écrans");
  await page.goto(BASE + "/app/articles");
  assert(await page.locator("tbody tr").count() === 1, "1 article dans la liste");
  await shot("S13");
  await page.goto(BASE + "/app/calendrier");
  assert(await page.getByRole("link", { name: "Ouvrir l'article" }).count() === 1, "le sujet écrit renvoie à son article");
  await page.goto(BASE + "/app");
  assert(await page.getByText("1 brouillon à relire").count() === 1, "tableau de bord à jour");
  await shot("S11");
  for (const [path, name] of [["/app/integrations", "S17"], ["/app/reglages", "S18"], ["/app/audit", "S15"], ["/app/abonnement", "S22"], ["/tarifs", "S02"]]) {
    const r = await page.goto(BASE + path);
    assert(r.status() === 200, `${path} répond`);
    await shot(name);
  }
  console.log("Site statique (GitHub) à la place de WordPress");
  await page.goto(BASE + "/app/integrations");
  await page.getByText("Utiliser un site statique à la place").click();
  await page.getByLabel("Dépôt GitHub du site").fill("valedo-181/domevia");
  await page.getByLabel("Jeton d'accès GitHub").fill("mot-de-passe");
  await page.getByRole("button", { name: "Connecter et tester" }).last().click();
  await page.getByText("Ce n'est pas un jeton GitHub").waitFor();
  assert(true, "mauvais jeton GitHub refusé");
  await page.getByLabel("Jeton d'accès GitHub").fill("github_pat_" + "A1b2".repeat(15));
  await page.getByRole("button", { name: "Connecter et tester" }).last().click();
  await page.getByText(/valedo-181\/domevia · main/).waitFor();
  assert(await page.getByText("Connecté (simulation)").count() === 1, "dépôt connecté, WordPress remplacé");
  await shot("S17-github");
  await page.goto(articleUrl);
  await page.getByRole("button", { name: "Envoyer en brouillon" }).last().click();
  await page.getByText("Envoyé en brouillon sur le dépôt du site (simulation).").waitFor();
  assert(await page.getByText(/Envoyé à votre site le/).count() === 1, "article envoyé au dépôt");
  await shot("S14-github");

  console.log("Mots-clés (chiffres d'exemple)");
  await page.goto(BASE + "/app/mots-cles");
  assert(await page.getByText("Connectez Google Search Console").count() === 1, "invitation à connecter Search Console");
  await page.getByRole("button", { name: "Voir avec des chiffres d'exemple" }).click();
  await page.getByRole("heading", { name: "Vos mots-clés" }).waitFor();
  assert(await page.locator("figure svg path[stroke]").count() === 3, "trois courbes");
  assert(await page.locator("section[aria-labelledby=h-queries] tbody tr").count() > 3, "tableau des recherches rempli");
  assert(await page.getByText("Chiffres d'exemple :").count() === 1, "les chiffres d'exemple sont annoncés");
  const chart = page.locator("figure [role=group]").first();
  await chart.hover({ position: { x: 200, y: 80 } });
  assert(await chart.locator("[role=status]").innerText().then((t) => /clics?/.test(t)), "survol : valeur du jour");
  await chart.focus();
  await page.keyboard.press("ArrowLeft");
  assert(await chart.locator("[role=status]").count() === 1, "clavier : valeur du jour");
  await page.getByRole("button", { name: "28 jours" }).click();
  await page.locator("summary", { hasText: "Chiffres jour par jour" }).click();
  assert(await page.locator("details tbody tr").count() === 28, "période de 28 jours appliquée");
  await shot("S24");
  assert(await page.locator("section[aria-labelledby=h-targets] li").count() >= 1, "mot-clé visé par l'article écrit");
  await page.getByRole("button", { name: "Déconnecter Google" }).click();
  await page.getByText("Connectez Google Search Console").waitFor();
  assert(true, "déconnexion");
  await page.getByRole("button", { name: "Voir avec des chiffres d'exemple" }).click();
  await page.getByRole("heading", { name: "Vos mots-clés" }).waitFor();

  await page.goto(BASE + "/app/reglages");
  await page.getByLabel("Consignes pour chaque article").fill("Vouvoyer. Citer nos 3 agences.");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await page.getByText("Réglages enregistrés.").waitFor();
  assert(true, "réglages de rédaction enregistrés");

  console.log("Sécurité : un autre compte ne voit rien");
  const other = await browser.newContext();
  const p2 = await other.newPage();
  await p2.goto(BASE + "/inscription");
  await p2.getByLabel("E-mail professionnel").fill(`bruno+${Date.now()}@exemple.ch`);
  await p2.getByRole("button", { name: "Créer mon compte" }).click();
  await p2.waitForURL("**/onboarding/site");
  const r404 = await p2.goto(articleUrl);
  assert(r404.status() === 404 || p2.url().includes("/onboarding"), "l'article d'Alice est introuvable pour Bruno");
  const anon = await (await browser.newContext()).newPage();
  await anon.goto(BASE + "/app");
  assert(anon.url().endsWith("/connexion"), "sans session : retour à la connexion");
  await other.close();

  console.log("Téléphone (390 px) et clavier");
  const mob = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState() });
  const pm = await mob.newPage();
  pm.on("pageerror", (e) => errors.push("mobile: " + e.message));
  for (const path of ["/app", "/app/calendrier", "/app/articles", articleUrl.replace(BASE, ""), "/app/integrations", "/app/reglages", "/app/mots-cles"]) {
    await pm.goto(BASE + path);
    const w = await pm.evaluate(() => document.documentElement.scrollWidth);
    assert(w <= 390, `${path} sans défilement horizontal à 390 px (${w})`);
  }
  if (SHOTS) { await pm.goto(BASE + "/app/calendrier"); await pm.screenshot({ path: `${SHOTS}/S12-mobile.png`, fullPage: true }); }
  if (SHOTS) {
    await pm.goto(BASE + "/app/mots-cles"); await pm.screenshot({ path: `${SHOTS}/S24-mobile.png`, fullPage: true });
    const dark = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", deviceScaleFactor: 2, storageState: await ctx.storageState() });
    const pd = await dark.newPage();
    await pd.goto(BASE + "/app/mots-cles");
    await pd.locator("figure [role=group]").nth(2).hover({ position: { x: 260, y: 90 } });
    await pd.screenshot({ path: `${SHOTS}/S24-sombre.png` });
    await dark.close();
  }
  const kb = await (await browser.newContext()).newPage();
  await kb.goto(BASE + "/connexion");
  await kb.keyboard.press("Tab"); // lien « Aller au contenu » absent ici : logo
  await kb.keyboard.press("Tab");
  await kb.keyboard.type(email);
  await kb.keyboard.press("Enter");
  await kb.waitForURL("**/app");
  assert(true, "connexion au clavier seulement");

  assert(errors.length === 0, `aucune erreur dans la console${errors.length ? " : " + errors.join(" | ") : ""}`);
  await browser.close();
  console.log("Tout est passé.");
})().catch((e) => { console.error(e.message); process.exit(1); });
