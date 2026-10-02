import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, dayCalendar, listCalendar, setup, clock, response, contentSource } from "./helpers.mjs";

const requested = html => html.replace('class="fa-circle-question"', 'class="fa-hand fa-color-success"');

test("Day and List use validated DOM dates and game links, never localized headings", t => {
  const { api, document } = setup(t);
  document.body.innerHTML = dayCalendar(["101", "101"], "2026-12-31");
  let snapshot = api.calendarSnapshot(document, "/welcome");
  assert.equal(snapshot.view, "day");
  assert.equal(snapshot.range.start, "2026-12-31");
  assert.equal(snapshot.range.end, "2026-12-31");
  assert.deepEqual(Array.from(snapshot.ids), ["101"]);
  document.body.innerHTML = listCalendar([["2026-12-31", ["101"]], ["2027-01-02", ["102"]]]);
  snapshot = api.calendarSnapshot(document, "/welcome");
  assert.equal(snapshot.view, "list");
  assert.equal(snapshot.range.start, "2026-12-31");
  assert.equal(snapshot.range.end, "2027-01-02");
  assert.equal(snapshot.entries.length, 2, "Assign Games and date links are excluded");
  assert.ok(snapshot.entries.every(({ element, link }) => element.tagName === "TR" && link.tagName === "A"));
  for (const html of [
    dayCalendar().replace("T18:00:00", "T25:00:00"),
    dayCalendar().replace("2026-10-06T18", "2026-10-07T18"),
    dayCalendar(["101"], "2026-02-30"),
    listCalendar([["2026-10-01", ["101"]], ["2026-10-08", ["102"]]]),
    listCalendar([["2026-02-30", ["101"]]]), listCalendar([]),
    dayCalendar().replace("fc-resourceTimelineDay-view", "fc-timeGridWeek-view"),
  ]) {
    document.body.innerHTML = html;
    assert.equal(api.calendarSnapshot(document, "/welcome"), null);
  }
});

for (const [name, fixture] of [["Day", ids => dayCalendar(ids)], ["List", ids => listCalendar([["2026-10-06", ids]])]]) {
  test(`${name} applies identical staffing/count/request rules and preserves native content and links`, async t => {
    const calls = [];
    const { w, document } = setup(t, { html: fixture(["101", "102", "103", "104", "105"]), fetchPage: async (url, options) => {
      calls.push({ url, options });
      return response(url, list(requested(card()) + requested(card("102", "AA", [["P", "1"]])) +
        requested(card("103", "AA", [["P", null]])) + requested(card("104")) + card("105", "Unknown")));
    } });
    const timer = clock(w);
    const entries = [...document.querySelectorAll(".calendar-game")];
    const links = entries.map(e => e.matches("a") ? e : e.querySelector("a"));
    entries[3].classList.add("cancelled-game");
    const cancelled = entries[3].outerHTML;
    const originals = links.map(link => link.getAttribute("href"));
    const native = [...document.querySelectorAll(".fc-event-main, .fc-list-event-time, .fc-list-day, .game-date")].map(e => e.outerHTML);
    links[0].focus();
    w.eval(contentSource);
    await timer.tick(1000);
    assert.deepEqual(entries.map(e => e.classList.contains("ffx-staffed-game")), [true, false, false, false, false]);
    assert.deepEqual(links.map(e => e.querySelector(".ffx-umpire-count")?.textContent), ["2", "1", undefined, undefined, undefined]);
    assert.deepEqual(links.map(e => e.querySelector(".ffx-pending-request")?.textContent), ["R", "R", "R", undefined, undefined]);
    assert.equal(entries[3].outerHTML, cancelled);
    assert.deepEqual(links.map(link => link.getAttribute("href")), originals);
    assert.deepEqual([...document.querySelectorAll(".fc-event-main, .fc-list-event-time, .fc-list-day, .game-date")].map(e => e.outerHTML), native);
    assert.equal(document.activeElement, links[0]);
    assert.equal(document.querySelector(".ffx-expanded-weeks, .ffx-day-expanded, .ffx-unstaffed-count"), null);
    assert.equal(calls.length, 1);
    const params = new URL(calls[0].url).searchParams;
    assert.equal(params.get("filter[start_date]"), "Oct 6 2026");
    assert.equal(params.get("filter[end_date]"), "Oct 6 2026");
    assert.equal(calls[0].options.method, "GET");
    let clicked = false;
    links[0].addEventListener("click", event => { clicked = true; event.preventDefault(); });
    links[0].querySelector(".ffx-pending-request").click();
    assert.ok(clicked);
    links[0].append(links[0].querySelector(".ffx-pending-request").cloneNode(true));
    links[0].querySelector(".ffx-umpire-count").remove();
    await timer.tick(1000);
    assert.equal(links[0].querySelectorAll(".ffx-pending-request").length, 1);
    assert.equal(links[0].lastElementChild.previousElementSibling.className, "ffx-umpire-count");
    assert.equal(calls.length, 1);
  });
}

