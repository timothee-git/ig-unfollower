# Unfollowed — Instagram Follower Checker

> Find who doesn't follow you back on Instagram.  
> 100% client-side. No login. No server. No data ever leaves your browser.

---

## Getting started

### 1. Open in a browser
Just open `index.html` in any modern browser — no build step, no npm install, no server needed.

```
double-click index.html
```

Or use VS Code's Live Server extension for hot reloading during development.

---

### 2. Get your Instagram data

1. Open **Instagram** → Settings → **Your activity** → **Download your information**
2. Select **JSON** format (not HTML — the parser only handles JSON)
3. You'll receive an email with a download link, usually within 30 minutes
4. Unzip the archive
5. Navigate to `connections/followers_and_following/`
6. Locate:
   - `followers_1.json` (or `followers.json` on older exports)
   - `following.json`

---

### 3. Use the app

1. Upload both files using the drop zones (drag & drop also works)
2. Click **Analyze**
3. Search, sort, and browse results
4. Export to CSV if needed

---

## Project structure

```
ig-unfollower/
├── index.html          # Semantic, accessible HTML shell
├── css/
│   └── styles.css      # Full design system — dark mode, responsive, motion-safe
└── js/
    ├── parser.js        # JSON parsing — handles all known Instagram export formats
    ├── ui.js            # DOM rendering, accessible announcements, avatar generation
    └── app.js           # Main controller — state, events, theme, CSV export
```

---

## Features

- **All Instagram JSON formats** supported — 2019 through 2024+ export structures
- **Dark mode** — respects system preference, user-toggleable, persisted to localStorage
- **Fully accessible** — skip link, ARIA live regions, keyboard-navigable drop zones, screen reader announcements
- **Responsive** — works from 320px wide mobile to desktop
- **Reduced motion** — respects `prefers-reduced-motion`
- **Search with highlighting** — real-time filtering with matched text highlighted
- **Sort options** — alphabetical (A→Z, Z→A) or by follow date (newest/oldest)
- **CSV export** — UTF-8 BOM encoded for Excel compatibility, datestamped filename
- **No dependencies** — no npm, no bundler, no framework; just HTML + CSS + vanilla JS

---

## Accessibility

- Skip link for keyboard users
- All interactive elements reachable via keyboard
- Drop zones support Enter and Space activation
- ARIA live regions announce result counts to screen readers
- Error messages use `role="alert"` with `aria-live="assertive"`
- Contrast ratios meet WCAG AA minimums in both light and dark modes
- `prefers-reduced-motion` disables all CSS animations

---

## Browser support

Works in all modern browsers (Chrome 90+, Firefox 90+, Safari 14+, Edge 90+).  
No IE support — uses `Array.flatMap`, `Optional chaining`, `CSS custom properties`.

---

## Privacy

All processing happens locally in your browser using the [FileReader API](https://developer.mozilla.org/en-US/docs/Web/API/FileReader).  
No data is uploaded anywhere. No analytics. No cookies.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| "Could not find any users" error | Make sure you selected the JSON export, not HTML |
| File won't parse | Try the other followers file — some exports use `followers_1.json`, others `followers.json` |
| Timestamps show as "followed Jan 1970" | Your export may not include timestamps — this is normal for some accounts |
| Results seem wrong | Re-download your data — Instagram exports can take up to 48 hours to include recent changes |

---

## License

MIT — do whatever you like with it.
