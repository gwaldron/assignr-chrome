(() => {
  "use strict";

  // Reveal FullCalendar's existing rows instead of copying links or game data.
  // editDOM is supplied by the main script so our updates cannot observe themselves.
  function createInlineOverflow(document, editDOM, getSnapshot = () =>
    globalThis.FairfaxStaffing.calendarSnapshot(document, document.location.pathname)) {
    const EXPANDED = "ffx-day-expanded";
    const COLLAPSE = "ffx-show-less";
    const expandedDates = new Set();
    const rowSizes = new Map();
    const sizedTables = new Set();
    let viewKey = null;

    function restoreRow(row, original) {
      if (original.value) row.style.setProperty("--ffx-week-height", original.value, original.priority);
      else row.style.removeProperty("--ffx-week-height");
      row.classList.remove("ffx-week-sized");
      if (!original.hadStyle && !row.style.length) row.removeAttribute("style");
      rowSizes.delete(row);
    }

    function sizeWeeks(snapshot) {
      const rows = new Set();
      const tables = new Set();
      if (snapshot && expandedDates.size) {
        for (const day of snapshot.root.querySelectorAll(".fc-daygrid-day[data-date]")) {
          const row = day.closest("tr");
          const table = row?.closest(".fc-scrollgrid-sync-table");
          if (table && snapshot.root.contains(table)) { rows.add(row); tables.add(table); }
        }
      }
      for (const [row, original] of rowSizes) {
        if (!rows.has(row)) restoreRow(row, original);
      }
      // Measure every collapsed week BEFORE changing any of their styles. An
      // expanded row then grows from content without shrinking neighboring rows.
      const measurements = [...rows].filter(row => !rowSizes.has(row))
        .map(row => [row, Math.ceil(row.getBoundingClientRect().height)]);
      for (const [row, height] of measurements) {
        rowSizes.set(row, {
          value: row.style.getPropertyValue("--ffx-week-height"),
          priority: row.style.getPropertyPriority("--ffx-week-height"),
          hadStyle: row.hasAttribute("style"),
        });
        if (height > 0) row.style.setProperty("--ffx-week-height", `${height}px`);
        row.classList.add("ffx-week-sized");
      }
      for (const table of sizedTables) {
        if (!tables.has(table)) { table.classList.remove("ffx-expanded-weeks"); sizedTables.delete(table); }
      }
      for (const table of tables) {
        table.classList.add("ffx-expanded-weeks");
        sizedTables.add(table);
      }
    }

    function render(snapshot) {
      const nextKey = snapshot ? `${snapshot.range.start}/${snapshot.range.end}` : null;
      if (nextKey !== viewKey) {
        expandedDates.clear();
        viewKey = nextKey;
      }
      sizeWeeks(snapshot);
      const openDays = new Set();
      for (const day of snapshot?.root.querySelectorAll(".fc-daygrid-day[data-date]") ?? []) {
        const events = day.querySelector(".fc-daygrid-day-events");
        const date = day.getAttribute("data-date");
        if (!events?.querySelector("a.calendar-game[href]")) expandedDates.delete(date);
        if (events && expandedDates.has(date)) {
          openDays.add(day);
          day.classList.add(EXPANDED);
          const buttons = [...events.querySelectorAll(`.${COLLAPSE}`)];
          buttons.slice(1).forEach(button => button.remove());
          if (!buttons.length) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = COLLAPSE;
            button.textContent = "Show less";
            button.title = "Collapse this day's games";
            button.setAttribute("aria-expanded", "true");
            events.append(button);
          }
        }
      }
      for (const day of document.querySelectorAll(`.${EXPANDED}`)) {
        if (!openDays.has(day)) day.classList.remove(EXPANDED);
      }
      for (const button of document.querySelectorAll(`.${COLLAPSE}`)) {
        if (!openDays.has(button.closest(".fc-daygrid-day[data-date]"))) button.remove();
      }
      if (!openDays.size) sizeWeeks(null);
    }

    function toggle(event) {
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.type === "click" && event.button !== 0) return;
      const target = event.target.nodeType === 1 ? event.target : event.target.parentElement;
      const control = target?.closest(`.fc-daygrid-more-link, .${COLLAPSE}`);
      if (!control) return;
      // Native buttons already generate an accessible click for Enter/Space.
      if (event.type === "keydown" && (control.tagName === "BUTTON" ||
          event.repeat || !["Enter", " "].includes(event.key))) return;
      const snapshot = getSnapshot();
      const day = control.closest(".fc-daygrid-day[data-date]");
      const events = day?.querySelector(".fc-daygrid-day-events");
      if (!snapshot || !day || !snapshot.root.contains(day) || !events?.contains(control) ||
          !events.querySelector(".fc-daygrid-event-harness a.calendar-game[href]")) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const collapse = control.classList.contains(COLLAPSE);
      const firstHiddenLink = [...events.querySelectorAll(".fc-daygrid-event-harness")]
        .find(row => row.style.visibility === "hidden")?.querySelector("a.calendar-game[href]");
      editDOM(() => {
        // Synchronize the range even if navigation occurred just before the click.
        render(snapshot);
        if (collapse) expandedDates.delete(day.getAttribute("data-date"));
        else expandedDates.add(day.getAttribute("data-date"));
        render(snapshot);
      });
      const focusTarget = collapse ?
        (day.querySelector(".fc-daygrid-more-link") ?? day.querySelector(".fc-daygrid-day-number")) :
        (firstHiddenLink ?? day.querySelector(`.${COLLAPSE}`));
      focusTarget?.focus({ preventScroll: true });
    }

    // Capture only overflow controls before FullCalendar's own click handler.
    document.addEventListener("click", toggle, true);
    document.addEventListener("keydown", toggle, true);
    return Object.freeze({ render });
  }

  globalThis.FairfaxInlineOverflow = Object.freeze({ createInlineOverflow });
})();
