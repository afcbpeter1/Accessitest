-- Sprint Management Schema
-- This will create the proper tables for sprint functionality

-- 1. Create sprints table (if not exists)
CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
    goal TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create sprint_columns table (if not exists)
CREATE TABLE IF NOT EXISTS sprint_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    wip_limit INTEGER,
    is_done_column BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create sprint_issues table (if not exists)
CREATE TABLE IF NOT EXISTS sprint_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES sprint_columns(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 1,
    story_points INTEGER DEFAULT 1,
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    moved_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(sprint_id, issue_id) -- Prevent duplicate issues in same sprint
);

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprints_user_id ON sprints(user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprint_columns_sprint_id ON sprint_columns(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_columns_position ON sprint_columns(sprint_id, position);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_sprint_id ON sprint_issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_column_id ON sprint_issues(column_id);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_position ON sprint_issues(column_id, position);

-- 5. Insert default columns for existing sprints
-- This will create the standard columns for any existing sprints
INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    s.id as sprint_id,
    'To Do' as name,
    'Issues to be worked on' as description,
    1 as position,
    '#6B7280' as color,
    NULL as wip_limit,
    FALSE as is_done_column
FROM sprints s
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_columns sc WHERE sc.sprint_id = s.id AND sc.name = 'To Do'
);

INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    s.id as sprint_id,
    'Blocked' as name,
    'Issues that are blocked' as description,
    2 as position,
    '#EF4444' as color,
    NULL as wip_limit,
    FALSE as is_done_column
FROM sprints s
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_columns sc WHERE sc.sprint_id = s.id AND sc.name = 'Blocked'
);

INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    s.id as sprint_id,
    'In Progress' as name,
    'Issues currently being worked on' as description,
    3 as position,
    '#3B82F6' as color,
    5 as wip_limit,
    FALSE as is_done_column
FROM sprints s
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_columns sc WHERE sc.sprint_id = s.id AND sc.name = 'In Progress'
);

INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    s.id as sprint_id,
    'In Review' as name,
    'Issues under review' as description,
    4 as position,
    '#F59E0B' as color,
    3 as wip_limit,
    FALSE as is_done_column
FROM sprints s
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_columns sc WHERE sc.sprint_id = s.id AND sc.name = 'In Review'
);

INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    s.id as sprint_id,
    'Done' as name,
    'Completed issues' as description,
    5 as position,
    '#10B981' as color,
    NULL as wip_limit,
    TRUE as is_done_column
FROM sprints s
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_columns sc WHERE sc.sprint_id = s.id AND sc.name = 'Done'
);

-- 6. Update any existing sprint_issues to use the correct column IDs
-- This will move any existing sprint issues to the "To Do" column
UPDATE sprint_issues 
SET column_id = (
    SELECT sc.id 
    FROM sprint_columns sc 
    WHERE sc.sprint_id = sprint_issues.sprint_id 
    AND sc.name = 'To Do'
    LIMIT 1
)
WHERE column_id IS NULL OR column_id NOT IN (
    SELECT id FROM sprint_columns
);

-- 7. Clean up any orphaned sprint_issues that don't have valid column references
DELETE FROM sprint_issues 
WHERE column_id NOT IN (SELECT id FROM sprint_columns);

-- 8. Add constraints to ensure data integrity
ALTER TABLE sprint_issues 
ADD CONSTRAINT IF NOT EXISTS fk_sprint_issues_sprint_id 
FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE CASCADE;

ALTER TABLE sprint_issues 
ADD CONSTRAINT IF NOT EXISTS fk_sprint_issues_issue_id 
FOREIGN KEY (issue_id) REFERENCES issues(id) ON DELETE CASCADE;

ALTER TABLE sprint_issues 
ADD CONSTRAINT IF NOT EXISTS fk_sprint_issues_column_id 
FOREIGN KEY (column_id) REFERENCES sprint_columns(id) ON DELETE CASCADE;

-- 9. Create a function to automatically create default columns for new sprints
CREATE OR REPLACE FUNCTION create_default_sprint_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert default columns for the new sprint
    INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column) VALUES
    (NEW.id, 'To Do', 'Issues to be worked on', 1, '#6B7280', NULL, FALSE),
    (NEW.id, 'Blocked', 'Issues that are blocked', 2, '#EF4444', NULL, FALSE),
    (NEW.id, 'In Progress', 'Issues currently being worked on', 3, '#3B82F6', 5, FALSE),
    (NEW.id, 'In Review', 'Issues under review', 4, '#F59E0B', 3, FALSE),
    (NEW.id, 'Done', 'Completed issues', 5, '#10B981', NULL, TRUE);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 10. Create trigger to automatically create default columns when a new sprint is created
DROP TRIGGER IF EXISTS trigger_create_default_sprint_columns ON sprints;
CREATE TRIGGER trigger_create_default_sprint_columns
    AFTER INSERT ON sprints
    FOR EACH ROW
    EXECUTE FUNCTION create_default_sprint_columns();

-- 11. Verify the setup
SELECT 'Sprint tables created successfully' as status;
SELECT COUNT(*) as sprint_count FROM sprints;
SELECT COUNT(*) as column_count FROM sprint_columns;
SELECT COUNT(*) as issue_count FROM sprint_issues;
