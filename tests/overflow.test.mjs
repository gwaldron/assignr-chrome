import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, setup, clock, response, contentSource, range } from "./helpers.mjs";

function addMore(document, dayIndex = 0) {
  const day = document.querySelectorAll(".fc-daygrid-day")[dayIndex];
  const events = day.querySelector(".fc-daygrid-day-events");
  for (const row of [...events.querySelectorAll(".fc-daygrid-event-harness")].slice(1)) {
    row.classList.add("fc-daygrid-event-harness-abs");
    row.setAttribute("style", "visibility: hidden; top: 0px; left: 0px; right: 0px;");
  }
  const footer = document.createElement("div");
  footer.className = "fc-daygrid-day-bottom";
  const more = document.createElement("a");
  more.className = "fc-daygrid-more-link fc-more-link";
  more.tabIndex = 0;
  more.title = "Show more games";
  more.setAttribute("aria-expanded", "false");
  more.textContent = "+ more";
  footer.append(more);
  events.append(footer);
  return { day, events, more };
}

function games() {
  return list(card() + card("102", "AA", [["P", "1"]]) + card("103", "Seniors", [["P", "3"]]));
}

test("all games expand automatically without clicks, cloned links, focus changes, or extra reads", async t => {
  let calls = 0;
  const { w, document } = setup(t, {
    html: calendar(["101", "102", "103"]),
    fetchPage: async url => { calls++; return response(url, games()); },
  });
  const { day, events, more } = addMore(document);
  const originalMore = more.outerHTML;
  const links = [...events.querySelectorAll("a.calendar-game")];
  const rowStyles = [...events.querySelectorAll(".fc-daygrid-event-harness")].map(row => row.getAttribute("style"));
  let moreClicks = 0;
  more.addEventListener("click", () => { moreClicks++; });
  const dateLink = day.querySelector(".fc-daygrid-day-number");
  dateLink.focus();
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(day.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  assert.equal(moreClicks, 0);
  assert.equal(day.classList.contains("ffx-day-expanded"), true);
  assert.equal(day.querySelector(".ffx-show-less"), null);
  assert.equal(document.activeElement, dateLink);
  assert.deepEqual([...events.querySelectorAll("a.calendar-game")], links);
  assert.equal(events.querySelectorAll(".ffx-umpire-count").length, 3);
  await timer.tick(1000);
  assert.equal(calls, 1);
  assert.equal(day.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");

  let gameOpened = false;
  links[1].addEventListener("click", event => { gameOpened = true; event.preventDefault(); });
  links[1].click();
  assert.equal(gameOpened, true);
  assert.equal(more.outerHTML, originalMore);
  assert.deepEqual([...events.querySelectorAll(".fc-daygrid-event-harness")].map(row => row.getAttribute("style")), rowStyles);
});

test("new hidden rows and replacement day cells expand without needing a more link", async t => {
  const { w, document } = setup(t, { fetchPage: async url => response(url, games()) });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  document.body.innerHTML = calendar([], range.start, 42, [["101", "102"], ["103"]]);
  const first = addMore(document);
  first.more.remove();
  await timer.tick(5000);
  const days = [...document.querySelectorAll(".ffx-day-expanded")];
  assert.equal(days.length, 2);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 3);
  first.day.classList.remove("ffx-day-expanded");
  await timer.tick(500);
  assert.ok(first.day.classList.contains("ffx-day-expanded"));
  assert.equal(document.querySelectorAll(".ffx-show-less").length, 0);
});

test("new months expand automatically and page lifecycle restores layout before reopening", async t => {
  const { w, document } = setup(t);
  let controls = addMore(document);
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const oldTable = controls.day.closest("table");
  document.body.innerHTML = calendar(["101"], "2026-11-01");
  controls = addMore(document);
  await timer.tick(1000);
  assert.equal(oldTable.classList.contains("ffx-expanded-weeks"), false);
  assert.equal(controls.day.classList.contains("ffx-day-expanded"), true);
  w.dispatchEvent(new w.Event("pagehide"));
  assert.equal(document.querySelector(".ffx-day-expanded, .ffx-week-sized, .ffx-expanded-weeks"), null);
  w.dispatchEvent(new w.Event("pageshow"));
  await timer.tick(5000);
  assert.equal(controls.day.classList.contains("ffx-day-expanded"), true);
  assert.equal(document.querySelector(".ffx-show-less"), null);
});

test("every day stays expanded even when staffing reads fail", async t => {
  let calls = 0;
  const { w, document } = setup(t, {
    html: calendar([], range.start, 42, [["101"], ["102"]]),
    fetchPage: async url => { calls++; return response(url, "Forbidden", 403); },
  });
  const first = addMore(document);
  const second = addMore(document, 1);
  w.console.warn = () => {};
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(document.querySelectorAll(".ffx-day-expanded").length, 2);
  assert.equal(first.day.classList.contains("ffx-day-expanded"), true);
  assert.equal(second.day.classList.contains("ffx-day-expanded"), true);
  await timer.tick(1000);
  assert.equal(calls, 1);
});

test("leaving month view restores site layout and preserves normal link behavior", async t => {
  const { w, document } = setup(t);
  const { day, more } = addMore(document);
  const row = day.closest("tr");
  row.style.setProperty("--ffx-week-height", "80px", "important");
  row.style.color = "blue";
  const originalStyle = row.getAttribute("style");
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const modified = new w.MouseEvent("click", { ctrlKey: true, bubbles: true, cancelable: true });
  more.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  assert.equal(day.classList.contains("ffx-day-expanded"), true);
  const dateClick = new w.MouseEvent("click", { bubbles: true, cancelable: true });
  day.querySelector(".fc-daygrid-day-number").dispatchEvent(dateClick);
  assert.equal(dateClick.defaultPrevented, false);
  [...document.querySelectorAll(".fc-daygrid-day")].slice(7).forEach(cell => cell.remove());
  await timer.tick(500);
  const weekClick = new w.MouseEvent("click", { bubbles: true, cancelable: true });
  more.dispatchEvent(weekClick);
  assert.equal(weekClick.defaultPrevented, false);
  assert.equal(day.classList.contains("ffx-day-expanded"), false);
  assert.equal(document.querySelector(".ffx-week-sized, .ffx-expanded-weeks"), null);
  assert.equal(row.getAttribute("style"), originalStyle);
});
