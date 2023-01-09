import { Extension } from '@tiptap/core'
import { history, redo, undo } from 'prosemirror-history'

export interface HistoryOptions {
  depth: number
  newGroupDelay: number
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    history: {
      /**
       * Undo recent changes
       */
      undo: () => ReturnType
      /**
       * Reapply reverted changes
       */
      redo: () => ReturnType
    }
  }
}

export const History = Extension.create<HistoryOptions>({
  name: 'history',

  addOptions() {
    return {
      depth: 100,
      newGroupDelay: 500,
    }
  },

  addCommands() {
    return {
      undo:
        () =>
        ({ state, dispatch, editor }) => {
          // check if this is the last undo
          const history = (editor.view.state as any).history$
          if (history.done.eventCount === 1) return true
          return undo(state, dispatch)
        },
      redo:
        () =>
        ({ state, dispatch }) => {
          return redo(state, dispatch)
        },
    }
  },

  addProseMirrorPlugins() {
    return [history(this.options)]
  },

  addKeyboardShortcuts() {
    return {
      'Mod-z': () => this.editor.commands.undo(),
      'Mod-y': () => this.editor.commands.redo(),
      'Shift-Mod-z': () => this.editor.commands.redo(),

      // Russian keyboard layouts
      'Mod-я': () => this.editor.commands.undo(),
      'Shift-Mod-я': () => this.editor.commands.redo(),
    }
  },
})
