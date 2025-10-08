# Baltasar Luco — Personal Site

Modern single-page site with smooth section fades plus an interactive spectral viewer and mini game popout.

## Project Structure
```
public/
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
- Serve the site with any static server pointing to `public`, e.g.
  - `python3 -m http.server 8080 --directory public`
- Alternatively open `public/index.html` directly in a browser (some viewer features may require a server for file APIs).

## Deployment
- Publish the contents of `public/` on your static host of choice.
- For GitHub Pages you can either keep the site in `main` and adjust the GitHub Pages source to a `gh-pages` branch generated from `public/`, or use an action/workflow that uploads the `public/` folder to the `gh-pages` branch.
- Keep `public/CNAME` only if you want GitHub Pages to serve a custom domain; otherwise delete it.
- `public/robots.txt` is optional. Remove or adjust it if you need different crawler rules.
