import rfdc from 'rfdc'
import type { ColumnReqType, ColumnType, TableType } from 'nocodb-sdk'
import { ButtonActionsType, UITypes, isAIPromptCol, isLinksOrLTAR, isSystemColumn } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import { generateUniqueColumnName } from '~/helpers/parsers/parserHelpers'

const clone = rfdc()

const useForm = Form.useForm

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

interface ValidationsObj {
  [key: string]: RuleObject[]
}

const [useProvideColumnCreateStore, useColumnCreateStore] = createInjectionState(
  (
    meta: Ref<TableType | undefined>,
    column: Ref<ColumnType | undefined>,
    tableExplorerColumns?: Ref<ColumnType[] | undefined>,
    fromTableExplorer?: Ref<boolean | undefined>,
    isColumnValid?: Ref<((value: Partial<ColumnType>) => boolean) | undefined>,
    fromKanbanStack?: Ref<boolean | undefined>,
  ) => {
    const baseStore = useBase()

    const { isMysql: isMysqlFunc, isPg: isPgFunc, isMssql: isMssqlFunc, isXcdbBase: isXcdbBaseFunc } = baseStore

    const { sqlUis } = storeToRefs(baseStore)

    const { $api } = useNuxtApp()

    const { getMeta } = useMetas()

    const { isMetaReadOnly } = useRoles()

    const { t } = useI18n()

    const { $e } = useNuxtApp()

    const sqlUi = ref(meta.value?.source_id ? sqlUis.value[meta.value?.source_id] : Object.values(sqlUis.value)[0])

    const viewsStore = useViewsStore()

    const { activeView } = storeToRefs(viewsStore)

    const { xWhere, view } = useSmartsheetStoreOrThrow()

    const { formattedData, loadData } = useViewData(meta, view, xWhere)

    const { isAiModeFieldModal, activeTabSelectedFields } = usePredictFields(ref(false))

    const disableSubmitBtn = ref(false)

    const isWebhookCreateModalOpen = ref(false)

    const isScriptCreateModalOpen = ref(false)

    const isAiButtonConfigModalOpen = ref(false)

    const isEdit = computed(() => !!column?.value?.id)

    const isMysql = computed(() => isMysqlFunc(meta.value?.source_id ? meta.value?.source_id : Object.keys(sqlUis.value)[0]))

    const isPg = computed(() => isPgFunc(meta.value?.source_id ? meta.value?.source_id : Object.keys(sqlUis.value)[0]))

    const isMssql = computed(() => isMssqlFunc(meta.value?.source_id ? meta.value?.source_id : Object.keys(sqlUis.value)[0]))

    const isSystem = computed(() => isSystemColumn(column.value))

    const isXcdbBase = computed(() =>
      isXcdbBaseFunc(meta.value?.source_id ? meta.value?.source_id : Object.keys(sqlUis.value)[0]),
    )

    let postSaveOrUpdateCbk:
      | ((params: { update?: boolean; colId: string; column?: ColumnType | undefined }) => Promise<void>)
      | null

    const idType = null

    const additionalValidations = ref<ValidationsObj>({})

    const setAdditionalValidations = (validations: ValidationsObj) => {
      additionalValidations.value = { ...additionalValidations.value, ...validations }
    }

    const removeAdditionalValidation = (key: string) => {
      delete additionalValidations.value[key]
    }

    const setPostSaveOrUpdateCbk = (cbk: typeof postSaveOrUpdateCbk) => {
      postSaveOrUpdateCbk = cbk
    }

    const defaultType = isMetaReadOnly.value ? UITypes.Formula : UITypes.SingleLineText

    const defaultFormState = {
      title: '',
      description: '',
      uidt: null,
      custom: {},
    }

    const formState = ref<Record<string, any>>({
      ...defaultFormState,
      uidt: fromTableExplorer?.value ? defaultType : null,
      ...clone(column.value || {}),
    })

    const isAiMode = computed(() => {
      if (formState.value.uidt === UITypes.Button && formState.value.type === ButtonActionsType.Ai) {
        return true
      }

      if (isAIPromptCol(formState.value)) {
        return true
      }

      return false
    })

    const onUidtOrIdTypeChange = (preload?: Record<string, any>) => {
      disableSubmitBtn.value = false

      const newTitle = updateFieldName(false)

      const colProp = sqlUi.value.getDataTypeForUiType(formState.value as { uidt: UITypes }, idType ?? undefined)
      formState.value = {
        ...(fromTableExplorer?.value || formState.value?.is_ai_field || formState.value?.ai_temp_id
          ? {
              is_ai_field: formState.value?.is_ai_field,
              ai_temp_id: formState.value?.ai_temp_id,
              view_id: formState.value?.view_id,
              description: formState.value?.description,
            }
          : {}),
        custom: {},
        ...(!isEdit.value && {
          // only take title, column_name and uidt when creating a column
          // to avoid the extra props from being taken (e.g. SingleLineText -> LTAR -> SingleLineText)
          // to mess up the column creation
          title: newTitle || formState.value.title,
          column_name: newTitle || formState.value.column_name,
          uidt: formState.value.uidt,
          temp_id: formState.value.temp_id,
          userHasChangedTitle: !!formState.value?.userHasChangedTitle,
        }),
        ...(isEdit.value && {
          // take the existing formState.value when editing a column
          // LTAR is not available in this case
          ...formState.value,
        }),
        meta: {},
        rqd: false,
        pk: false,
        ai: false,
        cdf: null,
        un: false,
        dtx: 'specificType',
        ...colProp,
      }

      if (preload) {
        formState.value = { ...formState.value, ...preload }
      }

      formState.value.dtxp = sqlUi.value.getDefaultLengthForDatatype(formState.value.dt)
      formState.value.dtxs = sqlUi.value.getDefaultScaleForDatatype(formState.value.dt)

      const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
      if (column && selectTypes.includes(formState.value.uidt) && selectTypes.includes(column.value?.uidt as UITypes)) {
        formState.value.dtxp = column.value?.dtxp
      }

      if (columnToValidate.includes(formState.value.uidt)) {
        formState.value.meta = {
          validate: formState.value.meta && formState.value.meta.validate,
        }
      }

      // keep length and scale for same datatype
      if (column.value && formState.value.uidt === column.value?.uidt) {
        formState.value.dtxp = column.value.dtxp
        formState.value.dtxs = column.value.dtxs
      } else {
        // default length and scale for currency
        if (formState.value?.uidt === UITypes.Currency) {
          formState.value.dtxp = 19
          formState.value.dtxs = 2
        }
      }

      formState.value.altered = formState.value.altered || 2
    }

    // actions
    const generateNewColumnMeta = (ignoreUidt = false) => {
      setAdditionalValidations({})
      formState.value = {
        meta: {},
        ...sqlUi.value.getNewColumn(1),
      }
      formState.value.title = ''
      formState.value.column_name = ''

      if (isMetaReadOnly.value) {
        formState.value.uidt = defaultType
        onUidtOrIdTypeChange()
      }
      if (ignoreUidt && !fromTableExplorer?.value) {
        formState.value.uidt = null
      }
    }

    const validators = computed(() => {
      return {
        title: [
          ...(isEdit.value
            ? [
                {
                  required: true,
                  message: t('msg.error.columnNameRequired'),
                },
              ]
            : []),
          // validation for unique column name
          {
            validator: (rule: any, value: any) => {
              return new Promise<void>((resolve, reject) => {
                if (
                  value !== '' &&
                  (tableExplorerColumns?.value || meta.value?.columns)?.some(
                    (c) =>
                      c.id !== formState.value.id && // ignore current column
                      // compare against column_name and title
                      ((value || '').toLowerCase() === (c.column_name || '').toLowerCase() ||
                        (value || '').toLowerCase() === (c.title || '').toLowerCase()) &&
                      c.system,
                  )
                ) {
                  return reject(new Error(t('msg.error.duplicateSystemColumnName')))
                }

                const isAiFieldExist = isAiModeFieldModal.value
                  ? activeTabSelectedFields.value.some((c) => {
                      return (
                        c.ai_temp_id !== formState.value?.ai_temp_id &&
                        ((value || '').toLowerCase().trim() === (c.formState?.column_name || '').toLowerCase().trim() ||
                          (value || '').toLowerCase().trim() === (c.formState?.title || '').toLowerCase().trim() ||
                          (value || '').toLowerCase().trim() === (c?.title || '').toLowerCase().trim())
                      )
                    })
                  : false

                if (
                  value !== '' &&
                  ((tableExplorerColumns?.value || meta.value?.columns)?.some(
                    (c) =>
                      c.id !== formState.value.id && // ignore current column
                      // compare against column_name and title
                      ((value || '').toLowerCase() === (c.column_name || '').toLowerCase() ||
                        (value || '').toLowerCase() === (c.title || '').toLowerCase()),
                  ) ||
                    isAiFieldExist)
                ) {
                  return reject(new Error(t('msg.error.duplicateColumnName')))
                }
                resolve()
              })
            },
          },
          fieldLengthValidator(),
        ],
        uidt: [
          {
            required: true,
            message: t('msg.error.uiDataTypeRequired'),
          },
        ],
        ...(additionalValidations?.value || {}),
      }
    })

    const { resetFields, validate, validateInfos } = useForm(formState, validators)

    const onDataTypeChange = () => {
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

      // use enum response as dtxp for select columns
      const selectTypes = [UITypes.MultiSelect, UITypes.SingleSelect]
      if (column.value && selectTypes.includes(formState.value.uidt) && selectTypes.includes(column.value.uidt as UITypes)) {
        formState.value.dtxp = column.value.dtxp
      }

      // keep length and scale for same datatype
      if (column.value && formState.value.uidt === column.value?.uidt) {
        formState.value.dtxp = column.value.dtxp
        formState.value.dtxs = column.value.dtxs
      } else {
        // default length and scale for currency
        if (formState.value?.uidt === UITypes.Currency) {
          formState.value.dtxp = 19
          formState.value.dtxs = 2
        }
      }

      // this.$set(formState.value, 'uidt', sqlUi.value.getUIType(formState.value));

      formState.value.altered = formState.value.altered || 2
    }

    // todo: type of onAlter is wrong, the first argument is `CheckboxChangeEvent` not a number.
    const onAlter = (val = 2, cdf = false) => {
      formState.value.altered = formState.value.altered || val
      if (cdf) formState.value.cdf = formState.value.cdf || null
    }

    const addOrUpdate = async (
      onSuccess: (col?: ColumnType) => Promise<void>,
      columnPosition?: Pick<ColumnReqType, 'column_order'>,
    ) => {
      try {
        if (!(await validate())) return
      } catch (e: any) {
        const errorMsgs = e.errorFields
          ?.map((e: any) => e.errors?.join(', '))
          .filter(Boolean)
          .join(', ')

        if (errorMsgs) {
          message.error(errorMsgs)
          return
        }

        if (!fromKanbanStack?.value || (fromKanbanStack.value && !e.outOfDate)) {
          message.error(t('msg.error.formValidationFailed'))
          return
        }
      }

      let savedColumn: ColumnType | undefined

      try {
        formState.value.table_name = meta.value?.table_name

        const refModelId = formState.value.custom?.ref_model_id

        // formState.value.title = formState.value.column_name
        if (column.value) {
          // reset column validation if column is not to be validated
          if (!columnToValidate.includes(formState.value.uidt)) {
            formState.value.validate = ''
          }

          // ignore filters from payload since it's not required
          const { filters: _, ...updateData } = formState.value

          try {
            await $api.dbTableColumn.update(column.value?.id as string, updateData)
          } catch (e: any) {
            if (!validateInfos.formula_raw) validateInfos.formula_raw = {}
            validateInfos.formula_raw!.validateStatus = 'error'
            if (!validateInfos.formula_raw?.help) {
              validateInfos.formula_raw!.help = []
            }
            validateInfos.formula_raw?.help.push(await extractSdkResponseErrorMsg(e))
            return
          }

          await postSaveOrUpdateCbk?.({ update: true, colId: column.value?.id })

          if (meta.value?.id && column.value.uidt === UITypes.Attachment && column.value.uidt !== formState.value.uidt) {
            viewsStore.updateViewCoverImageColumnId({
              metaId: meta.value.id as string,
              columnIds: new Set([column.value.id as string]),
            })
          }

          // Column updated
          // message.success(t('msg.success.columnUpdated'))
        } else {
          // set default field title
          if (!formState.value.title.trim()) {
            const columnName = generateUniqueColumnName({
              formState: formState.value,
              tableExplorerColumns: tableExplorerColumns?.value,
              metaColumns: meta.value?.columns || [],
            })
            formState.value.title = columnName
            formState.value.column_name = columnName
          }
          // todo : set additional meta for auto generated string id
          if (formState.value.uidt === UITypes.ID) {
            // based on id column type set autogenerated meta prop
            // if (isAutoGenId) {
            //   this.newColumn.meta = {
            //     ag: 'nc',
            //   };
            // }
          }
          const tableMeta = await $api.dbTableColumn.create(meta.value?.id as string, {
            ...formState.value,
            ...columnPosition,
            view_id: activeView.value!.id as string,
          })

          savedColumn = tableMeta.columns?.find(
            (c) => c.title === formState.value.title || c.column_name === formState.value.column_name,
          )

          await postSaveOrUpdateCbk?.({ update: false, colId: savedColumn?.id as string, column: savedColumn })

          /** if LTAR column then force reload related table meta */
          if (isLinksOrLTAR(formState.value) && meta.value?.id !== formState.value.childId) {
            if (refModelId) {
              getMeta(refModelId, true).then(() => {})
            } else {
              getMeta(formState.value.childId, true).then(() => {})
            }
          }

          // Column created
          // message.success(t('msg.success.columnCreated'))

          $e('a:column:add', { datatype: formState.value.uidt })
        }
        await onSuccess?.(savedColumn)
        return true
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
      }
    }

    function updateFieldName(updateFormState = true) {
      if (
        formState.value?.is_ai_field ||
        isEdit.value ||
        !fromTableExplorer?.value ||
        formState.value?.userHasChangedTitle ||
        !isColumnValid?.value?.(formState.value)
      ) {
        return
      }

      const defaultColumnName = generateUniqueColumnName({
        formState: formState.value,
        tableExplorerColumns: tableExplorerColumns?.value || [],
        metaColumns: meta.value?.columns || [],
      })

      if (updateFormState) {
        formState.value.title = defaultColumnName
        formState.value.column_name = defaultColumnName
      } else {
        return defaultColumnName
      }
    }

    /** set column name same as title which is actual name in db */
    watch(
      () => formState.value?.title,
      (newTitle) => (formState.value.column_name = newTitle),
    )

    return {
      formState,
      generateNewColumnMeta,
      addOrUpdate,
      onAlter,
      onDataTypeChange,
      onUidtOrIdTypeChange,
      setAdditionalValidations,
      removeAdditionalValidation,
      resetFields,
      validate,
      validateInfos,
      isEdit,
      column,
      sqlUi,
      isMssql,
      isPg,
      isWebhookCreateModalOpen,
      isAiButtonConfigModalOpen,
      isMysql,
      isSystem,
      isXcdbBase,
      disableSubmitBtn,
      setPostSaveOrUpdateCbk,
      updateFieldName,
      fromTableExplorer,
      isAiMode,
      formattedData,
      loadData,
      tableExplorerColumns,
      defaultFormState,
      isScriptCreateModalOpen,
    }
  },
)

export { useProvideColumnCreateStore }

export function useColumnCreateStoreOrThrow() {
  const columnCreateStore = useColumnCreateStore()

  if (columnCreateStore == null) throw new Error('Please call `useProvideColumnCreateStore` on the appropriate parent component')

  return columnCreateStore
}
