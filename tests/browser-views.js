(() => {
  // Only this localhost fixture adapts the content-script origin/path gate.
  // Every fetch is mocked below; this fixture never contacts Assignr.
  const original = FairfaxStaffing;
  globalThis.FairfaxStaffing = Object.freeze({ ...original, ORIGIN: location.origin,
    calendarSnapshot: document => original.calendarSnapshot(document, "/welcome") });
  const slots = people => people.map((person, index) => `<div class="assignment">
    <div class="position"><i class="fa-hand fa-color-success"></i><strong>${index ? "F" : "P"}:</strong></div>
    <div class="assigned">${person ? `<a href="/users/${person}">Synthetic official</a>` : ""}</div></div>`).join("");
  const cards = [["101", ["1", "2"]], ["102", ["1"]], ["103", ["1", "2"]], ["104", [null]]]
    .map(([id, people]) => `<article data-controller="assign" data-game-id="${id}" data-assign-game-value="${id}">
      <h5>AA: <span>Synthetic game</span></h5><div data-assign-target="assignments">${slots(people)}</div></article>`).join("");
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, method: options.method });
    const result = new Response(`<!doctype html><html><body><div id="games">${cards}</div></body></html>`,
      { headers: { "Content-Type": "text/html" } });
    Object.defineProperty(result, "url", { value: url });
    return result;
  };
  const labels = ["Staffed AA / Baseball", "One umpire / Baseball", "Cancelled / Baseball", "Zero assigned / Baseball"];
  function show(view) {
    const entries = labels.map((label, index) => {
      const cls = `calendar-game${index === 2 ? " cancelled-game" : ""}`;
      const href = `/games/${101 + index}`;
      return view === "day" ? `<div class="fc-timeline-event-harness"><a class="${cls} fc-timeline-event" href="${href}"><div class="fc-event-main">${label}</div></a></div>` :
        `<tr class="${cls} fc-list-event"><td class="fc-list-event-time">6:00pm</td><td class="fc-list-event-graphic">●</td><td class="fc-list-event-title"><a href="${href}">${label}</a></td></tr>`;
    }).join("");
    document.querySelector("#fixture").innerHTML = `<main data-controller="calendar-main"><div class="fc" data-calendar-main-target="calendar">
      <div class="fc-header-toolbar"><strong>${view === "day" ? "Day timeline" : "Weekly list"}</strong></div>${view === "day" ?
        `<div class="fc-resourceTimelineDay-view fc-view"><table><tr><th class="fc-timeline-slot-label" data-date="2026-10-06T18:00:00">6pm</th></tr></table>${entries}</div>` :
        `<div class="fc-listWeek-view fc-view fc-list"><table class="fc-list-table"><tbody><tr class="fc-list-day" data-date="2026-10-06"><th colspan="3">Tuesday, October 6</th></tr>${entries}</tbody></table></div>`}</div></main>`;
    document.querySelectorAll("#fixture a").forEach(a => a.addEventListener("click", e => e.preventDefault()));
  }
  document.querySelector("#day").addEventListener("click", () => show("day"));
  document.querySelector("#list").addEventListener("click", () => show("list"));
  show("day");
  const frame = () => new Promise(resolve => requestAnimationFrame(resolve));
  document.querySelector("#run-tests").addEventListener("click", async () => {
    const output = document.querySelector("#results");
    output.textContent = "Running…";
    const checks = [];
    const check = (label, passed) => checks.push(`${passed ? "PASS" : "FAIL"}: ${label}`);
    for (const view of ["day", "list"]) {
      show(view);
      const deadline = Date.now() + 8000;
      while (!document.querySelector(".ffx-pending-request") && Date.now() < deadline) await frame();
      const games = [...document.querySelectorAll(".calendar-game")];
      check(`${view}: counts and requests render`, document.querySelectorAll(".ffx-umpire-count").length === 2 && document.querySelectorAll(".ffx-pending-request").length === 3);
      const painted = view === "list" ? [...games[0].querySelectorAll("td")] : [games[0]];
      check(`${view}: staffed game is dark green`, painted.every(e => getComputedStyle(e).backgroundColor === "rgb(23, 100, 56)"));
      const title = games[0].querySelector(view === "list" ? ".fc-list-event-title > a" : ".fc-event-main");
      check(`${view}: staffed text is white`, getComputedStyle(title).color === "rgb(255, 255, 255)");
      check(`${view}: unstaffed and cancelled colors stay default`, games.slice(1).every(e => getComputedStyle(view === "list" ? e.querySelector("td") : e).backgroundColor !== "rgb(23, 100, 56)"));
      check(`${view}: badges fit inside games`, games.every(game => [...game.querySelectorAll(".ffx-umpire-count, .ffx-pending-request")].every(badge => {
        const box = badge.getBoundingClientRect(); const parent = game.getBoundingClientRect();
        return box.width > 0 && box.right <= parent.right && box.bottom <= parent.bottom;
      })));
      const badge = games[0].querySelector(".ffx-pending-request");
      check(`${view}: R remains amber with dark text`, badge && getComputedStyle(badge).backgroundColor === "rgb(249, 204, 101)" && getComputedStyle(badge).color === "rgb(89, 60, 0)");
    }
    check("only same-origin game-list GETs were requested", calls.every(call => new URL(call.url).origin === original.ORIGIN && new URL(call.url).pathname === "/games" && call.method === "GET"));
    output.textContent = checks.join("\n");
  });
})();
