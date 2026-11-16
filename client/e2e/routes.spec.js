import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Final plan Phase 7, item 12: every parent and child route at 320 px wide (reflow, WCAG 1.4.10: the 400% zoom of a 1280 px
// screen, so 200% is covered too), with reduced motion, checked with axe for anything serious or critical and for content wider
// than the screen. Then two pages again with forced colours (Windows high contrast). A throwaway family is made through the API
// and deleted at the end.

const stamp = Date.now().toString(36)
const parent = { name: 'Routes Parent', email: `routes-${stamp}@example.com`, password: `e2e-grown-${stamp}`, country: 'IN', consent: true }
const child = { name: 'Router', username: `rt${stamp}`.slice(0, 20), password: `e2e-small-${stamp}`, consent: true }
const headers = { 'x-growkid': '1' }
const DAY = 86_400_000

/** Waits for the page's data, then fails on axe findings that matter and on anything that runs past the right edge. */
async function check(tab, path, { rules } = {}) {
  await tab.goto(path)
  await tab.waitForLoadState('networkidle')
  await expect(tab.locator('.skeleton')).toHaveCount(0)
  await expect(tab.getByText(/This page did not load|could not be found/i)).toHaveCount(0) // a page that failed would pass axe too
  expect(new URL(tab.url()).pathname).toBe(path) // and not sent elsewhere by a guard
  const builder = new AxeBuilder({ page: tab })
  if (rules) builder.disableRules(rules)
  const { violations } = await builder.analyze()
  const bad = violations.filter((v) => ['serious', 'critical'].includes(v.impact)).map((v) => `${path}: ${v.id} (${v.nodes.map((n) => n.target).join(', ')})`)
  const wide = await tab.evaluate(() =>
    [...document.querySelectorAll('main *')]
      .filter((e) => {
        const box = e.getBoundingClientRect()
        return box.width > 0 && box.right > window.innerWidth + 1
      })
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')}`)
      .slice(0, 5),
  )
  expect([...bad, ...wide.map((w) => `${path}: wider than the screen: ${w}`)]).toEqual([])
}

test('every route reflows at 320 px and passes axe, with reduced motion and with forced colours', async ({ browser }) => {
  const options = { baseURL: 'http://127.0.0.1:4173', viewport: { width: 320, height: 720 }, reducedMotion: 'reduce' }
  const mom = await (await browser.newContext(options)).newPage()
  const kid = await (await browser.newContext(options)).newPage()
  try {
    for (const path of ['/', '/privacy', '/login', '/signup']) await check(mom, path) // signed out first: a signed-in parent is sent on from these
    // a family with something on every page: a reward, a repeating task, a task to do, one waiting and one approved
    expect((await mom.request.post('/api/parents', { headers, data: parent })).status()).toBe(201)
    const { id: childId } = await (await mom.request.post('/api/children', { headers, data: child })).json()
    await mom.request.post('/api/rewards', { headers, data: { title: 'Pick the film', cost: 20 } })
    await mom.request.post('/api/series', { headers, data: { childId, category: 'chores', title: 'Feed the cat', instructions: 'One scoop.', points: 10, weekdays: 127, dueTime: '18:00' } })
    const task = async (title, days) =>
      (await (await mom.request.post('/api/tasks', { headers, data: { childId, category: 'reading', title, instructions: 'One chapter.', points: 20, dueAt: new Date(Date.now() + days * DAY).toISOString() } })).json()).id
    const open = await task('Read a chapter', 3)
    const waiting = await task('Read a poem', 2)
    const done = await task('Read a story', 1)
    expect((await kid.request.post('/api/session', { headers, data: { identifier: child.username, password: child.password } })).status()).toBe(200)
    for (const id of [waiting, done]) await kid.request.post(`/api/tasks/${id}/proofs`, { headers, multipart: { note: 'Done it.' } })
    const proofs = (await (await mom.request.get(`/api/tasks/${done}`)).json()).proofs
    await mom.request.post(`/api/tasks/${done}/review`, { headers, data: { proofId: proofs[0].id, result: 'approved', cheer: { kind: 'proud', line: '' } } })
    await kid.request.post('/api/suggestions', { headers, data: { ideaId: 'chores-2' } })

    for (const path of ['/privacy', '/report', '/parent', '/parent/tasks', '/parent/tasks/new', `/parent/tasks/${waiting}`, `/parent/tasks/${open}/edit`,
      '/parent/rewards', `/parent/progress/${childId}`, '/parent/family', '/parent/family/new', `/parent/family/${childId}`, '/parent/settings']) {
      await check(mom, path)
    }
    for (const path of ['/child', `/child/tasks/${open}`, `/child/tasks/${done}`, '/child/growth', '/child/stickers', '/child/rewards', '/report']) {
      await check(kid, path)
    }
    // forced colours: the system draws the colours, so axe's contrast sums do not apply; everything else must still hold
    for (const tab of [mom, kid]) await tab.emulateMedia({ forcedColors: 'active' })
    await check(mom, '/parent', { rules: ['color-contrast'] })
    await check(kid, '/child', { rules: ['color-contrast'] })
    // the moderator's page, as the seeded demo moderator (a moderator is only ever made by a script, so the test cannot make one)
    const mod = await (await browser.newContext(options)).newPage()
    const moderator = await mod.request.post('/api/session', { headers, data: { identifier: 'moderator@example.com', password: 'growkid-demo' } })
    if (moderator.status() === 200) await check(mod, '/admin/reports')
    else test.info().annotations.push({ type: 'note', description: 'no demo moderator in this database, so /admin/reports was not checked' })
  } finally {
    const gone = await mom.request.post('/api/me/delete', { headers, data: { password: parent.password } })
    expect([204, 401]).toContain(gone.status())
  }
})
