import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { AppRoutes } from '@/routes/app-routes'

export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <AppRoutes />
      </main>
      <SiteFooter />
    </div>
  )
}
