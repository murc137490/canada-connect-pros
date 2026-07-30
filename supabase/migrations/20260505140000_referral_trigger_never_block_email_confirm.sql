-- Ensure referral completion logic never blocks Supabase Auth email confirmation.
-- If updating referral_invites fails, log a warning and continue (user still gets verified email).

create or replace function public.mark_referral_invite_completed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ref_code text;
begin
  if new.email_confirmed_at is null then
    return new;
  end if;

  ref_code := nullif(new.raw_user_meta_data ->> 'referral_code', '');

  begin
    update public.referral_invites
    set
      invited_user_id = new.id,
      status = 'completed',
      accepted_at = coalesce(accepted_at, now()),
      updated_at = now(),
      reward_code = coalesce(
        nullif(reward_code, 'freetrial'),
        'rwd_' || encode(gen_random_bytes(18), 'hex')
      )
    where status = 'pending'
      and invited_user_id is null
      and inviter_user_id <> new.id
      and lower(invitee_email) = lower(new.email)
      and (ref_code is null or referral_code = ref_code);
  exception
    when others then
      raise warning 'mark_referral_invite_completed skipped: %', sqlerrm;
  end;

  return new;
end;
$$;
