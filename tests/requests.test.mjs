import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, setup, clock, response, range, contentSource } from "./helpers.mjs";

// Synthetic version of the status icon observed on Assignr's game cards.
const requested = html => html.replace('class="fa-circle-question"',
  'data-controller="tooltip" class="fa-solid fa-fw fa-hand fa-color-success"');

test("request evidence comes from assignment status icons, independently of staffing", t => {
  const { api, document } = setup(t);
  const parse = html => api.parseList(document, list(html), range, 1).games.get("101");
  assert.equal(parse(card()).hasPendingRequests, false, "unconfirmed is not requested");
  for (const html of [requested(card()), requested(card("101", "AA", [["P", null]])), requested(card("101", "Unknown"))]) {
    assert.equal(parse(html).hasPendingRequests, true);
  }
  assert.equal(parse(requested(card())).staffed, true);
  assert.equal(parse(requested(card("101", "AA", [["P", null]]))).assignedCount, 0);
  assert.equal(parse(requested(card("101", "Unknown"))).assignedCount, null);
  const decoy = '<i class="fa-hand fa-color-success"></i>Pending requests';
  assert.equal(parse(card().replace("Example Home", decoy).replace("Example Official", decoy)).hasPendingRequests, false);
  assert.equal(parse(card().replaceAll("fa-circle-question", "fa-unknown")).hasPendingRequests, null);
  assert.equal(parse(card().replace('data-assign-target="assignments"', 'data-assign-target="other"')).hasPendingRequests, null);
  assert.equal(parse(requested(card()).replace('<strong>P:', '<i class="fa-check"></i><strong>P:')).hasPendingRequests, null);
  assert.equal(parse(requested(card()).replace("fa-circle-question", "fa-unknown")).hasPendingRequests, true);
});

test("R badges reuse the paginated staffing read and preserve counts, styling, and game links", async t => {
  const ids = ["101", "102", "103", "104", "105", "106"];
  let calls = 0;
  const { w, document, api } = setup(t, { html: calendar(ids), fetchPage: async url => {
    calls++;
    return response(url, calls === 1 ? list(
      requested(card()) + requested(card("102", "AA", [["P", "1"]])) +
      requested(card("103", "AA", [["P", null], ["F", null]])), api.listURL(range, 2).href) :
      list(card("104") + requested(card("105")) + requested(card("106", "Unknown"))));
  } });
  const timer = clock(w);
  const games = [...document.querySelectorAll("a.calendar-game")];
  games[4].classList.add("cancelled-game");
  const cancelled = games[4].outerHTML;
  const links = games.map(game => game.getAttribute("href"));
  w.eval(contentSource);
  await timer.tick(1000);
  assert.equal(calls, 2, "only the existing two game-list pages are fetched");
  assert.deepEqual(games.map(game => !!game.querySelector(".ffx-pending-request")), [true, true, true, false, false, true]);
  assert.deepEqual(games.map(game => game.classList.contains("ffx-staffed-game")), [true, false, false, true, false, false]);
  assert.equal(games[0].querySelector(".ffx-umpire-count").textContent, "2");
  assert.equal(games[1].querySelector(".ffx-umpire-count").textContent, "1");
  assert.equal(games[2].querySelector(".ffx-umpire-count"), null);
  assert.equal(games[4].outerHTML, cancelled);
  assert.deepEqual(games.map(game => game.getAttribute("href")), links);
  for (const badge of document.querySelectorAll(".ffx-pending-request")) {
    assert.equal(badge.textContent, "R");
    assert.equal(badge.title, "Pending umpire requests");
    assert.equal(badge.getAttribute("aria-label"), badge.title);
  }
  let followed = false;
  games[0].addEventListener("click", event => { event.preventDefault(); followed = true; });
  games[0].querySelector(".ffx-pending-request").click();
  assert.equal(followed, true);
  games[0].append(games[0].querySelector(".ffx-pending-request").cloneNode(true));
  games[0].querySelector(".ffx-umpire-count").remove();
  await timer.tick(1000);
  assert.equal(games[0].querySelectorAll(".ffx-pending-request").length, 1);
  assert.equal(games[0].lastElementChild.className, "ffx-pending-request");
  assert.equal(games[0].lastElementChild.previousElementSibling.className, "ffx-umpire-count");
  assert.equal(calls, 2);
});

test("R badges refresh, expire, and clear on failures, cancellation, and leaving the calendar", async t => {
  let hasRequest = true;
  let fail = false;
  let calls = 0;
  const { w, document } = setup(t, { fetchPage: async url => {
    calls++;
    return fail ? response(url, "denied", 403) : response(url, list(hasRequest ? requested(card()) : card()));
  } });
  w.console.warn = () => {};
  const timer = clock(w);
  const badge = () => document.querySelector(".ffx-pending-request");
  const refresh = async () => { document.querySelector(".ffx-staffing-refresh").click(); await timer.tick(5000); };
  w.eval(contentSource);
  await timer.tick(1000);
  assert.ok(badge());
  const game = document.querySelector("a.calendar-game");
  game.classList.add("cancelled-game");
  await timer.tick(300);
  assert.equal(badge(), null);
  game.classList.remove("cancelled-game");
  await timer.tick(300);
  assert.ok(badge());
  hasRequest = false;
  await refresh();
  assert.equal(badge(), null);
  hasRequest = true;
  await refresh();
  assert.ok(badge());
  const beforeExpiry = calls;
  await timer.tick(300000);
  assert.equal(badge(), null);
  assert.equal(calls, beforeExpiry, "no polling for requests");
  await refresh();
  assert.ok(badge());
  w.dispatchEvent(new w.Event("pagehide"));
  assert.equal(badge(), null);
  w.dispatchEvent(new w.Event("pageshow"));
  await timer.tick(5000);
  assert.ok(badge());
  const grid = document.querySelector(".fc-daygrid");
  grid.classList.remove("fc-daygrid");
  // The view is recognized by its contiguous month dates.
  const dates = [...grid.querySelectorAll("[data-date]")];
  dates[0].removeAttribute("data-date");
  await timer.tick(500);
  assert.equal(badge(), null);
  dates[0].setAttribute("data-date", range.start);
  grid.classList.add("fc-daygrid");
  await timer.tick(5000);
  assert.ok(badge());
  fail = true;
  await refresh();
  assert.equal(badge(), null);
  const beforeFailure = calls;
  await timer.tick(6000);
  assert.equal(calls, beforeFailure, "a failure does not create a retry loop");
});
