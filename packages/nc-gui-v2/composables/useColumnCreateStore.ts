import { createInjectionState } from '@vueuse/core'
import { Form } from 'ant-design-vue'
import type { ColumnType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import { useToast } from 'vue-toastification'
import { computed } from '#imports'
import { useNuxtApp } from '#app'
import useColumn from '~/composables/useColumn'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'

const useForm = Form.useForm

// enum ColumnAlterType {
//   NEW=4,
//   EDIT=2,
//   RENAME=8,
//   DELETE=0,
// }

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

const [useProvideColumnCreateStore, useColumnCreateStore] = createInjectionState((meta: Ref<TableType>, column?: ColumnType) => {
  const { sqlUi } = useProject()
  const { $api } = useNuxtApp()

  const toast = useToast()

  const idType = null

  // state
  // todo: give proper type - ColumnType
  const formState = ref<Partial<Record<string, any>>>({
    title: 'title',
    uidt: UITypes.SingleLineText,
    ...(column || {}),
  })

  const additionalValidations = ref<Record<string, any>>({})

  const validators = computed(() => {
    return {
      column_name: [
        {
          required: true,
          message: 'Column name is required',
        },
        // validation for unique column name
        {
          validator: (rule: any, value: any) => {
            return new Promise<void>((resolve, reject) => {
              if (
                meta.value?.columns?.some(
                  (c) =>
                    c.id !== formState.value.id && // ignore current column
                    // compare against column_name and title
                    ((value || '').toLowerCase() === (c.column_name || '').toLowerCase() ||
                      (value || '').toLowerCase() === (c.title || '').toLowerCase()),
                )
              ) {
                return reject(new Error('Duplicate column name'))
              }
              resolve()
            })
          },
        },
      ],
      uidt: [
        {
          required: true,
          message: 'UI Datatype is required',
        },
      ],
      ...(additionalValidations?.value || {}),
    }
  })

  const { resetFields, validate, validateInfos } = useForm(formState, validators)

  // actions
  const generateNewColumnMeta = () => {
    formState.value = sqlUi.value.getNewColumn((meta.value.columns?.length || 0) + 1)
  }

  const setAdditionalValidations = (validations: Record<string, any>) => {
    additionalValidations.value = validations
  }

  const onUidtOrIdTypeChange = () => {
    const { isCurrency } = useColumn(formState.value as ColumnType)

    const colProp = sqlUi?.value.getDataTypeForUiType(formState?.value as any, idType as any)
    formState.value = {
      ...formState.value,
      meta: null,
      rqd: false,
      pk: false,
      ai: false,
      cdf: null,
      un: false,
      dtx: 'specificType',
      ...colProp,
    }

    formState.value.dtxp = sqlUi.value.getDefaultLengthForDatatype(formState.value.dt)
    formState.value.dtxs = sqlUi.value.getDefaultScaleForDatatype(formState.value.dt)

    const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
    if (column && selectTypes.includes(formState.value.uidt) && selectTypes.includes(column.uidt as UITypes)) {
      formState.value.dtxp = column.dtxp
    }

    if (columnToValidate.includes(formState.value.uidt)) {
      formState.value.meta = {
        validate: formState.value.meta && formState.value.meta.validate,
      }
    }

    if (isCurrency) {
      if (column?.uidt === UITypes.Currency) {
        formState.value.dtxp = column.dtxp
        formState.value.dtxs = column.dtxs
      } else {
        formState.value.dtxp = 19
        formState.value.dtxs = 2
      }
    }

    formState.value.altered = formState.value.altered || 2
  }

  const onDataTypeChange = () => {
    const { isCurrency } = useColumn(formState.value as ColumnType)

    formState.value.rqd = false
    if (formState.value.uidt !== UITypes.ID) {
      formState.value.primaryKey = false
    }
    formState.value.ai = false
    formState.value.cdf = null
    formState.value.un = false
    formState.value.dtxp = sqlUi.value.getDefaultLengthForDatatype(formState.value.dt)
    formState.value.dtxs = sqlUi.value.getDefaultScaleForDatatype(formState.value.dt)

    formState.value.dtx = 'specificType'

    const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
    if (column && selectTypes.includes(formState.value.uidt) && selectTypes.includes(column.uidt as UITypes)) {
      formState.value.dtxp = column.dtxp
    }

    if (isCurrency) {
      if (column?.uidt === UITypes.Currency) {
        formState.value.dtxp = column.dtxp
        formState.value.dtxs = column.dtxs
      } else {
        formState.value.dtxp = 19
        formState.value.dtxs = 2
      }
    }

    // this.$set(formState.value, 'uidt', sqlUi.value.getUIType(formState.value));

    formState.value.altered = formState.value.altered || 2
  }

  const onAlter = (val = 2, cdf = false) => {
    formState.value.altered = formState.value.altered || val
    if (cdf) formState.value.cdf = formState.value.cdf || null
  }

  const addOrUpdate = async (onSuccess: () => {}) => {
    if (!(await validate())) return

    formState.value.table_name = meta.value.table_name
    formState.value.title = formState.value.column_name
    try {
      if (column) {
        await $api.dbTableColumn.update(column.id as string, formState.value)
        toast.success('Column updated')
      } else {
        // todo : set additional meta for auto generated string id
        if (formState.value.uidt === UITypes.ID) {
          // based on id column type set autogenerated meta prop
          // if (isAutoGenId) {
          //   this.newColumn.meta = {
          //     ag: 'nc',
          //   };
          // }
        }
        await $api.dbTableColumn.create(meta.value.id as string, formState.value)

        toast.success('Column created')
      }
      onSuccess()
    } catch (e) {
      toast.error(await extractSdkResponseErrorMsg(e))
    }
  }

  return {
    formState,
    resetFields,
    validate,
    validateInfos,
    setAdditionalValidations,
    onUidtOrIdTypeChange,
    sqlUi,
    onDataTypeChange,
    onAlter,
    addOrUpdate,
    generateNewColumnMeta,
    isEdit: !!column?.id,
  }
})

export { useProvideColumnCreateStore }

export function useColumnCreateStoreOrThrow() {
  const columnCreateStore = useColumnCreateStore()
  if (columnCreateStore == null) throw new Error('Please call `useColumnCreateStore` on the appropriate parent component')
  return columnCreateStore
}
