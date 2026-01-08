# Simplification Plan: Teams-Based Model

## Current Issues
- Multiple organizations per user (overcomplicated)
- Billing per user (should be per team)
- No team isolation (users can see all org data)
- Confusing UI with org switcher

## New Model

### 1. Single Organization Per User
- ✅ Auto-create one org on signup (DONE in auth route)
- ✅ Remove "Create Organization" button
- ✅ Remove organization switcher
- ✅ Organization is just a container for teams and credits

### 2. Teams Are The Paid Feature
- Change billing from `max_users` to `max_teams`
- Each team requires a paid subscription
- Teams have their own:
  - Jira/DevOps integrations
  - Sprint board
  - Privacy/isolation

### 3. Team Isolation (Privacy)
- All scans must have `team_id`
- All issues must have `team_id`
- Users can only see data from teams they're members of
- Update all queries to filter by `team_id`

### 4. Shared Credits
- Credits are at organization level
- All teams share the same credit pool
- No per-team credit limits

### 5. Billing Changes
- Remove per-user billing
- Add per-team billing
- Teams have `stripe_subscription_id` and `subscription_status`
- Organization tracks `max_teams` (how many teams they can have)

## Implementation Steps

1. ✅ Auto-create org on signup
2. ⏳ Update billing to be per-team
3. ⏳ Add team isolation to all queries
4. ⏳ Update UI to remove multi-org features
5. ⏳ Update team creation to require payment
6. ⏳ Add team membership checks to all data queries


