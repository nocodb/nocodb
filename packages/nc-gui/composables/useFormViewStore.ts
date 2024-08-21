import type { Ref } from 'vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import type { ColumnType, FormType, TableType, ViewType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR } from 'nocodb-sdk'
import type { ValidateInfo } from 'ant-design-vue/es/form/useForm'

const useForm = Form.useForm

const [useProvideFormViewStore, useFormViewStore] = useInjectionState(
  (
    _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
    formViewData: Ref<FormType | undefined>,
    updateFormView: (view: FormType | undefined) => Promise<any>,
    isEditable: boolean,
  ) => {
    const { $api } = useNuxtApp()

    const { t } = useI18n()

    const formResetHook = createEventHook<void>()

    const formState = ref<Record<string, any>>({})

    const localColumns = ref<Record<string, any>[]>([])

    const activeRow = ref('')

    const visibleColumns = computed(() => localColumns.value.filter((f) => f.show).sort((a, b) => a.order - b.order))

    const activeField = computed(() => visibleColumns.value.find((c) => c.id === activeRow.value) || null)

    const activeColumn = computed(() => {
      if (_meta.value && activeField.value) {
        if (_meta.value.columnsById && (_meta.value.columnsById as Record<string, ColumnType>)[activeField.value?.fk_column_id]) {
          return (_meta.value.columnsById as Record<string, ColumnType>)[activeField.value.fk_column_id]
        } else if (_meta.value.columns) {
          return _meta.value.columns.find((c) => c.id === activeField.value?.fk_column_id) ?? null
        }
      }
      return null
    })

    const fieldMappings = computed(() => {
      const uniqueFieldNames: Set<string> = new Set()

      return visibleColumns.value.reduce((acc, c) => {
        acc[c.title] = getValidFieldName(c.title, uniqueFieldNames)
        return acc
      }, {} as Record<string, string>)
    })

    const validators = computed(() => {
      const rulesObj: Record<string, RuleObject[]> = {}

      if (!visibleColumns.value || !Object.keys(fieldMappings.value).length) return rulesObj

      for (const column of visibleColumns.value) {
        let rules: RuleObject[] = [
          {
            validator: (_rule: RuleObject, value: any) => {
              return new Promise((resolve, reject) => {
                if (isRequired(column, column.required)) {
                  if (typeof value === 'string') {
                    value = value.trim()
                  }

                  if (
                    (column.uidt === UITypes.Checkbox && !value) ||
                    (column.uidt !== UITypes.Checkbox && !requiredFieldValidatorFn(value))
                  ) {
                    return reject(t('msg.error.fieldRequired'))
                  }
                }

                return resolve()
              })
            },
          },
        ]

        const additionalRules = extractFieldValidator(parseProp(column.meta).validators ?? [], column)
        rules = [...rules, ...additionalRules]

        if (rules.length) {
          rulesObj[fieldMappings.value[column.title!]] = rules
        }
      }

      return rulesObj
    })

    const fieldMappingFormState = computed(() => {
      if (!Object.keys(fieldMappings.value).length) return {}

      return Object.keys(formState.value).reduce((acc, key) => {
        acc[fieldMappings.value[key]] = formState.value[key]
        return acc
      }, {} as Record<string, any>)
    })

    // Form field validation
    const { validate, validateInfos, clearValidate } = useForm(fieldMappingFormState, validators)

    const validateActiveField = async (col: ColumnType) => {
      if (!col.title) return

      if (fieldMappings.value[col.title] === undefined) {
        console.warn('Missing mapping field for:', col.title)
        return
      }

      try {
        await validate(fieldMappings.value[col.title])
      } catch {}
    }

    const isValidRedirectUrl = (): ValidateInfo => {
      if (typeof formViewData.value?.redirect_url !== 'string') return { validateStatus: '', help: undefined }

      const url = formViewData.value?.redirect_url?.trim() ?? ''

      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return {
          validateStatus: 'error',
          help: 'Redirect url must starts with `http://` or `https://`',
        }
      }

      return { validateStatus: '', help: undefined }
    }

    const updateView = useDebounceFn(
      () => {
        if (isValidRedirectUrl().validateStatus === 'error') {
          formViewData.value = {
            ...formViewData.value,
            redirect_url: '',
          }
        }

        updateFormView(formViewData.value)
      },
      300,
      { maxWait: 2000 },
    )

    const updateColMeta = useDebounceFn(async (col: Record<string, any>) => {
      if (col.id && isEditable) {
        validateActiveField(col)

        try {
          await $api.dbView.formColumnUpdate(col.id, col)
        } catch (e: any) {
          message.error(await extractSdkResponseErrorMsg(e))
        }
      }
    }, 250)

    function isRequired(_columnObj: Record<string, any>, required = false) {
      let columnObj = _columnObj
      if (isLinksOrLTAR(columnObj.uidt) && columnObj.colOptions && columnObj.colOptions.type === RelationTypes.BELONGS_TO) {
        columnObj = (_meta?.value?.columns || []).find(
          (c: Record<string, any>) => c.id === columnObj.colOptions.fk_child_column_id,
        ) as Record<string, any>
      }

      return required || (columnObj && columnObj.rqd && !columnObj.cdf)
    }

    return {
      onReset: formResetHook.on,
      formState,
      localColumns,
      visibleColumns,
      activeRow,
      activeField,
      activeColumn,
      isRequired,
      updateView,
      updateColMeta,
      validate,
      validateInfos,
      clearValidate,
      fieldMappings,
      isValidRedirectUrl,
      formViewData,
    }
  },
  'form-view-store',
)

export { useProvideFormViewStore }

export function useFormViewStoreOrThrow() {
  const sharedFormStore = useFormViewStore()

  if (sharedFormStore == null) throw new Error('Please call `useProvideFormViewStore` on the appropriate parent component')

  return sharedFormStore
}
