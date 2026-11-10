import { ArrowRightIcon, PlusIcon } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { paths } from '@/routes/paths'

// Short, URL-safe id for a new document, e.g. "k3f9x2ab".
function newDocId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8)
}

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col items-center gap-2 px-4 py-12 text-center md:px-6 md:py-20 lg:py-24">
      <Badge variant="secondary" className="mb-2 rounded-full">
        Real-time collaboration
        <ArrowRightIcon />
      </Badge>

      <h1 className="max-w-2xl text-4xl leading-tight font-semibold tracking-tight text-balance text-primary lg:leading-[1.1] xl:text-5xl xl:tracking-tighter">
        Write together, in real time
      </h1>

      <p className="max-w-3xl text-base text-balance text-foreground sm:text-lg">
        A collaborative rich-text editor. Create a document, share the link, and
        edit it together with live cursors and presence.
      </p>

      <div className="flex w-full items-center justify-center gap-2 pt-2">
        <Button size="sm" onClick={() => navigate(paths.doc(newDocId()))}>
          <PlusIcon data-icon="inline-start" />
          New document
        </Button>
      </div>
    </section>
  )
}
