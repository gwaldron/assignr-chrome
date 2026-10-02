# Phase 1 inspection and recommendation

Current release: **0.8.1** retains the calendar features and removes the pay-scale
experiment. The versioned sections below are historical inspection records;
the 0.7.x pay-scale behavior is no longer included in the extension.

Inspected September 30, 2026 (America/New_York). Requirements revised the same
day to a positive **staffed** indicator; the earlier count-badge plan is superseded.

## Current recommendation

Use an isolated content script on the homepage month calendar, with a bounded
same-origin read of the existing date-filtered `/games` HTML route. Match games
by numeric ID, identify Plate (`P`) assignments, and count distinct official IDs.
Apply green only when the user's staffing rule is established. All other games
retain their default appearance. Following the user's instruction to keep
working, version 0.2.0 implements this approach. It has not been installed or
tested as an extension on the live site. The observations below are the earlier
read-only investigation, followed by the implementation validation record.

The rule is exactly one assigned Plate umpire, plus at least two distinct
assigned umpires total for AA, AAA, and Majors. Juniors and Seniors can qualify
with only the Plate umpire. The user explicitly confirmed that `P` means Plate.
The live sample also uses `F` for Field. Acceptance is not an extra condition in
the requested rule: occupied assignments awaiting acceptance still count.

No broader host permission or OAuth credentials are recommended for this design.
The HTML route is an internal UI route, not a verified versioned public API;
vendor support and future markup stability are not established.

## Access and work performed

The repository initially contained only `.git`, without tracked files or commits.
No `AGENTS.md` was found in the repository or its filesystem ancestors. The
scaffold was added without replacing existing project files.

The initial in-app browser visit reached login. The user subsequently completed
two-step authentication directly; calendar and game-page reads then succeeded.
The agent did not read or enter credentials/codes or request a new code. Later,
the user's existing Chrome window was inspected with the computer-use skill,
including its open DevTools Network panel.

| Investigation | Evidence |
| --- | --- |
| Homepage and game access | Authenticated reads succeeded in the in-app browser and Chrome |
| Month calendar | Stable game links and IDs; September grid contained 118 unique games |
| Navigation | Next/previous month updated the grid while remaining at `/welcome` |
| Existing calendar request | Same-origin GET to `/calendars/games.json`; response inspected in Chrome Network |
| Raw game-list HTML | GET `/games` document returned 200; assignment markup present in the Response tab |
| Range coverage | Three rendered list pages contained 40 + 40 + 38 cards, matching all 118 calendar IDs |
| New staffing rule | Read-only DOM check of 15 October 3 games identified 11 candidates |
| Official API | Public documentation read; live API access and OAuth not exercised |
| Extension runtime | Implemented and tested with synthetic DOM/response fixtures; not installed or live-tested in Chrome |

Only read-only calendar navigation, game-list/detail reads, and inspection tools
were used. No edit, assignment, delete, message, saved-filter, payment, or OAuth
controls were submitted. Public research used generic technical queries. Private
page contents, credentials, and raw responses were not uploaded to third-party
services by the agent or saved in this repository.

## Calendar structure and existing JSON

| Purpose | Observed selector or structure |
| --- | --- |
| Homepage | `/welcome` |
| Controller | `[data-controller="calendar-main"]` |
| Calendar root | `[data-calendar-main-target="calendar"].fc` |
| Month heading / dates | `.fc-toolbar-title` / `[data-date]` in `YYYY-MM-DD` form |
| Individual game | `a.calendar-game[href]` linking to `/games/<numeric-id>` |
| Label and time | `.fc-event-title`, `.fc-event-time` |
| Cancelled game | `cancelled-game` class; preserve existing presentation |
| Day summary | `a.game-date`, linking to a date-filtered `/games` list |
| Navigation | `.fc-next-button`, `.fc-prev-button` |
| Overflow | `.fc-daygrid-more-link` |

Markup is FullCalendar-style; the library version was not established. The
controller advertises month, day, week, and list views and America/New_York time.
Only month navigation was exercised. September's grid spanned August 30 through
October 3, with 118 unique games (25 marked cancelled). October's grid spanned
September 27 through October 31. Game elements/descendants had only link and
class attributes, without assignment counts. No inline JSON script payload was
identified. These DOM observations do not describe all application memory.

Chrome Network showed this existing request (parameters decoded for readability):

