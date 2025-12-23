# Simplified Organization Model

## New Structure

### Single Organization Per User
- Each user automatically gets **ONE organization** when they sign up
- Organizations are **FREE** - no cost
- No need to create multiple organizations
- Organization name can be user's name or company name

### Teams Are The Paid Feature
- Teams are created **within** the organization
- **Each team requires a paid license** (monthly or yearly)
- Teams have their own:
  - Jira/DevOps integrations
  - Sprint board configuration
  - Privacy/isolation (users can't see other teams' data)

### Shared Credits
- All teams in an organization share the **organization's credit pool**
- Credits are purchased at the organization level
- Teams don't have separate credit pools

### Team Isolation
- Scans, issues, and sprint boards are filtered by `team_id`
- Users in Team A cannot see Team B's scans/issues
- Each team has its own sprint board
- Each team can have different Jira/DevOps integrations

### Billing Model
- **Organizations**: FREE
- **Teams**: Paid (monthly or yearly per team)
- **Credits**: Purchased at org level, shared by all teams

## Database Changes Needed

1. **Remove multi-org complexity**:
   - Auto-create one org per user on signup
   - Remove "create organization" functionality
   - Remove organization switcher

2. **Update billing**:
   - Change from `max_users` to `max_teams` on organizations
   - Track team subscriptions in Stripe
   - Billing is per-team, not per-user

3. **Add team isolation**:
   - All scans must have `team_id`
   - All issues must have `team_id`
   - All queries filter by `team_id`
   - Users can only see data from teams they're members of

4. **Team memberships**:
   - Users can be members of multiple teams in their org
   - Each team membership is separate
   - Team admins can manage their team

