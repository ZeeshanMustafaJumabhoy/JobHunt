import { expect, test } from '@playwright/test'
import { sampleJobs, useFakeApi } from './fake-api'

const shots = process.env.SHOTS_DIR
async function snap(page: import('@playwright/test').Page, name: string, projectName: string) {
  if (shots) await page.screenshot({ path: `${shots}/${projectName}-${name}.png`, fullPage: true })
}

test('a new user completes setup in order and lands on a running search', async ({ page }, info) => {
  const api = await useFakeApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Find the jobs you can actually get.' })).toBeVisible()
  await snap(page, '01-welcome', info.project.name)
  await page.getByRole('button', { name: 'Start setup' }).click()

  // Nothing past the AI key is reachable until the key is saved.
  await expect(page.getByRole('heading', { name: 'Connect the AI' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByLabel('Groq API key').fill('not-a-key')
  await page.getByRole('button', { name: 'Test and save' }).click()
  await expect(page.getByRole('alert')).toContainText('Groq rejected this key')
  await page.getByLabel('Groq API key').fill('gsk_realistic_key_123')
  await page.getByRole('button', { name: 'Test and save' }).click()
  await expect(page.getByText('Saved', { exact: false }).first()).toBeVisible()
  await snap(page, '02-ai-key', info.project.name)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Add your resume' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeDisabled()
  await page.getByLabel('Resume file').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 fake') })
  await expect(page.getByText('Sara Khan')).toBeVisible()
  await expect(page.getByRole('list', { name: 'Skills' })).toContainText('Playwright')
  await snap(page, '03-resume', info.project.name)
  await page.getByRole('button', { name: 'Remove Java' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.calls.find((c) => c.path === '/api/profile' && (c.body as { skills?: string[] })?.skills)?.body).toMatchObject({
    years_experience: 4,
  })
  expect(api.profile.skills).not.toContain('Java')

  await expect(page.getByRole('heading', { name: 'Which jobs should it look for?' })).toBeVisible()
  await page.getByRole('button', { name: 'Software Engineer in Test' }).click()
  await page.getByLabel('Add a title').fill('QA Lead')
  await page.keyboard.press('Enter')
  await snap(page, '04-titles', info.project.name)
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.titles).toEqual(['QA Automation Engineer', 'SDET', 'Test Automation Engineer', 'Software Engineer in Test', 'QA Lead'])

  await expect(page.getByRole('heading', { name: 'How do you want to work?' })).toBeVisible()
  await page.getByRole('checkbox', { name: /On-site/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.work_modes).toEqual(['remote', 'hybrid'])

  await expect(page.getByRole('heading', { name: 'Where do you want to work?' })).toBeVisible()
  await expect(page.getByLabel('The country you live in now')).toHaveValue('PK')
  await page.getByRole('button', { name: 'Gulf (GCC)' }).click()
  await page.getByLabel('Find a country').fill('germ')
  await page.keyboard.press('Enter')
  await snap(page, '05-places', info.project.name)
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.target_countries).toEqual(['AE', 'SA', 'QA', 'KW', 'BH', 'OM', 'DE'])

  await expect(page.getByRole('heading', { name: /visa to work outside Pakistan/ })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'How much of a stretch is fine?' })).toBeVisible()
  await snap(page, '06-experience', info.project.name)
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.max_years_required).toBe(8)

  await expect(page.getByRole('heading', { name: "What's the least you'd accept?" })).toBeVisible()
  await page.getByLabel('Minimum salary').fill('abc')
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('alert')).toContainText('number')
  await page.getByLabel('Minimum salary').fill('2,500')
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.salary.minimum).toBe(2500)

  await expect(page.getByRole('heading', { name: 'Anything to rule out?' })).toBeVisible()
  await page.getByLabel('Dealbreakers (optional)').fill('No night shifts.')
  await page.getByRole('button', { name: 'Continue' }).click()
  expect(api.profile.dealbreakers).toBe('No night shifts.')

  await expect(page.getByRole('heading', { name: 'How recent should postings be?' })).toBeVisible()
  await page.getByRole('button', { name: 'Last 14 days' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Where should it search?' })).toBeVisible()
  await snap(page, '07-sources', info.project.name)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Get the shortlist by email' })).toBeVisible()
  await page.getByRole('button', { name: 'Skip email' }).click()

  await expect(page.getByRole('heading', { name: 'Ready for your first search' })).toBeVisible()
  await expect(page.getByText('Last 14 days').or(page.getByText('14 days'))).toBeVisible()
  await snap(page, '08-review', info.project.name)
  await page.getByRole('button', { name: 'Run my first search' }).click()

  await expect(page.getByRole('heading', { name: "Sara's shortlist" })).toBeVisible()
  await expect(page.getByRole('progressbar')).toBeVisible()
  expect(api.profile.setup_complete).toBe(true)
})