```text
GET /calendars/games.json
  ?start=2026-09-27T00:00:00-04:00
  &end=2026-11-01T00:00:00-04:00
  &timeZone=America/New_York
```

The response was available after a 304 cache revalidation. The end boundary is
exclusive for the observed October grid. Related requests with `dates=1` and to
`/calendars/venues.json` were visible but their payloads were not inspected.

Sampled game records contained `id` (`game_<numeric-id>`), `title`, `start`, `end`,
`resourceId`, `url`, `classNames`, and `extendedProps`. Observed extended keys:
`sort`, `start`, `startTimeShort`, `tz`, `titleWithVenue`, `titleWithoutVenue`,
`titleWithGameDescription`, `published`, `cancelled`, and `eventType` (`game`).
`titleWithoutVenue` contained age-group/sport text such as `Seniors / Baseball`.

`titleWithGameDescription` included formatted assignment lines. This is a
synthetic illustration, not a saved private response:

```text
Game description<br />P: Example Plate<br />F: Example Field<br />F:
```

No structured assignments, official IDs, or explicit assignment count were
found in the sampled records. This is a sample observation, not an exhaustive
schema guarantee. The formatted text could support a smaller one-request
integration, but mixes human-readable descriptions with names and does not
provide distinct-person IDs. Blank role lines alone do not prove visibility or
vacancy. The HTML list is the stronger initial source for the new rule.

## Game-list HTML and role evidence

The existing calendar day link supplied:

```text
GET /games?filter[end_date]=Oct 3 2026&filter[start_date]=Oct 3 2026
```

The raw document response contained assignment markup; a DevTools search for
`data-assign-target="assignments"` found 15 matches, consistent with 15 rendered
cards. This verifies initial-response availability, not an extension fetch.
A proposed read-only Console fetch was blocked by Chrome's paste warning and
was not executed. The warning was not bypassed. Subsequent role and age-group
checks used the browser tool's read-only DOM inspection.

| Purpose | Observed structure |
| --- | --- |
| Game-list card | `#games [data-controller="assign"][data-game-id]` |
| Game identity | `data-game-id` and matching numeric `data-assign-game-value` |
| Age group | Direct text nodes of the card's `h5`, such as `AAA:`; team text is in a child element |
| Assignment container | `[data-assign-target="assignments"]` |
| Slot / role | `.assignment` / `.position strong`, with `P:` or `F:` |
| Positive occupancy evidence | `.assigned a[href^="/users/"]`, with a numeric official ID |
| Status icons observed | `fa-check`, `fa-circle-question`, and `fa-circle-dashed` |

Normalize whitespace and the final colon in the age-group label. Do not search
the entire card for division names: venue and team descriptions also contain
terms such as AA, AAA, and Majors. `data-assign-game-value` is only a numeric ID,
not an embedded assignment object. Assignment/edit URLs exist on cards but must
never be followed by this extension.

A blank rendered `.assigned` container can contain `<!-- restricted by policy -->`
in the HTML. This comment does not establish whether an assignment is vacant
or hidden. A sampled game with four such slots was checked on its detail page;
all four were explicitly labelled `« Unassigned »`. Thus the marker can occur
for actual vacancies, but should not itself be interpreted as proof of vacancy.
Status-icon meanings for every account/permission state remain unverified.

Three earlier detail comparisons showed 1, 2, and 4 occupied slots. In the
one-person example, the heading still said **Assigned Officials (2 umpires)**.
That heading describes configured capacity in this example, not occupancy.
The range list's visible official links matched those three detail comparisons.
No duplicate person within a game was observed in that range.

Earlier notes described blank list slots as zero assignments. The more precise
finding is that these slots had **no visible official link**; blank markup alone
cannot establish zero. The staffed-only design does not need to classify them
as zero or unstaffed.

## Read-only check of the revised rule

On October 3, every inspected card had one configured `P:` slot and recognizable
P/F roles. Checking for an assigned official in that sole Plate slot, then the
required minimum of distinct visible officials, yielded:

| Age group | Games inspected | Staffing candidates |
| --- | ---: | ---: |
| AA | 4 | 3 |
| AAA | 4 | 4 |
| Majors | 3 | 2 |
| Juniors | 2 | 1 |
| Seniors | 2 | 1 |
| Total | 15 | 11 |

