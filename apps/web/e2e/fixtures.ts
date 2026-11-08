import { test as base, expect, type BrowserContext, type Page } from '@playwright/test'

// Must match STORAGE_KEY in src/collab/identity.ts.
const IDENTITY_KEY = 'collab-editor-identity'

type OpenUserOptions = {
  /** Cursor colour. */
  color?: string
  /**
   * Start as a first-time visitor (no saved name), so the name dialog opens.
   * Otherwise the user already has a saved name and the dialog stays closed.
   */
  firstVisit?: boolean
}

type Fixtures = {
  /** A brand-new document for this test (path only, e.g. /doc/e2e-…). */
  docPath: string
  /**
   * Open the test's document as a new user: a fresh browser context (own
   * localStorage, own connection), like a different person on another computer.
   * Resolves once the editor has the document's content.
   */
  openUser: (name: string, options?: OpenUserOptions) => Promise<Page>
}

export const test = base.extend<Fixtures>({
  // oxlint-disable-next-line no-empty-pattern -- Playwright fixtures must destructure their first argument.
  docPath: async ({}, use, testInfo) => {
    // Unique per test and per retry, so tests never see each other's text.
    const random = Math.random().toString(36).slice(2, 8)
    await use(`/doc/e2e-${testInfo.workerIndex}-${testInfo.retry}-${random}`)
  },

  openUser: async ({ browser, docPath }, use) => {
    const contexts: BrowserContext[] = []

    await use(async (name, { color = '#2563eb', firstVisit = false } = {}) => {
      const context = await browser.newContext()
      contexts.push(context)
      if (!firstVisit) {
        // Runs before the app's scripts, so the app starts with this identity.
        await context.addInitScript(
          ([key, identity]) => localStorage.setItem(key, identity),
          [IDENTITY_KEY, JSON.stringify({ id: `e2e-${name}`, name, color, confirmed: true })] as const,
        )
      }
      const page = await context.newPage()
      await openDoc(page, docPath)
      return page
    })

    await Promise.all(contexts.map((context) => context.close()))
  },
})

export { expect }

/** The editor's content area. */
export function editor(page: Page) {
  return page.locator('[contenteditable="true"]')
}

/**
 * Go to the document and wait until it has synced: the editor starts with an
 * empty root and gets its first block from the server (or, for a new document,
 * from bootstrapping after the initial sync).
 */
export async function openDoc(page: Page, docPath: string) {
  await page.goto(docPath)
  await expect(editor(page).locator('p, h1, h2, h3, ul, ol, blockquote').first()).toBeAttached()
}

/** Click at the end of the document, so typing appends. */
export async function focusEnd(page: Page) {
  await editor(page).click()
  await page.keyboard.press('Control+End')
}

/** The presence avatars, labelled "N people here". */
export function people(page: Page) {
  return page.getByRole('group', { name: /(person|people) here/ })
}

/** A remote user's cursor label, as drawn by Lexical. */
export function remoteCursor(page: Page, name: string) {
  return page.getByTestId('remote-cursors').getByText(name, { exact: true })
}
