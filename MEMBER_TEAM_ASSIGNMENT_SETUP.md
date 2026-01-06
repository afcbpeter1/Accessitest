# Member Team Assignment Feature

## Overview
This feature allows admins and owners to assign organization members to teams. This ensures that tickets and issues are routed to the correct team's board. Only admins and owners can assign members to teams.

## Database Migration Required

**You must run the following migration before using this feature:**

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f migrations/006_ensure_team_assignment.sql
```

Or if you're using a database client:
1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open and execute the file: `migrations/006_ensure_team_assignment.sql`

### What the Migration Does:
- Ensures `team_id` column exists in `organization_members` table
- Adds foreign key constraint to `teams` table
- Creates index for faster lookups
- Safe to run multiple times (won't duplicate if column already exists)

**Note:** If you've already run `migrations/003_organizations_and_teams.sql`, the `team_id` column should already exist. This migration is a safety check to ensure it's present.

## Features

### 1. Admin-Only Access
- Only users with `owner` or `admin` roles can assign members to teams
- Regular users can see which team a member is assigned to, but cannot change it

### 2. Team Assignment UI
- In the Members tab, each member row shows:
  - **Team Column**: Dropdown (for admins) or text display (for regular users)
  - **Role Column**: Dropdown (for admins) to change between User/Admin roles
  - **Actions Column**: Remove button (for admins, except for owners)

### 3. Role Management
- Admins can change member roles between `user` and `admin`
- **Owner role cannot be changed** - it's protected
- Only admins and owners can see/use the role dropdown

### 4. API Endpoints

#### POST `/api/organization/teams/assign`
- Assign a member to a team
- Body: `organizationId`, `userId`, `teamId`
- Admin/owner only

#### POST `/api/organization/teams/unassign`
- Remove a member from their current team
- Body: `organizationId`, `userId`
- Admin/owner only

#### PUT `/api/organization/members`
- Update member role
- Body: `organizationId`, `userId`, `role` (must be 'user' or 'admin', not 'owner')
- Admin/owner only

## Usage

1. **Navigate to Organization → Members tab**
2. **Find a member you want to assign to a team**
3. **In the Team column**, select a team from the dropdown (admins only)
4. **To change role**, use the dropdown in the Role column (admins only)
5. **Changes are saved immediately**

## Display

- **For Admins/Owners:**
  - Team column shows a dropdown with all available teams
  - "No Team" option to remove team assignment
  - Role column shows a dropdown (User/Admin, Owner is disabled)
  
- **For Regular Users:**
  - Team column shows the team name as text (or "No Team")
  - Role column shows the role as text only

## Database Schema

The `organization_members` table includes:
- `team_id` (UUID, nullable, Foreign Key → teams.id)
- `role` ('owner' | 'admin' | 'user')

## Notes

- Members can be assigned to only one team at a time
- Setting team to "No Team" removes the assignment
- Team assignment affects which board tickets/issues are routed to
- Owner role is protected and cannot be changed
- Only active members can be assigned to teams

## Integration with Board Assignments

When a member is assigned to a team:
1. The member's tickets/issues will be routed to that team's board
2. The team must have a board assigned (via Team Board Assignment feature)
3. If the team has no board assigned, tickets may not route correctly

## Related Features

- **Team Board Assignment**: Teams must be assigned to boards for proper ticket routing
- **Team Management**: Teams must exist before members can be assigned to them

