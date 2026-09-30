import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, setup, clock, response, contentSource } from "./helpers.mjs";

test("positive counts show on staffed and unstaffed games; only staffed backgrounds change", async t => {
  let calls = 0;
  const { w, document } = setup(t, {
    html: calendar(["101", "102", "103", "104"]),
    fetchPage: async url => { calls++; return response(url, list(card() + card("102", "AA", [["P", "1"]]) + card("103", "Seniors", [["P", "3"]]) + card("104"))); },
  });
  const timer = clock(w);
  const links = [...document.querySelectorAll("a.calendar-game")];
  links[3].classList.add("cancelled-game");
  const hrefs = links.map(link => link.getAttribute("href"));
  const unstaffedClass = links[1].className;
  const untouched = [links[3].outerHTML, document.querySelector(".game-date").outerHTML];
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 3);
  assert.equal(document.querySelectorAll(".ffx-staffing-refresh").length, 1);
  assert.deepEqual(links.map(link => link.getAttribute("href")), hrefs);
  assert.deepEqual([links[3].outerHTML, document.querySelector(".game-date").outerHTML], untouched);
  assert.equal(links[1].className, unstaffedClass);
  assert.deepEqual(links.slice(0, 3).map(link => link.querySelector(".ffx-umpire-count").textContent), ["2", "1", "1"]);
  assert.equal(links[1].querySelector(".ffx-umpire-count").title, "1 umpire assigned");
  assert.equal(document.querySelectorAll(".ffx-staffed-game").length, 2);
  let clicked = false;
  links[0].addEventListener("click", event => { clicked = true; event.preventDefault(); });
  document.querySelector(".ffx-umpire-count").click();
  assert.equal(clicked, true);

  // Rerender and overflow occurrence of the same ID, with no second read.
  links[0].querySelector(".ffx-umpire-count").remove();
  const copy = links[0].cloneNode(true);
  document.querySelector(".fc-daygrid").append(copy);
  await timer.tick(1000);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 4);
  assert.equal(calls, 1);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(calls, 1);
  assert.equal(document.querySelectorAll(".ffx-staffing-refresh").length, 1);
});

test("refresh removes marks when staffing changes and respects the cooldown", async t => {
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => response(url, ++calls === 1 ? list() : list(card("101", "AA", [["P", "1"]]))) });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 1);
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(1000);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 0);
  assert.equal(calls, 1);
  await timer.tick(4000);
  assert.equal(calls, 2);
  assert.equal(document.querySelector(".ffx-umpire-count").textContent, "1");
  assert.equal(document.querySelector(".ffx-staffed-game"), null);
});

test("zero and unknown counts have no badge, and unstaffed badges clear outside the month grid", async t => {
  const { w, document } = setup(t, {
    html: calendar(["101", "102", "103"]),
    fetchPage: async url => response(url, list(
      card("101", "AA", [["P", null], ["F", null]]) +
      card("102", "Unknown", [["P", "1"]]) +
      card("103", "AA", [["P", null], ["F", "2"], ["F", "3"]]))),
  });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const links = [...document.querySelectorAll("a.calendar-game")];
  assert.equal(links[0].querySelector(".ffx-umpire-count"), null);
  assert.equal(links[1].querySelector(".ffx-umpire-count"), null);
  assert.equal(links[2].querySelector(".ffx-umpire-count").textContent, "2");
  assert.equal(document.querySelector(".ffx-staffed-game"), null);
  document.body.append(links[2]);
  await timer.tick(1000);
  assert.equal(links[2].querySelector(".ffx-umpire-count"), null);
});

test("refresh updates numeric counts, preserves unstaffed backgrounds, and removes zero counts", async t => {
  let slots = [["P", "1"], ["F", "2"], ["F", "3"], ["F", "4"]];
  const { w, document } = setup(t, { fetchPage: async url => response(url, list(card("101", "AA", slots))) });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  const game = document.querySelector("a.calendar-game");
  assert.equal(game.querySelector(".ffx-umpire-count").textContent, "4");
  slots = [["P", null], ["F", "2"], ["F", "2"]];
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(5000);
  assert.equal(game.querySelector(".ffx-umpire-count").textContent, "1");
  assert.equal(game.className, "calendar-game");
  slots = [["P", null], ["F", null]];
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(5000);
  assert.equal(game.querySelector(".ffx-umpire-count"), null);
});

test("month changes discard stale results and reread a replacement calendar", async t => {
  const calls = [];
  let finishOld;
  const { w, document } = setup(t, { fetchPage: (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) return new Promise(resolve => { finishOld = () => resolve(response(url)); });
    return Promise.resolve(response(url, list(card("102", "Juniors", [["P", "2"]]))));
  } });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(500);
  document.body.innerHTML = calendar(["102"], "2026-11-01");
  await timer.tick(500);
  assert.equal(calls[0].options.signal.aborted, true);
  finishOld();
  await timer.tick(5000);
  assert.equal(calls.length, 2);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 1);
  assert.equal(document.querySelector(".ffx-staffed-game").getAttribute("href"), "/games/102");
  assert.equal(document.querySelectorAll(".ffx-staffing-refresh").length, 1);
});

test("failure clears old green indicators, gives no false warnings on games, and does not retry", async t => {
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => ++calls === 1 ? response(url) : response(url, "Forbidden", 403) });
  const warnings = [];
  w.console.warn = message => warnings.push(message);
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  document.querySelector(".ffx-staffing-refresh").click();
  await timer.tick(5000);
  assert.equal(calls, 2);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 0);
  assert.equal(document.querySelector("a.calendar-game").className, "calendar-game");
  document.body.append(document.createElement("span"));
  w.dispatchEvent(new w.Event("focus"));
  await timer.tick(6000);
  assert.equal(calls, 2);
  assert.equal(document.querySelector(".ffx-staffing-refresh").disabled, true);
  assert.equal(warnings.length, 1);
});

test("indicators expire without polling and returning to the tab refreshes data", async t => {
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => { calls++; return response(url); } });
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(1000);
  await timer.tick(300000);
  assert.equal(calls, 1);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 0);
  w.dispatchEvent(new w.Event("focus"));
  await timer.tick(1000);
  assert.equal(calls, 2);
  assert.equal(document.querySelectorAll(".ffx-umpire-count").length, 1);
});

test("no calendar reads on login, game-detail pages, or a week view", async t => {
  for (const [path, html] of [["/accounts/sign_in", calendar()], ["/games/101", calendar()], ["/welcome", calendar(["101"], "2026-09-27", 7)]]) {
    let calls = 0;
    const { w, document } = setup(t, { path, html, fetchPage: async url => { calls++; return response(url); } });
    const timer = clock(w);
    w.eval(contentSource);
    await timer.tick(1000);
    assert.equal(calls, 0);
    assert.equal(document.querySelectorAll(".ffx-umpire-count, .ffx-staffing-refresh").length, 0);
  }
});

test("a hung lookup times out once and leaves the game unchanged", async t => {
  let calls = 0;
  let signal;
  const { w, document } = setup(t, { fetchPage: (_url, options) => {
    calls++;
    signal = options.signal;
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
  } });
  w.console.warn = () => {};
  const timer = clock(w);
  w.eval(contentSource);
  await timer.tick(21000);
  assert.equal(signal.aborted, true);
  assert.equal(calls, 1);
  assert.equal(document.querySelector("a.calendar-game").className, "calendar-game");
  assert.equal(document.querySelector(".ffx-staffing-refresh").disabled, true);
  await timer.tick(30000);
  assert.equal(calls, 1);
});
