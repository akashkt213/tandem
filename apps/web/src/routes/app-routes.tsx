import { Route, Routes } from 'react-router'
import DocPage from '@/pages/DocPage'
import HomePage from '@/pages/HomePage'
import LoginPage from '@/pages/LoginPage'
import NotFoundPage from '@/pages/NotFoundPage'
import SignupPage from '@/pages/SignupPage'
import { GuestOnlyRoute } from '@/routes/guest-only-route'
import { paths } from '@/routes/paths'

/** The app's route table. URLs live in ./paths.ts. */
export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.home} element={<HomePage />} />
      {/* :id is the Hocuspocus document name. Guests can open documents too. */}
      <Route path={paths.docPattern} element={<DocPage />} />

      <Route element={<GuestOnlyRoute />}>
        <Route path={paths.login} element={<LoginPage />} />
        <Route path={paths.signup} element={<SignupPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
