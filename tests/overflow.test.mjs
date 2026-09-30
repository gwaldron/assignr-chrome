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

test("more expands the same day without navigation, cloned links, or additional reads", async t => {
  let calls = 0;
  const { w, document } = setup(t, {
    html: calendar(["101", "102", "103"]),
    fetchPage: async url => { calls++; return response(url, games()); },
  });
  const { day, events, more } = addMore(document);
  const originalMore = more.outerHTML;
  const links = [...events.querySelectorAll("a.calendar-game")];
  const rowStyles = [...events.querySelectorAll(".fc-daygrid-event-harness")].map(row => row.getAttribute("style"));
  let defaultMoreHandler = 0;
  more.addEventListener("click", () => { defaultMoreHandler++; });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(day.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  more.focus();
  assert.equal(more.dispatchEvent(new w.MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })), false);
  assert.equal(defaultMoreHandler, 0);
  assert.equal(day.classList.contains("ffx-day-expanded"), true);
  assert.equal(day.querySelector(".ffx-show-less").textContent, "Show less");
  assert.equal(day.querySelector(".ffx-show-less").getAttribute("aria-expanded"), "true");
  assert.equal(document.activeElement, links[1]);
  assert.deepEqual([...events.querySelectorAll("a.calendar-game")], links);
  assert.equal(events.querySelectorAll(".ffx-umpire-count").length, 3);
  await timer.tick(1000);
  assert.equal(calls, 1);
  assert.equal(day.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");

  let gameOpened = false;
  links[1].addEventListener("click", event => { gameOpened = true; event.preventDefault(); });
  links[1].click();
  assert.equal(gameOpened, true);
  day.querySelector(".ffx-show-less").click();
  assert.equal(day.classList.contains("ffx-day-expanded"), false);
  assert.equal(day.querySelector(".ffx-show-less"), null);
  assert.equal(more.outerHTML, originalMore);
  assert.equal(document.activeElement, more);
  assert.deepEqual([...events.querySelectorAll(".fc-daygrid-event-harness")].map(row => row.getAttribute("style")), rowStyles);
});

test("Enter and Space expand overflow with no double-toggle from key repeat", async t => {
  const { w, document } = setup(t);
  const { day, more } = addMore(document);
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  for (const key of ["Enter", " "]) {
    let siteKeyHandler = 0;
    more.addEventListener("keydown", () => { siteKeyHandler++; }, { once: true });
    const event = new w.KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
    more.dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    assert.equal(siteKeyHandler, 0);
    assert.equal(day.classList.contains("ffx-day-expanded"), true);
    day.querySelector(".ffx-show-less").click();
    more.dispatchEvent(new w.KeyboardEvent("keydown", { key, repeat: true, bubbles: true, cancelable: true }));
    assert.equal(day.classList.contains("ffx-day-expanded"), false);
  }
});

test("expanded state survives same-month rerenders and resets on month changes", async t => {
  const { w, document } = setup(t);
  let controls = addMore(document);
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  controls.more.click();
  controls.day.querySelector(".ffx-show-less").remove();
  await timer.tick(1000);
  assert.equal(controls.day.querySelectorAll(".ffx-show-less").length, 1);

  document.body.innerHTML = calendar();
  controls = addMore(document);
  await timer.tick(1000);
  assert.equal(controls.day.classList.contains("ffx-day-expanded"), true);
  assert.equal(controls.day.querySelectorAll(".ffx-show-less").length, 1);
  document.body.innerHTML = calendar(["101"], "2026-11-01");
  controls = addMore(document);
  await timer.tick(1000);
  assert.equal(controls.day.classList.contains("ffx-day-expanded"), false);
  assert.equal(document.querySelector(".ffx-show-less"), null);
});

test("days expand independently even when staffing reads fail", async t => {
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
  first.more.click();
  second.more.click();
  assert.equal(document.querySelectorAll(".ffx-day-expanded").length, 2);
  first.day.querySelector(".ffx-show-less").click();
  assert.equal(first.day.classList.contains("ffx-day-expanded"), false);
  assert.equal(second.day.classList.contains("ffx-day-expanded"), true);
  await timer.tick(1000);
  assert.equal(calls, 1);
});

test("other views, links, and modified clicks retain their normal behavior", async t => {
  const { w, document } = setup(t);
  const { day, more } = addMore(document);
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const modified = new w.MouseEvent("click", { ctrlKey: true, bubbles: true, cancelable: true });
  more.dispatchEvent(modified);
  assert.equal(modified.defaultPrevented, false);
  assert.equal(day.classList.contains("ffx-day-expanded"), false);
  const dateClick = new w.MouseEvent("click", { bubbles: true, cancelable: true });
  day.querySelector(".fc-daygrid-day-number").dispatchEvent(dateClick);
  assert.equal(dateClick.defaultPrevented, false);
  [...document.querySelectorAll(".fc-daygrid-day")].slice(7).forEach(cell => cell.remove());
  const weekClick = new w.MouseEvent("click", { bubbles: true, cancelable: true });
  more.dispatchEvent(weekClick);
  assert.equal(weekClick.defaultPrevented, false);
  assert.equal(day.classList.contains("ffx-day-expanded"), false);
});
