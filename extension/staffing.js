(() => {
  "use strict";

  const ORIGIN = "https://fairfaxll.assignr.com";
  const CARD = '[data-controller~="assign"][data-game-id]';
  const TWO_UMPIRES = new Set(["aa", "aaa", "majors"]);
  const AGE_GROUPS = new Set([...TWO_UMPIRES, "juniors", "seniors"]);
  const MAX_PAGES = 8;
  const MAX_PAGE_BYTES = 2 * 1024 * 1024;
  const MAX_RANGE_BYTES = 8 * 1024 * 1024;
  const DAY = 86400000;
  const UNKNOWN = Object.freeze({ staffed: null, assignedCount: null });

  function idFromLink(href, kind) {
    try {
      const url = new URL(href, ORIGIN);
      if (url.origin !== ORIGIN || url.username || url.password || url.search || url.hash) return null;
      return url.pathname.match(new RegExp(`^/${kind}/([1-9]\\d*)$`))?.[1] ?? null;
    } catch {
      return null;
    }
  }

  function dateValue(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? "")) return null;
    const time = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value ? time : null;
  }

  function calendarSnapshot(document, pathname) {
    if (!["/", "/welcome", "/welcome/"].includes(pathname)) return null;
    const roots = document.querySelectorAll('[data-controller~="calendar-main"] [data-calendar-main-target~="calendar"].fc');
    if (roots.length !== 1) return null;
    const root = roots[0];
    // A contiguous grid of 28–42 dates distinguishes the inspected month view.
    const dates = [...new Set([...root.querySelectorAll("[data-date]")]
      .map(node => node.getAttribute("data-date")).filter(date => dateValue(date) !== null))].sort();
    if (dates.length < 28 || dates.length > 42 || dates.length % 7 !== 0) return null;
    if (dateValue(dates.at(-1)) - dateValue(dates[0]) !== (dates.length - 1) * DAY) return null;
    const ids = [...new Set([...root.querySelectorAll("a.calendar-game[href]")]
      .map(link => idFromLink(link.getAttribute("href"), "games")).filter(Boolean))].sort();
    const range = { start: dates[0], end: dates.at(-1) };
    return { root, range, ids, key: `${range.start}/${range.end}/${ids.join(",")}` };
  }

  // staffed: true = qualifies, false = does not, null = unreadable/unsupported.
  // assignedCount counts distinct officials; null means it is unavailable.
  function staffingStatus(card) {
    const headings = card.querySelectorAll("h5");
    if (headings.length !== 1) return UNKNOWN;
    // Read the division prefix only, never team or venue text.
    const ageText = [...headings[0].childNodes].filter(node => node.nodeType === 3)
      .map(node => node.textContent).join("").trim();
    if (!ageText.endsWith(":")) return UNKNOWN;
    const ageGroup = ageText.slice(0, -1).trim().toLowerCase();
    if (!AGE_GROUPS.has(ageGroup)) return UNKNOWN;
    const containers = card.querySelectorAll('[data-assign-target~="assignments"]');
    if (containers.length !== 1) return UNKNOWN;
    const slots = [...containers[0].querySelectorAll(".assignment")];
    if (!slots.length || slots.length > 20) return UNKNOWN;
    const officials = new Set();
    let plateSlots = 0;
    let assignedPlates = 0;
    for (const slot of slots) {
      const positions = slot.querySelectorAll(".position strong");
      const assigned = slot.querySelectorAll(".assigned");
      if (positions.length !== 1 || assigned.length !== 1) return UNKNOWN;
      const role = positions[0].textContent.trim().toUpperCase();
      if (role !== "P:" && role !== "F:") return UNKNOWN;
      const links = [...assigned[0].querySelectorAll("a[href]")];
      if (links.length > 1) return UNKNOWN;
      const officialId = links.length ? idFromLink(links[0].getAttribute("href"), "users") : null;
      if (links.length && !officialId) return UNKNOWN;
      if (officialId) officials.add(officialId);
      if (role === "P:") {
        plateSlots += 1;
        if (officialId) assignedPlates += 1;
      }
    }
    // Blank slots may be hidden by policy. With multiple Plate slots, exact
    // occupancy cannot be proved from this markup; leave the game unchanged.
    if (plateSlots > 1 && assignedPlates < 2) return UNKNOWN;
    const staffed = plateSlots === 1 && assignedPlates === 1 &&
      (!TWO_UMPIRES.has(ageGroup) || officials.size >= 2);
    return { staffed, assignedCount: officials.size };
  }

  function filterDate(isoDate) {
    if (dateValue(isoDate) === null) throw new Error("Invalid calendar date");
    const [year, month, day] = isoDate.split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[month - 1]} ${day} ${year}`;
  }

  function listURL(range, page = 1) {
    const url = new URL("/games", ORIGIN);
    url.searchParams.set("filter[end_date]", filterDate(range.end));
    url.searchParams.set("filter[start_date]", filterDate(range.start));
    if (page > 1) url.searchParams.set("page", String(page));
    return url;
  }

  function parseList(document, html, range, page) {
    // A truncated document can otherwise be repaired by the HTML parser into
    // an apparently valid card with some of its assignment rows missing.
    if (!/<\/body>\s*<\/html>\s*$/i.test(html)) throw new Error("Incomplete game-list document");
    // Template contents are inert, including images/iframes/custom elements.
    // Never attach, clone, or adopt this response fragment into the live page.
    const template = document.createElement("template");
    template.innerHTML = html;
    const fragment = template.content;
    const containers = fragment.querySelectorAll("#games");
    if (containers.length !== 1) throw new Error("Game list unavailable");
    const cards = [...containers[0].querySelectorAll(CARD)];
    if (cards.length > 100) throw new Error("Unexpected page size");
    const games = new Map();
    for (const card of cards) {
      const id = card.getAttribute("data-game-id");
      if (!/^[1-9]\d*$/.test(id ?? "") || id !== card.getAttribute("data-assign-game-value") || games.has(id)) {
        throw new Error("Ambiguous game identity");
      }
      games.set(id, staffingStatus(card));
    }
    let nextPage = null;
    for (const link of fragment.querySelectorAll("a[href]")) {
      let url;
      try { url = new URL(link.getAttribute("href"), ORIGIN); } catch { continue; }
      if (url.origin !== ORIGIN || url.pathname !== "/games" || url.username || url.password || url.hash) continue;
      const params = url.searchParams;
      if (params.get("filter[start_date]") !== filterDate(range.start) ||
          params.get("filter[end_date]") !== filterDate(range.end)) continue;
      if ([...params.keys()].some(key => !["page", "filter[start_date]", "filter[end_date]"].includes(key))) continue;
      if ([...params.keys()].some(key => params.getAll(key).length !== 1)) continue;
      if (!/^[1-9]\d*$/.test(params.get("page") ?? "")) continue;
      if (Number(params.get("page")) === page + 1) nextPage = page + 1;
    }
    // Construct our own URL later; never fetch a URL supplied in page content.
    return { games, nextPage };
  }

  async function readLimited(response) {
    if (Number(response.headers.get("content-length")) > MAX_PAGE_BYTES || !response.body) {
      throw new Error("Response size unavailable or too large");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_PAGE_BYTES) throw new Error("Response too large");
        html += decoder.decode(value, { stream: true });
      }
      html += decoder.decode();
      return { html, bytes };
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  function createReader(document, fetchPage) {
    let requests = 0;
    let stopped = false;
    return async (range, expectedIds, signal) => {
      if (stopped) throw new Error("Reads paused; reload the calendar to retry");
      const games = new Map();
      let bytes = 0;
      let page = 1;
      try {
        while (page !== null) {
          if (signal.aborted) throw new Error("Calendar navigation cancelled the read");
          if (page > MAX_PAGES || ++requests > 60) throw new Error("Request limit reached");
          const url = listURL(range, page);
          const response = await fetchPage(url.href, {
            method: "GET", credentials: "same-origin", mode: "same-origin",
            redirect: "error", cache: "no-store", headers: { Accept: "text/html" }, signal,
          });
          if (!response.ok || response.redirected || response.url !== url.href ||
              !/^text\/html\b/i.test(response.headers.get("content-type") ?? "")) {
            throw new Error("Game list response unavailable");
          }
          const body = await readLimited(response);
          if (signal.aborted) throw new Error("Calendar navigation cancelled the read");
          bytes += body.bytes;
          if (bytes > MAX_RANGE_BYTES) throw new Error("Range response too large");
          const parsed = parseList(document, body.html, range, page);
          for (const [id, details] of parsed.games) {
            if (games.has(id)) throw new Error("Duplicate game across pages");
            games.set(id, details);
          }
          page = parsed.nextPage;
        }
        if (expectedIds.some(id => !games.has(id))) throw new Error("Incomplete calendar coverage");
        return games;
      } catch (error) {
        // A navigation cancellation is safe to retry for the next range. Any
        // other failure stops requests until reload (including 401/403/429).
        if (!signal.aborted) stopped = true;
        throw error;
      }
    };
  }

  globalThis.FairfaxStaffing = Object.freeze({ ORIGIN, idFromLink, calendarSnapshot, staffingStatus, listURL, parseList, createReader });
})();
