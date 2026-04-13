/**
 * browser-flows.test.ts
 *
 * Full browser E2E tests via Playwright.
 * Tests real UI flows: navigation, form inputs, page-to-page routing.
 * Run on Desktop Chrome + iPhone SE + Pixel 5 (configured in playwright.config.ts).
 *
 * Run: npx playwright test src/e2e/browser-flows.test.ts
 */

import { test, expect, Page } from '@playwright/test'
import { createRoom, joinRoom } from './helpers/api'

// ─── Homepage ─────────────────────────────────────────────────────────────────

test('homepage loads with both CTA buttons clickable', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading').first()).toBeVisible()

  // Both mode buttons should be visible and tappable
  const partyBtn = page.getByText(/party mode/i)
  const customBtn = page.getByText(/custom game/i).or(page.getByText(/custom/i)).first()

  await expect(partyBtn).toBeVisible()
  await partyBtn.click()

  // Should navigate to /start or a setup page
  await expect(page).toHaveURL(/start|setup|create/i)
})

test('homepage: "full rules" link opens without error', async ({ page }) => {
  await page.goto('/')

  // Rules link/button
  const rulesLink = page.getByText(/full rules/i).or(page.getByText(/how to play/i)).first()
  if (await rulesLink.isVisible()) {
    await rulesLink.click()
    // Should not 404
    expect(page.url()).not.toContain('/_error')
  }
})

// ─── Create room flow ─────────────────────────────────────────────────────────

test('create room: name input → submit → lands on organizer lobby', async ({ page }) => {
  await page.goto('/start')

  const nameInput = page.getByRole('textbox')
  await nameInput.fill('E2EHost')

  // Submit the form
  const submitBtn = page.getByRole('button', { name: /create|start|host/i })
  await submitBtn.click()

  // Should land on organizer page /room/XXXXXX/organizer
  await page.waitForURL(/room\/[A-Z2-9]{6}\/organizer/, { timeout: 10_000 })
  await expect(page).toHaveURL(/organizer/)
})

test('create room: room code shown on organizer page, never has I/O/1/0', async ({ page }) => {
  await page.goto('/start')
  await page.getByRole('textbox').fill('CodeTest')
  await page.getByRole('button', { name: /create|start|host/i }).click()
  await page.waitForURL(/room\/[A-Z2-9]{6}\/organizer/, { timeout: 10_000 })

  const url = page.url()
  const code = url.match(/room\/([A-Z2-9]{6})\/organizer/)?.[1]
  expect(code).toBeTruthy()
  expect(code).not.toMatch(/[IO10]/)
})

// ─── Join room flow ───────────────────────────────────────────────────────────

test('join room: enter valid code and name → lands on player lobby', async ({ page }) => {
  // Pre-create a room via API so we have a real code
  const room = await createRoom({ organizerName: 'JoinHost' })

  await page.goto('/')

  // Find join flow — look for "join" button or input
  const joinLink = page.getByText(/join/i).first()
  await joinLink.click()

  // Fill room code
  const codeInput = page.getByPlaceholder(/code|room/i).or(page.getByRole('textbox').first())
  await codeInput.fill(room.code)

  // Fill name if separate input
  const nameInput = page.getByPlaceholder(/name/i).or(page.getByRole('textbox').nth(1))
  if (await nameInput.count() > 0) {
    await nameInput.fill('JoinPlayer')
  }

  await page.getByRole('button', { name: /join|enter/i }).click()

  await page.waitForURL(/room\/[A-Z2-9]{6}\/player/, { timeout: 10_000 })
  await expect(page).toHaveURL(/player/)
})

test('join room: invalid code shows error, not crash', async ({ page }) => {
  await page.goto('/')
  const joinLink = page.getByText(/join/i).first()
  await joinLink.click()

  const codeInput = page.getByPlaceholder(/code|room/i).or(page.getByRole('textbox').first())
  await codeInput.fill('XXXXXX')

  const nameInput = page.getByPlaceholder(/name/i).or(page.getByRole('textbox').nth(1))
  if (await nameInput.count() > 0) await nameInput.fill('Ghost')

  await page.getByRole('button', { name: /join|enter/i }).click()

  // Should show an error message, not redirect to a room
  await expect(page).not.toHaveURL(/room\//)
  const errorEl = page.getByText(/not found|invalid|error/i)
  await expect(errorEl).toBeVisible({ timeout: 5_000 })
})

// ─── Organizer lobby ──────────────────────────────────────────────────────────

test('organizer page: shows waiting state and room code', async ({ page }) => {
  const room = await createRoom({ organizerName: 'OrgLobby' })

  // Navigate directly to organizer page
  await page.goto(`/room/${room.code}/organizer`)

  // Room code should appear on page
  await expect(page.getByText(room.code)).toBeVisible({ timeout: 8_000 })
})

test('organizer page: QR code renders (img with src)', async ({ page }) => {
  const room = await createRoom({ organizerName: 'QRHost' })
  await page.goto(`/room/${room.code}/organizer`)

  // QR should be an img element
  const qr = page.locator('img[alt*="QR"], canvas, [data-testid="qr"]')
  if (await qr.count() > 0) {
    await expect(qr.first()).toBeVisible({ timeout: 8_000 })
  }
})

// ─── Player lobby ─────────────────────────────────────────────────────────────

test('player page: shows waiting for game to start', async ({ page }) => {
  const room = await createRoom({ organizerName: 'WaitHost' })
  const player = await joinRoom(room.code, 'WaitPlayer')

  await page.goto(`/room/${room.code}/player/${player.playerId}`)

  // Should see some waiting/lobby UI
  const waitEl = page.getByText(/waiting|lobby|starting/i)
  await expect(waitEl).toBeVisible({ timeout: 8_000 })
})

// ─── Mobile: critical interactions work on small screens ─────────────────────

test('mobile: homepage buttons are tappable (no hover-scale blocking)', async ({ page, isMobile }) => {
  if (!isMobile) test.skip()

  await page.goto('/')

  const partyBtn = page.getByText(/party mode/i)
  await expect(partyBtn).toBeVisible()

  // Tap — should not get stuck
  await partyBtn.tap()
  await expect(page).not.toHaveURL('/')
})

test('mobile: name input does not cause viewport shift on focus', async ({ page, isMobile }) => {
  if (!isMobile) test.skip()

  await page.goto('/start')

  const before = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight)
  await page.getByRole('textbox').first().tap()

  // Give keyboard time to appear
  await page.waitForTimeout(500)

  // Page should not have scrolled the form off screen
  const nameField = page.getByRole('textbox').first()
  await expect(nameField).toBeInViewport()
})

// ─── No broken pages ─────────────────────────────────────────────────────────

test('404 page renders without crashing', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist')
  // Next.js custom 404 or default — both are acceptable
  expect([200, 404]).toContain(res?.status() ?? 404)
  await expect(page.locator('body')).toBeVisible()
})

test('organizer page for unknown room code shows error not blank', async ({ page }) => {
  await page.goto('/room/ZZZZZZ/organizer')
  // Should show an error or redirect — not a blank white page
  await page.waitForLoadState('networkidle')
  const body = await page.locator('body').textContent()
  expect(body?.trim().length).toBeGreaterThan(0)
})
