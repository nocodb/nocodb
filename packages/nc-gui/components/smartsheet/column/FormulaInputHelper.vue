<script setup lang="ts">
import {
  type ColumnType,
  FormulaDataTypes,
  LIST_AGGREGATE_FUNCTIONS,
  type LinkToAnotherRecordType,
  MAX_DOT_PATH_HOPS,
  ROLLUP_VALUES_KEYWORD,
  type TableType,
  UITypes,
  UITypesName,
  type UnifiedMetaType,
  getMethodFunctions,
  isColumnInError,
  isHiddenCol,
  isLinkToMany,
  isLinksOrLTAR,
  isSystemColumn,
  rollupFormulaFunctions,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk'
import {
  KeyCode,
  KeyMod,
  MarkerSeverity,
  type editor as MonacoEditor,
  Position,
  Range,
  languages,
  editor as monacoEditor,
} from 'monaco-editor'
import formulaLanguage from '../../monaco/formula'
import { isCursorInsideString } from '../../../utils/formulaUtils'
import { type FormulaDotPathMatch, matchFormulaDotPath, matchFormulaFirstReference } from '../../../utils/formulaDotPathUtils'
import { validateFormulaGetMeta } from '../../../utils/validateFormulaGetMeta'
import type { DotPathMenuItem, DotPathMenuSection } from './formula/DotPathMenu.vue'
import { useFormulaChips } from './formula/useFormulaChips'

interface Props {
  error?: boolean
  editorError?: { isError: boolean; message: string; position: { column: number; row: number; length: number } }
  value: string
  label?: string
  editorHeight?: string
  disabledFormulas?: string[]
  // type of the whole formula, to suggest an aggregate when it is a list
  resultInfo?: { type?: string; dataType?: string; isDataArray?: boolean; referencedColumn?: { uidt?: string } }
  // ⌘↵ emits `submit`
  canSubmit?: boolean
  // rollup formula mode: the rolled-up field, offered as the `values` variable
  rollupValuesColumn?: ColumnType
  // validateInfos key the editor reports errors on
  validateKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabledFormulas: () => [],
  validateKey: 'formula_raw',
})

const emits = defineEmits(['update:value', 'submit'])

const { editorHeight } = toRefs(props)

const value = useVModel(props, 'value', emits)

const { $e } = useNuxtApp()

const { isDark } = useTheme()

const uiTypesNotSupportedInFormulas = [UITypes.QrCode, UITypes.Barcode, UITypes.Button]

const { sqlUi, column, validateInfos } = useColumnCreateStoreOrThrow()

const { isAiModeFieldModal } = usePredictFields()

const meta = inject(MetaInj, ref())

const { getMeta, getMetaByKey } = useMetas()

const { t } = useI18n()

const isFormulaSupportedColumn = (col: ColumnType, tableMeta?: TableType) =>
  !uiTypesNotSupportedInFormulas.includes(col.uidt as UITypes) && !isColumnInError(col) && !isHiddenCol(col, tableMeta)

const isRollupMode = computed(() => !!props.rollupValuesColumn)

const fieldValidateInfo = computed(() => validateInfos[props.validateKey])

const supportedColumns = computed(() =>
  props.rollupValuesColumn
    ? [{ ...props.rollupValuesColumn, title: ROLLUP_VALUES_KEYWORD }]
    : meta?.value?.columns?.filter((col) => isFormulaSupportedColumn(col, meta.value)) || [],
)

// chips resolve against what the formula can reference: in a rollup, only `values`
const chipsMeta = computed(() => (isRollupMode.value ? { ...meta.value, columns: supportedColumns.value } : meta.value))

const rollupFunctionMetas = new Map(Object.entries(rollupFormulaFunctions))

// a rollup formula offers its aggregates first, then the scalar functions that wrap them
const rollupFunctionNames = [...rollupFunctionMetas.keys()]

const availableFunctions = computed(() =>
  (isRollupMode.value
    ? [...rollupFunctionNames, ...formulaList.filter((fn: string) => !rollupFunctionNames.includes(fn))]
    : formulaList
  ).filter((fn: string) => !props.disabledFormulas.includes(`${fn}()`)),
)

// the function call around the caret, for the signature hint below the editor
const signatureHint = ref<{
  name: string
  params: string[]
  activeParam: number
  description?: string
  docsUrl?: string
} | null>(null)

// set while the cursor is right after `{Link}.` — suggestions then come from the linked table
const dotPathContext = ref<{ hasBrace: boolean; partial: string; isMethod?: boolean } | null>(null)

let dotPathRequest = 0

interface DotPathMenuState {
  sections: DotPathMenuSection[]
  activeKey?: string
  isListContext: boolean
  position: { top: number; left: number }
}

const dotMenu = ref<DotPathMenuState | null>(null)

// Esc closes the menu until the formula changes again
const isDotMenuDismissed = ref(false)

// highlighted when the menu opens to swap a clicked reference or function
let preferredMenuLabel: string | undefined

const chipIconHost = ref<HTMLElement>()

// columns whose header icon is rendered once, then reused as a CSS mask in chips
const chipIconColumns = ref<ColumnType[]>([])

const chipIconClasses = reactive(new Map<string, string>())

const isMounted = ref(false)

const isToManyLink = (c: ColumnType) =>
  isLinksOrLTAR(c) && !!c.colOptions && isLinkToMany(c, c.colOptions as LinkToAnotherRecordType)

const formulaChips = useFormulaChips({
  meta: chipsMeta,
  getMeta: (baseId, tableId) => getMeta(baseId, tableId),
  getMetaByKey,
  iconClassFor: chipIconClass,
  bareReference: computed(() =>
    props.rollupValuesColumn ? { keyword: ROLLUP_VALUES_KEYWORD, column: supportedColumns.value[0]! } : undefined,
  ),
})

// Aggregates offered when the whole formula is a list, e.g. `{Tasks}.{Hours}`
const listResultAggregates = computed(() => {
  const info = props.resultInfo
  if (!info?.isDataArray || info.type !== 'MemberExpression') return []
  return info.dataType === 'numeric' ? ['SUM', 'AVG', 'MIN', 'MAX', 'COUNTA'] : ['COUNTA', 'CONCAT']
})

// one whole sentence per list type, so translations can word each naturally
const listResultMessage = computed(() => {
  switch (props.resultInfo?.dataType) {
    case 'numeric':
      return t('labels.formulaDotPath.listOfNumbers')
    case 'string':
      return t('labels.formulaDotPath.listOfText')
    default:
      return t('labels.formulaDotPath.listOfValues')
  }
})

// field type a formula result is shown as, when it isn't based on one field
const RESULT_TYPE_UIDT: Partial<Record<string, UITypes>> = {
  [FormulaDataTypes.NUMERIC]: UITypes.Number,
  [FormulaDataTypes.STRING]: UITypes.SingleLineText,
  [FormulaDataTypes.DATE]: UITypes.DateTime,
  [FormulaDataTypes.BOOLEAN]: UITypes.Checkbox,
  [FormulaDataTypes.COND_EXP]: UITypes.Checkbox,
  [FormulaDataTypes.INTERVAL]: UITypes.Time,
}

