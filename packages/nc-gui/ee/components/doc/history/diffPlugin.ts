import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { DOMSerializer, Node as PMNode, type Schema, type Slice } from '@tiptap/pm/model'
import { StepMap } from '@tiptap/pm/transform'
import { ChangeSet } from 'prosemirror-changeset'

/**
 * State injected via the plugin key. The viewer updates this every time
 * the comparison basis or the previewed revision changes.
 */
export interface DocDiffState {
  /** "From" doc — the older / current version we're diffing against. */
  fromContent: Record<string, any> | null
  /** "To" doc — what the editor is currently rendering. */
  toContent: Record<string, any> | null
  /** When false, the plugin emits an empty decoration set (no highlighting). */
  enabled: boolean
  /**
   * Which change is "focused" in the step-through nav. The decoration at this
   * index gets a `*-current` class so it's visually distinct from the rest.
   * -1 = no focus.
   */
  currentIndex: number
  /**
   * Resolve a doc-image `data-id` (FileReference id) to a live proxy URL.
   * The diff plugin uses this when re-serialising deleted images — the
   * stored `src` in an old revision is a stale signed URL, so we swap it
   * for a fresh proxy URL the browser can fetch with cookie auth.
   * Provided by the Viewer; absent in unit tests.
   */
  resolveImageSrc?: ((fileRefId: string) => string) | null
  /** Cached decoration set + change positions. Computed inside `apply`. */
  decorations: DecorationSet
  changes: DocDiffChange[]
  /**
   * Navigable steps for the ↑/↓ nav and the counter. A single ChangeSet entry
   * that contains BOTH an insertion and a deletion (a replace) becomes one
   * step here — even though it produces two decorations in `changes`. This is
   * what users expect from a "1 of N" counter on a revision viewer.
   */
  steps: DocDiffStep[]
}

/**
 * One rendered decoration. Insertions get an inline green highlight;
 * deletions render as a strikethrough span or block callout anchored at
 * `from`. `stepIndex` ties the decoration back to the navigable step so
 * the step-through nav can light up both halves of a replace together.
 */
export type DocDiffChange =
  | { type: 'insert'; from: number; to: number; stepIndex: number }
  | {
      type: 'delete'
      from: number
      to: number
      slice: Slice
      stepIndex: number
    }

/**
 * One entry in the step-through nav. `from` is the anchor position in the
 * new doc — used to scroll the viewport when the user clicks ↑/↓.
 */
export interface DocDiffStep {
  from: number
}

export const docDiffPluginKey = new PluginKey<DocDiffState>('docHistoryDiff')

/**
 * Atom leaf nodes that get a node-level decoration on insert (green outline)
 * and a class on delete (red outline + placeholder). Inline range decorations
 * don't reach leaf DOM, so these need their own node decorations.
 */
const ATOM_NODE_TYPES = new Set(['image', 'embed', 'fileAttachment'])

/**
 * Stable identity key for a media atom — used by the supplementary atom diff
 * to detect swaps that `prosemirror-changeset` misses. The library's token
 * comparison for atom nodes only checks node TYPE, not attrs, so two
 * different file-attachments (or images, or embeds) at the same position
 * get matched as equivalent. We supplement with a per-atom identity check
 * keyed on the attr that uniquely identifies the file or URL.
 *
 * Returns `null` for atoms without a usable identity attr — those fall back
 * to whatever the changeset reports, same as today.
 */
function atomIdentity(node: PMNode): string | null {
  const type = node.type.name
  if (type === 'image') {
    const key = node.attrs.id || node.attrs.src
    return key ? `image:${key}` : null
  }
  if (type === 'fileAttachment') {
    return node.attrs.id ? `fileAttachment:${node.attrs.id}` : null
  }
  if (type === 'embed') {
    return node.attrs.src ? `embed:${node.attrs.src}` : null
  }
  return null
}

/**
 * Short uppercase extension label for a deleted attachment's badge.
 * Mirrors `fileExtLabel` in `DocFileAttachmentNode.vue` so deleted
 * attachments render the same badge as inserted ones.
 */
