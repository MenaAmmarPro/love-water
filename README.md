# Two of Us, Water 💧

A gentle water tracker for **Mena** and **Ammar**. Water is the smallest kind of
looking after each other — one glass at a time.

Live at **https://menaammarpro.github.io/love-water/**

## What it does

- **A ring for today** that fills as you drink, and turns gold when you reach
  the goal.
- **Add or remove a glass** with one tap; every glass is saved.
- **A row of little glasses** fills up so you can see the day at a glance.
- **Fourteen days of bars** — the last two weeks, with goal days standing out in
  gold and today's bar marked.
- **A streak** of days in a row reaching the goal — today only counts once you
  get there, so a morning glance never looks like a broken streak. A best-ever
  streak sits beside it.
- **A daily goal** you can raise or lower (1–20 glasses; 8 by default), with a
  millilitre estimate.
- **A gentle reminder** — an optional notification that arrives at most once an
  hour, and only while the page is open. Nothing is ever sent anywhere.

## Files

```
index.html               the page
css/app.css              page styles (on top of the shared love theme)
css/theme.css            shared love theme  (copy of _love-theme/theme.css)
js/app.js                all logic + rendering, publishes window.MenaWater
js/theme-main.js         shared header/theme/nav behaviour (_love-theme/main.js)
js/effects.js            heart bursts + toasts, service-worker registration
manifest.webmanifest     PWA metadata
sw.js                    offline cache (mena-water-v1)
test/harness.js          dependency-free test harness (node test/harness.js)
assets/favicon.svg       the little heart icon
```

## Data

Everything lives in this browser only, under the `localStorage` key
`mena-water`:

```json
{ "goal": 8, "log": { "YYYY-MM-DD": 3 }, "remind": false }
```

No accounts, no tracking, no network requests. The reminder uses the browser's
own Notification API and only while the page is open.

## Tests

```sh
node --check js/app.js
node test/harness.js
```

`test/harness.js` loads `js/app.js` in a fake-DOM sandbox and checks the pure
logic on `window.MenaWater` — date handling, the goal clamp, the log (add,
remove, tidy, totals), the streak and best streak, the fourteen-day history,
and the ring geometry.

## Running locally

It is a plain static site — open `index.html`, or serve the folder:

```sh
python -m http.server
```

## License

CC BY-NC-ND 4.0 — see [LICENSE](LICENSE). Made with care ♥ for Mena.
