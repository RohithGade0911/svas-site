// Svas Broth Reveal — landing intro (vanilla port of the owner's approved
// motion piece, Logo/svas-animation/svas-reveal-16x9-white.html — the 1.5MB
// prototype bundle re-implemented in a few KB so the landing stays fast).
// The curry-green disc settles in, the house-bowl mark draws itself, the
// window squares pop, golden broth fills the bowl, steam rises, then the
// "svas" lockup lands beside it. Plays once per session; click skips;
// prefers-reduced-motion users never see it.
(function () {
  "use strict";
  try {
    if (sessionStorage.getItem("svasIntro") === "1") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    sessionStorage.setItem("svasIntro", "1");
  } catch (e) {
    return; // storage blocked → never trap the user in a repeating intro
  }

  var SPEED = 1.25; // master timeline is 5.5s → ~4.4s wall time
  var REVEAL_END = 5.5;
  var HOLD = 0.25;

  // palette (brand tokens)
  var GREEN = "#2D6A2F", GREEN_DEEP = "#1F4D21", CREAM = "#FBEFD6",
      GOLD = "#E8A020", GOLD_LT = "#F2C25B", GOLD_DEEP = "#C9871A",
      RICE = "#FAFAF5", SPICE = "#3D2B1F";

  // mark geometry (600×600, disc r288) — verbatim from svas-geometry.jsx
  var ROOF = "M 206 245 L 300 138 L 394 245";
  var WALL = "M 225 224 L 225 322";
  var BOWL = "M 375 224 L 375 346 C 374 402 350 420 300 420 C 250 420 226 402 226 356 C 226 343 213 336 205 344 C 198 352 208 361 225 359 L 362 359";
  var BOWL_FILL = "M 226 359 L 362 359 L 375 359 C 374 402 350 420 300 420 C 250 420 226 402 226 359 Z";
  var STEAM = [
    "M 281 344 C 287.5 338.45, 287.5 331.05, 281 325.5 C 274.5 319.95, 274.5 312.55, 281 307 C 287.5 301.45, 287.5 294.05, 281 288.5 C 274.5 282.95, 274.5 275.55, 281 270",
    "M 300 346 C 307.5 339.1, 307.5 329.9, 300 323 C 292.5 316.1, 292.5 306.9, 300 300 C 307.5 293.1, 307.5 283.9, 300 277 C 292.5 270.1, 292.5 260.9, 300 254",
    "M 319 344 C 312.5 338.45, 312.5 331.05, 319 325.5 C 325.5 319.95, 325.5 312.55, 319 307 C 312.5 301.45, 312.5 294.05, 319 288.5 C 325.5 282.95, 325.5 275.55, 319 270",
  ];

  // easings
  function outCubic(t) { return --t * t * t + 1; }
  function inOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }
  function outBack(t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function clamp01(v) { return Math.max(0, Math.min(1, v)); }
  function seg(t, a, b, ease) { return ease(clamp01((t - a) / (b - a))); }

  var css =
    "#svas-intro{position:fixed;inset:0;z-index:9999;background:" + RICE + ";display:flex;" +
    "align-items:center;justify-content:center;gap:64px;cursor:pointer;transition:opacity .4s ease}" +
    "#svas-intro.out{opacity:0;pointer-events:none}" +
    "#svas-intro svg{width:min(38vw,42vh,340px);height:auto;display:block}" +
    "#svas-intro .lk{display:flex;flex-direction:column;align-items:flex-start}" +
    "#svas-intro .lk b{font-family:'Fraunces',Georgia,serif;font-weight:500;font-size:clamp(56px,9vw,104px);" +
    "line-height:1;letter-spacing:.01em;color:" + GREEN_DEEP + "}" +
    "#svas-intro .lk i{font-family:'Plus Jakarta Sans',system-ui,sans-serif;font-style:normal;font-weight:500;" +
    "font-size:clamp(11px,1.5vw,18px);letter-spacing:.34em;text-transform:uppercase;color:" + SPICE + ";margin-top:.7em}" +
    "#svas-intro .dv{display:flex;align-items:center;gap:9px;margin-top:18px;transform-origin:left}" +
    "#svas-intro .dv s{width:4px;height:4px;border-radius:50%;background:" + GOLD + ";display:block}" +
    "#svas-intro .dv u{width:48px;height:2px;border-radius:2px;background:" + GOLD + ";display:block}" +
    "@media (max-width:640px){#svas-intro{flex-direction:column;gap:28px}" +
    "#svas-intro svg{width:min(56vw,40vh)}#svas-intro .lk{align-items:center}#svas-intro .dv{transform-origin:center}}";

  var root = document.createElement("div");
  root.id = "svas-intro";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    '<style>' + css + '</style>' +
    '<svg viewBox="0 0 600 600">' +
    '<defs>' +
    '<radialGradient id="svGlow" cx="50%" cy="60%" r="32%">' +
    '<stop offset="0%" stop-color="' + GOLD + '" stop-opacity=".2"/>' +
    '<stop offset="55%" stop-color="' + GOLD + '" stop-opacity=".07"/>' +
    '<stop offset="100%" stop-color="' + GOLD + '" stop-opacity="0"/></radialGradient>' +
    '<linearGradient id="svBroth" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + GOLD_LT + '"/><stop offset="100%" stop-color="' + GOLD_DEEP + '"/></linearGradient>' +
    '<clipPath id="svBowl"><path d="' + BOWL_FILL + '"/></clipPath>' +
    '</defs>' +
    '<g id="svDisc"><circle cx="300" cy="300" r="288" fill="' + GREEN + '"/>' +
    '<circle id="svGlowC" cx="300" cy="300" r="288" fill="url(#svGlow)" opacity="0"/></g>' +
    '<g transform="translate(300 311) scale(1.32) translate(-300 -300)">' +
    '<g clip-path="url(#svBowl)"><rect id="svFill" x="200" y="419" width="200" height="0" fill="url(#svBroth)"/>' +
    '<ellipse id="svSurf" cx="300" cy="419" rx="92" ry="6" fill="' + GOLD_LT + '" opacity="0"/></g>' +
    '<g fill="none" stroke="' + CREAM + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">' +
    '<path id="svRoof" d="' + ROOF + '" pathLength="1"/>' +
    '<path id="svWall" d="' + WALL + '" pathLength="1"/>' +
    '<path id="svBowlP" d="' + BOWL + '" pathLength="1"/></g>' +
    '<g id="svWin" fill="' + CREAM + '"></g>' +
    '<g fill="none" stroke="' + GOLD + '" stroke-width="8" stroke-linecap="round" stroke-linejoin="round">' +
    STEAM.map(function (d, i) { return '<path class="svSteam" id="svSt' + i + '" d="' + d + '" pathLength="1"/>'; }).join("") +
    '</g></g></svg>' +
    '<div class="lk"><b id="svWord">svas</b><i id="svTag">Established in Yourself</i>' +
    '<div class="dv" id="svDiv"><s></s><u></u><s></s></div></div>';

  function mount() {
    document.body.appendChild(root);
    var $ = function (id) { return root.querySelector("#" + id); };

    // window squares (centre 300,228; 20px, gap 9)
    var winG = $("svWin");
    var squares = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(function (sxy, i) {
      var r = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      var cx = 300 + sxy[0] * 14.5, cy = 228 + sxy[1] * 14.5;
      r.setAttribute("rx", "4.5");
      winG.appendChild(r);
      return { el: r, cx: cx, cy: cy, i: i };
    });

    var dashEls = [
      { el: $("svRoof"), get: function (P) { return inOutSine(clamp01(P.draw / 0.26)); } },
      { el: $("svWall"), get: function (P) { return outCubic(clamp01((P.draw - 0.2) / 0.16)); } },
      { el: $("svBowlP"), get: function (P) { return inOutSine(clamp01((P.draw - 0.3) / 0.7)); } },
      { el: $("svSt0"), get: function (P) { return clamp01((P.steam - 0) / 0.76); } },
      { el: $("svSt1"), get: function (P) { return clamp01((P.steam - 0.12) / 0.76); } },
      { el: $("svSt2"), get: function (P) { return clamp01((P.steam - 0.24) / 0.76); } },
    ];
    dashEls.forEach(function (d) { d.el.style.strokeDasharray = "1"; });

    var disc = $("svDisc"), glow = $("svGlowC"), fill = $("svFill"), surf = $("svSurf");
    var word = $("svWord"), tag = $("svTag"), div = $("svDiv");
    var done = false, start = null;

    function frame(now) {
      if (done) return;
      if (start == null) start = now;
      var t = ((now - start) / 1000) * SPEED;

      var P = {
        disc: seg(t, 0, 0.85, outCubic),
        draw: seg(t, 0.55, 2.7, inOutSine),
        win: seg(t, 2.55, 3.0, function (x) { return x; }),
        fill: seg(t, 2.7, 4.1, inOutSine),
        steam: seg(t, 4.0, 4.78, outCubic),
        word: seg(t, 4.35, 4.9, outCubic),
        tag: seg(t, 4.72, 5.18, outCubic),
        div: seg(t, 4.98, 5.44, outCubic),
      };

      var dsc = 0.82 + 0.18 * P.disc;
      disc.setAttribute("transform", "translate(300 300) scale(" + dsc + ") translate(-300 -300)");
      disc.setAttribute("opacity", clamp01(P.disc * 1.25));
      glow.setAttribute("opacity", P.steam);

      dashEls.forEach(function (d) { d.el.style.strokeDashoffset = 1 - d.get(P); });

      var level = 419 - P.fill * 59; // bowl floor 419 → just under the rim 360
      fill.setAttribute("y", level);
      fill.setAttribute("height", 419 - level + 4);
      surf.setAttribute("cy", level);
      surf.setAttribute("opacity", P.fill > 0.001 ? 0.9 : 0);

      squares.forEach(function (s) {
        var local = clamp01((P.win - s.i * 0.1) / (1 - s.i * 0.1));
        var sc = Math.min(outBack(local), 1.3);
        var sz = 20 * Math.max(sc, 0);
        s.el.setAttribute("x", s.cx - sz / 2);
        s.el.setAttribute("y", s.cy - sz / 2);
        s.el.setAttribute("width", sz);
        s.el.setAttribute("height", sz);
        s.el.setAttribute("opacity", clamp01(local * 1.6));
      });

      word.style.opacity = P.word;
      word.style.transform = "translateY(" + 24 * (1 - P.word) + "px)";
      tag.style.opacity = P.tag * 0.82;
      tag.style.transform = "translateY(" + 10 * (1 - P.tag) + "px)";
      div.style.opacity = P.div;
      div.style.transform = "scaleX(" + (0.4 + 0.6 * P.div) + ")";

      if (t >= REVEAL_END + HOLD) finish();
      else requestAnimationFrame(frame);
    }

    function finish() {
      if (done) return;
      done = true;
      root.classList.add("out");
      setTimeout(function () { root.remove(); }, 450);
    }

    root.addEventListener("click", finish);
    requestAnimationFrame(frame);
    // hard ceiling — the intro must never trap the page (throttled tabs etc.)
    setTimeout(finish, (REVEAL_END / SPEED + HOLD) * 1000 + 1200);
  }

  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