function fileExtLabel(fileName: string, fileType: string): string {
  if (fileName) {
    const parts = fileName.split('.')
    if (parts.length > 1) return parts.pop()!.toUpperCase()
  }
  if (fileType) {
    const sub = fileType.split('/')[1] || ''
    const clean = sub
      .replace(/^x-/, '')
      .replace(/^vnd\.openxmlformats-officedocument\.\w+\./, '')
      .replace(/^vnd\.ms-/, '')
      .replace(/^vnd\./, '')
    return clean.toUpperCase().slice(0, 6)
  }
  return 'FILE'
}

/**
 * Badge background + text colour for a deleted attachment, keyed off the
 * extension. Mirrors the live NodeView's palette so the diff viewer reads
 * identically to the editor.
 */
function fileAttachmentBadgeColor(ext: string): { bg: string; text: string } {
  const e = ext.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(e)) {
    return { bg: '#dbeafe', text: '#2563eb' }
  }
  if (e === 'pdf') return { bg: '#fee2e2', text: '#dc2626' }
  if (['xls', 'xlsx', 'csv', 'tsv', 'sheet'].includes(e)) {
    return { bg: '#dcfce7', text: '#16a34a' }
  }
  if (['doc', 'docx', 'document', 'txt', 'rtf', 'md'].includes(e)) {
    return { bg: '#dbeafe', text: '#2563eb' }
  }
  if (['ppt', 'pptx', 'presentation'].includes(e)) {
    return { bg: '#ffedd5', text: '#ea580c' }
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
    return { bg: '#fef9c3', text: '#a16207' }
  }
  if (['js', 'ts', 'py', 'json', 'html', 'css', 'xml', 'yaml', 'yml'].includes(e)) {
    return { bg: '#f3e8ff', text: '#7c3aed' }
  }
  return { bg: '#f3f4f6', text: '#6b7280' }
}

/**
 * Walk a ChangeSet against the (from, to) doc pair and produce both inserts
 * and deletes as navigable change-steps. Returns an empty array when:
 *   - the plugin is disabled
 *   - `fromContent` is missing (initial creation — no prior to compare)
 *   - either doc fails to parse against the schema
 */
