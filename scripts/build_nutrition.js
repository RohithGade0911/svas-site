#!/usr/bin/env node
/* Builds the /nutrition/<slug>/ per-dish SEO pages + the /nutrition/ hub.
 *
 * Sources (NEVER hand-edit the numbers — core rule: macros are NIN-computed):
 *   ../../food-database/dishes_mvp.csv                 native names, diet, health tags
 *   ../../food-database/layer3-dishes/dish_macros.csv  per-serving + per-100g macros (generated)
 *   ../../food-database/layer2-recipes/dish_ingredients.csv  gram-level ingredients
 *   ../../food-database/layer1-ingredients/ingredients.csv   ingredient display names
 *   Supabase catalog.dishes.image_url                  dish photos (public read)
 *
 * Selection: scripts/.nutrition_ids.json  (resolved dish_ids — 2 per state)
 * Run from svas-site/:  node scripts/build_nutrition.js
 * Output is committed; scripts/ is .vercelignore'd (never served).
 */
const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://jtschfacrjsynryiyyyk.supabase.co";
const KEY = "sb_publishable_2uL2zVf_cpObToPtKODMZw_cH0c8TIe"; // publishable — safe
const SITE = "https://www.svas.life";

const SEL = require("./.nutrition_ids.json"); // [{slug,id,name,bucket,native}]

// bucket (catalog sub_region) -> display state, and state -> zone
const STATE = {
  "Andhra": "Andhra Pradesh", "Telangana": "Telangana", "Tamil Nadu": "Tamil Nadu",
  "Karnataka": "Karnataka", "Kerala": "Kerala", "Punjab": "Punjab", "Haryana": "Haryana",
  "Uttar Pradesh": "Uttar Pradesh", "Rajasthan": "Rajasthan", "Himachal Pradesh": "Himachal Pradesh",
  "Kashmir": "Jammu & Kashmir", "Uttarakhand": "Uttarakhand", "West Bengal": "West Bengal",
  "Bihar": "Bihar", "Jharkhand": "Jharkhand", "Odisha": "Odisha", "Gujarat": "Gujarat",
  "Maharashtra": "Maharashtra", "Goa": "Goa", "Madhya Pradesh": "Madhya Pradesh",
  "Chhattisgarh": "Chhattisgarh", "Assam": "Assam", "Manipur": "Manipur", "Meghalaya": "Meghalaya",
  "Tripura": "Tripura", "Mizoram": "Mizoram", "Sikkim": "Sikkim", "Nagaland": "Nagaland",
};
const ZONE_OF = {
  "Andhra Pradesh": "South", "Telangana": "South", "Tamil Nadu": "South", "Karnataka": "South", "Kerala": "South",
  "Punjab": "North", "Haryana": "North", "Uttar Pradesh": "North", "Rajasthan": "North",
  "Himachal Pradesh": "North", "Jammu & Kashmir": "North", "Uttarakhand": "North",
  "West Bengal": "East", "Bihar": "East", "Jharkhand": "East", "Odisha": "East",
  "Gujarat": "West", "Maharashtra": "West", "Goa": "West",
  "Madhya Pradesh": "Central", "Chhattisgarh": "Central",
  "Assam": "Northeast", "Manipur": "Northeast", "Meghalaya": "Northeast", "Tripura": "Northeast",
  "Mizoram": "Northeast", "Sikkim": "Northeast", "Nagaland": "Northeast",
};
const ZONE_ORDER = ["South", "North", "East", "West", "Central", "Northeast"];
const NAME_OVERRIDE = { "kerala-fish-curry": "Kerala Fish Curry" };

// ---- CSV (quoted fields, LF/CRLF) ----
function parseCsv(text) {
  const rows = []; let row = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
function byId(file, idCol) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const head = rows[0], map = {};
  for (const r of rows.slice(1)) { if (!r[0]) continue; const o = {}; head.forEach((h, i) => o[h] = r[i]); map[o[idCol]] = o; }
  return map;
}

