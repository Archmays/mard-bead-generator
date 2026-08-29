import { expect, test } from '@playwright/test'
import path from 'node:path'

const fixture = path.resolve('tests/fixtures/transparent-shapes.png')
const regressionFixtures = [
  'gradient-portrait.png',
  'checker-edges.png',
  'background-subject.png',
].map((name) => path.resolve('tests/fixtures', name))

async function generateClosest(page: import('@playwright/test').Page) {
  await page.getByLabel('上传 JPG、PNG 或 WebP 图片').setInputFiles(fixture)
  await expect(page.getByText('transparent-shapes.png')).toBeVisible()
  await page.getByText('最接近原图', { exact: true }).click()
  await page.getByTestId('generate-button').click()
  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 90_000 })
}

test('production build supports private local generation, limits, exports and mobile layout', async ({ page }) => {
  const postRequests: string[] = []
  const thirdPartyRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (request.method() === 'POST') postRequests.push(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) thirdPartyRequests.push(request.url())
  })

  await page.goto('/')
  await generateClosest(page)
  const closestColorCount = Number((await page.getByTestId('color-count').locator('strong').textContent())?.trim())
  expect(closestColorCount).toBeGreaterThan(0)
  await page.waitForTimeout(800)

  await expect(page.getByTestId('image-position')).toHaveText('水平 0% · 垂直 0%')
  await page.getByRole('button', { name: '图片向右移动' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('image-position')).toHaveText('水平 5% · 垂直 0%')

  await page.getByText('最少颜色拼豆', { exact: true }).click()
  await expect(page.getByTestId('color-limit')).toBeVisible()
  await page.getByTestId('color-limit').getByText('24', { exact: true }).click()
  await page.getByText('291 色 · 完整', { exact: true }).click()
  await page.getByLabel('自定义图纸宽度，10 到 200 颗').fill('200')
  await page.getByTestId('generate-button').click()
  const cancelButton = page.getByRole('button', { name: '取消生成' })
  await expect(cancelButton).toBeVisible()
  await cancelButton.click()
  await expect(page.getByTestId('result-panel')).toBeVisible()
  await expect(page.locator('.global-message')).toContainText('上次完整结果仍保留')

  await page.getByLabel('自定义图纸宽度，10 到 200 颗').fill('52')

  await page.getByTestId('color-limit').getByText('8', { exact: true }).click()
  await page.getByTestId('generate-button').click()
  await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 90_000 })
  const minimalColorCount = Number((await page.getByTestId('color-count').locator('strong').textContent())?.trim())
  expect(minimalColorCount).toBeLessThanOrEqual(8)
  expect(minimalColorCount).toBeLessThanOrEqual(closestColorCount)

  for (const testId of ['download-preview', 'download-chart', 'download-csv']) {
    const downloadPromise = page.waitForEvent('download')
    await page.getByTestId(testId).click()
    const download = await downloadPromise
    expect(await download.failure()).toBeNull()
  }
  const pdfDownloadPromise = page.waitForEvent('download', { timeout: 120_000 })
  await page.getByTestId('download-pdf').click()
  const pdfDownload = await pdfDownloadPromise
  expect(await pdfDownload.failure()).toBeNull()

  expect(postRequests).toEqual([])
  expect(thirdPartyRequests).toEqual([])

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await generateClosest(page)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
  await expect(page.getByTestId('download-csv')).toBeVisible()
})

test('all synthetic image classes complete deterministic local black-box generation', async ({ page }) => {
  const thirdPartyRequests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) thirdPartyRequests.push(request.url())
  })

  await page.goto('/')
  await page.getByText('最接近原图', { exact: true }).click()
  await page.getByRole('button', { name: '29', exact: true }).click()

  for (const imagePath of regressionFixtures) {
    await page.getByLabel('上传 JPG、PNG 或 WebP 图片').setInputFiles(imagePath)
    await page.getByTestId('generate-button').click()
    await expect(page.getByTestId('result-panel')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByTestId('color-count').locator('strong')).not.toHaveText('0')
  }

  expect(thirdPartyRequests).toEqual([])
})
