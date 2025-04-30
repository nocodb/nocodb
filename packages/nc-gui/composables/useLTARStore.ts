import type { ColumnType, LinkToAnotherRecordType, PaginatedType, RequestParams, TableType } from 'nocodb-sdk'
import {
  RelationTypes,
  UITypes,
  dateFormats,
  isDateOrDateTimeCol,
  isLinksOrLTAR,
  isSystemColumn,
  parseStringDateTime,
  timeFormats,
} from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

interface DataApiResponse {
  list: Record<string, any>[]
  pageInfo: PaginatedType
}

/** Store for managing Link to another cells */
const [useProvideLTARStore, useLTARStore] = useInjectionState(
  (
    column: Ref<Required<ColumnType>> | ComputedRef<Required<ColumnType>>,
    row: Ref<Row>,
    isNewRow: ComputedRef<boolean> | Ref<boolean>,
    _reloadData = (_params: { shouldShowLoading?: boolean }) => {},
  ) => {
    // when initialized by link popup dialog, keep current row
    // to avoid being changed by sort or filter
    const currentRow = ref(row.value)

    const refreshCurrentRow = () => {
      currentRow.value = row.value
    }

    // state
    const { metas, getMeta } = useMetas()

    const { base } = storeToRefs(useBase())

    const { $api, $e } = useNuxtApp()

    const { isMobileMode } = useGlobal()

    const activeView = inject(ActiveViewInj, ref())
    const isForm = inject(IsFormInj, ref(false))

    const isCanvasInjected = inject(IsCanvasInjectionInj, false)

    const path = inject(GroupPathInj, ref([]))

    // In canvas _reloadData will not work as we unmount editable component so on undo/redo we have to manually trigger view reload
    const reloadViewDataTrigger = inject(ReloadViewDataHookInj, createEventHook())

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

    const childrenExcludedList = ref<DataApiResponse | undefined>()
    const childrenList = ref<DataApiResponse | undefined>()
    const targetViewColumns = ref<ColumnType[]>([])

    const targetViewColumnsById = computed(() => {
      return targetViewColumns.value.reduce((map, col) => {
        map[col.fk_column_id!] = col
        return map
      }, {} as Record<string, ColumnType>)
    })

    const childrenExcludedListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const childrenExcludedOffsetCount = ref(0)

    const childrenListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const childrenListOffsetCount = ref(0)

    const isChildrenLoading = ref(false)

    const isChildrenListLoading = ref<Array<boolean>>([])

    const isChildrenListLinked = ref<Array<boolean>>([])

    const isChildrenExcludedListLoading = ref<Array<boolean>>([])

    const isChildrenExcludedLoading = ref(false)

    const isChildrenExcludedListLinked = ref<Array<boolean>>([])

    const newRowState = reactive({
      state: null,
    })

    const childrenListCount = ref(0)

    const { t } = useI18n()

    const isPublic: Ref<boolean> = inject(IsPublicInj, ref(false))

    const colOptions = computed(() => column.value?.colOptions as LinkToAnotherRecordType)

    const { sharedView } = useSharedView()

    const { getViewColumns } = useSmartsheetStoreOrThrow()

    const baseId = base.value?.id || (sharedView.value?.view as any)?.base_id

    // getters
    const meta = computed(() => metas?.value?.[column?.value?.fk_model_id as string])
    const relatedTableMeta = computed<TableType>(() => {
      return metas.value?.[colOptions.value?.fk_related_model_id as string]
    })

    const rowId = computed(() => extractPkFromRow(currentRow.value.row, meta.value.columns))

    const getRelatedTableRowId = (row: Record<string, any>) => {
      return extractPkFromRow(row, relatedTableMeta.value?.columns)
    }

    // actions

    const loadRelatedTableMeta = async () => {
      await getMeta(colOptions.value.fk_related_model_id as string)

      if (isPublic.value) return

      const viewId = colOptions.value.fk_target_view_id ?? relatedTableMeta.value.views?.[0]?.id ?? ''
      if (!viewId) return
      targetViewColumns.value = (await getViewColumns(viewId)) ?? []
    }

    const relatedTableDisplayValueColumn = computed(() => {
      return relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0]
    })

    const relatedTableDisplayValueProp = computed(() => {
      return relatedTableDisplayValueColumn.value?.title || ''
    })

    // todo: temp fix, handle in backend
    const relatedTableDisplayValuePropId = computed(() => {
      return relatedTableDisplayValueColumn.value?.id || ''
    })

    const relatedTablePrimaryKeyProps = computed(() => {
      return relatedTableMeta.value?.columns?.filter((c) => c.pk)?.map((c) => c.title) ?? []
    })

    const displayValueProp = computed(() => {
      return (meta.value?.columns?.find((c: Required<ColumnType>) => c.pv) || meta?.value?.columns?.[0])?.title
    })

    const displayValueTypeAndFormatProp = computed(() => {
      let displayValueTypeAndFormat = {
        type: '',
        format: '',
      }
      const currentColumn = relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0]

      if (currentColumn) {
        if (currentColumn?.uidt === UITypes.DateTime) {
          displayValueTypeAndFormat = {
            type: currentColumn?.uidt,
            format: `${parseProp(currentColumn?.meta)?.date_format ?? dateFormats[0]} ${
              parseProp(currentColumn?.meta)?.time_format ?? timeFormats[0]
            }`,
          }
        }
        if (currentColumn?.uidt === UITypes.Time) {
          displayValueTypeAndFormat = {
            type: currentColumn?.uidt,
            format: `${timeFormats[0]}`,
          }
        }
      }
      return displayValueTypeAndFormat
    })

    const headerDisplayValue = computed(() => {
      if (
        row.value.row[displayValueProp.value] &&
        displayValueTypeAndFormatProp.value.type &&
        displayValueTypeAndFormatProp.value.format
      ) {
        return parseStringDateTime(
          row.value.row[displayValueProp.value],
          displayValueTypeAndFormatProp.value.format,
          !(displayValueTypeAndFormatProp.value.format === UITypes.Time),
        )
      }
      return row.value.row[displayValueProp.value]
    })

    const attachmentCol = computedInject(FieldsInj, (_fields) => {
      return (relatedTableMeta.value.columns ?? []).filter((col) => isAttachment(col))[0]
    })

    const fields = computedInject(FieldsInj, (_fields) => {
      return (relatedTableMeta.value.columns ?? [])
        .filter((col) => !isSystemColumn(col) && !isPrimary(col) && !isLinksOrLTAR(col) && !isAttachment(col))
        .sort((a, b) => {
          if (isPublic.value) {
            return (a.meta?.defaultViewColOrder ?? Infinity) - (b.meta?.defaultViewColOrder ?? Infinity)
          }

          return (targetViewColumnsById.value[a.id!]?.order ?? Infinity) - (targetViewColumnsById.value[b.id!]?.order ?? Infinity)
        })
        .slice(0, isMobileMode.value ? 1 : 3)
    })

    const requiredFieldsToLoad = computed(() => {
      return Array.from(
        new Set([
          relatedTableDisplayValueProp.value,
          ...relatedTablePrimaryKeyProps.value,
          ...(attachmentCol.value ? [attachmentCol.value?.title] : []),
          ...(fields.value || [])?.map((f) => f.title?.trim() as string),
        ]),
      )
    })

    /**
     * Extract only primary key(pk) and primary value(pv) column data
     */
    const extractOnlyPrimaryValues = async (value: any, col: ColumnType) => {
      const currColOptions = (col.colOptions || {}) as LinkToAnotherRecordType

      await getMeta(currColOptions.fk_related_model_id as string)

      const currColRelatedTableMeta = metas.value?.[currColOptions?.fk_related_model_id as string] as TableType

      if (!currColRelatedTableMeta) return

      const primaryCols = (currColRelatedTableMeta?.columns || []).filter((c) => c.pv || c.pk)

      const extractValues = (value: any, primaryCols: ColumnType[]): any => {
        if (ncIsArray(value)) {
          return value.map((val) => extractValues(val, primaryCols)).filter(Boolean)
        }

        if (!ncIsObject(value)) return null

        const extractedValues: Record<string, any> = {}

        for (const c of primaryCols) {
          const val = value[c.title]

          if (ncIsUndefined(val) || ncIsNull(val)) continue

          extractedValues[c.title] = val
        }

        return extractedValues
      }

      return extractValues(value, primaryCols)
    }

    /**
     * Sanitization of row is requried because we will send this info in api query params
     * And query param has limit to send data
     * So it's better to send only requried row data which will be used for `Limit record selection to filters`
     */
    const sanitizeRowData = async (row: Record<string, any> = {}) => {
      const sanitizedRow: Record<string, any> = {}

      /**
       * Note: No need to send row data if `Limit record selection to filters` is not enabled
       */
      if (!ncIsObject(row) || !parseProp(column.value?.meta).enableConditions) return {}

      for (const col of meta.value.columns) {
        const value = row[col.title]

        if (ncIsUndefined(value) || ncIsNull(value)) continue

        switch (col.uidt) {
          case UITypes.Attachment: {
            /**
             * Attachment object is to big as this includes data base64/file object and for filter only required title.
             * So extract only title
             */
            if (ncIsArray(value)) {
              sanitizedRow[col.title] = value.map((item) => (item?.title ? { title: item?.title } : null)).filter(Boolean)
            }
            break
          }
          case UITypes.Links:
          case UITypes.LinkToAnotherRecord: {
            /**
             * Links/LTAR object is also big as in new record it will include while linked record data(depends on how many columns related table has)
             * So extract only primary column values (pk & pv)
             */
            const res = await extractOnlyPrimaryValues(value, col)
            if (res) {
              sanitizedRow[col.title] = res
            }
            break
          }

          default: {
            sanitizedRow[col.title] = value
          }
        }
      }

      return sanitizedRow
    }

    const loadChildrenExcludedList = async (activeState?: any, resetOffset = false) => {
      if (activeState) newRowState.state = activeState
      try {
        let offset =
          childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1) - childrenExcludedOffsetCount.value

        if (offset < 0 || resetOffset) {
          offset = 0
          childrenExcludedOffsetCount.value = 0
          childrenExcludedListPagination.page = 1
        }
        isChildrenExcludedLoading.value = true
        const where = childrenExcludedListPagination.query
          ? `(${relatedTableDisplayValueProp.value},${
              isDateOrDateTimeCol(relatedTableDisplayValueColumn.value!) ? 'eq,exactDate' : 'like'
            },${childrenExcludedListPagination.query})`
          : undefined

        if (isPublic.value) {
          const router = useRouter()

          const route = router.currentRoute

          let row
          // if shared form extract the current form state
          if (isForm.value) {
            const { formState, additionalState } = useSharedFormStoreOrThrow()

            row = await sanitizeRowData({ ...(formState?.value || {}), ...(additionalState?.value || {}) })
          }

          childrenExcludedList.value = await $api.public.dataRelationList(
            route.value.params.viewId as string,
            column.value.id,
            {},
            {
              headers: {
                'xc-password': sharedViewPassword.value,
              },
              query: {
                limit: childrenExcludedListPagination.size,
                offset,
                where,
                fields: requiredFieldsToLoad.value,
                // todo: include only required fields
                rowData: JSON.stringify(row),
              } as RequestParams,
            },
          )

          /** if new row load all records */
        } else if (isNewRow?.value) {
          const linkRowData = await sanitizeRowData(row.value.row)

          childrenExcludedList.value = await $api.dbTableRow.list(
            NOCO,
            baseId,
            relatedTableMeta?.value?.id as string,
            {
              limit: childrenExcludedListPagination.size,
              offset,
              where,
              // todo: include only required fields
              linkColumnId: column.value.fk_column_id || column.value.id,
              linkRowData: JSON.stringify(linkRowData),
            } as any,
          )
          const ids = new Set(childrenList.value?.list?.map((item) => item.Id) ?? [])
          if (childrenExcludedList.value.list && ids.size) {
            childrenExcludedList.value.list = childrenExcludedList.value.list.filter((item) => !ids.has(item.Id))
          }
        } else {
          // extract changed data and include with the api call if any
          let changedRowData
          try {
            if (row.value?.row) {
              changedRowData = Object.keys(row.value?.row).reduce((acc: Record<string, any>, key: string) => {
                if (row.value.row[key] !== row.value.oldRow[key]) acc[key] = row.value.row[key]
                return acc
              }, {})

              changedRowData = await sanitizeRowData(changedRowData)
            }
          } catch {}

          childrenExcludedList.value = await $api.dbTableRow.nestedChildrenExcludedList(
            NOCO,
            baseId,
            meta.value.id,
            encodeURIComponent(rowId.value),
            colOptions.value.type as RelationTypes,
            column?.value?.id,
            {
              limit: String(childrenExcludedListPagination.size),
              offset: String(offset),
              where,
              linkRowData: changedRowData ? JSON.stringify(changedRowData) : undefined,
            } as any,
          )
        }

        childrenExcludedList.value?.list.forEach((row: Record<string, any>, index: number) => {
          isChildrenExcludedListLinked.value[index] = false
          isChildrenExcludedListLoading.value[index] = false
        })

        if (childrenExcludedList.value?.list && activeState && activeState[column.value.title]) {
          // Mark out exact same objects in activeState[column.value.title] as Linked
          // compare all keys and values
          childrenExcludedList.value.list.forEach((row: any, index: number) => {
            const found = (
              [RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(colOptions.value.type)
                ? [activeState[column.value.title]]
                : activeState[column.value.title]
            ).find((a: any) => {
              let isSame = true

              for (const key in a) {
                if (a[key] !== row[key]) {
                  isSame = false
                }
              }
              return isSame
            })

            if (found) {
              isChildrenExcludedListLinked.value[index] = true
            }
          })
        }
      } catch (e: any) {
        // temporary fix to handle when offset is beyond limit
        const error = await extractSdkResponseErrorMsgv2(e)

        if (error.error === NcErrorType.INVALID_OFFSET_VALUE) {
          childrenExcludedListPagination.page = 0
          return loadChildrenExcludedList(activeState, true)
        }

        message.error(`${t('msg.error.failedToLoadList')}: ${error.message}`)
      } finally {
        isChildrenExcludedLoading.value = false
      }
    }

    const loadChildrenList = async (resetOffset = false, activeState: any = undefined, limit: number | undefined = undefined) => {
      if (activeState) newRowState.state = activeState

      try {
        isChildrenLoading.value = true
        if ([RelationTypes.BELONGS_TO, RelationTypes.ONE_TO_ONE].includes(colOptions.value.type)) return
        if (!column.value) return
        let offset = childrenListPagination.size * (childrenListPagination.page - 1) + childrenListOffsetCount.value
        if (offset < 0 || resetOffset) {
          offset = 0
          childrenListOffsetCount.value = 0
          childrenListPagination.page = 1
        } else if (offset >= childrenListCount.value) {
          offset = 0
        }

        if (isNewRow?.value || !rowId.value) {
          const colTitle = column.value?.title || ''
          const rawList = newRowState.state?.[colTitle] ?? []
          const query = childrenListPagination.query.toLocaleLowerCase()
          const list = query
            ? rawList.filter((record: Record<string, any>) =>
                `${record[relatedTableDisplayValueProp.value] ?? ''}`.toLocaleLowerCase().includes(query),
              )
            : rawList
          childrenList.value = {
            list,
            pageInfo: {
              isFirstPage: true,
              isLastPage: list.length <= 10,
              page: 1,
              pageSize: 10,
              totalRows: list.length,
            },
          }
        } else {
          let where: string | undefined

          if (childrenListPagination.query) {
            where = childrenListPagination.query
              ? `(${relatedTableDisplayValueProp.value},${
                  isDateOrDateTimeCol(relatedTableDisplayValueColumn.value!) ? 'eq,exactDate' : 'like'
                },${childrenListPagination.query})`
              : undefined
          }

          if (isPublic.value) {
            childrenList.value = await $api.public.dataNestedList(
              sharedView.value?.uuid as string,
              encodeURIComponent(rowId.value),
              colOptions.value.type as RelationTypes,
              column.value.id,
              {
                limit: String(childrenListPagination.size),
                offset: String(offset),
                where,
              } as any,
              {
                headers: {
                  'xc-password': sharedViewPassword.value,
                },
              },
            )
          } else {
            childrenList.value = await $api.dbTableRow.nestedList(
              NOCO,
              (base?.value?.id || (sharedView.value?.view as any)?.base_id) as string,
              meta.value.id,
              encodeURIComponent(rowId.value),
              colOptions.value.type as RelationTypes,
              column?.value?.id,
              {
                limit: String(limit ?? childrenListPagination.size),
                offset: String(offset),
                where,
              } as any,
            )
          }
        }
        childrenList.value?.list.forEach((row: Record<string, any>, index: number) => {
          isChildrenListLinked.value[index] = true
          isChildrenListLoading.value[index] = false
        })

        if (!childrenListPagination.query) {
          childrenListCount.value = childrenList.value?.pageInfo.totalRows ?? 0
        }
      } catch (e: any) {
        message.error(`${t('msg.error.failedToLoadChildrenList')}: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        isChildrenLoading.value = false
      }
      return childrenList.value
    }

    const deleteRelatedRow = async (row: Record<string, any>, onSuccess?: (row: Record<string, any>) => void) => {
      Modal.confirm({
        title: 'Do you want to delete the record?',
        type: 'warning',
        onOk: async () => {
          const id = getRelatedTableRowId(row)
          try {
            const res: { message?: string[] } | number = await $api.dbTableRow.delete(
              NOCO,
              baseId,
              relatedTableMeta.value.id as string,
              encodeURIComponent(id as string),
            )

            if (res.message) {
              message.info(
                `Record delete failed: ${`Unable to delete record with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
              )
              return false
            }

            _reloadData?.({ shouldShowLoading: false, path: path.value })

            /** reload child list if not a new row */
            if (!isNewRow?.value) {
              await loadChildrenList()
            }
            onSuccess?.(row)

            $e('a:links:delete-related-row')
          } catch (e: any) {
            message.error(`${t('msg.error.deleteFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
          }
        },
      })
    }

    const unlink = async (
      row: Record<string, any>,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
      undo = false,
      index: number, // Index is For Loading and Linked State of Row
    ) => {
      // const column = meta.columns.find(c => c.id === this.column.colOptions.fk_child_column_id);
      // todo: handle if new record
      // if (this.isNew) {
      //   this.$emit('updateCol', this.row, _cn, null);
      //   this.localState = null;
      //   this.$emit('update:localState', this.localState);
      //   return;
      // }
      // todo: handle bt column if required
      // if (column.rqd) {
      //   this.$toast.info('Unlink is not possible, instead map to another parent.').goAway(3000);
      //   return;
      // }
      try {
        // todo: audit

        childrenListOffsetCount.value = childrenListOffsetCount.value - 1
        childrenExcludedOffsetCount.value = childrenExcludedOffsetCount.value - 1

        isChildrenExcludedListLoading.value[index] = true
        isChildrenListLoading.value[index] = true
        await $api.dbTableRow.nestedRemove(
          NOCO,
          base.value.id as string,
          metaValue.id!,
          encodeURIComponent(rowId.value),
          colOptions.value.type as RelationTypes,
          column?.value?.id,
          encodeURIComponent(getRelatedTableRowId(row) as string),
        )

        if (!undo) {
          addUndo({
            redo: {
              fn: (row: Record<string, any>) => unlink(row, {}, true, index),
              args: [clone(row)],
            },
            undo: {
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              fn: (row: Record<string, any>) => link(row, {}, true, index),
              args: [clone(row)],
            },
            scope: defineViewScope({ view: activeView.value }),
          })
        }
        isChildrenExcludedListLinked.value[index] = false
        isChildrenListLinked.value[index] = false
        if (colOptions.value.type !== RelationTypes.BELONGS_TO && colOptions.value.type !== RelationTypes.ONE_TO_ONE) {
          childrenListCount.value = childrenListCount.value - 1
        }
      } catch (e: any) {
        message.error(`${t('msg.error.unlinkFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        isChildrenExcludedListLoading.value[index] = false
        isChildrenListLoading.value[index] = false
      }

      _reloadData?.({ shouldShowLoading: false, path: path.value })

      if (undo && isCanvasInjected) {
        reloadViewDataTrigger.trigger({ shouldShowLoading: false })
      }

      $e('a:links:unlink')
    }

    const link = async (
      row: Record<string, any>,
      { metaValue = meta.value }: { metaValue?: TableType } = {},
      undo = false,
      index: number, // Index is For Loading and Linked State of Row
    ) => {
      // todo: handle new record
      //   const pid = this._extractRowId(parent, this.parentMeta);
      // const id = this._extractRowId(this.row, this.meta);
      // const _cn = this.meta.columns.find(c => c.id === this.column.colOptions.fk_child_column_id).title;
      //
      // if (this.isNew) {
      //   const _rcn = this.parentMeta.columns.find(c => c.id === this.column.colOptions.fk_parent_column_id).title;
      //   this.localState = parent;
      //   this.$emit('update:localState', this.localState);
      //   this.$emit('updateCol', this.row, _cn, parent[_rcn]);
      //   this.newRecordModal = false;
      //   return;
      // }
      try {
        isChildrenExcludedListLoading.value[index] = true
        isChildrenListLoading.value[index] = true

        childrenListOffsetCount.value = childrenListOffsetCount.value + 1
        childrenExcludedOffsetCount.value = childrenExcludedOffsetCount.value + 1

        await $api.dbTableRow.nestedAdd(
          NOCO,
          base.value.id as string,
          metaValue.id as string,
          encodeURIComponent(rowId.value),
          colOptions.value.type as RelationTypes,
          column?.value?.id,
          encodeURIComponent(getRelatedTableRowId(row) as string) as string,
        )
        // await loadChildrenList()

        if (!undo) {
          let oldValue = null

          // If it is bt or oo relation then we have to restore old value on undo
          if (isBt(column.value) || isOo(column.value)) {
            oldValue = currentRow.value.row?.[column.value?.title]
          }

          addUndo({
            redo: {
              fn: (row: Record<string, any>) => {
                link(row, {}, true, index)
              },
              args: [clone(row)],
            },
            undo: {
              fn: (row: Record<string, any>, oldValue: Record<string, any> | null) => {
                // Restore old value if present
                if (oldValue) {
                  link(oldValue, {}, true, index)
                } else {
                  unlink(row, {}, true, index)
                }
              },
              args: [clone(row), clone(oldValue)],
            },
            scope: defineViewScope({ view: activeView.value }),
          })
        }
        isChildrenExcludedListLinked.value[index] = true
        isChildrenListLinked.value[index] = true

        if (colOptions.value.type !== RelationTypes.BELONGS_TO && colOptions.value.type !== RelationTypes.ONE_TO_ONE) {
          childrenListCount.value = childrenListCount.value + 1
        } else {
          isChildrenExcludedListLinked.value = Array(childrenExcludedList.value?.list.length).fill(false)
          isChildrenExcludedListLinked.value[index] = true
        }
      } catch (e: any) {
        message.error(`Linking failed: ${await extractSdkResponseErrorMsg(e)}`)
      } finally {
        // To Keep the Loading State for Minimum 600ms

        isChildrenExcludedListLoading.value[index] = false
        isChildrenListLoading.value[index] = false
      }

      _reloadData?.({ shouldShowLoading: false, path: path.value })

      if (undo && isCanvasInjected) {
        reloadViewDataTrigger.trigger({ shouldShowLoading: false })
      }

      $e('a:links:link')
    }

    const debounceLoadChildrenExcludedList = useDebounceFn(loadChildrenExcludedList, 500)

    const debounceLoadChildrenList = useDebounceFn(loadChildrenList, 500)

    // watchers
    watch(childrenExcludedListPagination, async () => {
      await debounceLoadChildrenExcludedList(newRowState.state)
    })

    watch(childrenListPagination, async () => {
      await debounceLoadChildrenList(false, newRowState.state)
    })

    watch(childrenList, async () => {
      childrenList.value?.list.forEach((row: Record<string, any>, index: number) => {
        isChildrenListLinked.value[index] = true
        isChildrenListLoading.value[index] = false
      })
    })

    const resetChildrenExcludedOffsetCount = () => {
      childrenExcludedOffsetCount.value = 0
    }

    const resetChildrenListOffsetCount = () => {
      childrenListOffsetCount.value = 0
    }

    return {
      relatedTableMeta,
      loadRelatedTableMeta,
      targetViewColumns,
      targetViewColumnsById,
      relatedTableDisplayValueProp,
      displayValueTypeAndFormatProp,
      childrenExcludedList,
      childrenList,
      childrenListCount,
      childrenListOffsetCount,
      childrenExcludedOffsetCount,
      rowId,
      childrenExcludedListPagination,
      childrenListPagination,
      displayValueProp,
      meta,
      unlink,
      link,
      loadChildrenExcludedList,
      loadChildrenList,
      isChildrenExcludedListLinked,
      isChildrenListLinked,
      isChildrenListLoading,
      isChildrenExcludedListLoading,
      row,
      isChildrenLoading,
      isChildrenExcludedLoading,
      deleteRelatedRow,
      getRelatedTableRowId,
      headerDisplayValue,
      relatedTableDisplayValueColumn,
      relatedTableDisplayValuePropId,
      resetChildrenExcludedOffsetCount,
      resetChildrenListOffsetCount,
      attachmentCol,
      fields,
      refreshCurrentRow,
    }
  },
  'ltar-store',
)

export { useProvideLTARStore }

export function useLTARStoreOrThrow() {
  const ltarStore = useLTARStore()
  if (ltarStore == null) throw new Error('Please call `useLTARStore` on the appropriate parent component')
  return ltarStore
}
