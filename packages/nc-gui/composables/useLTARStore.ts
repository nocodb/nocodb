import type {
  type ColumnType,
  type LinkToAnotherRecordType,
  type PaginatedType,
  type RequestParams,
  type TableType,
} from 'nocodb-sdk'
import { RelationTypes, UITypes, dateFormats, parseStringDateTime, timeFormats } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'

interface DataApiResponse {
  list: Record<string, any>[]
  pageInfo: PaginatedType
}

/** Store for managing Link to another cells */
const [useProvideLTARStore, useLTARStore] = useInjectionState(
  (
    column: Ref<Required<ColumnType>>,
    row: Ref<Row>,
    isNewRow: ComputedRef<boolean> | Ref<boolean>,
    _reloadData = (_params: { shouldShowLoading?: boolean }) => {},
  ) => {
    // state
    const { metas, getMeta } = useMetas()

    const { base } = storeToRefs(useBase())

    const { $api, $e } = useNuxtApp()

    const activeView = inject(ActiveViewInj, ref())
    const isForm = inject(IsFormInj, ref(false))

    const { addUndo, clone, defineViewScope } = useUndoRedo()

    const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

    const childrenExcludedList = ref<DataApiResponse | undefined>()
    const childrenList = ref<DataApiResponse | undefined>()

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

    const baseId = base.value?.id || (sharedView.value?.view as any)?.base_id

    // getters
    const meta = computed(() => metas?.value?.[column?.value?.fk_model_id as string])
    const relatedTableMeta = computed<TableType>(() => {
      return metas.value?.[colOptions.value?.fk_related_model_id as string]
    })

    const rowId = computed(() => extractPkFromRow(row.value.row, meta.value.columns))

    const getRelatedTableRowId = (row: Record<string, any>) => {
      return extractPkFromRow(row, relatedTableMeta.value?.columns)
    }

    // actions

    const loadRelatedTableMeta = async () => {
      await getMeta(colOptions.value.fk_related_model_id as string)
    }

    const relatedTableDisplayValueProp = computed(() => {
      return (relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.title || ''
    })

    // todo: temp fix, handle in backend
    const relatedTableDisplayValuePropId = computed(() => {
      return (relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.id || ''
    })

    const relatedTablePrimaryKeyProps = computed(() => {
      return relatedTableMeta.value?.columns?.filter((c) => c.pk)?.map((c) => c.title) ?? []
    })

    const displayValueProp = computed(() => {
      return (meta.value?.columns?.find((c: Required<ColumnType>) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.title
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
        if (isPublic.value) {
          const router = useRouter()

          const route = router.currentRoute

          let row
          // if shared form extract the current form state
          if (isForm.value) {
            const { formState } = useSharedFormStoreOrThrow()
            row = formState?.value
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
                where:
                  childrenExcludedListPagination.query &&
                  `(${relatedTableDisplayValueProp.value},like,${childrenExcludedListPagination.query})`,
                fields: [relatedTableDisplayValueProp.value, ...relatedTablePrimaryKeyProps.value],

                // todo: include only required fields
                rowData: JSON.stringify(row),
              } as RequestParams,
            },
          )

          /** if new row load all records */
        } else if (isNewRow?.value) {
          childrenExcludedList.value = await $api.dbTableRow.list(
            NOCO,
            baseId,
            relatedTableMeta?.value?.id as string,
            {
              limit: childrenExcludedListPagination.size,
              offset,
              where:
                childrenExcludedListPagination.query &&
                `(${relatedTableDisplayValueProp.value},like,${childrenExcludedListPagination.query})`,
              // fields: [relatedTableDisplayValueProp.value, ...relatedTablePrimaryKeyProps.value],

              // todo: include only required fields
              linkColumnId: column.value.fk_column_id || column.value.id,
              linkRowData: JSON.stringify(row.value.row),
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
              // todo: where clause is missing from type
              where:
                childrenExcludedListPagination.query &&
                `(${relatedTableDisplayValueProp.value},like,${childrenExcludedListPagination.query})`,
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

    const loadChildrenList = async (resetOffset: boolean = false, activeState: any = undefined) => {
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
        } else if (isPublic.value) {
          childrenList.value = await $api.public.dataNestedList(
            sharedView.value?.uuid as string,
            encodeURIComponent(rowId.value),
            colOptions.value.type as RelationTypes,
            column.value.id,
            {
              limit: String(childrenListPagination.size),
              offset: String(offset),
              where:
                childrenListPagination.query && `(${relatedTableDisplayValueProp.value},like,${childrenListPagination.query})`,
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
              limit: String(childrenListPagination.size),
              offset: String(offset),
              where:
                childrenListPagination.query && `(${relatedTableDisplayValueProp.value},like,${childrenListPagination.query})`,
            } as any,
          )
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

            _reloadData?.({ shouldShowLoading: false })

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

      _reloadData?.({ shouldShowLoading: false })
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
          addUndo({
            redo: {
              fn: (row: Record<string, any>) => link(row, {}, true, index),
              args: [clone(row)],
            },
            undo: {
              fn: (row: Record<string, any>) => unlink(row, {}, true, index),
              args: [clone(row)],
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

      _reloadData?.({ shouldShowLoading: false })
      $e('a:links:link')
    }

    // watchers
    watch(childrenExcludedListPagination, async () => {
      await loadChildrenExcludedList(newRowState.state)
    })

    watch(childrenListPagination, async () => {
      await loadChildrenList(false, newRowState.state)
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
      relatedTableDisplayValuePropId,
      resetChildrenExcludedOffsetCount,
      resetChildrenListOffsetCount,
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
