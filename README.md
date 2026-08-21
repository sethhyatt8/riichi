# Riichi Scorer

Table-side scorekeeper for four-player riichi mahjong.

- Track seats, dealer, round wind, honba, and riichi sticks
- Score ron/tsumo from a yaku/fu checklist, or enter han/fu directly
- Apply exhaustive-draw tenpai/noten payments
- Undo the last scoring action

Live: [sethhyatt8.github.io/riichi](https://sethhyatt8.github.io/riichi/)

## Quick start

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

Pushes to `main` run `.github/workflows/deploy-pages.yml`.

`vite.config.ts` uses `base: './'` so the build works on a project Pages URL.
