-- Wiki tags (run after wiki-schema.sql)
-- Tags are normalized slugs; labels preserve editor-facing names.

CREATE TABLE IF NOT EXISTS wiki_tags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       TEXT UNIQUE NOT NULL,
  label      TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wiki_page_tags (
  page_id UUID NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
  tag_id  UUID NOT NULL REFERENCES wiki_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_wiki_page_tags_tag ON wiki_page_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_wiki_tags_slug ON wiki_tags(slug);
