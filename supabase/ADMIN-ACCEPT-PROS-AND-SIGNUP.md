# Accept Pro Accounts & Email Signup (Supabase)

Use the steps below to allow normal (client) signups with email verification and to accept pro accounts from the Supabase Dashboard.

---

## 1. Allow normal accounts to sign up (email verification)

No SQL needed. Configure in the Dashboard:

1. Open **Supabase Dashboard** → your project.
2. Go to **Authentication** → **Providers** → **Email**.
3. Set:
   - **Enable Email Signup**: **ON** (so new users can create accounts).
   - **Confirm email**: **ON** if you want users to verify their email before signing in (recommended). When ON, Supabase sends a confirmation email; the user must click the link to confirm.
4. (Optional) Under **Authentication** → **Email Templates**, edit **Confirm signup** to customize the verification email.
5. Save.

Result: New users can sign up with email; if “Confirm email” is ON, they must verify before they can log in. You don’t need to “accept” normal accounts—they’re allowed once they sign up (and confirm, if enabled).

---

## 2. Accept pro accounts (make them visible to clients)

Pros are stored in `public.pro_profiles`. The app only shows pros where `is_verified = true`. To accept a pro, set `is_verified = true` for their row.

### Option A: Supabase Dashboard (Table Editor)

1. Go to **Table Editor** → **pro_profiles**.
2. Find the row for the pro (e.g. by **business_name** or **user_id**).
3. Click the **is_verified** cell and set it to **true**.
4. Save.

### Option B: SQL in Supabase (SQL Editor)

**List all pros and their verification status (to see who is pending):**

```sql
SELECT
  pp.id,
  pp.user_id,
  pp.business_name,
  pp.is_verified,
  pp.created_at,
  p.full_name,
  au.email
FROM public.pro_profiles pp
LEFT JOIN public.profiles p ON p.user_id = pp.user_id
LEFT JOIN auth.users au ON au.id = pp.user_id
ORDER BY pp.created_at DESC;
```

**Accept one pro by their email address:**

```sql
-- Replace 'pro@example.com' with the pro's signup email
UPDATE public.pro_profiles
SET is_verified = true, updated_at = now()
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'pro@example.com');
```

**Accept one pro by their user_id (UUID):**

```sql
-- Replace the UUID with the pro's user_id from pro_profiles or auth.users
UPDATE public.pro_profiles
SET is_verified = true, updated_at = now()
WHERE user_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

**Accept one pro by business name:**

```sql
-- Replace 'ABC Plumbing' with the pro's business name
UPDATE public.pro_profiles
SET is_verified = true, updated_at = now()
WHERE business_name ILIKE '%ABC Plumbing%';
```

**Accept all pending pros (use with care):**

```sql
UPDATE public.pro_profiles
SET is_verified = true, updated_at = now()
WHERE is_verified = false;
```

---

## 3. Optional: “Pending pros” view (SQL)

Run this once in **SQL Editor** to create a view that lists only unverified pros (handy for review):

```sql
CREATE OR REPLACE VIEW public.pending_pros AS
SELECT
  pp.id AS pro_profile_id,
  pp.user_id,
  pp.business_name,
  pp.created_at,
  p.full_name,
  au.email
FROM public.pro_profiles pp
LEFT JOIN public.profiles p ON p.user_id = pp.user_id
LEFT JOIN auth.users au ON au.id = pp.user_id
WHERE pp.is_verified = false
ORDER BY pp.created_at DESC;
```

Then in **Table Editor** you can open **pending_pros** to see who’s waiting. To accept a pro, use their `user_id` in the “Accept one pro by user_id” query above, or switch to the **pro_profiles** table and set `is_verified = true` for that row.

---

## Summary

| Task | Where | Action |
|------|--------|--------|
| Allow client signups | Auth → Providers → Email | Enable Email Signup = ON |
| Require email verification | Auth → Providers → Email | Confirm email = ON |
| Accept a pro (make visible) | Table Editor or SQL | Set `pro_profiles.is_verified = true` for that pro |
| See pending pros | SQL or view | Use the “List all pros” query or the `pending_pros` view |
