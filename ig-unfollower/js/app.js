/**
 * app.js
 * Main application controller.
 * Wires together IGParser, IGUI, and all event listeners.
 * Depends on: parser.js, ui.js
 */

(() => {
  'use strict';

  /* ── App state ───────────────────────────────────── */
  const state = {
    followers: null,   // raw parsed array from followers file
    following: null,   // raw parsed array from following file
    results:   null,   // { nonFollowers, mutual, totalFollowers, totalFollowing }
  };

  /* ── Theme ───────────────────────────────────────── */
  function initTheme() {
    const saved     = localStorage.getItem('ig-unfollowed-theme');
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved || preferred);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('theme-icon');
    icon.className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    localStorage.setItem('ig-unfollowed-theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  /* ── File loading ────────────────────────────────── */
  function readFile(file, type) {
    return new Promise((resolve, reject) => {
      if (!file) { reject(new Error('No file provided.')); return; }
      if (!file.name.endsWith('.json')) {
        reject(new Error(`"${file.name}" doesn't look like a JSON file. Make sure you select the .json files from your Instagram export.`));
        return;
      }
      const reader = new FileReader();
      reader.onload  = e => resolve(e.target.result);
      reader.onerror = () => reject(new Error(`Could not read ${file.name}. The file may be corrupted.`));
      reader.readAsText(file, 'utf-8');
    });
  }

  async function handleFileSelect(type, file) {
    if (!file) return;
    IGUI.hideError();

    try {
      const text = await readFile(file, type);
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`"${file.name}" is not valid JSON. Make sure you downloaded the JSON format (not HTML) from Instagram.`);
      }

      const parsed = IGParser.parse(json, type);
      state[type] = parsed;

      IGUI.setZoneLoaded(type, file.name);
      updateAnalyzeButton();

    } catch (err) {
      IGUI.showError(err.message);
      state[type] = null;
      IGUI.resetZone(type);
      updateAnalyzeButton();
    }
  }

  function updateAnalyzeButton() {
    IGUI.setAnalyzeReady(!!(state.followers && state.following));
  }

  /* ── Drag and drop ───────────────────────────────── */
  function setupDropZone(zoneEl, type) {
    const fileInput = document.getElementById('file-' + type);

    // Click / keyboard activation
    zoneEl.addEventListener('click', e => {
      // Don't double-trigger if the click is on the hidden input itself
      if (e.target !== fileInput) fileInput.click();
    });

    zoneEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        fileInput.click();
      }
    });

    // Native input change
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleFileSelect(type, fileInput.files[0]);
    });

    // Drag events
    zoneEl.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      zoneEl.classList.add('drag-over');
    });
    zoneEl.addEventListener('dragleave', e => {
      if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over');
    });
    zoneEl.addEventListener('drop', e => {
      e.preventDefault();
      zoneEl.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(type, file);
    });
  }

  /* ── Analyze ─────────────────────────────────────── */
  function analyze() {
    if (!state.followers || !state.following) return;
    IGUI.hideError();

    try {
      state.results = IGParser.compare(state.followers, state.following);
      IGUI.updateStats(state.results);
      IGUI.showResults();
      renderFilteredList();
    } catch (err) {
      IGUI.showError('Analysis failed: ' + err.message);
    }
  }

  /* ── Filter + Sort + Render ──────────────────────── */
  function renderFilteredList() {
    if (!state.results) return;

    const query = document.getElementById('search-input').value.trim().toLowerCase();
    const sort  = document.getElementById('sort-select').value;

    let list = [...state.results.nonFollowers];

    // Filter
    if (query) {
      list = list.filter(u => u.username.includes(query));
    }

    // Sort
    switch (sort) {
      case 'alpha':      list.sort((a, b) => a.username.localeCompare(b.username)); break;
      case 'alpha-desc': list.sort((a, b) => b.username.localeCompare(a.username)); break;
      case 'date-new':   list.sort((a, b) => b.timestamp - a.timestamp); break;
      case 'date-old':   list.sort((a, b) => a.timestamp - b.timestamp); break;
    }

    IGUI.renderList(list, query);
  }

  /* ── Search clear button ─────────────────────────── */
  function updateSearchClear(value) {
    const btn = document.getElementById('search-clear');
    if (value.trim()) {
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  }

  /* ── CSV Export ──────────────────────────────────── */
  function exportCSV() {
    if (!state.results) return;

    const rows = [['username', 'instagram_url', 'followed_date']];
    for (const u of state.results.nonFollowers) {
      const date = u.timestamp
        ? new Date(u.timestamp * 1000).toISOString().slice(0, 10)
        : '';
      const url = u.href || `https://www.instagram.com/${encodeURIComponent(u.username)}/`;
      rows.push([u.username, url, date]);
    }

    const csv = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), {
      href:     url,
      download: `instagram_non_followers_${new Date().toISOString().slice(0, 10)}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Init ────────────────────────────────────────── */
  function init() {
    initTheme();

    // Theme toggle
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    // Drop zones
    setupDropZone(document.getElementById('zone-followers'), 'followers');
    setupDropZone(document.getElementById('zone-following'), 'following');

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', analyze);

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
      updateSearchClear(searchInput.value);
      renderFilteredList();
    });

    // Search clear
    document.getElementById('search-clear').addEventListener('click', () => {
      searchInput.value = '';
      updateSearchClear('');
      searchInput.focus();
      renderFilteredList();
    });

    // Sort
    document.getElementById('sort-select').addEventListener('change', renderFilteredList);

    // Export
    document.getElementById('export-btn').addEventListener('click', exportCSV);

    // System dark-mode changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('ig-unfollowed-theme')) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // Kick off once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
