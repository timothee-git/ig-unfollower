/**
 * ui.js — DOM rendering & accessibility layer (v2)
 * Depends on: parser.js
 */

window.IGUI = (() => {
  'use strict';

  const AVATAR_COLOURS = [
    { bg: '#EEF3FD', fg: '#1D4ED8' },
    { bg: '#E3F5F0', fg: '#0D5C47' },
    { bg: '#FAEAE4', fg: '#9B3518' },
    { bg: '#F3EEF9', fg: '#6D28D9' },
    { bg: '#FEF3CD', fg: '#92400E' },
    { bg: '#FCE7F3', fg: '#9D174D' },
  ];

  function avatarColour(username) {
    let h = 0;
    for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % AVATAR_COLOURS.length;
    return AVATAR_COLOURS[Math.abs(h)];
  }

  function initials(u) { return u.slice(0, 2).toUpperCase(); }

  function formatDate(ts) {
    if (!ts) return '';
    try { return new Date(ts * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }); }
    catch { return ''; }
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  function highlight(text, q) {
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return escHtml(text);
    return escHtml(text.slice(0, idx))
      + `<mark class="hl">${escHtml(text.slice(idx, idx + q.length))}</mark>`
      + escHtml(text.slice(idx + q.length));
  }

  /* ── Stats ──────────────────────────────────────────────── */

  function updateStats(r) {
    document.getElementById('stat-followers').textContent      = r.totalFollowers.toLocaleString();
    document.getElementById('stat-following').textContent      = r.totalFollowing.toLocaleString();
    document.getElementById('stat-notfollowingback').textContent = r.notFollowingBack.length.toLocaleString();
    document.getElementById('stat-mutual').textContent         = r.mutual.length.toLocaleString();
    document.getElementById('stat-notfollowedback').textContent = r.notFollowedBack.length.toLocaleString();

    const ratio = r.followRatio;
    const ratioEl = document.getElementById('stat-ratio');
    ratioEl.textContent = ratio.toFixed(2) + 'x';
    ratioEl.style.color = ratio >= 1 ? 'var(--teal)' : 'var(--coral)';

    // Ratio bar = % of your following that follows you back
    const fill = document.getElementById('ratio-bar-fill');
    const pct  = Math.min(100, r.mutualPct);
    fill.style.width = pct + '%';
    fill.style.background = pct >= 70 ? 'var(--teal)' : pct >= 40 ? 'var(--amber)' : 'var(--coral)';

    const desc = document.getElementById('ratio-desc');
    desc.textContent = `${r.mutualPct}% of the accounts you follow also follow you back (${r.mutual.length.toLocaleString()} mutual).`;

    // Tab counts
    document.getElementById('tc-notfollowing').textContent = r.notFollowingBack.length.toLocaleString();
    document.getElementById('tc-notfollowed').textContent  = r.notFollowedBack.length.toLocaleString();
    document.getElementById('tc-recent').textContent       = r.recentFollowers.length.toLocaleString();
  }

  /* ── List rendering ─────────────────────────────────────── */

  const MAX = 300;

  function renderList(listId, countId, users, query, badgeLabel, datePrefix) {
    const list    = document.getElementById(listId);
    const countEl = document.getElementById(countId);

    if (!users || users.length === 0) {
      list.innerHTML = `<li class="empty-state"><i class="ti ti-mood-smile" aria-hidden="true"></i><p>${query ? `No results for "${escHtml(query)}"` : 'Nothing to show here!'}</p></li>`;
      if (countEl) countEl.textContent = 'No results.';
      return;
    }

    const shown    = users.slice(0, MAX);
    const overflow = users.length - shown.length;

    list.innerHTML = shown.map((u, i) => {
      const { bg, fg } = avatarColour(u.username);
      const href       = u.href || `https://www.instagram.com/${encodeURIComponent(u.username)}/`;
      const dateStr    = formatDate(u.timestamp);
      const name       = query ? highlight(u.username, query) : escHtml(u.username);

      return `<li class="result-item" style="animation-delay:${Math.min(i * 0.015, 0.25)}s">
        <div class="avatar" style="background:${bg};color:${fg}" aria-hidden="true">${initials(u.username)}</div>
        <div class="user-info">
          <div class="user-name">${name}</div>
          ${dateStr ? `<div class="user-date">${escHtml(datePrefix)} ${escHtml(dateStr)}</div>` : ''}
        </div>
        <span class="badge" aria-label="${escHtml(badgeLabel)}">${escHtml(badgeLabel)}</span>
        <a class="ig-link" href="${escHtml(href)}" target="_blank" rel="noopener noreferrer" aria-label="Open ${escHtml(u.username)} on Instagram">
          <i class="ti ti-external-link" aria-hidden="true"></i> Open
        </a>
      </li>`;
    }).join('');

    if (overflow > 0) {
      list.innerHTML += `<li class="list-overflow">Showing ${MAX.toLocaleString()} of ${users.length.toLocaleString()} — use search to filter</li>`;
    }

    if (countEl) {
      countEl.textContent = `Showing ${Math.min(users.length, MAX).toLocaleString()} of ${users.length.toLocaleString()} results.`;
    }
  }

  /* ── Recent followers (no badge, no search) ─────────────── */

  function renderRecent(users) {
    renderList('list-recent', null, users, '', 'follower', 'followed');
  }

  /* ── Upload zone state ──────────────────────────────────── */

  function setZoneLoaded(type, label) {
    const zone = document.getElementById('zone-' + type);
    zone.classList.add('loaded');
    zone.setAttribute('aria-label', `${label} loaded. Click to replace.`);
    document.getElementById('label-' + type).textContent = label;
  }

  function resetZone(type) {
    const zone = document.getElementById('zone-' + type);
    zone.classList.remove('loaded');
    const defaults = {
      followers: { label: 'followers_*.json', aria: 'Upload followers JSON files.' },
      following: { label: 'following.json',   aria: 'Upload following JSON file.' },
    };
    zone.setAttribute('aria-label', defaults[type].aria);
    document.getElementById('label-' + type).textContent = defaults[type].label;
  }

  /* ── Analyze button ─────────────────────────────────────── */

  function setAnalyzeReady(ready) {
    const btn  = document.getElementById('analyze-btn');
    const hint = document.getElementById('analyze-hint');
    btn.disabled = !ready;
    btn.setAttribute('aria-disabled', String(!ready));
    hint.textContent = ready ? 'Both files loaded — click to analyze.' : 'Upload both files to enable analysis.';
  }

  /* ── Error / info ───────────────────────────────────────── */

  function showError(msg) {
    const b = document.getElementById('error-banner');
    document.getElementById('error-text').textContent = msg;
    b.hidden = false;
  }

  function hideError() {
    document.getElementById('error-banner').hidden = true;
  }

  /* ── Results visibility ─────────────────────────────────── */

  function showResults() {
    const s = document.getElementById('results-section');
    s.hidden = false;
    s.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return {
    updateStats,
    renderList,
    renderRecent,
    setZoneLoaded,
    resetZone,
    setAnalyzeReady,
    showError,
    hideError,
    showResults,
  };

})();