// ---- helpers ----
const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const clean = (n) => n.split(" (")[0].split(" / ")[0].split(" — ")[0].trim();
const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;
const n1 = (v) => { const x = Math.round(parseFloat(v) * 10) / 10; return Number.isInteger(x) ? x + ".0" : String(x); }; // 1-decimal
const ni = (v) => Math.round(parseFloat(v) || 0);
const hasScript = (s) => s && /[^\x00-\x7F]/.test(s);
function imgRender(url, w) {
  if (!url) return "";
  const r = url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
  return r === url ? url : r + "?width=" + w + "&quality=72&resize=contain";
}
const MEAL_NOUN = { breakfast: "breakfast", lunch: "lunch dish", dinner: "dinner dish", snack: "snack", dessert: "sweet", sweet: "sweet", drink: "drink", beverage: "drink", side: "side dish" };
const dietWord = (d) => d === "veg" ? "Vegetarian" : d === "vegan" ? "Vegan" : d === "egg" ? "Contains egg" : d === "nonveg" ? "Non-vegetarian" : cap(d || "");
const tagPretty = (t) => cap(t.trim().replace(/fiber/i, "fibre").replace(/-/g, "-")).replace(/gi$/i, "GI");
const ALLERGEN = { peanut: "Peanut", groundnut: "Peanut", gluten: "Gluten", wheat: "Gluten", treenut: "Tree nuts", tree_nut: "Tree nuts", milk: "Milk (dairy)", dairy: "Milk (dairy)", egg: "Egg", fish: "Fish", shellfish: "Shellfish", crustacean: "Shellfish", soy: "Soy", soya: "Soy", mustard: "Mustard", sesame: "Sesame" };

const HEAD_FONTS = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Noto+Sans+Telugu:wght@600&family=Noto+Sans+Tamil:wght@600&family=Noto+Sans+Malayalam:wght@600&family=Noto+Sans+Kannada:wght@600&family=Noto+Sans+Gurmukhi:wght@600&family=Noto+Sans+Gujarati:wght@600&family=Noto+Sans+Bengali:wght@600&family=Noto+Sans+Devanagari:wght@600&family=Noto+Sans+Oriya:wght@600&display=swap';

function navFooter() {
  return {
    nav: `<header class="nav">
  <a class="brand" href="/"><img class="mark-img" src="/assets/mark-green.svg" alt=""><b>Svas</b></a>
  <nav class="links">
    <a href="/#food">The Food</a>
    <a href="/nutrition/">Nutrition</a>
    <a href="/#how">How it works</a>
    <a href="/#pricing">Pricing</a>
  </nav>
  <a class="btn btn-primary btn-sm" href="/waitlist.html">Join waitlist</a>
</header>`,
    foot: `<footer class="foot">
  <div class="foot-top">
    <div class="foot-brand">
      <img class="mark-img foot-mark" src="/assets/mark-gold.svg" alt=""><b>Svas</b>
      <p>The health app built around Indian food.<br>Established in yourself.</p>
    </div>
    <div class="foot-col">
      <span>Product</span>
      <a href="/#food">The Food</a>
      <a href="/nutrition/">Nutrition</a>
      <a href="/#how">How it works</a>
      <a href="/#pricing">Pricing</a>
    </div>
    <div class="foot-col">
      <span>Legal</span>
      <a href="/legal/privacy.html">Privacy</a>
      <a href="/legal/terms.html">Terms</a>
      <a href="/legal/disclaimer.html">Health Disclaimer</a>
    </div>
    <div class="foot-col">
      <span>Contact</span>
      <a href="mailto:contact@svas.life">contact@svas.life</a>
      <a href="/legal/support.html">Support</a>
      <span class="addr">Svas · Hyderabad, India</span>
    </div>
  </div>
  <div class="foot-bot">
    <span>© 2026 Svas. All rights reserved.</span>
    <span class="note">Nutrition values are estimates computed from IFCT-2017, reviewed by dietitians — informational, not medical advice.</span>
  </div>
</footer>`,
  };
}

