# svas-site backlog

Pages/changes that are built and ready but intentionally NOT live yet.

## Homepage: SvasAI + 3-tier pricing + health band (2026-07-06)
- **Status:** built + preview-verified, **held LOCAL — owner paused before deploy** (2026-07-06). Uncommitted working tree.
- **Files:** `index.html` + `styles.css` (bumped to `styles.css?v=12`). Also touched `waitlist.html` (SvasAI line), `legal/*`, `assets/hero.js` (em-dash sweep), and **all 264 `nutrition/**/index.html` pages + 28 `states/**/index.html` + `scripts/build_nutrition.js`** (per-dish `src-note` → short "estimates, not medical advice" line; nut-cta gained an "Ask SvasAI about any dish / log from a photo" line + dropped the "3,000+ dishes" count). No new assets (all animators are inline JS).
- **Legal pages (2026-07-07):** `legal/terms.html` pricing → 3-tier + new "SvasAI and AI features" §4 (renumbered 1–10); `legal/privacy.html` adds Sarvam/Gemini/OpenAI as AI sub-processors + SvasAI-chat & Smart-Scan-photo disclosures (⚠ app must honor: delete-account wipes chat, scan photos not repurposed).
- **What changed:** added a **Meet SvasAI** band (warm copy + a live self-typing multilingual text chat **inside an iPhone frame** with a soft halo — Hinglish/English/Tamil/Telugu/Kannada; feature list + phone centered); a **"Built for your body"** band (**4** conditions — Diabetes/Blood pressure/Thyroid/PCOS — with hover/tap tooltips, minimal text); **removed** the "Built around your goals" section; made **"Plan your week"** live (rotates 10 states' regional home dishes) and **moved it below** the health band; **rebuilt pricing → 3 tiers** (Free / Pro ₹149·₹999 / Premium ₹249·₹1,799, monthly⇄annual toggle) per `../PRICING_AND_TIERS.md`; refreshed hero eyebrow + regional copy (**no dish counts**, "28 states" kept); fixed FAQ pricing + added AI/Smart-Scan Qs (+ JSON-LD); nav gained a SvasAI link; meta/OG mention SvasAI.
- **Before deploy (owner):** eyeball the chat animation in a real browser (the preview screenshot tool was blank all session); decide typing speed / loop length; native-speaker check on the Tamil/Telugu/Kannada/Hinglish lines.
- **To publish:** `git add -A && git commit && git push` → Vercel auto-builds www.svas.life. Detail: memory `svas-site-svasai-pricing-2026-07-06`.

## Svas vs HealthifyMe comparison page
- **Status:** built, held for the app launch (owner decision, 2026-06-25).
- **File:** `compare/svas-vs-healthifyme/index.html` (kept in the repo, fully complete).
- **Why held:** owner wants to publish it alongside the app launch, not before.
- **Currently:** excluded from deploy via `.vercelignore` (`compare/`), removed from
  `sitemap.xml` and from the `/nutrition/` hub "Go deeper" links.

### To publish it (at launch)
1. In `.vercelignore`, delete the `compare/` line (and its comment block).
2. In `scripts/build_nutrition.js`:
   - Re-add the sitemap entry: `{ loc: "/compare/svas-vs-healthifyme/", pr: "0.7", cf: "monthly" }`
     (the spot is marked with a `// /compare/... held for app launch` comment).
   - Re-add the nutrition-hub link card in the "Go deeper" section:
     `<a class="related-card" href="/compare/svas-vs-healthifyme/"><b>Svas vs HealthifyMe</b><span>An honest comparison</span></a>`
3. Run `node scripts/build_nutrition.js`, commit, push.
4. In Google Search Console, request indexing for `/compare/svas-vs-healthifyme/`.
