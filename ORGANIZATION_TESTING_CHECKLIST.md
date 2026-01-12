# Organization & Team Management - Testing Checklist

This document provides a comprehensive testing guide for the new organization and team management features.

## Pre-Testing Setup

### ✅ Database Migration
- [ ] Run `migrations/003_organizations_and_teams.sql` on your database
- [ ] Verify all tables were created (organizations, teams, organization_members, organization_credits, team_integrations)
- [ ] Verify existing users have personal organizations created
- [ ] Verify user credits were migrated to organization credits

### ✅ Stripe Configuration
- [ ] Created monthly per-user price in Stripe
- [ ] Created yearly per-user price in Stripe
- [ ] Added `STRIPE_PER_USER_PRICE_ID` to `.env`
- [ ] Added `STRIPE_PER_USER_PRICE_ID_YEARLY` to `.env`
- [ ] Verified webhook is configured for subscription events

## Feature Testing

### 1. Organization Management

#### Create Organization
- [ ] Navigate to `/organization`
- [ ] Click "Create Organization"
- [ ] Enter organization name
- [ ] Verify organization is created
- [ ] Verify you are set as owner
- [ ] Verify organization appears in sidebar switcher

#### View Organizations
- [ ] Verify all your organizations are listed
- [ ] Verify current organization is highlighted
- [ ] Verify organization stats are displayed (members, max users, credits)

#### Organization Switcher (Sidebar)
- [ ] Verify organization switcher appears in sidebar header
- [ ] Click switcher to see dropdown
- [ ] Verify all organizations are listed
- [ ] Click different organization to switch
- [ ] Verify current organization is marked with checkmark
- [ ] Verify "Create Organization" link works

### 2. Member Management

#### Invite Members
- [ ] Go to Members tab
- [ ] Click "Invite Member"
- [ ] Enter email address
- [ ] Select role (User or Admin)
- [ ] Submit invitation
- [ ] Verify success message
- [ ] Verify member appears in list (if user exists)
- [ ] Verify email is sent (check email service logs)

#### View Members
- [ ] Verify all members are listed with correct information
- [ ] Verify role icons display correctly (Crown for owner, Shield for admin, User for user)
- [ ] Verify join dates are displayed

#### Update Member Role
- [ ] Find a member (not owner)
- [ ] Change role using dropdown (User → Admin → User)
- [ ] Verify role updates successfully
- [ ] Verify success message
- [ ] Verify role change is reflected in UI

#### Remove Members
- [ ] Find a member (not owner)
- [ ] Click remove/trash icon
- [ ] Confirm removal
- [ ] Verify member is removed
- [ ] Verify success message
- [ ] Verify owner cannot be removed

### 3. Team Management

#### Create Team
- [ ] Go to Teams tab
- [ ] Click "Create Team"
- [ ] Enter team name
- [ ] Enter description (optional)
- [ ] Submit
- [ ] Verify team is created
- [ ] Verify team appears in list

#### View Teams
- [ ] Verify all teams are listed
- [ ] Verify team information is displayed (name, description, member count)
- [ ] Verify integration badges show (Jira, Azure DevOps if configured)

#### Delete Team
- [ ] Click delete icon on a team
- [ ] Confirm deletion
- [ ] Verify team is removed

### 4. Billing Management

#### View Billing Status
- [ ] Go to Billing tab
- [ ] Verify current users count is displayed
- [ ] Verify max users count is displayed
- [ ] Verify available slots are calculated correctly

#### Add Users (Checkout)
- [ ] Enter number of users to add
- [ ] Click "Add Users"
- [ ] Verify redirect to Stripe checkout
- [ ] Complete test payment in Stripe test mode
- [ ] Verify redirect back to organization page
- [ ] Verify max_users is updated (check database or refresh)
- [ ] Verify webhook processed the subscription update

#### User Limit Enforcement
- [ ] Set max_users to current user count
- [ ] Try to invite a new member
- [ ] Verify warning message appears
- [ ] Verify "Add Users" button is disabled when at limit

### 5. Credit System

#### Organization Credits
- [ ] Verify organization credits are displayed in overview
- [ ] Verify unlimited credits show as ∞
- [ ] Create a scan as organization member
- [ ] Verify credits are deducted from organization pool (not personal)
- [ ] Verify credit transactions include organization_id

#### Credit Purchase
- [ ] Purchase credits while in organization
- [ ] Verify credits are added to organization pool
- [ ] Verify credit transaction is logged with organization_id

### 6. Integration Selection

#### Jira Integration
- [ ] Configure personal Jira integration
- [ ] Configure team Jira integration
- [ ] Create an issue in a team context
- [ ] Verify team integration is used (not personal)
- [ ] Create issue without team context
- [ ] Verify personal integration is used

