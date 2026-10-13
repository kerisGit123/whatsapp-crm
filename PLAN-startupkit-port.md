# Plan: move the shop software from Twenty to a StartupKit fork

Status: PLAN ONLY. Nothing has been changed in any project. Twenty on the PC keeps running the whole time.

## 1. Goal
Run the shop's CRM + Stock (+ later rentals) on Vercel, cheaply, without Twenty's always-on server, Redis and worker.

## 2. What we measured (so the plan is not guesses)
| Thing | Size | Notes |
|---|---|---|
| Twenty rental app (all of it) | ~45,600 lines, 328 files | rentals, receipts, contracts, campaigns, documents, rent ledger, expenses, today page, stock |
| Stock module only | ~8,700 lines | `shared/stock*.ts` (~1,900 lines of pure rules + Excel), `stock-route.ts` + csv route (~1,500), screens (~5,300) |
| whatsapp-crm (current Next.js app) | ~1,800 lines | contacts, WhatsApp chat, stages, invoices + PDF, 4 tables |
| StartupKit | 11 GB folder, 75+ Neon tables | AI video SaaS; has Clerk login, workspaces (owner / member / clerk roles, invites), Neon + Drizzle, R2, Stripe billing, admin, Vercel deploy, QC hooks |

Key facts:
- Pure rules (`stock.ts`, `stock-orders.ts`, `stock-requests.ts`, `stock-alerts.ts`, Excel builders/readers) have no Twenty dependency and can be copied almost as-is (~1,900 lines).
- The screens are written for Twenty's sandbox (remote-dom, inline styles, no window.confirm). They need re-skinning to normal React/shadcn, but the layouts, wording and flows (simple view, quick entry, stock take, order sheet, phone cards) are reusable as a spec.
- `stock-route.ts` (1,310 lines) is the data layer. It must be rewritten against Drizzle/Neon tables instead of Twenty REST.
- whatsapp-crm is small enough to port in a few days.

## 3. Decision: fork StartupKit, or add a new lean app?
Option A - fork StartupKit and delete the AI-video parts.
  + Login, workspaces, roles, invites, R2, billing, admin, deploy already work and are known to you.
  - 11 GB, 3 systems (Clerk, Convex, Neon). Must strip or hide AI-video routes; slower builds; QC gate is heavy (~4 GB RAM).
Option B - new lean Next.js app (start from whatsapp-crm), copy only login/workspace code from StartupKit.
  + Small, fast, cheap, easy to understand. Uses Clerk + Neon only (no Convex).
  - Re-do the workspace/roles pieces (but copyable: 3 tables + helpers).
Recommendation: B-shaped fork. Start from whatsapp-crm (already Next.js + Clerk + Neon + Twilio), and copy in StartupKit's workspace/member/invite tables and helpers, R2 upload code, and QC hooks. Gets "StartupKit know-how" without the AI-video weight. If you still prefer a true fork, steps below are identical; only Step 0 differs (delete routes instead of copying in).

## 4. Mapping Twenty concepts to the new app
| Twenty | New app |
|---|---|
| Workspace (rental owner company) via owner column + sidebar switcher | `workspaces` row + `companyId` on every table; sidebar switcher = workspace switcher |
| Staff wall (staff role hides objects) | `workspace_members.role` = owner / manager / staff; server checks per action |
| stockItem, stockMovement, stockOrder, stockRequest | Drizzle tables with `workspace_id`, soft delete (`deleted_at`) |
| Twenty route functions (`stock-route.ts` actions) | Next.js route handlers / server actions, same action names |
| Excel import/export | same `xlsx` code, served from route handlers |
| 30-min app token renewal | not needed (Clerk session) |

## 5. Phases (each ends with something you can use)
Phase 0 - Setup (1-2 days)
  - New repo from whatsapp-crm; add workspace tables + roles from StartupKit; sign-in; sidebar with workspace switcher; deploy to Vercel on a preview URL. Neon: new database/branch, NOT the Twenty one.
Phase 1 - Stock core (about 1 week)
  - Tables: stock_items, stock_movements, stock_orders (+lines), stock_requests, settings. Copy pure rules and tests.
  - Screens in this order: On hand (simple view + cards on phone), Quick entry, Stock take, History.
  - Data migration script v1: read Twenty (Company A test stock first), write to new tables; compare counts and totals.
Phase 2 - Stock completeness (about 1 week)
  - Orders (new/edit, receive, WhatsApp text, delivery note), Requests (branch lend/return/short), Month-end, Alerts + Today widget, Excel import/export, expiry/waste reasons, price-rise warning.
  - Staff limits and average cost; side-by-side check against Twenty with the same data.
Phase 3 - WhatsApp CRM (2-3 days)
  - Copy contacts, chat, stages, invoices + PDF + "Send via WhatsApp" (already Next.js). Twilio webhooks need the permanent Vercel address.
Phase 4 - Rentals and the rest (decide later; biggest block, ~35k lines in Twenty)
  - Rent ledger, contracts, receipts, campaigns, documents, expenses. Port only what the shop actually uses weekly; drop the rest.
Phase 5 - Switch-over
  - Freeze Twenty (read-only), final migration, point staff to the new address, keep Twenty PC copy for 30 days, then stop it. Never two servers writing to one database.

## 6. Risks and how we handle them
- Rebuild takes longer than planned: ship Phase 1 alone first; Twenty stays authoritative until each phase is verified.
- Data drift during migration: run the migration twice (test, then final), compare item counts, on-hand totals, order totals.
- Staff confusion: keep wording and screen order identical to what they use now.
- Secrets: new app gets its own env; the exposed keys flagged earlier should be rotated before go-live.
- Scope creep: no new features until Phase 2 parity is reached.

## 7. Cost
- Vercel Hobby/Pro + Neon + R2 + Clerk free tiers are usually enough for under 10 users; expect a few dollars a month at most. Railway Hobby ($5/mo) is no longer needed except for Twenty during the transition (optional).

## 8. Decisions needed from you before Phase 0
1. Option B-shaped fork (recommended) or full StartupKit fork?
2. Is rentals (Phase 4) still needed, or only Stock + WhatsApp CRM?
3. Clerk for staff login (matches StartupKit), or Google sign-in only?
4. Start Phase 0 now, or first try Railway Hobby for a few days as a fallback?
