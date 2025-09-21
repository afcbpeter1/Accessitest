-- Sprint Board Database Schema
-- This creates the tables needed for a complete sprint management system

-- Sprints table - stores sprint information
CREATE TABLE IF NOT EXISTS sprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'planning', -- planning, active, completed, cancelled
    goal TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint columns table - customizable columns for each sprint
CREATE TABLE IF NOT EXISTS sprint_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL, -- Order of columns
    color VARCHAR(7) DEFAULT '#3B82F6', -- Hex color for column
    wip_limit INTEGER, -- Work in progress limit
    is_done_column BOOLEAN DEFAULT FALSE, -- Marks completion
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint issues table - links issues to sprints and columns
CREATE TABLE IF NOT EXISTS sprint_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
    column_id UUID NOT NULL REFERENCES sprint_columns(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, -- Order within column
    story_points INTEGER DEFAULT 1, -- Story points for estimation
    assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    moved_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sprint_id, issue_id) -- Prevent duplicate issues in same sprint
);

-- Sprint metrics table - stores calculated metrics
CREATE TABLE IF NOT EXISTS sprint_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    total_story_points INTEGER DEFAULT 0,
    completed_story_points INTEGER DEFAULT 0,
    remaining_story_points INTEGER DEFAULT 0,
    issues_count INTEGER DEFAULT 0,
    completed_issues_count INTEGER DEFAULT 0,
    velocity DECIMAL(5,2) DEFAULT 0, -- Story points per day
    burndown_data JSONB, -- Daily burndown data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sprint_id, metric_date)
);

-- Sprint activities table - tracks all sprint activities
CREATE TABLE IF NOT EXISTS sprint_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sprint_id UUID NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    activity_type VARCHAR(100) NOT NULL, -- issue_added, issue_moved, issue_removed, sprint_started, etc.
    description TEXT NOT NULL,
    metadata JSONB, -- Additional data about the activity
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Sprint templates table - reusable sprint configurations
CREATE TABLE IF NOT EXISTS sprint_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_columns JSONB NOT NULL, -- Default column configuration
    default_duration_days INTEGER DEFAULT 14,
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprints_user_id ON sprints(user_id);
CREATE INDEX IF NOT EXISTS idx_sprints_status ON sprints(status);
CREATE INDEX IF NOT EXISTS idx_sprint_columns_sprint_id ON sprint_columns(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_columns_position ON sprint_columns(sprint_id, position);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_sprint_id ON sprint_issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_column_id ON sprint_issues(column_id);
CREATE INDEX IF NOT EXISTS idx_sprint_issues_position ON sprint_issues(column_id, position);
CREATE INDEX IF NOT EXISTS idx_sprint_metrics_sprint_id ON sprint_metrics(sprint_id);
CREATE INDEX IF NOT EXISTS idx_sprint_activities_sprint_id ON sprint_activities(sprint_id);

-- Add some default columns for new sprints
INSERT INTO sprint_templates (user_id, name, description, default_columns, default_duration_days, is_public) VALUES
(
    (SELECT id FROM users LIMIT 1), -- Use first user as template owner
    'Standard Accessibility Sprint',
    'Default template for accessibility sprints',
    '[
        {"name": "To Do", "description": "Issues to be worked on", "color": "#6B7280", "position": 1, "wip_limit": null, "is_done_column": false},
        {"name": "In Progress", "description": "Issues currently being worked on", "color": "#3B82F6", "position": 2, "wip_limit": 5, "is_done_column": false},
        {"name": "In Review", "description": "Issues under review", "color": "#F59E0B", "position": 3, "wip_limit": 3, "is_done_column": false},
        {"name": "Done", "description": "Completed issues", "color": "#10B981", "position": 4, "wip_limit": null, "is_done_column": true}
    ]'::jsonb,
    14,
    true
) ON CONFLICT DO NOTHING;