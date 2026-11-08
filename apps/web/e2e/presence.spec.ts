import { editor, expect, focusEnd, openDoc, people, remoteCursor, test } from './fixtures.ts'

test('first visit asks for a name and remembers it', async ({ openUser }) => {
  const page = await openUser('unused', { firstVisit: true })

  const dialog = page.getByRole('dialog', { name: 'What should we call you?' })
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('Name').fill('Alice')
  await dialog.getByRole('button', { name: 'Save' }).click()

  await expect(dialog).toBeHidden()
  await expect(page.getByRole('banner')).toContainText('Alice')

  await page.reload()
  await expect(editor(page)).toBeVisible()
  await expect(page.getByRole('banner')).toContainText('Alice')
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('dismissing the name dialog keeps the suggested name', async ({ openUser }) => {
  const page = await openUser('unused', { firstVisit: true })

  const dialog = page.getByRole('dialog')
  const suggested = await dialog.getByLabel('Name').inputValue()
  expect(suggested).not.toBe('')
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.reload()
  await expect(editor(page)).toBeVisible()
  await expect(page.getByRole('banner')).toContainText(suggested)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('shows who is in the document', async ({ openUser }) => {
  const alice = await openUser('Alice', { color: '#2563eb' })
  const bob = await openUser('Bob', { color: '#dc2626' })

  for (const page of [alice, bob]) {
    await expect(page.getByText('Connected', { exact: true })).toBeVisible()
    await expect(people(page)).toHaveAccessibleName('2 people here')
  }

  // Cursors carry the chosen names. (Lexical only shows the cursor of someone
  // whose editor is focused.)
  await focusEnd(bob)
  await bob.keyboard.type('hi')
  await expect(remoteCursor(alice, 'Bob')).toBeVisible()
})

test('a rename shows up live for everyone', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  await focusEnd(alice)
  await expect(remoteCursor(bob, 'Alice')).toBeVisible()

  await alice.getByRole('banner').getByRole('button', { name: /Change name/ }).click()
  const dialog = alice.getByRole('dialog', { name: 'Edit your profile' })
  await dialog.getByLabel('Name').fill('Alicia')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(dialog).toBeHidden()

  // The dialog took focus; back into the editor so her cursor shows again.
  await focusEnd(alice)
  await expect(remoteCursor(bob, 'Alicia')).toBeVisible()

  // Renaming doesn't reconnect (PLAN.md pitfall 19): still online, edits still sync.
  await alice.keyboard.type('still connected')
  await expect(editor(bob)).toContainText('still connected')
  await expect(alice.getByText('Connected', { exact: true })).toBeVisible()
})

test('one person in two tabs counts once', async ({ openUser, docPath }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  // Same browser context = same saved identity, like a second tab.
  const aliceTab2 = await alice.context().newPage()
  await openDoc(aliceTab2, docPath)

  await expect(people(bob)).toHaveAccessibleName('2 people here')
  await expect(people(aliceTab2)).toHaveAccessibleName('2 people here')
})

test('someone who leaves disappears straight away', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')
  await expect(people(alice)).toHaveAccessibleName('2 people here')

  // Leaving with the editor focused used to leave a "ghost" for ~30 s
  // (PLAN.md pitfall 20), so focus it first.
  await focusEnd(bob)
  await bob.keyboard.type('bye')
  await expect(remoteCursor(alice, 'Bob')).toBeVisible()

  await bob.context().close()

  // Well under Yjs's 30 s awareness timeout: proves Bob was removed explicitly.
  await expect(people(alice)).toHaveAccessibleName('1 person here', { timeout: 5_000 })
  await expect(remoteCursor(alice, 'Bob')).toHaveCount(0)
})
