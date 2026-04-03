import { request, type FullConfig } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

type LoginResponse =
  | { success: true; token: string; user: unknown }
  | { success: false; error?: string }

async function createStorageState(opts: {
  baseURL: string
  email: string
  password: string
  storageStatePath: string
}) {
  const { baseURL, email, password, storageStatePath } = opts

  const api = await request.newContext({ baseURL })
  const resp = await api.post('/api/auth', {
    data: { action: 'login', email, password },
  })
  const json = (await resp.json()) as LoginResponse

  if (!resp.ok() || !json.success || !('token' in json)) {
    const message =
      (json && 'error' in json && json.error) ||
      `Login failed for ${email} (HTTP ${resp.status()})`
    throw new Error(message)
  }

  const { chromium } = await import('@playwright/test')
  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  // Establish origin storage by visiting baseURL first.
  await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('accessToken', token)
      localStorage.setItem('user', JSON.stringify(user))
    },
    { token: json.token, user: (json as any).user }
  )

  await context.storageState({ path: storageStatePath })
  await browser.close()
  await api.dispose()
}

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    config.projects[0]?.use?.baseURL?.toString() ||
    process.env.E2E_BASE_URL ||
    'http://localhost:3000'

  const kirbyEmail = process.env.E2E_KIRBY_EMAIL
  const kirbyPassword = process.env.E2E_KIRBY_PASSWORD
  const jawbEmail = process.env.E2E_JAWB_EMAIL
  const jawbPassword = process.env.E2E_JAWB_PASSWORD

  if (!kirbyEmail || !kirbyPassword || !jawbEmail || !jawbPassword) {
    throw new Error(
      [
        'Missing required env vars for E2E auth.',
        'Set E2E_KIRBY_EMAIL, E2E_KIRBY_PASSWORD, E2E_JAWB_EMAIL, E2E_JAWB_PASSWORD.',
      ].join(' ')
    )
  }

  const authDir = path.join(__dirname, '..', '.auth')
  fs.mkdirSync(authDir, { recursive: true })

  await createStorageState({
    baseURL,
    email: kirbyEmail,
    password: kirbyPassword,
    storageStatePath: path.join(authDir, 'kirby.json'),
  })

  await createStorageState({
    baseURL,
    email: jawbEmail,
    password: jawbPassword,
    storageStatePath: path.join(authDir, 'jawb.json'),
  })
}

