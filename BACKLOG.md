# svas-site backlog

Pages that are built and ready but intentionally NOT live yet.

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
