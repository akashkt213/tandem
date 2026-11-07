import { HistoryExtension } from '@lexical/history'
import { LinkExtension } from '@lexical/link'
import { ListExtension } from '@lexical/list'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextExtension } from '@lexical/rich-text'
import { defineExtension, type EditorThemeClasses } from 'lexical'
import { Toolbar } from '@/Toolbar'
import EditorStateLogger from './lib/editorLogger'

// Lexical theme → Tailwind classes, styled like shadcn's typography.
// Lexical applies these classes to the DOM nodes it renders.
const theme: EditorThemeClasses = {
    paragraph: 'leading-7 [&:not(:first-child)]:mt-4',
    heading: {
        h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight text-balance [&:not(:first-child)]:mt-8',
        h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight [&:not(:first-child)]:mt-8',
        h3: 'scroll-m-20 text-2xl font-semibold tracking-tight [&:not(:first-child)]:mt-6',
    },
    quote: 'mt-4 border-l-2 pl-6 italic',
    list: {
        ul: 'my-4 ml-6 list-disc [&>li]:mt-2',
        ol: 'my-4 ml-6 list-decimal [&>li]:mt-2',
        listitem: 'leading-7',
        // A nested list sits inside its own <li>; hide that wrapper's bullet.
        nested: { listitem: 'list-none' },
    },
    link: 'font-medium text-primary underline underline-offset-4',
    text: {
        bold: 'font-semibold',
        italic: 'italic',
        underline: 'underline underline-offset-4',
        strikethrough: 'line-through',
        underlineStrikethrough: 'underline line-through',
        code: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm',
    },
}

// Defined at module scope so it is stable. LexicalExtensionComposer rebuilds
// the editor (losing all content) whenever this object changes identity.
const editorExtension = defineExtension({
    name: '@collab/editor',
    namespace: 'CollabEditor',
    theme,
    dependencies: [
        RichTextExtension, // headings, quotes, bold/italic/underline, keyboard handling
        ListExtension, // ul/ol nodes + list commands
        LinkExtension, // link nodes + TOGGLE_LINK_COMMAND
        // NOTE: remove HistoryExtension in Stage 4. With collaboration, undo/redo has
        // to go through the Yjs UndoManager (CollaborationPlugin sets that up), and
        // Lexical's own history conflicts with it. See PLAN.md, pitfall 7.
        HistoryExtension,
    ],
    onError: (error) => {
        // Lexical's default rethrows; log as well so errors are easy to spot in dev.
        console.error(error)
        throw error
    },
})

export function Editor() {
    return (
        // contentEditable={null}: by default the composer renders the ContentEditable
        // *before* its children. We render it ourselves so the toolbar can sit above it.
        <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
            <EditorStateLogger />
            {/* Fixed-height card: a flex column where the toolbar keeps its height and the
                content area takes the rest and scrolls (min-h-0 lets it shrink below its
                content so overflow-y-auto can kick in). */}
            <div className="flex h-[70vh] min-h-80 flex-col overflow-hidden rounded-xl border bg-background shadow-xs focus-within:ring-3 focus-within:ring-ring/50">
                <div className="shrink-0">
                    <Toolbar />
                </div>
                {/* The scroll container. `relative` so the placeholder sits over the first
                    line and scrolls with the content. Lexical scrolls the cursor into view
                    inside this element while typing. */}
                <div className="relative min-h-0 flex-1 overflow-y-auto">
                    <ContentEditable
                        className="min-h-full px-6 py-5 text-base outline-none"
                        aria-placeholder="Start writing…"
                        placeholder={
                            <div className="pointer-events-none absolute top-5 left-6 text-muted-foreground select-none">
                                Start writing…
                            </div>
                        }
                    />
                </div>
            </div>
        </LexicalExtensionComposer>
    )
}
