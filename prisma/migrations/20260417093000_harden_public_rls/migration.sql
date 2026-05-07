-- Harden `public` schema for Supabase Security Advisor
-- 1) Enable RLS on every existing public table
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN
    SELECT format('%I.%I', schemaname, tablename) AS fqtn
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY;', t.fqtn);
  END LOOP;
END $$;

-- 2) Revoke direct table privileges from PostgREST roles (if they exist)
DO $$
DECLARE
  t RECORD;
  has_anon BOOLEAN;
  has_authenticated BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO has_anon;
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') INTO has_authenticated;

  FOR t IN
    SELECT format('%I.%I', schemaname, tablename) AS fqtn
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    IF has_anon THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM anon;', t.fqtn);
    END IF;

    IF has_authenticated THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE %s FROM authenticated;', t.fqtn);
    END IF;
  END LOOP;
END $$;

-- 3) Prevent future tables/functions/sequences from being exposed by default
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM authenticated';
  END IF;
END $$;