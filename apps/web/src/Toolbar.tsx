import { $isLinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link'
import {
  $isListNode,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode,
  REMOVE_LIST_COMMAND,
} from '@lexical/list'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { $createHeadingNode, $createQuoteNode, $isHeadingNode, $isQuoteNode } from '@lexical/rich-text'
import { $setBlocksType } from '@lexical/selection'
import { $findMatchingParent, $getNearestNodeOfType, mergeRegister } from '@lexical/utils'
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isRootOrShadowRoot,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical'
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PilcrowIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  UnderlineIcon,
  Undo2Icon,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

// ---------------------------------------------------------------------------
// Toolbar state: derived from the editor's current selection
// ---------------------------------------------------------------------------

type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'quote' | 'bullet' | 'number'

const BLOCK_TYPES: { value: BlockType; label: string; icon: LucideIcon }[] = [
  { value: 'paragraph', label: 'Text', icon: PilcrowIcon },
  { value: 'h1', label: 'Heading 1', icon: Heading1Icon },
  { value: 'h2', label: 'Heading 2', icon: Heading2Icon },
  { value: 'h3', label: 'Heading 3', icon: Heading3Icon },
  { value: 'quote', label: 'Quote', icon: QuoteIcon },
  { value: 'bullet', label: 'Bulleted list', icon: ListIcon },
  { value: 'number', label: 'Numbered list', icon: ListOrderedIcon },
]

const TEXT_FORMATS: { format: TextFormatType; label: string; shortcut?: string; icon: LucideIcon }[] = [
  { format: 'bold', label: 'Bold', shortcut: 'Ctrl+B', icon: BoldIcon },
  { format: 'italic', label: 'Italic', shortcut: 'Ctrl+I', icon: ItalicIcon },
  { format: 'underline', label: 'Underline', shortcut: 'Ctrl+U', icon: UnderlineIcon },
  { format: 'strikethrough', label: 'Strikethrough', icon: StrikethroughIcon },
  { format: 'code', label: 'Inline code', icon: CodeIcon },
]

type ToolbarState = {
  blockType: BlockType
  formats: Set<TextFormatType>
  isCollapsed: boolean
  linkUrl: string | null // URL of the link the cursor is in, if any
}

const INITIAL_STATE: ToolbarState = {
  blockType: 'paragraph',
  formats: new Set(),
  isCollapsed: true,
  linkUrl: null,
}

// Must run inside editor.read()/update(): uses $-functions.
function $readToolbarState(): ToolbarState | null {
  const selection = $getSelection()
  if (!$isRangeSelection(selection)) return null

  const anchorNode = selection.anchor.getNode()

  // The top-level block containing the cursor (a direct child of the root).
  const element =
    anchorNode.getKey() === 'root'
      ? anchorNode
      : ($findMatchingParent(anchorNode, (node) => {
          const parent = node.getParent()
          return parent !== null && $isRootOrShadowRoot(parent)
        }) ?? anchorNode.getTopLevelElementOrThrow())

  let blockType: BlockType = 'paragraph'
  if ($isListNode(element)) {
    // Use the innermost list, so a bullet list nested in a numbered list reads as "bullet".
    const list = $getNearestNodeOfType(anchorNode, ListNode) ?? element
    blockType = list.getListType() === 'number' ? 'number' : 'bullet'
  } else if ($isHeadingNode(element)) {
    const tag = element.getTag()
    blockType = tag === 'h1' || tag === 'h2' || tag === 'h3' ? tag : 'paragraph'
  } else if ($isQuoteNode(element)) {
    blockType = 'quote'
  }

  const formats = new Set<TextFormatType>()
  for (const { format } of TEXT_FORMATS) {
    if (selection.hasFormat(format)) formats.add(format)
  }

  // A text node inside a link has the LinkNode as its parent.
  const parent = anchorNode.getParent()
  const linkNode = $isLinkNode(parent) ? parent : $isLinkNode(anchorNode) ? anchorNode : null

  return {
    blockType,
    formats,
    isCollapsed: selection.isCollapsed(),
    linkUrl: linkNode ? linkNode.getURL() : null,
  }
}

function useToolbarState(editor: LexicalEditor) {
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  useEffect(() => {
    const refresh = () => {
      const next = editor.getEditorState().read($readToolbarState)
      if (next) setState(next)
    }

    return mergeRegister(
      // Content or formatting changed (typing, commands, remote edits later).
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const next = $readToolbarState()
          if (next) setState(next)
        })
      }),
      // Cursor moved without changing content.
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          refresh()
          return false // let other handlers see it too
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      // Undo/redo availability. Dispatched by HistoryExtension today and by the
      // Yjs undo manager once collaboration is on, so this keeps working in Stage 4.
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload)
          return false
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
    )
  }, [editor])

  return { ...state, canUndo, canRedo }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function setBlockType(editor: LexicalEditor, current: BlockType, next: BlockType) {
  if (next === current) return

  if (next === 'bullet') {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
    return
  }
  if (next === 'number') {
    editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
    return
  }

  editor.update(() => {
    const selection = $getSelection()
    if (!$isRangeSelection(selection)) return
    // $setBlocksType replaces each selected block (including list items) with the new node.
    $setBlocksType(selection, () => {
      if (next === 'quote') return $createQuoteNode()
      if (next === 'paragraph') return $createParagraphNode()
      return $createHeadingNode(next)
    })
  })
}

