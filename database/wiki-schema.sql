-- ============================================================
-- a11ytest.ai Wiki — Database Schema
-- Run after users table exists. Requires pgcrypto for gen_random_uuid() (usually on by default on managed Postgres).
-- ============================================================

-- Pages (one row per wiki article)
CREATE TABLE IF NOT EXISTS wiki_pages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug              TEXT UNIQUE NOT NULL,
  title             TEXT NOT NULL,
  current_revision_id UUID,
  wcag_criterion    TEXT,
  created_by        UUID REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT now(),
  is_locked         BOOLEAN DEFAULT false,
  is_stub           BOOLEAN DEFAULT true
);

-- Revisions (append-only, full history like Wikipedia)
CREATE TABLE IF NOT EXISTS wiki_revisions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id       UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  edit_summary  TEXT,
  edited_by     UUID NOT NULL REFERENCES users(id),
  edited_at     TIMESTAMPTZ DEFAULT now(),
  char_delta    INT
);

-- FK from pages to current revision (after wiki_revisions exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_current_revision'
  ) THEN
    ALTER TABLE wiki_pages
      ADD CONSTRAINT fk_current_revision
      FOREIGN KEY (current_revision_id) REFERENCES wiki_revisions(id);
  END IF;
END $$;

-- Flags (community moderation)
CREATE TABLE IF NOT EXISTS wiki_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id   UUID NOT NULL REFERENCES wiki_revisions(id) ON DELETE CASCADE,
  flagged_by    UUID NOT NULL REFERENCES users(id),
  reason        TEXT NOT NULL,
  resolved      BOOLEAN DEFAULT false,
  resolved_by   UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wiki_pages_slug ON wiki_pages(slug);
CREATE INDEX IF NOT EXISTS idx_wiki_pages_wcag ON wiki_pages(wcag_criterion);
CREATE INDEX IF NOT EXISTS idx_wiki_revisions_page ON wiki_revisions(page_id, edited_at DESC);

-- Tags (article topics): run wiki-tags-migration.sql after this file.
