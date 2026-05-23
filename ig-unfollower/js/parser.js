/**
 * parser.js
 * Handles all known Instagram JSON export formats for followers and following.
 *
 * Instagram has changed their export format a few times. This parser supports:
 *   Format A (2023+): Array of objects with { title, string_list_data: [{ href, value, timestamp }] }
 *   Format B (older): Object with relationships_followers / relationships_following key containing Format A arrays
 *   Format C (legacy): Flat array of { href, value, timestamp } objects
 *   Format D (HTML-derived JSON): Objects with a "value" key directly on the root
 */

window.IGParser = (() => {

  /**
   * Normalises a raw href/value string into a clean lowercase username.
   * Handles full URLs like https://www.instagram.com/username/ and bare usernames.
   * @param {string} raw
   * @returns {string}
   */
  function toUsername(raw) {
    if (!raw) return '';
    return raw
      .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
      .replace(/\/$/, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Extracts an array of user entries from a single item in the JSON.
   * Each returned entry is { username, href, timestamp }.
   * @param {*} item
   * @returns {Array<{username: string, href: string, timestamp: number}>}
   */
  function extractFromItem(item) {
    if (!item || typeof item !== 'object') return [];

    // Format A / B — most common
    if (Array.isArray(item.string_list_data)) {
      return item.string_list_data.map(entry => ({
        username:  toUsername(entry.href || entry.value || ''),
        href:      entry.href || '',
        timestamp: entry.timestamp || 0,
      }));
    }

    // Format C — flat entry with href/value directly
    if (item.href || item.value) {
      return [{
        username:  toUsername(item.href || item.value || ''),
        href:      item.href || '',
        timestamp: item.timestamp || 0,
      }];
    }

    return [];
  }

  /**
   * Main parsing function.
   * Accepts any known Instagram JSON structure and returns a normalised
   * array of { username, href, timestamp } objects.
   *
   * @param {*} json — The parsed JSON object or array
   * @param {'followers'|'following'} type — For diagnostic messages only
   * @returns {Array<{username: string, href: string, timestamp: number}>}
   */
  function parse(json, type) {
    let items = [];

    // Unwrap known root-level keys
    const KEYS = [
      'relationships_followers',
      'relationships_following',
      'relationships_follow_requests_sent',
    ];

    for (const key of KEYS) {
      if (json && json[key]) {
        json = json[key];
        break;
      }
    }

    if (Array.isArray(json)) {
      items = json;
    } else if (json && typeof json === 'object') {
      // Some exports wrap everything in a single-key object
      const values = Object.values(json);
      if (values.length === 1 && Array.isArray(values[0])) {
        items = values[0];
      } else {
        items = values.flat();
      }
    }

    const result = items.flatMap(extractFromItem).filter(u => u.username.length > 0);

    if (result.length === 0) {
      throw new Error(
        `Could not find any users in your ${type} file. ` +
        'Make sure you selected the correct file and that it is from the JSON export (not HTML).'
      );
    }

    return result;
  }

  /**
   * Cross-references two parsed lists and returns accounts you follow
   * that do not follow you back.
   *
   * @param {Array} followersArr — result of parse(followersJSON, 'followers')
   * @param {Array} followingArr — result of parse(followingJSON, 'following')
   * @returns {{
   *   nonFollowers: Array<{username, href, timestamp}>,
   *   mutual: number,
   *   totalFollowers: number,
   *   totalFollowing: number,
   * }}
   */
  function compare(followersArr, followingArr) {
    const followerSet = new Set(followersArr.map(u => u.username));

    const nonFollowers = followingArr.filter(u => !followerSet.has(u.username));
    const mutual = followingArr.length - nonFollowers.length;

    return {
      nonFollowers,
      mutual,
      totalFollowers: followersArr.length,
      totalFollowing: followingArr.length,
    };
  }

  return { parse, compare, toUsername };

})();