function findChanges(
  fromContent: Record<string, any> | null,
  toContent: Record<string, any> | null,
  enabled: boolean,
  schema: Schema,
): { changes: DocDiffChange[]; steps: DocDiffStep[] } {
  if (!enabled || !fromContent || !toContent) return { changes: [], steps: [] }

  let fromDoc: PMNode
  let toDoc: PMNode
  try {
    fromDoc = PMNode.fromJSON(schema, fromContent)
    toDoc = PMNode.fromJSON(schema, toContent)
  } catch {
    return { changes: [], steps: [] }
  }

  let changeset: ChangeSet
  try {
    // Express the entire content as a single replace StepMap: remove the
    // full "from" doc body and insert the full "to" doc body. ChangeSet
    // walks both structures token by token and reports inserted / deleted
    // ranges via its inner LCS — token-level precision without us needing
    // intermediate steps.
    const map = new StepMap([0, fromDoc.content.size, toDoc.content.size])
    changeset = ChangeSet.create(fromDoc).addSteps(toDoc, [map], null)
  } catch {
    return { changes: [], steps: [] }
  }

  const changes: DocDiffChange[] = []
  const steps: DocDiffStep[] = []
  for (const change of changeset.changes) {
    // One ChangeSet entry = one logical edit. A pure insert and a pure
    // delete both count as a single step; a replace (insert + delete at the
    // same anchor) ALSO counts as a single step even though it produces two
    // decorations. The step is only recorded once we know at least one
    // decoration will render — empty / malformed slices are silently dropped.
    const stepIndex = steps.length
    const before = changes.length

    if (change.toB > change.fromB) {
      changes.push({
        type: 'insert',
        from: change.fromB,
        to: change.toB,
        stepIndex,
      })
    }
    // Deletion: extract the slice from the old doc and anchor a widget at
    // `fromB` in the new doc. For pure deletions toB === fromB; for
    // replacements the delete widget renders right before the green
    // insert decoration that covers [fromB, toB].
    if (change.toA > change.fromA) {
      try {
        const slice = fromDoc.slice(change.fromA, change.toA)
        if (slice.content.size > 0) {
          changes.push({
            type: 'delete',
            from: change.fromB,
            to: change.fromB,
            slice,
            stepIndex,
          })
        }
      } catch {
        // Slice extraction failed (rare, malformed boundaries) — skip.
      }
    }

    if (changes.length > before) steps.push({ from: change.fromB })
  }

  // Supplementary atom diff — see `atomIdentity` for why this is needed.
  // `prosemirror-changeset` matches atom leaf nodes by TYPE only, so a swap
  // of one fileAttachment for another at the same position registers as
  // "no change" even though their `id` attrs differ. We catch those swaps
  // here by walking both docs for atoms with stable identity keys and
  // emitting synthetic insert/delete entries for any orphan.
  const collectAtoms = (doc: PMNode) => {
    const map = new Map<string, { pos: number; node: PMNode }>()
    doc.descendants((node, pos) => {
      const key = atomIdentity(node)
      if (key && !map.has(key)) map.set(key, { pos, node })
      return true
    })
    return map
  }
  const fromAtoms = collectAtoms(fromDoc)
  const toAtoms = collectAtoms(toDoc)

  // Skip atoms whose position is already inside a changeset-reported range —
  // avoids double-decorating when the standard diff did catch the change.
  const positionInsideAnyChange = (
    from: number,
    to: number,
    side: 'A' | 'B',
  ) =>
    changeset.changes.some((c) => {
      const cFrom = side === 'A' ? c.fromA : c.fromB
      const cTo = side === 'A' ? c.toA : c.toB
      return from < cTo && to > cFrom
    })

  toAtoms.forEach((entry, key) => {
    if (fromAtoms.has(key)) return
    const { pos, node } = entry
    const end = pos + node.nodeSize
    if (positionInsideAnyChange(pos, end, 'B')) return
    changes.push({
      type: 'insert',
      from: pos,
      to: end,
      stepIndex: steps.length,
    })
    steps.push({ from: pos })
  })

  fromAtoms.forEach((entry, key) => {
    if (toAtoms.has(key)) return
    const { pos: fromPos, node } = entry
    const end = fromPos + node.nodeSize
    if (positionInsideAnyChange(fromPos, end, 'A')) return
    let slice: Slice
    try {
      slice = fromDoc.slice(fromPos, end)
    } catch {
      return
    }
    if (slice.content.size === 0) return
    // Anchor the deletion widget at the same numeric position in toDoc,
    // clamped — gives the user a visual indication near where the atom
    // used to be. Imperfect when toDoc structure diverges heavily, but
    // good enough for swaps where the surrounding doc is mostly stable.
    const anchor = Math.min(fromPos, Math.max(0, toDoc.content.size - 1))
    changes.push({
      type: 'delete',
      from: anchor,
      to: anchor,
      slice,
      stepIndex: steps.length,
    })
    steps.push({ from: anchor })
  })

  return { changes, steps }
}

/**
 * A deletion is "inline-only" when its slice content is purely inline
 * (text + marks within a single block — no paragraph/heading/list boundary
 * crossed). Inline-only deletions are rendered as a strikethrough span that
 * flows with the surrounding text; cross-block deletions get a div wrapper
 * because inserting block elements into an inline context breaks layout.
 */
function isInlineOnlySlice(slice: Slice): boolean {
  const first = slice.content.firstChild
  if (!first) return false
  return first.isInline
}

/**
 * Inline strikethrough span for a within-block deletion. Plain text only —
 * marks are intentionally dropped because they tend to fight with the
 * strikethrough decoration.
 */
function renderInlineDeletion(slice: Slice, isCurrent: boolean): HTMLElement {
  const span = document.createElement('span')
  span.className = `nc-doc-history-diff-delete${
    isCurrent ? ' nc-doc-history-diff-delete-current' : ''
  }`
  span.setAttribute('contenteditable', 'false')
  span.textContent = slice.content.textBetween(0, slice.content.size, '\n')
  return span
}

/**
 * Walk the rendered DOM and wrap every text node in a deletion span. This
 * is what gives the deleted snippet its red wash + grey strikethrough —
 * mirroring how insertions are decorated as inline ranges in the new doc.
 * Block chrome (quote bar, code-block background, callout box, list
 * markers, ...) is left untouched because we only touch text leaves.
 */
