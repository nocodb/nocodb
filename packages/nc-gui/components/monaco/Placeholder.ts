import { editor } from 'monaco-editor'

export default class PlaceholderContentWidget implements editor.IEditorContribution {
  static ID = 'editor.widget.placeholderHint'

  protected placeholder: string
  protected editor: editor.ICodeEditor
  protected domNode: HTMLElement | null = null

  constructor(placeholder: string, editor: editor.ICodeEditor) {
    this.placeholder = placeholder
    this.editor = editor
    // register a listener for editor code changes
    editor.onDidChangeModelContent(() => this.onDidChangeModelContent())
    // ensure that on initial load the placeholder is shown
    this.onDidChangeModelContent()
  }

  onDidChangeModelContent() {
    if (this.editor.getValue() === '') {
      this.editor.addContentWidget(this)
    } else {
      this.editor.removeContentWidget(this)
    }
  }

  getId() {
    return PlaceholderContentWidget.ID
  }

  getDomNode() {
    if (!this.domNode) {
      this.domNode = document.createElement('div')
      this.domNode.classList.add('formula-placeholder')
      this.domNode.style.width = 'max-content'
      this.domNode.textContent = this.placeholder
      this.editor.applyFontInfo(this.domNode)
    }

    return this.domNode
  }

  getPosition() {
    return {
      position: { lineNumber: 1, column: 1 },
      preference: [editor.ContentWidgetPositionPreference.EXACT],
    }
  }

  dispose() {
    this.editor.removeContentWidget(this)
  }
}
