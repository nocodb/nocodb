import { Form } from 'ant-design-vue'
import { diff } from 'deep-object-diff'
import type {
  CustomFormBuilderValidator,
  FormBuilderCondition,
  FormBuilderConditionGroup,
  FormBuilderElement,
  FormBuilderValidator,
  FormDefinition,
} from 'nocodb-sdk'
import { FormBuilderValidatorType } from 'nocodb-sdk'

const [useProvideFormBuilderHelper, useFormBuilderHelper] = useInjectionState(
  (props: {
    formSchema: MaybeRef<FormDefinition | undefined>
    onSubmit?: () => Promise<any>
    onChange?: () => void
    fetchOptions?: (key: string) => Promise<any>
    initialState?: Ref<Record<string, any>>
    disabled?: MaybeRef<boolean>
  }) => {
    const { formSchema, onSubmit, onChange, fetchOptions, initialState = ref({}), disabled = false } = props

    const useForm = Form.useForm

    const form = ref<typeof Form>()

    const isLoading = ref(false)

    const isChanged = ref(false)

    const fieldOptions = ref<Record<string, any[]>>({})

    const isLoadingFieldOptions = ref<Record<string, boolean>>({})

    const dependencyWatcherCleanups: Array<() => void> = []

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
        } else if (field.type === FormBuilderInputType.ConditionBuilder) {
          setNestedProp(defaultState, field.model, field.defaultValue ?? { combinator: 'and', conditions: [] })
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

    const loadOptions = async (field: FormBuilderElement, searchQuery?: string) => {
      /**
       * If the field is not visible, don't load options
       */
      if (!fetchOptions || !field.fetchOptionsKey || !field.model || !checkCondition(field)) return []

      isLoadingFieldOptions.value[field.model] = true

      try {
        fieldOptions.value[field.model] = await fetchOptions(field.fetchOptionsKey, searchQuery)
      } finally {
        isLoadingFieldOptions.value[field.model] = false
      }
    }

    const getFieldOptions = (model: string) => {
      return fieldOptions.value[model] || []
    }

    const getIsLoadingFieldOptions = (model: string) => {
      return ncIsUndefined(fieldOptions.value[model]) || !!isLoadingFieldOptions.value[model]
    }

    const setupDependencyWatchers = () => {
      if (unref(disabled)) return
      dependencyWatcherCleanups.forEach((cleanup) => cleanup())
      dependencyWatcherCleanups.length = 0

      const fieldsWithDependencies = (unref(formSchema) || []).filter(
        (field) => field.fetchOptionsKey && field.dependsOn && field.model,
      )

      fieldsWithDependencies.forEach((field) => {
        const dependencies = Array.isArray(field.dependsOn) ? field.dependsOn : [field.dependsOn!]

        dependencies.forEach((depPath) => {
          const stopWatch = watch(
            () => deepReference(depPath),
            async (newValue, oldValue) => {
              if (newValue !== oldValue && oldValue !== undefined) {
                if (field.model) {
                  setFormState(field.model, field.selectMode === 'multiple' ? [] : null)
                }

                await loadOptions(field)
              }
            },
          )

          dependencyWatcherCleanups.push(stopWatch)
        })
      })
    }

    function checkConditionItem(condition: FormBuilderCondition): boolean {
      const value = deepReference(condition.model)

      // Check equality
      if (condition.value !== undefined || condition.equal !== undefined) {
        return condition.value !== undefined ? condition.value === value : condition.equal === value
      }

      // Check not equal
      if (condition.notEqual !== undefined) {
        return condition.notEqual !== value
      }

      // Check if value is in array
      // When value is an array (multi-select), check if ANY condition.in element is in value
      if (condition.in) {
        if (Array.isArray(value)) {
          return condition.in.some((item) => value.includes(item))
        }
        return condition.in.includes(value)
      }

      // Check if value is NOT in array
      // When value is an array (multi-select), check if NONE of condition.notIn elements are in value
      if (condition.notIn) {
        if (Array.isArray(value)) {
          return !condition.notIn.some((item) => value.includes(item))
        }
        return !condition.notIn.includes(value)
      }

      // Check if empty
      if (condition.empty) {
        if (Array.isArray(value)) {
          return value.length === 0
        }
        return !value
      }

      // Check if not empty
      if (condition.notEmpty) {
        if (Array.isArray(value)) {
          return value.length > 0
        }
        return !!value
      }

      return false
    }

    function checkConditionGroup(
      conditionOrGroup: FormBuilderCondition | FormBuilderCondition[] | FormBuilderConditionGroup,
    ): boolean {
      // Single condition
      if ('model' in conditionOrGroup && typeof conditionOrGroup.model === 'string') {
        return checkConditionItem(conditionOrGroup as FormBuilderCondition)
      }

      // Array of conditions (AND logic)
      if (Array.isArray(conditionOrGroup)) {
        return conditionOrGroup.every((c) => checkConditionItem(c))
      }

      // Condition group with operator
      if ('conditions' in conditionOrGroup) {
        const group = conditionOrGroup as FormBuilderConditionGroup
        const operator = group.operator || 'and'

        if (operator === 'or') {
          return group.conditions.some((c) => checkConditionItem(c))
        }
        // Default: AND
        return group.conditions.every((c) => checkConditionItem(c))
      }

      return true
    }

    function checkCondition(field: FormBuilderElement): boolean {
      // Check show condition
      if (field.condition) {
        const showResult = checkConditionGroup(field.condition)
        if (!showResult) return false
      }

      // Check hide condition (opposite logic - hide when condition is met)
      if (field.hideCondition) {
        const hideResult = checkConditionGroup(field.hideCondition)
        if (hideResult) return false
      }

      return true
    }

    const groupCollapseState = ref<Record<string, boolean>>({})

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

    const toggleGroup = (groupKey: string) => {
      const currentState = groupCollapseState.value[groupKey]
      groupCollapseState.value = {
        ...groupCollapseState.value,
        [groupKey]: currentState === undefined ? false : !currentState,
      }
    }

    const isGroupCollapsed = (groupKey: string, defaultCollapsed = true) => {
      return groupCollapseState.value[groupKey] ?? defaultCollapsed
    }

    const getGroupInfo = (category: string) => {
      const fields = formElementsCategorized.value[category] || []
      const groups: Record<
        string,
        {
          fields: FormBuilderElement[]
          collapsible: boolean
          label?: string
          defaultCollapsed: boolean
        }
      > = {}

      for (const field of fields) {
        if (field.group) {
          if (!groups[field.group]) {
            groups[field.group] = {
              fields: [],
              collapsible: field.groupCollapsible ?? false,
              label: field.groupLabel,
              defaultCollapsed: field.groupDefaultCollapsed ?? true,
            }
          }
          groups[field.group].fields.push(field)
        }
      }

      return groups
    }

    const validators = computed(() => {
      const validatorsObject: Record<string, any> = {}
      for (const field of unref(formSchema) || []) {
        if (!field.model) continue

        if (field.validators && checkCondition(field)) {
          validatorsObject[field.model] = field.validators
            .map((validator: FormBuilderValidator) => {
              switch (validator.type) {
                case FormBuilderValidatorType.Required:
                  return {
                    required: true,
                    message: validator.message || 'This field is required',
                  }

                case FormBuilderValidatorType.Regex:
                  return {
                    pattern: new RegExp(validator.pattern, validator.flags),
                    message: validator.message || 'Invalid format',
                  }

                case FormBuilderValidatorType.MinValue:
                  return {
                    type: 'number',
                    min: validator.value,
                    message: validator.message || `Value must be at least ${validator.value}`,
                  }

                case FormBuilderValidatorType.MaxValue:
                  return {
                    type: 'number',
                    max: validator.value,
                    message: validator.message || `Value must be at most ${validator.value}`,
                  }

                case FormBuilderValidatorType.MinLength:
                  return {
                    min: validator.value,
                    message: validator.message || `Must be at least ${validator.value} characters`,
                  }

                case FormBuilderValidatorType.MaxLength:
                  return {
                    max: validator.value,
                    message: validator.message || `Must be at most ${validator.value} characters`,
                  }

                case FormBuilderValidatorType.Email:
                  return {
                    type: 'email',
                    message: validator.message || 'Please enter a valid email address',
                  }

                case FormBuilderValidatorType.Url:
                  return {
                    type: 'url',
                    message: validator.message || 'Please enter a valid URL',
                  }
                case FormBuilderValidatorType.Custom:
                  if (!ncIsFunction((validator as CustomFormBuilderValidator).validator)) {
                    return null
                  }
                  return {
                    validator: (validator as CustomFormBuilderValidator).validator,
                  }

                default:
                  return null
              }
            })
            .filter((v: any) => v !== null)
        }
      }

      return validatorsObject
    })

    const { validate, clearValidate, validateInfos } = useForm(formState, validators)

    const submit = async () => {
      if (unref(disabled)) return
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

    // Flag to prevent onChange during programmatic updates
    const isUpdatingProgrammatically = ref(false)

    // reset test status on config change
    watch(
      formState,
      () => {
        if (unref(disabled)) return
        // Don't trigger onChange during programmatic updates (e.g., formSchema changes)
        if (!isUpdatingProgrammatically.value) {
          onChange?.()
        }

        isChanged.value = checkDifference()
      },
      { deep: true },
    )

    watch(
      () => unref(formSchema),
      async () => {
        isLoading.value = true
        isUpdatingProgrammatically.value = true

        formState.value = {
          ...formState.value,
          ...defaultFormState(),
          ...(initialState?.value ?? {}),
        }

        nextTick(clearValidate)

        isLoading.value = false

        setupDependencyWatchers()

        // Allow onChange to fire again after next tick
        await nextTick()
        isUpdatingProgrammatically.value = false
      },
      { immediate: true },
    )

    onBeforeUnmount(() => {
      dependencyWatcherCleanups.forEach((cleanup) => cleanup())
      dependencyWatcherCleanups.length = 0
    })

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
      getFieldOptions,
      getIsLoadingFieldOptions,
      toggleGroup,
      isGroupCollapsed,
      getGroupInfo,
      disabled,
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