// Valid · Returns <type> · one value / a list · Links followed n · depth d of max
const statusBar = computed(() => {
  if (!value.value?.trim()) return null

  const isValid = fieldValidateInfo.value?.validateStatus !== 'error' && !props.editorError?.isError
  // editors without a result type (Button URL) keep the form item's own message
  if (!props.resultInfo) return null
  const info = props.resultInfo

  const errorMessage = isValid
    ? undefined
    : props.editorError?.isError
    ? props.editorError.message
    : (fieldValidateInfo.value?.help as unknown[] | undefined)
        ?.flat()
        .filter((m) => typeof m === 'string')
        .join(' ')
  // a formula field's own type says nothing about its result; show what it returns
  const referencedUidt = info.referencedColumn?.uidt as UITypes | undefined
  const uidt =
    referencedUidt && referencedUidt !== UITypes.Formula
      ? referencedUidt
      : RESULT_TYPE_UIDT[info.dataType ?? ''] ?? referencedUidt

  return {
    isValid,
    errorMessage,
    uidt: isValid ? uidt : undefined,
    typeLabel: uidt ? UITypesName[uidt as keyof typeof UITypesName] ?? uidt : undefined,
  }
})

const monacoRoot = ref<HTMLDivElement>()
let editor: MonacoEditor.IStandaloneCodeEditor
let model: MonacoEditor.ITextModel

onBeforeUnmount(() => {
  editor?.dispose()
  model?.dispose()
})

const handleInputDeb = useDebounceFn(function () {
  // the editor may have lost focus during the debounce
  if (!editor?.hasTextFocus()) return
  handleInput()
}, 250)

onMounted(async () => {
  if (monacoRoot.value) {
    model = monacoEditor.createModel(value.value, 'formula')

    languages.register({
      id: formulaLanguage.name,
    })

    monacoEditor.defineTheme(formulaLanguage.name, isDark.value ? formulaLanguage.themeDark : formulaLanguage.theme)

    languages.setMonarchTokensProvider(
      formulaLanguage.name,
      // replace @ with \x01 to avoid conflict with monaco's tokenizer
      formulaLanguage.generateLanguageDefinition(supportedColumns.value.map((c) => c.title!.replace(/@/g, '\x01'))),
    )

    languages.setLanguageConfiguration(formulaLanguage.name, formulaLanguage.languageConfiguration)

    editor = monacoEditor.create(monacoRoot.value, {
      model,
      'contextmenu': false,
      'theme': 'formula',
      'selectOnLineNumbers': false,
      'language': 'formula',
      'roundedSelection': false,
      'scrollBeyondLastLine': false,
      'lineNumbers': 'off',
      'glyphMargin': false,
      'folding': false,
      'wordWrap': 'on',
      'wrappingStrategy': 'advanced',
      // This seems to be a bug in the monoco.
      // https://github.com/microsoft/monaco-editor/issues/4535#issuecomment-2234042290
      'bracketPairColorization.enabled': false,
      'padding': {
        top: 8,
        bottom: 8,
      },
      'lineDecorationsWidth': 8,
      'lineNumbersMinChars': 0,
      'renderLineHighlight': 'none',
      'renderIndentGuides': false,
      'scrollbar': {
        horizontal: 'hidden',
        // the reserved width keeps text clear of the field button; the visible thumb stays thin
        verticalScrollbarSize: 36,
        verticalSliderSize: 6,
        // the track starts below the field button (and ends above the resize grip); the arrows are hidden
        verticalHasArrows: true,
        arrowSize: 26,
      },
      'tabSize': 2,
      'automaticLayout': false,
      'overviewRulerLanes': 0,
      'hideCursorInOverviewRuler': true,
      'overviewRulerBorder': false,
      'matchBrackets': 'never',
      'minimap': {
        enabled: false,
      },
      // Don't suggest words from the document, shown when typing COUNT(C
      'wordBasedSuggestions': 'off',
      // room for reference chips
      'lineHeight': 26,
      'placeholder': t('placeholder.formulaEditor'),
    })

    editor.layout({
      width: monacoRoot.value.clientWidth || 339,
      height: 120,
    })

    // a re-created editor would otherwise lose an error held from before
    applyEditorError()

    formulaChips.attach(editor)

    editor.onKeyDown(handleDotMenuKey)

    // Esc closes the menu until the next click or keystroke, not until the text changes
    editor.onKeyDown((e) => {
      if (e.keyCode !== KeyCode.Escape) isDotMenuDismissed.value = false
    })
    editor.onMouseDown(() => {
      isDotMenuDismissed.value = false
    })

    // ⌘↵ / Ctrl+↵ saves the field
    editor.onKeyDown((e) => {
      if (e.keyCode !== KeyCode.Enter || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      e.stopPropagation()
      if (!props.canSubmit) return
      closeDotMenu()
      $e('c:field:formula:save')
      emits('submit')
    })

    // Ctrl+Space browses everything available at the caret, replacing Monaco's own suggest
    editor.addCommand((isMac() ? KeyMod.WinCtrl : KeyMod.CtrlCmd) | KeyCode.Space, () => openBrowseMenu())

    editor.onDidBlurEditorText(() => closeDotMenu())

    editor.onDidChangeModelContent(async () => {
      value.value = editor.getValue()
      isDotMenuDismissed.value = false
      await handleInputDeb()
    })

    editor.onDidChangeCursorPosition((e) => {
      if (!isMounted.value) return
      updateSignatureHint()
      // the menu follows typing; a click or arrow key only moves the caret
      if (
        [
          monacoEditor.CursorChangeReason.Explicit,
          monacoEditor.CursorChangeReason.Undo,
          monacoEditor.CursorChangeReason.Redo,
        ].includes(e.reason)
      ) {
        closeDotMenu()
        return
      }
      handleInput()
    })

    // clicking into an empty editor opens the menu to browse fields and functions;
    // focus alone (on mount, or the window regaining focus) does not.
    // Deferred past the click's own caret move, which closes the menu.
    editor.onMouseUp((e) => {
      if (!editor.getValue().trim()) return handleInput({ browse: true })
      // a click on a chip or a function name opens the menu to swap it, like backspacing into it;
      // clicks on plain text only move the caret
      if (!editor.getSelection()?.isEmpty()) return
      openSwapMenu(e.target.element, e.target.position)
    })

    forcedNextTick(() => {
      isMounted.value = true
      editor.focus()
    })
  }
})

// Everything available at the caret: Ctrl+Space and the field button
function openBrowseMenu({ fromButton = false }: { fromButton?: boolean } = {}) {
  if (!editor) return
  isDotMenuDismissed.value = false
  if (fromButton) editor.focus()
  const model = editor.getModel()
  const position = editor.getPosition()
  const before = model && position ? model.getValue().slice(0, model.getOffsetAt(position)) : ''
  // right after a reference, continue its path as if `.` was typed
  if (before.endsWith('}')) {
    editor.trigger('keyboard', 'type', { text: '.' })
    return
  }
  // right after any other value, an insert would need an operator first; the button still
  // opens the menu, since nothing else on screen would explain why it did nothing
  if (!fromButton && /[)"'\d]$/.test(before) && !matchFormulaFirstReference(before)) return
  handleInput({ browse: true })
}

function openSwapMenu(element: Element | null | undefined, position: Position | null | undefined) {
  const model = editor.getModel()
  if (!model || !position) return
  const offset = model.getOffsetAt(position)

  // a chip: put the caret just inside its `{`, so a pick replaces the whole reference
  if (element?.closest('.nc-fx-chip-text, .nc-fx-chip-start, .nc-fx-chip-end')) {
    const chip = formulaChips.chips.value.find((c) => c.column && offset >= c.start && offset <= c.end)
    if (!chip) return
    preferredMenuLabel = chip.column?.title
    editor.setPosition(model.getPositionAt(chip.start + 1))
    handleInput()
    return
  }

  // a function name, e.g. `IF` in `IF(` or `ROUND` in `{Hours}.ROUND(`
  const word = model.getWordAtPosition(position)
  if (!word) return
  const name = word.word.toUpperCase()
  const afterWord = model.getValue()[model.getOffsetAt({ lineNumber: position.lineNumber, column: word.endColumn })]
  if (afterWord !== '(' || !getFunctionMeta(name) || isCursorInsideString(model.getValue(), offset)) return
  preferredMenuLabel = name
  editor.setPosition({ lineNumber: position.lineNumber, column: word.startColumn })
  handleInput({ browse: true })
}

// the menu keeps the editor focused, so a click elsewhere has to close it
useEventListener(document, 'pointerdown', (e) => {
  if (!dotMenu.value) return
  const target = e.target as HTMLElement | null
  if (monacoRoot.value?.contains(target) || target?.closest('.nc-formula-dot-menu-wrapper')) return
  closeDotMenu()
})

// the menu is fixed-positioned; keep it at the caret when the form scrolls or the window resizes
function repositionDotMenu() {
  if (dotMenu.value) dotMenu.value.position = dotMenuPosition()
}
useEventListener(window, 'resize', repositionDotMenu)
useEventListener(document, 'scroll', repositionDotMenu, { capture: true, passive: true })

useResizeObserver(monacoRoot, (entries) => {
  if (!editor) return
  const entry = entries[0]
  const { width, height } = entry.contentRect
  editor.layout({
    width: width || 339,
    height,
  })
})

function chipIconClass(column: ColumnType) {
  const cls = chipIconClasses.get(column.id!)
  if (!cls && !chipIconColumns.value.some((c) => c.id === column.id)) {
    chipIconColumns.value.push(column)
    nextTick(registerChipIcons)
  }
  return cls
}

// has-many / belongs-to / many-to-many icons carry their colour in the SVG strokes
function linkIconColor(svg: SVGElement) {
  for (const el of svg.querySelectorAll('[stroke], [fill]')) {
    for (const attr of ['stroke', 'fill']) {
      const color = el.getAttribute(attr)
      if (color && !['none', 'transparent', 'currentColor'].includes(color)) return color
    }
  }
  return getComputedStyle(svg).color
}

// Turns the header icons rendered in the hidden host into CSS mask classes
function registerChipIcons() {
  const host = chipIconHost.value
  if (!host) return

  let styleEl = document.getElementById('nc-formula-chip-icons') as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement('style')
    styleEl.id = 'nc-formula-chip-icons'
    document.head.appendChild(styleEl)
  }

  let added = false
  for (const el of host.querySelectorAll<HTMLElement>('[data-icon-key]')) {
    const key = el.dataset.iconKey!
    if (chipIconClasses.has(key)) continue
    const svg = el.querySelector('svg')
    if (!svg) continue
    const cls = `nc-fx-ico-${key.replace(/[^\w-]/g, '')}${isDark.value ? '-dark' : ''}`
    chipIconClasses.set(key, cls)
    added = true
    // the sheet is shared by every editor instance; add each rule once
    if (styleEl.textContent?.includes(`.${cls}::before`)) continue
    const url = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg.outerHTML)}")`
    // link icons keep their relation colour, as in the grid header
    const column = chipIconColumns.value.find((c) => c.id === key)
    const tint = column && isLinksOrLTAR(column) ? `background-color:${linkIconColor(svg)}!important` : ''
    styleEl.textContent += `.${cls}::before{-webkit-mask-image:${url};mask-image:${url};${tint}}`
  }
  if (added) formulaChips.refresh()
}

