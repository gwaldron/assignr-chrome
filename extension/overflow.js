(() => {
  "use strict";

  // Reveal FullCalendar's existing rows instead of copying links or game data.
  // The caller renders inside editDOM so these changes cannot observe themselves.
  function createInlineOverflow(document) {
    const EXPANDED = "ffx-day-expanded";
    const rowSizes = new Map();
    const sizedTables = new Set();

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
      if (snapshot) {
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
      const openDays = new Set();
      for (const day of snapshot?.root.querySelectorAll(".fc-daygrid-day[data-date]") ?? []) {
        const events = day.querySelector(".fc-daygrid-day-events");
        // Keep all game rows visible, even if FullCalendar adds or hides rows
        // before it updates the '+ more' control during a rerender.
        if (events?.querySelector(".fc-daygrid-event-harness a.calendar-game[href]")) openDays.add(day);
      }
      for (const day of document.querySelectorAll(`.${EXPANDED}`)) {
        if (!openDays.has(day)) day.classList.remove(EXPANDED);
      }
      // Capture the original week heights before opening any new day.
      sizeWeeks(openDays.size ? snapshot : null);
      for (const day of openDays) day.classList.add(EXPANDED);
    }

    return Object.freeze({ render });
  }

  globalThis.FairfaxInlineOverflow = Object.freeze({ createInlineOverflow });
})();
