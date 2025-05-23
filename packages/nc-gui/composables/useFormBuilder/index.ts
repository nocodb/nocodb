import { Form } from 'ant-design-vue'
import { diff } from 'deep-object-diff'
import type { FormBuilderCondition, FormBuilderElement, FormDefinition } from 'nocodb-sdk'

const [useProvideFormBuilderHelper, useFormBuilderHelper] = useInjectionState(
  (props: {
    formSchema: MaybeRef<FormDefinition | undefined>
    onSubmit?: () => Promise<any>
    onChange?: () => void
    fetchOptions?: (key: string) => Promise<any>
    initialState?: Ref<Record<string, any>>
  }) => {
    const { formSchema, onSubmit, onChange, fetchOptions, initialState = ref({}) } = props

    const useForm = Form.useForm

    const form = ref<typeof Form>()

    const isLoading = ref(false)

    const isChanged = ref(false)

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

      for (const field of unref(formSchema) || []) {
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

    const deepReference = (path: string): any => {
      return deepReferenceHelper(formState, path)
    }

    const setFormState = (path: string, value: any) => {
      setFormStateHelper(formState, path, value)
    }

    const loadOptions = async (field: FormBuilderElement) => {
      if (!fetchOptions || !field.fetchOptionsKey) return []

      const options = await fetchOptions(field.fetchOptionsKey)

      field.options = options
    }

    const checkCondition = (field: FormBuilderElement) => {
      if (!field.condition) return true

      const condition = field.condition

      function checkConditionItem(condition: FormBuilderCondition) {
        const value = deepReference(condition.model)
        if (condition.value || condition.equal) {
          return condition.value ? condition.value === value : condition.equal === value
        }

        if (condition.in) {
          return condition.in.includes(value)
        }

        if (condition.empty) {
          if (Array.isArray(value)) {
            return value.length === 0
          }

          return !value
        }

        if (condition.notEmpty) {
          if (Array.isArray(value)) {
            return value.length > 0
          }

          return !!value
        }

        return false
      }

      if (Array.isArray(condition)) {
        return condition.every((c) => {
          return checkConditionItem(c)
        })
      }

      return checkConditionItem(condition)
    }

    const formElementsCategorized = computed(() => {
      const categorizedItems: Record<string, any> = {}

      // apply condition to form schema
      const filteredFormSchema = unref(formSchema)?.filter((item) => {
        return checkCondition(item)
      })

      for (const item of filteredFormSchema || []) {
        item.category = item.category || FORM_BUILDER_NON_CATEGORIZED

        if (!categorizedItems[item.category]) {
          categorizedItems[item.category] = []
        }

        categorizedItems[item.category].push(item)
      }

      return categorizedItems
    })

    const validators = computed(() => {
      const validatorsObject: Record<string, any> = {}
      for (const field of unref(formSchema) || []) {
        if (!field.model) continue

        if (field.validators && checkCondition(field)) {
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

    const { validate, clearValidate, validateInfos } = useForm(formState, validators)

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
        onChange?.()

        if (checkDifference()) {
          isChanged.value = true
        } else {
          isChanged.value = false
        }
      },
      { deep: true },
    )

    watch(
      () => unref(formSchema),
      async () => {
        isLoading.value = true

        formState.value = {
          ...formState.value,
          ...defaultFormState(),
          ...(initialState?.value ?? {}),
        }

        nextTick(clearValidate)

        isLoading.value = false
      },
      { immediate: true },
    )

    return {
      form,
      formState,
      initialState,
      formSchema,
      formElementsCategorized,
      isLoading,
      isChanged,
      validateInfos,
      clearValidate,
      validate,
      submit,
      checkCondition,
      deepReference,
      setFormState,
      loadOptions,
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
