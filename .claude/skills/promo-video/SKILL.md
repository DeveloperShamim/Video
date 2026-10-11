---
name: promo-video
description: Make a short (10–30 s) motion-graphics promo video for a website, brand, shop or product and render it to MP4 (plus GIF and poster). Use when the user asks for a promo, ad, intro, explainer, reel or "motion graphics video" for a site or business, e.g. "create a 15 sec video for example.com". Builds an HTML + GSAP timeline scene from a proven template, renders it frame-accurately with headless Chromium and ffmpeg, and verifies frames before delivering.
---

# Promo video

Builds a promo as one HTML page driven by a single paused GSAP timeline, then captures it frame by frame at 30 fps.

Files in this skill:
- `template/index.html`: a complete 15 s, 1920×1080 e-commerce promo in 5 scenes (VANT BD). Copy it and change the content; keep its structure.
- `lib/`: `gsap.min.js`, `stage.js` (Motion harness: `Motion.timeline()`, `Motion.ready()`, `window.__seek`), `stage.css`.
- `scripts/render.mjs`: renders `index.html` to `clip.mp4`, `preview.gif` and `poster.jpg`. It serves `lib/*` from this skill, so a project folder only needs its `index.html`.

## Workflow

1. **Gather brand facts.** Fetch the site (WebFetch, or `curl`) for name, tagline, products/services, offers and brand colors. If the site can't be reached, ask the user what the business does (and for colors and a logo, if they have them). Never present invented claims as facts: in your final reply, list anything you made up (prices, offers, payment methods, products).
2. **Storyboard** 4–6 scenes that fit the duration. The default for 15 s: hook headline (0–3 s), what they sell (3–6.5 s), how it works or a product moment (6.5–10 s), benefits or trust (10–12.8 s), logo + URL + CTA (12.9–end, at least 0.5 s of hold).
3. **Build.** Copy `template/index.html` into `<project>/<name>-promo/index.html` and edit:
   - `<body data-dur="15" data-size="1920x1080" data-poster="14.6">`: duration in seconds, size (`1080x1920` for Reels/Shorts) and poster time.
   - Brand colors: the `:root` tokens (`--bg`, `--acc`, `--acc2`, `--mint` …) at the top of `<style>`.
   - Text, cards, icons and the logo mark in each `<section>`; the scene timings in the `<script>`.
   - Keep `<link href="lib/stage.css">` and the `lib/gsap.min.js` and `lib/stage.js` script tags.
4. **Render.**
   ```bash
   node .claude/skills/promo-video/scripts/render.mjs <project>/<name>-promo/index.html --out <project>/<name>-promo/out
   ```
   This takes about 3 minutes for 15 s at 1080p (run it in the background if you have other work). It needs Playwright Chromium and ffmpeg (both preinstalled in Claude Code cloud sessions).
5. **Verify** with a contact sheet, then read it as an image and look for overlaps, clipped text, empty frames and elements left on screen across scene changes:
   ```bash
   ffmpeg -v error -y -i out/clip.mp4 -vf "fps=0.6,scale=640:-1,tile=3x3" -frames:v 1 sheet.jpg
   ```
   Fix the problems, re-render and check again. Then send `out/clip.mp4` to the user (SendUserFile).

## Timeline rules (the harness enforces determinism)

- Exactly one timeline: `const tl = Motion.timeline(); … Motion.ready();`. Everything is placed at absolute times (`tl.to(sel, vars, 3.3)`).
- No `Math.random`, `Date.now`, CSS animations/transitions or `setTimeout`, because frames are captured by seeking the timeline. Use `Motion.rand(seed)` for randomness.
- Custom motion (paths, arcs, counters) uses a proxy object tween with `onUpdate`, e.g. `tl.to(o,{v:1,onUpdate:()=>gsap.set(el,{x:…})},t)`.
- Hide scenes with `gsap.set('#s2',{autoAlpha:0})` up front and switch them with `tl.set('#sN',{autoAlpha:1},t)`. Exit each scene's elements before the next scene enters.
- Mask reveals: wrap text in `<span class="mask"><span>…</span></span>`, start at `yPercent:110` and animate to `0`.
- For `fromTo` tweens on elements that are reused later, pass `immediateRender:false`.
- One focal action per scene plus one or two supporting moves. Ease out (`power3.out`, `back.out`) on entrances and ease in on exits.
- Fonts available in the container: Inter / Inter Display (text) and Noto Color Emoji (icons, `.emoji` class). Use `Tk`, not `৳`, for Bangladeshi taka (no glyph coverage).

## More motion ideas

For more effects (with parameters and reference clips), clone https://github.com/gongnyang/awesome-ai-motion and read its `references/decision-tables.md` and `effects/<slug>/README.md`. Its effects use the same `stage.js` harness, so their timeline code can be pasted into a scene directly.
