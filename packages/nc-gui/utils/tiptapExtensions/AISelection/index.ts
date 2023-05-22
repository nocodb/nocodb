// This file defines a ProseMirror selection subclass that models
// table cell selections. The table plugin needs to be active to wire
// in the user interaction part of table selections (so that you
// actually get such selections when you select across cells).

import type { Node, ResolvedPos } from 'prosemirror-model'
import { Slice } from 'prosemirror-model'
import type { Transaction } from 'prosemirror-state'
import { Selection } from 'prosemirror-state'

import type { Mappable } from 'prosemirror-transform'

/**
 * @public
 */
export interface AISelectionJSON {
  type: string
  anchor: number
  head: number
}

export class AISelection extends Selection {
  // A resolved position pointing _in front of_ the anchor cell (the one
  // that doesn't move when extending the selection).
  public $anchorCell: ResolvedPos

  // A resolved position pointing in front of the head cell (the one
  // moves when extending the selection).
  public $headCell: ResolvedPos

  // A table selection is identified by its anchor and head cells. The
  // positions given to this constructor should point _before_ two
  // cells in the same table. They may be the same, to select a single
  // cell.
  constructor($anchorCell: ResolvedPos, $headCell: ResolvedPos = $anchorCell) {
    super($anchorCell, $headCell)

    this.visible = true
    this.$anchorCell = $anchorCell
    this.$headCell = $headCell
  }

  /// Returns a resolved position if this is a cursor selection (an
  /// empty text selection), and null otherwise.
  get $cursor() {
    return this.$anchor.pos === this.$head.pos ? this.$head : null
  }

  static create(doc: Node, from: number, to?: number) {
    to = to ?? from
    return new AISelection(doc.resolve(from), doc.resolve(to))
  }

  map(doc: Node, mapping: Mappable): Selection {
    const $head = doc.resolve(mapping.map(this.head))
    if (!$head.parent.inlineContent) return Selection.near($head)
    const $anchor = doc.resolve(mapping.map(this.anchor))
    return new AISelection($anchor.parent.inlineContent ? $anchor : $head, $head)
  }

  eq(other: Selection): boolean {
    return other instanceof AISelection && other.anchor === this.anchor && other.head === this.head
  }

  toJSON(): any {
    return { type: 'ai', anchor: this.anchor, head: this.head }
  }

  static fromJSON(doc: Node, json: any) {
    if (typeof json.anchor != 'number') throw new RangeError('Invalid input for NodeSelection.fromJSON')
    const $anchor = doc.resolve(json.anchor)
    const $head = doc.resolve(json.head)
    return new AISelection($anchor, $head)
  }

  /// Replace the selection with a slice or, if no slice is given,
  /// delete the selection. Will append to the given transaction.
  replace(tr: Transaction, content = Slice.empty) {
    // Put the new selection at the position after the inserted
    // content. When that ended in an inline node, search backwards,
    // to get the position after that node. If not, search forward.
    let lastNode = content.content.lastChild
    for (let i = 0; i < content.openEnd; i++) {
      lastNode = lastNode!.lastChild
    }

    const mapFrom = tr.steps.length
    const ranges = this.ranges

    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i]
      const mapping = tr.mapping.slice(mapFrom)
      tr.replace(mapping.map($from.pos), mapping.map($to.pos), i ? Slice.empty : content)
    }
  }

  /// Replace the selection with the given node, appending the changes
  /// to the given transaction.
  replaceWith(tr: Transaction, node: Node) {
    const mapFrom = tr.steps.length
    const ranges = this.ranges
    const oldSelection = tr.selection

    for (let i = 0; i < ranges.length; i++) {
      const { $from, $to } = ranges[i]
      const mapping = tr.mapping.slice(mapFrom)
      const from = mapping.map($from.pos)
      const to = mapping.map($to.pos)
      if (i) {
        tr.deleteRange(from, to)
      } else {
        tr.replaceRangeWith(from, to, node)
        tr.setSelection(AISelection.create(tr.doc, $from.pos, oldSelection.from))
      }
    }
  }
}

Selection.jsonID('ai', AISelection)

AISelection.prototype.visible = true
