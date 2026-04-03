import { test } from '@playwright/test'
import { assertLoggedIn } from './helpers/auth'

test('auth: can reach dashboard', async ({ page }) => {
  await assertLoggedIn(page)
})

