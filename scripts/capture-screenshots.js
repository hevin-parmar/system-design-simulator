#!/usr/bin/env node
/**
 * Captures UI screenshots for GitHub README.
 * Prerequisites: Run `npm run server` and `npm run dev` in separate terminals first.
 * Then: node scripts/capture-screenshots.js
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'docs', 'screenshots')

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173'

async function main() {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    deviceScaleFactor: 2,
  })
  const page = await context.newPage()

  try {
    // Wait for app to load
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 15000 })
    await page.waitForSelector('.app', { timeout: 10000 })

    // Wait for initial design/diagram to load
    await page.waitForTimeout(3000)

    // 1. Main view - full app with diagram
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'main-view.png'),
      fullPage: false,
    })
    console.log('Saved: docs/screenshots/main-view.png')

    // 2. Ensure left panel is open and visible
    const leftClosed = await page.$('.leftPanel.collapsed')
    if (leftClosed) {
      await page.click('.leftPanel .panelToggle')
      await page.waitForTimeout(500)
    }
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'question-bank.png'),
      fullPage: false,
    })
    console.log('Saved: docs/screenshots/question-bank.png')

    // 3. Click first question to load a design (if not already loaded)
    const firstQuestion = await page.$('.questionItem, [data-question], .sidebar-item')
    if (firstQuestion) {
      await firstQuestion.click()
      await page.waitForTimeout(2000)
    }
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, 'diagram-with-design.png'),
      fullPage: false,
    })
    console.log('Saved: docs/screenshots/diagram-with-design.png')

    // 4. Open Generate Design wizard
    const wizardBtn = await page.$('button:has-text("Generate Design")')
    if (wizardBtn) {
      await wizardBtn.click()
      await page.waitForTimeout(800)
      const wizardModal = await page.$('[role="dialog"], .modal, .wizard')
      if (wizardModal) {
        await wizardModal.screenshot({
          path: path.join(SCREENSHOTS_DIR, 'design-wizard.png'),
        })
        console.log('Saved: docs/screenshots/design-wizard.png')
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
    }

    // 5. Start Interview / Game panel
    const startGameBtn = await page.$('button:has-text("Start Game")')
    if (startGameBtn) {
      await startGameBtn.click()
      await page.waitForTimeout(2000)
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'interview-panel.png'),
        fullPage: false,
      })
      console.log('Saved: docs/screenshots/interview-panel.png')
    }

    console.log('\nDone! Screenshots saved to docs/screenshots/')
  } catch (err) {
    console.error('Screenshot failed:', err.message)
    process.exit(1)
  } finally {
    await browser.close()
  }
}

main()
