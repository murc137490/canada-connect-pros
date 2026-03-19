# Connect Supabase to Amazon SES (use premiereservicescontact@gmail.com)

Supabase can send transactional email (confirm signup, magic link, password reset, etc.) through **Amazon SES** instead of the default provider. To have everything go through **premiereservicescontact@gmail.com**:

---

## 1. Amazon SES setup

1. **AWS Console** → **Amazon SES** → **Verified identities**.
2. **Create identity** → **Email address** → enter **premiereservicescontact@gmail.com**.
3. SES sends a verification email to that address; **verify it** (click the link in the inbox).
4. If the account is still in **Sandbox**, request **production access** in SES so you can send to any address (not only verified ones).
5. **Create SMTP credentials** (SES → **SMTP settings** → **Create SMTP credentials**). AWS will generate a **username** and **password** for you — you do **not** choose these yourself. After creation, download or copy them; the password is shown only once.

---

## 2. What username and password to set in Supabase

**You don’t invent these.** AWS creates them when you click “Create SMTP credentials” in SES:

- **Username:** The value AWS shows as **SMTP username** (often starts with something like an access key).
- **Password:** The value AWS shows as **SMTP password** (the secret that appears only once — copy it and store it safely).

Use that exact **username** and **password** in Supabase (see table below). They are for SMTP only, not your AWS console login or your Gmail password.

---

## 3. What to enter in Supabase

In **Supabase Dashboard** → your project → **Project Settings** → **Auth** → **SMTP Settings** (or **Email** / **Custom SMTP**):

| Setting | What to use |
|--------|-------------------------------|
| **Sender email** | `premiereservicescontact@gmail.com` |
| **Sender name** | e.g. `Premiere Services` |
| **Host** | `email-smtp.<region>.amazonaws.com` (e.g. `email-smtp.us-east-1.amazonaws.com` — use the region where you use SES) |
| **Port** | `587` (TLS) or `465` (SSL) |
| **Username** | The **SMTP username** AWS gave you when you created SMTP credentials |
| **Password** | The **SMTP password** AWS gave you when you created SMTP credentials |

Enable **Custom SMTP** and save. Supabase will then use this for all auth-related emails (confirmation, password reset, magic link, etc.) and they will appear as sent from **premiereservicescontact@gmail.com**.

---

## 4. Optional: custom domain

If you want “From” to be e.g. `noreply@premiereservices.ca`:

- In SES, add and verify the domain **premiereservices.ca** (add the DNS records SES gives you).
- In SES, create an identity for **noreply@premiereservices.ca** (or another address on that domain).
- In Supabase SMTP settings, set **Sender email** to that address (e.g. `noreply@premiereservices.ca`).

The SMTP host, port, username, and password stay the same (SES SMTP credentials work for any verified identity in that AWS account).

---

## 5. Summary

- **Verified identity in SES:** `premiereservicescontact@gmail.com` (or your domain address).
- **Supabase:** SMTP enabled with SES host, port 587, and the SES SMTP username/password; sender email = **premiereservicescontact@gmail.com**.
- After that, Supabase auth emails are sent through that address.