test("switching Month, Day, and List cancels stale reads and clears month layout", async t => {
  const calls = [];
  let finishOld;
  const { w, document } = setup(t, { fetchPage: (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Promise(resolve => { finishOld = () => resolve(response(url)); });
    return Promise.resolve(response(url, list(requested(card("102")))));
  } });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(500);
  const oldTable = document.querySelector(".ffx-expanded-weeks");
  document.body.innerHTML = dayCalendar(["102"]);
  await timer.tick(500);
  assert.equal(calls[0].options.signal.aborted, true);
  assert.equal(oldTable.classList.contains("ffx-expanded-weeks"), false);
  finishOld();
  await timer.tick(5000);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 1);
  document.body.innerHTML = listCalendar([["2026-10-06", ["102"]]]);
  await timer.tick(5000);
  assert.ok(document.querySelector("tr.ffx-staffed-game"));
  assert.equal(document.querySelectorAll(".ffx-staffing-refresh").length, 1);
  document.body.innerHTML = calendar(["102"]);
  await timer.tick(5000);
  assert.ok(document.querySelector("a.ffx-staffed-game"));
  assert.ok(document.querySelector(".ffx-expanded-weeks"));
  assert.equal(calls.length, 4);
});

test("List indicators clear on cancellation, expiry, empty view, and failed refresh", async t => {
  let fail = false;
  let calls = 0;
  const { w, document } = setup(t, { html: listCalendar(), fetchPage: async url => {
    calls++;
    return fail ? response(url, "Forbidden", 403) : response(url, list(requested(card())));
  } });
  w.console.warn = () => {};
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const row = document.querySelector("tr.calendar-game");
  row.classList.add("cancelled-game");
  await timer.tick(500);
  assert.equal(document.querySelector(".ffx-staffed-game, .ffx-umpire-count, .ffx-pending-request"), null);
  row.classList.remove("cancelled-game");
  await timer.tick(500);
  assert.ok(document.querySelector(".ffx-pending-request"));
  await timer.tick(300000);
  assert.equal(document.querySelector(".ffx-staffed-game, .ffx-umpire-count, .ffx-pending-request"), null);
  assert.equal(calls, 1);
  document.body.innerHTML = listCalendar([]);
  await timer.tick(1000);
  assert.equal(document.querySelector(".ffx-staffing-refresh"), null);
  assert.equal(calls, 1);
  document.body.innerHTML = listCalendar();
  await timer.tick(5000);
  assert.ok(document.querySelector(".ffx-pending-request"));
  fail = true;
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(5000);
  assert.equal(document.querySelector(".ffx-staffed-game, .ffx-umpire-count, .ffx-pending-request"), null);
  assert.ok(document.querySelector(".ffx-staffing-refresh").disabled);
});
