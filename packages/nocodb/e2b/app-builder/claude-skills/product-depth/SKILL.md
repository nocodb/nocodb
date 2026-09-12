---
name: product-depth
description: Read BEFORE planning any new app or screen. Turns a one-line request into the set of screens a real product needs — who uses it, what each of them opens it to find out — and the interactions that make it usable (kanban drag-and-drop, pagination, search/filter/sort in the URL, bulk actions, editable detail routes, per-person workload).
---

# Product depth

The request names a **domain** ("a project tracker"), not a screen. Your job is to work out what that
domain is for the people in it, and build that — not the first table that satisfies the sentence.

The failure this skill exists to prevent: a single screen listing every record, with counts nobody
asked for, no way to see your own work, and nothing you can actually do to a row.

## 1. Name the people before you name the pages

Every business domain has at least three vantage points. Write them down for this request, then check
each one has a screen that answers its question:

| Who | Opens the app to find out | Which means |
|---|---|---|
| The person doing the work | "What's on me? What's next? What's late?" | A **"my work"** view — their items, soonest first, status changeable in one click |
| The manager / lead | "Who's overloaded? What's blocked? What's slipping?" | **Per-person workload**, exception cuts (overdue, unassigned, blocked), reassignment |
| The head / owner | "Are we on track? Where's the risk?" | **Rollups** by project / stage / team, with trend — not row-level noise |
| Whoever files the work | "Get this in fast, find it later" | A create form that isn't a chore, plus search |

Two or three of those views, each doing its job, beat one screen with everything on it. If the domain
genuinely has one kind of user, build one focused app and say so — but a tracker, CRM, inventory,
helpdesk or pipeline **always** has at least the *mine* view and the *everyone's* view.

**These map onto the app's teams.** Where the roles are real, create them (`create_team`), grant each
the actions it needs, and shape the UI with `ctx.teams` / `ctx.can()` — see CLAUDE.md → Teams. The
server enforces the grant regardless of what the UI drew, so hiding a control is courtesy, not a
boundary.

## 2. Aggregate by the thing a human asks about

"How many tasks exist" is trivia. "How many are on Priya, and how many of those are late" is the
question the manager came for.

Any list of work owned by people needs a **per-assignee cut** — a table of
`person · open · overdue · next due`, or the board grouped by assignee. Any list with a lifecycle
needs a **per-stage cut**. Build the cut that answers the question, not the count that fills a card.

Exceptions are the reason people open the app at all: **overdue, blocked, unassigned, over capacity,
stale**. Each one gets a filter, a visible count, and a tinted row — never something the user has to
find by reading.

## 3. Build the interactions, not the read-only version

Match these to the domain; skip the ones it doesn't imply, but don't skip them all.

**Direct manipulation** — a board means dragging. The browser's own drag events are enough:

```tsx
<div draggable onDragStart={e => e.dataTransfer.setData("id", task.id)} />
<div onDragOver={e => e.preventDefault()}
     onDrop={e => move(e.dataTransfer.getData("id"), "in_progress")} />
```

The drop writes the new status through an action — move the card **immediately**, revert with a toast
if the write fails. Ship a keyboard path to the same change (a status `Select` on the card or in its
detail) so the board works without a mouse. See the `motion` skill for how it should move.

**Pagination** — past ~50 rows use the vendored `Pagination` (or "load more"), show the **total**, and
keep page + size in the URL. Silently rendering 500 rows is a bug.

**Search, filter, sort — in the URL.** Text search, the two or three filters that matter (status,
assignee, date range), sortable numeric and date columns. Keep it all in `useSearchParams()` so a
filtered view is a link a manager can send:

```tsx
const [params, setParams] = useSearchParams()
const status = params.get("status") ?? "all"
```

**Bulk actions** — row selection plus reassign / change status / close, once a screen exists that
someone uses to triage many items at once.

**Detail routes that edit** — `/tasks/:taskId` shows the record *and* changes it (assignee, status,
dates, notes). A read-only detail page is a dead end.

**Create that isn't a chore** — the primary action on the list screen opens a `Dialog` (short) or
`Sheet` (long), pre-filled from context: creating a task from a project page already knows the
project.

## 4. Definition of done

Before you say it's built, check every line:

- [ ] Each kind of user from step 1 has a screen that answers their question
- [ ] There's a "my work" view, not just an everyone-list
- [ ] Work owned by people is aggregated **per person** somewhere
- [ ] Overdue / blocked / unassigned are visible as filters **and** counts, and stand out in the list
- [ ] Every list of any size: search, the filters that matter, sortable columns, pagination with a total
- [ ] That state lives in the URL
- [ ] The board (if there is one) supports drag, and a keyboard path to the same change
- [ ] Every record has a detail route that can edit it
- [ ] Create and edit exist for every entity the user named
- [ ] Nothing is a dead end: every row leads somewhere, every empty state offers the next action
- [ ] Anything the domain sends **outside** the base — notify the assignee, email the customer, put
      the deadline on a calendar, sync to another system — is an integration action, not a column
      (see CLAUDE.md → Reaching outside the base). If nothing suitable is connected, say what's needed

Anything unticked is either deliberately out of scope — say which and why in your reply — or not done.
