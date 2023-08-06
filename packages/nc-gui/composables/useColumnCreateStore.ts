import rfdc from 'rfdc'
import type { ColumnReqType, ColumnType, TableType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { Ref } from 'vue'
import type { RuleObject } from 'ant-design-vue/es/form'
import {
  Form,
  computed,
  createInjectionState,
  extractSdkResponseErrorMsg,
  message,
  ref,
  storeToRefs,
  useI18n,
  useMetas,
  useNuxtApp,
  useProject,
  watch,
} from '#imports'

const clone = rfdc()

const useForm = Form.useForm

const columnToValidate = [UITypes.Email, UITypes.URL, UITypes.PhoneNumber]

interface ValidationsObj {
  [key: string]: RuleObject[]
}

const [useProvideColumnCreateStore, useColumnCreateStore] = createInjectionState(
  (meta: Ref<TableType | undefined>, column: Ref<ColumnType | undefined>) => {
    const projectStore = useProject()
    const { isMysql: isMysqlFunc, isPg: isPgFunc, isMssql: isMssqlFunc, isXcdbBase: isXcdbBaseFunc } = projectStore
    const { project, sqlUis } = storeToRefs(projectStore)

    const { $api } = useNuxtApp()

    const { getMeta } = useMetas()

    const { t } = useI18n()

    const { $e } = useNuxtApp()

    const sqlUi = ref(meta.value?.base_id ? sqlUis.value[meta.value?.base_id] : Object.values(sqlUis.value)[0])

    const isEdit = computed(() => !!column?.value?.id)

    const isMysql = computed(() => isMysqlFunc(meta.value?.base_id ? meta.value?.base_id : Object.keys(sqlUis.value)[0]))

    const isPg = computed(() => isPgFunc(meta.value?.base_id ? meta.value?.base_id : Object.keys(sqlUis.value)[0]))

    const isMssql = computed(() => isMssqlFunc(meta.value?.base_id ? meta.value?.base_id : Object.keys(sqlUis.value)[0]))

    const isXcdbBase = computed(() => isXcdbBaseFunc(meta.value?.base_id ? meta.value?.base_id : Object.keys(sqlUis.value)[0]))

    const idType = null

    const additionalValidations = ref<ValidationsObj>({})

    const setAdditionalValidations = (validations: ValidationsObj) => {
      additionalValidations.value = { ...additionalValidations.value, ...validations }
    }

    const formState = ref<Record<string, any>>({
      title: 'title',
      uidt: UITypes.SingleLineText,
      ...clone(column.value || {}),
    })

    // actions
    const generateNewColumnMeta = () => {
      setAdditionalValidations({})
      formState.value = { meta: {}, ...sqlUi.value.getNewColumn((meta.value?.columns?.length || 0) + 1) }
      formState.value.title = formState.value.column_name
    }

    const validators = computed(() => {
      return {
        title: [
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
          {
            validator: (rule: any, value: any) => {
              if (/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
                return Promise.reject(new Error('Special characters are not allowed in the column name.'))
              }
              return Promise.resolve()
            },
          },
          fieldLengthValidator(project.value?.bases?.[0].type || ClientType.MYSQL),
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

    const onUidtOrIdTypeChange = () => {
      const colProp = sqlUi.value.getDataTypeForUiType(formState.value as { uidt: UITypes }, idType ?? undefined)
      formState.value = {
        ...(!isEdit.value && {
          // only take title, column_name and uidt when creating a column
          // to avoid the extra props from being taken (e.g. SingleLineText -> LTAR -> SingleLineText)
          // to mess up the column creation
          title: formState.value.title,
          column_name: formState.value.column_name,
          uidt: formState.value.uidt,
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

    const addOrUpdate = async (onSuccess: () => void, columnPosition?: Pick<ColumnReqType, 'column_order'>) => {
      try {
        if (!(await validate())) return
      } catch (e: any) {
        const errorMsgs = e.errorFields
          ?.map((e: any) => e.errors?.join(', '))
          .filter(Boolean)
          .join(', ')
        if (errorMsgs) {
          message.error(errorMsgs)
        } else {
          message.error(t('msg.error.formValidationFailed'))
        }
        return
      }

      try {
        formState.value.table_name = meta.value?.table_name
        // formState.value.title = formState.value.column_name
        if (column.value) {
          // reset column validation if column is not to be validated
          if (!columnToValidate.includes(formState.value.uidt)) {
            formState.value.validate = ''
          }
          await $api.dbTableColumn.update(column.value?.id as string, formState.value)
          // Column updated
          message.success(t('msg.success.columnUpdated'))
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
          await $api.dbTableColumn.create(meta.value?.id as string, { ...formState.value, ...columnPosition })

          /** if LTAR column then force reload related table meta */
          if (formState.value.uidt === UITypes.LinkToAnotherRecord && meta.value?.id !== formState.value.childId) {
            getMeta(formState.value.childId, true).then(() => {})
          }

          // Column created
          message.success(t('msg.success.columnCreated'))

          $e('a:column:add', { datatype: formState.value.uidt })
        }
        onSuccess?.()
        return true
      } catch (e: any) {
        message.error(await extractSdkResponseErrorMsg(e))
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
      resetFields,
      validate,
      validateInfos,
      isEdit,
      column,
      sqlUi,
      isMssql,
      isPg,
      isMysql,
      isXcdbBase,
    }
  },
)

export { useProvideColumnCreateStore }

export function useColumnCreateStoreOrThrow() {
  const columnCreateStore = useColumnCreateStore()

  if (columnCreateStore == null) throw new Error('Please call `useProvideColumnCreateStore` on the appropriate parent component')

  return columnCreateStore
}
