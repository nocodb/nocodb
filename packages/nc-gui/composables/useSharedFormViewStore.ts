import useVuelidate from '@vuelidate/core'
import { minLength, required } from '@vuelidate/validators'
import type { Ref } from 'vue'
import type { ColumnType, FormType, LinkToAnotherRecordType, TableType, ViewType } from 'nocodb-sdk'
import { ErrorMessages, RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  SharedViewPasswordInj,
  computed,
  extractSdkResponseErrorMsg,
  message,
  provide,
  ref,
  useApi,
  useInjectionState,
  useMetas,
  useProvideSmartsheetRowStore,
  watch,
} from '#imports'

const [useProvideSharedFormStore, useSharedFormStore] = useInjectionState((sharedViewId: string) => {
  const progress = ref(false)
  const notFound = ref(false)
  const submitted = ref(false)
  const passwordDlg = ref(false)
  const password = ref<string | null>(null)
  const secondsRemain = ref(0)

  provide(SharedViewPasswordInj, password)

  const sharedView = ref<ViewType>()
  const sharedFormView = ref<FormType>()
  const meta = ref<TableType>()
  const columns = ref<(ColumnType & { required?: boolean; show?: boolean; label?: string })[]>()

  const { api, isLoading } = useApi()

  const { metas, setMeta } = useMetas()

  const formState = ref({})

  const { state: additionalState } = useProvideSmartsheetRowStore(
    meta as Ref<TableType>,
    ref({
      row: formState,
      rowMeta: { new: true },
      oldRow: {},
    }),
  )

  const formColumns = computed(() =>
    columns.value?.filter((c) => c.show).filter((col) => !isVirtualCol(col) || col.uidt === UITypes.LinkToAnotherRecord),
  )
  const loadSharedView = async () => {
    try {
      const viewMeta = await api.public.sharedViewMetaGet(sharedViewId, {
        headers: {
          'xc-password': password.value,
        },
      })

      passwordDlg.value = false

      sharedView.value = viewMeta
      sharedFormView.value = viewMeta.view
      meta.value = viewMeta.model
      columns.value = viewMeta.model?.columns

      await setMeta(viewMeta.model)

      const relatedMetas = { ...viewMeta.relatedMetas }

      Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))
    } catch (e: any) {
      if (e.response && e.response.status === 404) {
        notFound.value = true
      } else if ((await extractSdkResponseErrorMsg(e)) === ErrorMessages.INVALID_SHARED_VIEW_PASSWORD) {
        passwordDlg.value = true
      }
    }
  }

  const validators = computed(() => {
    const obj: Record<string, Record<string, any>> = {
      localState: {},
      virtual: {},
    }

    if (!formColumns.value) return obj

    for (const column of formColumns.value) {
      if (
        !isVirtualCol(column) &&
        ((column.rqd && !column.cdf) || (column.pk && !(column.ai || column.cdf)) || column.required)
      ) {
        obj.localState[column.title!] = { required }
      } else if (
        column.uidt === UITypes.LinkToAnotherRecord &&
        column.colOptions &&
        (column.colOptions as LinkToAnotherRecordType).type === RelationTypes.BELONGS_TO
      ) {
        const col = columns.value?.find((c) => c.id === (column?.colOptions as LinkToAnotherRecordType)?.fk_child_column_id)

        if ((col && col.rqd && !col.cdf) || column.required) {
          if (col) {
            obj.virtual[column.title!] = { required }
          }
        }
      } else if (isVirtualCol(column) && column.required) {
        obj.virtual[column.title!] = {
          minLength: minLength(1),
          required,
        }
      }
    }

    return obj
  })

  const v$ = useVuelidate(
    validators,
    computed(() => ({ localState: formState.value, virtual: additionalState.value })),
  )

  const submitForm = async () => {
    try {
      if (!(await v$.value?.$validate())) {
        return
      }

      progress.value = true
      const data: Record<string, any> = { ...formState.value, ...additionalState.value }
      const attachment: Record<string, any> = {}

      /** find attachments in form data */
      for (const col of metas.value?.[sharedView.value?.fk_model_id as string]?.columns) {
        if (col.uidt === UITypes.Attachment) {
          if (data[col.title]) {
            attachment[`_${col.title}`] = data[col.title].map((item: { file: File }) => item.file)
          }
        }
      }

      await api.public.dataCreate(
        sharedView.value!.uuid!,
        {
          data,
          ...attachment,
        },
        {
          headers: {
            'xc-password': password.value,
          },
        },
      )

      submitted.value = true
      progress.value = false

      await message.success(sharedFormView.value?.success_msg || 'Saved successfully.')
    } catch (e: any) {
      console.log(e)
      await message.error(await extractSdkResponseErrorMsg(e))
    }
    progress.value = false
  }

  /** reset form if show_blank_form is true */
  watch(submitted, (nextVal) => {
    if (nextVal && sharedFormView.value?.show_blank_form) {
      secondsRemain.value = 5
      const intvl = setInterval(() => {
        secondsRemain.value = secondsRemain.value - 1

        if (secondsRemain.value < 0) {
          submitted.value = false

          clearInterval(intvl)
        }
      }, 1000)
    }

    /** reset form state and validation */
    if (!nextVal) {
      additionalState.value = {}
      formState.value = {}
      v$.value?.$reset()
    }
  })

  return {
    sharedView,
    sharedFormView,
    loadSharedView,
    columns,
    submitForm,
    progress,
    meta,
    validators,
    v$,
    formColumns,
    formState,
    notFound,
    password,
    submitted,
    secondsRemain,
    passwordDlg,
    isLoading,
  }
}, 'expanded-form-store')

export { useProvideSharedFormStore }

export function useSharedFormStoreOrThrow() {
  const sharedFormStore = useSharedFormStore()

  if (sharedFormStore == null) throw new Error('Please call `useProvideSharedFormStore` on the appropriate parent component')

  return sharedFormStore
}
