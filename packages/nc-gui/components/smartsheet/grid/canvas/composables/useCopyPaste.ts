import { parse } from 'papaparse'
import {
  type AttachmentType,
  type ColumnType,
  type LinkToAnotherRecordType,
  type TableType,
  UITypes,
  type ViewType,
  isLinksOrLTAR,
  isSystemColumn,
  isVirtualCol,
  populateUniqueFileName,
} from 'nocodb-sdk'
import { generateUniqueColumnName } from '../../../../../helpers/parsers/parserHelpers'
import convertCellData from '../../../../../composables/useMultiSelect/convertCellData'
import type { Cell } from '../../../../../composables/useMultiSelect/cellRange'
import { serializeRange, valueToCopy } from '../../../../../utils/pasteUtils'
import { ComputedTypePasteError } from '../../../../../error/computed-type-paste.error'
import { SelectTypeConversionError } from '../../../../../error/select-type-conversion.error'
import { TypeConversionError } from '../../../../../error/type-conversion.error'
import type { SuppressedError } from '../../../../../error/suppressed.error'
import { EDIT_INTERACTABLE } from '../utils/constants'

const MAX_ROWS = 200

export function useCopyPaste({
  activeCell,
  columns,
  scrollToCell,
  selection,
  editEnabled,
  expandRows,
  view,
  meta,
  syncCellData,
  bulkUpsertRows,
  bulkUpdateRows,
  updateOrSaveRow,
  getRows,
  getDataCache,
}: {
  activeCell: Ref<{
    row?: number
    column?: number
    path?: Array<number>
  }>
  columns: ComputedRef<CanvasGridColumn[]>
  scrollToCell: (row?: number, column?: number, path?: Array<number>) => void
  selection: Ref<CellRange>
  editEnabled: Ref<{
    rowIndex: number
    column: ColumnType
    row: Row
    x: number
    y: number
    width: number
    height: number
    path: Array<number>
  } | null>
  expandRows: ({
    newRows,
    newColumns,
    cellsOverwritten,
    rowsUpdated,
  }: {
    newRows: number
    newColumns: number
    cellsOverwritten: number
    rowsUpdated: number
  }) => Promise<{
    continue: boolean
    expand: boolean
  }>
  view: ComputedRef<ViewType | undefined>
  meta: Ref<TableType>
  syncCellData: (ctx: { row: number; col?: number; updatedColumnTitle?: string }, path?: Array<number>) => Promise<void>
  bulkUpsertRows: (
    insertRows: Row[],
    updateRows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    newColumns?: Partial<ColumnType>[],
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  bulkUpdateRows: (
    rows: Row[],
    props: string[],
    metas?: { metaValue?: TableType; viewMetaValue?: ViewType },
    undo?: boolean,
    path?: Array<number>,
  ) => Promise<void>
  updateOrSaveRow: (
    row: Row,
    property?: string,
    ltarState?: Record<string, any>,
    args?: { metaValue?: TableType; viewMetaValue?: ViewType },
    beforeRow?: string,
    path?: Array<number>,
  ) => Promise<any>
  getRows: (start: number, end: number, path?: Array<number>) => Promise<Row[]>
  getDataCache: (path?: Array<number>) => {
    cachedRows: Ref<Map<number, Row>>
    totalRows: Ref<number>
    chunkStates: Ref<Array<'loading' | 'loaded' | undefined>>
    selectedRows: ComputedRef<Array<Row>>
    isRowSortRequiredRows: ComputedRef<Array<Row>>
  }
}) {
  const { $api } = useNuxtApp()
  const { isDataReadOnly } = useRoles()
  const { getMeta, metas } = useMetas()
  const { isMysql, isPg } = useBase()
  const { appInfo } = useGlobal()
  const { addUndo, clone, defineViewScope } = useUndoRedo()
  const { t } = useI18n()
  const { isUIAllowed } = useRoles()
  const { copy } = useCopy()
  const { cleaMMCell, clearLTARCell, addLTARRef, syncLTARRefs } = useSmartsheetLtarHelpersOrThrow()
  const { isSqlView } = useSmartsheetStoreOrThrow()
  const reloadViewDataHook = inject(ReloadViewDataHookInj, createEventHook())
  const isPublic = inject(IsPublicInj, ref(false))

  const { base } = storeToRefs(useBase())
  const fields = computed(() => (columns.value ?? []).map((c) => c.columnObj))
  const canPasteCell = computed(() => {
    if (isSqlView.value || isPublic.value) return false

    return (
      !editEnabled.value ||
      (editEnabled.value &&
        EDIT_INTERACTABLE.includes(editEnabled.value.column?.uidt) &&
        !(activeCell.value.row === -1 || activeCell.value.column === -1))
    )
  })
  const hasEditPermission = computed(() => isUIAllowed('dataEdit'))

  function isPasteable(row?: Row, col?: ColumnType, showInfo = false) {
    if (!row || !col) {
      if (showInfo) {
        message.info('Please select a cell to paste')
      }
      return false
    }

    // skip pasting virtual columns (including LTAR columns for now) and system columns
    if (isVirtualCol(col) || isSystemColumn(col) || col?.readonly) {
      if (showInfo) {
        message.info(t('msg.info.pasteNotSupported'))
      }
      return false
    }

    // skip pasting auto increment columns
    if (col.ai) {
      if (showInfo) {
        message.info(t('msg.info.autoIncFieldNotEditable'))
      }
      return false
    }

    // skip pasting primary key columns
    if (col.pk && !row.rowMeta.new) {
      if (showInfo) {
        message.info(t('msg.info.editingPKnotSupported'))
      }
      return false
    }

    return true
  }

  const handlePaste = async (e: ClipboardEvent) => {
    if (!canPasteCell.value) {
      return
    }
    if (!meta.value?.id) return

    if (
      isDrawerOrModalExist() ||
      isExpandedCellInputExist() ||
      isLinkDropdownExist() ||
      isViewSearchActive() ||
      isSidebarNodeRenameActive() ||
      isActiveElementInsideExtension() ||
      isCmdJActive() ||
      cmdKActive()
    ) {
      return
    }
    if (isNcDropdownOpen()) return

    e.preventDefault()

    const groupPath = activeCell.value.path
    const dataCache = getDataCache(groupPath)

    const { totalRows, cachedRows } = dataCache

    // Replace \" with " in clipboard data
    let clipboardData = e.clipboardData?.getData('text/plain') || ''

    if (clipboardData?.endsWith('\n')) {
      // Remove '\n' from the end of the clipboardData
      // When copying from XLS/XLSX files, there is an extra '\n' appended to the end
      //   this overwrites one additional cell information when we paste in NocoDB
      clipboardData = clipboardData.replace(/\n$/, '')
    }

    try {
      if (clipboardData?.includes('\n') || clipboardData?.includes('\t')) {
        // if the clipboard data contains new line or tab, then it is a matrix or LongText
        const parsedClipboard = parse(clipboardData, {
          delimiter: '\t',
          escapeChar: '\\',
        })

        if (parsedClipboard.errors.length > 0) {
          return message.error(parsedClipboard.errors[0]?.message)
        }

        let clipboardMatrix = parsedClipboard.data as string[][]

        let isTruncated = false
        if (clipboardMatrix.length > MAX_ROWS) {
          clipboardMatrix = clipboardMatrix.slice(0, MAX_ROWS)
          isTruncated = true
        }

        const selectionRowCount = Math.max(clipboardMatrix.length, selection.value.end.row - selection.value.start.row + 1)

        const pasteMatrixCols = clipboardMatrix[0]?.length || 0
        const startColIndex = activeCell.value.column
        const existingFields = unref(fields)
        const existingColCount = existingFields.length - startColIndex
        const newColsNeeded = Math.max(0, pasteMatrixCols - existingColCount)

        const tempTotalRows = totalRows.value
        const totalRowsBeforeActiveCell = selection.value.start.row
        const availableRowsToUpdate = Math.max(0, tempTotalRows - totalRowsBeforeActiveCell)
        const rowsToAdd = Math.max(0, selectionRowCount - availableRowsToUpdate)

        // Check if expansion is needed
        let options = {
          continue: false,
          expand: rowsToAdd > 0 || newColsNeeded > 0,
        }

        if (options.expand) {
          options = await expandRows?.({
            newRows: rowsToAdd,
            newColumns: newColsNeeded,
            cellsOverwritten: Math.min(availableRowsToUpdate, selectionRowCount) * (pasteMatrixCols - newColsNeeded),
            rowsUpdated: Math.min(availableRowsToUpdate, selectionRowCount),
          })
          if (!options.continue) return
        }
        // Handle column operations
        let colsToPaste
        const bulkOpsCols = []

        if (options.expand) {
          colsToPaste = fields.value.slice(selection.value.start.col, selection.value.start.col + pasteMatrixCols)
          if (newColsNeeded > 0) {
            const columnsHash = (await $api.dbTableColumn.hash(meta.value?.id)).hash
            const columnsLength = meta.value?.columns?.length || 0

            // Create new columns as needed
            for (let i = 0; i < newColsNeeded; i++) {
              const tempCol = {
                uidt: UITypes.SingleLineText,
                order: columnsLength + i,
                column_order: {
                  order: columnsLength + i,
                  view_id: view.value?.id,
                },
                view_id: view.value?.id,
                table_name: meta.value?.table_name,
              }

              const newColTitle = generateUniqueColumnName({
                metaColumns: [...(meta.value?.columns ?? []), ...bulkOpsCols.map(({ column }) => column)],
                formState: tempCol,
              })

              bulkOpsCols.push({
                op: 'add',
                column: {
                  ...tempCol,
                  title: newColTitle,
                },
              })
            }

            await $api.dbTableColumn.bulk(meta.value?.id, {
              hash: columnsHash,
              ops: bulkOpsCols,
            })

            await getMeta(meta?.value?.id as string, true)
            colsToPaste = [...colsToPaste, ...bulkOpsCols.map(({ column }) => column)]
          }
        } else {
          colsToPaste = fields.value.slice(selection.value.start.col, selection.value.start.col + pasteMatrixCols)
        }

        await getRows(selection.value.start.row, selection.value.start.row + clipboardMatrix.length, groupPath)

        const dataRef = unref(cachedRows)

        const updatedRows: Row[] = [] as Row[]
        const newRows: Row[] = []
        const propsToPaste: string[] = []
        let isInfoShown = false

        for (let i = 0; i < selectionRowCount; i++) {
          const clipboardRowIndex = i % clipboardMatrix.length
          let targetRow: any

          if (i < availableRowsToUpdate) {
            const absoluteRowIndex = totalRowsBeforeActiveCell + i
            targetRow = clone(dataRef.get(absoluteRowIndex)) || {
              row: {},
              oldRow: {},
              rowMeta: {
                isExistingRow: true,
                rowIndex: absoluteRowIndex,
              },
            }
            updatedRows.push(targetRow)
          } else {
            targetRow = {
              row: {},
              oldRow: {},
              rowMeta: {
                isExistingRow: false,
              },
            }
            newRows.push(targetRow)
          }

          // Process each cell in the row
          if (!clipboardMatrix[clipboardRowIndex]) continue
          for (let j = 0; j < clipboardMatrix[clipboardRowIndex].length; j++) {
            const column = colsToPaste[j]
            if (!column) continue

            if (isPasteable(targetRow, column)) {
              propsToPaste.push(column.title!)
              let pasteValue: any
              try {
                pasteValue = convertCellData(
                  {
                    value: clipboardMatrix[clipboardRowIndex][j],
                    to: column.uidt as UITypes,
                    column,
                    appInfo: unref(appInfo),
                    oldValue: column.uidt === UITypes.Attachment ? targetRow.row[column.title!] : undefined,
                  },
                  isMysql(meta.value?.source_id),
                  true,
                )
                validateColumnValue(column, pasteValue)
              } catch (ex) {
                if (ex instanceof ComputedTypePasteError) {
                  throw ex
                } else if (ex instanceof SelectTypeConversionError) {
                  await appendSelectOptions({
                    api: $api,
                    col: column!,
                    addOptions: ex.missingOptions,
                  })
                  pasteValue = ex.value.join(',')
                } else if (ex instanceof TypeConversionError) {
                  pasteValue = null
                } else throw ex
              }

              if (pasteValue !== undefined) {
                targetRow.row[column.title!] = pasteValue
              }
            } else if ((isBt(column) || isOo(column) || isMm(column)) && !isInfoShown) {
              message.info(t('msg.info.groupPasteIsNotSupportedOnLinksColumn'))
              isInfoShown = true
            }
          }
        }

        if (options.expand) {
          await bulkUpsertRows?.(
            newRows,
            updatedRows,
            propsToPaste,
            undefined,
            bulkOpsCols.map(({ column }) => column),
            false,
            groupPath,
          )
          scrollToCell?.(undefined, undefined, groupPath)
        } else {
          await bulkUpdateRows?.(updatedRows, propsToPaste, undefined, false, groupPath)
        }

        if (isTruncated) {
          message.warning(`Paste operation limited to ${MAX_ROWS} rows. Additional rows were truncated.`)
        }
      } else {
        if (selection.value.isSingleCell()) {
          const rowObj = (unref(cachedRows) as Map<number, Row>).get(activeCell.value.row)
          const columnObj = unref(fields)[activeCell.value.column]

          if (!rowObj || !columnObj) return

          // handle belongs to column, skip custom links
          if (isBt(columnObj) && !(columnObj.meta as any)?.custom) {
            const pasteVal = convertCellData(
              {
                value: clipboardData,
                to: columnObj.uidt as UITypes,
                column: columnObj,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.source_id),
            )

            if (pasteVal === undefined || !ncIsObject(pasteVal)) return

            const foreignKeyColumn = meta.value?.columns?.find(
              (column: ColumnType) => column.id === (columnObj.colOptions as LinkToAnotherRecordType)?.fk_child_column_id,
            )

            if (!foreignKeyColumn) return

            const relatedTableMeta = await getMeta((columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id!)

            // update old row to allow undo redo as bt column update only through foreignKeyColumn title
            rowObj.oldRow[columnObj.title!] = rowObj.row[columnObj.title!]
            rowObj.oldRow[foreignKeyColumn.title!] = rowObj.row[columnObj.title!]
              ? extractPkFromRow(rowObj.row[columnObj.title!], (relatedTableMeta as any)!.columns!)
              : null

            rowObj.row[columnObj.title!] = pasteVal?.value

            rowObj.row[foreignKeyColumn.title!] = pasteVal?.value
              ? extractPkFromRow(pasteVal.value, (relatedTableMeta as any)!.columns!)
              : null

            return await syncCellData?.({ ...activeCell.value, updatedColumnTitle: foreignKeyColumn.title }, groupPath)
          }

          // Handle many-to-many column paste
          if (isMm(columnObj)) {
            const pasteVal = convertCellData(
              {
                value: clipboardData,
                to: columnObj.uidt as UITypes,
                column: columnObj,
                appInfo: unref(appInfo),
              },
              isMysql(meta.value?.source_id),
            )

            if (pasteVal === undefined || !ncIsObject(pasteVal)) return

            const pasteRowPk = extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[])
            if (!pasteRowPk) return

            const oldCellValue = rowObj.row[columnObj.title!]

            rowObj.row[columnObj.title!] = pasteVal.value

            let result

            try {
              result = await $api.dbDataTableRow.nestedListCopyPasteOrDeleteAll(
                meta.value?.id as string,
                columnObj.id as string,
                [
                  {
                    operation: 'copy',
                    rowId: pasteVal.rowId,
                    columnId: pasteVal.columnId,
                    fk_related_model_id: pasteVal.fk_related_model_id,
                  },
                  {
                    operation: 'paste',
                    rowId: pasteRowPk,
                    columnId: columnObj.id as string,
                    fk_related_model_id:
                      (columnObj.colOptions as LinkToAnotherRecordType).fk_related_model_id || pasteVal.fk_related_model_id,
                  },
                ],
                { viewId: view?.value?.id },
              )
            } catch {
              rowObj.row[columnObj.title!] = oldCellValue
              return
            }

            if (result && result?.link && result?.unlink && Array.isArray(result.link) && Array.isArray(result.unlink)) {
              if (!result.link.length && !result.unlink.length) {
                rowObj.row[columnObj.title!] = oldCellValue
                return
              }

              addUndo({
                redo: {
                  fn: async (
                    activeCell: Cell,
                    col: ColumnType,
                    row: Row,
                    value: number,
                    result: { link: any[]; unlink: any[] },
                  ) => {
                    const pasteRowPk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
                    const rowObj = (unref(cachedRows) as Map<number, Row>).get(activeCell.row)
                    if (!rowObj || !pasteRowPk) return
                    if (
                      pasteRowPk === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
                      columnObj.id === col.id
                    ) {
                      await Promise.all([
                        result.link.length &&
                          $api.dbDataTableRow.nestedLink(
                            meta.value?.id as string,
                            columnObj.id as string,
                            encodeURIComponent(pasteRowPk),
                            result.link,
                            {
                              viewId: view?.value?.id,
                            },
                          ),
                        result.unlink.length &&
                          $api.dbDataTableRow.nestedUnlink(
                            meta.value?.id as string,
                            columnObj.id as string,
                            encodeURIComponent(pasteRowPk),
                            result.unlink,
                            { viewId: view?.value?.id },
                          ),
                      ])

                      rowObj.row[columnObj.title!] = value

                      await syncCellData?.(activeCell, activeCell?.path)
                    }
                  },
                  args: [clone(activeCell.value), clone(columnObj), clone(rowObj), clone(pasteVal.value), result],
                },
                undo: {
                  fn: async (
                    activeCell: Cell,
                    col: ColumnType,
                    row: Row,
                    value: number,
                    result: { link: any[]; unlink: any[] },
                  ) => {
                    const pasteRowPk = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
                    const rowObj = (unref(cachedRows) as Map<number, Row>).get(activeCell.row)
                    if (!rowObj || !pasteRowPk) return

                    if (
                      pasteRowPk === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
                      columnObj.id === col.id
                    ) {
                      await Promise.all([
                        result.unlink.length &&
                          $api.dbDataTableRow.nestedLink(
                            meta.value?.id as string,
                            columnObj.id as string,
                            encodeURIComponent(pasteRowPk),
                            result.unlink,
                          ),
                        result.link.length &&
                          $api.dbDataTableRow.nestedUnlink(
                            meta.value?.id as string,
                            columnObj.id as string,
                            encodeURIComponent(pasteRowPk),
                            result.link,
                          ),
                      ])

                      rowObj.row[columnObj.title!] = value

                      await syncCellData?.(activeCell.activeCell?.value?.path)
                    }
                  },
                  args: [clone(activeCell.value), clone(columnObj), clone(rowObj), clone(oldCellValue), result],
                },
                scope: defineViewScope({ view: view?.value }),
              })
            }

            return await syncCellData?.(activeCell.value, groupPath)
          }

          if (!isPasteable(rowObj, columnObj, true)) {
            return
          }

          let pasteValue: any

          try {
            pasteValue = convertCellData(
              {
                value: clipboardData,
                to: columnObj.uidt as UITypes,
                column: columnObj,
                appInfo: unref(appInfo),
                files:
                  columnObj.uidt === UITypes.Attachment && e.clipboardData?.files?.length ? e.clipboardData?.files : undefined,
                oldValue: rowObj.row[columnObj.title!],
              },
              isMysql(meta.value?.source_id),
            )
            validateColumnValue(columnObj, pasteValue)
          } catch (ex) {
            if (ex instanceof ComputedTypePasteError) {
              throw ex
            } else if (ex instanceof SelectTypeConversionError) {
              await appendSelectOptions({
                api: $api,
                col: columnObj!,
                addOptions: ex.missingOptions,
              })
              pasteValue = ex.value.join(',')
            } else if (ex instanceof TypeConversionError) {
              pasteValue = null
            } else throw ex
          }

          if (columnObj.uidt === UITypes.Attachment && e.clipboardData?.files?.length && pasteValue?.length) {
            const newAttachments =
              (await handleFileUploadAndGetCellValue(pasteValue, columnObj.id!, rowObj.row[columnObj.title!])) || []

            const oldAttachments = ncIsArray(rowObj.row[columnObj.title!]) ? rowObj.row[columnObj.title!] : []

            rowObj.row[columnObj.title!] =
              newAttachments.length || oldAttachments.length ? JSON.stringify(oldAttachments.concat(newAttachments)) : null
          } else if (pasteValue !== undefined) {
            rowObj.row[columnObj.title!] = pasteValue
          }

          await syncCellData?.(activeCell.value, groupPath)
        } else {
          const { start, end } = selection.value

          const startRow = Math.min(start.row, end.row)
          const endRow = Math.max(start.row, end.row)
          const startCol = Math.min(start.col, end.col)
          const endCol = Math.max(start.col, end.col)

          const rows = await getRows(startRow, endRow, groupPath)
          const cols = unref(fields).slice(startCol, endCol + 1)
          const props = []

          let pasteValue
          let isInfoShown = false

          const files = e.clipboardData?.files

          for (const row of rows) {
            // TODO handle insert new row
            if (!row || row.rowMeta.new) continue

            for (const col of cols) {
              if (!col.title || !isPasteable(row, col)) {
                if ((isBt(col) || isOo(col) || isMm(col)) && !isInfoShown) {
                  message.info(t('msg.info.groupPasteIsNotSupportedOnLinksColumn'))
                  isInfoShown = true
                }
                continue
              }

              if (files?.length) {
                if (col.uidt !== UITypes.Attachment) {
                  continue
                }

                if (pasteValue === undefined) {
                  const fileUploadPayload = convertCellData(
                    {
                      value: '',
                      to: col.uidt as UITypes,
                      column: col,
                      appInfo: unref(appInfo),
                      files,
                      oldValue: row.row[col.title],
                    },
                    isMysql(meta.value?.source_id),
                    true,
                  )

                  if (fileUploadPayload?.length) {
                    const newAttachments = await handleFileUploadAndGetCellValue(fileUploadPayload, col.id!, row.row[col.title!])

                    pasteValue = newAttachments ? JSON.stringify(newAttachments) : null
                  }
                }
              } else {
                try {
                  pasteValue = convertCellData(
                    {
                      value: clipboardData,
                      to: col.uidt as UITypes,
                      column: col,
                      appInfo: unref(appInfo),
                      oldValue: row.row[col.title],
                    },
                    isMysql(meta.value?.source_id),
                    true,
                  )
                  validateColumnValue(col, pasteValue)
                } catch (ex) {
                  if (ex instanceof ComputedTypePasteError) {
                    throw ex
                  } else if (ex instanceof SelectTypeConversionError) {
                    await appendSelectOptions({
                      api: $api,
                      col,
                      addOptions: ex.missingOptions,
                    })
                    pasteValue = ex.value.join(',')
                  } else if (ex instanceof TypeConversionError) {
                    pasteValue = null
                  } else throw ex
                }
              }

              props.push(col.title)

              if (pasteValue !== undefined) {
                row.row[col.title] = pasteValue
              }
            }
          }

          if (!props.length) return
          await bulkUpdateRows?.(rows, props, undefined, false, groupPath)
        }
      }
    } catch (error: any) {
      if (error instanceof TypeConversionError !== true || !(error as SuppressedError).isErrorSuppressed) {
        console.error(error, (error as SuppressedError).isErrorSuppressed)
        message.error(await extractSdkResponseErrorMsg(error))
      }
    }
  }

  async function handleFileUploadAndGetCellValue(files: File[], columnId: string, oldValue: AttachmentType[]) {
    const newAttachments: AttachmentType[] = []

    try {
      const data = await $api.storage.upload(
        {
          path: [NOCO, base.value.id, meta.value?.id, columnId].join('/'),
        },
        {
          files,
        },
      )

      // add suffix in duplicate file title
      for (const uploadedFile of data) {
        newAttachments.push({
          ...uploadedFile,
          title: populateUniqueFileName(
            uploadedFile?.title,
            [...handleParseAttachmentCellData(oldValue), ...newAttachments].map((fn) => fn?.title || (fn as any)?.fileName),
          ),
        })
      }
      return newAttachments
    } catch (e: any) {
      message.error(e.message || t('msg.error.internalError'))
    }
  }

  const copyTable = async (rows: Row[], cols: ColumnType[]) => {
    const { html: copyHTML, text: copyPlainText } = serializeRange(rows, cols, {
      meta: meta.value,
      isPg,
      isMysql,
    })

    const blobHTML = new Blob([copyHTML], { type: 'text/html' })
    const blobPlainText = new Blob([copyPlainText], { type: 'text/plain' })

    return (
      navigator.clipboard?.write([new ClipboardItem({ [blobHTML.type]: blobHTML, [blobPlainText.type]: blobPlainText })]) ??
      copy(copyPlainText)
    )
  }

  async function clearCell(ctx: { row: number; col: number; path?: Array<number> } | null, skipUpdate = false) {
    // If the data is readonly, return
    // If the cell is not available, return
    // If the user doesn't have edit permission, return
    // If the cell is a virtual column and not Links/Ltar, return
    if (!ctx) return

    const groupPath = ctx?.path

    const dataCache = getDataCache(groupPath)
    const { cachedRows } = dataCache

    const col = columns.value[ctx.col]
    const rowObj = cachedRows.value.get(ctx.row)

    if (!col || !col?.columnObj || !rowObj) return
    const columnObj = col.columnObj

    if (
      !columnObj ||
      isDataReadOnly.value ||
      !ctx ||
      !hasEditPermission.value ||
      columnObj.readonly ||
      (isSystemColumn(columnObj) && !isLinksOrLTAR(columnObj)) ||
      (!isLinksOrLTAR(columnObj) && isVirtualCol(columnObj))
    ) {
      return
    }

    if (isVirtualCol(columnObj)) {
      let mmClearResult
      const mmOldResult = rowObj.row[columnObj.title]

      // This will used to reload view data if it is self link column
      const isSelfLinkColumn = columnObj.fk_model_id === columnObj.colOptions?.fk_related_model_id

      if (isMm(columnObj) && rowObj) {
        mmClearResult = await cleaMMCell(rowObj, columnObj)
      }

      addUndo({
        undo: {
          fn: async (
            ctx: { row: number; col: number },
            col: ColumnType,
            row: Row,
            mmClearResult: any[],
            mmOldResult: any,
            isSelfLinkColumn: boolean,
          ) => {
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = cachedRows.value.get(ctx.row)
            const columnObj = fields.value[ctx.col]
            if (
              rowObj &&
              columnObj &&
              columnObj.title &&
              rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
              columnObj.id === col.id
            ) {
              if (isBt(columnObj) || isOo(columnObj)) {
                rowObj.row[columnObj.title] = row.row[columnObj.title]

                await addLTARRef(rowObj, rowObj.row[columnObj.title], columnObj)
                await syncLTARRefs(rowObj, rowObj.row)
              } else if (isMm(columnObj)) {
                await $api.dbDataTableRow.nestedLink(
                  meta.value?.id as string,
                  columnObj.id as string,
                  encodeURIComponent(rowId as string),
                  mmClearResult,
                )
                rowObj.row[columnObj.title] = mmOldResult ?? null
              }

              activeCell.value.column = ctx.col
              activeCell.value.row = ctx.row
              activeCell.value.path = groupPath

              if (isSelfLinkColumn) {
                reloadViewDataHook.trigger({ shouldShowLoading: false })
              }

              scrollToCell?.(undefined, undefined, groupPath)
            } else {
              throw new Error(t('msg.recordCouldNotBeFound'))
            }
          },
          args: [clone(ctx), clone(columnObj), clone(rowObj), mmClearResult, mmOldResult, isSelfLinkColumn],
        },
        redo: {
          fn: async (ctx: { row: number; col: number }, col: ColumnType, row: Row, isSelfLinkColumn: boolean) => {
            const rowId = extractPkFromRow(row.row, meta.value?.columns as ColumnType[])
            const rowObj = cachedRows.value.get(ctx.row)
            const columnObj = fields.value[ctx.col]
            if (
              rowObj &&
              rowId === extractPkFromRow(rowObj.row, meta.value?.columns as ColumnType[]) &&
              columnObj &&
              columnObj.id === col.id
            ) {
              if (isBt(columnObj) || isOo(columnObj)) {
                await clearLTARCell(rowObj, columnObj)
              } else if (isMm(columnObj)) {
                await cleaMMCell(rowObj, columnObj)
              }
              activeCell.value.column = ctx.col
              activeCell.value.row = ctx.row
              activeCell.value.path = groupPath

              if (isSelfLinkColumn) {
                reloadViewDataHook.trigger({ shouldShowLoading: false })
              }

              scrollToCell?.(undefined, undefined, groupPath)
            } else {
              throw new Error(t('msg.recordCouldNotBeFound'))
            }
          },
          args: [clone(ctx), clone(columnObj), clone(rowObj), isSelfLinkColumn],
        },
        scope: defineViewScope({ view: view.value }),
      })
      if (isBt(columnObj) || isOo(columnObj)) await clearLTARCell(rowObj, columnObj)

      if (isSelfLinkColumn) {
        reloadViewDataHook.trigger({ shouldShowLoading: false })
      }

      return
    }

    if (columnObj.title) {
      // handle Checkbox and rating fields in a special way
      switch (columnObj.uidt) {
        case UITypes.Checkbox:
          rowObj.row[columnObj.title] = false
          break
        case UITypes.Rating:
          rowObj.row[columnObj.title] = 0
          break
        default:
          rowObj.row[columnObj.title] = null
          break
      }
    }

    if (!skipUpdate) {
      // update/save cell value
      await updateOrSaveRow?.(rowObj, columnObj.title, undefined, undefined, undefined, groupPath)
    }
  }

  async function copyValue(ctx?: Cell, path: Array<number> = []) {
    try {
      if (selection.value.start !== null && selection.value.end !== null && !selection.value.isSingleCell()) {
        const cprows = await getRows(selection.value.start.row, selection.value.end.row, path)

        const cpcols = unref(fields).slice(selection.value.start.col, selection.value.end.col + 1) // slice the selected cols for copy

        await copyTable(cprows, cpcols)
        message.success(t('msg.info.copiedToClipboard'))
      } else {
        const dataCache = getDataCache(path)

        // if copy was called with context (right click position) - copy value from context
        // else if there is just one selected cell, copy it's value
        const cpRow = ctx?.row ?? activeCell.value.row
        const cpCol = ctx?.col ?? activeCell.value.column

        if (cpRow != null && cpCol != null) {
          const rowObj = unref(dataCache.cachedRows).get(cpRow)
          const columnObj = unref(fields)[cpCol]
          if (!rowObj || !columnObj) return

          const textToCopy = valueToCopy(rowObj, columnObj, {
            meta: meta.value,
            metas: metas.value,
            isPg,
            isMysql,
          })

          await copy(textToCopy)
          message.success(t('msg.info.copiedToClipboard'))
        }
      }
    } catch (e) {
      console.log(e)
      message.error(t('msg.error.copyToClipboardError'))
    }
  }

  function handleParseAttachmentCellData<T>(value: T): T {
    const parsedVal = parseProp(value)

    if (parsedVal && Array.isArray(parsedVal)) {
      return parsedVal as T
    } else {
      return [] as T
    }
  }
  useEventListener(document, 'paste', handlePaste)
  return { copyValue, clearCell, isPasteable }
}