function getFunctionMeta(fn: string) {
  return (isRollupMode.value && rollupFunctionMetas.get(fn)) || formulas[fn]
}

function formulaDescription(fn: string) {
  return getFunctionMeta(fn)?.description
}

// `{Tasks}.{Hours}` + `.SUM()`
function appendListAggregate(fn: string) {
  const model = editor?.getModel()
  if (!model) return
  const end = model.getPositionAt(model.getValue().trimEnd().length)
  editor.executeEdits('nc-formula-aggregate', [
    { range: new Range(end.lineNumber, end.column, end.lineNumber, end.column), text: `.${fn}()`, forceMoveMarkers: true },
  ])
  editor.setPosition(model.getPositionAt(model.getValue().trimEnd().length))
  editor.focus()
}

function insertStringAtPosition(editor: MonacoEditor.IStandaloneCodeEditor, text: string, skipCursorMove = false) {
  const position = editor.getPosition()

  if (!position) {
    return
  }
  const range = new Range(position.lineNumber, position.column, position.lineNumber, position.column)

  editor.executeEdits('', [
    {
      range,
      text,
      forceMoveMarkers: true,
    },
  ])

  // Move the cursor to the end of the inserted text
  if (!skipCursorMove) {
    const newPosition = new Position(position.lineNumber, position.column + text.length - 1)
    editor.setPosition(newPosition)
  }

  editor.focus()
}

function dotPathFieldRank(c: ColumnType) {
  if (c.pv) return 0
  if (c.pk || c.system || isSystemColumn(c)) return 2
  return 1
}

function dotPathFieldHint(c: ColumnType) {
  if (isLinksOrLTAR(c)) {
    return isToManyLink(c) ? t('labels.formulaDotPath.linkMany') : t('labels.formulaDotPath.linkOne')
  }
  const typeName = UITypesName[c.uidt as keyof typeof UITypesName] ?? c.uidt
  return c.pv ? `${typeName} · ${t('labels.formulaDotPath.displayValue')}` : typeName
}

// Type of `{A}.{B}` as a formula would see it, e.g. a list of numbers
async function dotPathValueType(segments: string[]) {
  try {
    const tree = await validateFormulaAndExtractTreeWithType({
      formula: segments.map((segment) => `{${segment}}`).join('.'),
      columns: (meta.value?.columns ?? []) as UnifiedMetaType.IColumn[],
      clientOrSqlUi: sqlUi.value,
      getMeta: validateFormulaGetMeta(getMeta),
    })
    return { dataType: tree.dataType, isDataArray: !!tree.isDataArray }
  } catch {
    return null
  }
}

