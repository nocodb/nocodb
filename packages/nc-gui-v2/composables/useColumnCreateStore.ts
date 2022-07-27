import { createInjectionState } from '@vueuse/core'
import { Form } from 'ant-design-vue'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed } from '#imports'
import useColumn from '~/composables/useColumn'

const useForm = Form.useForm

// enum ColumnAlterType {
//   NEW=4,
//   EDIT=2,
//   RENAME=8,
//   DELETE=0,
// }

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

const [useProvideColumnCreateStore, useColumnCreateStore] = createInjectionState((column?: ColumnType) => {
  const { sqlUi } = useProject()
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

  // actions
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

  const addOrUpdate = () => {
    // todo
    console.log('To be done')
  }

  const { resetFields, validate, validateInfos } = useForm(formState, validators)

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
  }
})

export { useProvideColumnCreateStore, useColumnCreateStore }

export function useColumnCreateStoreOrThrow() {
  const columnCreateStore = useColumnCreateStore()
  if (columnCreateStore == null) throw new Error('Please call `useColumnCreateStore` on the appropriate parent component')
  return columnCreateStore
}
