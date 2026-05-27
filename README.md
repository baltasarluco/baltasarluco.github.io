# Baltasar Luco — Personal Site

Modern single-page site with smooth section fades, an interactive spectral viewer, a photo gallery, and a brewing recipe page.

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
    img/photos/                     # photo gallery (webp) + manifest.json
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
- Drop new images into `assets/img/photos/` (webp recommended).
- Run `node generate-photos.js` to refresh `assets/img/photos/manifest.json`.

## Deployment
- Published as a GitHub Pages user site at `baltasarluco.github.io`.
- The Pages source is the `public` branch (root). Day-to-day work happens on `Developer` and is merged into `public` to deploy.
- Add a `CNAME` file in the repository root if you switch to a custom domain.