function functionMenuItems(functionNames: string[], partial: string): DotPathMenuItem[] {
  const unsupportedFnList = sqlUi.value?.getUnsupportedFnList() || []
  return (
    functionNames
      .filter((fn) => getFunctionMeta(fn) && fn.toLowerCase().startsWith(partial))
      .map((fn) => {
        const fnMeta = getFunctionMeta(fn)!
        return {
          key: `fn:${fn}`,
          kind: 'function' as const,
          label: fn,
          hint: '',
          description: fnMeta.description,
          syntax: fnMeta.syntax,
          examples: fnMeta.examples,
          docsUrl: fnMeta.docsUrl,
          unsupported: unsupportedFnList.includes(fn) && !LIST_AGGREGATE_FUNCTIONS.includes(fn),
        }
      })
      // functions the database can't run go last
      .sort((a, b) => Number(!!a.unsupported) - Number(!!b.unsupported))
  )
}

// Menu contents for the reference after `{A}.{B}.`, or null when the path does not resolve
async function resolveDotPathMenu(match: FormulaDotPathMatch) {
  // a rollup formula has one variable, `values`, and no paths
  if (isRollupMode.value) {
    // `values.` takes the aggregates and value-set functions as methods: `values.SUM()`
    if (match.segments.length === 1 && match.segments[0] === ROLLUP_VALUES_KEYWORD) {
      const items = functionMenuItems(rollupFunctionNames, match.partial.toLowerCase())
      return {
        sections: [{ key: 'functions', title: t('labels.formulaDotPath.listFunctions'), items }],
        isListContext: true,
      }
    }
    if (match.segments.length) return null
    const partial = match.partial.toLowerCase()
    const fields: DotPathMenuItem[] = supportedColumns.value
      .filter((c) => c.title!.toLowerCase().includes(partial))
      .map((c) => ({ key: `field:${c.id}`, kind: 'field', label: c.title!, hint: dotPathFieldHint(c), column: c }))
    const sections: DotPathMenuSection[] = [
      { key: 'fields', title: t('objects.fields'), items: fields },
      {
        key: 'functions',
        title: t('labels.formulaDotPath.functions'),
        items: functionMenuItems(availableFunctions.value, partial),
      },
    ]
    return { sections, isListContext: false }
  }

  let tableMeta: TableType | undefined | null = meta.value
  let isList = false
  let last: ColumnType | undefined
  const breadcrumb = [meta.value?.title ?? '']

  for (const [i, title] of match.segments.entries()) {
    last = tableMeta?.columns?.find((c) => c.title === title)
    if (!last) return null
    if (!isLinksOrLTAR(last)) {
      // only the last reference may be a plain value, followed by a function
      if (i !== match.segments.length - 1) return null
      break
    }
    const colOptions = last.colOptions as LinkToAnotherRecordType
    isList = isList || isLinkToMany(last, colOptions)
    tableMeta = await getMeta(
      colOptions.fk_related_base_id || last.base_id || meta.value?.base_id || '',
      colOptions.fk_related_model_id!,
    )
    if (!tableMeta) return null
    breadcrumb.push(last.title ?? '')
  }

  const partial = match.partial.toLowerCase()
  // the first reference suggests from this table
  const isFirstReference = !match.segments.length
  const isLinkContext = !!last && isLinksOrLTAR(last)

  const fields: DotPathMenuItem[] =
    isLinkContext || isFirstReference
      ? [...(tableMeta?.columns ?? [])]
          // display value first, system fields last
          .sort((a, b) => dotPathFieldRank(a) - dotPathFieldRank(b))
          .filter(
            (c) =>
              isFormulaSupportedColumn(c, tableMeta ?? undefined) &&
              !(c.uidt === UITypes.LinkToAnotherRecord && c.system) &&
              // link plumbing the grid never shows; still valid when typed
              c.uidt !== UITypes.ForeignKey &&
              // a formula can't reference itself
              !(isFirstReference && c.id === column?.value?.id) &&
              !!c.title?.toLowerCase().includes(partial),
          )
          .map((c) => ({
            key: `field:${c.id}`,
            kind: 'field',
            label: c.title!,
            hint: dotPathFieldHint(c),
            column: c,
            isLink: isLinksOrLTAR(c) && breadcrumb.length <= MAX_DOT_PATH_HOPS,
            isList: isList || isToManyLink(c),
          }))
      : []

  // `{` starts a field reference, so only a bare word also matches functions
  let functionNames: string[] = []
  if (isFirstReference) {
    functionNames = match.hasBrace ? [] : availableFunctions.value
  } else if (!isLinkContext) {
    // after a value, only functions that take it: `{Hours}.ROUND()`, `{Tasks}.{Title}.COUNTA()`.
    // A path ending on a link offers fields only — bare `{Tasks}` is the link count, not a list.
    const value = await dotPathValueType(match.segments)
    functionNames = (getMethodFunctions(value?.dataType, value?.isDataArray ?? isList) ?? availableFunctions.value).filter(
      (fn) => !props.disabledFormulas.includes(`${fn}()`),
    )
  }
  const functions = functionMenuItems(functionNames, partial)

  const fieldSection: DotPathMenuSection = { key: 'fields', title: t('objects.fields'), items: fields }
  const functionSection: DotPathMenuSection = {
    key: 'functions',
    title: isList ? t('labels.formulaDotPath.listFunctions') : t('labels.formulaDotPath.functions'),
    items: functions,
  }
  // a typed bare word is more often a function name; browsing starts with fields
  const sections =
    isFirstReference && !match.hasBrace && match.partial ? [functionSection, fieldSection] : [fieldSection, functionSection]

  return {
    sections,
    isListContext: isList,
  }
}

// Just below the caret, kept inside the viewport
function dotMenuPosition() {
  const position = editor.getPosition()
  const visible = position ? editor.getScrolledVisiblePosition(position) : null
  const rect = editor.getDomNode()?.getBoundingClientRect()
  if (!visible || !rect) return { top: 0, left: 0 }
  // list + preview, or the list alone where the preview is hidden
  const menuWidth = window.innerWidth > 640 ? 600 : 340
  const menuHeight = document.querySelector<HTMLElement>('.nc-formula-dot-menu')?.offsetHeight || 380
  const below = rect.top + visible.top + visible.height + 6
  return {
    top: below + menuHeight > window.innerHeight ? Math.max(8, rect.top + visible.top - menuHeight - 6) : below,
    left: Math.max(8, Math.min(rect.left + visible.left - 16, window.innerWidth - menuWidth - 8)),
  }
}

function showDotPathSuggestions(match: FormulaDotPathMatch) {
  const request = ++dotPathRequest
  dotPathContext.value = { hasBrace: match.hasBrace, partial: match.partial, isMethod: match.segments.length > 0 }

  resolveDotPathMenu(match).then((menu) => {
    if (request !== dotPathRequest) return

    const items = menu?.sections.flatMap((section) => section.items) ?? []
    dotMenu.value =
      menu && items.length && !isDotMenuDismissed.value
        ? {
            ...menu,
            activeKey: (
              items.find((item) => !item.unsupported && item.label === preferredMenuLabel) ??
              items.find((item) => !item.unsupported)
            )?.key,
            position: dotMenuPosition(),
          }
        : null
    preferredMenuLabel = undefined
    // the first position guesses the height; place it again once rendered
    if (dotMenu.value) nextTick(repositionDotMenu)
  })
}

