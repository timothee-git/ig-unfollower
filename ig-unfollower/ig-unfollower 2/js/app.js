/**
 * app.js — Main controller (v2)
 * Depends on: parser.js, ui.js
 */

(() => {
  'use strict';

  /* ── State ──────────────────────────────────────────────── */
  const state = {
    followers: null,   // merged array from all followers files
    following: null,   // array from following.json
    results:   null,   // full compare() output
    activeTab: 'notfollowing',
  };

  /* ── Theme ──────────────────────────────────────────────── */
  function initTheme() {
    const saved = localStorage.getItem('ig-unfollowed-theme');
    const pref  = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(saved || pref);
  }
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.getElementById('theme-icon').className = theme === 'dark' ? 'ti ti-sun' : 'ti ti-moon';
    localStorage.setItem('ig-unfollowed-theme', theme);
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  }

  /* ── File reading ───────────────────────────────────────── */
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      if (!file.name.endsWith('.json')) {
        reject(new Error(`"${file.name}" is not a JSON file.`)); return;
      }
      const r = new FileReader();
      r.onload  = e => resolve(e.target.result);
      r.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      r.readAsText(file, 'utf-8');
    });
  }

  async function parseFileToJson(file) {
    const text = await readFileAsText(file);
    try   { return JSON.parse(text); }
    catch { throw new Error(`"${file.name}" is not valid JSON. Make sure you downloaded the JSON format (not HTML) from Instagram.`); }
  }

  /* ── Followers: multiple files ──────────────────────────── */
  async function handleFollowersFiles(files) {
    if (!files || files.length === 0) return;
    IGUI.hideError();
    try {
      const parsed = [];
      for (const file of files) {
        const json = await parseFileToJson(file);
        parsed.push({ json, filename: file.name });
      }
      state.followers = IGParser.parseMultiple(parsed);

      const label = files.length === 1
        ? files[0].name
        : `${files.length} files (${state.followers.length.toLocaleString()} followers)`;
      IGUI.setZoneLoaded('followers', label);
      updateAnalyzeButton();
    } catch (err) {
      IGUI.showError(err.message);
      state.followers = null;
      IGUI.resetZone('followers');
      updateAnalyzeButton();
    }
  }

  /* ── Following: single file ─────────────────────────────── */
  async function handleFollowingFile(file) {
    if (!file) return;
    IGUI.hideError();
    try {
      const json    = await parseFileToJson(file);
      state.following = IGParser.parse(json, 'following');
      IGUI.setZoneLoaded('following', file.name);
      updateAnalyzeButton();
    } catch (err) {
      IGUI.showError(err.message);
      state.following = null;
      IGUI.resetZone('following');
      updateAnalyzeButton();
    }
  }

  function updateAnalyzeButton() {
    IGUI.setAnalyzeReady(!!(state.followers && state.following));
  }

  /* ── Drop zone wiring ───────────────────────────────────── */
  function setupDropZone(zoneEl, type) {
    const input = document.getElementById('file-' + type);

    zoneEl.addEventListener('click', e => { if (e.target !== input) input.click(); });
    zoneEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
    });

    input.addEventListener('change', () => {
      const files = Array.from(input.files);
      if (!files.length) return;
      if (type === 'followers') handleFollowersFiles(files);
      else                      handleFollowingFile(files[0]);
    });

    zoneEl.addEventListener('dragover', e => {
      e.preventDefault(); e.dataTransfer.dropEffect = 'copy';
      zoneEl.classList.add('drag-over');
    });
    zoneEl.addEventListener('dragleave', e => {
      if (!zoneEl.contains(e.relatedTarget)) zoneEl.classList.remove('drag-over');
    });
    zoneEl.addEventListener('drop', e => {
      e.preventDefault();
      zoneEl.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.json'));
      if (!files.length) { IGUI.showError('Please drop .json files only.'); return; }
      if (type === 'followers') handleFollowersFiles(files);
      else                      handleFollowingFile(files[0]);
    });
  }

  /* ── Analyze ────────────────────────────────────────────── */
  function analyze() {
    if (!state.followers || !state.following) return;
    IGUI.hideError();
    try {
      state.results = IGParser.compare(state.followers, state.following);
      IGUI.updateStats(state.results);
      IGUI.showResults();
      switchTab('notfollowing');
    } catch (err) {
      IGUI.showError('Analysis failed: ' + err.message);
    }
  }

  /* ── Tabs ───────────────────────────────────────────────── */
  function switchTab(tabId) {
    state.activeTab = tabId;

    document.querySelectorAll('.tab').forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', String(active));
    });
    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== 'panel-' + tabId);
    });

    if (tabId === 'notfollowing') renderPanel('notfollowing');
    if (tabId === 'notfollowed')  renderPanel('notfollowed');
    if (tabId === 'recent')       IGUI.renderRecent(state.results?.recentFollowers || []);
  }

  /* ── Per-tab render ─────────────────────────────────────── */
  function renderPanel(panelId) {
    if (!state.results) return;

    const isNotFollowing = panelId === 'notfollowing';
    const sourceList  = isNotFollowing ? state.results.notFollowingBack : state.results.notFollowedBack;
    const query       = document.getElementById('search-' + panelId)?.value.trim().toLowerCase() || '';
    const sort        = document.getElementById('sort-' + panelId)?.value || 'alpha';

    let list = [...sourceList];
    if (query) list = list.filter(u => u.username.includes(query));

    switch (sort) {
      case 'alpha':      list.sort((a,b) => a.username.localeCompare(b.username)); break;
      case 'alpha-desc': list.sort((a,b) => b.username.localeCompare(a.username)); break;
      case 'date-new':   list.sort((a,b) => b.timestamp - a.timestamp);           break;
      case 'date-old':   list.sort((a,b) => a.timestamp - b.timestamp);           break;
    }

    const badge      = isNotFollowing ? "doesn't follow back" : "you don't follow";
    const datePrefix = isNotFollowing ? 'followed' : 'followed you';

    IGUI.renderList(
      'list-' + panelId,
      'count-' + panelId,
      list,
      query,
      badge,
      datePrefix
    );
  }

  /* ── Search helpers ─────────────────────────────────────── */
  function wireSearch(panelId) {
    const input   = document.getElementById('search-' + panelId);
    const clearBtn = document.getElementById('clear-' + panelId);
    if (!input) return;

    input.addEventListener('input', () => {
      clearBtn.hidden = !input.value.trim();
      if (state.activeTab === panelId) renderPanel(panelId);
    });
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      input.focus();
      renderPanel(panelId);
    });
    document.getElementById('sort-' + panelId)?.addEventListener('change', () => renderPanel(panelId));
  }

  /* ── CSV export ─────────────────────────────────────────── */
  function exportPanel(panelId) {
    if (!state.results) return;
    const list = panelId === 'notfollowing'
      ? state.results.notFollowingBack
      : state.results.notFollowedBack;

    const rows = [['username', 'instagram_url', 'date']];
    for (const u of list) {
      const date = u.timestamp ? new Date(u.timestamp * 1000).toISOString().slice(0, 10) : '';
      rows.push([u.username, u.href || `https://www.instagram.com/${u.username}/`, date]);
    }
    downloadCSV(rows, `instagram_${panelId}_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  function downloadCSV(rows, filename) {
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ── Init ───────────────────────────────────────────────── */
  function init() {
    initTheme();

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

    setupDropZone(document.getElementById('zone-followers'), 'followers');
    setupDropZone(document.getElementById('zone-following'), 'following');

    document.getElementById('analyze-btn').addEventListener('click', analyze);

    // Tabs
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Search + sort per panel
    wireSearch('notfollowing');
    wireSearch('notfollowed');

    // Exports
    document.getElementById('export-notfollowing').addEventListener('click', () => exportPanel('notfollowing'));
    document.getElementById('export-notfollowed').addEventListener('click',  () => exportPanel('notfollowed'));

    // System dark-mode
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('ig-unfollowed-theme')) applyTheme(e.matches ? 'dark' : 'light');
    });
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
