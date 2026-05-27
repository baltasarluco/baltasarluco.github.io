// Year
document.addEventListener('DOMContentLoaded', () => {
  const y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();
});

// Mobile nav toggle
const nav = document.querySelector('[data-nav]');
const toggle = document.querySelector('.nav-toggle');
if (toggle && nav) {
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

// Tools dropdown
const toolsDropdown = document.getElementById('tools-dropdown');
const toolsToggle   = toolsDropdown && toolsDropdown.querySelector('.nav__dropdown-toggle');
if (toolsDropdown && toolsToggle) {
  toolsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = toolsDropdown.classList.toggle('is-open');
    toolsToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  // Close when clicking outside
  document.addEventListener('click', () => {
    toolsDropdown.classList.remove('is-open');
    toolsToggle.setAttribute('aria-expanded', 'false');
  });
  // Close when a menu item is clicked
  toolsDropdown.querySelectorAll('.nav__dropdown-item:not(.nav__dropdown-item--disabled)').forEach(item => {
    item.addEventListener('click', () => {
      toolsDropdown.classList.remove('is-open');
      toolsToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ===== Cross-fade router with queuing & click lock =====
const links = Array.from(document.querySelectorAll('.nav__link')).filter(a => a.dataset.navto);
const sections = Array.from(document.querySelectorAll('[data-section]'));
const map = new Map(sections.map(s => [s.dataset.section, s]));

const SCROLL_TOLERANCE = 1;
const OVERFLOW_RE = /(auto|scroll|overlay)/i;

const viewportFades = {
  top: null,
  bottom: null
};
let viewportFadesEnabled = false;
let viewportFadeRaf = null;

function getScrollContainer(){
  return document.scrollingElement || document.documentElement || document.body;
}

function hasScrollableAncestorWithRoom(target, delta){
  let node = target instanceof Element ? target : target && target.parentElement;
  while (node && node !== document.body && node !== document.documentElement){
    const style = window.getComputedStyle(node);
    if (OVERFLOW_RE.test(style.overflowY)){
      const max = node.scrollHeight - node.clientHeight;
      if (max > SCROLL_TOLERANCE){
        const top = node.scrollTop;
        if ((delta < 0 && top > SCROLL_TOLERANCE) || (delta > 0 && top < max - SCROLL_TOLERANCE)){
          return true;
        }
      }
    }
    node = node.parentElement;
  }
  return false;
}

function clampPageScroll(delta, target){
  if (!Number.isFinite(delta) || delta === 0) return false;
  if (hasScrollableAncestorWithRoom(target, delta)) return false;

  const scroller = getScrollContainer();
  const viewH = window.innerHeight || scroller.clientHeight || 0;
  if (viewH <= 0) return false;

  const scrollH = scroller.scrollHeight || 0;
  const maxScroll = Math.max(0, scrollH - viewH);
  let scrollTop = scroller.scrollTop;
  if (!Number.isFinite(scrollTop)) scrollTop = window.pageYOffset || 0;
  if (!Number.isFinite(scrollTop)) scrollTop = 0;

  if (delta < 0 && scrollTop <= SCROLL_TOLERANCE){
    if (scrollTop !== 0) scroller.scrollTop = 0;
    return true;
  }

  if (delta > 0 && scrollTop >= maxScroll - SCROLL_TOLERANCE){
    if (scrollTop !== maxScroll) scroller.scrollTop = maxScroll;
    return true;
  }

  return false;
}

function ensureViewportFades(){
  if (!viewportFades.top || !viewportFades.top.isConnected){
    viewportFades.top = document.querySelector('.viewport-fade.top');
    if (viewportFades.top) viewportFades.top.classList.add('is-visible');
  }
  if (!viewportFades.bottom || !viewportFades.bottom.isConnected){
    viewportFades.bottom = document.querySelector('.viewport-fade.bottom');
    if (viewportFades.bottom) viewportFades.bottom.classList.add('is-visible');
  }
  if (viewportFades.top) viewportFades.top.classList.add('is-visible');
  if (viewportFades.bottom) viewportFades.bottom.classList.add('is-visible');
  return viewportFades.top || viewportFades.bottom;
}

function applyViewportFades(){
  if (!viewportFadesEnabled) return;
  if (!ensureViewportFades()) return;
  const scroller = getScrollContainer();
  const viewH = window.innerHeight || scroller.clientHeight || 0;
  const scrollH = scroller.scrollHeight || 0;
  const maxScroll = Math.max(0, scrollH - viewH);
  let scrollTop = scroller.scrollTop;
  if (!Number.isFinite(scrollTop)) scrollTop = window.pageYOffset || 0;
  if (!Number.isFinite(scrollTop) || scrollTop < 0) scrollTop = 0;

  const nearTop = scrollTop <= SCROLL_TOLERANCE;
  const nearBottom = scrollTop >= maxScroll - SCROLL_TOLERANCE || maxScroll <= 0;
}

function queueViewportFadeUpdate(){
  if (!viewportFadesEnabled) return;
  if (viewportFadeRaf) return;
  viewportFadeRaf = requestAnimationFrame(() => {
    viewportFadeRaf = null;
    applyViewportFades();
  });
}

const wheelClampHandler = (event) => {
  if (clampPageScroll(event.deltaY, event.target)){
    event.preventDefault();
    queueViewportFadeUpdate();
  }
};

window.addEventListener('wheel', wheelClampHandler, { passive: false });

let lastTouchY = null;

window.addEventListener('touchstart', (event) => {
  if (event.touches.length === 1){
    lastTouchY = event.touches[0].clientY;
  } else {
    lastTouchY = null;
  }
}, { passive: true });

window.addEventListener('touchmove', (event) => {
  if (lastTouchY === null || event.touches.length !== 1) return;
  const currentY = event.touches[0].clientY;
  const delta = lastTouchY - currentY;
  if (clampPageScroll(delta, event.target)){
    event.preventDefault();
    queueViewportFadeUpdate();
  }
  lastTouchY = currentY;
}, { passive: false });

const resetTouchClamp = () => { lastTouchY = null; };
window.addEventListener('touchend', resetTouchClamp, { passive: true });
window.addEventListener('touchcancel', resetTouchClamp, { passive: true });

function enableViewportFades(){
  if (viewportFadesEnabled) return;
  if (!ensureViewportFades()) return;
  viewportFadesEnabled = true;
  const scroller = getScrollContainer();
  scroller.addEventListener('scroll', queueViewportFadeUpdate, { passive: true });
  window.addEventListener('resize', queueViewportFadeUpdate);
  queueViewportFadeUpdate();
}

function disableViewportFades(){
  if (!viewportFadesEnabled) return;
  viewportFadesEnabled = false;
  const scroller = getScrollContainer();
  scroller.removeEventListener('scroll', queueViewportFadeUpdate);
  window.removeEventListener('resize', queueViewportFadeUpdate);
  if (viewportFadeRaf){
    cancelAnimationFrame(viewportFadeRaf);
    viewportFadeRaf = null;
  }
  if (ensureViewportFades()){
    if (viewportFades.top) viewportFades.top.classList.remove('is-visible');
    if (viewportFades.bottom) viewportFades.bottom.classList.remove('is-visible');
  }
}
let currentId = null;
let isTransitioning = false;
let nextId = null;
const TRANSITION_MS = 300;
const TRANSITION_PAD = -100;

function setActiveLink(id){
  document.querySelectorAll('.nav__link').forEach(l => l.classList.remove('is-active'));
  const link = document.querySelector(`.nav__link[data-navto="${id}"]`);
  if (link) link.classList.add('is-active');
}

function setLinksDisabled(disabled){
  links.forEach(a => a.setAttribute('aria-disabled', disabled ? 'true' : 'false'));
}

function onTransitionEndOnce(el, cb){
  let done = false;
  const t = setTimeout(() => { if (!done){ done = true; el.removeEventListener('transitionend', handler); cb(); } }, TRANSITION_MS + TRANSITION_PAD);
  function handler(e){
    if (e.propertyName !== 'opacity') return;
    if (done) return;
    done = true;
    clearTimeout(t);
    el.removeEventListener('transitionend', handler);
    cb();
  }
  el.addEventListener('transitionend', handler);
}

function showSection(id, push = true){
  if (!map.has(id)) return;

  if (isTransitioning){
    nextId = id;
    return;
  }

  const target = map.get(id);
  const current = currentId ? map.get(currentId) : null;
  if (current === target) return;

  isTransitioning = true;
  setLinksDisabled(true);

  const fadeInTarget = () => {
    target.classList.remove('is-hidden');
    target.classList.add('is-enter');
    void target.offsetWidth;
    target.classList.add('is-visible');

    onTransitionEndOnce(target, () => {
      target.classList.remove('is-enter');
      isTransitioning = false;
      setLinksDisabled(false);

      if (nextId && nextId !== id){
        const queued = nextId;
        nextId = null;
        showSection(queued, true);
      } else {
        nextId = null;
      }
    });
  };

  if (current){
    current.classList.add('is-leave');

    onTransitionEndOnce(current, () => {
      current.classList.remove('is-leave');
      current.classList.add('is-hidden');
      fadeInTarget();
    });
  } else {
    fadeInTarget();
  }

  currentId = id;
  setActiveLink(id);
  setViewClass(id);
  if (push) history.replaceState(null, '', '#' + id);
}

links.forEach(a => {
  a.addEventListener('click', (e) => {
    const id = a.dataset.navto;
    if (!id) return;
    e.preventDefault();
    if (isTransitioning){ nextId = id; return; }
    showSection(id, true);
  });
});

function setViewClass(id){
  document.body.classList.toggle('view-research', id === 'research');
  enableViewportFades();
  queueViewportFadeUpdate();
}

function clearTransitionState() {
  isTransitioning = false;
  nextId = null;
  setLinksDisabled(false);
  sections.forEach(s => s.classList.remove('is-enter', 'is-visible', 'is-leave'));
}

function forceShowSection(id) {
  if (!map.has(id)) return;
  sections.forEach(s => {
    const on = s.dataset.section === id;
    s.classList.toggle('is-hidden', !on);
    s.classList.remove('is-enter', 'is-visible', 'is-leave');
  });
  currentId = id;
  setActiveLink(id);
}

window.addEventListener('pageshow', (e) => {
  clearTransitionState();

  const navEntry = (performance.getEntriesByType && performance.getEntriesByType('navigation') || [])[0];
  const isBackForward = (navEntry && navEntry.type === 'back_forward') || !!e.persisted;

  let restoreTarget = null;
  try { restoreTarget = sessionStorage.getItem('restoreTarget'); } catch(_) {}

  if ((isBackForward || (document.referrer && /viewer\.html(\b|$)/.test(document.referrer))) && restoreTarget) {
    history.replaceState(null, '', '#' + restoreTarget);
    forceShowSection(restoreTarget);
    setViewClass(restoreTarget);
    try { sessionStorage.removeItem('restoreTarget'); } catch(_) {}
    return;
  }

  const id = (location.hash || '#home').slice(1);
  const target = map.has(id) ? id : 'home';
  forceShowSection(target);
  setViewClass(target);
});

function initialSection(){
  const h = (location.hash || '').replace('#','').trim();
  return map.has(h) ? h : 'home';
}

document.addEventListener('DOMContentLoaded', () => {
  clearTransitionState();
  forceShowSection(initialSection());
  const id = (location.hash || '#home').slice(1);
  setViewClass(id);
});

window.addEventListener('hashchange', () => {
  const id = (location.hash || '').replace('#','');
  if (map.has(id)) {
    showSection(id, false);
  } else {
    setViewClass(id);
  }
});

const brandTrigger = document.getElementById('brand-trigger');
function openCenteredPopup(url, title, w, h) {
  const dualLeft = window.screenLeft !== undefined ? window.screenLeft : window.screenX;
  const dualTop  = window.screenTop  !== undefined ? window.screenTop  : window.screenY;
  const winW = window.outerWidth  || document.documentElement.clientWidth;
  const winH = window.outerHeight || document.documentElement.clientHeight;
  const left = Math.max(0, dualLeft + (winW - w) / 2);
  const top  = Math.max(0, dualTop  + (winH - h) / 2);
  const features = [
    "popup=yes","toolbar=no","location=no","status=no","menubar=no",
    "scrollbars=yes","resizable=yes",
    `width=${w}`, `height=${h}`, `left=${left}`, `top=${top}`
  ].join(",");
  const win = window.open(url, title, features);
  if (win && win.focus) win.focus(); else window.location.href = url;
}
if (brandTrigger){
  brandTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    openCenteredPopup("pages/brand-popout.html", "Brick Breaker", 540, 560);
  });
}

document.querySelectorAll('a[href$="viewer.html"]').forEach(a => {
  a.addEventListener('click', () => {
    try {
      sessionStorage.setItem('restoreTarget', 'home');
    } catch (_) {}
    history.replaceState(null, '', '#home');
  });
});

(function(){
  let started = false;
  let active = new Set();
  let ticking = false;

  function visFor(el){
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const c = r.top + r.height/2;

    const top0 = vh * 0.18, top1 = vh * 0.38;
    const bot1 = vh * 0.62, bot0 = vh * 0.82;

    if (c <= top0 || c >= bot0) return 0;
    if (c <  top1) return (c - top0) / (top1 - top0);
    if (c <= bot1) return 1;
    return 1 - (c - bot1) / (bot0 - bot1);
  }

  function update(){
    ticking = false;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      active.forEach(el => el.style.setProperty('--reveal', '1'));
      return;
    }
    active.forEach(el => {
      const v = visFor(el);
      el.style.setProperty('--reveal', v.toFixed(3));
      if (v > 0.01) el.classList.add('in-view'); else el.classList.remove('in-view');
    });
  }

  const onScroll = () => {
    if (!ticking){ ticking = true; requestAnimationFrame(update); }
  };

  function init(){
    if (started) return;
    started = true;

    const items = Array.from(document.querySelectorAll('[data-section="research"] [data-reveal]'));
    if (!items.length) return;

    const io = new IntersectionObserver((entries)=>{
      entries.forEach(e => {
        if (e.isIntersecting) { active.add(e.target); }
        else { active.delete(e.target); e.target.style.removeProperty('--reveal'); }
      });
      onScroll();
    }, { root: null, rootMargin: '20% 0% 20% 0%', threshold: [0, 0.01, 0.1, 0.5, 1] });

    items.forEach(el => io.observe(el));

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.addEventListener('hashchange', () => {
    const id = (location.hash || '').slice(1);
    if (id === 'research') init();
  });
})();

(function(){
  const mainEl = document.querySelector('.main');
  if (!mainEl) return;

  const pdfjsLib = window['pdfjsLib'];
  if (!pdfjsLib) return;

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const canvases = Array.from(document.querySelectorAll('canvas.pdf-thumb'));
  if (!canvases.length) return;

  async function renderThumb(canvas){
    const url  = canvas.dataset.pdf;
    const pageNum = parseInt(canvas.dataset.page || '1', 10);

    const loadingTask = pdfjsLib.getDocument(url);
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(pageNum);

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();

    const base = page.getViewport({ scale: 1 });
    const scale = Math.min((rect.width * dpr) / base.width, (rect.height * dpr) / base.height) || 1;
    const viewport = page.getViewport({ scale });

    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width  = Math.max(1, Math.floor(viewport.width));
    canvas.height = Math.max(1, Math.floor(viewport.height));

    await page.render({ canvasContext: ctx, viewport }).promise;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      const c = e.target;
      if (e.isIntersecting && !c.dataset.rendered){
        c.dataset.rendered = '1';
        renderThumb(c).catch(console.error);
      }
    });
  }, { root: null, rootMargin: '200px 0px', threshold: 0.01 });

  canvases.forEach(c => io.observe(c));

  let rAF = null;
  function rerenderVisible(){
    if (rAF) return;
    rAF = requestAnimationFrame(() => {
      rAF = null;
      document.querySelectorAll('canvas.pdf-thumb[data-rendered="1"]').forEach(c => {
        c.dataset.rendered = '';
        io.observe(c);
      });
    });
  }
  window.addEventListener('resize', rerenderVisible);
})();

(function(){
  const card = document.getElementById('proj-3i');
  if (!card) return;

  const body = card.querySelector('.card__body');
  const media = card.querySelector('.card__media');
  const img = media && media.querySelector('img');
  if (!body || !media || !img) return;

  const mqMobile = window.matchMedia('(max-width: 900px)');

  function applySizing(){
    if (mqMobile.matches){
      media.style.width = '';
      img.style.height = '';
      img.style.width = '';
      return;
    }

    const textH = body.offsetHeight || 0;
    if (!textH) return;

    const ratio = (img.naturalWidth && img.naturalHeight)
      ? (img.naturalWidth / img.naturalHeight)
      : 1.6;

    const targetW = Math.round(textH * ratio);

    media.style.width = targetW + 'px';
    img.style.height = textH + 'px';
    img.style.width  = 'auto';
  }

  const reflow = () => requestAnimationFrame(applySizing);
  if (img.complete) applySizing(); else img.addEventListener('load', reflow);

  window.addEventListener('resize', reflow, { passive: true });
  mqMobile.addEventListener('change', reflow);

  if ('ResizeObserver' in window){
    const ro = new ResizeObserver(reflow);
    ro.observe(body);
  }

  window.addEventListener('hashchange', () => setTimeout(reflow, 450));
  document.addEventListener('DOMContentLoaded', reflow);
  window.addEventListener('pageshow', reflow);
})();

// ============================================================
// 7. Ping-Pong Video Playback (Forward & Backward Loop)
// ============================================================
(function(){
  const video = document.getElementById('photoVideo');
  if (!video) return;

  let isPlayingBackward = false;
  let animationFrameId = null;
  let lastTime = null;
  const targetFPS = 60; // Target 60fps for smoother backward playback
  const frameTime = 1000 / targetFPS;
  let accumulator = 0;
  
  // Function to handle backward playback with frame limiting for smoothness
  function playBackward(timestamp) {
    if (!lastTime) {
      lastTime = timestamp;
      animationFrameId = requestAnimationFrame(playBackward);
      return;
    }
    
    const elapsed = timestamp - lastTime;
    accumulator += elapsed;
    
    // Limit updates to target FPS to reduce seeking overhead
    if (accumulator >= frameTime) {
      const deltaTime = accumulator / 1000; // Convert to seconds
      accumulator = 0;
      
      if (video.currentTime <= 0.016) { // Small threshold for smoother transition
        // Reached the beginning, play forward again
        isPlayingBackward = false;
        lastTime = null;
        video.currentTime = 0;
        video.play();
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
          animationFrameId = null;
        }
        return;
      }
      
      // Decrement by the same rate as forward playback
      video.currentTime = Math.max(0, video.currentTime - deltaTime);
    }
    
    lastTime = timestamp;
    animationFrameId = requestAnimationFrame(playBackward);
  }
  
  // When video ends (playing forward), start playing backward
  video.addEventListener('ended', () => {
    if (!isPlayingBackward) {
      isPlayingBackward = true;
      lastTime = null;
      accumulator = 0;
      video.pause();
      animationFrameId = requestAnimationFrame(playBackward);
    }
  });
  
  // Ensure video plays on load
  video.addEventListener('loadeddata', () => {
    video.play().catch(err => {
      console.log('Autoplay prevented, waiting for user interaction');
      // If autoplay is blocked, try to play on user interaction
      const startOnClick = () => {
        video.play();
        document.removeEventListener('click', startOnClick);
      };
      document.addEventListener('click', startOnClick);
    });
  });
})();