function buildDish(sel, dishes, macros, ingMap, ingNames, imgs) {
  const d = dishes[sel.id], m = macros[sel.id];
  if (!d || !m) throw new Error(sel.id + ": missing in CSVs");
  const name = NAME_OVERRIDE[sel.slug] || clean(d.display_name);
  const state = STATE[sel.bucket] || sel.bucket;
  const zone = ZONE_OF[state];
  const meal = (m.meal_type || d.meal_type || "").toLowerCase();
  const mealNoun = MEAL_NOUN[meal] || "dish";
  const diet = (m.diet_type || d.diet_type || "").toLowerCase().replace(/-/g, "");
  const isVeg = diet === "veg" || diet === "vegan";
  const url = `${SITE}/nutrition/${sel.slug}/`;
  const ings = (ingMap[sel.id] || []).slice().sort((a, b) => b.g - a.g);
  const ingDisp = ings.map((x) => ({ name: ingNames[x.id] || x.id.replace(/_/g, " "), g: x.g }));
  const topIng = ingDisp.filter((x) => !/^salt/i.test(x.name)).slice(0, 4).map((x) => clean(x.name));
  const tags = (d.health_tags || "").split(";").map((t) => t.trim()).filter(Boolean).slice(0, 2).map(tagPretty);
  const allergens = (m.allergens || "").split(/[;,]/).map((a) => a.trim().toLowerCase()).filter(Boolean);
  const allLabels = [...new Set(allergens.map((a) => ALLERGEN[a] || cap(a)))];

  // FAQ — every answer factual, from real macros
  const pct = ni(m.protein_pct_kcal);
  const faq = [
    [`How many calories are in ${name}?`,
      `One serving of ${name} (${ni(m.serving_g)}g) has ${ni(m.kcal)} calories — that's ${ni(m.kcal_100g)} calories per 100g.`],
    [`How much protein is in ${name}?`,
      `A serving of ${name} has ${n1(m.protein_g)}g of protein, about ${pct}% of its calories.`],
    [`Is ${name} vegetarian?`,
      isVeg ? `Yes — ${name} is a ${diet === "vegan" ? "vegan" : "vegetarian"} dish.`
        : diet === "egg" ? `No — ${name} contains egg, so it's not vegetarian.`
        : `No — ${name} is a non-vegetarian dish.`],
    [`What is ${name} made of?`,
      topIng.length ? `${name} is made with ${topIng.slice(0, -1).join(", ")}${topIng.length > 1 ? " and " : ""}${topIng[topIng.length - 1]}.` : `${name} is a traditional ${state} dish.`],
    [`What are the macros in ${name}?`,
      `A serving of ${name} has ${n1(m.protein_g)}g protein, ${n1(m.carb_g)}g carbs, ${n1(m.fat_g)}g fat and ${n1(m.fiber_g)}g fibre.`],
  ];
  return {
    sel, name, state, zone, meal, mealNoun, diet, isVeg, url, m,
    native: hasScript(sel.native) ? sel.native : "",
    img: imgs[sel.id], ingDisp, topIng, tags, allLabels, faq,
    kcal: ni(m.kcal), protein: n1(m.protein_g),
  };
}

function renderPage(x, related) {
  const { name, state, m, native } = x;
  const hero = imgRender(x.img, 760), og = imgRender(x.img, 1200);
  const chips = [dietWord(x.diet), cap(x.meal), ...x.tags, `${ni(m.serving_g)}g serving`].filter(Boolean);
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Nutrition", item: SITE + "/nutrition/" },
      { "@type": "ListItem", position: 3, name, item: x.url },
    ],
  };
  const faqLd = {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: x.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  };
  const nf = navFooter();
  const desc = `${name} has ${ni(m.kcal)} calories per serving (${ni(m.serving_g)}g) with ${n1(m.protein_g)}g protein, ${n1(m.carb_g)}g carbs, ${n1(m.fat_g)}g fat and ${n1(m.fiber_g)}g fibre. Full IFCT-2017 nutrition breakdown for this ${state} dish.`;
  const macroNote = `Per serving (${ni(m.serving_g)}g). This recipe makes ${ni(m.servings)} servings. Protein is about ${ni(m.protein_pct_kcal)}% of total calories.`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(name)} Calories &amp; Nutrition — Per-Serving Macros | Svas</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${x.url}">
<link rel="alternate" hreflang="en-in" href="${x.url}">
<link rel="alternate" hreflang="x-default" href="${x.url}">
<meta name="geo.region" content="IN">
<meta name="geo.placename" content="India">
<meta property="og:site_name" content="Svas">
<meta property="og:title" content="${esc(name)} Calories &amp; Nutrition — ${ni(m.kcal)} kcal, ${n1(m.protein_g)}g protein per serving">
<meta property="og:description" content="The full IFCT-2017 nutrition breakdown for ${esc(name)}, a ${esc(state)} dish. Macros, micros and ingredients.">
<meta property="og:type" content="article">
<meta property="og:url" content="${x.url}">
<meta property="og:locale" content="en_IN">
<meta property="og:image" content="${esc(og)}">
<meta property="og:image:alt" content="${esc(name)} — ${esc(state)} dish">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(name)} Calories &amp; Nutrition — ${ni(m.kcal)} kcal per serving">
<meta name="twitter:description" content="Full IFCT-2017 nutrition breakdown for ${esc(name)}.">
<meta name="twitter:image" content="${esc(og)}">
<meta name="theme-color" content="#2D6A2F">
<link rel="icon" type="image/png" href="/assets/Favicon.png?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${HEAD_FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=4">
<link rel="stylesheet" href="/assets/nutrition.css?v=4">
<script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(faqLd, null, 2)}
</script>
</head>
<body>