#### Azure DevOps Integration
- [ ] Configure personal Azure DevOps integration
- [ ] Configure team Azure DevOps integration
- [ ] Create work item in team context
- [ ] Verify team integration is used
- [ ] Create work item without team context
- [ ] Verify personal integration is used

### 7. Permissions & Access Control

#### Role Permissions
- [ ] As Owner: Verify you can manage everything
- [ ] As Admin: Verify you can manage users/teams/integrations
- [ ] As Admin: Verify you cannot manage billing or delete org
- [ ] As User: Verify you can only view (not manage)

#### API Permission Checks
- [ ] Try to invite user as regular user (should fail)
- [ ] Try to create team as regular user (should fail)
- [ ] Try to update member role as regular user (should fail)
- [ ] Try to access billing as regular user (should fail)

### 8. Data Migration

#### Existing Users
- [ ] Verify existing users have personal organizations
- [ ] Verify existing user credits were migrated
- [ ] Verify existing integrations still work (team_id is NULL)
- [ ] Verify existing scans/issues still accessible

### 9. Edge Cases

#### Empty States
- [ ] Create organization with no members (should have owner)
- [ ] Create organization with no teams
- [ ] Verify empty state messages display correctly

#### Error Handling
- [ ] Try to create organization with empty name (should show error)
- [ ] Try to invite invalid email (should show error)
- [ ] Try to invite user who doesn't exist (should show error)
- [ ] Try to invite user who is already a member (should show error)
- [ ] Try to remove yourself as owner (should fail)

#### Concurrent Operations
- [ ] Have two admins invite users simultaneously
- [ ] Verify no duplicate memberships
- [ ] Verify user limit is enforced correctly

## API Endpoint Testing

### Organization Endpoints
- [ ] `GET /api/organization` - List organizations
- [ ] `POST /api/organization` - Create organization
- [ ] `GET /api/organization/[id]` - Get organization details
- [ ] `PUT /api/organization` - Update organization
- [ ] `DELETE /api/organization` - Delete organization

### Member Endpoints
- [ ] `GET /api/organization/members` - List members
- [ ] `POST /api/organization/invite` - Invite user
- [ ] `PUT /api/organization/members` - Update role
- [ ] `DELETE /api/organization/members` - Remove member

### Team Endpoints
- [ ] `GET /api/organization/teams` - List teams
- [ ] `POST /api/organization/teams` - Create team
- [ ] `PUT /api/organization/teams` - Update team
- [ ] `DELETE /api/organization/teams` - Delete team
- [ ] `POST /api/organization/teams/assign` - Assign user to team
- [ ] `POST /api/organization/teams/remove` - Remove user from team

### Billing Endpoints
- [ ] `GET /api/organization/billing/checkout` - Check user limits
- [ ] `POST /api/organization/billing/checkout` - Create checkout session

### Credits Endpoints
- [ ] `GET /api/organization/credits` - Get organization credits

## Integration Testing

### End-to-End Workflows

#### Complete Organization Setup
1. [ ] Create organization
2. [ ] Invite 2 members
3. [ ] Create a team
4. [ ] Assign members to team
5. [ ] Configure team Jira integration
6. [ ] Add users via billing (Stripe checkout)
7. [ ] Verify everything works together

#### Credit Usage Flow
1. [ ] Create organization
2. [ ] Purchase credits
3. [ ] Member performs scan
4. [ ] Verify credits deducted from org pool
5. [ ] Verify transaction logged correctly

#### Integration Selection Flow
1. [ ] Create organization and team
2. [ ] Configure team Jira integration
3. [ ] Create issue in team context
4. [ ] Verify team integration is used
5. [ ] Create issue without team
6. [ ] Verify personal integration is used

## Performance Testing

- [ ] Load organization page with 10+ organizations
- [ ] Load members list with 50+ members
- [ ] Load teams list with 20+ teams
- [ ] Verify page load times are acceptable

## Security Testing

- [ ] Verify users can only access their own organizations
- [ ] Verify users cannot modify organizations they're not members of
- [ ] Verify role-based permissions are enforced
- [ ] Verify API endpoints require authentication
- [ ] Verify SQL injection protection (parameterized queries)

## Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge
- [ ] Test on mobile devices

## Known Issues / Notes

Document any issues found during testing here:

1. 
2. 
3. 

## Test Results Summary

- **Total Tests**: 
- **Passed**: 
- **Failed**: 
- **Skipped**: 
- **Date**: 
- **Tester**: 

---

## Quick Test Commands

```bash
# Check database tables exist
psql -d your_db -c "\dt" | grep -E "(organizations|teams|organization_members)"

# Check organization was created for user
psql -d your_db -c "SELECT o.name, om.role FROM organizations o JOIN organization_members om ON o.id = om.organization_id WHERE om.user_id = 'USER_ID';"

# Check credits were migrated
psql -d your_db -c "SELECT organization_id, credits_remaining FROM organization_credits;"
```


