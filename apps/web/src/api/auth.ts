import type { LoginInput, PublicUser, SignupInput } from '@collab/shared'
import { apiRequest, isApiError } from '@/lib/api-client'

// Plain functions for the /api/auth endpoints. Components don't call these
// directly; they use the hooks in '@/hooks/use-auth', which add caching.
// Inputs are the output of the shared Zod schemas (validated before sending).

type UserResponse = { user: PublicUser }

/** React Query cache keys for auth data. */
export const authKeys = {
  /** The signed-in user, or null for a guest. */
  me: ['auth', 'me'] as const,
}

/** The signed-in user, or null when nobody is (a guest is not an error). */
export async function fetchCurrentUser(signal?: AbortSignal): Promise<PublicUser | null> {
  try {
    const { user } = await apiRequest<UserResponse>('/auth/me', { signal })
    return user
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null
    throw error
  }
}

export async function signup(input: SignupInput): Promise<PublicUser> {
  const { user } = await apiRequest<UserResponse>('/auth/signup', { method: 'POST', body: input })
  return user
}

export async function login(input: LoginInput): Promise<PublicUser> {
  const { user } = await apiRequest<UserResponse>('/auth/login', { method: 'POST', body: input })
  return user
}

export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' })
}
