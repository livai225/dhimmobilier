
DO $$
DECLARE r RECORD;
BEGIN
  -- Parcourt toutes les tables du schéma public
  FOR r IN 
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
  LOOP
    -- 1) Activer la réplication complète des valeurs (requis pour le realtime fiable)
    EXECUTE format('ALTER TABLE %I.%I REPLICA IDENTITY FULL', r.table_schema, r.table_name);

    -- 2) Ajouter la table à la publication supabase_realtime si absente
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime'
        AND schemaname = r.table_schema 
        AND tablename = r.table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I.%I', r.table_schema, r.table_name);
    END IF;
  END LOOP;
END
$$;
