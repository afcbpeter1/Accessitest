-- Sprint Templates and Recurring Sprints Schema
-- This extends the existing sprint functionality with templates and auto-creation

-- 1. Create sprint_templates table
CREATE TABLE IF NOT EXISTS sprint_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    duration_days INTEGER NOT NULL DEFAULT 14, -- Sprint duration in days
    recurrence_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (recurrence_type IN ('none', 'weekly', 'biweekly', 'monthly')),
    auto_create BOOLEAN DEFAULT FALSE,
    advance_creation_days INTEGER DEFAULT 7, -- How many days before end to create next sprint
    default_goal TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create template_columns table (reusable column configurations)
CREATE TABLE IF NOT EXISTS template_columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES sprint_templates(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    position INTEGER NOT NULL,
    color VARCHAR(7) DEFAULT '#6B7280',
    wip_limit INTEGER,
    is_done_column BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 3. Add template_id to sprints table to track which template created it
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES sprint_templates(id) ON DELETE SET NULL;
ALTER TABLE sprints ADD COLUMN IF NOT EXISTS is_auto_created BOOLEAN DEFAULT FALSE;

-- 4. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_sprint_templates_user_id ON sprint_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_sprint_templates_recurrence ON sprint_templates(recurrence_type, auto_create);
CREATE INDEX IF NOT EXISTS idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX IF NOT EXISTS idx_sprints_template_id ON sprints(template_id);

-- 5. Insert default sprint templates for existing users
INSERT INTO sprint_templates (user_id, name, description, duration_days, recurrence_type, auto_create, advance_creation_days, default_goal)
SELECT DISTINCT 
    u.id as user_id,
    'Weekly Sprint' as name,
    'Standard weekly sprint template' as description,
    7 as duration_days,
    'weekly' as recurrence_type,
    FALSE as auto_create,
    2 as advance_creation_days,
    'Complete accessibility improvements and bug fixes' as default_goal
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_templates st WHERE st.user_id = u.id AND st.name = 'Weekly Sprint'
);

INSERT INTO sprint_templates (user_id, name, description, duration_days, recurrence_type, auto_create, advance_creation_days, default_goal)
SELECT DISTINCT 
    u.id as user_id,
    'Bi-weekly Sprint' as name,
    'Standard bi-weekly sprint template' as description,
    14 as duration_days,
    'biweekly' as recurrence_type,
    FALSE as auto_create,
    3 as advance_creation_days,
    'Complete accessibility improvements and feature development' as default_goal
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM sprint_templates st WHERE st.user_id = u.id AND st.name = 'Bi-weekly Sprint'
);

-- 6. Create default columns for templates
INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    st.id as template_id,
    'To Do' as name,
    'Issues to be worked on' as description,
    1 as position,
    '#6B7280' as color,
    NULL as wip_limit,
    FALSE as is_done_column
FROM sprint_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM template_columns tc WHERE tc.template_id = st.id AND tc.name = 'To Do'
);

INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    st.id as template_id,
    'Blocked' as name,
    'Issues that are blocked' as description,
    2 as position,
    '#EF4444' as color,
    NULL as wip_limit,
    FALSE as is_done_column
FROM sprint_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM template_columns tc WHERE tc.template_id = st.id AND tc.name = 'Blocked'
);

INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    st.id as template_id,
    'In Progress' as name,
    'Issues currently being worked on' as description,
    3 as position,
    '#3B82F6' as color,
    5 as wip_limit,
    FALSE as is_done_column
FROM sprint_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM template_columns tc WHERE tc.template_id = st.id AND tc.name = 'In Progress'
);

INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    st.id as template_id,
    'In Review' as name,
    'Issues under review' as description,
    4 as position,
    '#F59E0B' as color,
    3 as wip_limit,
    FALSE as is_done_column
FROM sprint_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM template_columns tc WHERE tc.template_id = st.id AND tc.name = 'In Review'
);

INSERT INTO template_columns (template_id, name, description, position, color, wip_limit, is_done_column)
SELECT 
    st.id as template_id,
    'Done' as name,
    'Completed issues' as description,
    5 as position,
    '#10B981' as color,
    NULL as wip_limit,
    TRUE as is_done_column
