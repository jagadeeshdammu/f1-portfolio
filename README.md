# 🏎️ DJ Racing: F1-themed developer portfolio

**Live site → https://jagadeeshdammu.github.io/f1-portfolio/**

Portfolio of **Dammu Jagadeesh**, Full Stack Developer (Angular · Java · Spring Boot) in Bengaluru, styled as a Formula 1 race weekend.

| Page | What's there |
|---|---|
| 🎮 **Play (home)** | A playable top-down F1 game on canvas: drive (WASD / arrows / touch pedals) through 4 sector gates that unlock my profile, skills, projects and contact. Live speedo, lap timer, minimap, DRS boost pads, skid marks, engine sound, auto-drive and best-lap memory |
| 🚦 **Story** | Start lights, a car fly-by over a 3D track, letter-by-letter name reveal, live-timing ticker, scroll-reveal career timeline |
| 🔧 **Skills Garage** | Each skill as a car part with an animated rev gauge, filters and a setup panel |
| 🏁 **Projects Pit Stop** | Project cards that open a 3-sector pit-stop report: problem, what I built, result |
| 📻 **Finish Line** | Validated contact form (reactive forms) + contact channels |

## Built with

- **Angular 19**: standalone components, no NgModules
- **Signals** (`signal`, `computed`) for all UI state
- **New control flow**: `@if` and `@for` in every template
- **Lazy-loaded routes**: each page is its own JS chunk
- **Reactive Forms** with validators on the contact page
- **SCSS**, CSS animations, `prefers-reduced-motion` support, fully responsive
- **GitHub Actions** builds and deploys to GitHub Pages on every push

## Run locally

```bash
npm install
npm start          # http://localhost:4200
npm run build      # production build in dist/
```

## Project structure

```
src/app/
├── app.component.ts        # navbar, footer, router outlet
├── app.routes.ts           # lazy-loaded routes
├── data/profile.data.ts    # all content: skills, career laps, projects
└── pages/
    ├── start/              # start lights, stats, race history
    ├── skills/             # skills garage with gauges
    ├── projects/           # project cards + pit-stop modal
    └── contact/            # reactive form + channels
```

All content lives in `src/app/data/profile.data.ts`, so updating the portfolio means editing one file.

---

📫 [LinkedIn](https://www.linkedin.com/in/jagadeesh-dammu-254260252/) · jagadeeshdammu2002@gmail.com