The sample included both Baseball and Softball; the user's rule was applied by
age group without an additional sport restriction. A one-person Seniors game
with an assigned Plate qualified; a one-person Seniors game with only a Field
umpire did not. A one-person Juniors game with Plate qualified. Extra blank Field
slots did not disqualify games that already met the required minimum.

This check was a read-only DOM calculation, not the extension's parser or a test
of green styling. An initial inspection expression retained trailing whitespace
in age-group labels; correcting normalization produced the results above.

## Implementation approach

1. Positively identify the `/welcome` month calendar and derive its entire grid
   range, including adjacent-month dates.
2. Fetch the observed same-origin `/games` range using the current session.
   Follow only validated same-origin pagination for that same range, with strict
   request, page, time, and response-size bounds. The observed 118-game range
   required three pages. Do not fetch each game separately.
3. Parse without executing returned scripts or inserting response HTML. Match
   numeric game IDs, normalize the dedicated age-group label, and read roles
   and official IDs. Treat unknown markup and malformed links conservatively.
4. Establish exactly one assigned Plate and, where required, at least two
   distinct people. In the observed single-Plate-slot layout, an official link
   in that slot establishes the Plate condition. If additional Plate slots are
   hidden or ambiguous, do not infer exactly one. Uncertainty about an unused
   Field slot need not block a minimum already established by visible people.
   Missing/unrecognized age groups cannot default to the single-umpire rule.
5. Add a green treatment with a short `OK` badge and explanatory tooltip only for qualifying
   games. Keep existing anchors and cancelled styling. Use constant text via
   `textContent`; no site text becomes injected HTML. Leave everything else at
   its default appearance, including unavailable data.
6. Observe relevant calendar updates with a coalesced `MutationObserver` and
   reconcile by game ID/DOM occurrence. Deduplicate in-flight reads, bound memory,
   ignore the extension's own mutations, and discard stale results after
   navigation. Remove old green indicators when evidence becomes stale or fails.
   No polling or automatic retry loop; stop on authentication failures and honor
   throttling. Define freshness/invalidation behavior before relying on caching.

