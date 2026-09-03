# Ventry — Where We Are & What You Need To Do

This file exists because terminal copy/paste wasn't working for you. Open this
in any text editor (VS Code, Notepad, etc.) — not the Claude Code terminal —
and you'll be able to copy anything below normally.

---

## The short version

**All the code for 10 requested features is written and verified (compiles,
builds cleanly). It is NOT deployed yet — the live site is still running the
old code.** Your database already has most of the new schema (you ran
migrations 021–027). One more migration (028) is still pending. Below is
everything, in order, with exactly what's done vs. what you still need to do.

---

## 1. What was originally asked for (`newfeature.txt`)

10 features for the Ventry ticketing platform:
1. Flyer + wide banner split for event pages
2. Lineup with Headliner/Guest/Surprise liability tiers
3. Personalised sender identity on emails
4. Venue/date-change → 48h buyer refund window
5. Post-event reviews tied to a checked-in ticket
6. Organiser profile 2.0 (cover image, followers, ratings)
7. Restricted-audience events (email-domain gated)
8. Admin notifications by email
9. Ventry-wide affiliate/referral program
10. Venue-proof upload copy fix

All 10 were built across 9 phases. **Then you sent 4 correction requests**,
which are also done (see section 3).

---

## 2. Status of each original feature

| # | Feature | Code | Notes |
|---|---|---|---|
| 1 | Flyer + banner split | Done | Existing events unaffected until organiser opts in and uploads a banner |
| 2 | Lineup liability tiers | Done | |
| 3 | Sender identity | **Reverted per your correction** — see below | |
| 4 | Refund window | Done, **plus capped at 2 changes** per your correction | |
| 5 | Post-event reviews | Done | Old anonymous review system retired |
| 6 | Organiser profile 2.0 | Done | |
| 7 | Restricted-audience events | Done | |
| 8 | Admin email notifications | Done | |
| 9 | Affiliate program | Done, **plus public landing page** per your correction | |
| 10 | Venue-proof copy | Done | |

---

## 3. Your 4 correction requests — all done

1. **Sender identity reverted.** Ticket confirmations, reminders, and venue/date-change
   emails show the **event name** again (not the organiser's name), exactly like
   before. Organiser-name-as-sender stays only where it already existed
   (newsletters, event-announcement teasers) and for post-event review requests.
2. **Change cap added.** An event gets 2 free organiser-made venue/date changes.
   The 3rd+ needs your approval first — nothing applies and no buyer is emailed
   until you approve it in the new admin page.
3. **Cron jobs restructured** for your Vercel Hobby plan (see section 5 — this
   needs action from you).
4. **Affiliate program made discoverable** — public landing page, footer link.

---

## 4. What you need to do — IN ORDER

### Step 1 — Run one more migration
You already ran 021 through 027. One more is needed for the change-approval cap:

```
supabase/migrations/028_event_change_requests.sql
```

Open it, copy the contents, paste into Supabase SQL Editor, run it. (Same
process as before — it's idempotent, safe even if run twice.)

### Step 2 — Set the CRON_SECRET environment variable in Vercel
This didn't exist before, which meant your cron endpoints had **no
authentication at all**. I generated one and put it in your local
`.env.local`. You need to add the SAME value in Vercel:

Vercel dashboard → your project → Settings → Environment Variables → Add:

```
Name:  CRON_SECRET
Value: 695c9ee9ed8d33a14820181b2ed94ef2e0c67423c66b7ead4c68295c64f77607
```

(You can generate your own different value instead if you prefer — just make
sure it's the exact same string in Vercel AND in cron-job.org in Step 3.)

### Step 3 — Set up cron-job.org (free) for all 4 scheduled jobs
Your Vercel plan (Hobby) can't run these on its own built-in cron anymore —
max 2 jobs, once a day only. All 4 now need to run through an external
service instead. Go to **cron-job.org**, make a free account, and create
4 jobs exactly like this:

| Job title | URL | Schedule |
|---|---|---|
| Ventry Reminders | `https://www.ventrybooking.com/api/cron/reminders` | Every day, 08:00 |
| Ventry Reconcile Orders | `https://www.ventrybooking.com/api/cron/reconcile-orders` | Every 5 minutes |
| Ventry Complete Events | `https://www.ventrybooking.com/api/cron/complete-events` | Every day, 08:30 |
| Ventry Admin Digest | `https://www.ventrybooking.com/api/cron/admin-digest` | Every hour |

For **every one of the 4 jobs**, also do this:
- Request method: `GET`
- Under "Advanced" (or "Headers"), add a custom header:
  - Header name: `Authorization`
  - Header value: `Bearer 695c9ee9ed8d33a14820181b2ed94ef2e0c67423c66b7ead4c68295c64f77607`
  (same secret as Step 2, with the word `Bearer` and a space in front of it)

After saving each job, cron-job.org lets you "Run now" to test — it should
show a response like `{"success":true,...}`. If it shows `{"error":"Unauthorized"}`,
the header value doesn't match what's in Vercel — double check Step 2.

### Step 4 — Free up disk space on this machine
Your C: drive was down to ~1.8GB free, which made builds fail. I cleared
439MB of stale build files to get you to ~2.3GB, but that's still tight.
Free up more space before doing more work here.

### Step 5 — Decide: commit and deploy
**Nothing new is live yet.** All the work above is sitting as uncommitted
changes on this machine. The site at ventrybooking.com is still running the
OLD code. When you're ready:
- I can commit everything (I haven't — I only commit when you tell me to)
- Then you (or I, if you want) push/deploy however your pipeline normally works
- After that, the migrations you already ran will finally have matching code live

---

## 5. Exact URLs (once deployed)

| Page | URL |
|---|---|
| Affiliate program explainer (public) | `/affiliates` |
| Affiliate sign up | `/affiliate/register` |
| Affiliate log in | `/affiliate/login` |
| Affiliate dashboard | `/affiliate/dashboard` |
| Admin: pending change requests | `/admin/change-requests` |
| Admin: reviews moderation | `/admin/reviews` |
| Admin: affiliates | `/admin/affiliates` |

## 6. All migrations, for reference

Already run by you: `021_flyer_banner.sql`, `022_venue_date_change_refunds.sql`,
`023_ticket_based_reviews.sql`, `024_organizer_profile_cover.sql`,
`025_restricted_audience_events.sql`, `026_admin_notification_emails.sql`,
`027_platform_affiliates.sql`.

Still pending: `028_event_change_requests.sql` (Step 1 above).

All migration files live in `supabase/migrations/` in this project.