test('closing the tab mid-setup resumes on the same step', async ({ page }) => {
  await useFakeApi(page, {
    keys: ['GROQ_API_KEY'],
    profile: { has_resume: true, skills: ['SQL'], titles: ['Data Analyst'], setup_step: 'salary' },
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "What's the least you'd accept?" })).toBeVisible()
})

test('a saved step is never past what the answers allow', async ({ page }) => {
  // The saved step says salary, but there is no Groq key, so it must open on the key step.
  await useFakeApi(page, { profile: { setup_step: 'salary' } })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Connect the AI' })).toBeVisible()
})

test('the dashboard groups jobs by tier and moves them between lists', async ({ page }, info) => {
  await useFakeApi(page, {
    keys: ['GROQ_API_KEY'],
    jobs: sampleJobs,
    profile: { setup_complete: true, name: 'Sara Khan', titles: ['QA Automation Engineer', 'SDET'], skills: ['Playwright'] },
  })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: "Sara's shortlist" })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Apply now/ })).toContainText('2')
  await expect(page.getByRole('heading', { name: /Strong match/ })).toBeVisible()
  await expect(page.getByText('Pays below your minimum')).toBeVisible()
  await page.getByRole('button', { name: 'Skills and details' }).first().click()
  await expect(page.getByText('They also want')).toBeVisible()
  await snap(page, '09-dashboard', info.project.name)

  await page.getByRole('button', { name: 'I applied' }).first().click()
  await expect(page.getByRole('heading', { name: /Apply now/ })).toContainText('1')
  await page.getByRole('tab', { name: 'Applied' }).click()
  await expect(page.getByRole('link', { name: 'QA Automation Engineer' })).toBeVisible()

  await page.getByRole('tab', { name: 'To review' }).click()
  await page.getByLabel('Show').selectOption({ label: 'Remote worldwide' })
  await expect(page.getByRole('link', { name: 'Software Engineer in Test' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Senior SDET, Payments' })).toHaveCount(0)
})

test('job links only open http and https urls', async ({ page }) => {
  const evil = { ...sampleJobs[0], id: 'x', url: 'javascript:alert(1)' }
  await useFakeApi(page, { keys: ['GROQ_API_KEY'], jobs: [evil], profile: { setup_complete: true, titles: ['QA'] } })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'QA Automation Engineer' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'QA Automation Engineer' })).toHaveCount(0)
})

test('settings saves a section without leaving the page', async ({ page }, info) => {
  const api = await useFakeApi(page, {
    keys: ['GROQ_API_KEY'],
    profile: { setup_complete: true, has_resume: true, titles: ['SDET'], suggested_titles: ['SDET', 'QA Engineer'], skills: ['Playwright'] },
  })
  await page.goto('/#/settings')
  await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible()
  const recency = page.locator('#freshness')
  await recency.getByRole('button', { name: 'Last 7 days' }).click()
  await recency.getByRole('button', { name: 'Save' }).click()
  await expect(recency.getByText('Saved')).toBeVisible()
  expect(api.profile.max_age_days).toBe(7)
  await expect(page).toHaveURL(/#\/settings/)
  await snap(page, '10-settings', info.project.name)
})