Chrome documents that content-script requests use the page origin and are
subject to same-origin policy. This supports the proposed scope; an actual
extension fetch remains untested. Source:
[Chrome network requests](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

## Official API fallback (documentation only)

Assignr documents API v2 and developer access through support. This does not
establish access for this account. No access request was sent. Sources:
[API overview](https://support.assignr.com/en/articles/8526572-api-overview) and
[API access](https://assignr-api.readme.io/reference/access-to-the-api).

The game-list endpoint is `GET https://api.assignr.com/api/v2/sites/{site_id}/games`,
with `search[start_date]`, `search[end_date]`, pagination, and up to 50 records
per page. Fairfax's API site ID, account visibility, and live response shape are
unverified. Source: [list site games](https://assignr-api.readme.io/reference/getv2sitessiteidgames).

An assignment can be vacant. The documented game example includes assignments
with `assigned`, `accepted`, `declined`, and an embedded official. Assignment
array length is not a person count. Sources:
[terminology](https://assignr-api.readme.io/reference/officiating-terminology) and
[game relationships](https://assignr-api.readme.io/reference/links).

Authentication is OAuth 2.0 with Client Credentials and Authorization Code
flows and a `read` scope. The docs place API credentials under Profile → API
Access after access is granted. OAuth uses `https://app.assignr.com/oauth/authorize`
and `/oauth/token`. PKCE is documented, but the token example includes a client
secret, so a secretless public-extension flow must be confirmed before choosing
it. A bundled client secret cannot be kept confidential. Source:
[authentication](https://assignr-api.readme.io/reference/authentication).

No API/OAuth hosts were contacted for live access. No credentials, grants, or
callback registrations were created. A Fairfax browser login does not prove
API access. Additional hosts and any credential/grant flow need explicit user
approval if this fallback ever becomes necessary.

## Remaining permissions and validation

No login blocker remains for inspection. No additional site access is needed
for the recommended design. Loading/installing the extension still requires
explicit user permission and has not been performed.

Remaining live verification:

- Define handling of declined assignments and unrecognized roles, without
  treating pending acceptance as a failure of the user's requested rule.
- Compare the implemented parser/reader against actual browser responses after
  installation is authorized. Synthetic fixtures cover the cases listed below.
- Test month navigation, root replacement, overflow, and link behavior in Chrome.
  Other calendar views and saved-filter effects remain untested; the first
  implementation supports the inspected month view explicitly.
- Check the dark green background/OK badge against actual calendar layout while
  preserving cancelled-game styling, then perform a small read-only comparison.

`node scripts/validate.mjs` passes with Node.js v24.19.0. It checks Manifest V3
fields, the exact Fairfax-only match, top-frame isolated execution, absence of
extra capabilities, file availability, and JavaScript syntax. It makes no
requests and performs no browser actions.

## Version 0.2.0 validation record

The first feature is implemented in `staffing.js`, `content.js`, and `content.css`.
The manifest adds local CSS and the parser script without widening host access
or requesting extension API permissions. It reads same-origin HTML with the
existing session and rejects redirects. The reader requires complete document
closing tags and coverage of every currently rendered calendar game before
publishing results. Internal HTML compatibility remains subject to the live test.

The runtime adds green indicators and a Refresh staffing button, preserving
game anchors and cancelled appearances. It coalesces DOM updates, cancels stale
lookups, prevents duplicate indicators, clears failed/expired results, and does
not poll. Results expire after five minutes. A lookup has an eight-page,
20-second, 8-MiB cap with a 2-MiB per-page cap; each document permits at most 60
requests. New lookups are separated by five seconds. Errors pause reads until
reload and emit a generic diagnostic without private content.

Ran `node --test tests/*.test.mjs`: **19 tests passed** using jsdom 30.1.1 and
Node.js 24.19.0. Fixtures contain synthetic data and fetch is mocked. Coverage
includes the staffing matrix, duplicate people, pending assignments, hidden
extra Plate slots, unknown roles/groups, malformed/truncated responses, login
and 401/403/429/500 errors, pagination validation, page/range/request limits,
timeouts, stale-response cancellation, DOM replacement, duplicate rendering,
refresh, expiry, original links, cancelled games, and no work on other pages.

No additional live Assignr reads or extension installation were performed during
implementation. Chrome injection, rendered visual layout, and actual extension
fetches remain unverified. The user can follow the README to load or reload the
extension and perform the live checklist.

Returned HTML is held in an inert template, never inserted, cloned, or adopted
into the live document. Only constant badge text is added to live elements.
See [HTML template behavior](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/template)
and [Chrome content-script network scope](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests).

Version 0.2.1 responds to the user's readability feedback: a dark green game
background with white title/time text replaces the pale background, and the
visible badge is now `OK`. Its tooltip still explains the staffing meaning.
The staffing rules and request behavior are unchanged.

## Version 0.3.0: daily unstaffed counts

A fresh read-only homepage check confirmed 35 `.fc-daygrid-day[data-date]` cells,
118 game links, and nine overflow links in the September grid. Each day's header
is `.fc-daygrid-day-top`, containing the existing `.fc-daygrid-day-number` link.
Collapsed games remain inside the day cell in hidden `.fc-daygrid-event-harness`
elements: for example, a day with `+13 more` retained all 16 unique game links.
Only sanitized structure and aggregate counts were recorded.

The extension adds `Unstaffed: X` on the left of that header only for positive
counts; the original date link remains on the right. It aggregates unique game
IDs within each day, including hidden harnesses, and excludes cancelled games
and duplicate popover occurrences. Counts reuse the existing response map and
do not issue additional requests. Cleanup covers refresh, expiry, view changes,
missing/failed data, and rerenders.

Classification now preserves an unavailable state separately from a failed
staffing rule. Unsupported age groups/roles, malformed assignment data, and an
ambiguous extra Plate slot with no visible official suppress that day's count,
instead of contributing a false negative. The green indicator still requires
an affirmative result. Blank slots in an otherwise recognized, single-Plate
configuration continue to fail the visible-assignment criteria used by the
feature; the earlier policy-visibility caveat remains relevant.

Manifest validation and all **23 local tests** pass. Four daily-count tests cover
multiple days, zero counts, collapsed games, distinct IDs, cancelled games,
unchanged date links, duplicate prevention, unreadable data, refresh, expiry, and
leaving the month view. The native Chrome installation was not changed; final
visual placement still needs the user's reload and live-browser check.

## Version 0.4.0: expand overflow within each day

Read-only inspection confirmed that the overflow control is
`.fc-daygrid-more-link` in `.fc-daygrid-day-bottom`. Hidden games are existing
`.fc-daygrid-event-harness-abs` rows with inline `visibility: hidden` and absolute
position offsets. The enclosing `.fc-daygrid-day-events` and day frame had no
inline height limit in the inspected sample. No game content or assignment data
was changed during inspection.

The extension intercepts only plain clicks and Enter/Space on that control in
the supported month grid. A scoped CSS class reveals existing rows in normal
flow, hides the original overflow control, and adds a native Show less button.
Collapsing removes that class and button, revealing the original control again.
It does not clone game links, rewrite event content, or add network requests.
Focus moves to the first revealed game and returns to the overflow control on
collapse. Expansion survives same-month rerenders and resets on month/view
changes. It also works when staffing data is unavailable.

Manifest validation and **28 local tests** pass. Five overflow tests cover
capture of the overflow action, preserved original links/styles, no additional
reads, unchanged staffing badges/counts, Enter/Space, independent days,
rerenders, month changes, and normal behavior outside supported controls/views.
Actual expanded-row geometry and FullCalendar's live resize behavior still need
verification after the user reloads the extension in Chrome.

## Version 0.5.0: count badges and week expansion fix

The user reported that 0.4.0 revealed games over the cells below. A read-only
computed-style inspection of the signed-in homepage found the cause:
`.fc-daygrid-day-events` itself has `position: absolute` in the balanced month
grid, even though no inline height limit was present. Its frame is positioned
relative with a 100% minimum height. The enclosing table had a 570px inline
height and lived inside a fixed-height vertically scrolling calendar area.
Revealing individual harnesses alone therefore did not grow the week.

Expanded event containers now participate in normal flow. Before expansion,
the extension measures each week's height, retaining those minimum row heights
while allowing the table to grow. Later weeks move down, and the existing scroll
area accommodates the extra content. Closing the last expanded day restores
the original table layout and any previous row styles. No game links are cloned
and expansion makes no requests.

The user also reported that the new scrollbar covered Saturday's count badges.
The same inspection found cached inline pixel widths on both the day-grid body
and its table. Expanded grids now use 100% of the scroller's available content
width, leaving the scrollbar outside Saturday's cell. The synthetic fixture
includes those cached pixel widths and badges to exercise this regression.

Assignment parsing now returns both the staffing classification and the number
of distinct assigned officials. The badge displays that number instead of OK.
Unstaffed games with a positive known count receive a neutral count badge but
keep their original game background and text colors. Zero, unknown, and cancelled
games have no badge. Unknown data remains distinct from zero internally; neither
creates a false count. Daily unstaffed totals keep the same classification rules.

Manifest/syntax validation and **31 local DOM tests** pass. Added coverage checks
positive counts on both staffed and unstaffed games, distinct people, vacancies,
unknown counts, refresh from 4 to 1 to 0, and cleanup outside the active grid.
The local synthetic browser fixture passed **eleven geometry checks** in the
in-app Chromium browser: week growth, later rows moving down, preserved other
week heights, contained games and collapse controls, equal cell heights, scroll
extent, Saturday's cell and badges clear of the scrollbar, two open days sharing
a week, and original geometry restored on collapse.
This fixture uses the extension's actual overflow script and CSS with a balanced
grid reproducing the observed constraints. It makes no Assignr requests.

The revised extension was not installed or reloaded in native Chrome by the
agent. The authenticated page was inspected read-only; patched live FullCalendar
behavior still requires the user's extension reload and final visual check.

## Version 0.6.0: age before venue in game labels

A read-only inspection of all 118 calendar game links found time in its own
`.fc-event-time` node and a plain-text `.fc-event-title`. Normal titles contain
either `Venue / Sub-venue / Age / Final field` or `Venue / Age / Final field`.
Cancelled titles add a leading `* CANCELLED * /`. The observed final field was
Baseball or Softball; its value is preserved without inferring gender. Field
names can contain unspaced slashes, which are not separators.

Following the user's revision to retain sub-venue, labels now display
`Time Age / Venue / Sub-venue / Final field`, omitting sub-venue when absent.
Only the title text changes, using `textContent`. Time nodes, anchors, badges,
and cancellation prefixes are preserved. Formatting uses existing DOM data and
works independently of staffing reads. Unknown age labels, unexpected field
counts, and nested title markup remain unchanged. Original text is retained in
memory for cleanup; repeated renders do not reorder already-formatted labels,
and site text updates are observed and reformatted.

Manifest/syntax validation and the existing **31 automated tests** pass.
A separate synthetic DOM smoke check verified full and short labels,
cancellation prefixes, literal field-name slashes, time/link/badge preservation,
repeat rendering, direct text-node updates, cleanup, and no additional requests.
No extension installation, live-page modification, or assignment changes were
performed. Reload the extension and Assignr to verify the revised labels live.

## Version 0.6.1: retain minutes in displayed times

Recognizable 12-hour `.fc-event-time` text now always includes minutes and a full
am/pm suffix: `6p` and `6pm` become `6:00pm`; `6:30p` becomes `6:30pm`. This only
expands the existing displayed time; it does not convert timezones or change
game data. Other formats and nested markup remain unchanged. Time and title
formatting share the existing rerender and cleanup handling, without new requests.

Manifest/syntax validation and all **31 existing automated tests** pass. A
separate synthetic DOM smoke check verified whole hours, existing minutes,
am/pm, noon/midnight, already-complete times, unchanged other formats, title
ordering, repeated renders, direct time updates, and cleanup. No live page
changes or extension installation were performed for this update.

## Version 0.7.0: pay-scale badges in assignment dropdowns

Read-only inspection of the `/games` first page found 71 official-name links
representing 47 distinct people. The assignment rows had profile links but no
pay-scale fields. A linked profile exposed a plain two-cell `Pay Scale` row
inside `table#user-show`, with the value `1` in the inspected example. The people
directory omitted pay scale; the read-only `/pay_scales` list confirmed the names
`1`, `2`, and `3` but did not list their members. No settings or profile edits
were opened or submitted.

Following the user's suggestion, inspection then opened an existing game's
**Assign** editor without changing its selected officials or saving anything.
The Tom Select controls render selected people as `.ts-control .item[data-value]`
and candidates as `.ts-dropdown [role="option"][data-value]`. The candidate name
is the first `strong` element; selected names are in the first nested div. The
inspected dropdown had 100 rendered candidates, with an inner scrolling list.
No pay scale was found in their rendered markup or data attributes. The underlying
candidate request payload was not inspected, so its complete schema is unverified.

The feature performs profile reads only when selected names or candidates inside
the assignment editor intersect the viewport. Ordinary games-list names never
trigger requests. Results are cached once per official per document and reused
across positions and games, including badges beside matching ordinary list names.
Only exact profile values 1, 2, or 3 produce badges. Unknown or missing data produces
no badge. Native options, selections, anchors, conflict statuses, and Save/Cancel
actions are preserved. Returned profile HTML is parsed in an inert template and
never attached to the live page; visible badge text is numeric and constant.

The new module uses the existing same-origin session, rejects redirects, and
adds no host or extension API permission. Profile requests are sequential with
at least 500ms between starts, a 15-second timeout, a 2-MiB per-response cap, and
60-request/8-MiB document limits. Authentication, throttling, network, malformed
response, and timeout failures stop reads and clear cached badges; reload retries.
Missing profiles and unrecognized scale values are cached as unavailable. There
is no polling or persistent storage. Opening the full list alone makes no profile
requests. Navigation cancels outstanding reads and removes irrelevant badges.

Manifest/syntax validation and **40 automated tests** pass, including nine new
tests for parsing, request scope, on-demand visibility, deduplication, unchanged
selection values, rerenders, unavailable values, failures, cancellation, timeouts,
and request/byte caps. A synthetic dropdown with mocked profile responses passed
**ten checks** in the in-app Chromium browser using the real IntersectionObserver:
no initial reads, selected-name reads, cached list badges, visible-candidate
badges, no offscreen reads, scroll-triggered reads, deduplication, preserved native
selection, no reads after closing, and GET-only requests. Visual inspection of
that fixture confirmed small badges beside the names.

The agent did not install or reload the extension in native Chrome, select an
official, save an assignment, or change pay scales. Actual extension profile
fetches and live Tom Select compatibility still require the user's reload and
test on `/games`. The profile field was verified in the rendered DOM; its raw
initial-response availability remains subject to that live check.

## Version 0.7.1: accept the profile response's trailing comment

The user reported the pay-scale module's generic unavailable-data warning after
reloading. Read-only inspection in their authenticated Chrome Network panel
reproduced it: opening Assign made the extension fetch a profile successfully
with HTTP 200. The response ended with `</body>`, `</html>`, and then
`<!-- inside layout -->`. The 0.7.0 parser incorrectly required the closing HTML
tag to be the final non-whitespace content, rejecting this complete response.

The completeness check now ignores complete HTML comments while still requiring
the document's closing tags. The original HTML is parsed only in an inert
template. Unfinished comments and other unexpected trailing content still fail.
Warnings now include a controlled failure stage or HTTP status, never raw error
messages, profile contents, names, or URLs. Host scope and request limits are
unchanged.

A synthetic regression reproducing the observed footer failed before the fix
and passes afterward, including successful badge rendering and continued reads
for a second person. Manifest/syntax validation and all **41 automated tests**
pass. No private response bodies were saved as fixtures.

The existing installed extension was reloaded, followed by the games page, in
the user's native Chrome. Opening Assign then showed pay-scale badges for all
three selected officials; opening the dropdown also showed cached candidate
badges and fetched one newly visible person's profile successfully. Four profile
GETs returned HTTP 200, and the displayed native selections remained unchanged.
Cancel restored the ordinary game row, where the three cached badges remained.
No official was selected or assignment saved. This verifies live profile-response
compatibility for the inspected sample, beyond the earlier synthetic checks.

## Version 0.7.2: pay-scale badge before the name

Pay-scale badges are now prepended to the existing name element. A scoped inline
flex layout keeps the badge and full name together on one line in selected
assignment controls, dropdown candidates, and cached games-list links. Spacing
is after the badge; the number cannot shrink. The rule applies only to elements
containing a pay-scale badge and disappears automatically when the badge is
removed. Profile reads and native selection behavior are unchanged.

Manifest/syntax validation, all **41 existing automated tests**, and all **ten
existing browser fixture checks** pass. Visual and computed-layout inspection
in Chromium confirmed badges on the left and single-line name groups in all
three locations. This update used synthetic profiles for browser verification;
reload the installed extension and Assignr page to apply it to the live site.

## Version 0.8.0: remove the pay-scale feature

At the user's request, removed the entire pay-scale module, its manifest entry,
badge and name-layout CSS, profile-request queue, cache, feature-specific tests,
and browser fixture routes. The shared bounded reader remains internal to the
calendar data reader. The README now describes only the current calendar
features; the 0.7.x records above remain as historical evidence.

The calendar's staffing colors, umpire-count badges, daily unstaffed totals,
inline week expansion, title ordering, and full time display remain in place.
Reload the extension and all open Assignr tabs to unload any already-injected
pay-scale code. This removal requires no new permissions or site requests.

Manifest/file/syntax validation and all **31 remaining automated tests** pass.
A source/reference scan found no remaining pay-scale implementation or fixture
references in the extension, scripts, or tests. The installed extension was not
reloaded and the live site was not changed during this removal.

## Version 0.8.1: shorter calendar time suffixes

Calendar times now use `a` and `p` instead of `am` and `pm`, retaining minutes:
`6:00pm` becomes `6:00p`, `9:30am` becomes `9:30a`, and `6p` becomes `6:00p`.
The existing formatter still accepts both input suffix forms, leaves unknown
formats alone, and handles dynamic calendar updates. This is a text-only change;
game times, timezones, and requests are unchanged.

Manifest/syntax validation and all **31 existing automated tests** pass. The
installed extension was not reloaded; reload it and the calendar to apply this
display change.

## Version 0.9.0: pending-request R badge (October 1, 2026)

Read-only inspection of the authenticated Pending Requests list found seven
games, each with at least one assignment-position icon carrying both `fa-hand`
and `fa-color-success`. The first page of the ordinary displayed-range games
list contained 40 cards, including one of these requested games with the same
marker. A game detail page confirmed that the marker can accompany an occupied
or unassigned slot. `fa-circle-question` appeared separately for unconfirmed
assignments and is not treated as a request. Only rendered DOM was inspected;
private response bodies were not saved or added to fixtures.

The existing bounded, paginated staffing reader now also extracts this marker.
The calendar displays a single amber R with the tooltip and accessible label
"Pending umpire requests", after any numeric assignment badge or by itself.
Request status is independent of staffing classification, so the game's existing
background, count, and staffing rule remain unchanged. Cancelled games and
unavailable request data have no R. One positively identified slot is sufficient,
even if another slot cannot be interpreted. Indicators share the existing refresh,
expiry, navigation, and failure handling. No endpoints, requests, permissions,
storage, or profile reads were added.

Manifest/file/syntax validation and all **34 automated tests** pass. The three
new tests cover status evidence versus unconfirmed assignments, misleading or
malformed markup, paginated shared reads, zero assignments, unknown staffing,
cancelled games, normal link behavior, deduplication, badge ordering, refresh,
expiry, navigation, and failures without polling. All **eleven browser layout
checks** pass with both count and R badges, including Saturday's scrollbar edge.
Fixtures contain only synthetic data.

The existing installed extension was reloaded in native Chrome, followed by the
authenticated October homepage calendar. All seven requested games displayed R:
one beside a count of two on a green game, one beside a count of one on a default
game, and five by themselves on games with zero assigned umpires. Saturday's
three visible R badges fit inside their cells. This confirms live response
compatibility for the inspected calendar. Expansion geometry was checked in the
synthetic browser fixture; live month navigation and live expanded-week geometry
were not retested for this release. No assignments, settings, or notifications
were changed, and no new extension was installed.

## Version 0.10.0: automatically show every calendar game

All game-bearing days in the recognized homepage month calendar now expand on
render. There is no click or remembered open/closed state: replacement cells,
new game rows, and new months expand automatically. The original links and rows
remain in place, and no additional requests are made. The + more controls are
hidden; Show less controls and click/keyboard interception have been removed.
Whole weeks still grow to fit their games, retaining the scrollbar width fix.
Expansion remains available if staffing reads fail, and leaving month view or
pagehide restores the original layout styles.

Manifest/file/syntax validation and all **34 automated tests** pass. Updated
expansion coverage checks automatic visibility classes, unchanged links and
focus, no extra reads, replacement cells, new months, page lifecycle cleanup,
unavailable staffing, and restoration of existing row styles. All **13 synthetic
browser layout checks** pass, verifying that every originally hidden row is
visible, whole weeks grow without overlap, rerenders are stable, and count/R
badges fit before Saturday's scrollbar.

A native Chrome reload was attempted, but computer use detected the user's
input before the extension was reloaded. Browser interaction stopped at that
point. This release therefore still needs the installed extension and live
calendar reloaded; live automatic expansion was not verified during this turn.
No games, assignments, settings, or notifications were changed.

## Version 0.11.0: Day and List colors and badges (October 2, 2026)

Read-only inspection of the authenticated homepage found that the Day button
selects `fc-resourceTimelineDay-view`. Its hourly timeline headers carry local
ISO timestamps in `data-date`, and game bars are `a.calendar-game` links with
an `.fc-event-main` title. The empty October 2 view and four games on October 1
were inspected. Venue/sub-venue labels occupy a separate resource column.

List selects `fc-listWeek-view`. Its games are `tr.calendar-game.fc-list-event`
rows with time, dot, and title cells; the game URL is the title cell's child
anchor. Cancelled state is on the row. Date headings have ISO `data-date` values,
and days with no games are omitted. The inspected September 27–October 3 list
had five date headings and 32 game rows. "Assign Games..." appears in a separate
`game-date` row and is excluded from game indicators. No raw private page data
was saved as a fixture, and no assignment controls were used.

Calendar discovery now recognizes these two layouts, validates their DOM dates,
and supplies each game element separately from its destination link. Day reads
one local date; List reads only the first through last displayed date, bounded
to seven days. It does not parse localized toolbar text or convert local dates
through the machine timezone. Empty views do not trigger reads. Ambiguous view
markup, malformed dates, and unsupported Week view are left alone.

All three supported views reuse the same staffing/request parser, pagination,
request limits, refresh, expiry, and failure handling. Day badges stay inside
the timeline bar; List paints staffed rows dark green with white text and puts
badges inside the existing game link. Unstaffed and cancelled games keep their
native background behavior. Native Day/List labels and times are preserved;
Month's daily totals and expansion stay scoped to Month. Switching views clears
old indicators and cancels obsolete reads. No new permission, endpoint, profile
request, credential, storage, or notification behavior was added.

Manifest/file/syntax validation and all **39 automated tests** pass, including
five new Day/List tests. All **13 Month browser geometry checks** and **13 new
Day/List browser rendering checks** pass in Chromium. The latter runs the actual
content scripts and stylesheet with synthetic markup, mocked responses, and
test-only origin/path adapters. Visual inspection confirmed readable List rows
and compact Day badges. Native Chrome activation timed out before a reload,
so live extension rendering in Day/List still needs verification after reloading
the extension and homepage. The authenticated site layouts themselves were
inspected through the in-app browser.
