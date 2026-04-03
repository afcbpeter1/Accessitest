import { expect, test } from '@playwright/test'
import { getAccessToken } from './helpers/auth'

async function fetchEffectiveIntegrations(page: any) {
  const token = await getAccessToken(page)
  const [jira, ado] = await Promise.all([
    page.request
      .get('/api/jira/settings/effective', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r: any) => r.json())
      .catch(() => null),
    page.request
      .get('/api/azure-devops/settings/effective', {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r: any) => r.json())
      .catch(() => null),
  ])

  return {
    jiraConnected: !!(jira && jira.success && jira.integration),
    adoConnected: !!(ado && ado.success && ado.integration),
  }
}

test('backlog: page loads and integration actions match effective settings', async ({
  page,
}) => {
  const eff = await fetchEffectiveIntegrations(page)

  await page.goto('/product-backlog', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Product Backlog' })).toBeVisible()

  // Bulk action buttons only appear when there are selected items AND integration is connected.
  // We can still assert that the connected state is reflected by per-item integration menus.
  const integrationMenuButtons = page.getByRole('button', {
    name: /Add to Jira or Azure DevOps|Add to Jira|Add to Azure DevOps/i,
  })

  if (eff.jiraConnected || eff.adoConnected) {
    // If backlog is empty, there may be no items to show menus for.
    // In that case, we just assert the page is functional.
    const empty = page.getByText(/No backlog items found/i)
    if (!(await empty.isVisible().catch(() => false))) {
      await expect(integrationMenuButtons.first()).toBeVisible()
    }
  } else {
    await expect(integrationMenuButtons).toHaveCount(0)
  }
})

