import type { Ref } from 'vue'
import { KeyCode, Range, Selection, editor as monacoEditor } from 'monaco-editor'
import type { editor as MonacoEditor } from 'monaco-editor'
import { type ColumnType, type LinkToAnotherRecordType, type TableType, isLinksOrLTAR } from 'nocodb-sdk'
import { findBareKeywordReferences, findFormulaReferenceChains } from '../../../../utils/formulaDotPathUtils'

// every reference is blue; red marks one that doesn't resolve
export type FormulaChipHue = 'blue' | 'red'

export interface FormulaChip {
  start: number
  end: number
  title: string
  column?: ColumnType
  hue: FormulaChipHue
  // a bare variable, e.g. a rollup's `values`: no braces to hide
  isBare?: boolean
}

/**
 * Renders `{Field}` references as coloured, icon-led chips inside a Monaco
 * editor. Braces stay in the model (the formula text is unchanged) but are
 * hidden, and a chip is edited as one unit.
 */
export function useFormulaChips({
  meta,
  getMeta,
  getMetaByKey,
  iconClassFor,
  bareReference,
}: {
  meta: Ref<TableType | undefined>
  getMeta: (baseId: string, tableId: string) => Promise<TableType | null>
  getMetaByKey: (baseId: string | undefined, tableIdOrTitle: string | undefined) => TableType | undefined
  // CSS class that draws the column's header icon, if one is registered yet
  iconClassFor: (column: ColumnType) => string | undefined
  // a variable written without braces, drawn as a chip of this column
  bareReference?: Ref<{ keyword: string; column: ColumnType } | undefined>
}) {
  const chips = ref<FormulaChip[]>([])

  const loadingMetas = new Set<string>()

  let decorations: MonacoEditor.IEditorDecorationsCollection | undefined

  let attachedEditor: MonacoEditor.IStandaloneCodeEditor | undefined

  function resolveChips(text: string, cursorOffset?: number): FormulaChip[] {
    const result: FormulaChip[] = []
    for (const chain of findFormulaReferenceChains(text)) {
      let table: TableType | undefined = meta.value

      for (const segment of chain) {
        // unknown once a hop's table is still loading or the path broke
        if (!table) break

        const column = table.columns?.find((c) => c.title === segment.title)
        if (!column) {
          // a reference being typed is not an error yet
          const isEditing = cursorOffset !== undefined && cursorOffset > segment.start && cursorOffset < segment.end
          if (!isEditing) result.push({ ...segment, hue: 'red' })
          break
        }

        if (isLinksOrLTAR(column) && column.colOptions) {
          const colOptions = column.colOptions as LinkToAnotherRecordType
          result.push({ ...segment, column, hue: 'blue' })

          const baseId = colOptions.fk_related_base_id || column.base_id || meta.value?.base_id
          table = getMetaByKey(baseId, colOptions.fk_related_model_id)
          if (!table && baseId && colOptions.fk_related_model_id) loadMeta(baseId, colOptions.fk_related_model_id)
        } else {
          result.push({ ...segment, column, hue: 'blue' })
          table = undefined
        }
      }
    }
    const bare = bareReference?.value
    if (bare) {
      for (const segment of findBareKeywordReferences(text, bare.keyword)) {
        result.push({ ...segment, column: bare.column, hue: 'blue', isBare: true })
      }
    }
    return result
  }

  function loadMeta(baseId: string, tableId: string) {
    const key = `${baseId}:${tableId}`
    if (loadingMetas.has(key)) return
    loadingMetas.add(key)
    getMeta(baseId, tableId)
      .then(() => refresh())
      .catch(() => {})
  }

  function toDecorations(
    model: MonacoEditor.ITextModel,
    chip: FormulaChip,
    selections: Range[],
  ): MonacoEditor.IModelDeltaDecoration[] {
    const range = (from: number, to: number) => {
      const start = model.getPositionAt(from)
      const end = model.getPositionAt(to)
      return new Range(start.lineNumber, start.column, end.lineNumber, end.column)
    }
    const chipRange = range(chip.start, chip.end)
    // Monaco paints selections under the text, where the chip background hides them
    const isSelected = selections.some((selection) => !selection.isEmpty() && Range.areIntersecting(selection, chipRange))
    const hue = `nc-fx-hue-${chip.hue}${isSelected ? ' is-selected' : ''}`
    const iconClass = chip.column ? iconClassFor(chip.column) : undefined

    return [
      {
        range: chipRange,
        options: {
          inlineClassName: `nc-fx-chip-text ${hue}`,
          inlineClassNameAffectsLetterSpacing: true,
          stickiness: monacoEditor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
          // Monaco wraps lines by measuring plain text, without the chip's padding and icon.
          // These spaces stand in for that width there; CSS collapses them on screen.
          // Figure spaces don't allow a line break, so the icon never wraps away from its label.
          before: {
            content: iconClass ? '\u2007\u2007\u2007' : '\u2007',
            inlineClassName: `nc-fx-chip-start ${hue} ${iconClass ? `nc-fx-chip-icon ${iconClass}` : ''}`,
            inlineClassNameAffectsLetterSpacing: true,
          },
          after: {
            content: '​',
            inlineClassName: `nc-fx-chip-end ${hue}`,
            inlineClassNameAffectsLetterSpacing: true,
          },
        },
      },
      ...(chip.isBare
        ? []
        : [
            {
              range: range(chip.start, chip.start + 1),
              options: { inlineClassName: 'nc-fx-brace', inlineClassNameAffectsLetterSpacing: true },
            },
            {
              range: range(chip.end - 1, chip.end),
              options: { inlineClassName: 'nc-fx-brace', inlineClassNameAffectsLetterSpacing: true },
            },
          ]),
    ]
  }

  // Selected text outside chips; Monaco's own selection layer is hidden so chips aren't highlighted twice
  function selectionDecorations(model: MonacoEditor.ITextModel, selections: Range[]): MonacoEditor.IModelDeltaDecoration[] {
    const result: MonacoEditor.IModelDeltaDecoration[] = []
    for (const selection of selections) {
      if (selection.isEmpty()) continue
      let from = model.getOffsetAt(selection.getStartPosition())
      const to = model.getOffsetAt(selection.getEndPosition())
      const covered = chips.value.filter((chip) => chip.end > from && chip.start < to).sort((a, b) => a.start - b.start)
      for (const piece of [...covered.map((chip) => [chip.start, chip.end]), [to, to]]) {
        const end = Math.min(piece[0]!, to)
        if (end > from) {
          const start = model.getPositionAt(from)
          const stop = model.getPositionAt(end)
          result.push({
            range: new Range(start.lineNumber, start.column, stop.lineNumber, stop.column),
            options: { inlineClassName: 'nc-fx-selection' },
          })
        }
        from = Math.max(from, piece[1]!)
      }
    }
    return result
  }

  function paint() {
    const editor = attachedEditor
    const model = editor?.getModel()
    if (!editor || !model) return

    const selections = editor.getSelections() ?? []
    const deltas = [
      ...chips.value.flatMap((chip) => toDecorations(model, chip, selections)),
      ...selectionDecorations(model, selections),
    ]
    if (decorations) decorations.set(deltas)
    else decorations = editor.createDecorationsCollection(deltas)
  }

  function refresh() {
    const editor = attachedEditor
    const model = editor?.getModel()
    if (!editor || !model) return

    const position = editor.getPosition()
    const cursorOffset = position ? model.getOffsetAt(position) : undefined
    chips.value = resolveChips(model.getValue(), cursorOffset)
    paint()
  }

  /** The resolved chip at or around an offset, for atomic editing */
  function chipAround(offset: number, { includeEdges = false } = {}) {
    return chips.value.find(
      (chip) =>
        chip.column && (includeEdges ? offset >= chip.start && offset <= chip.end : offset > chip.start && offset < chip.end),
    )
  }

  function attach(editor: MonacoEditor.IStandaloneCodeEditor) {
    attachedEditor = editor
    let previousOffset = 0

    editor.onDidChangeModelContent(() => refresh())

    editor.onDidChangeCursorSelection(({ selection }) => {
      const model = editor.getModel()
      if (!model || selection.isEmpty()) return paint()

      // a selection never ends inside a chip, e.g. a double-click selects the whole reference
      const anchor = model.getOffsetAt(selection.getSelectionStart())
      const active = model.getOffsetAt(selection.getPosition())
      const forward = active >= anchor
      const anchorChip = chipAround(anchor)
      const activeChip = chipAround(active)
      if (anchorChip || activeChip) {
        const newAnchor = anchorChip ? (forward ? anchorChip.start : anchorChip.end) : anchor
        const newActive = activeChip ? (forward ? activeChip.end : activeChip.start) : active
        const from = model.getPositionAt(newAnchor)
        const to = model.getPositionAt(newActive)
        editor.setSelection(new Selection(from.lineNumber, from.column, to.lineNumber, to.column))
        return
      }
      // e.g. ⌘A, which can leave the caret where it was
      paint()
    })

    editor.onDidChangeCursorPosition((e) => {
      const model = editor.getModel()
      if (!model) return
      const offset = model.getOffsetAt(e.position)

      // arrow keys and clicks never leave the caret inside a chip
      const chip =
        e.reason === monacoEditor.CursorChangeReason.Explicit && editor.getSelection()?.isEmpty() ? chipAround(offset) : undefined
      if (chip) {
        const target = previousOffset <= chip.start ? chip.end : chip.start
        previousOffset = target
        editor.setPosition(model.getPositionAt(target))
        return
      }
      previousOffset = offset
      refresh()
    })

    editor.onKeyDown((e) => {
      const model = editor.getModel()
      const selection = editor.getSelection()
      if (!model || !selection?.isEmpty()) return
      const isBackspace = e.keyCode === KeyCode.Backspace
      const isDelete = e.keyCode === KeyCode.Delete
      if (!isBackspace && !isDelete) return

      const offset = model.getOffsetAt(selection.getPosition())
      // only from outside the chip, so a reference being typed edits as text
      const chip = chips.value.find((c) => c.column && (isBackspace ? offset === c.end : offset === c.start))
      if (!chip) return

      e.preventDefault()
      e.stopPropagation()
      const start = model.getPositionAt(chip.start)
      const end = model.getPositionAt(chip.end)
      editor.executeEdits('nc-formula-chip', [
        { range: new Range(start.lineNumber, start.column, end.lineNumber, end.column), text: '', forceMoveMarkers: true },
      ])
    })

    refresh()
  }

  return { chips, attach, refresh, chipAround }
}
