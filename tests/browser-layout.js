(() => {
  const weeks = document.querySelector("#weeks");
  for (let week = 0; week < 5; week++) {
    const row = weeks.insertRow();
    for (let weekday = 0; weekday < 7; weekday++) {
      const offset = week * 7 + weekday;
      const date = new Date(Date.UTC(2026, 8, 27 + offset)).toISOString().slice(0, 10);
      const day = row.insertCell();
      day.className = "fc-daygrid-day";
      day.dataset.date = date;
      const frame = document.createElement("div");
      frame.className = "fc-daygrid-day-frame";
      const top = document.createElement("div");
      top.className = "fc-daygrid-day-top";
      const number = document.createElement("a");
      number.className = "fc-daygrid-day-number";
      number.textContent = String(Number(date.slice(-2)));
      top.append(number);
      const events = document.createElement("div");
      events.className = "fc-daygrid-day-events";
      // Busy days share a week. Ordinary weeks also have visible games whose
      // absolute container must not overlap when a neighboring week expands.
      const count = week === 1 && weekday === 1 ? 16 : week === 1 && weekday === 4 ? 9 : 2;
      for (let index = 0; index < count; index++) {
        const harness = document.createElement("div");
        harness.className = "fc-daygrid-event-harness";
        if (index >= 3) {
          harness.classList.add("fc-daygrid-event-harness-abs");
          harness.style.cssText = "visibility:hidden;top:0;left:0;right:0";
        }
        const game = document.createElement("a");
        game.className = "calendar-game";
        game.href = `/games/${1000 + offset * 20 + index}`;
        game.addEventListener("click", event => event.preventDefault());
        const title = document.createElement("span");
        title.className = "fc-event-title";
        title.textContent = `Example game ${index + 1}`;
        game.append(title);
        // Synthetic count badges exercise Saturday's right edge with a
        // fixed-width grid and a newly introduced vertical scrollbar.
        const badge = document.createElement("span");
        badge.className = "ffx-umpire-count";
        badge.textContent = index % 2 ? "1" : "2";
        if (index % 2 === 0) game.classList.add("ffx-staffed-game");
        game.append(badge);
        const request = document.createElement("span");
        request.className = "ffx-pending-request";
        request.textContent = "R";
        request.title = "Pending umpire requests";
        game.append(request);
        harness.append(game);
        events.append(harness);
      }
      if (count > 3) {
        const bottom = document.createElement("div");
        bottom.className = "fc-daygrid-day-bottom";
        const more = document.createElement("a");
        more.className = "fc-daygrid-more-link";
        more.tabIndex = 0;
        more.textContent = `+${count - 3} more`;
        bottom.append(more);
        events.append(bottom);
      }
      frame.append(top, events);
      day.append(frame);
    }
  }
  const snapshot = () => FairfaxStaffing.calendarSnapshot(document, "/welcome");
  const overflow = FairfaxInlineOverflow.createInlineOverflow(document);
  overflow.render(snapshot());
  const frame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  document.querySelector("#run-tests").addEventListener("click", async () => {
    const output = document.querySelector("#results");
    output.textContent = "Running…";
    overflow.render(null);
    await frame();
    const rows = [...weeks.rows];
    const first = rows[1].cells[1];
    const heights = rows.map(row => row.getBoundingClientRect().height);
    const relativeTop = row => row.getBoundingClientRect().top - weeks.getBoundingClientRect().top;
    const originalNextTop = relativeTop(rows[2]);
    const checks = [];
    const check = (label, value) => checks.push(`${value ? "PASS" : "FAIL"}: ${label}`);
    overflow.render(snapshot());
    await frame();
    check("busy week grows", rows[1].getBoundingClientRect().height > heights[1] + 100);
    check("following week moves down", relativeTop(rows[2]) > originalNextTop + 100);
    check("other weeks retain their height", rows.every((row, index) => index === 1 || row.getBoundingClientRect().height >= heights[index] - 1));
    check("all games fit inside their cells", [...weeks.querySelectorAll("a.calendar-game")].every(game =>
      game.getBoundingClientRect().bottom <= game.closest("td").getBoundingClientRect().bottom + 1));
    check("all cells in the week share the grown height", [...rows[1].cells].every(day => Math.abs(day.getBoundingClientRect().height - first.getBoundingClientRect().height) < 1));
    check("calendar scroll area includes expanded content", document.querySelector(".fc-scroller").scrollHeight > 570);
    const scroller = document.querySelector(".fc-scroller");
    const visibleRight = scroller.getBoundingClientRect().left + scroller.clientWidth;
    check("Saturday cell fits before the scrollbar", rows[1].cells[6].getBoundingClientRect().right <= visibleRight + 1);
    check("Saturday count and R badges fit before the scrollbar", [...rows[1].cells[6].querySelectorAll(".ffx-umpire-count, .ffx-pending-request")]
      .every(badge => badge.getBoundingClientRect().right <= visibleRight + 1));
    check("more links are hidden and there are no collapse controls", [...weeks.querySelectorAll(".fc-daygrid-more-link")]
      .every(link => getComputedStyle(link).display === "none") && !weeks.querySelector(".ffx-show-less"));
    check("all originally hidden games are visible without clicks", [...weeks.querySelectorAll(".fc-daygrid-event-harness-abs")]
      .every(harness => getComputedStyle(harness).visibility === "visible" && harness.getBoundingClientRect().height > 0));
    const expandedHeights = rows.map(row => row.getBoundingClientRect().height);
    overflow.render(snapshot());
    await frame();
    check("rerender preserves expanded week heights", rows.every((row, index) => Math.abs(row.getBoundingClientRect().height - expandedHeights[index]) < 1));
    overflow.render(null);
    await frame();
    check("leaving month view restores original week heights", rows.every((row, index) => Math.abs(row.getBoundingClientRect().height - heights[index]) < 1));
    check("leaving month view restores following week position", Math.abs(relativeTop(rows[2]) - originalNextTop) < 1);
    output.textContent = checks.join("\n");
    overflow.render(snapshot());
  });
})();
