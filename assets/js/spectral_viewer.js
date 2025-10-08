window.addEventListener('DOMContentLoaded', function(){
  if(!window.Plotly || !window.JSZip){
    const message = 'Plotly or JSZip failed to load. Check your connection and reload.';
    alert(message); console.error(message); return;
  }

  const UI_REVISION = 'spectra-viewer-uirevision-1';
  const palette = ['#0ea5e9','#6366f1','#f97316','#10b981','#ef4444','#06b6d4','#facc15','#ec4899','#22c55e','#f59e0b'];

  // Modebar icons
  const undoIcon = { width:512, height:512, path:'M320 128 L160 256 L320 384 L320 296 L448 296 L448 216 L320 216 Z' };
  const redoIcon = { width:512, height:512, path:'M192 128 L352 256 L192 384 L192 296 L64 296 L64 216 L192 216 Z' };
  // "Fit to window" (arrows-out) icon
  const fitIcon  = { width:512, height:512, path:'M64 192 L64 64 L192 64 L160 96 L224 160 L160 224 L96 160 Z M448 192 L416 160 L352 224 L288 160 L352 96 L320 64 L448 64 Z M64 448 L64 320 L96 352 L160 288 L224 352 L160 416 L192 448 Z M448 448 L320 448 L352 416 L288 352 L352 288 L416 352 L448 320 Z' };

  // NEW: crosshair icon for "Pick line"
const crosshairIcon = {
  width: 512, height: 512,
  path: 'M240 64 L272 64 L272 240 L448 240 L448 272 L272 272 L272 448 L240 448 L240 272 L64 272 L64 240 L240 240 Z'
};

// NEW: pick-line toggle button
const pickLineButton = {
  name: 'Pick line',
  title: 'Pick line: click on plot to add wavelength',
  icon: crosshairIcon,
  click: () => {
    pickLineActive = !pickLineActive;
    // toggle visual state in the modebar
    if (!pickButtonEl) {
      const modeBar = elements.graph._fullLayout && elements.graph._fullLayout._modeBar;
      if (modeBar && modeBar.element) {
        pickButtonEl = modeBar.element.querySelector('[data-title="Pick line: click on plot to add wavelength"]');
      }
    }
    if (pickButtonEl) {
      pickButtonEl.classList.toggle('modebar-btn--active', pickLineActive);
    }
  }
};


  // Place all three custom buttons in the modebar
  let undoButtonEl = null, redoButtonEl = null;
  const undoButton = { name:'Undo view', title:'Undo view change', icon:undoIcon, click:() => undoView() };
  const redoButton = { name:'Redo view', title:'Redo view change', icon:redoIcon, click:() => redoView() };
  const fitButton  = { name:'Fit to window', title:'Fit to window (show all)', icon:fitIcon, click:() => { const v={xRange:null,yRange:null}; pushView(v); applyView(v);} };
  let pickLineActive = false;   // NEW: line-picking toggle state
  let pickButtonEl = null; 
  const homeIcon = {
  width: 512, height: 512,
  path: 'M256 96 L64 256 L112 256 L112 416 L224 416 L224 304 L288 304 L288 416 L400 416 L400 256 L448 256 Z'
};
const resetInitialButton = {
  name: 'Reset axes',
  title: 'Reset axes (initial view)',
  icon: homeIcon,
  click: () => {
    const view = baselineView || { xRange: null, yRange: null };
    pushView(view);
    applyView(view);
  }
};

const selectedLines = [];

const config = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToAdd: [fitButton, resetInitialButton, undoButton, redoButton, pickLineButton],
  modeBarButtonsToRemove: ['autoScale2d', 'resetScale2d'],
  toImageButtonOptions: {
    format: 'png',
    filename: 'spectra_view',
    scale: 3.125   // ≈300 DPI relative to default ~96 DPI
  },
  displayModeBar: true
};

  const elements = {
    graph: document.getElementById('graph'),
    plotWrap: document.getElementById('plotWrap'),
    list: document.getElementById('spectraList'),
    search: document.getElementById('search'),
    fileInput: document.getElementById('fileInput'),
    btnClear: document.getElementById('btnClear'),
    btnAll: document.getElementById('btnAll'),
    btnNone: document.getElementById('btnNone'),
    spectrumSelect: document.getElementById('spectrumSelect'),
    plotTypeSelect: document.getElementById('plotTypeSelect'),
    btnAddPlotType: document.getElementById('btnAddPlotType'),
    activePlotTypes: document.getElementById('activePlotTypes'),
    toggleHover: document.getElementById('toggleHover'),
    maxPoints: document.getElementById('maxPoints'),
    lineWidth: document.getElementById('lineWidth'),
    status: document.getElementById('statusLine'),
    xAxisLabel: document.getElementById('xAxisLabel'),
    yAxisLabel: document.getElementById('yAxisLabel'),
    btnViewColumns: document.getElementById('btnViewColumns'),
    xColumnSelect: document.getElementById('xColumnSelect'),
    yColumnSelect: document.getElementById('yColumnSelect'),
    errorColumnSelect: document.getElementById('errorColumnSelect'),
    labelInput: document.getElementById('labelInput'),
    errorColumnRow: document.getElementById('errorColumnRow')
  };

  const state = {
    selected: new Set(),
    colors: {}, // Now stores RGBA colors like "rgba(255,0,0,0.5)"
    xRange: null,
    yRange: null,
    maxPoints: parseInt(elements.maxPoints.value, 10),
    lineWidth: parseInt(elements.lineWidth.value, 10),
    activePlotTypes: [], // Array of plot configurations: { spectrumName, type, xCol, yCol, errorCol, label, id, visible }
    showHover: elements.toggleHover ? elements.toggleHover.checked : true,
    xAxisLabel: elements.xAxisLabel.value,
    yAxisLabel: elements.yAxisLabel.value
  };

  const spectra = {};
  let names = [];
  const colorPickers = {}; // Store Pickr instances for each spectrum

  // History; baseline will be overwritten with computed initial y-range after first render
  const history = { past: [{ xRange: null, yRange: null }], future: [] };
  const HISTORY_LIMIT = 100;
  let ignoreRelayout = false;
  let handlersBound = false;
  let bootstrapping = true;
  let baselineView = null; // captured after first render (P1–P99 y-range)
  let lastLineAddTs = 0;




  window.addEventListener('error', (event) => {
    console.error(event.error || event.message);
    setStatus('Error: ' + (event.error ? event.error.message : event.message), false);
  });

  function renderSelectedLines(){
  const listEl = document.getElementById('selectedLinesList');
  const btnDl  = document.getElementById('btnDownloadLines');

  listEl.innerHTML = '';
  listEl.classList.toggle('empty', selectedLines.length === 0);

  if(selectedLines.length === 0){
    listEl.textContent = 'No lines yet.';
    btnDl.disabled = true;
    // Check for overflow even when empty to remove the expansion
    requestAnimationFrame(() => checkCardsForOverflow());
    return;
  }

  // stable sorted view (don’t mutate original so you can preserve insertion order if needed)
  const view = [...selectedLines].sort((a,b)=>a-b);

  for(const wl of view){
    const item = document.createElement('div');
    item.className = 'line-item';

    const tag = document.createElement('span');
    tag.className = 'line-tag';
    tag.textContent = `${wl.toFixed(4)} Å`;

    const rm = document.createElement('button');
    rm.className = 'remove-line';
    rm.textContent = '×';
    rm.title = 'Remove line';
    rm.addEventListener('click', () => {
      const idx = selectedLines.indexOf(wl);
      if(idx !== -1) { selectedLines.splice(idx, 1); renderSelectedLines(); updateLineMarkers();
}
    });

    item.appendChild(tag);
    item.appendChild(rm);
    listEl.appendChild(item);
  }

  btnDl.disabled = selectedLines.length === 0;

  // Check for overflow after lines are updated
  requestAnimationFrame(() => checkCardsForOverflow());
}

function downloadLinesTxt(){
  if(!selectedLines.length) return;
  const lines = [...selectedLines].sort((a,b)=>a-b).map(v => v.toFixed(4));
  const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selected_lines.txt';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Fallback: click anywhere in the plotting area, even when hover is off
function pointerEventToPlotX(domEvent) {
  const graph = elements.graph;
  if (!graph || !domEvent) return { inside: false, x: null };

  const fullLayout = graph._fullLayout;
  const xaxis = fullLayout && fullLayout.xaxis;
  const yaxis = fullLayout && fullLayout.yaxis;
  if (!xaxis || !yaxis) return { inside: false, x: null };

  const pointer = domEvent.changedTouches?.[0] || domEvent.touches?.[0] || domEvent;
  const clientX = pointer?.clientX;
  const clientY = pointer?.clientY;
  if (clientX == null || clientY == null) return { inside: false, x: null };

  const graphRect = graph.getBoundingClientRect();
  const xPixels = clientX - graphRect.left;
  const yPixels = clientY - graphRect.top;

  const axisOffset = xaxis._offset || 0;
  const axisLength = xaxis._length || 0;
  const yOffset = yaxis._offset || 0;
  const yLength = yaxis._length || 0;

  const withinX = xPixels >= axisOffset && xPixels <= axisOffset + axisLength;
  const withinY = yPixels >= yOffset && yPixels <= yOffset + yLength;
  if (!withinX || !withinY || axisLength <= 0) {
    return { inside: false, x: null };
  }

  const pixelFromAxisStart = xPixels - axisOffset;
  let xValue = null;
  if (typeof xaxis.p2l === 'function') {
    xValue = xaxis.p2l(pixelFromAxisStart);
  } else if (Array.isArray(xaxis.range)) {
    const t = pixelFromAxisStart / axisLength;
    xValue = xaxis.range[0] + t * (xaxis.range[1] - xaxis.range[0]);
  }

  return { inside: true, x: xValue };
}

function setPlotControlsDisabled(disabled) {
  const plotCard = document.getElementById('cardPlot');
  if (!plotCard) return;

  const controls = plotCard.querySelectorAll('button, input, select, textarea');
  controls.forEach(control => {
    if (disabled) {
      if (!control.disabled) {
        control.dataset.disabledByPickLine = '1';
        control.disabled = true;
      }
    } else if (control.dataset.disabledByPickLine) {
      control.disabled = false;
      delete control.dataset.disabledByPickLine;
    }
  });

  plotCard.classList.toggle('plot-controls-disabled', disabled);
}

function onGraphRawClick(ev){
  if (!pickLineActive) return;

  // if a point click just happened, skip this duplicate
  if (Date.now() - lastLineAddTs < 80) return;

  const { inside, x } = pointerEventToPlotX(ev);
  if (!inside) return;

  if (Number.isFinite(x)) addSelectedLine(x);
}

function lockLinesCardHeightAtStartupStable(){
  const card = document.getElementById('cardLines');
  if (!card || card.dataset.locked === '1') return;

  const fontsReady = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();

  fontsReady.then(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const h = Math.round(card.getBoundingClientRect().height);
        if (h > 0) {
          card.style.height = h + 'px';
          card.style.maxHeight = h + 'px';  // clamp
          card.dataset.locked = '1';
          card.dataset.lockedHeight = String(h);

          // keep it clamped if anything tries to resize it
          const ro = new ResizeObserver(() => {
            if (card.dataset.locked !== '1') return;
            const locked = parseInt(card.dataset.lockedHeight || '0', 10);
            const cur = Math.round(card.getBoundingClientRect().height);
            if (locked && cur !== locked) {
              card.style.height = locked + 'px';
              card.style.maxHeight = locked + 'px';
            }
          });
          ro.observe(card);
        }
      });
    });
  });
}

