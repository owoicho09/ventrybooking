-- 045b (OPTIONAL, run only if the client agrees): remove ticks that were
-- never backed by an identity check.
--
-- Checked 2026-10-11: every account's tick came from the email one-time code;
-- none ever uploaded ID or passed a provider check. Running this removes the
-- public verified tick from all of them until each verifies with NIN or CAC
-- (a two-minute step in their dashboard). It also means the NGN 500,000
-- settlement cap (Organiser Terms 3.7) applies to them from now on.
--
-- Skip it to keep today's ticks; those accounts stay marked 'legacy' so the
-- admin can see who still needs to verify, and can be reset individually.

UPDATE users
SET verified = false,
    identity_status = 'unverified'
WHERE identity_status = 'legacy';
