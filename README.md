# Baltasar Luco — Personal Site

Modern single-page site with smooth section fades plus an interactive spectral viewer and mini game popout.

## Project Structure
```
.
  index.html                 # landing page and SPA shell
  robots.txt                 # crawler directives
  assets/
    css/styles.css           # core theme and layout (source)
    css/styles.min.css       # minified build
    css/spectral_viewer.css  # standalone spectral viewer styling (source)
    css/spectral_viewer.min.css  # minified build
    js/app.js                # navigation, transitions, popout helper (source)
    js/app.min.js            # minified build
    js/spectral_viewer.js    # spectral viewer logic (source)
    js/spectral_viewer.min.js  # minified build
    img/                      \
      favicon.png             > site imagery assets (JPEG originals + WebP variants)
  pages/
    spectral_viewer.html     # standalone spectra exploration tool
    columns_view.html        # helper window to inspect loaded columns
    brand-popout.html        # brick breaker easter egg
```

## Local Preview
- Serve the repo root with any static server, e.g. `python3 -m http.server 8080`
- Alternatively open `index.html` directly in a browser (some viewer features may require a server for file APIs).

## Deployment
- Publish the repository root on your static host of choice.
- For GitHub Pages (user site) select the `main` branch with `/` as the source so the root `index.html` is served.
- Update `robots.txt` or add a `CNAME` file in the repository root if you need custom crawler rules or a custom domain.
