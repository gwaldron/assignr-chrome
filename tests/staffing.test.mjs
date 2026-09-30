import assert from "node:assert/strict";
import test from "node:test";
import { card, list, calendar, setup, range, response, ORIGIN } from "./helpers.mjs";

test("counts distinct assigned people and excludes vacancies without confusing unknown data with zero", t => {
  const { api, document } = setup(t);
  const scenarios = [
    ["AA", [["P", "1"], ["F", "2"], ["F", "2"], ["F", null]], 2],
    ["Seniors", [["P", "1"], ["F", null]], 1],
    ["AA", [["P", null], ["F", "2"]], 1],
    ["AA", [["P", null], ["F", null]], 0],
    ["Unknown", [["P", "1"], ["F", "2"]], null],
    ["AA", [["P", "1"], ["P", null], ["F", "2"]], null],
  ];
  for (const [age, slots, count] of scenarios) {
    assert.equal(api.parseList(document, list(card("101", age, slots)), range, 1).games.get("101").assignedCount, count);
  }
});

test("AA, AAA and Majors require a Plate and two distinct people", t => {
  const { api, document } = setup(t);
  for (const age of ["AA", "AAA", "Majors", " aa "]) {
    for (const [slots, expected] of [
      [[["P", "1"], ["F", "2"]], true],
      [[["P", "1"]], false],
      [[["P", "1"], ["F", "1"]], false],
      [[["P", "1"], ["F", "2"], ["F", null]], true],
      [[["P", null], ["F", "2"], ["F", "3"]], false],
      [[["P", "1"], ["P", "2"]], false],
      [[["P", "1"], ["P", null], ["F", "2"]], null],
    ]) {
      assert.equal(api.parseList(document, list(card("101", age, slots)), range, 1).games.get("101").staffed, expected, `${age}: ${JSON.stringify(slots)}`);
    }
  }
});

test("Juniors and Seniors qualify with one Plate, but never with Field only", t => {
  const { api, document } = setup(t);
  for (const age of ["Juniors", "Seniors"]) {
    assert.equal(api.parseList(document, list(card("101", age, [["P", "1"], ["F", null]])), range, 1).games.get("101").staffed, true);
    assert.equal(api.parseList(document, list(card("101", age, [["P", null], ["F", "1"]])), range, 1).games.get("101").staffed, false);
  }
});

test("unknown age groups, missing fields, and extra or unknown roles stay default", t => {
  const { api, document } = setup(t);
  const cases = [
    card("101", "Unknown"), card("101", ""),
    card().replace("AA:", ""),
    card().replace(" AA:", " <span>AA:</span>"),
    card().replace('class="assigned"', 'class="missing"'),
    card().replace("P: ", "U: "),
    card().replace("P: ", "Field: "),
    card().replace('data-assign-target="assignments"', 'data-assign-target="other"'),
    card().replace("</h5>", "</h5><h5>AA:</h5>"),
    card().replace("/users/1", "https://outside.example/users/1"),
    card().replace("/users/1", "javascript:alert(1)"),
    card().replace("/users/1", "/users/1?other=1"),
    card().replace("/users/1", "/users/0"),
    card().replace("</a>", '</a><a href="/users/3">Extra</a>'),
  ];
  for (const html of cases) assert.equal(api.parseList(document, list(html), range, 1).games.get("101").staffed, null);
});

test("untrusted names and descriptions never supply role/division data or execute", t => {
  const { api, document, w } = setup(t);
  const hostile = card("101", "Seniors", [["P", "1"]])
    .replace("Example Home", '<img src="https://outside.example/pixel" onerror="window.injected=1">AA Majors P:')
    .replace("Example Official", '<script>window.injected=1</script>Example');
  const before = document.body.innerHTML;
  assert.equal(api.parseList(document, list(hostile), range, 1).games.get("101").staffed, true);
  assert.equal(w.injected, undefined);
  assert.equal(document.body.innerHTML, before);
});

test("duplicate and inconsistent game IDs reject the page", t => {
  const { api, document } = setup(t);
  assert.throws(() => api.parseList(document, list(card() + card()), range, 1));
  assert.throws(() => api.parseList(document, list(card().replace('data-assign-game-value="101"', 'data-assign-game-value="102"')), range, 1));
  assert.throws(() => api.parseList(document, '<form action="/accounts/sign_in">Sign in</form>', range, 1));
  assert.throws(() => api.parseList(document, list().replace("</body></html>", ""), range, 1), /Incomplete/);
});