FROM sprint_templates st
WHERE NOT EXISTS (
    SELECT 1 FROM template_columns tc WHERE tc.template_id = st.id AND tc.name = 'Done'
);

-- 7. Create function to create sprint from template
CREATE OR REPLACE FUNCTION create_sprint_from_template(
    p_template_id UUID,
    p_start_date DATE,
    p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_sprint_id UUID;
    v_template RECORD;
    v_column RECORD;
BEGIN
    -- Get template details
    SELECT * INTO v_template FROM sprint_templates WHERE id = p_template_id AND user_id = p_user_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or access denied';
    END IF;
    
    -- Create the sprint
    INSERT INTO sprints (user_id, name, description, start_date, end_date, goal, template_id, is_auto_created)
    VALUES (
        p_user_id,
        v_template.name || ' - ' || to_char(p_start_date, 'YYYY-MM-DD'),
        v_template.description,
        p_start_date,
        p_start_date + INTERVAL '1 day' * v_template.duration_days - INTERVAL '1 day',
        v_template.default_goal,
        p_template_id,
        TRUE
    )
    RETURNING id INTO v_sprint_id;
    
    -- Create columns from template
    FOR v_column IN 
        SELECT * FROM template_columns 
        WHERE template_id = p_template_id 
        ORDER BY position
    LOOP
        INSERT INTO sprint_columns (sprint_id, name, description, position, color, wip_limit, is_done_column)
        VALUES (
            v_sprint_id,
            v_column.name,
            v_column.description,
            v_column.position,
            v_column.color,
            v_column.wip_limit,
            v_column.is_done_column
        );
    END LOOP;
    
    RETURN v_sprint_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Create function to check and create recurring sprints
CREATE OR REPLACE FUNCTION check_and_create_recurring_sprints()
RETURNS void AS $$
DECLARE
    v_template RECORD;
    v_last_sprint RECORD;
    v_next_start_date DATE;
    v_sprint_id UUID;
BEGIN
    -- Find all active templates with auto-creation enabled
    FOR v_template IN 
        SELECT * FROM sprint_templates 
        WHERE auto_create = TRUE AND is_active = TRUE
    LOOP
        -- Find the last sprint created from this template
        SELECT * INTO v_last_sprint 
        FROM sprints 
        WHERE template_id = v_template.id 
        ORDER BY end_date DESC 
        LIMIT 1;
        
        -- Calculate next sprint start date
        IF v_last_sprint.id IS NULL THEN
            -- No previous sprint, start from today
            v_next_start_date := CURRENT_DATE;
        ELSE
            -- Calculate based on recurrence type
            CASE v_template.recurrence_type
                WHEN 'weekly' THEN
                    v_next_start_date := v_last_sprint.end_date + INTERVAL '1 day';
                WHEN 'biweekly' THEN
                    v_next_start_date := v_last_sprint.end_date + INTERVAL '1 day';
                WHEN 'monthly' THEN
                    v_next_start_date := v_last_sprint.end_date + INTERVAL '1 day';
                ELSE
                    CONTINUE; -- Skip if no recurrence
            END CASE;
        END IF;
        
        -- Check if we need to create a new sprint (within advance_creation_days of current date)
        IF v_next_start_date <= CURRENT_DATE + INTERVAL '1 day' * v_template.advance_creation_days THEN
            -- Create the new sprint
            SELECT create_sprint_from_template(v_template.id, v_next_start_date, v_template.user_id) INTO v_sprint_id;
            
            -- Log the creation (you could add a log table here)
            RAISE NOTICE 'Created sprint % from template % for user %', v_sprint_id, v_template.id, v_template.user_id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 9. Create a scheduled job function (this would typically be called by a cron job)
-- You can call this function daily to check for sprints that need to be created
-- Example: SELECT check_and_create_recurring_sprints();

-- 10. Verify the setup
SELECT 'Sprint templates created successfully' as status;
SELECT COUNT(*) as template_count FROM sprint_templates;
SELECT COUNT(*) as template_column_count FROM template_columns;
