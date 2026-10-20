(() => {
  "use strict";

  const ORIGIN = "https://fairfaxll.assignr.com";
  if (location.origin !== ORIGIN || globalThis.fairfaxGameDaysStarted) return;
  globalThis.fairfaxGameDaysStarted = true;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const loadedDates = new WeakMap();
  let navigation = null;
  let scheduled = false;

  function parseDate(text) {
    const iso = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const named = text.trim().match(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}),? (\d{4})$/i);
    if (!iso && !named) return null;
    const year = Number(iso ? iso[1] : named[3]);
    const month = iso ? Number(iso[2]) - 1 : MONTHS.findIndex(name => name.toLowerCase() === named[1].toLowerCase());
    const day = Number(iso ? iso[3] : named[2]);
    const date = new Date(Date.UTC(year, month, day));
    return year >= 1000 && date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day ? date : null;
  }

  function formatDate(date) {
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} ${date.getUTCFullYear()}`;
  }

  function context() {
    if (!["/games", "/games/"].includes(location.pathname)) return null;
    const forms = [...document.forms].filter(form =>
      form.action === `${ORIGIN}/games/session_filter` && form.method === "post");
    const games = document.querySelectorAll("#games");
    if (forms.length !== 1 || games.length !== 1) return null;
    const form = forms[0];
    const starts = form.querySelectorAll('input[name="session_search[start_date]"]');
    const ends = form.querySelectorAll('input[name="session_search[end_date]"]');
    const submitters = form.querySelectorAll('button[type="submit"][name="filter_action"][value="apply"]');
    if (starts.length !== 1 || ends.length !== 1 || submitters.length !== 1 ||
        starts[0].disabled || ends[0].disabled || submitters[0].disabled) return null;
    // The loaded form is authoritative for URL-based and session-based filters.
    // Keep the displayed day stable while the user edits the expanded form.
    if (!loadedDates.has(form)) {
      const start = parseDate(starts[0].value);
      const end = parseDate(ends[0].value);
      loadedDates.set(form, start && start.getTime() === end?.getTime() ? start : null);
    }
    const date = loadedDates.get(form);
    return date ? { form, start: starts[0], end: ends[0], submitter: submitters[0], games: games[0], date } : null;
  }

  function moveDay(offset) {
    const current = context();
    if (!current) return;
    const next = new Date(current.date.getTime() + offset * 86400000);
    if (next.getUTCFullYear() < 1000 || next.getUTCFullYear() > 9999) return;
    current.start.value = current.end.value = formatDate(next);
    // Use Assignr's existing Apply Filter flow, including its submitter value.
    // Do not copy hidden tokens, translate filter formats, or submit game forms.
    current.form.requestSubmit(current.submitter);
  }

  function render() {
    scheduled = false;
    observer.disconnect();
    try {
      const current = context();
      if (!current) { navigation?.remove(); navigation = null; return; }
      if (!navigation) {
        navigation = document.createElement("nav");
        navigation.className = "ffx-game-day-navigation";
        navigation.setAttribute("aria-label", "Browse games by day");
        for (const [offset, label] of [[-1, "<< Prev day"], [1, "Next day >>"]]) {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.dayOffset = String(offset);
          button.textContent = label;
          button.addEventListener("click", () => moveDay(offset));
          navigation.append(button);
        }
      }
      for (const button of navigation.children) {
        const next = new Date(current.date.getTime() + Number(button.dataset.dayOffset) * 86400000);
        button.disabled = next.getUTCFullYear() < 1000 || next.getUTCFullYear() > 9999;
        button.title = `Show games for ${formatDate(next)}`;
      }
      const summary = document.querySelector("#page_entries_info");
      const anchor = summary?.parentElement === current.games.parentElement ? summary : current.games;
      if (navigation.nextElementSibling !== anchor) anchor.before(navigation);
    } finally {
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  function schedule() {
    if (!scheduled) { scheduled = true; queueMicrotask(render); }
  }
  const observer = new MutationObserver(schedule);
  window.addEventListener("popstate", schedule);
  window.addEventListener("pageshow", schedule);
  document.addEventListener("turbo:load", schedule);
  render();
})();
