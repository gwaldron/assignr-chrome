import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, setup, clock, response, contentSource, range } from "./helpers.mjs";

test("daily counts include hidden games once, exclude cancelled games, and preserve date links", async t => {
  let requests = 0;
  const { w, document } = setup(t, {
    html: calendar([], range.start, 42, [["101", "102", "103", "104"], ["105"], ["106", "106"]]),
    fetchPage: async url => {
      requests++;
      return response(url, list(card() + card("102", "AA", [["P", "1"]]) +
        card("103", "Seniors", [["F", "2"]]) + card("104", "AA", [["P", null]]) +
        card("105", "Juniors", [["P", "3"]]) + card("106", "AAA", [["P", null], ["F", "4"]])));
    },
  });
  const timer = clock(w);
  const days = [...document.querySelectorAll(".fc-daygrid-day")];
  const dateLinks = days.map(day => day.querySelector(".fc-daygrid-day-number"));
  const originals = dateLinks.map(link => link.outerHTML);
  days[0].querySelector('[href="/games/104"]').classList.add("cancelled-game");
  days[0].querySelector('[href="/games/102"]').parentElement.style.visibility = "hidden";
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(days[0].querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 2");
  assert.equal(days[1].querySelector(".ffx-unstaffed-count"), null);
  assert.equal(days[2].querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  assert.equal(days[3].querySelector(".ffx-unstaffed-count"), null);
  assert.deepEqual(dateLinks.map(link => link.outerHTML), originals);
  assert.equal(days[0].querySelector(".fc-daygrid-day-top").firstElementChild.className, "ffx-unstaffed-count");
  let clicked = false;
  dateLinks[0].addEventListener("click", () => { clicked = true; });
  dateLinks[0].click();
  assert.equal(clicked, true);

  // A duplicate DOM occurrence outside the day cell must not inflate the total.
  const popover = document.createElement("div");
  popover.className = "fc-popover";
  popover.append(days[0].querySelector('[href="/games/102"]').cloneNode(true));
  document.querySelector(".fc").append(popover);
  await timer.tick(1000);
  assert.equal(days[0].querySelectorAll(".ffx-unstaffed-count").length, 1);
  assert.equal(days[0].querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 2");
  assert.equal(requests, 1);

  // Calendar rerenders may replace just the header; the count returns once.
  days[0].querySelector(".fc-daygrid-day-top").innerHTML = originals[0];
  await timer.tick(1000);
  assert.equal(days[0].querySelectorAll(".ffx-unstaffed-count").length, 1);
  assert.equal(requests, 1);
});

test("refresh clears the count while loading and removes it when every game qualifies", async t => {
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => response(url,
    ++calls === 1 ? list(card("101", "AA", [["P", "1"]])) : list()) });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(document.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  document.querySelector(".ffx-staffing-refresh").click();
  assert.equal(document.querySelector(".ffx-unstaffed-count"), null);
  await timer.tick(5000);
  assert.equal(document.querySelector(".ffx-unstaffed-count"), null);
  assert.equal(document.querySelector(".ffx-day-summary"), null);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 1);
});

test("incomplete or unreadable data never becomes a daily unstaffed count", async t => {
  for (const reply of [
    url => response(url, list(card("101", "Unknown") + card("102", "AA", [["P", "1"]]))),
    url => response(url, list(card("101", "AA", [["P", "1"], ["P", null], ["F", "2"]]) + card("102", "AA", [["P", "1"]]))),
    url => response(url, list(card("101", "AA", [["P", "1"]]))),
    url => response(url, "Sign in", 403),
  ]) {
    const { w, document } = setup(t, { html: calendar(["101", "102"]), fetchPage: async url => reply(url) });
    w.console.warn = () => {};
    const timer = clock(w);
    w.eval(contentSource);
    await timer.tick(1000);
    assert.equal(document.querySelector(".ffx-unstaffed-count"), null);
  }
});

test("daily counts expire without polling and clear when leaving the month view", async t => {
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => {
    calls++;
    return response(url, list(card("101", "AA", [["P", "1"]])));
  } });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(document.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  await timer.tick(300000);
  assert.equal(document.querySelector(".ffx-unstaffed-count"), null);
  assert.equal(calls, 1);
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(1000);
  assert.equal(document.querySelector(".ffx-unstaffed-count").textContent, "Unstaffed: 1");
  // Remove enough cells to become a week view while retaining the first header.
  [...document.querySelectorAll(".fc-daygrid-day")].slice(7).forEach(day => day.remove());
  await timer.tick(1000);
  assert.equal(document.querySelector(".ffx-unstaffed-count"), null);
  assert.equal(document.querySelector(".ffx-day-summary"), null);
});