/** Public helper you can call later to add a line from anywhere */
function addSelectedLine(wavelength){
  const num = Number(wavelength);
  if(!Number.isFinite(num)) return;
  // de-duplicate within ~1e-6 Å
  const exists = selectedLines.some(v => Math.abs(v - num) < 1e-6);
  if(!exists){
    selectedLines.push(num);
    lockLinesCardHeightAtStartupStable();
    lastLineAddTs = Date.now()
    renderSelectedLines();
    updateLineMarkers();   // <--- add this

  }
}

function onPlotClick(evt){
  if (!pickLineActive) return;

  if (evt && evt.event) {
    const { inside, x } = pointerEventToPlotX(evt.event);
    if (inside && Number.isFinite(x)) {
      addSelectedLine(x);
      return;
    }
  }

  // Prefer a data-point click (robust & simple)
  if (evt && evt.points && evt.points.length) {
    const x = Number(evt.points[0].x);
    if (Number.isFinite(x)) {
      addSelectedLine(x);
    }
  }}

  function setStatus(message, loading){
    elements.status.textContent = message;
    elements.status.classList.toggle('loading', !!loading);
  }

  function lockSpectraCardHeightOnce(){
  const card = document.getElementById('cardSpectra');
  if (!card || card.dataset.locked === '1') return;

  // Lock to current pixel height (first time we have content)
  const h = card.offsetHeight;
  if (h > 0) {
    card.style.height = h + 'px';
    card.dataset.locked = '1';
  }
}
const TOP_ROW_EXTRA_PX = 0; // negative value makes cards more compact initially

function lockSpectraCardHeightAtStartup(){
  const card = document.getElementById('cardSpectra');
  if (!card || card.dataset.locked === '1') return;

  requestAnimationFrame(() => {
    const h = Math.round(card.getBoundingClientRect().height);
    if (h > 0) {
      const H = h + TOP_ROW_EXTRA_PX;          // <-- add headroom
      card.style.height = H + 'px';
      card.style.maxHeight = H + 'px';         // clamp
      card.style.setProperty('--card-fixed-height', H + 'px');  // <-- set CSS variable for hover expansion
      card.dataset.locked = '1';
      card.dataset.lockedHeight = String(H);
    }
  });
}

function lockPlotCardToInitialHeight(){
  const plotCard = document.getElementById('cardPlot');
  const activePlotTypes = document.getElementById('activePlotTypes');
  if (!plotCard || plotCard.dataset.locked === '1') return;

  requestAnimationFrame(() => {
    const h = plotCard.clientHeight;
    if (h > 0 && activePlotTypes) {
      plotCard.style.height = h + 'px';
      plotCard.style.maxHeight = h + 'px';
      plotCard.dataset.locked = '1';
      plotCard.dataset.lockedHeight = h;
      plotCard.style.setProperty('--card-fixed-height', h + 'px');

      // Also constrain the activePlotTypes container so it doesn't grow beyond available space
      // This ensures overflow is properly detected
      const activePlotTypesMaxHeight = activePlotTypes.clientHeight;
      activePlotTypes.style.maxHeight = activePlotTypesMaxHeight + 'px';
    }
  });
}

function lockExpandableCardsToSpectraHeight(){
  const spectraCard = document.getElementById('cardSpectra');
  const expandableCards = document.querySelectorAll('.control-card[data-expandable="true"]');
  const linesCard = document.getElementById('cardLines');

  if (!spectraCard) return;

  requestAnimationFrame(() => {
    const targetHeight = spectraCard.style.height;

    // Lock all expandable cards to Spectra height (except Plot which locks itself)
    expandableCards.forEach(card => {
      if (targetHeight && card.dataset.locked !== '1' && card.id !== 'cardPlot') {
        card.style.height = targetHeight;
        card.style.maxHeight = targetHeight;
        card.dataset.locked = '1';
        card.style.setProperty('--card-fixed-height', targetHeight);
      }
    });

    // Lock Selected Lines card
    if (targetHeight && linesCard && linesCard.dataset.locked !== '1') {
      linesCard.style.height = targetHeight;
      linesCard.style.maxHeight = targetHeight;
      linesCard.dataset.locked = '1';
      linesCard.style.setProperty('--card-fixed-height', targetHeight);
    }

    // Check for overflow after a short delay to ensure content is rendered
    setTimeout(checkCardsForOverflow, 100);
  });
}

function updatePlotCardHoverSizing(card, activePlotTypes) {
  const customPlotForm = document.getElementById('customPlotForm');
  const isToggleExpanded = customPlotForm && customPlotForm.style.display !== 'none';

  if (isToggleExpanded) {
    card.classList.remove('has-overflow');
    card.style.removeProperty('--expand-height');
    return;
  }

  if (activePlotTypes.children.length === 0) {
    card.classList.remove('has-overflow');
    card.style.removeProperty('--expand-height');
    return;
  }

  const lockedHeightRaw = card.dataset.lockedHeight;
  const lockedHeightValue = Number(lockedHeightRaw);
  const lockedHeight = Number.isFinite(lockedHeightValue) && lockedHeightValue > 0
    ? lockedHeightValue
    : Math.round(card.getBoundingClientRect().height);

  if (!lockedHeight) {
    card.classList.remove('has-overflow');
    card.style.removeProperty('--expand-height');
    return;
  }

  const visibleListHeight = activePlotTypes.clientHeight;
  const fullListHeight = activePlotTypes.scrollHeight;
  const overflow = Math.max(0, fullListHeight - visibleListHeight);

  if (overflow > 1) {
    const maxHeight = lockedHeight * 2;
    const expandHeight = Math.min(lockedHeight + overflow, maxHeight);
    card.classList.add('has-overflow');
    card.style.setProperty('--expand-height', Math.ceil(expandHeight) + 'px');
  } else {
    card.classList.remove('has-overflow');
    card.style.removeProperty('--expand-height');
  }
}