${nf.nav}

<main class="np">

  <nav class="crumb" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">›</span><a href="/nutrition/">Nutrition</a><span class="sep">›</span><span>${esc(name)}</span>
  </nav>

  <section class="nut-hero">
    <div>
      <span class="nut-state">${esc(state)}</span>
      ${native ? `<span class="nut-native">${esc(native)}</span>` : ""}
      <h1>${esc(name)} — Calories &amp; Nutrition</h1>
      <p class="nut-sub">${esc(name)} is a ${x.isVeg ? "vegetarian " : ""}${x.mealNoun} from ${esc(state)} — here's exactly what's in one serving.</p>
      <p class="nut-cite">Every value computed from IFCT-2017.</p>
      <div class="nut-chips">
        ${chips.map((c) => `<span class="nut-chip">${esc(c)}</span>`).join("\n        ")}
      </div>
    </div>
    <figure class="nut-photo">
      <img src="${esc(hero)}" alt="${esc(name)} — ${esc(state)} dish, ${ni(m.kcal)} kcal per serving" width="760" height="570" loading="eager">
    </figure>
  </section>

  <section aria-label="Macros per serving">
    <div class="macro-cards">
      <div class="mc mc-kcal"><b>${ni(m.kcal)}</b><span>Calories</span></div>
      <div class="mc"><b>${n1(m.protein_g)}g</b><span>Protein</span></div>
      <div class="mc"><b>${n1(m.carb_g)}g</b><span>Carbs</span></div>
      <div class="mc"><b>${n1(m.fat_g)}g</b><span>Fat</span></div>
      <div class="mc"><b>${n1(m.fiber_g)}g</b><span>Fibre</span></div>
    </div>
    <p class="macro-note">${esc(macroNote)}</p>
  </section>

  <section class="np-sec">
    <h2>${esc(name)} nutrition facts</h2>
    <div class="nut-tables">
      <table>
        <caption>Per serving (${ni(m.serving_g)}g)</caption>
        <tbody>
          <tr><th>Energy</th><td>${ni(m.kcal)} kcal</td></tr>
          <tr><th>Protein</th><td>${n1(m.protein_g)} g</td></tr>
          <tr><th>Carbohydrate</th><td>${n1(m.carb_g)} g</td></tr>
          <tr><th>Fat</th><td>${n1(m.fat_g)} g</td></tr>
          <tr><th>Fibre</th><td>${n1(m.fiber_g)} g</td></tr>
        </tbody>
      </table>
      <table>
        <caption>Per 100g</caption>
        <tbody>
          <tr><th>Energy</th><td>${ni(m.kcal_100g)} kcal</td></tr>
          <tr><th>Protein</th><td>${n1(m.protein_100g)} g</td></tr>
          <tr><th>Carbohydrate</th><td>${n1(m.carb_100g)} g</td></tr>
          <tr><th>Fat</th><td>${n1(m.fat_100g)} g</td></tr>
          <tr><th>Fibre</th><td>${n1(m.fiber_100g)} g</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="np-sec">
    <h2>Minerals &amp; electrolytes</h2>
    <div class="micro-grid">
      <div class="micro"><b>${ni(m.sodium_mg)} mg</b><span>Sodium</span></div>
      <div class="micro"><b>${ni(m.potassium_mg)} mg</b><span>Potassium</span></div>
      <div class="micro"><b>${ni(m.calcium_mg)} mg</b><span>Calcium</span></div>
      <div class="micro"><b>${n1(m.iron_mg)} mg</b><span>Iron</span></div>
    </div>
    <p class="micro-note">Per serving (${ni(m.serving_g)}g), computed from IFCT-2017 ingredient values.</p>
  </section>

  <section class="np-sec">
    <h2>What's in it</h2>
    <div class="ing-list">
      ${x.ingDisp.map((i) => `<span class="ing">${esc(i.name)} <b>${esc(i.g)}g</b></span>`).join("\n      ")}
    </div>
    <p class="ing-note">Grams for the full recipe (${ni(m.servings)} servings). Macros above are the per-serving sum of each ingredient's IFCT-2017 value — never estimated.</p>
  </section>

  <section class="np-sec">
    <h2>Allergens</h2>
    <div class="allergen-row">
      ${x.allLabels.length ? x.allLabels.map((a) => `<span class="allergen">${esc(a)}</span>`).join("\n      ") : `<span class="allergen allergen-none">No major allergens</span>`}
    </div>
  </section>

  <section class="nut-cta">
    <h2>Plan your week around ${esc(name)}</h2>
    <p>Svas builds a weekly plan from 1,000+ regional dishes across 28 states — with the recipe, portions and macros, around your goal.</p>
    <a class="btn btn-primary btn-lg" href="/waitlist.html">Join the waitlist</a>
  </section>

  <section class="np-sec nut-faq">
    <h2>${esc(name)} — frequently asked</h2>
    ${x.faq.map(([q, a], i) => `<details class="faq-item"${i === 0 ? " open" : ""}>
      <summary>${esc(q)}</summary>
      <p>${esc(a)}</p>
    </details>`).join("\n    ")}
  </section>

  ${related.length ? `<section class="np-sec">
    <h2>More regional nutrition</h2>
    <div class="related-grid">
      ${related.map((r) => `<a class="related-card" href="/nutrition/${r.sel.slug}/"><b>${esc(r.name)}</b><span>${esc(r.state)} · ${r.kcal} kcal</span></a>`).join("\n      ")}
    </div>
  </section>` : ""}

  <p class="src-note">
    Nutrition values are computed from <b>IFCT-2017</b> (Indian Food Composition Tables, National Institute of Nutrition) as the per-serving sum of each ingredient's per-100g value, and reviewed by dietitians. Figures are estimates for a standard home recipe and will vary with portion and preparation. Informational only — not medical or dietary advice.
  </p>

