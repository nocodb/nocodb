import { Form } from 'ant-design-vue'
import { diff } from 'deep-object-diff'
import type { FormDefinition } from 'nocodb-sdk'

const [useProvideFormBuilderHelper, useFormBuilderHelper] = useInjectionState(
  (props: { formSchema: FormDefinition; onSubmit?: () => Promise<any>; initialState?: Ref<Record<string, any>> }) => {
    const { formSchema, onSubmit, initialState = ref({}) } = props

    const useForm = Form.useForm

    const form = ref<typeof Form>()

    const isLoading = ref(false)

    const isChanged = ref(false)

    const formElementsCategorized = computed(() => {
      const categorizedItems: Record<string, any> = {}

      for (const item of formSchema || []) {
        item.category = item.category || FORM_BUILDER_NON_CATEGORIZED

        if (!categorizedItems[item.category]) {
          categorizedItems[item.category] = []
        }

        categorizedItems[item.category].push(item)
      }

      return categorizedItems
    })

    const setNestedProp = (obj: any, path: string, value: any) => {
      const keys = path.split('.')
      const lastKey = keys.pop()

      if (!lastKey) return

      const target = keys.reduce((acc, key) => {
        if (!acc[key]) {
          acc[key] = {}
        }

        return acc[key]
      }, obj)
      target[lastKey] = value
    }

    const defaultFormState = () => {
      const defaultState: Record<string, any> = {}

      for (const field of formSchema || []) {
        if (!field.model) continue

        if (field.type === FormBuilderInputType.Switch) {
          setNestedProp(defaultState, field.model, field.defaultValue ?? false)
        } else if (field.type === FormBuilderInputType.Select) {
          setNestedProp(defaultState, field.model, field.defaultValue ?? [])
        } else {
          setNestedProp(defaultState, field.model, field.defaultValue ?? '')
        }
      }

      return defaultState
    }

    const formState = ref(defaultFormState())

    const validators = computed(() => {
      const validatorsObject: Record<string, any> = {}

      for (const field of formSchema || []) {
        if (!field.model) continue

        if (field.validators) {
          validatorsObject[field.model] = field.validators
            .map((validator: { type: 'required'; message?: string }) => {
              if (validator.type === 'required') {
                return {
                  required: true,
                  message: validator.message,
                }
              }

              return null
            })
            .filter((v: any) => v !== null)
        }
      }

      return validatorsObject
    })

    const { validate, validateInfos } = useForm(formState, validators)

    const submit = async () => {
      try {
        await validate()
      } catch (e) {
        form.value?.$el.querySelector('.ant-form-item-explain-error')?.parentNode?.parentNode?.querySelector('input')?.focus()

        return {
          success: false,
          details: e,
        }
      }
      isLoading.value = true

      try {
        const result = await onSubmit?.()

        return {
          success: true,
          result,
        }
      } catch (e) {
        return {
          success: false,
          details: e,
        }
      } finally {
        isLoading.value = false
      }
    }

    function checkDifference() {
      if (!initialState?.value) {
        return false
      }

      const difference = diff(initialState.value, formState.value)

      if (typeof difference === 'object' && Object.keys(difference).length === 0) {
        return false
      }

      return true
    }

    // reset test status on config change
    watch(
      formState,
      () => {
        if (checkDifference()) {
          isChanged.value = true
        } else {
          isChanged.value = false
        }
      },
      { deep: true },
    )

    onMounted(async () => {
      isLoading.value = true

      formState.value = {
        ...defaultFormState(),
        ...(initialState?.value ?? {}),
      }

      isLoading.value = false
    })

    return {
      form,
      formState,
      initialState,
      formElementsCategorized,
      isLoading,
      isChanged,
      validateInfos,
      validate,
      submit,
    }
  },
  'form-builder-helper',
)

export { useProvideFormBuilderHelper }

export function useFormBuilderHelperOrThrow() {
  const formBuilderStore = useFormBuilderHelper()
  if (formBuilderStore == null) throw new Error('Please call `useProvideFormBuilderHelper` on the appropriate parent component')
  return formBuilderStore
}