function closeDotMenu() {
  dotPathRequest++
  dotMenu.value = null
}

function selectDotMenuItem(item: DotPathMenuItem, openLink = false) {
  if (item.unsupported) return
  $e('c:field:formula:reference:insert', { kind: item.kind, openLink })
  appendDotPathText(item.kind === 'field' ? { type: 'column', text: item.label } : { type: 'function', text: `${item.label}()` })
  if (openLink) insertStringAtPosition(editor, '.', true)
  closeDotMenu()
  // follow the link straight into the next hop
  if (openLink) handleInput()
}

function moveDotMenuSelection(step: number) {
  const menu = dotMenu.value
  if (!menu) return
  const items = menu.sections.flatMap((section) => section.items).filter((item) => !item.unsupported)
  if (!items.length) return
  const index = items.findIndex((item) => item.key === menu.activeKey)
  menu.activeKey = items[(index + step + items.length) % items.length]!.key
}

function activeDotMenuItem() {
  const menu = dotMenu.value
  return menu?.sections.flatMap((section) => section.items).find((item) => item.key === menu.activeKey)
}

// Arrow keys, Enter, → and Esc drive the dot menu while it is open
function handleDotMenuKey(e: {
  keyCode: KeyCode
  metaKey?: boolean
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  preventDefault: () => void
  stopPropagation: () => void
}) {
  if (!dotMenu.value) return
  // ⌘↵ saves as typed, without picking the highlighted item
  if (e.keyCode === KeyCode.Enter && (e.metaKey || e.ctrlKey)) return

  const consume = () => {
    e.preventDefault()
    e.stopPropagation()
  }
  const active = activeDotMenuItem()
  const hasSelectable = dotMenu.value.sections.some((section) => section.items.some((item) => !item.unsupported))

  switch (e.keyCode) {
    case KeyCode.DownArrow:
      if (!hasSelectable) return
      consume()
      moveDotMenuSelection(1)
      break
    case KeyCode.UpArrow:
      if (!hasSelectable) return
      consume()
      moveDotMenuSelection(-1)
      break
    case KeyCode.Enter:
    case KeyCode.Tab:
      // Shift+Enter still adds a line
      if (e.shiftKey || e.altKey) return
      if (!active || active.unsupported) return
      consume()
      selectDotMenuItem(active)
      break
    case KeyCode.RightArrow:
      if (!active?.isLink) return
      consume()
      selectDotMenuItem(active, true)
      break
    case KeyCode.Escape:
      consume()
      isDotMenuDismissed.value = true
      closeDotMenu()
      break
  }
}