function checkCardsForOverflow(){
  // Check Spectra card - look at the #spectraList element
  const spectraCard = document.getElementById('cardSpectra');
  if (spectraCard) {
    const list = document.getElementById('spectraList');
    if (list && list.scrollHeight > list.clientHeight) {
      const currentHeight = parseInt(spectraCard.style.height) || spectraCard.clientHeight;
      const maxHeight = currentHeight * 2;
      const contentOverflow = list.scrollHeight - list.clientHeight;
      const neededHeight = currentHeight + contentOverflow;
      const expandHeight = Math.min(neededHeight, maxHeight);

      spectraCard.classList.add('has-overflow');
      spectraCard.style.setProperty('--expand-height', expandHeight + 'px');
    } else {
      spectraCard.classList.remove('has-overflow');
    }
  }

  // Check other expandable cards (Load Data, Visibility, Rendering, Plot)
  const expandableCards = document.querySelectorAll('.control-card[data-expandable="true"]:not(#cardSpectra)');
  expandableCards.forEach(card => {
    if (card.id === 'cardPlot') {
      const plotTypesList = card.querySelector('#activePlotTypes');
      if (plotTypesList) {
        updatePlotCardHoverSizing(card, plotTypesList);
      } else {
        card.classList.remove('has-overflow');
        card.style.removeProperty('--expand-height');
      }
      return;
    }

    const chipsContainer = card.querySelector('.chips');
    const activePlotTypes = card.querySelector('#activePlotTypes');
    const scrollElement = activePlotTypes || chipsContainer || card;

    if (scrollElement.scrollHeight > scrollElement.clientHeight) {
      const currentHeight = parseInt(card.style.height) || card.clientHeight;
      const maxHeight = currentHeight * 2;
      const contentOverflow = scrollElement.scrollHeight - scrollElement.clientHeight;
      const neededHeight = currentHeight + contentOverflow;
      const expandHeight = Math.min(neededHeight, maxHeight);

      card.classList.add('has-overflow');
      card.style.setProperty('--expand-height', expandHeight + 'px');
    } else {
      card.classList.remove('has-overflow');
      card.style.removeProperty('--expand-height');
    }
  });

  // Check Selected Lines card - look at the .lines-list element
  const linesCard = document.getElementById('cardLines');
  if (linesCard) {
    const linesList = linesCard.querySelector('.lines-list');
    if (linesList && linesList.scrollHeight > linesList.clientHeight) {
      const currentHeight = parseInt(linesCard.style.height) || linesCard.clientHeight;
      const maxHeight = currentHeight * 2;
      const contentOverflow = linesList.scrollHeight - linesList.clientHeight;
      const neededHeight = currentHeight + contentOverflow;
      const expandHeight = Math.min(neededHeight, maxHeight);

      linesCard.classList.add('has-overflow');
      linesCard.style.setProperty('--expand-height', expandHeight + 'px');
    } else {
      linesCard.classList.remove('has-overflow');
    }
  }
}

  function sanitizeName(raw){
    // Remove common file extensions and path prefixes
    const base = raw
      .replace(/^.*[\/\\]/, '')  // Remove path
      .replace(/\.(csv|txt|ascii|dat|fits?|zip)$/i, '')  // Remove extensions
      .replace(/[^A-Za-z0-9\-_]+/g, '_')  // Replace special chars
      .replace(/^_+|_+$/g, '')  // Remove leading/trailing underscores
      || 'spectrum';

    // If name already exists, append counter
    let name = base, counter = 2;
    while(spectra[name]){ name = base + '_' + counter; counter += 1; }
    return name;
  }

  function detectSeparator(line){
    // Try different separators and count columns
    const separators = [',', ';', ':', '\t', /\s+/];
    let bestSep = ',';
    let maxCols = 0;

    for(const sep of separators){
      const parts = line.split(sep).filter(p => p.trim().length > 0);
      if(parts.length > maxCols){
        maxCols = parts.length;
        bestSep = sep;
      }
    }
    return bestSep;
  }

  function parseCSV(text, context){
    const lines = text.replace(/\r/g, '').split('\n');
    const trimmed = lines.filter(line => line.trim().length);
    if(trimmed.length < 2) throw new Error('Empty CSV for ' + context);

    // Detect separator from first line
    const separator = detectSeparator(trimmed[0]);

    // Parse first line to check if it's a header or data
    const firstLine = trimmed[0].split(separator).map(h => h.trim()).filter(h => h.length > 0);
    const hasHeader = firstLine.some(cell => isNaN(Number(cell)));

    let header = [];
    let dataStartIndex = 0;

    if (hasHeader) {
      // First line is a header
      header = firstLine;
      dataStartIndex = 1;
    } else {
      // No header, generate column names: col1, col2, col3, ...
      header = firstLine.map((_, i) => `col${i + 1}`);
      dataStartIndex = 0;
    }

    // Find required columns
    const idx = { 
      WAVE: header.indexOf('WAVE'), 
      FLUX: header.indexOf('FLUX_STACK'), 
      SKY: header.indexOf('FLUX_STACK_SKYSUB'), 
      ERR: header.indexOf('ERR_STACK') 
    };

    // If named columns not found, try to use first 4 columns as WAVE, FLUX, SKY, ERR
    if(Object.values(idx).some(v => v === -1)) {
      if (header.length >= 4) {
        idx.WAVE = 0;
        idx.FLUX = 1;
        idx.SKY = 2;
        idx.ERR = 3;
      } else {
        throw new Error('Missing required columns in ' + context);
      }
    }

    const rows = trimmed.slice(dataStartIndex);

    // Initialize arrays for all columns
    const columnData = {};
    header.forEach(colName => {
      columnData[colName] = [];
    });

    // Also keep the legacy WAVE, FLUX, SKY, ERR for backward compatibility
    const wave=[], flux=[], sky=[], err=[];

    for(let i=0;i<rows.length;i++){
      const parts = rows[i].split(separator).map(p => p.trim()).filter(p => p.length > 0);
      const waveCell = (parts[idx.WAVE] || '').trim();
      const waveValue = waveCell === '' ? NaN : Number(waveCell);
      if(!Number.isFinite(waveValue)) continue;

      // Store legacy columns
      wave.push(waveValue);
      flux.push(parseCellNumber(parts[idx.FLUX]));
      sky.push(parseCellNumber(parts[idx.SKY]));
      err.push(parseCellNumber(parts[idx.ERR]));

      // Store all columns by their actual names
      header.forEach((colName, colIndex) => {
        columnData[colName].push(parseCellNumber(parts[colIndex]));
      });
    }

    if(!wave.length) throw new Error('No valid wavelength samples in ' + context);

    // Build result object with legacy columns + all actual columns
    const result = { 
      WAVE: Float64Array.from(wave), 
      FLUX: Float64Array.from(flux), 
      SKY: Float64Array.from(sky), 
      ERR: Float64Array.from(err),
      columns: header  // Store all column names (either from header or generated)
    };

    // Add all columns by their actual names
    header.forEach(colName => {
      result[colName] = Float64Array.from(columnData[colName]);
    });

    return result;
  }

  function parseCellNumber(cell){
    if(cell === undefined) return NaN;
    const value = cell.trim();
    if(value === '') return NaN;
    const num = Number(value);
    return Number.isFinite(num) ? num : NaN;
  }

  async function parseFITS(buffer, filename){
    // Custom lightweight FITS binary table parser
    // Returns array of {data, hduIndex} objects for all matching binary tables
    const view = new DataView(buffer);
    let offset = 0;
    let hduIndex = 0;
    const foundTables = [];

    function readHeader(){
      const headerSize = 2880;
      const cards = [];
      while(true){
        const blockData = new Uint8Array(buffer, offset, headerSize);
        const blockStr = new TextDecoder('ascii').decode(blockData);

        for(let i = 0; i < 36; i++){
          const card = blockStr.substr(i * 80, 80);
          if(card.startsWith('END ')) {
            offset += headerSize;
            return cards;
          }
          cards.push(card);
        }
        offset += headerSize;
      }
    }

    function parseHeaderCards(cards){
      const header = {};
      for(const card of cards){
        const key = card.substr(0, 8).trim();
        if(!key || card[8] !== '=') continue;

        let value = card.substr(10, 70).trim();
        // Remove comments
        const commentIdx = value.indexOf('/');
        if(commentIdx > 0) value = value.substr(0, commentIdx).trim();

        // Remove quotes for strings
        if(value.startsWith("'") && value.includes("'")){
          const endQuote = value.indexOf("'", 1);
          if(endQuote > 0) value = value.substr(1, endQuote - 1).trim();
        }

        header[key] = value;
      }
      return header;
    }

    function readBinaryTable(header){
      const naxis1 = parseInt(header['NAXIS1']) || 0;
      const naxis2 = parseInt(header['NAXIS2']) || 0;
      const tfields = parseInt(header['TFIELDS']) || 0;

      if(!naxis1 || !naxis2 || !tfields) return null;

      // Parse column information
      const columns = [];
      for(let i = 1; i <= tfields; i++){
        const ttype = (header['TTYPE' + i] || '').trim();
        const tform = (header['TFORM' + i] || '').trim();

        // Parse TFORM (e.g., "1D" = 1 double, or just "D" = 1 double)
        let repeat = 1;
        let typeCode = tform;
        const match = tform.match(/(\d+)([A-Z])/);
        if(match){
          repeat = parseInt(match[1]);
          typeCode = match[2];
        } else {
          // Simple format like "D" means repeat=1
          typeCode = tform;
        }

        let bytesPerElement = 0;
        let readFunc = null;

        if(typeCode === 'D'){  // Double (64-bit float)
          bytesPerElement = 8;
          readFunc = (v, o) => v.getFloat64(o, false);
        } else if(typeCode === 'E'){  // Float (32-bit float)
          bytesPerElement = 4;
          readFunc = (v, o) => v.getFloat32(o, false);
        } else if(typeCode === 'J'){  // 32-bit integer
          bytesPerElement = 4;
          readFunc = (v, o) => v.getInt32(o, false);
        }

        if(readFunc){
          columns.push({ name: ttype, repeat, bytesPerElement, readFunc });
        }
      }

      // Find our required columns
      const waveCol = columns.find(c => c.name === 'WAVE');
      const fluxCol = columns.find(c => c.name === 'FLUX_STACK');
      const skyCol = columns.find(c => c.name === 'FLUX_STACK_SKYSUB');
      const errCol = columns.find(c => c.name === 'ERR_STACK');

      if(!waveCol || !fluxCol || !skyCol || !errCol) return null;

      // Save all column names
      const columnNames = columns.map(c => c.name);

      // Initialize arrays for all columns
      const columnData = {};
      columns.forEach(col => {
        columnData[col.name] = [];
      });

      // Read data
      const wave = [], flux = [], sky = [], err = [];
      const rowSize = naxis1;

      for(let row = 0; row < naxis2; row++){
        let rowOffset = offset + row * rowSize;
        let colOffset = 0;

        for(const col of columns){
          const value = col.readFunc(view, rowOffset + colOffset);

          // Store in named column
          columnData[col.name].push(value);

          // Also store in legacy columns for backward compatibility
          if(col === waveCol){
            wave.push(value);
          } else if(col === fluxCol){
            flux.push(value);
          } else if(col === skyCol){
            sky.push(value);
          } else if(col === errCol){
            err.push(value);
          }
          colOffset += col.repeat * col.bytesPerElement;
        }
      }

      // Build result object with legacy columns + all actual columns
      const result = { 
        WAVE: Float64Array.from(wave), 
        FLUX: Float64Array.from(flux), 
        SKY: Float64Array.from(sky), 
        ERR: Float64Array.from(err),
        columns: columnNames  // Store all column names
      };

      // Add all columns by their actual names
      columns.forEach(col => {
        result[col.name] = Float64Array.from(columnData[col.name]);
      });

      return result;
    }

    // Read primary header
    const primaryCards = readHeader();
    const primaryHeader = parseHeaderCards(primaryCards);
    hduIndex = 0;

    // Align to 2880-byte boundary
    const dataSize = parseInt(primaryHeader['NAXIS1'] || 0) * parseInt(primaryHeader['NAXIS2'] || 0);
    if(dataSize > 0){
      const paddedSize = Math.ceil(dataSize / 2880) * 2880;
      offset += paddedSize;
    }

    // Search extensions for binary tables
    while(offset + 2880 <= buffer.byteLength){
      hduIndex++;
      const extCards = readHeader();
      const extHeader = parseHeaderCards(extCards);

      const xtension = extHeader['XTENSION'];

      if(xtension === 'BINTABLE'){
        const data = readBinaryTable(extHeader);
        if(data) {
          foundTables.push({ data, hduIndex });
        }
      }

      // Calculate extension data size
      let extDataSize = 0;
      const naxis = parseInt(extHeader['NAXIS'] || 0);

      if(naxis > 0){
        extDataSize = 1;
        for(let i = 1; i <= naxis; i++){
          const axisSize = parseInt(extHeader['NAXIS' + i] || 0);
          extDataSize *= axisSize;
        }
        // For image extensions, multiply by bytes per pixel
        if(xtension === 'IMAGE'){
          const bitpix = parseInt(extHeader['BITPIX'] || 0);
          extDataSize *= Math.abs(bitpix) / 8;
        }
      }

      if(extDataSize > 0){
        const paddedSize = Math.ceil(extDataSize / 2880) * 2880;
        offset += paddedSize;
      }
    }

    if(!foundTables.length){
      throw new Error('No binary table with required columns found in ' + filename);
    }

    return foundTables;
  }

  function percentile(values, p){
    if(!values.length) return NaN;
    const sorted = values.slice().sort((a,b)=>a-b);
    const rank = (p/100)*(sorted.length-1);
    const lower = Math.floor(rank), upper = Math.ceil(rank);
    if(lower===upper) return sorted[lower];
    const w = rank - lower;
    return sorted[lower]*(1-w) + sorted[upper]*w;
  }

  async function fileToArrayBuffer(file){ return file.arrayBuffer ? await file.arrayBuffer() : await new Response(file).arrayBuffer(); }
  async function fileToText(file){
    if(file.text) return await file.text();
    return await new Promise((resolve,reject)=>{ const r=new FileReader(); r.onerror=()=>reject(r.error); r.onload=()=>resolve(r.result||''); r.readAsText(file); });
  }

  async function loadZip(file){
    const buffer = await fileToArrayBuffer(file);
    const zip = await JSZip.loadAsync(buffer);
    let count=0;
    const acceptedExtensions = ['.csv', '.txt', '.ascii', '.fits', '.fit'];
    const entries = Object.keys(zip.files).filter(n => {
      if(zip.files[n].dir) return false;
      const lower = n.toLowerCase();
      return acceptedExtensions.some(ext => lower.endsWith(ext));
    });
    for(const entryName of entries){
      const lower = entryName.toLowerCase();
      if(lower.endsWith('.fits') || lower.endsWith('.fit')){
        const arrayBuf = await zip.files[entryName].async('arraybuffer');
        count += await ingestFITS(entryName, arrayBuf);
      } else {
        const text = await zip.files[entryName].async('string');
        count += ingestSpectrum(entryName, text);
      }
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return count;
  }

  function ingestSpectrum(filename, text){
    const data = parseCSV(text, filename);
    if(!data.WAVE.length) return 0;
    const name = sanitizeName(filename);
    spectra[name] = data;
    if(!state.colors[name]){
      const idx = Object.keys(state.colors).length;
      state.colors[name] = palette[idx % palette.length];
    }
    state.selected.add(name);
    return 1;
  }

  async function ingestFITS(filename, buffer){
    const tables = await parseFITS(buffer, filename);
    let count = 0;

    for(const {data, hduIndex} of tables){
      if(!data.WAVE.length) continue;

      // Create name with HDU index
      const baseName = sanitizeName(filename);
      const name = tables.length > 1 ? `${baseName}_hdu${hduIndex}` : baseName;

      spectra[name] = data;
      if(!state.colors[name]){
        const idx = Object.keys(state.colors).length;
        state.colors[name] = palette[idx % palette.length];
      }
      state.selected.add(name);
      count++;
    }

    return count;
  }

  async function handleFiles(fileList){
    const files = Array.from(fileList || []);
    if(!files.length) return;
    let loaded = 0;
    for(const file of files){
      try{
        setStatus('Loading ' + file.name + '...', true);
        await new Promise(r => requestAnimationFrame(r));
        const lower = file.name.toLowerCase();
        if(lower.endsWith('.zip')) loaded += await loadZip(file);
        else if(lower.endsWith('.fits') || lower.endsWith('.fit')) {
          const buffer = await fileToArrayBuffer(file);
          loaded += await ingestFITS(file.name, buffer);
        }
        else { const text = await fileToText(file); loaded += ingestSpectrum(file.name, text); }
      }catch(err){ console.error('Failed to load', file.name, err); alert('Failed to load ' + file.name + ': ' + err.message); }
    }
    names = Object.keys(spectra).sort();
    pruneSelection();
    // Reset; baseline will be replaced with computed numeric y after first render
    state.xRange = null; state.yRange = null;
    history.past = [{ xRange:null, yRange:null }]; history.future = [];
    lockLinesCardHeightAtStartupStable();buildList();renderSelectedLines();updateLineMarkers();   // <--- add this

    lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
    lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
    refreshPlot();
    setStatus(loaded ? ('Loaded ' + loaded + ' spectra.') : 'No spectra loaded.', false);
    updateUndoRedoButtons();
  }

  function pruneSelection(){
    const available = new Set(names);
    Array.from(state.selected).forEach(name => { if(!available.has(name)) state.selected.delete(name); });
  }

  function deleteSpectrum(name){
    delete spectra[name];
    state.selected.delete(name);
    delete state.colors[name];
    if(colorPickers[name]) {
      colorPickers[name].destroyAndRemove();
      delete colorPickers[name];
    }

    // Remove all custom plots associated with this spectrum
    state.activePlotTypes = state.activePlotTypes.filter(config => config.spectrumName !== name);

    names = Object.keys(spectra).sort();
    buildList();
    buildSpectrumSelector();
    buildActivePlotTypesList();
    refreshPlot();
    const count = names.length;
    setStatus(count ? (`${count} spectra loaded.`) : 'No spectra loaded.', false);
  }

  function buildSpectrumSelector(){
    if (!elements.spectrumSelect) return;

    // Save current selection
    const currentSelection = elements.spectrumSelect.value;

    // Clear and rebuild options
    elements.spectrumSelect.innerHTML = '<option value="">Select a spectrum...</option>';

    names.forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      elements.spectrumSelect.appendChild(option);
    });

    // Restore selection if it still exists
    if (currentSelection && names.includes(currentSelection)) {
      elements.spectrumSelect.value = currentSelection;
      buildColumnSelectors(currentSelection);
    }
  }

  function buildColumnSelectors(spectrumName){
    if (!elements.xColumnSelect || !elements.yColumnSelect || !elements.errorColumnSelect) return;

    // Clear all column selectors
    elements.xColumnSelect.innerHTML = '<option value="">Select X column...</option>';
    elements.yColumnSelect.innerHTML = '<option value="">Select Y column...</option>';
    elements.errorColumnSelect.innerHTML = '<option value="">Select error column...</option>';

    // If no spectrum selected, return
    if (!spectrumName || !spectra[spectrumName]) return;

    const spec = spectra[spectrumName];
    const columns = spec.columns || [];

    // Populate all column selectors
    columns.forEach(colName => {
      // X Column
      const xOption = document.createElement('option');
      xOption.value = colName;
      xOption.textContent = colName;
      elements.xColumnSelect.appendChild(xOption);

      // Y Column
      const yOption = document.createElement('option');
      yOption.value = colName;
      yOption.textContent = colName;
      elements.yColumnSelect.appendChild(yOption);

      // Error Column
      const errOption = document.createElement('option');
      errOption.value = colName;
      errOption.textContent = colName;
      elements.errorColumnSelect.appendChild(errOption);
    });

    // Auto-select common defaults if they exist
    if (columns.includes('WAVE')) {
      elements.xColumnSelect.value = 'WAVE';
    }
    if (columns.includes('FLUX')) {
      elements.yColumnSelect.value = 'FLUX';
    }
    if (columns.includes('ERR')) {
      elements.errorColumnSelect.value = 'ERR';
    }
  }

  function buildList(){
    const filter = elements.search.value.trim().toLowerCase();
    elements.list.innerHTML = '';

    // Destroy existing Pickr instances
    Object.values(colorPickers).forEach(pickr => pickr.destroyAndRemove());
    Object.keys(colorPickers).forEach(key => delete colorPickers[key]);

    if(!names.length){
      const empty = document.createElement('div'); empty.className='small'; empty.textContent='No spectra loaded yet.'; elements.list.appendChild(empty); return;
    }
    names.forEach((name, idx) => {
      if(filter && !name.toLowerCase().includes(filter)) return;
      const item = document.createElement('div'); item.className='spec-item';
      const label = document.createElement('span'); label.className='spec-name'; label.textContent=name;

      // Create Pickr color picker button
      const colorBtn = document.createElement('div'); 
      colorBtn.className = 'color-picker-btn';

      const deleteBtn = document.createElement('button'); deleteBtn.className='delete-spec'; deleteBtn.textContent='×'; deleteBtn.title='Delete spectrum';
      deleteBtn.addEventListener('click', () => { deleteSpectrum(name); });

      item.appendChild(label); 
      item.appendChild(colorBtn); 
      item.appendChild(deleteBtn);
      elements.list.appendChild(item);

      // Initialize Pickr after DOM insertion
      const currentColor = state.colors[name] || palette[idx % palette.length];
      const pickr = Pickr.create({
        el: colorBtn,
        theme: 'nano',
        default: currentColor,
        swatches: palette,
        components: {
          preview: true,
          opacity: true,
          hue: true,
          interaction: {
            hex: false,
            rgba: true,
            input: true,
            save: true
          }
        }
      });

      pickr.on('save', (color) => {
        if (color) {
          const rgbaArray = color.toRGBA();
          const colorString = `rgba(${Math.round(rgbaArray[0])}, ${Math.round(rgbaArray[1])}, ${Math.round(rgbaArray[2])}, ${rgbaArray[3]})`;
          console.log(`Pickr save for ${name}: array=`, rgbaArray, `string="${colorString}"`);
          state.colors[name] = colorString;
          refreshPlot();
        }
        pickr.hide();
      });

      pickr.on('change', (color) => {
        if (color) {
          const rgbaArray = color.toRGBA();
          const colorString = `rgba(${Math.round(rgbaArray[0])}, ${Math.round(rgbaArray[1])}, ${Math.round(rgbaArray[2])}, ${rgbaArray[3]})`;
          state.colors[name] = colorString;
        }
      });

      colorPickers[name] = pickr;
    });
    if(!elements.list.children.length){
      const empty = document.createElement('div'); empty.className='small'; empty.textContent='No spectra match the filter.'; elements.list.appendChild(empty);
    }
    // Update spectrum selector
    buildSpectrumSelector();
    // Check for overflow after list is updated
    requestAnimationFrame(() => checkCardsForOverflow());
  }

  function buildActivePlotTypesList() {
    elements.activePlotTypes.innerHTML = '';
    if (state.activePlotTypes.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No plots selected';
      empty.style.cssText = 'color:#888;font-style:italic;padding:0px 0;';
      elements.activePlotTypes.appendChild(empty);
      requestAnimationFrame(() => requestAnimationFrame(() => checkCardsForOverflow()));
      return;
    }

    state.activePlotTypes.forEach(config => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;margin:4px 0;background:#e8ddd6;border-radius:4px;font-size:12px;';

      // Checkbox for visibility
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = config.visible !== false; // Default to visible
      checkbox.style.cssText = 'flex-shrink:0;';
      checkbox.addEventListener('change', () => {
        config.visible = checkbox.checked;
        refreshPlot();
      });

      const labelContainer = document.createElement('div');
      labelContainer.style.cssText = 'flex:1;min-width:0;';

      const mainLabel = document.createElement('div');
      mainLabel.style.cssText = 'font-weight:500;font-size:12px;';
      mainLabel.textContent = config.label || `${config.spectrumName}: ${config.yCol} vs ${config.xCol}`;

      const details = document.createElement('div');
      details.style.cssText = 'font-size:10px;color:#666;margin-top:2px;';
      const typeLabels = { 'line-solid': 'solid', 'line-dashed': 'dashed', 'error-fill': 'error band' };
      let detailText = typeLabels[config.type] || config.type;
      if (config.type === 'error-fill' && config.errorCol) {
        detailText += ` ± ${config.errorCol}`;
      }
      details.textContent = detailText;

      labelContainer.appendChild(mainLabel);
      labelContainer.appendChild(details);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'background:none;border:none;font-size:20px;cursor:pointer;color:#666;padding:0;width:20px;height:20px;line-height:1;flex-shrink:0;';
      removeBtn.onclick = () => removePlotType(config.id);

      item.appendChild(checkbox);
      item.appendChild(labelContainer);
      item.appendChild(removeBtn);
      elements.activePlotTypes.appendChild(item);
    });
    requestAnimationFrame(() => requestAnimationFrame(() => checkCardsForOverflow()));
  }

  function openColumnsView() {
    const names = Object.keys(spectra);

    if (names.length === 0) {
      alert('No spectra loaded yet.');
      return;
    }

    // Open the separate HTML file
    const columnsWindow = window.open('columns_view.html', '_blank');

    // Give the new window time to set up its listener, then send data
    if (columnsWindow) {
      setTimeout(() => {
        columnsWindow.postMessage({ type: 'spectraData', data: spectra }, '*');
      }, 100);
    }
  }

  // Listen for refresh requests from columns window
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'requestSpectraData') {
      event.source.postMessage({ type: 'spectraData', data: spectra }, '*');
    }
  });

  function addPlotType() {
    const spectrumName = elements.spectrumSelect.value;
    const plotType = elements.plotTypeSelect.value;
    const xCol = elements.xColumnSelect.value;
    const yCol = elements.yColumnSelect.value;
    const errorCol = elements.errorColumnSelect.value;
    const label = elements.labelInput.value.trim();

    // Validate spectrum selection
    if (!spectrumName) {
      alert('Please select a spectrum/table.');
      return;
    }

    // Validate inputs
    if (!xCol || !yCol) {
      alert('Please specify both X and Y column names.');
      return;
    }

    if (plotType === 'error-fill' && !errorCol) {
      alert('Please specify the error column name for error band plots.');
      return;
    }

    // Check if the selected spectrum exists
    if (!spectra[spectrumName]) {
      alert('Selected spectrum not found.');
      return;
    }

    const spec = spectra[spectrumName];
    console.log(`Checking spectrum "${spectrumName}" for columns: X="${xCol}", Y="${yCol}", Error="${errorCol}"`);
    console.log(`Spectrum columns:`, spec.columns);

    // Check if the selected spectrum has the required columns
    const hasX = spec.columns && spec.columns.includes(xCol);
    const hasY = spec.columns && spec.columns.includes(yCol);
    const hasErr = spec.columns && spec.columns.includes(errorCol);

    if (!hasX || !hasY) {
      alert(`Spectrum "${spectrumName}" does not contain the required columns.\n\nLooking for: X="${xCol}", Y="${yCol}"\nAvailable columns: ${spec.columns ? spec.columns.join(', ') : 'none'}\n\nPlease check column names in the "View All Columns" window.`);
      return;
    }

    if (plotType === 'error-fill' && !hasErr) {
      alert(`Spectrum "${spectrumName}" does not contain the error column "${errorCol}".\n\nAvailable columns: ${spec.columns ? spec.columns.join(', ') : 'none'}`);
      return;
    }

    console.log(`✓ Found all required columns in "${spectrumName}"`);

    // Create plot configuration
    const config = {
      id: Date.now(), // Unique identifier
      spectrumName: spectrumName, // Store which spectrum this plot is for
      type: plotType,
      xCol: xCol,
      yCol: yCol,
      errorCol: plotType === 'error-fill' ? errorCol : null,
      label: label,
      visible: true // Default to visible
    };

    state.activePlotTypes.push(config);
    buildActivePlotTypesList();
    refreshPlot();

    // Clear selections (keep spectrum selected for convenience)
    elements.xColumnSelect.value = '';
    elements.yColumnSelect.value = '';
    elements.errorColumnSelect.value = '';
    elements.labelInput.value = '';
  }

  function removePlotType(id) {
    const index = state.activePlotTypes.findIndex(config => config.id === id);
    if (index > -1) {
      state.activePlotTypes.splice(index, 1);
      buildActivePlotTypesList();
      refreshPlot();
    }
  }

  function lowerBound(arr, value){ let lo=0, hi=arr.length; while(lo<hi){ const mid=(lo+hi)>>>1; if(arr[mid]<value) lo=mid+1; else hi=mid; } return lo; }
  function upperBound(arr, value){ let lo=0, hi=arr.length; while(lo<hi){ const mid=(lo+hi)>>>1; if(arr[mid]<=value) lo=mid+1; else hi=mid; } return lo; }

  function lttb(x,y,threshold){
    const len=x.length;
    if(threshold<=0 || threshold>=len) return Array.from({length:len},(_,i)=>i);
    const sampled=[0]; const bucketSize=(len-2)/(threshold-2); let a=0;
    for(let i=0;i<threshold-2;i++){
      const rangeStart=Math.floor((i+1)*bucketSize)+1;
      const rangeEnd=Math.min(Math.floor((i+2)*bucketSize)+1,len);
      let avgX=0, avgY=0; const avgLen=Math.max(rangeEnd-rangeStart,1);
      for(let j=rangeStart;j<rangeEnd;j++){ avgX+=x[j]; avgY+=y[j]; }
      avgX/=avgLen; avgY/=avgLen;
      const rangeOff=Math.floor(i*bucketSize)+1;
      const rangeTo=Math.min(Math.floor((i+1)*bucketSize)+1,len);
      let maxArea=-1, nextA=rangeOff;
      for(let j=rangeOff;j<rangeTo;j++){
        const area=Math.abs((x[a]-avgX)*(y[j]-y[a])-(x[a]-x[j])*(avgY-y[a]))*0.5;
        if(area>maxArea){ maxArea=area; nextA=j; }
      }
      sampled.push(nextA); a=nextA;
    }
    sampled.push(len-1); return sampled;
  }

  function buildSample(spec){
    const x=spec.WAVE, flux=spec.FLUX, sky=spec.SKY, err=spec.ERR;
    let start=0, end=x.length;
    if(state.xRange){
      start=Math.max(lowerBound(x, state.xRange[0]), 0);
      end=Math.min(upperBound(x, state.xRange[1]), x.length);
      if(end-start<2){ start=Math.max(0,start-1); end=Math.min(x.length,end+1); }
    }
    const span=end-start;
    if(span<=0) return { x:[], flux:[], sky:[], err:[] };
    let indices=Array.from({length:span},(_,i)=>start+i);
    if(span>state.maxPoints){
      const finite=[], nanLike=[];
      for(let i=0;i<indices.length;i++){ const idx=indices[i]; (Number.isFinite(sky[idx])?finite:nanLike).push(idx); }
      let chosen=finite;
      if(finite.length>state.maxPoints){
        const localX=new Float64Array(finite.length), localY=new Float64Array(finite.length);
        for(let i=0;i<finite.length;i++){ const idx=finite[i]; localX[i]=x[idx]; localY[i]=sky[idx]; }
        chosen = lttb(localX, localY, state.maxPoints).map(k => finite[k]);
      }
      const combined=new Set(chosen); nanLike.forEach(idx=>combined.add(idx));
      if(combined.size===0){ combined.add(start); combined.add(end-1); }
      indices=Array.from(combined).sort((a,b)=>a-b);
    }
    const n=indices.length;
    const out={ x:new Array(n), flux:new Array(n), sky:new Array(n), err:new Array(n) };
    for(let i=0;i<n;i++){ const k=indices[i]; out.x[i]=x[k]; out.flux[i]=flux[k]; out.sky[i]=sky[k]; out.err[i]=err[k]; }
    return out;
  }

  function buildSampleCustom(spec, xCol, yCol, errorCol) {
    const xData = spec[xCol];
    const yData = spec[yCol];
    const errData = errorCol ? spec[errorCol] : null;

    if (!xData || !yData) return { x: [], y: [], err: [] };

    let start = 0, end = xData.length;
    if (state.xRange) {
      start = Math.max(lowerBound(xData, state.xRange[0]), 0);
      end = Math.min(upperBound(xData, state.xRange[1]), xData.length);
      if (end - start < 2) {
        start = Math.max(0, start - 1);
        end = Math.min(xData.length, end + 1);
      }
    }
    const span = end - start;
    if (span <= 0) return { x: [], y: [], err: [] };

    let indices = Array.from({ length: span }, (_, i) => start + i);
    if (span > state.maxPoints) {
      const finite = [], nanLike = [];
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        (Number.isFinite(yData[idx]) ? finite : nanLike).push(idx);
      }
      let chosen = finite;
      if (finite.length > state.maxPoints) {
        const localX = new Float64Array(finite.length);
        const localY = new Float64Array(finite.length);
        for (let i = 0; i < finite.length; i++) {
          const idx = finite[i];
          localX[i] = xData[idx];
          localY[i] = yData[idx];
        }
        chosen = lttb(localX, localY, state.maxPoints).map(k => finite[k]);
      }
      const combined = new Set(chosen);
      nanLike.forEach(idx => combined.add(idx));
      if (combined.size === 0) {
        combined.add(start);
        combined.add(end - 1);
      }
      indices = Array.from(combined).sort((a, b) => a - b);
    }

    const n = indices.length;
    const out = { x: new Array(n), y: new Array(n), err: new Array(n) };
    for (let i = 0; i < n; i++) {
      const k = indices[i];
      out.x[i] = xData[k];
      out.y[i] = yData[k];
      out.err[i] = errData ? errData[k] : 0;
    }
    return out;
  }

  function collectFinite(values, store){ for(let i=0;i<values.length;i++){ const v=values[i]; if(Number.isFinite(v)) store.push(v); } }
  function cloneRange(range){ return Array.isArray(range) ? [range[0], range[1]] : null; }

  function rangesEqual(a,b){
    if(a===b) return true;
    if(!a||!b) return false;
    if(a.length!==b.length) return false;
    for(let i=0;i<a.length;i++){ if(Math.abs(a[i]-b[i])>1e-12) return false; }
    return true;
  }
  function viewsEqual(a,b){ return !!a && !!b && rangesEqual(a.xRange,b.xRange) && rangesEqual(a.yRange,b.yRange); }
  function currentView(){ return { xRange: cloneRange(state.xRange), yRange: cloneRange(state.yRange) }; }

  function pushView(view){
    const last = history.past[history.past.length-1];
    if(last && viewsEqual(last, view)) return false;
    history.past.push({ xRange: cloneRange(view.xRange), yRange: cloneRange(view.yRange) });
    if(history.past.length>HISTORY_LIMIT) history.past.shift();
    history.future = [];
    updateUndoRedoButtons();
    return true;
  }

  // Apply view via relayout; also re-subsample after applying
  function applyView(view){
    const payload = {};
    if(view.xRange && view.xRange.length===2 && Number.isFinite(view.xRange[0]) && Number.isFinite(view.xRange[1])){
      payload['xaxis.range[0]'] = view.xRange[0];
      payload['xaxis.range[1]'] = view.xRange[1];
      payload['xaxis.autorange'] = false;
    } else {
      payload['xaxis.autorange'] = true;
    }
    if(view.yRange && view.yRange.length===2 && Number.isFinite(view.yRange[0]) && Number.isFinite(view.yRange[1])){
      payload['yaxis.range[0]'] = view.yRange[0];
      payload['yaxis.range[1]'] = view.yRange[1];
      payload['yaxis.autorange'] = false;
    } else {
      payload['yaxis.autorange'] = true;
    }
    ignoreRelayout = true;
    return Plotly.relayout(elements.graph, payload).then(() => {
      ignoreRelayout = false;
      state.xRange = cloneRange(view.xRange);
      state.yRange = cloneRange(view.yRange);
      refreshPlot();   // re-run downsampling for the new window
      updateUndoRedoButtons();
    });
  }

  function undoView(){
    if(history.past.length<=1) return;
    const current = history.past.pop();
    const previous = history.past[history.past.length-1];
    history.future.push({ xRange: cloneRange(current.xRange), yRange: cloneRange(current.yRange) });
    if(history.future.length>HISTORY_LIMIT) history.future.shift();
    applyView(previous);
  }

  function redoView(){
    if(!history.future.length) return;
    const next = history.future.pop();
    history.past.push({ xRange: cloneRange(next.xRange), yRange: cloneRange(next.yRange) });
    if(history.past.length>HISTORY_LIMIT) history.past.shift();
    applyView(next);
  }

  function updateUndoRedoButtons(){
    const modeBar = elements.graph._fullLayout && elements.graph._fullLayout._modeBar;
    if(!modeBar || !modeBar.element) return;
    if(!undoButtonEl || !undoButtonEl.isConnected) undoButtonEl = modeBar.element.querySelector('[data-title="Undo view change"]');
    if(!redoButtonEl || !redoButtonEl.isConnected) redoButtonEl = modeBar.element.querySelector('[data-title="Redo view change"]');
    if(undoButtonEl) undoButtonEl.classList.toggle('modebar-btn--inactive', history.past.length<=1);
    if(redoButtonEl) redoButtonEl.classList.toggle('modebar-btn--inactive', history.future.length===0);
  }

  function onRelayout(event){
  // Ignore programmatic and bootstrap relayouts
  if (ignoreRelayout || bootstrapping) return;

  // If the relayout only toggles autorange (no explicit ranges), ignore it
  const hasExplicitRange =
    ('xaxis.range[0]' in event) ||
    ('yaxis.range[0]' in event) ||
    ('xaxis.range' in event) ||
    ('yaxis.range' in event);
  const hasOnlyAuto = !hasExplicitRange && (event['xaxis.autorange'] || event['yaxis.autorange']);
  if (hasOnlyAuto) return;

  let newX = cloneRange(state.xRange);
  let newY = cloneRange(state.yRange);

  if (event['xaxis.range[0]'] !== undefined) {
    newX = [Number(event['xaxis.range[0]']), Number(event['xaxis.range[1]'])];
  } else if (event['xaxis.autorange']) {
    newX = null;
  }

  if (event['yaxis.range[0]'] !== undefined) {
    newY = [Number(event['yaxis.range[0]']), Number(event['yaxis.range[1]'])];
  } else if (event['yaxis.autorange']) {
    newY = null;
  }

  // Extra guard: don't add a duplicate "null,null" right after baseline
  if (newX === null && newY === null && history.past.length === 1) {
    updateUndoRedoButtons();
    return;
  }

  const newView = { xRange: newX, yRange: newY };
  const inserted = pushView(newView);
  state.xRange = cloneRange(newX);
  state.yRange = cloneRange(newY);
  if (inserted) refreshPlot(); else updateUndoRedoButtons();
}


  function onDoubleClick(){
  // NEW: go back to the very first numeric view (P1–P99)
  const view = baselineView || { xRange: null, yRange: null };
  pushView(view);
  applyView(view);
  return false;}

  function baseLayout(){
    const hoverOn = state.showHover !== false;
    return {
    uirevision: UI_REVISION,
    paper_bgcolor:'#ffffff',
    plot_bgcolor:'#ffffff',
    font:{ family:'Inter, Arial, sans-serif', color:'#0f172a' },
    margin: { l: 80, r: 25, t: 40, b: 80, pad: 4 },

    hovermode: hoverOn ? 'x' : false,   // <-- NEW

    legend:{ orientation:'h', x:0, y:1.05 },

    xaxis: {
  title: { text: state.xAxisLabel || 'Wavelength [Angstrom]' },
  tickformat: '.4f',
  hoverformat: '.4f',
  tickformatstops: [{ dtickrange:[null,null], value: '.4f' }],
  gridcolor:'#e2e8f0',
  linecolor:'#94a3b8',
  tickcolor:'#94a3b8',
  zeroline:false,

  // Hover spike styling
  showspikes: hoverOn,
  spikemode: 'across',                 // vertical spike across the plot
  spikesnap: 'cursor',
  spikelen: 0,                          // 0 = full height
  spikecolor: 'rgba(107,114,128,0.6)',  // slate-ish gray @ 0.6 alpha
  spikethickness: 1,                    // slimmer line
  spikedash: 'dash'                     // dashed
},

    yaxis: {
  title: { text: state.yAxisLabel || 'Flux [erg/s/cm²/Å]', standoff: 4 },
  gridcolor: '#e2e8f0',
  linecolor: '#94a3b8',
  tickcolor: '#94a3b8',
  zeroline: false,

  // show exponent only once (top tick)
  tickformat: '~g',          // mantissas as normal numbers (no e-notation)
  exponentformat: 'power',   // ×10^n style
  showexponent: 'last',      // only on the last (top) tick
  hoverformat: '.3e',
  automargin: true,         // keep hover scientific; traces can still override
}

  };
}

  function parseColorWithAlpha(colorStr) {
    // Parse rgba string and return {r, g, b, a}
    if (colorStr.startsWith('rgba(') || colorStr.startsWith('rgb(')) {
      const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] ? parseFloat(match[4]) : 1.0
        };
      }
    }
    // Parse hex
    let c = colorStr.replace('#',''); 
    if(c.length===3) c=c.split('').map(ch=>ch+ch).join('');
    return {
      r: parseInt(c.slice(0,2),16),
      g: parseInt(c.slice(2,4),16),
      b: parseInt(c.slice(4,6),16),
      a: 1.0
    };
  }

  function hexWithAlpha(colorStr, alpha){
    const parsed = parseColorWithAlpha(colorStr);
    // Multiply the base alpha by the requested alpha
    const finalAlpha = parsed.a * alpha;
    return 'rgba('+parsed.r+','+parsed.g+','+parsed.b+','+finalAlpha+')';
  }

  function clearAll(){
    if(!confirm('Clear all spectra? This will remove all loaded data and plots.')) return;
    names=[]; Object.keys(spectra).forEach(k=>delete spectra[k]);
    state.selected.clear(); state.colors={};
    // Destroy all Pickr instances
    Object.values(colorPickers).forEach(pickr => pickr.destroyAndRemove());
    Object.keys(colorPickers).forEach(key => delete colorPickers[key]);
    state.xRange=null; state.yRange=null;
    history.past=[{xRange:null,yRange:null}]; history.future=[];
    lockLinesCardHeightAtStartupStable(); buildList(); renderSelectedLines();
    updateLineMarkers();   // <--- add this
    lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
    lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
refreshPlot(); setStatus('Cleared all spectra.', false); updateUndoRedoButtons();
  }

  // Drag & drop
  function onDrag(event){
    event.preventDefault(); event.stopPropagation();
    if(event.type==='dragenter' || event.type==='dragover') elements.plotWrap.classList.add('dragover');
    else elements.plotWrap.classList.remove('dragover');
  }
  ['dragenter','dragover','dragleave','drop'].forEach(ev=>elements.plotWrap.addEventListener(ev,onDrag));
  elements.plotWrap.addEventListener('drop',(e)=>{ onDrag(e); handleFiles(e.dataTransfer.files); });

  // Inputs
  elements.fileInput.addEventListener('change', (e)=>{ handleFiles(e.target.files); elements.fileInput.value=''; });
  elements.btnClear.addEventListener('click', clearAll);
  elements.btnAll.addEventListener('click', ()=>{ names.forEach(n=>state.selected.add(n));lockLinesCardHeightAtStartupStable(); buildList(); renderSelectedLines();updateLineMarkers();   // <--- add this
lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
 refreshPlot(); });
  elements.btnNone.addEventListener('click', ()=>{ state.selected.clear(); lockLinesCardHeightAtStartupStable(); buildList();renderSelectedLines();
    updateLineMarkers();   // <--- add this
lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
 refreshPlot(); });

  // Plot type management
  // Toggle custom plot form visibility
  const btnToggleCustomPlot = document.getElementById('btnToggleCustomPlot');
  const customPlotForm = document.getElementById('customPlotForm');
  const toggleCustomPlotIcon = document.getElementById('toggleCustomPlotIcon');
  const plotCard = document.getElementById('cardPlot');

  if (plotCard) {
    plotCard.addEventListener('mouseenter', () => {
      const activePlotTypes = document.getElementById('activePlotTypes');
      if (activePlotTypes) {
        updatePlotCardHoverSizing(plotCard, activePlotTypes);
      }
    });
  }

  if (btnToggleCustomPlot && customPlotForm) {
    btnToggleCustomPlot.addEventListener('click', () => {
      const isHidden = customPlotForm.style.display === 'none';

      if (plotCard) {
        if (isHidden) {
          // Show form first to measure it
          customPlotForm.style.display = 'block';
          if (elements.activePlotTypes) {
            elements.activePlotTypes.dataset.hiddenByToggle = '1';
            elements.activePlotTypes.style.display = 'none';
          }

          // Wait for next frame to get accurate measurement
          requestAnimationFrame(() => {
            // Get the form's height
            const formHeight = customPlotForm.offsetHeight;

            // Get locked height
            const lockedHeightRaw = plotCard.dataset.lockedHeight;
            const lockedHeightValue = Number(lockedHeightRaw);
            const lockedHeight = Number.isFinite(lockedHeightValue) && lockedHeightValue > 0
              ? lockedHeightValue
              : Math.round(plotCard.getBoundingClientRect().height);

            // Calculate new height: locked height plus a trimmed portion of the form
            const newHeight = lockedHeight + Math.max(formHeight - 40, 0);

            // Set all height properties
            plotCard.style.height = newHeight + 'px';
            plotCard.style.maxHeight = newHeight + 'px';
            plotCard.style.setProperty('--card-fixed-height', newHeight + 'px');
            plotCard.classList.remove('has-overflow');
            plotCard.style.removeProperty('--expand-height');
          });

          if (toggleCustomPlotIcon) {
            toggleCustomPlotIcon.textContent = '▲';
          }
        } else {
          // Hide form
          customPlotForm.style.display = 'none';
          if (elements.activePlotTypes) {
            delete elements.activePlotTypes.dataset.hiddenByToggle;
            elements.activePlotTypes.style.display = '';
          }

          requestAnimationFrame(() => {
            const listEl = document.getElementById('activePlotTypes');
            if (listEl) {
              updatePlotCardHoverSizing(plotCard, listEl);
            }
          });

          // Restore locked height
          const lockedHeight = plotCard.dataset.lockedHeight;
          if (lockedHeight) {
            plotCard.style.height = lockedHeight + 'px';
            plotCard.style.maxHeight = lockedHeight + 'px';
            plotCard.style.setProperty('--card-fixed-height', lockedHeight + 'px');
          }

          if (toggleCustomPlotIcon) {
            toggleCustomPlotIcon.textContent = '▼';
          }

          // Check for overflow after closing toggle - use double requestAnimationFrame to wait for layout
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              checkCardsForOverflow();
            });
          });
        }
      } else {
        // Fallback if plotCard not found
        customPlotForm.style.display = isHidden ? 'block' : 'none';
        if (elements.activePlotTypes) {
          elements.activePlotTypes.style.display = isHidden ? 'none' : '';
        }
        if (toggleCustomPlotIcon) {
          toggleCustomPlotIcon.textContent = isHidden ? '▲' : '▼';
        }
      }
    });
  }

  // Update column selectors when spectrum is selected
  if (elements.spectrumSelect) {
    elements.spectrumSelect.addEventListener('change', () => {
      buildColumnSelectors(elements.spectrumSelect.value);
    });
  }

  elements.plotTypeSelect.addEventListener('change', () => {
    // Show/hide error column input based on plot type
    if (elements.plotTypeSelect.value === 'error-fill') {
      elements.errorColumnRow.style.display = 'block';
    } else {
      elements.errorColumnRow.style.display = 'none';
    }
  });
  elements.btnAddPlotType.addEventListener('click', addPlotType);

  if (elements.toggleHover) {
    elements.toggleHover.addEventListener('change', () => {
      state.showHover = elements.toggleHover.checked;
      if (state.showHover) {
        Plotly.relayout(elements.graph, {
          hovermode: 'x',
          'xaxis.showspikes': true,
          'xaxis.spikemode': 'across',
          'xaxis.spikesnap': 'cursor',
          'xaxis.spikelen': 0,
          'xaxis.spikecolor': 'rgba(107,114,128,0.6)',
          'xaxis.spikethickness': 1,
          'xaxis.spikedash': 'dash',
          'yaxis.showspikes': false
        });
      } else {
        Plotly.relayout(elements.graph, {
          hovermode: false,
          'xaxis.showspikes': false,
          'yaxis.showspikes': false
        });
      }
    });
  }

  elements.maxPoints.addEventListener('change', ()=>{ const v=Math.max(parseInt(elements.maxPoints.value,10)||1000,200); state.maxPoints=v; elements.maxPoints.value=v; refreshPlot(); });
  elements.lineWidth.addEventListener('change', ()=>{ const v=Math.min(Math.max(parseInt(elements.lineWidth.value,10)||2,1),6); state.lineWidth=v; elements.lineWidth.value=v; refreshPlot(); });
  elements.search.addEventListener('input', buildList);
  elements.btnViewColumns.addEventListener('click', openColumnsView);
  elements.xAxisLabel.addEventListener('input', ()=>{ state.xAxisLabel = elements.xAxisLabel.value; refreshPlot(); });
  elements.yAxisLabel.addEventListener('input', ()=>{ state.yAxisLabel = elements.yAxisLabel.value; refreshPlot(); });
  document.getElementById('btnDownloadLines').addEventListener('click', downloadLinesTxt);
  document.getElementById('btnClearLines').addEventListener('click', () => {
    if(!confirm('Clear all selected lines? This will remove all line markers from the plot.')) return;
    selectedLines.length = 0;
    renderSelectedLines();updateLineMarkers();   // <--- add this

  });

  function buildLineShapes(){
  if (!selectedLines.length) return [];
  return selectedLines.map(wl => ({
    type: 'line',
    xref: 'x',
    yref: 'paper',
    x0: wl,
    x1: wl,
    y0: 0,
    y1: 1,
    layer: 'above',
    opacity: 0.6,                       // alpha
    line: { color: 'black', width: 1.5 } // thin black line
  }));
}
function updateLineMarkers(){
  Plotly.relayout(elements.graph, { shapes: buildLineShapes() });
}
  function refreshPlot(){
    const active = Array.from(state.selected).filter(n => spectra[n]);
    const traces=[]; const xValues=[]; const yValues=[]; let totalPoints=0;

    if(!active.length){
      const layout=baseLayout();
      layout.shapes = buildLineShapes();

      layout.annotations=[{text:names.length?'Select plots to visualise':'Load spectra and add plots to begin',x:0.5,y:0.5,xref:'paper',yref:'paper',showarrow:false,font:{color:'#94a3b8',size:30}}];
      ignoreRelayout=true;
      Plotly.react(elements.graph, [], layout, config).then(() => {
        ignoreRelayout=false; updateUndoRedoButtons();
        if (!handlersBound && typeof elements.graph.on === 'function') {
  elements.graph.on('plotly_relayout', onRelayout);
  elements.graph.on('plotly_doubleclick', onDoubleClick);
  elements.graph.on('plotly_click', onPlotClick);  // keeps working for points
  // NEW: raw DOM click for empty-space picks (works with hover off)
  elements.graph.addEventListener('click', onGraphRawClick, true);
  handlersBound = true;
}
      });
      setStatus(names.length ? 'No spectra selected.' : 'No spectra loaded.', false);
      return;
    }

    // Build traces for each plot configuration
    state.activePlotTypes.forEach(config => {
      // Skip if plot is not visible
      if (config.visible === false) return;

      // Use the specific spectrum from the config
      const name = config.spectrumName;
      const spec = spectra[name];

      // Skip if spectrum no longer exists
      if (!spec) {
        console.log(`  ✗ Spectrum "${name}" not found, skipping config`);
        return;
      }

      const color = state.colors[name] || palette[0];
      console.log(`Using color for ${name}:`, color, `from state.colors[${name}]=`, state.colors[name]);

      console.log(`Plotting "${name}" with config:`, config);
      console.log(`  Spectrum has columns:`, spec.columns);
      console.log(`  Looking for X column:`, config.xCol);
      console.log(`  Looking for Y column:`, config.yCol);
      console.log(`  Available keys in spec:`, Object.keys(spec).filter(k => k !== 'columns'));

        // Get the column data
        const xData = spec[config.xCol];
        const yData = spec[config.yCol];
        console.log(`  X data (${config.xCol}):`, !!xData, `length:`, xData?.length, `first values:`, xData ? Array.from(xData.slice(0, 3)) : 'none');
        console.log(`  Y data (${config.yCol}):`, !!yData, `length:`, yData?.length, `first values:`, yData ? Array.from(yData.slice(0, 3)) : 'none');
        if (!xData || !yData) {
          console.log(`  ✗ Skipping "${name}" - column data not found`);
          return;
        }
        console.log(`  ✓ Will plot "${name}"`);

        // Build sampled data for this plot
        const s = buildSampleCustom(spec, config.xCol, config.yCol, config.errorCol);
        if (!s.x.length) return;
        totalPoints += s.x.length;

        // Check if data is effectively a single point
        const xMin = Math.min(...s.x);
        const xMax = Math.max(...s.x);
        const yMin = Math.min(...s.y);
        const yMax = Math.max(...s.y);
        const isConstantX = (xMax - xMin) < 1e-10 * Math.abs(xMax || 1);
        const isConstantY = (yMax - yMin) < 1e-10 * Math.abs(yMax || 1);
        const isSinglePoint = s.x.length === 1 || (isConstantX && isConstantY);

        // Generate trace based on plot type
        if (config.type === 'error-fill' && config.errorCol && spec.columns.includes(config.errorCol)) {
          const errX = [], upper = [], lower = [];
          for (let j = 0; j < s.x.length; j++) {
            const yv = s.y[j], ev = s.err[j];
            if (!Number.isFinite(yv) || !Number.isFinite(ev)) continue;
            const e = Math.abs(ev);
            errX.push(s.x[j]);
            upper.push(yv + e);
            lower.push(yv - e);
          }
          if (errX.length) {
            // Create the filled error band
            const fillX = errX.concat([...errX].reverse());
            const fillY = upper.concat([...lower].reverse());
            const legendName = config.label ? `${name} ${config.label}` : `${name} ± ${config.errorCol}`;

            // Extract RGB from color and apply fixed alpha of 0.2
            const colorParsed = parseColorWithAlpha(color);
            const fixedAlphaColor = `rgba(${colorParsed.r}, ${colorParsed.g}, ${colorParsed.b}, 0.2)`;
            console.log(`Error fill for ${name}: input color="${color}", parsed=`, colorParsed, `final="${fixedAlphaColor}"`);

            // Add only the error band fill (no center line)
            traces.push({
              type: 'scatter',
              mode: 'lines',
              x: fillX,
              y: fillY,
              fill: 'toself',
              fillcolor: fixedAlphaColor,
              line: { width: 0 },
              name: legendName,
              legendgroup: `${name}-${config.id}`,
              hoverinfo: 'skip',
              showlegend: config.label ? true : false
            });

            collectFinite(upper, yValues);
            collectFinite(lower, yValues);
            collectFinite(errX, xValues);
          }
        } else if (config.type === 'line-dashed') {
          const lineColor = hexWithAlpha(color, 0.8);
          const legendName = config.label ? `${name} ${config.label}` : `${name} ${config.yCol}`;
          const hoverTemplate = `${name}<br>${config.yCol}: %{y:.3e}<extra></extra>`;
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: s.x,
            y: s.y,
            line: { color: lineColor, width: state.lineWidth, dash: 'dash' },
            opacity: 0.85,
            name: legendName,
            legendgroup: `${name}-${config.id}`,
            showlegend: config.label ? true : false,
            hovertemplate: hoverTemplate,
            hoverlabel: {
              bgcolor: hexWithAlpha(color, 0.15),
              bordercolor: color,
              font: { color: '#0f172a' }
            }
          });
          collectFinite(s.x, xValues);
          collectFinite(s.y, yValues);
        } else if (config.type === 'line-solid') {
          const legendName = config.label ? `${name} ${config.label}` : `${name} ${config.yCol}`;
          const hoverTemplate = `${name}<br>${config.yCol}: %{y:.3e}<extra></extra>`;
          traces.push({
            type: 'scatter',
            mode: 'lines',
            x: s.x,
            y: s.y,
            line: { color: color, width: state.lineWidth },
            name: legendName,
            legendgroup: `${name}-${config.id}`,
            showlegend: config.label ? true : false,
            hovertemplate: hoverTemplate,
            hoverlabel: {
              bgcolor: hexWithAlpha(color, 0.15),
              bordercolor: color,
              font: { color: '#0f172a' }
            }
          });
          collectFinite(s.x, xValues);
          collectFinite(s.y, yValues);
        }
    });

    const layout=baseLayout();
    layout.shapes = buildLineShapes();

    // X: respect stored view or handle constant data
    if(state.xRange){ 
      layout.xaxis.range=state.xRange.slice(); 
      layout.xaxis.autorange=false; 
    } else if(xValues.length) {
      const xLo=percentile(xValues,1), xHi=percentile(xValues,99);
      if(Number.isFinite(xLo)&&Number.isFinite(xHi)){
        if(xHi>xLo){ 
          // Normal case: X data has variation
          layout.xaxis.autorange=true; 
        } else { 
          // Constant X data: add fixed padding
          const pad = Math.abs(xLo) * 0.1 || 1;
          layout.xaxis.range=[xLo-pad, xLo+pad]; 
          layout.xaxis.autorange=false; 
        }
      } else { 
        layout.xaxis.autorange=true; 
      }
    } else { 
      layout.xaxis.autorange=true; 
    }

    // Y: either stored view or percentile smart fit
    if(state.yRange){ layout.yaxis.range=state.yRange.slice(); layout.yaxis.autorange=false; }
    else if(yValues.length){
      const lo=percentile(yValues,1), hi=percentile(yValues,99);
      if(Number.isFinite(lo)&&Number.isFinite(hi)){
        if(hi>lo){ 
          // Normal case: data has variation
          const pad=(hi-lo)*0.05; 
          layout.yaxis.range=[lo-pad,hi+pad]; 
          layout.yaxis.autorange=false; 
        } else { 
          // Constant or near-constant data: add fixed padding
          const pad = Math.abs(lo) * 0.1 || 1; // 10% of value or 1 if value is 0
          layout.yaxis.range=[lo-pad, lo+pad]; 
          layout.yaxis.autorange=false; 
        }
      }
      else { layout.yaxis.autorange=true; }
    } else { layout.yaxis.autorange=true; }

    ignoreRelayout=true;
    Plotly.react(elements.graph, traces, layout, config).then(()=>{
      ignoreRelayout=false; 
      updateUndoRedoButtons();

      // Re-render MathJax for axis labels
      if (window.MathJax && window.MathJax.Hub) {
        window.MathJax.Hub.Queue(['Typeset', window.MathJax.Hub, elements.graph]);
      }

      // Ensure handlers are bound once
      if (!handlersBound && typeof elements.graph.on === 'function') {
  elements.graph.on('plotly_relayout', onRelayout);
  elements.graph.on('plotly_doubleclick', onDoubleClick);
  elements.graph.on('plotly_click', onPlotClick);  // keeps working for points
  // NEW: raw DOM click for empty-space picks (works with hover off)
  elements.graph.addEventListener('click', onGraphRawClick, true);
  handlersBound = true;
}
function setPickCursor(active){
  elements.graph.style.cursor = active ? 'crosshair' : '';
}

      // Baseline history should match the first computed numeric Y range
      if(history.past.length === 1 && history.future.length === 0 && state.xRange === null && state.yRange === null){
        const baselineY = elements.graph.layout?.yaxis?.range ? elements.graph.layout.yaxis.range.slice() : null;
        history.past[0] = { xRange: null, yRange: baselineY };
        baselineView = { xRange: null, yRange: baselineY };
        updateUndoRedoButtons();
      }
    });
    bootstrapping = false;

    setStatus(active.length + ' spectra selected', false);
  }

  // Initial UI hookups + first paint
  elements.fileInput.addEventListener('change', (e)=>{ handleFiles(e.target.files); elements.fileInput.value=''; });  
  elements.btnClear.addEventListener('click', clearAll);
  elements.btnAll.addEventListener('click', ()=>{ names.forEach(n=>state.selected.add(n)); lockLinesCardHeightAtStartupStable(); buildList();renderSelectedLines(); updateLineMarkers();   // <--- add this
lockSpectraCardHeightAtStartup(); lockExpandableCardsToSpectraHeight(); refreshPlot(); });
  elements.btnNone.addEventListener('click', ()=>{ state.selected.clear(); lockLinesCardHeightAtStartupStable(); buildList();renderSelectedLines();updateLineMarkers();   // <--- add this
lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
 refreshPlot(); });
  elements.maxPoints.addEventListener('change', ()=>{ const v=Math.max(parseInt(elements.maxPoints.value,10)||1000,200); state.maxPoints=v; elements.maxPoints.value=v; refreshPlot(); });
  elements.lineWidth.addEventListener('change', ()=>{ const v=Math.min(Math.max(parseInt(elements.lineWidth.value,10)||2,1),6); state.lineWidth=v; elements.lineWidth.value=v; refreshPlot(); });
  elements.search.addEventListener('input', buildList);

  // Drag/drop
  ['dragenter','dragover','dragleave','drop'].forEach(ev=>elements.plotWrap.addEventListener(ev,onDrag));
  elements.plotWrap.addEventListener('drop',(e)=>{ onDrag(e); handleFiles(e.dataTransfer.files); });

  lockLinesCardHeightAtStartupStable(); buildList();renderSelectedLines();lockSpectraCardHeightAtStartup();  // <-- NEW: freeze initial height
  lockExpandableCardsToSpectraHeight();  // <-- Match other cards to Spectra height
  buildActivePlotTypesList();  // Initialize plot types list
  lockPlotCardToInitialHeight();  // Lock Plot card to its empty state

  refreshPlot();
  updateUndoRedoButtons();
});
