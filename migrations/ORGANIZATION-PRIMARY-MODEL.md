# Organization-Primary Model Migration

## Overview

This migration simplifies the data model so that **Organizations are the primary entity** and **Users are members of Organizations**.

## What Changes

### Before
- Users had personal credits (`user_credits` table)
- Users could optionally have organizations
- Credits could be at user level OR organization level
- Confusing dual-credit system

### After
- **Organizations are primary** - all credits, subscriptions, billing live at organization level
- **Users are members** - every user has a primary organization (the one they own)
- **Single credit system** - all credits are in `organization_credits` table
- Users can still join multiple organizations, but their primary org is the one they own

## Database Changes

### Migration Steps

1. **Run the SQL migration**: `migrations/simplify-organization-model.sql`
   - Creates organizations for users who don't have one
   - Migrates all `user_credits` to `organization_credits`
   - Ensures every user has a primary organization
   - Creates indexes for performance

2. **Code Changes** (already done):
   - `getUserCredits()` now always uses organization credits
   - Removed fallback to `user_credits` 
   - Registration no longer creates `user_credits`

## How It Works Now

### User Registration
1. User signs up → creates `users` record
2. Automatically creates `organizations` record
3. Creates `organization_members` entry (user as 'owner')
4. Creates `organization_credits` (3 free credits)
5. Sets `users.default_organization_id`

### Getting Credits
- `getUserCredits(userId)` → finds user's primary org (where they're owner)
- Returns credits from `organization_credits` table
- No more personal credits fallback

### Adding Credits
- All credits go to `organization_credits`
- Credits are shared among all members of the organization

### Multiple Organizations
- Users can be invited to other organizations
- But their **primary organization** (the one they own) is used for:
  - Credits
  - Subscriptions
  - Billing
  - Default behavior

## Benefits

1. **Simpler mental model**: "I am an organization, and I have members"
2. **No credit confusion**: All credits are organization-level
3. **Easier multi-user**: Adding team members is natural
4. **Cleaner code**: No dual-credit system logic

## What Stays the Same

- `users` table still exists (for authentication)
- `organizations` table still exists
- `organization_members` table still exists
- `user_credits` table stays (for backwards compatibility, but unused)
- `default_organization_id` stays (for backwards compatibility)

## Testing Checklist

After running migration:
- [ ] All users have organizations
- [ ] All credits migrated to organization_credits
- [ ] User can log in and see credits
- [ ] User can purchase credits
- [ ] Credits are added to organization
- [ ] Scans deduct from organization credits
- [ ] New user registration creates org correctly

## Rollback Plan

If needed, you can:
1. Keep using `default_organization_id` (still works)
2. The code will auto-create orgs if missing
3. `user_credits` table still exists if needed

## Next Steps (Optional)

1. **Remove `user_credits` table** (after confirming everything works)
2. **Remove `default_organization_id`** (use organization_members lookup instead)
3. **Add constraint**: Every user must have exactly one owned organization