function wrapTextNodesWithDeletionMark(root: Node, isCurrent: boolean) {
  const klass = `nc-doc-history-diff-delete${
    isCurrent ? ' nc-doc-history-diff-delete-current' : ''
  }`
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let n: Node | null
  // eslint-disable-next-line no-cond-assign
  while ((n = walker.nextNode())) {
    if (n.nodeValue && n.nodeValue.length) nodes.push(n as Text)
  }
  for (const text of nodes) {
    if (!text.parentNode) continue
    // Skip text already inside a delete span — guards against double-wrapping
    // if this helper is ever called twice on the same subtree.
    if ((text.parentNode as Element).closest?.('.nc-doc-history-diff-delete')) {
      continue
    }
    const span = document.createElement('span')
    span.className = klass
    span.appendChild(text.cloneNode())
    text.parentNode.replaceChild(span, text)
  }
}

/**
 * Mark deleted atom-leaf nodes (images, embeds, file attachments) with a
 * red-outline class so the user can see what was removed. DOMSerializer
 * emits these as bare schema elements (the live NodeView doesn't run), so:
 *
 * - Images carry a stale signed URL in `src` plus a FileReference id in
 *   `data-id`. We swap `src` for a fresh proxy URL via the caller-supplied
 *   resolver and apply `data-width` / `data-align` as inline styles so the
 *   picture renders at its original size and alignment.
 * - Embeds and file attachments serialise to empty `<div data-type="...">`
 *   elements — without a NodeView to fill them, they collapse to zero
 *   height. We don't synthesise placeholder content here; instead we just
 *   tag them with the delete class and let CSS (`::before` on the data-type)
 *   render the URL / filename + a red outline.
 */
