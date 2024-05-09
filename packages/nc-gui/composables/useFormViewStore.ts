import type { Ref } from 'vue'
import type { ColumnType, FormType, TableType, ViewType } from 'nocodb-sdk'
import { RelationTypes, isLinksOrLTAR } from 'nocodb-sdk'

import { computed, createEventHook, extractSdkResponseErrorMsg, message, ref, useInjectionState } from '#imports'
import useVuelidate from '@vuelidate/core'
import { maxValue, minValue } from '@vuelidate/validators'

const [useProvideFormViewStore, useFormViewStore] = useInjectionState(
  (
    _meta: Ref<TableType | undefined> | ComputedRef<TableType | undefined>,
    viewMeta: Ref<ViewType | undefined> | ComputedRef<(ViewType & { id: string }) | undefined>,
    formViewData: Ref<FormType | undefined>,
    updateFormView: (view: FormType | undefined) => Promise<any>,
    isEditable: boolean,
  ) => {
    const { $api } = useNuxtApp()

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

    // Initialize form data object with nested objects for each item
    const visibleColumnsMap = computed(() =>
      visibleColumns.value.reduce((acc, col) => {
        acc[col.id] = col
        return acc
      }, {} as Record<string, ColumnType>),
    )

    // Define validation rules for each item's validators
    const rules = computed(() =>
      visibleColumns.value.reduce((acc, c) => {
        const itemRules = c.meta.validators.reduce((valAcc, validator) => {
          if (validator.type === 'min') {
            valAcc[validator.type] = { minValue: c.required ? minValue(1) : true }
          } else if (validator.type === 'max') {
            acc[validator.type] = { maxValue: maxValue(validator.value) }
            const minValidator = c.meta.validators.find((v) => v.type === 'min')
            if (minValidator && minValidator.value < validator.value) {
              acc[
                validator.type
              ].message = `Max value (${validator.value}) should be greater than min value (${minValidator.value}).`
            }
          } else if (validator.type === 'fileTypes' || validator.type === 'fileCount' || validator.type === 'fileSize') {
            // Define validation rules for file-related validators if needed
          }
          return valAcc
        }, {})
        acc[c.id] = itemRules
        return acc
      }, {}),
    )

    // Use Vuelidate to create validation instance
    const v$ = useVuelidate(
      rules,
      computed(() => ({ visibleColumnsMap: visibleColumnsMap.value })),
    )

    watchEffect(() => {
      console.log('fdas', activeField.value, rules.value)
    })

    const updateView = useDebounceFn(
      () => {
        updateFormView(formViewData.value)
      },
      300,
      { maxWait: 2000 },
    )

    const updateColMeta = useDebounceFn(async (col: Record<string, any>) => {
      if (col.id && isEditable) {
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
      v$,
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