test("only the identified month calendar supplies valid ranges and unique game IDs", t => {
  const { api, document } = setup(t, { html: calendar(["101", "101", "102"]) });
  const snapshot = api.calendarSnapshot(document, "/welcome");
  assert.equal(snapshot.range.start, range.start);
  assert.equal(snapshot.range.end, range.end);
  assert.deepEqual(Array.from(snapshot.ids), ["101", "102"]);
  assert.equal(api.calendarSnapshot(document, "/games"), null);
  document.body.innerHTML = calendar(["101"], range.start, 7);
  assert.equal(api.calendarSnapshot(document, "/welcome"), null);
  document.body.innerHTML = calendar();
  document.querySelector("[data-date]").setAttribute("data-date", "2026-02-30");
  assert.equal(api.calendarSnapshot(document, "/welcome"), null);
});

test("pagination accepts only the next Fairfax page with the exact date filters", t => {
  const { api, document } = setup(t);
  const next = api.listURL(range, 2).href;
  assert.equal(api.parseList(document, list(card(), next), range, 1).nextPage, 2);
  for (const url of [
    next.replace(ORIGIN, "https://outside.example"),
    next.replace("page=2", "page=3"),
    next + "&filter[published]=yes", next + "&page=2",
    next.replace("Sep", "Oct"), next.replace("/games?", "/games/delete?"),
  ]) assert.equal(api.parseList(document, list(card(), url), range, 1).nextPage, null);
});

test("reader makes bounded same-origin GETs and combines pagination before publishing", async t => {
  const { api, document } = setup(t);
  const calls = [];
  const read = api.createReader(document, async (url, options) => {
    calls.push({ url, options });
    return response(url, calls.length === 1 ? list(card(), api.listURL(range, 2).href) : list(card("102", "Juniors", [["P", "3"]])));
  });
  const games = await read(range, ["101", "102"], new AbortController().signal);
  assert.equal(games.get("101").staffed, true);
  assert.equal(games.get("102").staffed, true);
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(new URL(url).origin, ORIGIN);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    assert.equal(options.credentials, "same-origin");
    assert.equal(options.mode, "same-origin");
  }
});

test("authentication, permission, throttling, and incomplete coverage stop further requests", async t => {
  const { api, document } = setup(t);
  for (const result of [
    url => response(url, "denied", 401), url => response(url, "denied", 403),
    url => response(url, "slow down", 429), url => response(url, "failure", 500),
    url => response(url, "Sign in"), url => response(url, list("")),
    url => response(url, "{}", 200, { "Content-Type": "application/json" }),
    url => response(url + "&unexpected=1"),
    url => response(url, list(), 200, { "Content-Length": "9999999" }),
    url => response(url, "x".repeat(2 * 1024 * 1024 + 1)),
  ]) {
    let calls = 0;
    const read = api.createReader(document, async url => { calls++; return result(url); });
    await assert.rejects(read(range, ["101"], new AbortController().signal));
    await assert.rejects(read(range, ["101"], new AbortController().signal));
    assert.equal(calls, 1);
  }
});

test("pagination caps and duplicate IDs fail without returning partial results", async t => {
  const { api, document } = setup(t);
  let calls = 0;
  const read = api.createReader(document, async url => {
    const page = ++calls;
    return response(url, list(card(String(page)), api.listURL(range, page + 1).href));
  });
  await assert.rejects(read(range, ["1"], new AbortController().signal), /limit/i);
  assert.equal(calls, 8);
  const duplicateReader = api.createReader(document, async url => response(url,
    list(card(), new URL(url).searchParams.has("page") ? "" : api.listURL(range, 2).href)));
  await assert.rejects(duplicateReader(range, ["101"], new AbortController().signal), /Duplicate/);
});

test("navigation aborts do not block the next range", async t => {
  const { api, document } = setup(t);
  const controller = new AbortController();
  let calls = 0;
  const read = api.createReader(document, async url => {
    if (++calls === 1) { controller.abort(); throw new Error("cancelled"); }
    return response(url);
  });
  await assert.rejects(read(range, ["101"], controller.signal));
  assert.equal((await read(range, ["101"], new AbortController().signal)).get("101").staffed, true);
});

test("range byte budget and document request budget are enforced", async t => {
  const { api, document } = setup(t);
  let pages = 0;
  const largeReader = api.createReader(document, async url => {
    const page = ++pages;
    return response(url, list(card(String(page)) + " ".repeat(1800000), api.listURL(range, page + 1).href));
  });
  await assert.rejects(largeReader(range, ["1"], new AbortController().signal), /Range response too large/);
  assert.equal(pages, 5);
  let calls = 0;
  const limitedReader = api.createReader(document, async url => { calls++; return response(url); });
  for (let i = 0; i < 60; i++) await limitedReader(range, ["101"], new AbortController().signal);
  await assert.rejects(limitedReader(range, ["101"], new AbortController().signal), /limit/);
  assert.equal(calls, 60);
});
