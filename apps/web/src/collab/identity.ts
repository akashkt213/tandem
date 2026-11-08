import { useSyncExternalStore } from 'react'

/**
 * Who "you" are: the name and colour other people see on your cursor and in
 * the presence list. No auth in Phase 1, so this lives in localStorage only.
 */
export type Identity = {
  /** Random id, stable per browser. Lets the presence list merge your tabs into one entry. */
  id: string
  name: string
  color: string
  /** False until you've seen the name dialog once (saved or dismissed it). */
  confirmed: boolean
}

// Darker shades (Tailwind 600–700): Lexical draws cursor labels as white text on
// this colour, so lighter shades would be hard to read.
export const USER_COLORS = [
  '#dc2626', // red
  '#c2410c', // orange
  '#b45309', // amber
  '#15803d', // green
  '#0f766e', // teal
  '#0369a1', // sky
  '#2563eb', // blue
  '#7c3aed', // violet
  '#c026d3', // fuchsia
  '#db2777', // pink
] as const

export const MAX_NAME_LENGTH = 32

const STORAGE_KEY = 'collab-editor-identity'

const ADJECTIVES = ['Swift', 'Quiet', 'Bright', 'Clever', 'Brave', 'Calm', 'Lucky', 'Gentle']
const ANIMALS = ['Otter', 'Fox', 'Panda', 'Heron', 'Lynx', 'Koala', 'Falcon', 'Badger']

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

function createIdentity(): Identity {
  return {
    id: crypto.randomUUID(),
    name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
    color: pick(USER_COLORS),
    confirmed: false,
  }
}

function isIdentity(value: unknown): value is Identity {
  const v = value as Partial<Identity> | null
  return (
    typeof v?.id === 'string' &&
    typeof v.name === 'string' &&
    v.name.trim() !== '' &&
    typeof v.color === 'string' &&
    typeof v.confirmed === 'boolean'
  )
}

function readStored(): Identity | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return isIdentity(parsed) ? parsed : null
  } catch {
    // Blocked storage or bad JSON: fall back to a fresh identity.
    return null
  }
}

function write(identity: Identity) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // Storage unavailable: the identity still works for this tab.
  }
}

// One cached object, so useSyncExternalStore sees a stable snapshot between changes.
let current: Identity = readStored() ?? createIdentity()
write(current)

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

export function updateIdentity(changes: Partial<Omit<Identity, 'id'>>) {
  current = { ...current, ...changes }
  write(current)
  emit()
}

// Another tab renamed you: pick it up here too, so all your tabs agree.
// (The 'storage' event only fires in *other* tabs, never the one that wrote.)
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return
  const next = readStored()
  if (next) {
    current = next
    emit()
  }
})

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getIdentity(): Identity {
  return current
}

export function useIdentity(): Identity {
  return useSyncExternalStore(subscribe, getIdentity)
}
