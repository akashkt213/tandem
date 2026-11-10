import { QueryCache, QueryClient } from '@tanstack/react-query'
import { authKeys } from '@/api/auth'
import { isApiError } from '@/lib/api-client'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    // A query got 401 even after apiRequest tried to refresh: the session is
    // over (expired, or logged out in another tab). Mark the user as logged out
    // so the header and any protected pages update.
    onError: (error) => {
      if (isApiError(error) && error.status === 401) {
        queryClient.setQueryData(authKeys.me, null)
      }
    },
  }),
  defaultOptions: {
    queries: {
      // Retrying a 4xx (bad request, not found, forbidden) gives the same
      // answer; only retry network failures and server errors.
      retry: (failureCount, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
      staleTime: 30_000,
    },
    mutations: {
      // Never repeat a signup or login automatically.
      retry: false,
    },
  },
})
