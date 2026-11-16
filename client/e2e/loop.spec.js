import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// The whole loop, in the built app: a throwaway family signs up, sets a task, proves it, approves it, spends the points, and is
// deleted. Every page visited is checked with axe, and a Content-Security-Policy violation anywhere fails the test.

/** Axe findings that exist today and wait for Phase 7's accessibility item. Nothing else serious or critical may appear. */
const KNOWN = []

const stamp = Date.now().toString(36)
const parent = { name: 'Loop Parent', email: `loop-${stamp}@example.com`, password: `e2e-grown-${stamp}` }
const child = { name: 'Looper', username: `loop${stamp}`.slice(0, 20), password: `e2e-small-${stamp}` }

test('a family signs up, a task is set, proved and approved, a reward is asked for and given, and the family is deleted', async ({ page, browser }) => {
  const violations = []
  const watch = (tab) => tab.on('console', (message) => /Content Security Policy/i.test(message.text()) && violations.push(message.text()))
  const accessible = async (tab) => {
    const { violations: found } = await new AxeBuilder({ page: tab }).analyze()
    const bad = found.filter((v) => ['serious', 'critical'].includes(v.impact) && !KNOWN.includes(v.id))
    expect(bad.map((v) => `${new URL(tab.url()).pathname}: ${v.id} (${v.nodes.map((n) => n.target).join(', ')})`)).toEqual([])
  }
  watch(page)
  // Reduced motion in both, so axe never measures a colour halfway through a transition.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const kid = await (await browser.newContext({ baseURL: 'http://127.0.0.1:4173', reducedMotion: 'reduce' })).newPage()
  watch(kid)

  try {
    await test.step('the parent signs up', async () => {
      await page.goto('/')
      await accessible(page)
      await page.goto('/signup')
      await page.getByLabel('Your name').fill(parent.name)
      await page.getByLabel('Email').fill(parent.email)
      await page.getByLabel('Password', { exact: true }).fill(parent.password)
      await page.getByLabel('Country').selectOption('IN')
      await page.getByLabel(/I am the parent or guardian/).check()
      await accessible(page)
      await page.getByRole('button', { name: 'Create account' }).click()
      await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible()
      await accessible(page)
    })

    await test.step('the parent adds a child', async () => {
      await page.getByRole('main').getByRole('link', { name: 'Add a child' }).first().click() // H9: the first steps link there too
      await page.getByLabel(/Child.s name/).fill(child.name)
      await page.getByLabel('Username').fill(child.username)
      await page.getByLabel('Password', { exact: true }).fill(child.password)
      await page.getByLabel(/parent or guardian, and I agree/).check() // C8
      await accessible(page)
      await page.getByRole('button', { name: 'Add child' }).click()
      await expect(page.getByRole('heading', { name: `${child.name} can now sign in` })).toBeVisible()
      await accessible(page)
    })

    await test.step('the parent creates a task', async () => {
      await page.getByRole('link', { name: 'Create the first task' }).click()
      await page.getByText('Chores', { exact: true }).click()
      await page.getByLabel('Title').fill('Water the plants')
      await page.getByLabel('What to do').fill('Water them and send a photo.')
      // tomorrow, as a datetime-local field takes it
      await page.getByLabel('Due', { exact: true }).fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 16))
      await accessible(page)
      await page.getByRole('button', { name: 'Create task' }).click()
      await expect(page).toHaveURL(/\/parent\/tasks$/)
      await accessible(page)
    })

    await test.step('the child signs in and sends a photo as proof', async () => {
      await kid.goto('/login')
      await kid.getByLabel('Email or username').fill(child.username)
      await kid.getByLabel('Password', { exact: true }).fill(child.password)
      await accessible(kid)
      await kid.getByRole('button', { name: 'Sign in' }).click()
      await expect(kid.getByRole('heading', { name: 'Today' })).toBeVisible()
      await accessible(kid)
      await kid.getByRole('link', { name: 'Send proof' }).click()
      // a real JPEG, drawn here so the repository holds no binary fixture
      const jpeg = await kid.evaluate(() => {
        const canvas = document.createElement('canvas')
        canvas.width = 64
        canvas.height = 48
        const pen = canvas.getContext('2d')
        pen.fillStyle = '#2b7'
        pen.fillRect(0, 0, 64, 48)
        return canvas.toDataURL('image/jpeg').split(',')[1]
      })
      await kid.locator('input[type=file]').first().setInputFiles({ name: 'plants.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') })
      await expect(kid.getByAltText('The photo you chose')).toBeVisible()
      await accessible(kid)
      await kid.getByRole('button', { name: 'Send proof' }).click()
      await expect(kid.getByText('Proof sent')).toBeVisible()
      await accessible(kid)
    })

    await test.step('the parent approves it', async () => {
      await page.getByRole('link', { name: 'Water the plants' }).click()
      await expect(page.getByAltText(`Proof from ${child.name} for Water the plants`)).toBeVisible()
      await accessible(page)
      await page.getByRole('button', { name: 'Approve' }).click()
      await expect(page.getByText(`Approved. ${child.name} earned 20 points`)).toBeVisible()
      await accessible(page)
    })

    await test.step('the child sees the reward moment', async () => {
      await kid.goto('/child')
      await expect(kid.getByText('+20 XP for Water the plants')).toBeVisible()
      await expect(kid.getByText('New sticker')).toBeVisible()
      await accessible(kid)
    })

    await test.step('the parent adds a reward, the child asks for it, and the parent gives it', async () => {
      await page.goto('/parent/rewards')
      await page.getByLabel('What it is').fill('Pick the film')
      await page.getByLabel('Cost in points').fill('20')
      await accessible(page)
      await page.getByRole('button', { name: 'Add reward' }).click()
      await expect(page.getByText('Reward saved.')).toBeVisible()
      await kid.goto('/child/rewards')
      await expect(kid.getByRole('button', { name: /Ask for this.*Pick the film/ })).toBeVisible()
      await accessible(kid)
      await kid.getByRole('button', { name: /Ask for this.*Pick the film/ }).click()
      await accessible(kid)
      await kid.getByRole('button', { name: 'Yes, ask' }).click()
      await expect(kid.getByText('Waiting for a parent')).toBeVisible()
      await accessible(kid)
      await page.reload()
      await page.getByRole('button', { name: /^Give/ }).click()
      await expect(page.getByText(`Given. Tell ${child.name} when it is ready.`)).toBeVisible()
      await accessible(page)
      await kid.reload()
      await expect(kid.getByText('Given', { exact: true })).toBeVisible()
    })

    await test.step('the parent deletes the family, and neither can sign in again', async () => {
      await page.goto('/parent/settings')
      await accessible(page)
      await page.getByRole('button', { name: /Delete the family.s data/ }).click()
      await page.getByLabel('Your password').fill(parent.password)
      await accessible(page)
      await page.getByRole('button', { name: 'Delete everything' }).click()
      await expect(page).not.toHaveURL(/\/parent/)
      await accessible(page)
      for (const [identifier, password] of [[parent.email, parent.password], [child.username, child.password]]) {
        const signIn = await page.request.post('/api/session', { headers: { 'x-growkid': '1' }, data: { identifier, password } })
        expect(signIn.status()).toBe(401)
      }
    })
  } finally {
    // The family goes whatever happened above, so a failed run leaves nothing in the database.
    const gone = await page.request.post('/api/me/delete', { headers: { 'x-growkid': '1' }, data: { password: parent.password } })
    expect([204, 401]).toContain(gone.status())
  }
  expect(violations).toEqual([])
})
