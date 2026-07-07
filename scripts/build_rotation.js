#!/usr/bin/env node
// Builds assets/rotation-data.js - the curated dish rotation that powers the
// homepage hero + waitlist showcase + the "India's food" gallery.
//
// Sources (NEVER hand-edit the numbers - core rule: macros are NIN-computed):
//   - ../food-database/dishes_mvp.csv            native names (native-speaker verified)
//   - ../food-database/layer3-dishes/dish_macros.csv  per-serving macros (generated)
//   - Supabase catalog.dishes.image_url          dish photos (public read)
//
// Run from svas-site/:  node scripts/build_rotation.js
// Re-run whenever a curated dish's recipe/macros change, then commit the output.

const fs = require("fs");
const path = require("path");

const SUPABASE_URL = "https://jtschfacrjsynryiyyyk.supabase.co";
const KEY = "sb_publishable_2uL2zVf_cpObToPtKODMZw_cH0c8TIe"; // publishable - safe

// Curated picks - the most homely, recognizable dish per state.
// HERO: 8 states, all 8 native scripts distinct (Telugu, Tamil, Malayalam,
// Kannada, Gurmukhi, Gujarati, Bengali, Devanagari).
const HERO = [
  ["tel_pesarattu", "Andhra Pradesh"],
  ["pun_rajma_chawal", "Punjab"],
  ["kl_puttu", "Kerala"],
  ["gj_dhokla", "Gujarat"],
  ["tn_ven_pongal", "Tamil Nadu"],
  ["bn_macher_jhol", "West Bengal"],
  ["kn_bisi_bele_bath", "Karnataka"],
  ["mh_kanda_poha", "Maharashtra"],
];
// TICKER: ~48 famous homely dishes for the 3-row native-names marquee
// ("India's food. One place."). No photos needed - name/native/state/macros.
// Grouped by region on purpose: rows are dealt i%3, so consecutive same-script
// names land on different rows and every row mixes scripts.
const TICKER = [
  ["tel_pesarattu", "Andhra Pradesh"], ["tel_pulihora", "Andhra Pradesh"],
  ["tel_gongura_pachadi", "Andhra Pradesh"], ["tel_gutti_vankaya", "Andhra Pradesh"],
  ["tel_sarva_pindi", "Telangana"], ["tel_idli", "Andhra Pradesh"], ["tel_upma", "Andhra Pradesh"],
  ["tn_ven_pongal", "Tamil Nadu"], ["tn_sambar", "Tamil Nadu"], ["tn_tamil_rasam", "Tamil Nadu"],
  ["tn_kootu", "Tamil Nadu"], ["tn_idiyappam", "Tamil Nadu"], ["tn_appam", "Tamil Nadu"],
  ["kl_puttu", "Kerala"], ["kl_kadala_curry", "Kerala"], ["kl_meen_curry", "Kerala"],
  ["kn_bisi_bele_bath", "Karnataka"], ["kn_neer_dosa", "Karnataka"], ["kn_ragi_mudde", "Karnataka"],
  ["pun_rajma_chawal", "Punjab"], ["pun_sarson_saag", "Punjab"], ["pun_chole_masala", "Punjab"],
  ["pun_kadhi_pakora", "Punjab"], ["pun_dal_makhani", "Punjab"], ["pun_aloo_paratha", "Punjab"],
  ["gj_dhokla", "Gujarat"], ["gj_khandvi", "Gujarat"], ["gj_undhiyu", "Gujarat"],
  ["bn_macher_jhol", "West Bengal"], ["bn_shukto", "West Bengal"], ["bn_luchi", "West Bengal"],
  ["bn_aloo_posto", "West Bengal"], ["bn_cholar_dal", "West Bengal"], ["bn_kosha_mangsho", "West Bengal"],
  ["mh_kanda_poha", "Maharashtra"], ["mh_misal_pav", "Maharashtra"], ["mh_varan_bhaat", "Maharashtra"],
  ["mh_thalipeeth", "Maharashtra"], ["mh_zunka", "Maharashtra"],
  ["od_dalma", "Odisha"], ["od_pakhala_bhata", "Odisha"],
  ["bh_litti_chokha", "Bihar"], ["bh_sattu_paratha", "Bihar"],
  ["rj_dal_baati_churma", "Rajasthan"], ["rj_gatte_ki_sabzi", "Rajasthan"],
  ["up_tehri", "Uttar Pradesh"], ["mp_poha_jalebi", "Madhya Pradesh"],
  ["hp_siddu", "Himachal Pradesh"], ["hp_chana_madra", "Himachal Pradesh"],
  ["ks_rogan_josh", "Kashmir"], ["sk_thukpa", "Sikkim"],
  ["as_masor_tenga", "Assam"], ["ga_fish_curry", "Goa"],
];

