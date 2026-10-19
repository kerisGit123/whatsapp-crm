# Plan: simplify Rent Ledger, Rentals and Records (for a beginner staff member)

Written 2026-10-17 from three code reviews plus a look at the live site. Everything marked CONFIRMED was traced in the code.
Live data today is test data only (1 property, 1 ended tenancy, 20 payments of which 17 are VOID), so nothing here needs a data migration.

## What a new staff member must be able to do (the only goals)
1. A tenant paid: record it, send the receipt. (2 taps)
2. A new tenant moves in: one form. (1 screen)
3. A tenant leaves: end the tenancy, return the deposit. (1 screen)
4. Find a file: "the agreement for Unit 3". (2 taps)
Everything else is hidden under "More".

## The big finding
The production server runs WITHOUT a worker, so every behaviour that lives in background/db-event functions never happens there:
property Occupied/Vacant never changes, renewals get no name, contracts made in the raw table never fill rent/deposit/owner, a new member's Personal business was only created by a job.
Fix: do those things inside the page routes (the code that runs when a button is pressed), not in triggers.

## Phase 0 - fix real bugs first (no redesign, about 1 day)
Rent Ledger
- Failed send leaves a receipt issued but the ledger says unpaid; retry then blocks with "already paid" (CONFIRMED). Reload after any attempt, say "saved, not sent".
- "Record Oct" button actually picks the oldest unpaid month (wrong-month risk). Default to the current month.
- Past months default to a back-dated receipt. Date the receipt today unless "More options" is opened.
- Spread-to-next-months can fail silently and report success with an empty list. Show a preview and check each result.
- Totals flash wrong while a period loads, and slow clicks can show the wrong period. Clear data on change, ignore old responses.
- Range mode silently caps at 24 months; "to before from" shows stale data.
- "21th / 22th / 23th" ordinals. Catch-up defaults differ from the single panel and cannot spread.
- Ledger shows RM 0 when a contract has no rent but the property has one (server uses the fallback).
Rentals
- Property never becomes Occupied/Vacant after make/move-out/renew (needs worker). Call the sync from the routes.
- Renewal: no date checks, no name, old contract never ended when the new one starts later; deleting a renewal strands the old contract and its carried deposit.
- depositStatus never becomes HELD when the deposit is received (table and property page say "Not received").
- Failed deposit receipt at create is skipped but the toast says "Contract made".
- Deposit settlement allowed on an ACTIVE tenancy; refund never recorded as money out.
- End date wrong for start days 29-31 (31 Aug + 6 months gives 2 Mar).
- Tenant search matches first OR last name only; full name finds nothing; non-admins cannot find an existing person, so duplicates are created.
Records
- "update" lets you attach a document to another business's property (scope leak). Check scope.
- Delete message says "restore from Records > Documents" but that page has no restore.
- One-click x on a file has no confirm/undo; last file removed leaves an empty document.
- Auto-typing breaks on underscores (IC_Ahmad.pdf becomes Misc); "sewa" always Agreement, "sijil" always Stamp duty, "bank" always Loan.
- HEIC shows as a broken image on desktop; thumbnails load the full 20 MB originals.
- Orphan files when the document create fails; duplicates on re-drop; 20-file wall with no way out on a contract.
- Expiry copy says 30 days, Today uses 60, WhatsApp uses 30.

## Phase 1 - Rentals: one page, three buttons
Today: folder "Rentals" = Properties (raw table) + Contracts (page) + Payments (raw table). The same thing is called Rentals / Contracts / Tenancy / Agreement; a business is called workspace / business / owner.
Do:
- Rename everything to "Tenancy" for the agreement and "Property" for the unit. One word each, everywhere (buttons, toasts, errors, field labels; the field label "Workspace" on owner relations was missed by the earlier rename).
- Replace the Rentals folder with ONE page "Properties": a card per property = name, rent, Vacant/Occupied badge, tenant, next rent due. Buttons: "New tenancy", "Tenant moved out". Raw tables stay reachable under Setup > Advanced only.
- New tenancy sheet: property, tenant (search by full name or phone), start date, rent, deposit. "Deposit received" defaults ON when a deposit is typed. Utility deposit, due day, stamp, rent increase fields go under "More".
- Move out sheet: date, deductions, refund amount, "refunded on". On confirm it creates a real refund row so cash out is traceable. Refuse on an ACTIVE tenancy until moved out.
- Remove nags that a small landlord ignores (Missing: IC / inventory / photos on every card, six deposit states).

## Phase 2 - Rent Ledger: month view first
- Open on the current month as big rows: tenant, amount, "Paid / Not paid / Late". Year grid becomes a secondary tab.
- One primary action per row: "Record payment". Panel shows only amount, "Paid today?", method. Everything else under "More options".
- Button "Save receipt" first; "Send to tenant" is a second step on the result (sending is irreversible). If email/WhatsApp is not configured, say so in red instead of a green toast.
- Plain words: Waive = "Tenant doesn't pay this month" (inside a menu); Correct receipt = "Wrong amount? Cancel this receipt" with a confirm saying the tenant already has it; Catch-up = "Record several months"; Void = Cancelled; Spread = "Pay next months too" with a preview "RM1,500 -> Oct, RM1,500 -> Nov. OK?".
- Cards: "Rent for Oct: paid / still unpaid / late" (replace Collected / Still to collect / Overdue, which count by rent month and include future months).
- Hide the statement-letter fields (registration no., address, template) behind Advanced.

## Phase 3 - Records as a Drive
Today: Documents page (type chips + property filter) plus raw People / Tasks / Notes under "Records".
Do:
- Rename folder to "Files". Left: property folders (Unit 3, Unit 5, Business, Personal) each with Agreement / ID / Bills / Insurance / Photos subfolders; breadcrumbs on top; Recent at the top.
- Show a property's files on the property card and the agreement on the tenancy row (2 taps from anywhere).
- Rows: inline rename, select several then move / delete, sort, download, storage used (x of 200 MB for free accounts), undo toast on delete, Trash view with Restore.
- Upload: per-file progress, retry button, duplicate check, choose property and type before dropping; fix auto-typing.
- Rename People to "Tenants". Hide Tasks and Notes (or turn them into reminders on Today).

## Order of work and cost
1. Phase 0 (bugs) - safe, small, ship first.
2. Phase 2 (ledger) - most-used screen.
3. Phase 1 (properties/tenancy page).
4. Phase 3 (files).
Constraints: publishing to Railway currently fails most attempts from this PC (storage upload timeouts, server 502 under load). Best done by running locally and publishing in one go, or after the Railway memory problem is solved.