</main>

${nf.foot}

</body>
</html>
`;
}

function renderIndex(all) {
  const nf = navFooter();
  const byZone = {};
  for (const x of all) { (byZone[x.zone] = byZone[x.zone] || {}); (byZone[x.zone][x.state] = byZone[x.zone][x.state] || []).push(x); }
  const itemList = {
    "@context": "https://schema.org", "@type": "ItemList",
    name: "Indian food nutrition by state",
    itemListElement: all.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, url: x.url })),
  };
  const breadcrumb = {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Nutrition", item: SITE + "/nutrition/" },
    ],
  };
  const zones = ZONE_ORDER.filter((z) => byZone[z]).map((z) => `
  <section class="np-sec">
    <h2>${z} India</h2>
    ${Object.keys(byZone[z]).sort().map((st) => `<div class="idx-state">
      <h3>${esc(st)}</h3>
      <div class="related-grid">
        ${byZone[z][st].map((x) => `<a class="related-card" href="/nutrition/${x.sel.slug}/"><b>${esc(x.name)}</b><span>${x.kcal} kcal · ${x.protein}g protein</span></a>`).join("\n        ")}
      </div>
    </div>`).join("\n    ")}
  </section>`).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Indian Food Nutrition &amp; Calories — 28 States | Svas</title>
<meta name="description" content="Calories, protein and macros for iconic Indian dishes from all 28 states — computed from IFCT-2017. From pesarattu to rajma chawal, browse nutrition for the food you actually eat.">
<link rel="canonical" href="${SITE}/nutrition/">
<link rel="alternate" hreflang="en-in" href="${SITE}/nutrition/">
<link rel="alternate" hreflang="x-default" href="${SITE}/nutrition/">
<meta name="geo.region" content="IN">
<meta name="geo.placename" content="India">
<meta property="og:site_name" content="Svas">
<meta property="og:title" content="Indian Food Nutrition &amp; Calories — 28 States">
<meta property="og:description" content="Calories, protein and macros for iconic regional Indian dishes, computed from IFCT-2017.">
<meta property="og:type" content="website">
<meta property="og:url" content="${SITE}/nutrition/">
<meta property="og:locale" content="en_IN">
<meta property="og:image" content="${SITE}/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/assets/og-image.png">
<meta name="theme-color" content="#2D6A2F">
<link rel="icon" type="image/png" href="/assets/Favicon.png?v=2">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${HEAD_FONTS}" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=4">
<link rel="stylesheet" href="/assets/nutrition.css?v=4">
<script type="application/ld+json">
${JSON.stringify(breadcrumb, null, 2)}
</script>
<script type="application/ld+json">
${JSON.stringify(itemList, null, 2)}
</script>
</head>
<body>

${nf.nav}

<main class="np">
  <nav class="crumb" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">›</span><span>Nutrition</span>
  </nav>
  <header class="idx-head">
    <h1>Indian food nutrition, by state</h1>
    <p class="nut-sub">Real calories, protein and macros for the dishes India actually eats — from ${all.length} regional favourites across 28 states. Every value computed from IFCT-2017 and reviewed by dietitians.</p>
  </header>
  ${zones}

  <section class="nut-cta">
    <h2>Know your food. Plan your week.</h2>
    <p>Svas turns these numbers into a weekly plan built around the regional food you already love.</p>
    <a class="btn btn-primary btn-lg" href="/waitlist.html">Join the waitlist</a>
  </section>
</main>

${nf.foot}

</body>
</html>
`;
}

