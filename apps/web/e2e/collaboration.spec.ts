import { editor, expect, focusEnd, test } from './fixtures.ts'

test('edits sync between two users, both ways', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  // A new document gets exactly one first paragraph, even with two people:
  // only the first client to sync bootstraps it.
  await expect(editor(alice).locator('p')).toHaveCount(1)
  await expect(editor(bob).locator('p')).toHaveCount(1)

  await focusEnd(alice)
  await alice.keyboard.type('Hello from Alice')
  await expect(editor(bob)).toContainText('Hello from Alice')

  await focusEnd(bob)
  await bob.keyboard.press('Enter')
  await bob.keyboard.type('Reply from Bob')
  await expect(editor(alice)).toContainText('Reply from Bob')

  // Both end up with the same two paragraphs, in the same order.
  await expect(editor(alice).locator('p')).toHaveText(['Hello from Alice', 'Reply from Bob'])
  await expect(editor(bob).locator('p')).toHaveText(['Hello from Alice', 'Reply from Bob'])
})

test('formatting syncs', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  await focusEnd(alice)
  await alice.keyboard.type('plain ')
  await alice.keyboard.press('Control+b')
  await alice.keyboard.type('bold')

  await expect(editor(bob).locator('strong', { hasText: 'bold' })).toBeVisible()
})

test('a late joiner sees the existing content', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  await focusEnd(alice)
  await alice.keyboard.type('First line')
  await focusEnd(bob)
  await bob.keyboard.press('Enter')
  await bob.keyboard.type('Second line')
  await expect(editor(alice)).toContainText('Second line')

  // Carol arrives after the edits: she gets the document from the server...
  const carol = await openUser('Carol')
  await expect(editor(carol).locator('p')).toHaveText(['First line', 'Second line'])
  // ...and doesn't bootstrap an extra paragraph into a non-empty document.
  await expect(editor(alice).locator('p')).toHaveCount(2)
})

test('undo only reverts your own edits', async ({ openUser }) => {
  const alice = await openUser('Alice')
  const bob = await openUser('Bob')

  await focusEnd(alice)
  await alice.keyboard.type('Alice was here')
  await focusEnd(bob)
  await bob.keyboard.press('Enter')
  await bob.keyboard.type('Bob was here')
  await expect(editor(alice)).toContainText('Bob was here')

  // The Yjs UndoManager tracks only local changes.
  await alice.getByRole('button', { name: 'Undo' }).click()

  for (const page of [alice, bob]) {
    await expect(editor(page)).not.toContainText('Alice was here')
    await expect(editor(page)).toContainText('Bob was here')
  }
})
