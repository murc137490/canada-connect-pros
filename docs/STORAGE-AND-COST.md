# Storage and cost (100–200 clients, 100–200 pros)

## Can you keep everything in Supabase?

**Yes.** All app data (profiles, pros, bookings, reviews, etc.) can live in Supabase. You don’t need a separate database.

---

## Rough data size (GB)

For **~100–200 clients** and **~100–200 pros** (400 users total) using the app each month:

| What | Rough size |
|------|------------|
| **Database** (profiles, pro_profiles, bookings, reviews, services, etc.) | **~5–50 MB** |
| **Storage** (pro photos, review photos, documents) | Depends on uploads; **~0.5–2 GB** if each pro has a few photos |
| **Total** | **Well under 5 GB** in normal use |

- Each row (profile, booking, review) is on the order of **kilobytes**.
- 400 users × a few KB each ≈ a few MB.
- Thousands of bookings and reviews still only add tens of MB.
- The bulk of storage is **files** (images, PDFs) in Supabase Storage, not the database.

So you’re talking about **low single‑digit GB** for 100–200 clients and 100–200 pros, unless you store a lot of large files.

---

## Supabase

- **Free tier:** 500 MB database, 1 GB file storage. Enough to try things; may be tight at 200 pros with many photos.
- **Pro (~$25/month):** 8 GB database, 100 GB storage. More than enough for 100–200 clients and 100–200 pros.
- You can keep all this information in Supabase and scale with their plans.

---

## Keeping data on a hardware SSD (self‑hosting)

- **Technically possible:** You could run Postgres + file storage on your own server (e.g. with Supabase self‑hosted or plain Postgres + S3‑compatible storage on an SSD).
- **In practice:** You’d need to maintain the server, backups, and (if you use Supabase Auth) either keep using Supabase in the cloud or replace auth. For 100–200 users, **using Supabase (or another managed cloud) is usually simpler and not much more expensive** than running your own hardware.

---

## Approximate monthly cost (100–200 clients, 100–200 pros)

| Option | Approx. monthly cost | Notes |
|--------|----------------------|--------|
| **Supabase Pro** | **~\$25** | Database + auth + storage; enough for this scale. |
| **Supabase Free** | **\$0** | Possible for light use; 500 MB DB / 1 GB storage can be limiting. |
| **Vercel/Netlify (frontend)** | **\$0–20** | Free tier often enough; paid if you need more. |
| **Square** | Per transaction | No fixed monthly for the basics; you pay per payment. |
| **Resend (email)** | **\$0–20** | Free tier is generous; paid if you send a lot. |
| **Rough total** | **~\$25–65/month** | Supabase Pro + optional hosting/email upgrades. |

So for **~100–200 clients and ~100–200 pros per month**, you can expect:

- **Data:** A few GB total in Supabase (DB + storage).
- **Cost:** Roughly **\$25–65/month** if you use Supabase Pro and common SaaS tools, with most of the data and cost in Supabase and optional extras (hosting, email).

You can keep all the information in Supabase; you don’t need to move it to a hardware SSD unless you have a specific reason to self‑host.