// Replaces the partially typed reference after `.` with the chosen field or function
function appendDotPathText(item: Record<string, any>) {
  const context = dotPathContext.value
  const model = editor.getModel()
  const position = editor.getPosition()
  if (!context || !model || !position || !item?.text) return

  const offset = model.getOffsetAt(position)
  const value = model.getValue()
  const start = offset - context.partial.length - (context.hasBrace ? 1 : 0)
  // the rest of the reference or word after the caret is replaced too, so picking
  // inside `{Bud|get}` or `SU|M` swaps it instead of leaving a fragment behind
  let end = offset
  if (context.hasBrace) {
    const close = value.indexOf('}', offset)
    const rest = close === -1 ? '' : value.slice(offset, close)
    // `{` is auto-closed, so a `}` may already follow the cursor
    if (close !== -1 && !/[{\n]/.test(rest)) end = close + 1
  } else {
    end += /^\w*/.exec(value.slice(offset))![0].length
  }
  // picking `IF` right before an existing `(` keeps that call's own parentheses
  const keepsParens = item.type === 'function' && value[end] === '('
  const text =
    item.type === 'column'
      ? isRollupMode.value
        ? item.text
        : `{${item.text}}`
      : keepsParens
      ? String(item.text).replace(/\(\)$/, '')
      : item.text

  const startPosition = model.getPositionAt(start)
  const endPosition = model.getPositionAt(end)
  // its own undo step, so ⌘Z returns to what was typed
  editor.pushUndoStop()
  editor.executeEdits('', [
    {
      range: new Range(startPosition.lineNumber, startPosition.column, endPosition.lineNumber, endPosition.column),
      text,
      forceMoveMarkers: true,
    },
  ])

  // functions get the cursor between their parentheses, unless called on a value
  // and needing nothing more: `{Tasks}.{Hours}.SUM()|`
  const fnName = item.type === 'function' ? String(item.text).replace(/\(\)$/, '') : ''
  const fnMeta = fnName ? getFunctionMeta(fnName) : undefined
  // rollup functions carry no arg rules; their syntax lists the parameters
  const minArgs = fnMeta?.validation?.args?.min ?? (isRollupMode.value ? syntaxParams(fnMeta?.syntax ?? '').length : 0)
  const needsArgs = !!fnName && (!context.isMethod || minArgs > 1)
  const caret = keepsParens ? start + text.length + 1 : start + text.length - (needsArgs ? 1 : 0)
  editor.setPosition(model.getPositionAt(caret))
  editor.pushUndoStop()
  editor.focus()

  dotPathContext.value = null
}

// `values.` / `values.SU` right before the cursor; `{values}.` is a regular dot path
function matchRollupValuesMethod(textBeforeCursor: string): FormulaDotPathMatch | null {
  const match = textBeforeCursor.match(new RegExp(`(?:^|[^\\w.{}])${ROLLUP_VALUES_KEYWORD}\\s*\\.\\s*(\\w*)$`))
  return match ? { segments: [ROLLUP_VALUES_KEYWORD], hasBrace: false, partial: match[1] ?? '' } : null
}

function handleInput({ browse = false }: { browse?: boolean } = {}) {
  if (!editor) return

  const model = editor.getModel()
  const position = editor.getPosition()

  if (!model || !position) return

  const text = model.getValue()
  const offset = model.getOffsetAt(position)

  if (text.length === 0) {
    // clear error if formula is empty
    if (fieldValidateInfo.value?.validateStatus === 'error') {
      fieldValidateInfo.value.validateStatus = 'success'
      fieldValidateInfo.value.help = []
    }
  }

  // no suggestions inside a string
  if (isCursorInsideString(text, offset)) {
    closeDotMenu()
    return
  }

  const match =
    (isRollupMode.value ? matchRollupValuesMethod(text.slice(0, offset)) : null) ??
    matchFormulaDotPath(text.slice(0, offset)) ??
    matchFormulaFirstReference(text.slice(0, offset)) ??
    // an empty editor, or Ctrl+Space anywhere, lists everything
    (browse || !text.trim() ? { segments: [], hasBrace: false, partial: '' } : null)

  if (match) {
    showDotPathSuggestions(match)
    return
  }
  closeDotMenu()
  dotPathContext.value = null
}

// Parameter names from a syntax string: `ROUND(value, precision)` → [value, precision]
function syntaxParams(syntax: string) {
  const open = syntax.indexOf('(')
  if (open === -1) return []
  const params: string[] = []
  let depth = 0
  let current = ''
  for (const ch of syntax.slice(open + 1)) {
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (ch === ')' && depth === 0) break
    if (ch === ',' && depth === 0) {
      params.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  if (current.trim()) params.push(current.trim())
  return params
}

// Finds the innermost call around the caret and which argument the caret is in
function updateSignatureHint() {
  const model = editor?.getModel()
  const position = editor?.getPosition()
  if (!model || !position) return

  const text = model.getValue()
  const offset = model.getOffsetAt(position)

  // quote state per character, so parentheses inside strings are ignored
  const inString: boolean[] = []
  let quote = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quote) {
      if (ch === '\\') {
        inString[i] = inString[i + 1] = true
        i++
        continue
      }
      inString[i] = true
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") {
      quote = ch
      inString[i] = true
    }
  }

  let depth = 0
  let commas = 0
  for (let i = offset - 1; i >= 0; i--) {
    if (inString[i]) continue
    const ch = text[i]
    if (ch === ')') depth++
    else if (ch === '(') {
      if (depth === 0) {
        const name = text.slice(0, i).match(/(\.?)(\w+)\s*$/)
        const fn = name?.[2]?.toUpperCase()
        const meta = fn ? getFunctionMeta(fn) : undefined
        if (!fn || !meta) break
        signatureHint.value = {
          name: fn,
          params: syntaxParams(meta.syntax ?? ''),
          // in `x.FN(a)` the first parameter is the value before the dot
          activeParam: commas + (name?.[1] ? 1 : 0),
          description: meta.description,
          docsUrl: meta.docsUrl,
        }
        return
      }
      depth--
    } else if (ch === ',' && depth === 0) commas++
  }
  signatureHint.value = null
}

const { isAiFeaturesEnabled, aiIntegrationAvailable, aiLoading, predictFormula, repairFormula } = useNocoAi()

enum AI_MODE {
  NONE = 'none',
  PROMPT = 'prompt',
}

const aiMode = ref<AI_MODE>(AI_MODE.NONE)

const aiPrompt = ref('')

const oldAiPrompt = ref('')

const calledFun = ref<null | string>(null)

const promptAI = async () => {
  if (!aiPrompt.value?.trim()) return

  calledFun.value = 'promptAI'

  $e(`a:column:ai:formula:predict-from-prompt`, {
    prompt: aiPrompt.value,
  })

  const formula = await predictFormula(aiPrompt.value, meta.value?.id, value.value)

  if (formula) {
    editor.setValue(formula)
    oldAiPrompt.value = aiPrompt.value
  }
}

const repairFormulaAI = async () => {
  calledFun.value = 'repairFormulaAI'

  $e(`a:column:ai:formula:repair`)

  const formula = await repairFormula(value.value, meta.value?.id, fieldValidateInfo.value?.help.join(' | '))

  if (formula) {
    editor.setValue(formula)
  }
}

const enableAI = async () => {
  $e(`c:column:ai:formula:enable`)

  if (fieldValidateInfo.value?.validateStatus === 'error') {
    await repairFormulaAI()
  } else {
    aiMode.value = AI_MODE.PROMPT
  }
}

function applyEditorError(value = props.editorError) {
  if (!editor) return
  if (value?.isError) {
    monacoEditor.setModelMarkers(editor.getModel()!, 'owner', [
      {
        startLineNumber: value.position.row + 1,
        startColumn: value.position.column + 1,
        endLineNumber: value.position.row + 1,
        // an empty range gets no hover
        endColumn: value.position.column + 1 + Math.max(1, value.position.length),
        message: value.message,
        severity: MarkerSeverity.Error,
      },
    ])
  } else {
    monacoEditor.setModelMarkers(editor.getModel()!, 'owner', [])
  }
}

// set monaco module markers every editor error change
watch(() => props.editorError, applyEditorError)
const validationErrorDisplay = computed(() => {
  if (props.editorError?.isError) return { validateStatus: 'success' }
  // the status bar shows the message, so the form item keeps only the state
  if (statusBar.value) return { ...fieldValidateInfo.value, help: undefined }
  return fieldValidateInfo.value
})
</script>

<template>
  <a-form-item :label="label" required v-bind="validationErrorDisplay">
    <div class="relative">
      <div
        ref="monacoRoot"
        :style="{
          height: editorHeight ?? '100px',
        }"
        :class="{
          '!border-nc-border-red formula-error':
            validationErrorDisplay?.validateStatus && validationErrorDisplay?.validateStatus !== 'success',
          '!focus-within:border-nc-border-brand shadow-default hover:shadow-hover formula-success':
            !validationErrorDisplay?.validateStatus || validationErrorDisplay?.validateStatus === 'success',
          'bg-nc-bg-default': isAiModeFieldModal,
        }"
        class="formula-monaco transition-colors duration-300"
        @keydown.stop
      ></div>
      <div class="nc-formula-browse-btn-wrapper">
        <NcTooltip :title="$t('labels.formulaDotPath.addFieldOrFunction')" :arrow="false" hide-on-click>
          <NcButton
            v-e="['c:field:formula:menu:open']"
            size="xs"
            type="text"
            class="nc-formula-browse-btn !px-1"
            data-testid="nc-formula-browse-btn"
            :aria-label="$t('labels.formulaDotPath.addFieldOrFunction')"
            @mousedown.prevent
            @click.stop="openBrowseMenu({ fromButton: true })"
          >
            <GeneralIcon icon="ncPlusSquareSolid" class="text-nc-content-brand" />
          </NcButton>
        </NcTooltip>
      </div>
    </div>
    <div v-if="signatureHint" class="nc-formula-signature" data-testid="nc-formula-signature">
      <!-- docs link pinned to the signature row, so it stays put however long the description is -->
      <div class="flex items-center gap-2">
        <div class="flex-1 min-w-0 font-mono text-[12px] leading-5 truncate">
          <span class="text-nc-content-brand font-semibold">{{ signatureHint.name }}</span
          ><span class="text-nc-content-gray-muted">(</span
          ><template v-for="(param, index) of signatureHint.params" :key="index"
            ><span v-if="index" class="text-nc-content-gray-muted">, </span
            ><span
              :class="
                index === Math.min(signatureHint.activeParam, signatureHint.params.length - 1)
                  ? 'nc-formula-signature-active'
                  : 'text-nc-content-gray-subtle2'
              "
              >{{ param }}</span
            ></template
          ><span class="text-nc-content-gray-muted">)</span>
        </div>
        <a
          v-if="signatureHint.docsUrl"
          :href="signatureHint.docsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-none flex items-center gap-0.5 text-bodySm !text-nc-content-gray-muted hover:!text-nc-content-brand !no-underline"
        >
          {{ $t('labels.viewInDocs') }}
          <GeneralIcon icon="ncExternalLink" class="flex-none w-3 h-3" />
        </a>
      </div>
      <div class="mt-0.5 text-bodySm leading-5 text-nc-content-gray-subtle2 line-clamp-2">
        {{ signatureHint.description }}
      </div>
    </div>
    <div v-if="statusBar" class="nc-formula-status-bar" data-testid="nc-formula-status-bar" aria-live="polite">
      <div class="flex items-center gap-3">
        <span v-if="statusBar.isValid" class="nc-formula-status-item text-nc-content-green-dark font-semibold">
          <GeneralIcon icon="ncCheck" class="w-3.5 h-3.5" />
          {{ $t('labels.formulaStatus.valid') }}
        </span>
        <span v-else class="nc-formula-status-item text-nc-content-red-dark font-semibold">
          <GeneralIcon icon="ncAlertCircle" class="w-3.5 h-3.5" />
          {{ $t('labels.formulaStatus.invalid') }}
        </span>
        <span v-if="statusBar.uidt" class="nc-formula-status-item min-w-0">
          {{ $t('labels.formulaStatus.returns') }}
          <span class="nc-formula-status-type">
            <SmartsheetHeaderIcon :default-uidt="statusBar.uidt" />
            <span class="truncate">{{ statusBar.typeLabel }}</span>
          </span>
        </span>
        <span class="flex-1" />
        <span v-if="canSubmit" class="nc-formula-status-item text-nc-content-gray-muted">
          <kbd class="nc-formula-status-kbd">{{ renderCmdOrCtrlKey() }}</kbd>
          <kbd class="nc-formula-status-kbd">↵</kbd>
          {{ $t('labels.formulaDotPath.save') }}
        </span>
      </div>
      <div v-if="statusBar.errorMessage" class="nc-formula-status-error" data-testid="nc-formula-status-error">
        {{ statusBar.errorMessage }}
      </div>
    </div>
  </a-form-item>

  <SmartsheetColumnFormulaDotPathMenu
    v-if="dotMenu"
    v-bind="dotMenu"
    @activate="(key) => dotMenu && (dotMenu.activeKey = key)"
    @select="(item, openLink) => selectDotMenuItem(item, openLink)"
  />

  <div ref="chipIconHost" class="hidden" aria-hidden="true">
    <span v-for="c of chipIconColumns" :key="c.id" :data-icon-key="c.id">
      <SmartsheetHeaderIcon :column="c" />
    </span>
  </div>

  <div v-if="listResultAggregates.length" class="nc-formula-list-bar" data-testid="nc-formula-list-bar">
    <div class="text-bodySm leading-5 text-nc-content-gray-subtle2">
      <GeneralIcon icon="ncLayers" class="inline-block w-3.5 h-3.5 -mt-0.5 mr-1 text-nc-content-orange-dark" />
      {{ listResultMessage }}
    </div>
    <div class="flex flex-wrap gap-1.5 mt-2">
      <NcTooltip v-for="fn of listResultAggregates" :key="fn" :title="formulaDescription(fn)" :arrow="false">
        <button
          type="button"
          class="nc-formula-list-bar-option"
          :data-testid="`nc-formula-list-bar-${fn}`"
          @click="appendListAggregate(fn)"
        >
          <span class="text-nc-content-gray-muted">.</span>{{ fn }}<span class="text-nc-content-gray-muted">()</span>
        </button>
      </NcTooltip>
    </div>
  </div>
  <template v-if="isAiFeaturesEnabled && !isRollupMode">
    <div v-if="aiMode === AI_MODE.NONE" class="w-full flex justify-end mt-2">
      <NcButton size="small" type="text" :loading="aiLoading" @click="enableAI">
        <template #icon>
          <GeneralIcon icon="ncAutoAwesome" class="text-nc-content-purple-medium h-4 w-4" />
        </template>
        <template #loadingIcon>
          <GeneralLoader class="!text-nc-content-purple-medium" size="regular" />
        </template>
        <div class="flex gap-2 items-center">
          <span v-if="fieldValidateInfo?.validateStatus === 'error'" class="text-[13px] font-semibold">{{
            $t('labels.fixFormula')
          }}</span>
          <span v-else class="text-[13px] font-semibold">{{ $t('labels.formulaHelper') }}</span>
        </div>
      </NcButton>
    </div>
    <template v-else-if="aiMode === AI_MODE.PROMPT">
      <AiIntegrationNotFound v-if="!aiIntegrationAvailable" class="mt-4" />
      <div v-else class="prompt-wrapper">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="9" viewBox="0 0 18 9" fill="none" class="nc-polygon-2">
          <path d="M1.51476 8.5L9 0.721111L16.4852 8.5H1.51476Z" fill="var(--nc-bg-default)" stroke="var(--color-purple-100)" />
        </svg>
        <div class="prompt-input-wrapper w-full flex">
          <div class="nc-triangle-bottom-bar"></div>

          <div class="flex items-center gap-2 pl-3 pr-1 py-1 border-b-1 border-transparent">
            <div class="flex-1 text-small leading-[18px] font-bold text-nc-content-gray-subtle2">{{ $t('labels.prompt') }}</div>
            <div class="flex items-center gap-2">
              <NcButton
                v-if="fieldValidateInfo?.validateStatus === 'error'"
                type="secondary"
                size="xs"
                theme="ai"
                :bordered="false"
                class="nc-formula-helper-ai-btn !px-2"
                :disabled="aiLoading && calledFun === 'repairFormulaAI'"
                :loading="aiLoading && calledFun === 'repairFormulaAI'"
                @click="repairFormulaAI"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="!text-current h-4 w-4" />
                </template>
                <template #loadingIcon>
                  <GeneralLoader class="!text-current" size="regular" />
                </template>
                <div class="flex items-center gap-1">
                  <span class="text-[13px] font-semibold text-nc-purple-400">{{ $t('general.repair') }}</span>
                </div>
              </NcButton>
              <NcButton
                type="secondary"
                size="xs"
                theme="ai"
                :bordered="false"
                class="nc-formula-helper-ai-btn !px-2"
                :loading="aiLoading && calledFun === 'promptAI'"
                :disabled="
                  !aiPrompt?.trim() ||
                  (!!aiPrompt.trim() && aiPrompt.trim() === oldAiPrompt.trim()) ||
                  (aiLoading && calledFun === 'promptAI')
                "
                @click="promptAI"
              >
                <template #icon>
                  <GeneralIcon icon="ncAutoAwesome" class="!text-current h-4 w-4" />
                </template>
                <template #loadingIcon>
                  <GeneralLoader class="!text-current" size="regular" />
                </template>
                <div class="flex items-center gap-1">{{ $t('general.generate') }}</div>
              </NcButton>
            </div>
          </div>
          <a-textarea
            v-model:value="aiPrompt"
            class="nc-ai-formula-helper-input nc-input-shadow nc-ai-input nc-scrollbar-thin !min-h-[80px]"
            :placeholder="value ? $t('placeholder.enterPromptToModifyFormula') : $t('placeholder.enterPromptToGenerateFormula')"
          ></a-textarea>
        </div>
      </div>
    </template>
  </template>
