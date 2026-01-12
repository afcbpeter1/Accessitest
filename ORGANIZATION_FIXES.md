# Organization & Billing Fixes

## Issues Fixed

### 1. **Database Migration Required**
The database is missing new columns needed for the invitation system. You need to run:

**File: `migrations/004_fix_organization_invitations.sql`**

This migration adds:
- `invited_email` column to `organization_members` (for inviting users who don't exist yet)
- `invitation_token` column (for secure invitation links)
- Makes `user_id` nullable (so pending invitations work)
- Adds `sprint_board_id` to `teams` table (for sprint board configuration)

**To run the migration:**
```sql
-- Connect to your database and run the SQL file
-- Or use your migration tool
```

### 2. **Billing Model Clarification**

**Organizations are FREE** - No monthly fee per organization. You can create unlimited organizations.

**Only additional users cost money:**
- The organization owner is FREE (doesn't count against user limit)
- Each additional user beyond the owner requires payment
- Users are billed monthly or yearly based on your subscription plan

### 3. **Invitation Flow**

**NEW FLOW:**
1. ✅ **Invitations are FREE** - You can invite anyone without paying first
2. ✅ **Invite users who don't exist** - They'll get a signup link in the email
3. ✅ **Payment happens when they accept** - If you're at your user limit, they'll be told to wait or you'll need to add seats
4. ✅ **Email invitations now work** - Includes signup link for new users and accept link for existing users

### 4. **What Changed**

- ✅ Removed user limit check from invitation button (invitations are always allowed)
- ✅ Updated billing message to clarify you can still invite when at limit
- ✅ Fixed email service to include invitation tokens and signup links
- ✅ Updated `acceptInvitation` to check user limits only when accepting (not when inviting)
- ✅ Made organizations free (no per-org billing)

### 5. **Next Steps**

1. **Run the migration** (`migrations/004_fix_organization_invitations.sql`)
2. **Test the invitation flow:**
   - Invite an existing user
   - Invite a new user (who doesn't have an account)
   - Check that emails are sent
   - Verify that payment is only required when accepting (if at limit)

### 6. **Sprint Board Configuration**

Teams now have a `sprint_board_id` field. You'll need to:
- Add UI to select/configure sprint boards for each team
- Update the sprint board page to filter by team's sprint board