function rewriteDeletedAtoms(
  root: Element,
  resolveImageSrc: ((id: string) => string) | null | undefined,
  isCurrent: boolean,
) {
  const deleteClass = 'nc-doc-history-diff-delete-atom'
  const currentClass = 'nc-doc-history-diff-delete-atom-current'

  const imgs = root.querySelectorAll('img')
  imgs.forEach((img) => {
    const id = img.getAttribute('data-id')
    if (id && resolveImageSrc) {
      const url = resolveImageSrc(id)
      if (url) img.setAttribute('src', url)
    }

    const width = img.getAttribute('data-width')
    if (width) {
      img.style.width = `${width}px`
      // Cap to the editor's content width so an old wide image doesn't
      // break out of the diff viewer; matches the live NodeView's behaviour.
      img.style.maxWidth = '100%'
      img.style.height = 'auto'
    }

    const align = img.getAttribute('data-align') || 'center'
    img.style.display = 'block'
    if (align === 'left') {
      img.style.marginLeft = '0'
      img.style.marginRight = 'auto'
    } else if (align === 'right') {
      img.style.marginLeft = 'auto'
      img.style.marginRight = '0'
    } else {
      img.style.marginLeft = 'auto'
      img.style.marginRight = 'auto'
    }

    img.classList.add(deleteClass)
    if (isCurrent) img.classList.add(currentClass)
  })

  // Embeds — bare `<div data-type="embed">` from DOMSerializer. We rebuild
  // the NodeView's DOM structure (`.nc-embed-card` > `.nc-embed-iframe-wrapper`
  // > `<iframe>`) by hand so the embed renders as an actual tile (matching
  // the inserted-embed visual) instead of a text placeholder. The shared
  // `_doc-content.scss` partial styles `.nc-embed-card` already — and the
  // outline rule keys off `.nc-doc-history-diff-delete-atom .nc-embed-card`
  // so the red frame hugs the tile.
  const embeds = root.querySelectorAll('div[data-type="embed"]')
  embeds.forEach((el) => {
    const src = el.getAttribute('data-src') || ''
    const width = el.getAttribute('data-width')
    const height = el.getAttribute('data-height')

    const card = document.createElement('div')
    card.className = 'nc-embed-card'
    if (width) {
      card.style.width = `${width}%`
      card.style.margin = '0 auto'
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'nc-embed-iframe-wrapper'
    if (height) {
      wrapper.style.height = `${height}px`
    } else {
      // 16:9 aspect default — mirrors DocEmbedNode.vue's `iframeWrapperStyle`.
      // Without it the wrapper has no intrinsic height and collapses to a
      // 0-px line; the iframe inside is absolutely positioned and would
      // never become visible.
      wrapper.style.paddingBottom = '56.25%'
    }

    if (src) {
      const iframe = document.createElement('iframe')
      iframe.src = src
      iframe.className = `nc-embed-iframe${
        height ? ' nc-embed-iframe-fixed' : ''
      }`
      iframe.setAttribute('frameborder', '0')
      iframe.setAttribute(
        'sandbox',
        'allow-scripts allow-same-origin allow-popups allow-presentation',
      )
      iframe.setAttribute(
        'allow',
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      )
      iframe.setAttribute('allowfullscreen', '')
      wrapper.appendChild(iframe)
    }

    card.appendChild(wrapper)
    el.replaceChildren(card)

    el.classList.add(deleteClass)
    if (isCurrent) el.classList.add(currentClass)
  })

  // File attachments — bare `<div data-type="file-attachment">` from
  // DOMSerializer. We rebuild the NodeView's card DOM (badge + filename +
  // size) so deleted attachments read the same as inserted ones — just with
  // a red outline + grey strike instead of green. Without this they'd
  // collapse to a zero-height div and the deletion would be invisible.
  const attachments = root.querySelectorAll('div[data-type="file-attachment"]')
  attachments.forEach((el) => {
    const fileName = el.getAttribute('data-file-name') || 'Untitled'
    const fileSizeStr = el.getAttribute('data-file-size')
    const fileSize = fileSizeStr ? Number(fileSizeStr) : 0
    const fileType = el.getAttribute('data-file-type') || ''

    const ext = fileExtLabel(fileName, fileType)
    const badge = fileAttachmentBadgeColor(ext)

    const card = document.createElement('div')
    card.className = 'nc-file-attachment-card'

    const badgeEl = document.createElement('div')
    badgeEl.className = 'nc-file-attachment-badge'
    badgeEl.style.backgroundColor = badge.bg
    badgeEl.style.color = badge.text
    badgeEl.textContent = ext
    card.appendChild(badgeEl)

    const info = document.createElement('div')
    info.className = 'nc-file-attachment-info'

    const name = document.createElement('div')
    name.className = 'nc-file-attachment-name'
    name.setAttribute('title', fileName)
    name.textContent = fileName
    info.appendChild(name)

    if (fileSize > 0) {
      const size = document.createElement('div')
      size.className = 'nc-file-attachment-size'
      size.textContent = formatFileSize(fileSize)
      info.appendChild(size)
    }

    card.appendChild(info)
    el.replaceChildren(card)

    el.classList.add(deleteClass)
    if (isCurrent) el.classList.add(currentClass)
  })
}

/**
 * Wrapper for a cross-block deletion. Re-serialises the PM slice via
 * DOMSerializer so the original structure (heading, code block, quote,
 * list, table, callout, ...) renders with its native styling. The text
 * leaves are then individually wrapped with the same red-wash + grey-strike
 * decoration used for inline deletions, so block chrome stays untouched
 * while every text run reads as deleted. Atom-leaf nodes (image / embed /
 * file attachment) get a red outline instead — images re-resolved to a
 * live proxy URL so the picture is visible; embeds and attachments get a
 * CSS-rendered placeholder showing their URL or filename (no NodeView
 * runs in static serialisation).
 */
function renderDeletedBlock(
  slice: Slice,
  schema: Schema,
  isCurrent: boolean,
  resolveImageSrc: ((id: string) => string) | null | undefined,
): HTMLElement {
  // `nc-doc-editor-content` + `ProseMirror` is the joint selector the shared
  // content partial (_doc-content.scss) keys off — without both classes,
  // headings / code blocks / quotes / lists / tables lose their styling
  // and the deleted snippet renders as plain text.
  const wrap = document.createElement('div')
  wrap.className = `nc-doc-history-deleted-block nc-doc-editor-content ProseMirror${
    isCurrent ? ' nc-doc-history-deleted-block-current' : ''
  }`
  wrap.setAttribute('contenteditable', 'false')

  try {
    const serializer = DOMSerializer.fromSchema(schema)
    wrap.appendChild(serializer.serializeFragment(slice.content))
    rewriteDeletedAtoms(wrap, resolveImageSrc, isCurrent)
    wrapTextNodesWithDeletionMark(wrap, isCurrent)
  } catch {
    wrap.textContent = slice.content.textBetween(0, slice.content.size, '\n')
  }

  return wrap
}

/**
 * Build decorations from a list of change-steps, marking one as "current"
 * so the step-through nav has a visible focus.
 */
function buildDecorations(
  changes: DocDiffChange[],
  currentStepIndex: number,
  currentDoc: PMNode,
  schema: Schema,
  resolveImageSrc: ((id: string) => string) | null | undefined,
): DecorationSet {
  if (!changes.length) return DecorationSet.empty

  const decorations: Decoration[] = []
  changes.forEach((change, idx) => {
    // Light up BOTH halves of a replace together — the insert highlight and
    // the strikethrough widget that produced it share the same `stepIndex`.
    const isCurrent = change.stepIndex === currentStepIndex

    if (change.type === 'insert') {
      // Text-level inline highlight (green wash).
      decorations.push(
        Decoration.inline(change.from, change.to, {
          class: isCurrent
            ? 'nc-doc-history-diff-insert nc-doc-history-diff-insert-current'
            : 'nc-doc-history-diff-insert',
        }),
      )
      // Node decoration for atom leaves (images, embeds, file attachments)
      // so they pick up a green border — inline decorations don't apply to
      // leaf-node DOM and would otherwise leave inserted media unmarked.
      currentDoc.nodesBetween(change.from, change.to, (node, pos) => {
        if (node.isAtom && ATOM_NODE_TYPES.has(node.type.name)) {
          decorations.push(
            Decoration.node(pos, pos + node.nodeSize, {
              class: isCurrent
                ? 'nc-doc-history-diff-insert-atom nc-doc-history-diff-insert-atom-current'
                : 'nc-doc-history-diff-insert-atom',
            }),
          )
        }
        return true
      })
      return
    }

    // Hybrid: inline strikethrough for deletions within a single block,
    // block callout when the deletion spans paragraph / heading / list
    // boundaries. Putting a block widget inside an inline context breaks
    // the surrounding paragraph visually, so the inline path is critical
    // for mid-paragraph edits.
    const inlineOnly = isInlineOnlySlice(change.slice)
    // ProseMirror caches widget DOM by `spec.key` — if the key is stable
    // across rebuilds, the cached node is reused and the render function
    // is NOT invoked again. We need the function to re-run when focus
    // shifts (so the `*-current` class can flip on / off), so encode
    // `isCurrent` into the key.
    decorations.push(
      Decoration.widget(
        change.from,
        () =>
          inlineOnly
            ? renderInlineDeletion(change.slice, isCurrent)
            : renderDeletedBlock(change.slice, schema, isCurrent, resolveImageSrc),
        { side: -1, key: `del-${idx}-${isCurrent ? 'cur' : 'off'}` },
      ),
    )
  })

  return DecorationSet.create(currentDoc, decorations)
}

/**
 * Plugin that renders insert highlights + delete block-widgets. The viewer
 * dispatches a meta transaction with `{[docDiffPluginKey]: nextState}` to
 * recompute on prop changes.
 *
 * Decorations + step positions are cached in plugin state so
 * `props.decorations` stays cheap and external callers (the step-through
 * nav) can read positions via `getDiffSteps()` without re-running the LCS.
 */
export function docDiffPlugin(
  initial: Omit<DocDiffState, 'decorations' | 'changes' | 'steps'>,
) {
  return new Plugin<DocDiffState>({
    key: docDiffPluginKey,
    state: {
      init(_, editorState) {
        const { changes, steps } = findChanges(
          initial.fromContent,
          initial.toContent,
          initial.enabled,
          editorState.schema,
        )
        const decorations = buildDecorations(
          changes,
          initial.currentIndex,
          editorState.doc,
          editorState.schema,
          initial.resolveImageSrc,
        )
        return { ...initial, changes, steps, decorations }
      },
      apply(tr, value, _oldState, newState) {
        const meta = tr.getMeta(docDiffPluginKey) as
          | Partial<DocDiffState>
          | undefined

        // Determine whether the underlying diff inputs changed (rerun the
        // LCS) vs only the focused-change index (cheap rebuild — same
        // change-steps, just different "current" marker).
        const inputChanged =
          !!meta &&
          ('fromContent' in meta || 'toContent' in meta || 'enabled' in meta)
        const indexOnlyChanged =
          !!meta && !inputChanged && 'currentIndex' in meta
        const docChanged = tr.docChanged

        const next: DocDiffState = { ...value, ...(meta ?? {}) }
        if (docChanged) next.toContent = newState.doc.toJSON()

        if (inputChanged || docChanged) {
          const result = findChanges(
            next.fromContent,
            next.toContent,
            next.enabled,
            newState.schema,
          )
          next.changes = result.changes
          next.steps = result.steps
          next.decorations = buildDecorations(
            next.changes,
            next.currentIndex,
            newState.doc,
            newState.schema,
            next.resolveImageSrc,
          )
        } else if (indexOnlyChanged) {
          next.decorations = buildDecorations(
            value.changes,
            next.currentIndex,
            newState.doc,
            newState.schema,
            next.resolveImageSrc,
          )
        } else {
          // Unrelated transactions (selection, focus) — just map decorations.
          next.decorations = value.decorations.map(tr.mapping, tr.doc)
        }
        return next
      },
    },
    props: {
      decorations(editorState) {
        return docDiffPluginKey.getState(editorState)?.decorations ?? DecorationSet.empty
      },
    },
  })
}

/**
 * TipTap-friendly wrapper around the diff plugin. Add this to the
 * extensions array; control its state via the exported helpers below.
 */
export const DocDiffExtension = Extension.create({
  name: 'docHistoryDiff',
  addOptions() {
    return {
      initialState: {
        fromContent: null,
        toContent: null,
        enabled: false,
        currentIndex: 0,
        resolveImageSrc: null,
      } as Omit<DocDiffState, 'decorations' | 'changes' | 'steps'>,
    }
  },
  addProseMirrorPlugins() {
    return [docDiffPlugin(this.options.initialState)]
  },
})

/**
 * Helper to push new diff state into a running editor. Called from the
 * viewer whenever the comparison basis or the previewed revision changes.
 */
export function setDocDiffState(
  editor: { view: { state: any; dispatch: (tr: any) => void } } | null | undefined,
  next: Partial<Omit<DocDiffState, 'decorations' | 'changes' | 'steps'>>,
) {
  if (!editor) return
  const tr = editor.view.state.tr.setMeta(docDiffPluginKey, next)
  editor.view.dispatch(tr)
}

/**
 * Read the navigable step list — one entry per logical edit. A replace
 * (insert + delete at the same anchor) is a single step here, even though
 * it produces two on-screen decorations. Drives the "n / N" counter and
 * the ↑/↓ step-through nav.
 */
export function getDiffSteps(
  editor: { view: { state: any } } | null | undefined,
): DocDiffStep[] {
  if (!editor) return []
  return docDiffPluginKey.getState(editor.view.state)?.steps ?? []
}

/**
 * Scroll the editor's viewport to the given step index. No-op when the
 * index is out of range. Used by the step-through nav (↑/↓ buttons).
 */
export function scrollToDiffChange(
  editor: { view: any } | null | undefined,
  index: number,
): void {
  if (!editor) return
  const steps = getDiffSteps(editor)
  const step = steps[index]
  if (!step) return

  const view = editor.view
  // Use the native DOM node at the change's start position so we can call
  // `scrollIntoView` with smooth behavior — TR-based `scrollIntoView` jumps
  // abruptly and forces a focus side-effect we don't want in a read-only
  // viewer.
  try {
    const { node } = view.domAtPos(step.from)
    const el = (node.nodeType === 1 ? node : node.parentElement) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  } catch {
    // ignore — out-of-range or detached node
  }
}
