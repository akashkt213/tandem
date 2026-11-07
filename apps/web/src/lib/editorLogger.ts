import { useEffect } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'

export default function EditorStateLogger() {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    // Log the initial state once
    console.log(editor.getEditorState().toJSON())

    // Log after every update; returns an unsubscribe for cleanup
    return editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
      // Skip selection-only updates (cursor moves) if you only care about content
      if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return
      console.log(editorState.toJSON())
    })
  }, [editor])

  return null
}
