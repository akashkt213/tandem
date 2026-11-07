import { Route, Routes } from 'react-router'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import HomePage from '@/pages/HomePage'
import DocPage from '@/pages/DocPage'
import NotFoundPage from '@/pages/NotFoundPage'

export default function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />
      <main className="flex flex-1 flex-col">
        <Routes>
          <Route path="/" element={<HomePage />} />
          {/* :id becomes the Hocuspocus document name in Stage 4. */}
          <Route path="/doc/:id" element={<DocPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  )
}