// minimal CSV parser (quoted fields, LF lines)
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch !== "\r") field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function loadCsvById(file, idCol) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = rows[0];
  const map = {};
  for (const r of rows.slice(1)) {
    if (!r[0]) continue;
    const rec = {};
    header.forEach((h, i) => (rec[h] = r[i]));
    map[rec[idCol]] = rec;
  }
  return map;
}

async function main() {
  const root = path.join(__dirname, "..", "..");
  const dishes = loadCsvById(path.join(root, "food-database", "dishes_mvp.csv"), "dish_id");
  const macros = loadCsvById(path.join(root, "food-database", "layer3-dishes", "dish_macros.csv"), "dish_id");

  const ids = HERO.map(([id]) => id); // only hero needs photos
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/dishes?select=dish_id,image_url&dish_id=in.(${ids.join(",")})`,
    { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "catalog" } }
  );
  if (!res.ok) throw new Error(`Supabase ${res.status}`);
  const imgs = Object.fromEntries((await res.json()).map((r) => [r.dish_id, r.image_url]));

  // marketing display name: strip parentheticals / alternatives ("Pulihora
  // (tamarind rice)" → "Pulihora", "Chole / Chana Masala" → "Chole")
  const clean = (n) => n.split(" (")[0].split(" / ")[0].split(" (+")[0].trim();

  function build([id, state], needImg) {
    const d = dishes[id], m = macros[id], img = imgs[id];
    if (!d) throw new Error(`${id}: not in dishes_mvp.csv`);
    if (!m) throw new Error(`${id}: not in dish_macros.csv`);
    if (needImg && !img) throw new Error(`${id}: no image_url in Supabase`);
    if (!d.native_name || !/[^\x00-\x7F]/.test(d.native_name))
      throw new Error(`${id}: no native-script name - pick another dish`);
    const rec = {
      id,
      state,
      name: clean(d.display_name),
      native: d.native_name,
      kcal: Math.round(+m.kcal),
      p: Math.round(+m.protein_g),
    };
    if (needImg) {
      rec.f = Math.round(+m.fat_g);
      rec.c = Math.round(+m.carb_g);
      rec.img = img; // raw object URL - hero.js rewrites to the render endpoint
    }
    return rec;
  }

  const hero = HERO.map((x) => build(x, true));
  const ticker = TICKER.map((x) => build(x, false));

  const out =
    "// GENERATED by scripts/build_rotation.js - do not hand-edit.\n" +
    "// Macros are per serving, NIN-computed (IFCT-2017). Native names native-speaker verified.\n" +
    "window.SVAS_ROTATION = " + JSON.stringify({ hero, ticker }, null, 1) + ";\n";
  fs.writeFileSync(path.join(__dirname, "..", "assets", "rotation-data.js"), out);
  console.log(`rotation-data.js: ${hero.length} hero + ${ticker.length} ticker dishes`);
  for (const d of hero) console.log(`  ${d.state}: ${d.name} (${d.native}) ${d.kcal} kcal / ${d.p}g P`);
}

main().catch((e) => { console.error(e); process.exit(1); });