async function main() {
  const root = path.join(__dirname, "..", "..", "food-database");
  const dishes = byId(path.join(root, "dishes_mvp.csv"), "dish_id");
  const macros = byId(path.join(root, "layer3-dishes", "dish_macros.csv"), "dish_id");
  const ingNames = {}; {
    const rows = parseCsv(fs.readFileSync(path.join(root, "layer1-ingredients", "ingredients.csv"), "utf8"));
    const h = rows[0], idI = h.indexOf("ingredient_id"), nmI = h.indexOf("display_name");
    for (const r of rows.slice(1)) if (r[idI]) ingNames[r[idI]] = r[nmI];
  }
  const ingMap = {}; {
    const rows = parseCsv(fs.readFileSync(path.join(root, "layer2-recipes", "dish_ingredients.csv"), "utf8"));
    const h = rows[0], dI = h.indexOf("dish_id"), iI = h.indexOf("ingredient_id"), gI = h.indexOf("grams");
    for (const r of rows.slice(1)) { if (!r[dI]) continue; (ingMap[r[dI]] = ingMap[r[dI]] || []).push({ id: r[iI], g: parseFloat(r[gI]) || 0 }); }
  }
  // photos from Supabase (authoritative)
  const ids = SEL.map((s) => s.id);
  const res = await fetch(`${SUPABASE_URL}/rest/v1/dishes?select=dish_id,image_url&dish_id=in.(${ids.join(",")})`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "catalog" } });
  if (!res.ok) throw new Error("Supabase " + res.status);
  const imgs = Object.fromEntries((await res.json()).map((r) => [r.dish_id, r.image_url]));

  const all = SEL.map((s) => buildDish(s, dishes, macros, ingMap, ingNames, imgs));
  const missingImg = all.filter((x) => !x.img).map((x) => x.sel.id);
  if (missingImg.length) throw new Error("No image_url for: " + missingImg.join(", "));

  // related = up to 3 from same zone (prefer same state first), excluding self
  const outDir = path.join(__dirname, "..", "nutrition");
  fs.mkdirSync(outDir, { recursive: true });
  for (const x of all) {
    const sameState = all.filter((y) => y !== x && y.state === x.state);
    const sameZone = all.filter((y) => y !== x && y.zone === x.zone && y.state !== x.state);
    const related = [...sameState, ...sameZone].slice(0, 3);
    const dir = path.join(outDir, x.sel.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), renderPage(x, related));
  }
  fs.writeFileSync(path.join(outDir, "index.html"), renderIndex(all));

  // sitemap.xml — static pages + nutrition hub + 56 dish pages
  const today = "2026-06-13";
  const statics = [
    ["/", "1.0", "weekly"], ["/waitlist.html", "0.9", "weekly"],
    ["/legal/", "0.3", "yearly"], ["/legal/privacy.html", "0.3", "yearly"],
    ["/legal/terms.html", "0.3", "yearly"], ["/legal/refund.html", "0.3", "yearly"],
    ["/legal/disclaimer.html", "0.3", "yearly"], ["/legal/support.html", "0.3", "yearly"],
  ];
  const urls = [
    ...statics.map(([loc, pr, cf]) => ({ loc, pr, cf })),
    { loc: "/nutrition/", pr: "0.8", cf: "weekly" },
    ...all.map((x) => ({ loc: `/nutrition/${x.sel.slug}/`, pr: "0.7", cf: "monthly" })),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${SITE}${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.cf}</changefreq>
    <priority>${u.pr}</priority>
  </url>`).join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(__dirname, "..", "sitemap.xml"), sitemap);

  console.log(`Built ${all.length} dish pages + /nutrition/ index + sitemap (${urls.length} urls)`);
}
main().catch((e) => { console.error(e); process.exit(1); });
