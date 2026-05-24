/**
 * parser.js — Instagram JSON export parser (v2)
 *
 * KEY FIX: Instagram splits large follower lists across multiple files
 * (followers_1.json, followers_2.json, …). parseMultiple() merges them all,
 * which was the root cause of false positives in v1.
 *
 * Username extraction priority:
 *   1. item.title  — most reliable; Instagram puts the handle here directly
 *   2. string_list_data[].href URL path — e.g. instagram.com/handle
 *   3. string_list_data[].value — fallback; sometimes a display name on old exports
 */

window.IGParser = (() => {
  'use strict';

  /* ── Username normalisation ───────────────────────── */

  function fromUrl(href) {
    if (!href || !href.includes('instagram.com')) return '';
    return href
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/[/?#].*$/, '')   // strip query strings / fragments
      .toLowerCase()
      .trim();
  }

  function fromValue(val) {
    if (!val) return '';
    // If it looks like a URL, extract the path segment
    if (val.startsWith('http')) return fromUrl(val);
    // Reject values that look like display names (contain spaces)
    if (val.includes(' ')) return '';
    return val.toLowerCase().trim();
  }

  /**
   * Resolves the best available username from one JSON item.
   * Returns '' if nothing reliable is found.
   */
  function resolveUsername(item, entry) {
    // 1. title on the parent item
    if (item.title && !item.title.includes(' ') && !item.title.startsWith('http')) {
      return item.title.toLowerCase().trim();
    }
    // 2. URL in the entry's href
    const fromHref = fromUrl(entry?.href || '');
    if (fromHref) return fromHref;
    // 3. value field
    const fromVal = fromValue(entry?.value || '');
    if (fromVal) return fromVal;
    return '';
  }

  /* ── Item extraction ──────────────────────────────── */

  function extractFromItem(item) {
    if (!item || typeof item !== 'object') return [];

    // Standard format: { title, string_list_data: [{ href, value, timestamp }] }
    if (Array.isArray(item.string_list_data) && item.string_list_data.length > 0) {
      return item.string_list_data.map(entry => {
        const username = resolveUsername(item, entry);
        return {
          username,
          href:      entry.href || '',
          timestamp: entry.timestamp || 0,
        };
      }).filter(u => u.username.length > 0);
    }

    // Legacy flat format: { href, value, timestamp } directly on the item
    if (item.href || item.value) {
      const username = resolveUsername({}, item);
      return username ? [{ username, href: item.href || '', timestamp: item.timestamp || 0 }] : [];
    }

    return [];
  }

  /* ── Core parser ──────────────────────────────────── */

  /**
   * Parses one Instagram JSON file into a flat array of
   * { username, href, timestamp } objects.
   */
  function parse(json, type) {
    // Unwrap named root keys
    const ROOT_KEYS = [
      'relationships_followers',
      'relationships_following',
      'relationships_follow_requests_sent',
    ];
    for (const key of ROOT_KEYS) {
      if (json?.[key]) { json = json[key]; break; }
    }

    let items = [];
    if (Array.isArray(json)) {
      items = json;
    } else if (json && typeof json === 'object') {
      const vals = Object.values(json);
      items = vals.length === 1 && Array.isArray(vals[0]) ? vals[0] : vals.flat();
    }

    const result = items.flatMap(extractFromItem);

    if (result.length === 0) {
      throw new Error(
        `No users found in your ${type} file. ` +
        'Confirm you selected a JSON file (not HTML) from your Instagram data export.'
      );
    }

    return result;
  }

  /**
   * Parses and merges multiple followers files.
   * Instagram paginates large follower lists into followers_1.json,
   * followers_2.json, etc. Passing only the first file causes false positives
   * because followers from later pages appear to be missing.
   *
   * @param {Array<{json: any, filename: string}>} files
   * @returns {Array<{username, href, timestamp}>}
   */
  function parseMultiple(files) {
    if (!files || files.length === 0) throw new Error('No follower files provided.');

    const merged = [];
    const seen   = new Set();

    for (const { json, filename } of files) {
      const parsed = parse(json, filename);
      for (const user of parsed) {
        if (!seen.has(user.username)) {
          seen.add(user.username);
          merged.push(user);
        }
      }
    }

    if (merged.length === 0) {
      throw new Error('No users found across your followers files.');
    }

    return merged;
  }

  /* ── Comparison engine ────────────────────────────── */

  /**
   * Cross-references followers vs following and returns all derived datasets.
   *
   * @param {Array} followersArr
   * @param {Array} followingArr
   * @returns {{
   *   notFollowingBack:  Array,   // you follow them; they don't follow you
   *   notFollowedBack:   Array,   // they follow you; you don't follow them
   *   mutual:            Array,   // both follow each other
   *   recentFollowers:   Array,   // your newest followers by timestamp
   *   totalFollowers:    number,
   *   totalFollowing:    number,
   *   followRatio:       number,  // followers / following (0 if no following)
   *   mutualPct:         number,  // % of following that follow back
   * }}
   */
  function compare(followersArr, followingArr) {
    const followerSet  = new Set(followersArr.map(u => u.username));
    const followingSet = new Set(followingArr.map(u => u.username));

    const notFollowingBack = followingArr.filter(u => !followerSet.has(u.username));
    const notFollowedBack  = followersArr.filter(u => !followingSet.has(u.username));
    const mutual           = followingArr.filter(u =>  followerSet.has(u.username));

    // Recent followers: sort by timestamp descending, take up to 50
    const recentFollowers = [...followersArr]
      .filter(u => u.timestamp > 0)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 50);

    const followRatio = followingArr.length > 0
      ? parseFloat((followersArr.length / followingArr.length).toFixed(2))
      : 0;

    const mutualPct = followingArr.length > 0
      ? Math.round((mutual.length / followingArr.length) * 100)
      : 0;

    return {
      notFollowingBack,
      notFollowedBack,
      mutual,
      recentFollowers,
      totalFollowers:  followersArr.length,
      totalFollowing:  followingArr.length,
      followRatio,
      mutualPct,
    };
  }

  return { parse, parseMultiple, compare };

})();
