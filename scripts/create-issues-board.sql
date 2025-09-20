-- Create centralized issues board system
-- This will store all accessibility issues across all scans with deduplication

-- Main issues table - stores unique issues across all scans
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key VARCHAR(255) UNIQUE NOT NULL, -- Generated key for deduplication
  rule_id VARCHAR(255) NOT NULL, -- Axe rule ID (e.g., 'color-contrast')
  rule_name TEXT NOT NULL, -- Human readable rule name
  description TEXT NOT NULL,
  impact VARCHAR(20) NOT NULL CHECK (impact IN ('critical', 'serious', 'moderate', 'minor')),
  wcag_level VARCHAR(10) NOT NULL, -- A, AA, AAA
  help_text TEXT,
  help_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Issue management fields
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'deferred', 'duplicate')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  assignee_id UUID REFERENCES users(id),
  labels TEXT[], -- Array of labels for categorization
  
  -- Metadata
  first_seen_scan_id UUID, -- First scan where this issue was found
  last_seen_scan_id UUID, -- Most recent scan where this issue was found
  total_occurrences INTEGER DEFAULT 1,
  affected_pages TEXT[], -- Array of URLs where this issue appears
  estimated_effort VARCHAR(20), -- 'small', 'medium', 'large', 'xlarge'
  
  -- Custom fields
  custom_fields JSONB, -- For additional metadata
  notes TEXT,
  resolution_notes TEXT
);

-- Scan issue occurrences - links issues to specific scans
CREATE TABLE IF NOT EXISTS scan_issue_occurrences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  scan_id UUID NOT NULL REFERENCES scan_history(id) ON DELETE CASCADE,
  page_url TEXT NOT NULL,
  element_selector TEXT, -- CSS selector of the problematic element
  html_snippet TEXT, -- HTML of the problematic element
  failure_summary TEXT,
  screenshot_url TEXT,
  bounding_box JSONB, -- {x, y, width, height}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(issue_id, scan_id, page_url, element_selector)
);

-- Issue comments/activity log
CREATE TABLE IF NOT EXISTS issue_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  activity_type VARCHAR(50) NOT NULL, -- 'created', 'status_changed', 'assigned', 'commented', 'resolved'
  old_value TEXT,
  new_value TEXT,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Issue watchers - users who want to be notified of changes
CREATE TABLE IF NOT EXISTS issue_watchers (
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (issue_id, user_id)
);

-- Issue labels for categorization
CREATE TABLE IF NOT EXISTS issue_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7) NOT NULL, -- Hex color code
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Many-to-many relationship between issues and labels
CREATE TABLE IF NOT EXISTS issue_label_assignments (
  issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES issue_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (issue_id, label_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_impact ON issues(impact);
CREATE INDEX IF NOT EXISTS idx_issues_assignee ON issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_issues_created_at ON issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_rule_id ON issues(rule_id);

CREATE INDEX IF NOT EXISTS idx_scan_occurrences_issue_id ON scan_issue_occurrences(issue_id);
CREATE INDEX IF NOT EXISTS idx_scan_occurrences_scan_id ON scan_issue_occurrences(scan_id);
CREATE INDEX IF NOT EXISTS idx_scan_occurrences_page_url ON scan_issue_occurrences(page_url);

CREATE INDEX IF NOT EXISTS idx_issue_activity_issue_id ON issue_activity(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_activity_created_at ON issue_activity(created_at);

-- Function to generate issue key for deduplication
CREATE OR REPLACE FUNCTION generate_issue_key(
  rule_id VARCHAR,
  page_url TEXT,
  element_selector TEXT DEFAULT NULL
) RETURNS VARCHAR AS $$
BEGIN
  -- Create a unique key based on rule and location
  -- This helps identify the same issue across different scans
  RETURN rule_id || ':' || 
         regexp_replace(page_url, 'https?://', '') || 
         COALESCE(':' || element_selector, '');
END;
$$ LANGUAGE plpgsql;

-- Function to update issue statistics
CREATE OR REPLACE FUNCTION update_issue_stats(issue_uuid UUID) RETURNS VOID AS $$
DECLARE
  occurrence_count INTEGER;
  affected_pages_list TEXT[];
BEGIN
  -- Count total occurrences
  SELECT COUNT(*), array_agg(DISTINCT page_url)
  INTO occurrence_count, affected_pages_list
  FROM scan_issue_occurrences 
  WHERE issue_id = issue_uuid;
  
  -- Update the issue record
  UPDATE issues 
  SET 
    total_occurrences = occurrence_count,
    affected_pages = affected_pages_list,
    updated_at = NOW()
  WHERE id = issue_uuid;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stats when occurrences change
CREATE OR REPLACE FUNCTION trigger_update_issue_stats() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM update_issue_stats(NEW.issue_id);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM update_issue_stats(OLD.issue_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_issue_stats_trigger
  AFTER INSERT OR UPDATE OR DELETE ON scan_issue_occurrences
  FOR EACH ROW EXECUTE FUNCTION trigger_update_issue_stats();

-- Insert some default labels
INSERT INTO issue_labels (name, color, description) VALUES
('frontend', '#3B82F6', 'Frontend/UI related issues'),
('backend', '#10B981', 'Backend/API related issues'),
('content', '#F59E0B', 'Content accessibility issues'),
('forms', '#EF4444', 'Form accessibility issues'),
('navigation', '#8B5CF6', 'Navigation accessibility issues'),
('media', '#06B6D4', 'Media accessibility issues'),
('critical-path', '#DC2626', 'Critical user journey issues'),
('quick-win', '#10B981', 'Quick fixes that are easy to implement')
ON CONFLICT (name) DO NOTHING;