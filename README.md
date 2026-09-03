# Baltasar Luco — Personal Site

Modern single-page site with smooth section fades, a dark/light theme toggle, an interactive spectral viewer, a photo gallery, and a brewing recipe page.

Design notes live in `docs/superpowers/specs/`. When you change `styles.css` or `app.js`, bump the `?v=` query on their `<link>`/`<script>` tags in `index.html` so browsers pick up the new files, and rebuild the minified copies with `npx esbuild <file> --minify --outfile=<file.min>`.

## Project Structure
```
.
  index.html                        # landing page and SPA shell (home, research, publications, about, contact)
  generate-photos.js                # rebuilds assets/img/photos/manifest.json
  assets/
    css/styles.css                  # core theme and layout (source)
    css/styles.min.css              # minified build
    css/spectral_viewer.css         # standalone spectral viewer styling (source)
    css/spectral_viewer.min.css     # minified build
    js/app.js                       # navigation, transitions, popout helper (source)
    js/app.min.js                   # minified build
    js/spectral_viewer.js           # spectral viewer logic (source)
    js/spectral_viewer.min.js       # minified build
    img/                            # site imagery (favicon, hero, project art, logos)
    img/photos/                     # photo originals + manifest.json; thumbs/ and large/ are generated
    pdfs/                           # downloadable PDFs (e.g. CV)
    video/                          # video assets
  pages/
    spectral_viewer.html            # standalone CSV spectra exploration tool
    columns_view.html               # helper window to inspect loaded columns
    brand-popout.html               # brick breaker easter egg
    PatagoniaBestBitter_20L.html    # homebrew recipe page
```

## Local Preview
- Serve the repo root with any static server, e.g. `python3 -m http.server 8080`
- Alternatively open `index.html` directly in a browser (some viewer features may require a server for file APIs).

## Photo Gallery
- Drop new images into `assets/img/photos/` (webp recommended). Originals can be any size; they are never served directly.
- Run `node generate-photos.js` to refresh `assets/img/photos/manifest.json` and generate the web-sized copies the site serves:
  `photos/thumbs/` (1000px, collage grid) and `photos/large/` (2000px, lightbox). Requires `cwebp`/`dwebp`.

## Performance notes
- The page background uses `assets/img/sky.webp` (1920px copy of the star-trail photo); the hero uses `Retrato-900.webp`.
- Cards use flat translucent panels, not backdrop blur, so the scroll effects stay cheap. Only the header blurs its backdrop.
- The time-lapse video and the photo collage only load and animate while they are on screen.

## Deployment
- Published as a GitHub Pages user site at `baltasarluco.github.io`.
- The Pages source is the `public` branch (root). Day-to-day work happens on `Developer` and is merged into `public` to deploy.
- Add a `CNAME` file in the repository root if you switch to a custom domain.
