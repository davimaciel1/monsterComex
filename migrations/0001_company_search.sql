CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE UNIQUE INDEX IF NOT EXISTS companies_name_kind_unique_idx
  ON companies (name, kind);

CREATE INDEX IF NOT EXISTS companies_name_trgm_idx
  ON companies USING GIN (name gin_trgm_ops);
