# Team Board Assignment Feature

## Overview
This feature allows admins and owners to assign teams to specific Jira or Azure DevOps boards. Each team can be assigned to one board (either Jira or Azure DevOps, depending on which integrations are configured for the team).

## Database Migration Required

**You must run the following migration before using this feature:**

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f migrations/005_team_board_assignments.sql
```

Or if you're using a database client:
1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open and execute the file: `migrations/005_team_board_assignments.sql`

### What the Migration Does:
- Creates `team_board_assignments` table to store team-to-board assignments
- Ensures each team can only have one active board assignment per integration type
- Creates indexes for faster lookups
- Sets up foreign key constraints for data integrity

## Features

### 1. Admin-Only Access
- Only users with `owner` or `admin` roles can assign teams to boards
- Regular users can see which board a team is assigned to, but cannot change it

### 2. Board Assignment UI
- In the Teams tab, each team card shows a menu button (three dots) if the team has Jira or Azure DevOps integrations
- Clicking the menu opens a dropdown showing:
  - Current board assignment (if any)
  - Available boards from the team's integrations
  - Option to remove board assignment

### 3. API Endpoints

#### GET `/api/organization/teams/board`
- Get available boards for a team and current board assignment
- Query parameters: `team_id`, `organization_id`
- Returns: `currentAssignment`, `availableBoards`

#### POST `/api/organization/teams/board`
- Assign a team to a board
- Body: `teamId`, `organizationId`, `integrationId`, `integrationType`
- Admin/owner only

#### DELETE `/api/organization/teams/board`
- Remove team board assignment
- Query parameters: `team_id`, `organization_id`
- Admin/owner only

## Usage

1. **Navigate to Organization → Teams tab**
2. **Find a team that has Jira or Azure DevOps integration configured**
3. **Click the three-dot menu button** on the team card (only visible to admins)
4. **Select a board** from the dropdown
5. **The assignment is saved immediately** and displayed on the team card

## Display

- Team cards show the assigned board name and type (Jira/Azure DevOps) at the bottom
- The current assignment is highlighted in the dropdown menu
- If no board is assigned, the dropdown shows all available boards

## Database Schema

```sql
team_board_assignments
├── id (UUID, Primary Key)
├── team_id (UUID, Foreign Key → teams.id)
├── organization_id (UUID, Foreign Key → organizations.id)
├── integration_id (UUID, References jira_integrations.id or azure_devops_integrations.id)
├── integration_type (VARCHAR: 'jira' | 'azure_devops')
├── board_name (VARCHAR, Display name)
├── assigned_by (UUID, Foreign Key → users.id)
├── assigned_at (TIMESTAMP)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

UNIQUE CONSTRAINT: (team_id, integration_type)
```

## Notes

- A team can only have one board assignment at a time
- If a team has both Jira and Azure DevOps integrations, you can switch between them
- Board assignments are automatically removed when a team is deleted (CASCADE)
- The feature only works for teams that have at least one active integration configured


