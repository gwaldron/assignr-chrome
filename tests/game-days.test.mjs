import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { setup } from "./helpers.mjs";

const source = await readFile(new URL("../extension/game-days.js", import.meta.url), "utf8");
const fixture = (start = "Oct 20 2026", end = start) => `<main>
  <form action="/games/session_filter" method="post">
    <input name="authenticity_token" type="hidden" value="synthetic-secret">
    <input name="return_to" type="hidden" value="/games">
    <input name="session_search[start_date]" value="${start}">
    <input name="session_search[end_date]" value="${end}">
    <select name="session_search[venue_id][]" multiple>
      <option value="10" selected>Example field</option><option value="11" selected>Other field</option>
    </select>
    <select name="session_search[published]"><option value="yes" selected>Published</option></select>
    <button type="submit" name="filter_action" value="apply">Apply Filter</button>
    <button type="submit" name="filter_action" value="reset">Clear Filter</button>
  </form>
  <p id="page_entries_info">No games found.</p><div id="games"></div>
  <form action="/games/101" method="post"><button>Assign</button></form>
</main>`;
const buttons = document => [...document.querySelectorAll(".ffx-game-day-navigation button")];
const flush = () => new Promise(resolve => setImmediate(resolve));
const dates = form => ["start", "end"].map(key => form.querySelector(`[name="session_search[${key}_date]"]`).value);

test("day buttons submit only the native Apply Filter form and preserve every other field", t => {
  const { w, document } = setup(t, { html: fixture(), path: "/games?filter[start_date]=Oct+20+2026&filter[end_date]=Oct+20+2026&page=3" });
  const form = document.forms[0];
  const otherFields = () => [...new w.FormData(form)].filter(([key]) => !key.endsWith("_date]"));
  const original = otherFields();
  let submitted = 0;
  document.addEventListener("submit", e => {
    e.preventDefault();
    assert.equal(e.target, form);
    assert.equal(e.submitter.name, "filter_action");
    assert.equal(e.submitter.value, "apply");
    submitted++;
  });
  w.eval(source);
  assert.deepEqual(buttons(document).map(b => b.textContent), ["<< Prev day", "Next day >>"]);
  buttons(document)[0].click();
  assert.deepEqual(dates(form), ["Oct 19 2026", "Oct 19 2026"]);
  buttons(document)[1].click();
  assert.deepEqual(dates(form), ["Oct 21 2026", "Oct 21 2026"]);
  assert.equal(submitted, 2);
  assert.deepEqual(otherFields(), original);
  assert.equal(document.querySelector("#page_entries_info").previousElementSibling.className, "ffx-game-day-navigation");
  assert.equal(document.querySelector(".ffx-game-day-navigation").textContent.includes("synthetic-secret"), false);
});

test("calendar arithmetic handles leap years, year boundaries, and daylight-saving dates", t => {
  for (const [date, previous, next] of [
    ["2028-02-29", "Feb 28 2028", "Mar 1 2028"],
    ["Mar 1 2027", "Feb 28 2027", "Mar 2 2027"],
    ["Dec 31 2026", "Dec 30 2026", "Jan 1 2027"],
    ["Jan 1 2027", "Dec 31 2026", "Jan 2 2027"],
    ["Nov 1 2026", "Oct 31 2026", "Nov 2 2026"],
    ["Mar 8 2026", "Mar 7 2026", "Mar 9 2026"],
  ]) {
    const { w, document } = setup(t, { html: fixture(date), path: "/games" });
    document.addEventListener("submit", e => e.preventDefault());
    w.eval(source);
    buttons(document)[0].click();
    assert.deepEqual(dates(document.forms[0]), [previous, previous]);
    buttons(document)[1].click();
    assert.deepEqual(dates(document.forms[0]), [next, next]);
  }
});

test("session-only and empty results work without fetching, losing focus, or duplicate controls", async t => {
  const { w, document } = setup(t, { html: fixture(), path: "/games" });
  w.fetch = () => { throw new Error("Day navigation must not fetch"); };
  document.addEventListener("submit", e => e.preventDefault());
  w.eval(source);
  const previous = buttons(document)[0];
  previous.focus();
  document.querySelector('[name="session_search[start_date]"]').value = "Nov 1 2026";
  document.querySelector('[name="session_search[venue_id][]"]').value = "11";
  document.querySelector("#games").append(document.createElement("p"));
  await flush();
  assert.equal(document.activeElement, previous);
  w.eval(source);
  assert.equal(document.querySelectorAll(".ffx-game-day-navigation").length, 1);
  previous.click();
  assert.deepEqual(dates(document.forms[0]), ["Oct 19 2026", "Oct 19 2026"]);
  assert.equal(document.querySelector('[name="session_search[venue_id][]"]').value, "11");
});

test("multi-day, invalid, ambiguous, and out-of-scope pages show no controls", t => {
  for (const [html, path] of [
    [fixture(), "/welcome"], [fixture(), "/games/101"], [fixture(), "/games/unassigned"],
    [fixture("Oct 20 2026", "Oct 21 2026"), "/games"],
    [fixture("Feb 30 2026"), "/games"], [fixture("Tomorrow"), "/games"], [fixture(""), "/games"],
    [fixture().replace('value="apply"', 'value="unknown"'), "/games"],
    [fixture().replace('action="/games/session_filter"', 'action="https://example.com/games/session_filter"'), "/games"],
    [fixture().replace('method="post"', 'method="get"'), "/games"],
    [fixture() + fixture(), "/games"], ['<div id="games"></div>', "/games"],
  ]) {
    const { w, document } = setup(t, { html, path });
    w.eval(source);
    assert.equal(buttons(document).length, 0, path);
  }
});

test("replacement pages and back navigation update controls; changed form targets cannot be submitted", async t => {
  const { w, document } = setup(t, { html: fixture(), path: "/games" });
  w.eval(source);
  document.body.innerHTML = fixture("Oct 21 2026");
  await flush();
  assert.equal(buttons(document)[1].title, "Show games for Oct 22 2026");
  assert.equal(document.querySelectorAll(".ffx-game-day-navigation").length, 1);
  document.forms[0].action = "/games/101";
  let submitted = false;
  document.addEventListener("submit", e => { e.preventDefault(); submitted = true; });
  buttons(document)[1].click();
  assert.equal(submitted, false);
  w.history.replaceState({}, "", "/welcome");
  w.dispatchEvent(new w.PopStateEvent("popstate"));
  await flush();
  assert.equal(buttons(document).length, 0);
  document.forms[0].action = "/games/session_filter";
  w.history.replaceState({}, "", "/games");
  w.dispatchEvent(new w.PopStateEvent("popstate"));
  await flush();
  assert.equal(buttons(document).length, 2);
});