</template>

<style scoped lang="scss">
// top-right corner with equal top and right margins, over the gutter the editor reserves;
// above Monaco's scrollbar strip (z-index 11), which covers that gutter
.nc-formula-browse-btn-wrapper {
  @apply absolute top-1 right-1 z-12;
}

.formula-monaco {
  @apply rounded-md nc-scrollbar-md border-nc-border-gray-medium border-1 overflow-y-auto overflow-x-hidden resize-y;
  max-height: 250px;
  min-height: 50px;

  &:focus-within:not(.formula-error) {
    box-shadow: 0 0 0 2px var(--ant-primary-color-outline);
  }

  &:focus-within:not(.formula-success) {
    box-shadow: 0 0 0 2px var(--ant-error-color-outline);
  }
  .view-line {
    width: auto !important;
  }
}
.prompt-wrapper {
  @apply relative mt-2.5;

  .nc-polygon-2 {
    @apply absolute -top-[8px] left-[50%] transform -translate-x-1/2 z-0;
  }

  .nc-triangle-bottom-bar {
    @apply absolute -top-[8px] left-[50%] transform -translate-x-1/2 w-3.5 h-2 bg-transparent border-2 border-transparent !border-b-nc-bg-gray-extralight;
  }

  .prompt-input-wrapper {
    @apply relative inline-block transition-all duration-300 shadow-default border-1 rounded-lg bg-nc-bg-gray-extralight border-nc-border-purple-light z-10;

    .nc-ai-formula-helper-input {
      @apply rounded-b-lg !border-nc-border-purple-light !-m-[1px] !max-w-[calc(100%_+_2px)] !w-[calc(100%_+_2px)] !shadow-none;

      &:focus {
        @apply rounded-lg !border-nc-border-purple !shadow-selected-ai;
      }
    }
  }
}
</style>

