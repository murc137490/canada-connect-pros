# SQL scripts – run order

Run in **Supabase Dashboard → SQL Editor** (one block at a time or as needed).

1. **First time setup**
   - `RUN-THIS-ONCE-CREATE-TABLES.sql` – main schema (profiles, pro_profiles, services, reviews, etc.).

2. **Optional migrations (all-in-one)**
   - `RUN-ALL-OPTIONAL-MIGRATIONS.sql` – runs in one go:
     - Pro **service area**: `service_radius_km`, `distance_km()`, `get_pros_serving_point(lat, lng)` for map + radius and “check if we serve you” (postal code / address).
     - **Profiles**: `phone`, `birthday`, `address` (My Account + booking).
     - **Bookings** table + **Top Picks** (`get_top_picks(category_slug)`).

3. **If you prefer to run separately**
   - `SERVICE-AREA-AND-QUOTE-CHECK.sql` – map + radius + quote check RPC only.
   - `ADD-PROFILES-ACCOUNT-FIELDS.sql` – phone, birthday, address on `profiles`.
   - `ADD-TOP-PICKS-AND-BOOKINGS.sql` – bookings table + top picks RPC.

4. **Other optional migrations** (if you use these features)
   - `ADD-EMAIL-LANGUAGE.sql` – email language preference (EN/FR).
   - `ADD-NAME-LOGIN.sql` – login with name + `is_name_taken_by_other`, `get_email_for_name`.
   - `ADD-PRO-PRIVATE-FIELDS.sql` – `personal_photo_url`, `id_document_url` on `pro_profiles`.

No need to run the same migration twice; use “IF NOT EXISTS” / “CREATE OR REPLACE” where possible.
