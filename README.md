# Fairfax Assignr Staffed Games

A Chrome Manifest V3 extension for the logged-in month calendar at
[fairfaxll.assignr.com](https://fairfaxll.assignr.com).

**Version 0.10.0:** all month-calendar games stay expanded automatically.
Qualifying games get a dark green background, white game text,
and a badge showing the **number of assigned umpires**. Unstaffed games with at
least one assigned umpire also get a count badge, while retaining their existing
background and game text colors. Zero assignments, unavailable data, and cancelled
games have no count badge. Hovering a count badge explains the count.

An amber **R** badge marks a game with pending umpire requests. It appears after
the count badge, or by itself when there is no count badge. Hover for **Pending
umpire requests**. It does not change the game's background or staffing status;
an assigned umpire awaiting confirmation does not by itself trigger R. Cancelled
games and games with unavailable request data have no R badge. The status comes
from the same game-list reads used for staffing, with no extra requests.

Game labels read **Time Age / Venue / Sub-venue / Gender**, keeping the final
field exactly as supplied by Assignr (currently Baseball or Softball). For example,
`6:30p Example Park / Field 2 (AA/AAA) / AA / Baseball` becomes
`6:30p AA / Example Park / Field 2 (AA/AAA) / Baseball`.
Times always include minutes and use a/p: `6p` or `6:00pm` becomes `6:00p`, and
`9:30am` becomes `9:30a`. The scheduled time and timezone are unchanged.
Games without a sub-venue omit that part. Cancellation prefixes, game links,
and count badges are preserved. Formatting uses the existing title text and adds
no requests. Unrecognized labels or nested title markup are left unchanged.

Each day with games that do not meet the staffing rule shows **Unstaffed: X**
at the top left, with the existing date link on the right. The count includes
games hidden behind `+ more`, counts each game once, and excludes cancelled games.
It uses the same fetched data as the green badges, with no extra requests.
No label appears for zero, while loading, or when a day's data cannot be classified
reliably. Refresh, expiry, and month navigation update or clear both displays.

Every day's games expand automatically **inside the calendar**, with no **+ more**
or **Show less** controls. Each week row grows to fit its busiest day, moving later
weeks down without covering them. The calendar's scroll area includes the extra
height. Game and date links still open normally, including keyboard access.
Expansion reuses existing rows and adds no requests or duplicate game links.
It reapplies after month changes and dynamic updates, even when staffing reads fail.
The expanded grid fits the width remaining beside the scrollbar so Saturday's
games and count badges remain visible.

Version 0.8.0 removes the experimental pay-scale badges and all umpire-profile
requests. The games list and Assign dropdowns use their normal appearance.

## Staffing rule

- Exactly **one assigned Plate umpire** (`P` means Plate).
- **AA, AAA, and Majors** also need at least **two distinct assigned umpires total**,
  including the Plate umpire.
- **Juniors and Seniors** can qualify with just the Plate umpire.

| Age group | Assigned configuration | Display |
| --- | --- | --- |
| AA / AAA / Majors | 1 Plate + at least 1 other distinct umpire | Dark green, total count badge |
| AA / AAA / Majors | 1 Plate only | Original background, badge: 1 |
| Juniors / Seniors | 1 Plate only | Dark green, badge: 1 |
| Any supported group | Field only, no Plate | Original background, total count badge |
| Any supported group | 2 assigned Plate umpires | Original background, total count badge |
| Any | Zero assignments or unreadable staffing data | Original background, no count badge |

Official IDs identify people; duplicate slots for the same person do not inflate
the total. Pending acceptance does not disqualify an occupied assignment. Extra
vacant Field slots do not disqualify a game that meets the rule. There are no
red/yellow staffing warnings or unknown-data badges. Default appearance makes no claim
about whether a game is staffed. Cancelled games retain their default styling.

The first version supports the five age-group labels above and the homepage
month view. Unknown labels, other views, malformed assignment markup, and
ambiguous Plate configurations stay unchanged. In particular, the inspected
list cannot reliably distinguish an empty slot from one hidden by policy, so
multiple configured Plate slots are left unchanged even when only one visible
Plate assignment exists. See [inspection findings](docs/inspection.md).

## Try it in Chrome

No build or dependency installation is needed to load the extension.

1. Open Chrome's Extensions page (`chrome://extensions`).
2. Turn on **Developer mode**.
3. Choose **Load unpacked** and select `D:\devel\assignr-chrome\extension`.
4. Confirm **Fairfax Assignr Staffed Games**, version **0.10.0**, appears without errors.
5. If you already loaded the earlier scaffold, click its **Reload** button instead.
6. Refresh your signed-in Assignr homepage and use the **month** calendar.

After a brief read, games with known positive assignment counts should show a
numeric badge; only qualifying games should turn green. A **Refresh staffing**
button appears beside the calendar controls. Use it after changing assignments
elsewhere. Returning to the tab refreshes data if the last read is over 30 seconds
old. Indicators expire after five minutes; use the button to read again. There
is no background polling. Reads are spaced at least five seconds apart, so a
rapid refresh or month change may take a few seconds to begin.

After editing extension files, click **Reload** on its extension card, then
reload the Assignr tab. Disable/remove the extension and reload Assignr to unload
it. Chrome's [local development guide](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world)
explains loading and reloading unpacked extensions.

## Live test checklist

1. Compare a green AA/AAA/Majors game with its assignment page: one Plate and at
   least two distinct people should be assigned.
2. Check a Juniors/Seniors game with only Plate (green), and one with only Field
   (default). Compare existing games without changing assignments just for tests.
3. Check a one-Plate-only AA/AAA/Majors game (original background, badge 1) and a
   cancelled game (original appearance, no badge). Compare each badge with the
   number of distinct assigned people; zero and unknown counts have no badge.
4. Go forward/back a month and confirm all games expand automatically. Check for correct labels,
   no duplicate labels, and unchanged normal game/day links and keyboard access.
5. Click **Refresh staffing**, then check that old labels disappear while fresh
   data loads. Return from a game page/tab and check that data can refresh.
6. Check the extension card's **Errors** button and the page console for errors.
7. Compare each day's **Unstaffed: X** with its non-cancelled games, including
   those behind `+ more`. Verify the date still works, counts are not duplicated,
   and a fully staffed or empty day has no count label.
8. Check a busy week: every game should be visible without clicking **+ more**,
   the entire week should grow, and later weeks should move down. Check two busy
   days in the same week and verify games fit inside their cells. Game links,
   badges, daily counts, and keyboard navigation should still work.
9. Confirm labels show age before venue, keep sub-venue and the final field, and
   keep the cancellation prefix on cancelled games. Check again after changing
   months and refreshing staffing.
10. Compare a game from Assignr's **Pending Requests** list with the calendar:
    it should show **R**, including when it has zero assigned umpires. A question
    mark for an unconfirmed assignment alone should not trigger R. Check that
    both badges fit in Saturday's column when busy days expand automatically.

If nothing turns green, first confirm the extension is enabled, the homepage is
in month view, and your session is signed in. A failed read clears the labels and
pauses further reads until page reload. The refresh button is then disabled and
its tooltip explains that data is unavailable. The console emits one generic
`Fairfax staffing` warning without names, tokens, or response contents.

For deeper troubleshooting, use DevTools Network to check same-origin GETs to
`/games` with the displayed date range. Do not export/share HAR files, cookies,
private response contents, or credentials. Filtering or changed site markup can
prevent complete calendar coverage; that deliberately leaves games unchanged.

## Development and tests

```text
extension/
  manifest.json        Fairfax-only, isolated, top-frame content scripts
  staffing.js          Calendar discovery, assignment parser, bounded reader
  overflow.js          Automatic day expansion and week sizing
  content.js           Dynamic calendar reconciliation and refresh lifecycle
  content.css          Count and request badges, green games, expanded week layout
scripts/
  validate.mjs         Dependency-free manifest/file/syntax checks
  preview-layout.mjs   Local-only server for the synthetic browser fixture
tests/
  helpers.mjs          Synthetic fixtures and deterministic timers
  staffing.test.mjs    Rules, parser, URL scope, pagination, and request bounds
  calendar.test.mjs    DOM updates, links, cancellation, refresh, and failures
  daily-counts.test.mjs Daily aggregation, hidden/duplicate games, and date links
  requests.test.mjs     Request evidence, R badges, shared reads, and lifecycle
  overflow.test.mjs    Automatic expansion, rerenders, lifecycle, and preserved links
  browser-layout.*     Real-browser week geometry checks with synthetic games
docs/
  inspection.md        Live read-only evidence and known limitations
```

Run the dependency-free validation with Node.js:

```powershell
node scripts/validate.mjs
```

For the local DOM tests, use Node.js 24.15+ in the 24.x series (tested with 24.19.0)
and pnpm, then run:

```powershell
pnpm install --frozen-lockfile
node --test tests/*.test.mjs
```

The pinned jsdom dependency is for development only. Nothing from `node_modules`
is loaded by the extension. Tests use mocked network responses and synthetic
people/games; they do not access Assignr, execute remote scripts, or install the
extension. Thirty-four tests pass. They cover rules, numeric badges on staffed and
unstaffed games, zero/unavailable counts, distinct IDs, malformed and
hostile content, pagination, errors, request/byte limits, timeouts, stale results,
rerenders, default/cancelled styling, links, daily counts, inline expansion, and
duplicate prevention, pending-request markers, and R badge lifecycle without
extra reads. They do not establish Chrome injection or live response
compatibility.

To check layout in a real browser without installing the extension:

```powershell
node scripts/preview-layout.mjs
```

Open the printed localhost URL and click **Run layout checks**. All thirteen checks
should report PASS: week growth, later-week movement, other weeks' minimum
heights, contained games, equal cell heights, scrollable content, Saturday's cell
and count/R badges clear of the scrollbar, automatic visibility, stable rerenders,
and restored layout when leaving month view. These passed in the in-app Chromium browser.
The fixture recreates the absolute-positioned balanced grid observed on Assignr
and uses the actual expansion script and stylesheet. It uses synthetic games and
no Assignr requests. Stop the server with Ctrl+C. Reload the installed extension
and calendar to apply version 0.10.0. See the [inspection findings](docs/inspection.md)
for the scope of synthetic and previous live checks.

## Requests and privacy

The calendar feature reads the existing `/games` HTML list for the displayed month,
including adjacent-month grid dates. Pagination is sequential and limited to
eight pages per lookup, 60 requests per document lifetime, 2 MiB per page,
8 MiB per lookup, and 20 seconds per lookup. An incomplete response or missing
calendar game invalidates the lookup; partial results are not displayed.
Reload the page to reset failed reads or the document request budget.

The manifest matches only `https://fairfaxll.assignr.com/*`. Content scripts run
in an isolated world. Calendar changes are limited to the identified homepage calendar.
Only same-origin GETs to the calendar's game-list data are made, using the existing
session. Redirects are rejected. The extension does not fetch umpire profiles.
There is no worker, extension API permission, storage, telemetry, API token,
remote code, or third-party data transfer. Results stay in memory. Returned HTML
is parsed in a detached template and never inserted into the page; visible label
text is constant, derived from validated numeric counts, or reordered from the
existing title using `textContent`. Site strings and links are treated as untrusted.

No games, assignments, settings, or notifications are changed. No credentials
or OAuth grants are created. Installing the extension or expanding access to
another service still requires the user's permission. Never put credentials,
private captures, or raw HAR files in source control. The ignore rules are a
backstop, not a secret scanner.
