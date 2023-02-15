import type { ColumnType, LinkToAnotherRecordType, PaginatedType, RequestParams, TableType } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import {
  IsPublicInj,
  Modal,
  NOCO,
  SharedViewPasswordInj,
  computed,
  extractSdkResponseErrorMsg,
  inject,
  message,
  reactive,
  ref,
  useI18n,
  useInjectionState,
  useMetas,
  useNuxtApp,
  useProject,
  useRouter,
  useSharedView,
  watch,
} from '#imports'
import type { Row } from '~/lib'

interface DataApiResponse {
  list: Record<string, any>
  pageInfo: PaginatedType
}

/** Store for managing Link to another cells */
const [useProvideLTARStore, useLTARStore] = useInjectionState(
  (
    column: Ref<Required<ColumnType>>,
    row: Ref<Row>,
    isNewRow: ComputedRef<boolean> | Ref<boolean>,
    reloadData = (_showProgress?: boolean) => {},
  ) => {
    // state
    const { metas, getMeta } = useMetas()

    const { project } = useProject()

    const { $api } = useNuxtApp()

    const sharedViewPassword = inject(SharedViewPasswordInj, ref(null))

    const childrenExcludedList = ref<DataApiResponse | undefined>()
    const childrenList = ref<DataApiResponse | undefined>()

    const childrenExcludedListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const childrenListPagination = reactive({
      page: 1,
      query: '',
      size: 10,
    })

    const { t } = useI18n()

    const isPublic: boolean = $(inject(IsPublicInj, ref(false)))

    const colOptions = $computed(() => column.value?.colOptions as LinkToAnotherRecordType)

    const { sharedView } = useSharedView()

    const projectId = project.value?.id || (sharedView.value?.view as any)?.project_id

    // getters
    const meta = computed(() => metas?.value?.[column?.value?.fk_model_id as string])
    const relatedTableMeta = computed<TableType>(() => {
      return metas.value?.[colOptions?.fk_related_model_id as string]
    })

    const rowId = computed(() =>
      meta.value.columns
        .filter((c: Required<ColumnType>) => c.pk)
        .map((c: Required<ColumnType>) => row?.value?.row?.[c.title])
        .join('___'),
    )

    // actions
    const getRelatedTableRowId = (row: Record<string, any>) => {
      return relatedTableMeta.value?.columns
        ?.filter((c) => c.pk)
        .map((c) => row?.[c.title as string])
        .join('___')
    }

    const loadRelatedTableMeta = async () => {
      await getMeta(colOptions.fk_related_model_id as string)
    }

    const relatedTablePrimaryValueProp = computed(() => {
      return (relatedTableMeta.value?.columns?.find((c) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.title || ''
    })

    const relatedTablePrimaryKeyProps = computed(() => {
      return relatedTableMeta.value?.columns?.filter((c) => c.pk)?.map((c) => c.title) ?? []
    })
    const primaryValueProp = computed(() => {
      return (meta.value?.columns?.find((c: Required<ColumnType>) => c.pv) || relatedTableMeta?.value?.columns?.[0])?.title
    })

    const loadChildrenExcludedList = async () => {
      try {
        if (isPublic) {
          const router = useRouter()

          const route = $(router.currentRoute)

          childrenExcludedList.value = await $api.public.dataRelationList(
            route.params.viewId as string,
            column.value.id,
            {},
            {
              headers: {
                'xc-password': sharedViewPassword.value,
              },
              query: {
                limit: childrenExcludedListPagination.size,
                offset: childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1),
                where:
                  childrenExcludedListPagination.query &&
                  `(${relatedTablePrimaryValueProp.value},like,${childrenExcludedListPagination.query})`,
                fields: [relatedTablePrimaryValueProp.value, ...relatedTablePrimaryKeyProps.value],
              } as RequestParams,
            },
          )

          /** if new row load all records */
        } else if (isNewRow?.value) {
          childrenExcludedList.value = await $api.dbTableRow.list(
            NOCO,
            projectId,
            relatedTableMeta?.value?.id as string,
            {
              limit: childrenExcludedListPagination.size,
              offset: childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1),
              where:
                childrenExcludedListPagination.query &&
                `(${relatedTablePrimaryValueProp.value},like,${childrenExcludedListPagination.query})`,
              fields: [relatedTablePrimaryValueProp.value, ...relatedTablePrimaryKeyProps.value],
            } as any,
          )
        } else {
          childrenExcludedList.value = await $api.dbTableRow.nestedChildrenExcludedList(
            NOCO,
            projectId,
            meta.value.id,
            rowId.value,
            colOptions.type as 'mm' | 'hm',
            encodeURIComponent(column?.value?.title),
            {
              limit: String(childrenExcludedListPagination.size),
              offset: String(childrenExcludedListPagination.size * (childrenExcludedListPagination.page - 1)),
              // todo: where clause is missing from type
              where:
                childrenExcludedListPagination.query &&
                `(${relatedTablePrimaryValueProp.value},like,${childrenExcludedListPagination.query})`,
            } as any,
          )
        }
      } catch (e: any) {
        message.error(`${t('msg.error.failedToLoadList')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    const loadChildrenList = async () => {
      try {
        if (colOptions.type === 'bt') return

        if (isPublic) {
          childrenList.value = await $api.public.dataNestedList(
            sharedView.value?.uuid as string,
            rowId.value,
            colOptions.type as 'mm' | 'hm',
            encodeURIComponent(column?.value?.id),
            {
              limit: String(childrenListPagination.size),
              offset: String(childrenListPagination.size * (childrenListPagination.page - 1)),
              where:
                childrenListPagination.query && `(${relatedTablePrimaryValueProp.value},like,${childrenListPagination.query})`,
            } as any,
          )
        } else {
          childrenList.value = await $api.dbTableRow.nestedList(
            NOCO,
            (project?.value?.id || (sharedView.value?.view as any)?.project_id) as string,
            meta.value.id,
            rowId.value,
            colOptions.type as 'mm' | 'hm',
            encodeURIComponent(column?.value?.title),
            {
              limit: String(childrenListPagination.size),
              offset: String(childrenListPagination.size * (childrenListPagination.page - 1)),
              where:
                childrenListPagination.query && `(${relatedTablePrimaryValueProp.value},like,${childrenListPagination.query})`,
            } as any,
          )
        }
      } catch (e: any) {
        message.error(`${t('msg.error.failedToLoadChildrenList')}: ${await extractSdkResponseErrorMsg(e)}`)
      }
    }

    const deleteRelatedRow = async (row: Record<string, any>, onSuccess?: (row: Record<string, any>) => void) => {
      Modal.confirm({
        title: 'Do you want to delete the record?',
        type: 'warning',
        onOk: async () => {
          const id = getRelatedTableRowId(row)
          try {
            const res: { message?: string[] } = await $api.dbTableRow.delete(
              NOCO,
              projectId,
              relatedTableMeta.value.id as string,
              id as string,
            )

            if (res.message) {
              message.info(
                `Row delete failed: ${`Unable to delete row with ID ${id} because of the following:
              \n${res.message.join('\n')}.\n
              Clear the data first & try again`})}`,
              )
              return false
            }

            reloadData?.(false)

            /** reload child list if not a new row */
            if (!isNewRow?.value) {
              await loadChildrenList()
            }
            onSuccess?.(row)
          } catch (e: any) {
            message.error(`${t('msg.error.deleteFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
          }
        },
      })
    }

    const unlink = async (row: Record<string, any>) => {
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
        await $api.dbTableRow.nestedRemove(
          NOCO,
          project.value.title as string,
          meta.value.title,
          rowId.value,
          colOptions.type as 'mm' | 'hm',
          encodeURIComponent(column?.value?.title),
          getRelatedTableRowId(row) as string,
        )
      } catch (e: any) {
        message.error(`${t('msg.error.unlinkFailed')}: ${await extractSdkResponseErrorMsg(e)}`)
      }

      reloadData?.(false)
    }

    const link = async (row: Record<string, any>) => {
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
        await $api.dbTableRow.nestedAdd(
          NOCO,
          project.value.title as string,
          meta.value.title as string,
          rowId.value,
          colOptions.type as 'mm' | 'hm',
          encodeURIComponent(column?.value?.title),
          getRelatedTableRowId(row) as string,
        )
        await loadChildrenList()
      } catch (e: any) {
        message.error(`Linking failed: ${await extractSdkResponseErrorMsg(e)}`)
      }

      reloadData?.(false)
    }

    // watchers
    watch(childrenExcludedListPagination, async () => {
      await loadChildrenExcludedList()
    })

    watch(childrenListPagination, async () => {
      await loadChildrenList()
    })

    return {
      relatedTableMeta,
      loadRelatedTableMeta,
      relatedTablePrimaryValueProp,
      childrenExcludedList,
      childrenList,
      rowId,
      childrenExcludedListPagination,
      childrenListPagination,
      primaryValueProp,
      meta,
      unlink,
      link,
      loadChildrenExcludedList,
      loadChildrenList,
      row,
      deleteRelatedRow,
      getRelatedTableRowId,
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
