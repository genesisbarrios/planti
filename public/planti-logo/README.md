# Planti logo kit

Less guessing. More growing.

Every file is centered on its visible shapes, with equal space on all sides.

## What's inside

| Folder | Contents | Use for |
|---|---|---|
| `00-main-logo-neon/` | **The main logo**: neon leaf and text, alone and with tagline, SVG and PNG, transparent | Your go-to logo, best on dark backgrounds |
| `logos/svg/` | Vector logos (text outlined, no fonts needed) | Web, print, anything that scales |
| `logos/png/` | Same logos at 1000px and 2000px wide | Docs, slides, quick uploads |
| `icon-colors/` | 9 color versions of the app icon: rounded, square and transparent, as SVG and PNG | App icons, profile pictures, stickers |
| `mark-colors/` | The leaf on its own in 6 colors, transparent background | Placing the leaf on photos or colored backgrounds |
| `app-icons/` | 1024 (App Store, square corners), 512 and 192 (web/Android), 180 (`apple-touch-icon.png`) | App and home-screen icons |
| `favicon/` | `favicon.ico` (16/32/48), `favicon.svg`, PNGs, plus transparent versions | Browser tabs |
| `social/` | Link preview 1200×630, banner 1500×500, avatar 400×400; transparent versions in `social/transparent/` | Social profiles, link previews |

## Transparent versions

Every logo in `logos/` and every leaf in `mark-colors/` already has a transparent background. Everything that comes with a background also has a transparent twin, marked `-transparent` in the file name:

- **Icons:** each `icon-colors/` folder has `-transparent.svg` plus 1024 and 512 PNGs (same leaf colors and padding, background removed).
- **Dark card:** `planti-logo-dark-card-transparent` in `logos/`.
- **Social:** `social/transparent/` has the link preview and banner in two versions (`for-dark` and `for-light`, which differ only in tagline color), plus the avatar.
- **Favicon:** `favicon-transparent.ico`, `.svg` and PNGs.

App Store and home-screen icons in `app-icons/` stay solid on purpose: Apple rejects transparent app icons and fills the gaps with black.

## Logos

- **planti-logo** — main logo, neon. Best on dark backgrounds.
- **planti-logo-tagline-on-dark / on-light** — with tagline; the tagline color is tuned for each background.
- **planti-logo-forest / forest-tagline** — forest green leaf and text with the neon growth line, for white or light backgrounds.
- **planti-logo-white / black** — white or black leaf and text with the neon growth line, for photos and merch.
- **planti-logo-white-bw / black-bw** — pure black-and-white, no neon, for one-color print, stamps and engraving.
- **planti-logo-dark-card** — logo and tagline on the deep green background.

Rule: whenever the leaf is dark green, white or black, the growth line and dot are neon. Only the `-bw` files break that rule.

## Icon colors

1. Neon on forest (primary)
2. Neon on deep
3. Forest on neon
4. Deep on neon
5. Forest on ivory
6. Neon on ivory
7. Ivory on forest
8. White on black
9. Black on white
10. White on black, pure black-and-white
11. Black on white, pure black-and-white

Leaf-only colors in `mark-colors/`: neon, forest, deep, ivory, white, black, plus `white-bw` and `black-bw`.

## Colors

| Name | Hex | Role |
|---|---|---|
| Neon | `#B6F23A` | Leaf, wordmark |
| Forest | `#1F4D3A` | Growth line, dot, icon background |
| Deep | `#12261C` | Dark backgrounds |
| Ivory | `#F8FAF5` | Light backgrounds |
| Sage | `#A9C4B4` | Tagline on dark |
| Moss | `#3B5C4B` | Tagline on light |

## Fonts (free, Google Fonts)

- **Outfit SemiBold (600)** — wordmark and headings
- **IBM Plex Mono Medium (500)** — tagline, uppercase with wide letter spacing

## Web snippet

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:image" content="/planti-og-1200x630.png">
```
