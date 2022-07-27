import { createInjectionState } from '@vueuse/core'
import { Form } from 'ant-design-vue'
import type { ColumnType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import { computed } from '#imports'

const useForm = Form.useForm

const [useProvideColumnCreateStore, useColumnCreateStore] = createInjectionState((column?: ColumnType) => {
  // state
  // todo: give proper type
  const formState = ref<Partial<ColumnType & Record<string, any>>>({
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

  const { resetFields, validate, validateInfos } = useForm(formState, validators)

  return { formState, resetFields, validate, validateInfos, setAdditionalValidations }
})

export { useProvideColumnCreateStore, useColumnCreateStore }

export function useColumnCreateStoreOrThrow() {
  const columnCreateStore = useColumnCreateStore()
  if (columnCreateStore == null) throw new Error('Please call `useColumnCreateStore` on the appropriate parent component')
  return columnCreateStore
}
