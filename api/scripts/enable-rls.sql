-- Close the Supabase REST surface on every table in `public`.
--
-- WHY THIS IS SAFE FOR THIS APP
--
-- Nothing here talks to Supabase's PostgREST API. The app calls the Express API,
-- which reaches Postgres through Prisma over a direct connection as the owning
-- role. Postgres exempts a table's OWNER from its own row-level policies unless
-- FORCE ROW LEVEL SECURITY is set — which it is not, below — so enabling RLS
-- changes nothing about how the API reads or writes.
--
-- WHY IT IS WORTH DOING ANYWAY
--
-- Supabase publishes PostgREST at https://<project>.supabase.co/rest/v1/ by
-- default, authorised with the `anon` key. That key is meant to be public: it is
-- designed to sit in client bundles. Every `public` table without RLS is
-- therefore readable, and often writable, by anyone who has it. On this schema
-- that includes admins.password_hash, otp_codes.code_hash and the rider identity
-- documents.
--
-- Enabling RLS with NO POLICIES denies everything to `anon` and `authenticated`.
-- No policy means no row ever matches. That is the whole control — there is
-- deliberately nothing to configure, because the correct number of ways to reach
-- these tables from a browser is zero.
--
--   psql "$DATABASE_URL" -f scripts/enable-rls.sql
--
-- Idempotent. Re-run it after any migration that creates a table.

BEGIN;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
    RAISE NOTICE 'RLS enabled: %', t.tablename;
  END LOOP;
END $$;

-- Belt and braces. RLS alone is enough, but revoking the grants means a table
-- created later without RLS is not silently exposed in the gap before anyone
-- re-runs this.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
    RAISE NOTICE 'revoked public schema grants from anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated;
    RAISE NOTICE 'revoked public schema grants from authenticated';
  END IF;
END $$;

COMMIT;

-- Verify: every table should report rowsecurity = true.
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY rowsecurity, tablename;
