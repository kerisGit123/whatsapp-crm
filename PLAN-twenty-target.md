# Plan: Twenty is the target

Decided 2026-10-14. Twenty (D:\gemini\twenty-crm, rental app + F&B stock) stays the main system.
The shop-app branch of whatsapp-crm is parked, not deleted.

## 1. What is where
| Thing | Where | State |
|---|---|---|
| Twenty server / worker / front | your PC: ports 3200 / (worker) / 3201 | started 2026-10-14 |
| Twenty database | Neon project wispy-sky, database `twenty` | live, untouched |
| Files | Cloudflare R2 bucket whatsapp-crm, prefix app/ | live |
| Redis | Railway "Redis" service (public TCP proxy) | online, keep |
| Railway `twenty` service | crashed, repo branch disconnected (no auto-deploy) | parked |
| Shop app (stock, orders, requests, Excel, CRM, Money, team) | branch `shop-app`, commits up to d2f3f32 | parked, builds clean, own Neon DB |

Never run two Twenty servers on the same database (PC + Railway at the same time).

## 2. Where Twenty runs: decide by test, in this order
A. **PC (now).** Free. Needs the PC on and the Cloudflare tunnel for phones. Start order: front, then server, then worker.
B. **Railway Hobby (US$5/mo, your payment).** Only to find out if 1 GB was the crash cause. Steps: Subscribe > Hobby; reconnect branch (Settings > Source) or "Deploy latest"; watch for "Starting Container" then log lines; open https://twenty-production-d8ec.up.railway.app/healthz. If it answers: set Google redirect URI + origin and R2 CORS for that address (see section 4), stop the PC server, use the phone. If it still dies with 8 GB: go to C.
C. **Small VPS (2-4 GB, ~US$6-12/mo).** Same image as Railway; more setup. Only if B fails.
Stop condition: do not spend more than one evening on hosting; stay on A.

## 3. Work still open in Twenty
1. Try the stock module on the phone for a week; list what is confusing (nothing changed since the phone-card layouts).
2. Twilio / WhatsApp: sandbox works; real sender setup needs the permanent address from step B/C.
3. First page load ~15 s because the database is remote (Neon). Option: Neon region/pooler check, or accept.
4. Staff login test with a second Google account (staff limits: no prices, no deleting).
5. Back-ups: Neon point-in-time restore is on; export stock monthly with the Excel buttons.
6. Rentals/receipts/expenses are already built in Twenty; no rebuild needed.

## 4. When a hosted address exists
- Google Cloud > OAuth client: redirect URI `https://<address>/auth/google/redirect`, JS origin `https://<address>`.
- Cloudflare R2 > whatsapp-crm > CORS: add origin `https://<address>` (GET, PUT, HEAD).
- Twilio webhook URL: `https://<address>/...`.

## 5. Security tidy-up (do soon, 15 minutes)
- Rotate: the old app's Neon password and the keys that were pasted in chat (StartupKit .env.local contents). Update only the apps that use them.
- Delete D:\gemini\railway-setup\PASTE-INTO-RAILWAY-then-delete.txt (holds 6 secrets).
- Keep `.env` files out of git (already ignored).

## 6. What to do with the shop app
- Keep the branch. If Twenty hosting works, nothing more is needed.
- Reuse candidates if wanted later: Excel export code, the Money/expense categories, team/workspace pages.
- Do not push it or deploy it unless you decide to.
