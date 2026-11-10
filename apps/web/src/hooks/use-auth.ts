import type { PublicUser } from '@collab/shared'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { authKeys, fetchCurrentUser, login, logout, signup } from '@/api/auth'

/**
 * The signed-in user. `user` is undefined while loading (the first request
 * after a page load), null for a guest, and the user once known.
 *
 * Every component calling this shares one cached request.
 */
export function useCurrentUser() {
  const query = useQuery({
    queryKey: authKeys.me,
    queryFn: ({ signal }) => fetchCurrentUser(signal),
    // Login, signup and logout update the cache directly, and a 401 anywhere
    // clears it (see query-client.ts), so there's no need to poll.
    staleTime: 5 * 60_000,
  })
  return {
    user: query.data,
    isLoading: query.isPending,
    isLoggedIn: query.data != null,
  }
}

/**
 * Switches the cache to a new session (a user, or null after logout).
 *
 * The user entry is updated in place rather than via queryClient.clear():
 * clear() would detach mounted components (the header) from the query they're
 * watching, so they'd keep showing the old user. Everything else cached belongs
 * to the old session, so it's reset: active queries refetch as the new user,
 * inactive ones are dropped.
 */
function switchSession(queryClient: QueryClient, user: PublicUser | null) {
  queryClient.setQueryData(authKeys.me, user)
  void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== authKeys.me[0] })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => switchSession(queryClient, user),
  })
}

export function useSignup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: signup,
    onSuccess: (user) => switchSession(queryClient, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    // Even if the request fails (offline), show the user as logged out: the
    // cookies are cleared or will be rejected on the next request anyway.
    onSettled: () => switchSession(queryClient, null),
  })
}
