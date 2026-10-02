(() => {
  "use strict";

  const staffing = globalThis.FairfaxStaffing;
  if (!staffing || location.origin !== staffing.ORIGIN || globalThis.fairfaxStaffingStarted) return;
  globalThis.fairfaxStaffingStarted = true;

  const BADGE = "ffx-umpire-count";
  const REQUEST_BADGE = "ffx-pending-request";
  const MARK = "ffx-staffed-game";
  const DAY_COUNT = "ffx-unstaffed-count";
  const DAY_HEADER = "ffx-day-summary";
  const formattedLabels = new Map();
  const FRESH_MS = 5 * 60 * 1000;
  const COOLDOWN_MS = 5000;
  const readRange = staffing.createReader(document, fetch.bind(globalThis));
  const overflow = globalThis.FairfaxInlineOverflow.createInlineOverflow(document);
  let current = null;
  let attemptedKey = null;
  let results = null;
  let fetchedAt = 0;
  let lastAttempt = 0;
  let job = null;
  let scheduled = null;
  let expiry = null;
  let refreshButton = null;
  let failed = false;

  function schedule(delay = 200) {
    if (scheduled === null) scheduled = setTimeout(() => { scheduled = null; reconcile(); }, delay);
  }

  // Disconnect only for our synchronous DOM edits to avoid observing ourselves.
  function editDOM(action) {
    observer.disconnect();
    try { action(); } finally { observe(); }
  }

  function observe() {
    observer.observe(document.documentElement, {
      childList: true, subtree: true, attributes: true, characterData: true,
      attributeFilter: ["data-date", "href", "class"],
    });
  }

  function clearIndicators() {
    for (const badge of document.querySelectorAll(`.${BADGE}, .${REQUEST_BADGE}`)) badge.remove();
    for (const link of document.querySelectorAll(`.${MARK}`)) link.classList.remove(MARK);
    clearDayCounts();
  }

  function clearDayCounts() {
    for (const count of document.querySelectorAll(`.${DAY_COUNT}`)) count.remove();
    for (const header of document.querySelectorAll(`.${DAY_HEADER}`)) header.classList.remove(DAY_HEADER);
  }

  function formatGameTitle(original) {
    // Only spaced slashes separate fields. Slashes in AA/AAA and similar
    // field names belong to their text. Time has its own formatter below.
    const parts = original.split(/\s+\/\s+/).map(part => part.trim());
    const prefix = parts[0] === "* CANCELLED *" ? [parts.shift()] : [];
    if (![3, 4].includes(parts.length) || parts.some(part => !part) ||
        !/^(AA|AAA|Majors|Juniors|Seniors)$/i.test(parts.at(-2))) return null;
    const finalField = parts.pop();
    const age = parts.pop();
    return [...prefix, age, ...parts, finalField].join(" / ");
  }

  function formatGameTime(original) {
    // Keep minutes (including :00), using a/p for recognizable 12-hour times.
    // Accept either suffix from FullCalendar; leave other labels alone.
    const match = original.trim().match(/^(0?[1-9]|1[0-2])(?::([0-5]\d))?\s*([ap])m?$/i);
    return match ? `${Number(match[1])}:${match[2] ?? "00"}${match[3].toLowerCase()}` : null;
  }

  function renderGameLabels(activeLinks) {
    const labels = new Map();
    for (const link of activeLinks) {
      if (!staffing.idFromLink(link.getAttribute("href"), "games")) continue;
      for (const [selector, format] of [[".fc-event-title", formatGameTitle], [".fc-event-time", formatGameTime]]) {
        const matches = link.querySelectorAll(selector);
        if (matches.length === 1 && !matches[0].children.length) labels.set(matches[0], format);
      }
    }
    for (const [label, previous] of formattedLabels) {
      if (labels.has(label)) continue;
      // Restore only text that is still ours; never overwrite a site update.
      if (!label.children.length && label.textContent === previous.formatted) label.textContent = previous.original;
      formattedLabels.delete(label);
    }
    for (const [label, format] of labels) {
      const original = label.textContent;
      if (formattedLabels.get(label)?.formatted === original) continue;
      formattedLabels.delete(label);
      const formatted = format(original);
      if (formatted === null || formatted === original) continue;
      formattedLabels.set(label, { original, formatted });
      // Site-provided labels remain plain text, never interpreted as HTML.
      label.textContent = formatted;
    }
  }

  function renderDayCounts(snapshot) {
    const counts = new Map();
    if (snapshot?.view === "month" && results) {
      for (const day of snapshot.root.querySelectorAll(".fc-daygrid-day[data-date]")) {
        const header = day.querySelector(".fc-daygrid-day-top");
        if (!header) continue;
        const ids = new Set();
        let complete = true;
        // Includes hidden event harnesses behind '+ more', but not popovers.
        for (const link of day.querySelectorAll("a.calendar-game[href]:not(.cancelled-game)")) {
          const id = staffing.idFromLink(link.getAttribute("href"), "games");
          if (!id || typeof results.get(id)?.staffed !== "boolean") { complete = false; break; }
          ids.add(id);
        }
        if (!complete) continue;
        const count = [...ids].filter(id => results.get(id).staffed === false).length;
        if (count > 0) counts.set(header, count);
      }
    }
    for (const label of document.querySelectorAll(`.${DAY_COUNT}`)) {
      if (!counts.has(label.parentElement)) label.remove();
    }
    for (const header of document.querySelectorAll(`.${DAY_HEADER}`)) {
      if (!counts.has(header)) header.classList.remove(DAY_HEADER);
    }
    for (const [header, count] of counts) {
      const labels = [...header.querySelectorAll(`.${DAY_COUNT}`)];
      labels.slice(1).forEach(label => label.remove());
      const label = labels[0] ?? document.createElement("span");
      label.className = DAY_COUNT;
      const text = `Unstaffed: ${count}`;
      if (label.textContent !== text) label.textContent = text;
      label.title = "Games not meeting the staffing criteria; cancelled games excluded";
      if (!labels.length) header.prepend(label);
      header.classList.add(DAY_HEADER);
    }
  }

  function render(snapshot) {
    editDOM(() => {
      const entries = snapshot?.entries ?? [];
      const activeLinks = new Set(entries.map(entry => entry.link));
      const activeElements = new Set(entries.map(entry => entry.element));
      renderGameLabels(activeLinks);
      for (const element of document.querySelectorAll(`.${MARK}`)) {
        if (!activeElements.has(element)) element.classList.remove(MARK);
      }
      for (const badge of document.querySelectorAll(`.${BADGE}, .${REQUEST_BADGE}`)) {
        if (!activeLinks.has(badge.closest("a"))) badge.remove();
      }
      for (const { element, link } of entries) {
        const id = staffing.idFromLink(link.getAttribute("href"), "games");
        const details = results?.get(id);
        const cancelled = element.classList.contains("cancelled-game");
        const staffed = !cancelled && details?.staffed === true;
        const showCount = !cancelled && Number.isInteger(details?.assignedCount) && details.assignedCount > 0;
        element.classList.toggle(MARK, staffed);
        const badges = [...link.querySelectorAll(`.${BADGE}`)];
        if (!showCount) badges.forEach(badge => badge.remove());
        else {
          badges.slice(1).forEach(badge => badge.remove());
          const badge = badges[0] ?? document.createElement("span");
          badge.className = BADGE;
          const count = String(details.assignedCount);
          if (badge.textContent !== count) badge.textContent = count;
          badge.title = `${count} umpire${details.assignedCount === 1 ? "" : "s"} assigned` +
            (staffed ? "; meets staffing criteria" : "");
          if (!badges.length) link.append(badge);
        }
        const requests = [...link.querySelectorAll(`.${REQUEST_BADGE}`)];
        if (cancelled || details?.hasPendingRequests !== true) requests.forEach(badge => badge.remove());
        else {
          requests.slice(1).forEach(badge => badge.remove());
          const badge = requests[0] ?? document.createElement("span");
          badge.className = REQUEST_BADGE;
          if (badge.textContent !== "R") badge.textContent = "R";
          badge.title = "Pending umpire requests";
          badge.setAttribute("aria-label", "Pending umpire requests");
          // Keep R after the count, including when a count is added later.
          if (link.lastChild !== badge) link.append(badge);
        }
      }
      renderDayCounts(snapshot);
      overflow.render(snapshot?.view === "month" ? snapshot : null);
      if (!snapshot) {
        refreshButton?.remove();
        refreshButton = null;
        return;
      }
      const toolbar = snapshot.root.querySelector(".fc-header-toolbar");
      if (toolbar && !toolbar.contains(refreshButton)) {
        refreshButton?.remove();
        refreshButton = document.createElement("button");
        refreshButton.type = "button";
        refreshButton.className = "ffx-staffing-refresh";
        refreshButton.addEventListener("click", refresh);
        toolbar.append(refreshButton);
      }
      if (refreshButton) {
        refreshButton.disabled = Boolean(job) || failed;
        refreshButton.textContent = job ? "Checking staffing…" : "Refresh staffing";
        refreshButton.title = failed ? "Staffing data unavailable. Reload the calendar to retry." :
          "Read current umpire assignments. Indicators expire after five minutes.";
      }
    });
  }

  function cancel() {
    job?.abort();
    job = null;
    clearTimeout(expiry);
    expiry = null;
  }

  function refresh() {
    if (failed || job) return;
    results = null;
    attemptedKey = null;
    clearTimeout(expiry);
    editDOM(clearIndicators);
    schedule();
  }

  async function reconcile() {
    const snapshot = staffing.calendarSnapshot(document, location.pathname);
    if (snapshot?.key !== current?.key || snapshot?.root !== current?.root) {
      cancel();
      results = null;
      attemptedKey = null;
      current = snapshot;
    }
    if (!snapshot) { render(null); return; }
    if (results && Date.now() - fetchedAt >= FRESH_MS) results = null;
    render(snapshot);
    if (!snapshot.ids.length || attemptedKey === snapshot.key || job || failed || document.hidden) return;
    const cooldown = COOLDOWN_MS - (Date.now() - lastAttempt);
    if (cooldown > 0) { schedule(cooldown); return; }

    attemptedKey = snapshot.key;
    lastAttempt = Date.now();
    const controller = new AbortController();
    job = controller;
    render(snapshot);
    // Covers the entire paginated lookup, including streaming response reads.
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const data = await readRange(snapshot.range, snapshot.ids, controller.signal);
      if (controller.signal.aborted || job !== controller) return;
      const latest = staffing.calendarSnapshot(document, location.pathname);
      if (latest?.key !== snapshot.key || latest?.root !== snapshot.root) { schedule(); return; }
      results = data;
      fetchedAt = Date.now();
      expiry = setTimeout(() => {
        results = null;
        // No polling: refresh explicitly, navigate, or return to the tab.
        render(staffing.calendarSnapshot(document, location.pathname));
      }, FRESH_MS);
    } catch {
      if (job === controller) {
        results = null;
        failed = true;
        console.warn("Fairfax staffing: data unavailable; indicators cleared. Reload the calendar to retry.");
      }
    } finally {
      clearTimeout(timeout);
      if (job === controller) {
        job = null;
        render(staffing.calendarSnapshot(document, location.pathname));
      }
    }
  }

  const observer = new MutationObserver(() => schedule());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - fetchedAt >= 30000) refresh();
  });
  window.addEventListener("focus", () => {
    if (Date.now() - fetchedAt >= 30000) refresh();
  });
  window.addEventListener("pagehide", () => {
    cancel();
    results = null;
    attemptedKey = null;
    editDOM(() => { clearIndicators(); renderGameLabels(new Set()); overflow.render(null); });
  });
  window.addEventListener("pageshow", () => schedule());
  observe();
  schedule(0);
})();
