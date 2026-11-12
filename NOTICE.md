# NOTICE

## Upstream project and attribution

Gymmiie is a web reimplementation of the ideas, exercise catalogue, food
catalogue and training flows of **GymMane** by **InlitX**:

- https://github.com/InlitX/GymMane

## Licence

Gymmiie is free software: you can redistribute it and/or modify it under the
terms of the GNU General Public License version 3 as published by the Free
Software Foundation. The full text is in [LICENSE](LICENSE).

Gymmiie is distributed in the hope that it will be useful, but **without any
warranty**; without even the implied warranty of merchantability or fitness for
a particular purpose. See the GNU General Public License for more details.

## Third-party assets and data

- **Exercise catalogue / food catalogue / program concepts** — reverse-engineered
  from GymMane (GPL-3.0). Only structured names, categories and numeric/descriptive
  data are used; no upstream Dart source is shipped.
- **Exercise illustrations** — exercise animations in `public/art/` are from
  **Workout Guide** by Bryl Lim (<https://github.com/bryllim/workout-guide>),
  **Everkinetic** (<https://github.com/everkinetic/data>, <https://db.everkinetic.com>)
  and, as a fallback for exercises neither covers, GymMane's Everkinetic-derived
  pose data (<https://github.com/InlitX/gymmane>). All are licensed
  **CC BY-SA 4.0** — see [public/art/ATTRIBUTION.md](public/art/ATTRIBUTION.md)
  for the per-exercise provenance table and [public/art/LICENSE-ART](public/art/LICENSE-ART)
  for the licence text. Frames are re-emitted as compact multi-frame SVGs with a
  shared viewBox, `currentColor` fills and `fill-rule="evenodd"`; no shapes are redrawn.
- **Step-by-step instructions** — the preferred "How to perform it" steps and
  tips on exercise pages come from Everkinetic (CC BY-SA 4.0); exercises without
  an Everkinetic match fall back to the GymMane catalogue text. Everkinetic
  instructions are credited in-app wherever they are shown.
- **Lucide** — ISC licence, https://lucide.dev
- **Nunito** — SIL Open Font License 1.1, via Google Fonts.
- **OpenPowerlifting** — DOTS scoring coefficients.
- Nutrition values are approximate, compiled from common food databases, and are
  not medical advice.

Gymmiie is an independent project and is not affiliated with InlitX.
