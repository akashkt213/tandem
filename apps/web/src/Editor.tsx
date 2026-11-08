import { LinkExtension } from '@lexical/link'
import { ListExtension } from '@lexical/list'
import { LexicalCollaboration } from '@lexical/react/LexicalCollaborationContext'
import { CollaborationPlugin } from '@lexical/react/LexicalCollaborationPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalExtensionComposer } from '@lexical/react/LexicalExtensionComposer'
import { RichTextExtension } from '@lexical/rich-text'
import { defineExtension, type EditorThemeClasses } from 'lexical'
import { useEffect, useRef, useState } from 'react'
import { useIdentity } from '@/collab/identity'
import { useCollabProvider, useSyncIdentityToAwareness } from '@/collab/presence'
import { createProvider } from '@/collab/providerFactory'
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
    // Start with an *empty* root: no blocks at all. The shared Yjs document is the
    // source of truth; CollaborationPlugin fills the editor from it (or, for a new
    // document, `shouldBootstrap` adds the first paragraph after the initial sync).
    // Must be explicitly null: leaving it undefined makes InitialStateExtension add
    // a local paragraph, the extension equivalent of LexicalComposer's
    // `editorState: null` requirement in the collaboration docs.
    $initialEditorState: null,
    dependencies: [
        RichTextExtension, // headings, quotes, bold/italic/underline, keyboard handling
        ListExtension, // ul/ol nodes + list commands
        LinkExtension, // link nodes + TOGGLE_LINK_COMMAND
        // No HistoryExtension: with collaboration, undo/redo goes through the Yjs
        // UndoManager that CollaborationPlugin sets up (it only undoes *your* edits,
        // not other people's). Lexical's own history would conflict with it.
    ],
    onError: (error) => {
        // Lexical's default rethrows; log as well so errors are easy to spot in dev.
        console.error(error)
        throw error
    },
})

type EditorProps = {
    /** Document id from the URL; also the Hocuspocus document name. */
    docId: string
}

// Mount with key={docId}: a mounted editor can't be repointed at another document.
export function Editor({ docId }: EditorProps) {
    // Remote cursors are rendered into this element. Lexical positions them
    // relative to its offsetParent (the `relative` content wrapper below), which
    // scrolls together with the text, so cursors stay on the right line.
    const cursorsContainerRef = useRef<HTMLDivElement>(null)

    // Your name/colour as of mount, for CollaborationPlugin. Deliberately frozen:
    // changing these props makes the plugin reconnect (see useSyncIdentityToAwareness),
    // so renames go straight to awareness instead.
    const identity = useIdentity()
    const [initialIdentity] = useState(() => ({
        name: identity.name,
        color: identity.color,
        // Must keep the same object identity: it's an effect dependency in the plugin.
        awarenessData: { userId: identity.id },
    }))
    useSyncIdentityToAwareness(useCollabProvider(), identity)

    return (
        // Holds the shared collaboration state (yjsDocMap, user name/color) for the
        // editors below it. CollaborationPlugin must be inside one.
        <LexicalCollaboration>
            {/* contentEditable={null}: by default the composer renders the ContentEditable
            *before* its children. We render it ourselves so the toolbar can sit above it. */}
            <LexicalExtensionComposer extension={editorExtension} contentEditable={null}>
                <EditorStateLogger />
                <CollaborationPlugin
                    id={docId}
                    providerFactory={createProvider}
                    // The first client to open an empty document adds its first paragraph.
                    // Known race: two clients opening a brand-new doc at the same moment
                    // can both add one (a stray blank line). Fine for Phase 1.
                    shouldBootstrap
                    username={initialIdentity.name}
                    cursorColor={initialIdentity.color}
                    awarenessData={initialIdentity.awarenessData}
                    cursorsContainerRef={cursorsContainerRef}
                />
                {/* Fixed-height card: a flex column where the toolbar keeps its height and the
                content area takes the rest and scrolls (min-h-0 lets it shrink below its
                content so overflow-y-auto can kick in). */}
                <div className="flex h-[70vh] min-h-80 flex-col overflow-hidden rounded-xl border bg-background shadow-xs focus-within:ring-3 focus-within:ring-ring/50">
                    <div className="shrink-0">
                        <Toolbar />
                    </div>
                    {/* The scroll container. Lexical scrolls the cursor into view inside it
                    while typing. */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        {/* Content wrapper: `relative` so the placeholder and remote cursors
                        are positioned against it and scroll with the text. */}
                        <div className="relative min-h-full">
                            <ContentEditable
                                className="min-h-full px-6 py-5 text-base outline-none"
                                aria-placeholder="Start writing…"
                                placeholder={
                                    <div className="pointer-events-none absolute top-5 left-6 text-muted-foreground select-none">
                                        Start writing…
                                    </div>
                                }
                            />
                            <div ref={cursorsContainerRef} />
                        </div>
                    </div>
                </div>
            </LexicalExtensionComposer>
        </LexicalCollaboration>
    )
}