<style lang="scss">
.formula-monaco {
  // Monaco centres the thumb in the reserved gutter; keep it at the right edge, below the field button
  .scrollbar.vertical > .slider {
    left: auto !important;
    right: 2px;
  }

  .scrollbar.vertical > .scra,
  .scrollbar.vertical > .arrow-background {
    display: none !important;
  }

  // Monaco keeps its placeholder on one line with an ellipsis; let the hint wrap
  .editorPlaceholder {
    white-space: normal !important;
    text-overflow: clip !important;
    padding-right: 12px;
  }

  .nc-fx-hue-blue {
    --nc-fx-bg: transparent;
    --nc-fx-fg: var(--nc-content-blue-dark);
    --nc-fx-border: color-mix(in srgb, var(--nc-border-coloured-blue) 60%, transparent);
  }
  .nc-fx-hue-red {
    --nc-fx-bg: transparent;
    --nc-fx-fg: var(--nc-content-red-dark);
    --nc-fx-border: color-mix(in srgb, var(--nc-border-coloured-red) 70%, transparent);
  }

  .nc-fx-chip-text,
  .nc-fx-chip-start,
  .nc-fx-chip-end {
    background: var(--nc-fx-bg);
    color: var(--nc-fx-fg) !important;
    border-top: 1px solid var(--nc-fx-border);
    border-bottom: 1px solid var(--nc-fx-border);
    padding: 2px 0;
    font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
    font-weight: 500;
  }

  .is-selected.nc-fx-chip-text,
  .is-selected.nc-fx-chip-start,
  .is-selected.nc-fx-chip-end {
    background-image: linear-gradient(var(--vscode-editor-selectionBackground), var(--vscode-editor-selectionBackground));
  }

  .selected-text {
    background: transparent !important;
  }

  .nc-fx-selection {
    background-color: var(--vscode-editor-selectionBackground);
  }

  .nc-fx-hue-red.nc-fx-chip-text {
    text-decoration: line-through;
  }

  .nc-fx-chip-start {
    // collapses the width placeholder spaces (see useFormulaChips)
    letter-spacing: -1ch;
    border-left: 1px solid var(--nc-fx-border);
    border-radius: 6px 0 0 6px;
    padding-left: 5px;
    margin-left: 1px;
  }

  .nc-fx-chip-end {
    border-right: 1px solid var(--nc-fx-border);
    border-radius: 0 6px 6px 0;
    padding-right: 5px;
    margin-right: 1px;
  }

  .nc-fx-chip-icon::before {
    content: '';
    display: inline-block;
    width: 13px;
    height: 13px;
    vertical-align: -2px;
    background-color: currentColor;
    -webkit-mask-size: contain;
    mask-size: contain;
    -webkit-mask-repeat: no-repeat;
    mask-repeat: no-repeat;
    -webkit-mask-position: center;
    mask-position: center;
  }

  .nc-fx-chip-icon::before {
    margin-right: 4px;
  }

  // braces stay in the formula text, chips just don't show them
  .nc-fx-brace {
    font-size: 0 !important;
  }

  // the caret spans the taller chip line; keep it at text height, centred
  .cursor {
    height: 18px !important;
    transform: translateY(4px);
  }
}

.nc-formula-signature {
  @apply mt-1.5 px-2.5 py-1.5 rounded-lg bg-nc-bg-gray-extralight border-1 border-nc-border-gray-light;
}

.nc-formula-signature-active {
  @apply text-nc-content-gray font-semibold underline decoration-dotted underline-offset-2;
}

.nc-formula-status-bar {
  @apply mt-1.5 px-0.5 text-bodySm leading-5 text-nc-content-gray-subtle2;
}

.nc-formula-status-error {
  @apply mt-0.5 text-nc-content-red-dark line-clamp-3 break-words;
}

.nc-formula-status-item {
  @apply inline-flex items-center gap-1 whitespace-nowrap;
}

.nc-formula-status-type {
  @apply inline-flex items-center gap-1 px-1.5 h-5 rounded bg-nc-bg-gray-light text-nc-content-gray font-medium;

  // the header icon ignores size classes passed to it
  svg {
    @apply flex-none w-3 h-3;
  }
}

.nc-formula-status-kbd {
  @apply inline-flex items-center justify-center min-w-4 h-4 px-1 rounded border-1 border-nc-border-gray-medium bg-nc-bg-default text-[10px] leading-none text-nc-content-gray-subtle2 font-sans;
}

.nc-formula-list-bar {
  @apply mt-2 px-3 py-2.5 rounded-lg border-1;
  background: var(--nc-bg-coloured-orange);
  border-color: color-mix(in srgb, var(--nc-border-coloured-orange) 25%, transparent);
}

.nc-formula-list-bar-option {
  @apply h-6 px-2 rounded-md border-1 border-nc-border-gray-medium bg-nc-bg-default font-mono text-[12px] text-nc-content-brand transition-colors;

  &:hover {
    @apply border-nc-border-brand bg-nc-bg-brand;
  }
}

.formula-placeholder {
  @apply !text-nc-content-gray-muted !text-xs !font-medium;
  font-family: 'Inter';
}
.monaco-hover {
  position: fixed;
}
</style>