// Accept "example.com" as well as "https://example.com". Only http(s) and mailto
// are allowed; anything else (e.g. "javascript:") is rejected.
function normalizeUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const url = new URL(withProtocol)
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------

function WithTooltip({ label, shortcut, children }: { label: string; shortcut?: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut && <span className="ml-2 text-background/60">{shortcut}</span>}
      </TooltipContent>
    </Tooltip>
  )
}

function LinkButton({ editor, linkUrl, isCollapsed }: { editor: LexicalEditor; linkUrl: string | null; isCollapsed: boolean }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isLink = linkUrl !== null
  // Lexical can only create a link from selected text (or edit an existing one).
  const disabled = isCollapsed && !isLink

  const onOpenChange = (next: boolean) => {
    // A click on the wrapper span still reaches the trigger when the button is disabled.
    if (next && disabled) return
    if (next) {
      setValue(linkUrl ?? '')
      setError(null)
    }
    setOpen(next)
  }

  const apply = () => {
    const url = normalizeUrl(value)
    if (!url) {
      setError('Enter a valid http(s) or mailto link.')
      return
    }
    // Uses the editor's last selection, which Lexical keeps while the popover has focus.
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, url)
    setOpen(false)
    editor.focus()
  }

  const remove = () => {
    editor.dispatchCommand(TOGGLE_LINK_COMMAND, null)
    setOpen(false)
    editor.focus()
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <WithTooltip label={isLink ? 'Edit link' : 'Add link'} shortcut={disabled ? 'Select text first' : undefined}>
        <PopoverTrigger asChild>
          {/* span keeps the tooltip working while the button is disabled */}
          <span tabIndex={disabled ? 0 : -1}>
            <Toggle size="sm" pressed={isLink} disabled={disabled} aria-label="Link">
              <LinkIcon />
            </Toggle>
          </span>
        </PopoverTrigger>
      </WithTooltip>
      <PopoverContent align="start" className="w-80">
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            apply()
          }}
        >
          <div className="flex gap-2">
            <Input
              autoFocus
              placeholder="https://example.com"
              value={value}
              onChange={(event) => {
                setValue(event.target.value)
                setError(null)
              }}
              aria-invalid={error !== null}
              aria-label="Link URL"
            />
            <Button type="submit" size="sm" className="h-8">
              {isLink ? 'Update' : 'Add'}
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {isLink && (
            <Button type="button" variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={remove}>
              Remove link
            </Button>
          )}
        </form>
      </PopoverContent>
    </Popover>
  )
}

export function Toolbar() {
  const [editor] = useLexicalComposerContext()
  const { blockType, formats, isCollapsed, linkUrl, canUndo, canRedo } = useToolbarState(editor)

  const onBlockTypeChange = useCallback(
    (next: string) => setBlockType(editor, blockType, next as BlockType),
    [editor, blockType],
  )

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
    >
      <WithTooltip label="Undo" shortcut="Ctrl+Z">
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} aria-label="Undo" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)}>
          <Undo2Icon />
        </Button>
      </WithTooltip>
      <WithTooltip label="Redo" shortcut="Ctrl+Y">
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} aria-label="Redo" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)}>
          <Redo2Icon />
        </Button>
      </WithTooltip>

      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

      <Select value={blockType} onValueChange={onBlockTypeChange}>
        <SelectTrigger size="sm" className="w-40" aria-label="Block type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {BLOCK_TYPES.map(({ value, label, icon: Icon }) => (
            <SelectItem key={value} value={value}>
              <Icon />
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

      {TEXT_FORMATS.map(({ format, label, shortcut, icon: Icon }) => (
        <WithTooltip key={format} label={label} shortcut={shortcut}>
          <Toggle
            size="sm"
            aria-label={label}
            pressed={formats.has(format)}
            onPressedChange={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format)}
          >
            <Icon />
          </Toggle>
        </WithTooltip>
      ))}

      <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-5" />

      <LinkButton editor={editor} linkUrl={linkUrl} isCollapsed={isCollapsed} />

      {/* Lists can also be toggled from here: clicking the active one turns it back into text. */}
      <WithTooltip label="Bulleted list">
        <Toggle
          size="sm"
          aria-label="Bulleted list"
          pressed={blockType === 'bullet'}
          onPressedChange={(on) =>
            on
              ? editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)
              : editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
          }
        >
          <ListIcon />
        </Toggle>
      </WithTooltip>
      <WithTooltip label="Numbered list">
        <Toggle
          size="sm"
          aria-label="Numbered list"
          pressed={blockType === 'number'}
          onPressedChange={(on) =>
            on
              ? editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)
              : editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)
          }
        >
          <ListOrderedIcon />
        </Toggle>
      </WithTooltip>
    </div>
  )
}
