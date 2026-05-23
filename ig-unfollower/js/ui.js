/**
 * ui.js
 * All DOM rendering, animations, and live-region announcements.
 * Depends on: parser.js (window.IGParser)
 */

window.IGUI = (() => {

  /* ── Avatar colour palette ───────────────────────── */
  const AVATAR_COLOURS = [
    { bg: '#EEF3FD', fg: '#1D4ED8' },
    { bg: '#E3F5F0', fg: '#0D5C47' },
    { bg: '#FAEAE4', fg: '#9B3518' },
    { bg: '#F3EEF9', fg: '#6D28D9' },
    { bg: '#FEF3CD', fg: '#92400E' },
    { bg: '#FCE7F3', fg: '#9D174D' },
  ];

  function avatarColour(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = (hash * 31 + username.charCodeAt(i)) % AVATAR_COLOURS.length;
    }
    return AVATAR_COLOURS[Math.abs(hash)];
  }

  function initials(username) {
    return username.slice(0, 2).toUpperCase();
  }

  /* ── Date formatting ─────────────────────────────── */
  function formatDate(timestamp) {
    if (!timestamp) return '';
    try {
      return new Date(timestamp * 1000).toLocaleDateString(undefined, {
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return '';
    }
  }

  /* ── Stat cards ──────────────────────────────────── */
  function updateStats({ totalFollowers, totalFollowing, nonFollowers, mutual }) {
    document.getElementById('stat-followers').textContent    = totalFollowers.toLocaleString();
    document.getElementById('stat-following').textContent    = totalFollowing.toLocaleString();
    document.getElementById('stat-nonfollowers').textContent = nonFollowers.length.toLocaleString();
    document.getElementById('stat-mutual').textContent       = mutual.toLocaleString();
  }

  /* ── Result list ─────────────────────────────────── */
  /**
   * Renders the filtered + sorted non-follower list into #result-list.
   * @param {Array<{username, href, timestamp}>} users
   * @param {string} query — search query for highlighting
   */
  function renderList(users, query) {
    const list = document.getElementById('result-list');
    const countEl = document.getElementById('list-count');
    const MAX = 300;

    if (users.length === 0) {
      list.innerHTML = `
        <li class="empty-state" role="listitem">
          <i class="ti ti-mood-smile" aria-hidden="true"></i>
          <p>${query ? `No results matching "${escHtml(query)}"` : 'Everyone you follow follows you back!'}</p>
        </li>`;
      countEl.textContent = query ? `No results for "${query}"` : 'No non-followers found.';
      return;
    }

    const displayed = users.slice(0, MAX);
    const overflow  = users.length - displayed.length;

    list.innerHTML = displayed.map((u, i) => renderItem(u, i, query)).join('');

    if (overflow > 0) {
      list.innerHTML += `<li class="list-overflow" role="listitem">
        Showing ${MAX.toLocaleString()} of ${users.length.toLocaleString()} — use search to filter
      </li>`;
    }

    countEl.textContent = `Showing ${Math.min(users.length, MAX).toLocaleString()} of ${users.length.toLocaleString()} accounts not following you back.`;
  }

  function renderItem(user, index, query) {
    const { bg, fg }  = avatarColour(user.username);
    const href        = user.href || `https://www.instagram.com/${encodeURIComponent(user.username)}/`;
    const dateStr     = formatDate(user.timestamp);
    const displayName = query ? highlight(user.username, query) : escHtml(user.username);

    return `
      <li class="result-item" role="listitem" style="animation-delay:${Math.min(index * 0.02, 0.3)}s">
        <div
          class="avatar"
          aria-hidden="true"
          style="background:${bg}; color:${fg}"
        >${initials(user.username)}</div>

        <div class="user-info">
          <div class="user-name">${displayName}</div>
          ${dateStr ? `<div class="user-date">followed ${escHtml(dateStr)}</div>` : ''}
        </div>

        <span class="badge" aria-label="not following back">not following back</span>

        <a
          class="ig-link"
          href="${escHtml(href)}"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open ${escHtml(user.username)} on Instagram (opens in new tab)"
        >
          <i class="ti ti-external-link" aria-hidden="true"></i>
          Open
        </a>
      </li>`;
  }

  /* Highlights query substring in a username string */
  function highlight(text, query) {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return escHtml(text);
    return (
      escHtml(text.slice(0, idx)) +
      `<mark style="background:rgba(255,220,0,0.45);border-radius:2px;padding:0 1px">${escHtml(text.slice(idx, idx + query.length))}</mark>` +
      escHtml(text.slice(idx + query.length))
    );
  }

  /* ── Error / success banners ─────────────────────── */
  function showError(msg) {
    const banner = document.getElementById('error-banner');
    document.getElementById('error-text').textContent = msg;
    banner.hidden = false;
    banner.focus?.();
  }

  function hideError() {
    document.getElementById('error-banner').hidden = true;
  }

  /* ── Upload zone state ───────────────────────────── */
  function setZoneLoaded(type, filename) {
    const zone  = document.getElementById('zone-' + type);
    const label = document.getElementById('label-' + type);
    const hint  = document.getElementById('hint-' + type);
    zone.classList.add('loaded');
    zone.setAttribute('aria-label', `${filename} loaded. Click to replace.`);
    label.textContent = filename;
    hint.textContent  = ''; // visually hidden; .drop-check shows "✓ Loaded"
  }

  function resetZone(type) {
    const defaults = {
      followers: { label: 'followers_1.json', hint: 'Click or drag & drop', ariaLabel: 'Upload followers JSON file. Click or press Enter to browse.' },
      following: { label: 'following.json',   hint: 'Click or drag & drop', ariaLabel: 'Upload following JSON file. Click or press Enter to browse.' },
    };
    const zone  = document.getElementById('zone-' + type);
    const label = document.getElementById('label-' + type);
    const hint  = document.getElementById('hint-' + type);
    zone.classList.remove('loaded');
    zone.setAttribute('aria-label', defaults[type].ariaLabel);
    label.textContent = defaults[type].label;
    hint.textContent  = defaults[type].hint;
  }

  /* ── Analyze button state ────────────────────────── */
  function setAnalyzeReady(ready) {
    const btn  = document.getElementById('analyze-btn');
    const hint = document.getElementById('analyze-hint');
    btn.disabled          = !ready;
    btn.setAttribute('aria-disabled', String(!ready));
    hint.textContent = ready
      ? 'Both files loaded. Click to analyze.'
      : 'Upload both files to enable analysis.';
  }

  /* ── Results section visibility ──────────────────── */
  function showResults() {
    const section = document.getElementById('results-section');
    section.hidden = false;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── Utility: escape HTML ────────────────────────── */
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return {
    updateStats,
    renderList,
    showError,
    hideError,
    setZoneLoaded,
    resetZone,
    setAnalyzeReady,
    showResults,
  };

})();
