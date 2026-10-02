import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

export const ORIGIN = "https://fairfaxll.assignr.com";
export const range = { start: "2026-09-27", end: "2026-11-07" };
export const staffingSource = await readFile(new URL("../extension/staffing.js", import.meta.url), "utf8");
export const contentSource = await readFile(new URL("../extension/content.js", import.meta.url), "utf8");
export const overflowSource = await readFile(new URL("../extension/overflow.js", import.meta.url), "utf8");

// Synthetic HTML matching inspected structure. No real people or game data.
export function card(id = "101", age = "AA", slots = [["P", "1"], ["F", "2"]]) {
  return `<article data-controller="assign" data-game-id="${id}" data-assign-game-value="${id}">
    <h4>Example field (AA/AAA)</h4>
    <h5> ${age}: <span>Example Home vs Example Away</span> </h5>
    <div data-assign-target="assignments">${slots.map(([role, person]) => `
      <div class="assignment"><div class="position"><i class="fa-circle-question"></i><strong>${role}: </strong></div>
      <div class="assigned">${person ? `<a href="/users/${person}">Example Official</a>` : "<!-- restricted by policy -->"}</div></div>`).join("")}
    </div></article>`;
}

export function list(cards = card(), next = "") {
  return `<!doctype html><html><body><div id="games">${cards}</div>${next ? `<a rel="next" href="${next.replaceAll("&", "&amp;")}">Next</a>` : ""}</body></html>`;
}

export function calendar(ids = ["101"], start = range.start, days = 42, gamesByDay = [ids]) {
  return `<main data-controller="calendar-main"><div class="fc" data-calendar-main-target="calendar">
    <div class="fc-header-toolbar"><h2>Example month</h2><button class="fc-next-button">Next month</button></div>
    <div class="fc-daygrid"><div class="fc-daygrid-body"><table class="fc-scrollgrid-sync-table"><tbody>${Array.from({ length: days }, (_, index) => {
      const date = new Date(Date.parse(start + "T00:00:00Z") + index * 86400000).toISOString().slice(0, 10);
      return `${index % 7 === 0 ? "<tr>" : ""}<td class="fc-daygrid-day" data-date="${date}"><div class="fc-daygrid-day-frame">
        <div class="fc-daygrid-day-top"><a class="fc-daygrid-day-number" tabindex="0" data-navlink="">${Number(date.slice(-2))}</a></div>
        <div class="fc-daygrid-day-events">${(gamesByDay[index] ?? []).map(id => `<div class="fc-daygrid-event-harness"><a class="calendar-game" href="/games/${id}"><span class="fc-event-title">Example game ${id}</span></a></div>`).join("")}</div>
      </div></td>${index % 7 === 6 || index === days - 1 ? "</tr>" : ""}`;
    }).join("")}</tbody></table></div></div>
    <a class="game-date" href="/games?filter[start_date]=Oct+3+2026">Day summary</a>
  </div></main>`;
}

export function response(url, html = list(), status = 200, headers = {}) {
  const result = new Response(html, { status, headers: { "Content-Type": "text/html; charset=utf-8", ...headers } });
  Object.defineProperty(result, "url", { value: url });
  return result;
}

// Simplified versions of the two additional layouts inspected on /welcome.
export function dayCalendar(ids = ["101"], date = "2026-10-06") {
  return `<main data-controller="calendar-main"><div class="fc" data-calendar-main-target="calendar">
    <div class="fc-header-toolbar"><h2>Example day</h2></div>
    <div class="fc-resourceTimelineDay-view fc-view"><table><tr>
      <th class="fc-timeline-slot-label" data-date="${date}T00:00:00">12am</th>
      <th class="fc-timeline-slot-label" data-date="${date}T18:00:00">6pm</th>
    </tr></table>${ids.map(id => `<div class="fc-timeline-event-harness"><a class="calendar-game fc-timeline-event" href="/games/${id}"><div class="fc-event-main">AA / Baseball</div></a></div>`).join("")}</div>
  </div></main>`;
}

export function listCalendar(groups = [["2026-10-06", ["101"]]]) {
  return `<main data-controller="calendar-main"><div class="fc" data-calendar-main-target="calendar">
    <div class="fc-header-toolbar"><h2>Example week</h2></div>
    <div class="fc-listWeek-view fc-view fc-list"><table class="fc-list-table"><tbody>${groups.map(([date, ids]) => `
      <tr class="fc-list-day" data-date="${date}"><th colspan="3"><a class="fc-list-day-text" tabindex="0">${date}</a></th></tr>
      <tr class="game-date fc-list-event"><td colspan="3"><a href="/games?filter[start_date]=${date}">Assign Games...</a></td></tr>
      ${ids.map(id => `<tr class="calendar-game fc-list-event"><td class="fc-list-event-time">6:00pm</td><td class="fc-list-event-graphic"><span class="fc-list-event-dot"></span></td><td class="fc-list-event-title"><a href="/games/${id}">Example Park / Field 1 / AA / Baseball</a></td></tr>`).join("")}`).join("")}</tbody></table></div>
  </div></main>`;
}

export function setup(t, { html = calendar(), fetchPage = async url => response(url), path = "/welcome" } = {}) {
  const dom = new JSDOM(html, { url: ORIGIN + path, runScripts: "outside-only", pretendToBeVisual: true });
  t.after(() => dom.window.close());
  const w = dom.window;
  w.TextDecoder = TextDecoder;
  w.fetch = fetchPage;
  w.eval(staffingSource);
  w.eval(overflowSource);
  return { w, document: w.document, api: w.FairfaxStaffing };
}

export function clock(w) {
  let now = 1800000000000;
  let nextId = 0;
  const timers = new Map();
  w.Date.now = () => now;
  w.setTimeout = (fn, delay = 0) => {
    const id = ++nextId;
    timers.set(id, { at: now + delay, fn });
    return id;
  };
  w.clearTimeout = id => timers.delete(id);
  const flush = () => new Promise(resolve => setImmediate(resolve));
  return {
    async tick(ms = 0) {
      const target = now + ms;
      for (let turn = 0; turn < 1000; turn++) {
        await flush();
        const entry = [...timers].filter(([, timer]) => timer.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!entry) { now = target; await flush(); return; }
        const [id, timer] = entry;
        now = timer.at;
        timers.delete(id);
        timer.fn();
      }
      throw new Error("Timer loop detected");
    },
  };
}
