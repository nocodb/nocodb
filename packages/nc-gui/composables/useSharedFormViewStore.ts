import dayjs from 'dayjs'
import type {
  BoolType,
  ColumnType,
  FilterType,
  FormColumnType,
  FormType,
  LinkToAnotherRecordType,
  SelectOptionsType,
  StringOrNullType,
  TableType,
} from 'nocodb-sdk'
import { RelationTypes, UITypes, isLinksOrLTAR, isSystemColumn, isVirtualCol } from 'nocodb-sdk'
import { isString } from '@vue/shared'
import { useTitle } from '@vueuse/core'
import type { RuleObject } from 'ant-design-vue/es/form'
import { filterNullOrUndefinedObjectProperties } from '~/helpers/parsers/parserHelpers'

const useForm = Form.useForm

const [useProvideSharedFormStore, useSharedFormStore] = useInjectionState((sharedViewId: string) => {
  const progress = ref(false)
  const notFound = ref(false)
  const submitted = ref(false)
  const passwordDlg = ref(false)
  const password = ref<string | null>(null)
  const passwordError = ref<string | null>(null)
  const secondsRemain = ref(0)

  const { sharedView } = storeToRefs(useViewsStore())

  provide(SharedViewPasswordInj, password)

  const sharedFormView = ref<FormType>()
  const meta = ref<TableType>()
  const columns = ref<
    (ColumnType & {
      required?: BoolType
      show?: BoolType
      label?: StringOrNullType
      enable_scanner?: BoolType
      read_only?: boolean
    })[]
  >()
  const sharedViewMeta = ref<SharedViewMeta>({})
  const formResetHook = createEventHook<void>()

  const { api, isLoading } = useApi()

  const { metas, setMeta, getMeta } = useMetas()

  const baseStore = useBase()
  const { base, sqlUis } = storeToRefs(baseStore)

  const basesStore = useBases()

  const { basesUser } = storeToRefs(basesStore)

  const { t } = useI18n()

  const route = useRoute()

  const formState = ref<Record<string, any>>({})

  const preFilledformState = ref<Record<string, any>>({})

  const preFilledAdditionalState = ref<Record<string, any>>({})

  const preFilledDefaultValueformState = ref<Record<string, any>>({})

  const allViewFilters = ref<Record<string, FilterType[]>>({})

  const isValidRedirectUrl = computed(
    () => typeof sharedFormView.value?.redirect_url === 'string' && !!sharedFormView.value?.redirect_url?.trim(),
  )

  useProvideSmartsheetLtarHelpers(meta)
  const { state: additionalState } = useProvideSmartsheetRowStore(
    ref({
      row: formState,
      rowMeta: { new: true },
      oldRow: {},
    }),
  )

  const localColumns = computed<(ColumnType & Record<string, any>)[]>(() => {
    return (columns.value || [])?.filter((c) => supportedFields(c))
  })

  const localColumnsMapByFkColumnId = computed(() => {
    return localColumns.value.reduce((acc, c) => {
      acc[c.fk_column_id] = c

      return acc
    }, {} as Record<string, ColumnType & Record<string, any>>)
  })

  const fieldVisibilityValidator = computed(() => {
    return new FormFilters({
      nestedGroupedFilters: allViewFilters.value,
      formViewColumns: localColumns.value,
      formViewColumnsMapByFkColumnId: localColumnsMapByFkColumnId.value,
      formState: { ...(formState.value || {}), ...(additionalState.value || {}) },
      isSharedForm: true,
      isMysql: (_sourceId?: string) => {
        return ['mysql', ClientType.MYSQL].includes(sharedView.value?.client || ClientType.MYSQL)
      },
      getMeta,
    })
  })

  const formColumns = computed(
    () =>
      columns.value?.filter((col) => {
        const isVisible = col.show

        return isVisible && supportedFields(col)
      }) || [],
  )

  function supportedFields(col: ColumnType) {
    return (
      !isSystemColumn(col) && col.uidt !== UITypes.SpecificDBType && !isAI(col) && (!isVirtualCol(col) || isLinksOrLTAR(col.uidt))
    )
  }

  const loadSharedView = async () => {
    passwordError.value = null

    try {
      const viewMeta = await api.public.sharedViewMetaGet(sharedViewId, {
        headers: {
          'xc-password': password.value,
        },
      })

      passwordDlg.value = false

      sharedView.value = viewMeta
      sharedFormView.value = viewMeta.view
      meta.value = viewMeta.model

      loadAllviewFilters(Array.isArray(viewMeta?.filter?.children) ? viewMeta?.filter?.children : [])

      const fieldById = (viewMeta.columns || []).reduce(
        (o: Record<string, any>, f: Record<string, any>) => ({
          ...o,
          [f.fk_column_id]: f,
        }),
        {} as Record<string, FormColumnType>,
      )

      columns.value = (viewMeta.model?.columns || [])
        .filter((c: ColumnType) => fieldById[c.id])
        .map((c: ColumnType) => {
          if (
            !isSystemColumn(c) &&
            !isVirtualCol(c) &&
            !isAttachment(c) &&
            c.uidt !== UITypes.SpecificDBType &&
            c?.title &&
            isValidValue(c?.cdf) &&
            !/^\w+\(\)|CURRENT_TIMESTAMP$/.test(c.cdf)
          ) {
            const defaultValue = typeof c.cdf === 'string' ? c.cdf.replace(/^'|'$/g, '') : c.cdf
            if ([UITypes.Number, UITypes.Duration, UITypes.Percent, UITypes.Currency, UITypes.Decimal].includes(c.uidt)) {
              formState.value[c.title] = Number(defaultValue) || null
              preFilledDefaultValueformState.value[c.title] = Number(defaultValue) || null
            } else if (c.uidt === UITypes.Checkbox) {
              if (['true', '1'].includes(String(defaultValue).toLowerCase())) {
                formState.value[c.title] = true
                preFilledDefaultValueformState.value[c.title] = true
              } else if (['false', '0'].includes(String(defaultValue).toLowerCase())) {
                formState.value[c.title] = false
                preFilledDefaultValueformState.value[c.title] = false
              }
            } else {
              formState.value[c.title] = defaultValue
              preFilledDefaultValueformState.value[c.title] = defaultValue
            }
          }

          return {
            ...c,
            order: fieldById[c.id].order || c.order,
            visible: true,
            meta: { ...parseProp(fieldById[c.id].meta), ...parseProp(c.meta) },
            description: fieldById[c.id].description,
          }
        })
        .sort((a: ColumnType, b: ColumnType) => (a.order ?? Infinity) - (b.order ?? Infinity))

      const _sharedViewMeta = (viewMeta as any).meta
      sharedViewMeta.value = isString(_sharedViewMeta) ? JSON.parse(_sharedViewMeta) : _sharedViewMeta

      await setMeta(viewMeta.model)

      // if base is not defined then set it with an object containing source
      if (!base.value?.sources)
        baseStore.setProject({
          sources: [
            {
              id: viewMeta.source_id,
              type: viewMeta.client,
            },
          ],
        })

      const relatedMetas = { ...viewMeta.relatedMetas }

      Object.keys(relatedMetas).forEach((key) => setMeta(relatedMetas[key]))

      if (viewMeta.users) {
        basesUser.value.set(viewMeta.base_id, viewMeta.users)
      }

      await handlePreFillForm()

      checkFieldVisibility()
    } catch (e: any) {
      const error = await extractSdkResponseErrorMsgv2(e)

      if (e.response && e.response.status === 404) {
        notFound.value = true
      } else if (error.error === NcErrorType.INVALID_SHARED_VIEW_PASSWORD) {
        passwordDlg.value = true

        if (password.value && password.value !== '') {
          passwordError.value = error.message
        }
      } else if (error.error === NcErrorType.UNKNOWN_ERROR) {
        console.error('Error occurred while loading shared form view', e)
        message.error('Error occurred while loading shared form view')
      }
    }
  }

  const fieldMappings = computed(() => {
    const uniqueFieldNames: Set<string> = new Set()

    return formColumns.value.reduce((acc, c) => {
      acc[c.title!] = getValidFieldName(c.title!, uniqueFieldNames)
      return acc
    }, {} as Record<string, string>)
  })

  const validators = computed(() => {
    const rulesObj: Record<string, RuleObject[]> = {}

    if (!formColumns.value || !Object.keys(fieldMappings.value).length) return rulesObj

    for (const column of formColumns.value) {
      let rules: RuleObject[] = [
        {
          validator: (_rule: RuleObject, value: any) => {
            return new Promise((resolve, reject) => {
              if (isRequired(column) && column.show) {
                if (typeof value === 'string') {
                  value = value.trim()
                }

                if (column.uidt === UITypes.Rating && (!value || Number(value) < 1)) {
                  return reject(t('msg.error.fieldRequired'))
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
        {
          validator: (_rule: RuleObject) => {
            return new Promise((resolve) => {
              checkFieldVisibility()
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

  const validationFieldState = computed(() => {
    if (!Object.keys(fieldMappings.value).length) return {}

    const fieldMappingFormState = Object.keys(formState.value).reduce((acc, key) => {
      acc[fieldMappings.value[key]] = formState.value[key]
      return acc
    }, {} as Record<string, any>)

    const fieldMappingAdditionalState = Object.keys(additionalState.value).reduce((acc, key) => {
      acc[fieldMappings.value[key]] = additionalState.value[key]
      return acc
    }, {} as Record<string, any>)

    return { ...fieldMappingFormState, ...fieldMappingAdditionalState }
  })

  const { validate, validateInfos, clearValidate } = useForm(validationFieldState, validators)

  const handleAddMissingRequiredFieldDefaultState = async () => {
    for (const col of localColumns.value) {
      if (
        col.title &&
        col.show &&
        col.visible &&
        isRequired(col) &&
        formState.value[col.title] === undefined &&
        additionalState.value[col.title] === undefined
      ) {
        if (isVirtualCol(col)) {
          additionalState.value = {
            ...(additionalState.value || {}),
            [col.title]: null,
          }
        } else {
          formState.value[col.title] = null
        }
      }

      // handle filter out conditionally hidden field data
      if (!col.visible && col.title) {
        delete formState.value[col.title]
        delete additionalState.value[col.title]
      }
    }
  }

  const validateAllFields = async () => {
    await handleAddMissingRequiredFieldDefaultState()

    try {
      // filter `undefined` keys which is hidden prefilled fields
      await validate(
        [
          ...Object.keys(formState.value).map((title) => fieldMappings.value[title]),
          ...Object.keys(additionalState.value).map((title) => fieldMappings.value[title]),
        ].filter((v) => v !== undefined),
      )
      return true
    } catch (e: any) {
      console.error('Error occurred while validating all fields:', e)

      if (e?.errorFields?.length) {
        message.error(t('msg.error.someOfTheRequiredFieldsAreEmpty'))
        return false
      }
    }
  }

  const submitForm = async () => {
    try {
      if (!(await validateAllFields())) {
        return
      }

      progress.value = true
      const data: Record<string, any> = { ...formState.value, ...additionalState.value }
      const attachment: Record<string, any> = {}

      /** find attachments in form data */
      for (const col of metas.value?.[sharedView.value?.fk_model_id as string]?.columns) {
        if (col.uidt === UITypes.Attachment) {
          if (data[col.title]) {
            attachment[`_${col.title}`] = data[col.title].map((item: { file: File }) => item.file)
          }
        }
      }

      const filtedData = filterNullOrUndefinedObjectProperties({
        data,
        ...attachment,
      })

      const newRecord = await api.public.dataCreate(sharedView.value!.uuid!, filtedData, {
        headers: {
          'xc-password': password.value,
        },
      })

      const pk = extractPkFromRow(newRecord, meta.value?.columns as ColumnType[])

      if (pk && isValidRedirectUrl.value) {
        const redirectUrl = sharedFormView.value!.redirect_url!.replace('{record_id}', pk)

        // Create an anchor element to parse the URL
        const anchor = document.createElement('a')
        anchor.href = redirectUrl

        // Check if the redirect URL has the same host as the current page
        const isSameHost = anchor.host === window.location.host

        if (isSameHost) {
          // Use pushState for internal links
          window.history.pushState({}, 'Redirect', redirectUrl)
          // Reload the page
          window.location.reload()
        } else {
          // For external links, use window.location.href
          window.location.href = redirectUrl
        }
      } else {
        submitted.value = true
        progress.value = false
      }
    } catch (e: any) {
      console.error(e)
      await message.error(await extractSdkResponseErrorMsg(e))
    }
    progress.value = false
  }

  const clearForm = async () => {
    formResetHook.trigger()
    additionalState.value = {
      ...preFilledAdditionalState.value,
    }

    formState.value = {
      ...preFilledDefaultValueformState.value,
      ...(sharedViewMeta.value.preFillEnabled ? preFilledformState.value : {}),
    }

    clearValidate()
    checkFieldVisibility()
  }

  async function handlePreFillForm() {
    if (Object.keys(route.query || {}).length) {
      columns.value = await Promise.all(
        (columns.value || []).map(async (c) => {
          const queryParam = route.query[c.title as string]

          if (
            !c.title ||
            !queryParam ||
            isSystemColumn(c) ||
            (isVirtualCol(c) && !isLinksOrLTAR(c)) ||
            (!sharedViewMeta.value.preFillEnabled && !isVirtualCol(c) && !isLinksOrLTAR(c)) ||
            isAttachment(c) ||
            c.uidt === UITypes.SpecificDBType
          ) {
            return c
          }
          const decodedQueryParam = Array.isArray(queryParam)
            ? queryParam.map((qp) => decodeURIComponent(qp as string).trim())
            : decodeURIComponent(queryParam as string).trim()

          const preFillValue = await getPreFillValue(c, decodedQueryParam)
          if (preFillValue !== undefined) {
            if (isLinksOrLTAR(c)) {
              // Prefill Link to another record / Links form state
              additionalState.value = {
                ...(additionalState.value || {}),
                [c.title]: preFillValue,
              }
            } else {
              // Prefill form state
              formState.value[c.title] = preFillValue
            }

            if (sharedViewMeta.value.preFillEnabled) {
              // Update column
              switch (sharedViewMeta.value.preFilledMode) {
                case PreFilledMode.Hidden: {
                  c.show = false
                  c.meta = { ...parseProp(c.meta), preFilledHiddenField: true }
                  break
                }
                case PreFilledMode.Locked: {
                  c.read_only = true
                  break
                }
              }
            }
          }

          return c
        }),
      )

      try {
        // preFilledAdditionalState will be used in clear form to fill the prefilled data
        preFilledAdditionalState.value = JSON.parse(JSON.stringify(additionalState.value || {}))

        // preFilledformState will be used in clear form to fill the prefilled data
        preFilledformState.value = JSON.parse(JSON.stringify(formState.value || {}))
      } catch {}
    }
  }

  function getColAbstractType(c: ColumnType) {
    return (c?.source_id ? sqlUis.value[c?.source_id] : Object.values(sqlUis.value)[0])?.getAbstractType(c)
  }

  async function getPreFillValue(c: ColumnType, value: string | string[]) {
    let preFillValue: any
    switch (c.uidt) {
      case UITypes.SingleSelect:
      case UITypes.MultiSelect:
      case UITypes.User: {
        const limitOptions = (parseProp(c.meta).isLimitOption ? parseProp(c.meta).limitOptions || [] : []).reduce((ac, op) => {
          if (op?.id) {
            ac[op.id] = op
          }
          return ac
        }, {})

        const queryOptions = value.split(',')

        let options: string[] = []

        if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(c.uidt as UITypes)) {
          options = ((c.colOptions as SelectOptionsType)?.options || [])
            .filter((op) => {
              if (
                op?.id &&
                op?.title &&
                queryOptions.includes(op.title) &&
                (limitOptions[op.id]
                  ? limitOptions[op.id]?.show
                  : parseProp(c.meta).isLimitOption
                  ? !(parseProp(c.meta).limitOptions || []).length
                  : true)
              ) {
                return true
              }
              return false
            })
            .map((op) => op.title as string)

          if (options.length) {
            preFillValue = c.uidt === UITypes.SingleSelect ? options[0] : options.join(',')
          }
        } else {
          options = (meta.value?.base_id ? basesUser.value.get(meta.value.base_id) || [] : [])
            .filter((user) => {
              if (
                user?.id &&
                user?.email &&
                (queryOptions.includes(user.email) || queryOptions.includes(user.id)) &&
                (limitOptions[user.id]
                  ? limitOptions[user.id]?.show
                  : parseProp(c.meta).isLimitOption
                  ? !(parseProp(c.meta).limitOptions || []).length
                  : true)
              ) {
                return true
              }
              return false
            })
            .map((user) => user.email)

          if (options.length) {
            preFillValue = !parseProp(c.meta)?.is_multi ? options[0] : options.join(',')
          }
        }
        break
      }
      case UITypes.Checkbox: {
        if (['true', true, '1', 1].includes(value.toLowerCase())) {
          preFillValue = true
        } else if (['false', false, '0', 0].includes(value.toLowerCase())) {
          preFillValue = false
        }
        break
      }
      case UITypes.Rating: {
        if (!isNaN(Number(value))) {
          preFillValue = Math.min(Math.max(Number(value), 0), parseProp(c.meta).max ?? 5)
        }
        break
      }
      case UITypes.URL: {
        if (parseProp(c.meta).validate) {
          if (isValidURL(value)) {
            preFillValue = value
          }
        } else {
          preFillValue = value
        }
        break
      }
      case UITypes.Year: {
        if (/^\d+$/.test(value)) {
          preFillValue = Number(value)
        }
        break
      }
      case UITypes.Date: {
        const parsedDate = dayjs(value)
        if ((parsedDate.isValid() && parsedDate.toISOString() === value) || dayjs(value, 'YYYY-MM-DD').isValid()) {
          preFillValue = dayjs(value).format('YYYY-MM-DD')
        }
        break
      }
      case UITypes.DateTime: {
        const parsedDateTime = dayjs(value)

        if (
          (parsedDateTime.isValid() && parsedDateTime.toISOString() === value) ||
          dayjs(value, 'YYYY-MM-DD HH:mm:ss').isValid()
        ) {
          preFillValue = dayjs(value).utc().format('YYYY-MM-DD HH:mm:ssZ')
        }
        break
      }
      case UITypes.Time: {
        let parsedTime = dayjs(value)

        if (!parsedTime.isValid()) {
          parsedTime = dayjs(value, 'HH:mm:ss')
        }
        if (!parsedTime.isValid()) {
          parsedTime = dayjs(`1999-01-01 ${value}`)
        }
        if (parsedTime.isValid()) {
          preFillValue = parsedTime.format(baseStore.isMysql(c.source_id) ? 'YYYY-MM-DD HH:mm:ss' : 'YYYY-MM-DD HH:mm:ssZ')
        }
        break
      }
      case UITypes.LinkToAnotherRecord:
      case UITypes.Links: {
        const values = Array.isArray(value) ? value : value.split(',')
        const rows = await loadLinkedRecords(c, values)

        preFillValue = rows
        // if bt/oo then extract object from array
        if (c.colOptions?.type === RelationTypes.BELONGS_TO || c.colOptions?.type === RelationTypes.ONE_TO_ONE) {
          preFillValue = preFillValue[0]
        }
        // Todo: create an api which will fetch query params records and then autofill records
        break
      }

      default: {
        if (isNumericFieldType(c, getColAbstractType(c))) {
          if (!isNaN(Number(value))) {
            preFillValue = Number(value)
          }
        } else {
          preFillValue = value
        }
      }
    }
    return preFillValue
  }

  async function loadLinkedRecords(column: ColumnType, ids: string[]) {
    const relatedMeta = await getMeta((column.colOptions as LinkToAnotherRecordType)?.fk_related_model_id)
    const pkCol = relatedMeta?.columns?.find((col) => col.pk)
    const pvCol = relatedMeta?.columns?.find((col) => col.pv)

    return (
      await api.public.dataRelationList(
        route.params.viewId as string,
        column.id,
        {},
        {
          headers: {
            'xc-password': password.value,
          },
          query: {
            limit: Math.max(25, ids.length),
            where: `(${pkCol.title},in,${ids.join(',')})`,
            fields: [pkCol.title, pvCol.title],
          },
        },
      )
    )?.list
  }

  let intvl: NodeJS.Timeout
  /** reset form if show_blank_form is true */
  watch(submitted, (nextVal) => {
    if (nextVal && sharedFormView.value?.show_blank_form) {
      if (typeof sharedFormView.value?.redirect_url === 'string') {
        return
      }

      secondsRemain.value = 5
      intvl = setInterval(() => {
        secondsRemain.value = secondsRemain.value - 1

        if (secondsRemain.value < 0) {
          submitted.value = false

          formResetHook.trigger()

          clearInterval(intvl)
        }
      }, 1000)
    }

    /** reset form state and validation */
    if (!nextVal) {
      if (sharedFormView.value?.show_blank_form) {
        clearInterval(intvl)
      }
      clearForm()
    }
  })

  function isRequired(column: Record<string, any>) {
    if (!isVirtualCol(column) && ((column.rqd && !column.cdf) || (column.pk && !(column.ai || column.cdf)) || column.required)) {
      return true
    } else if (
      isLinksOrLTAR(column) &&
      column.colOptions &&
      (column.colOptions as LinkToAnotherRecordType).type === RelationTypes.BELONGS_TO
    ) {
      const col = columns.value?.find((c) => c.id === (column?.colOptions as LinkToAnotherRecordType)?.fk_child_column_id)

      if ((col && col.rqd && !col.cdf) || column.required) {
        if (col) {
          return true
        }
      }
    } else if (isVirtualCol(column) && column.required) {
      return true
    }
    return false
  }

  function loadAllviewFilters(formViewFilters: FilterType[]) {
    if (!formViewFilters.length) return

    const formFilter = new FormFilters({ data: formViewFilters })

    const allFilters = formFilter.getNestedGroupedFilters()

    allViewFilters.value = { ...allFilters }
  }

  async function checkFieldVisibility() {
    await fieldVisibilityValidator.value.validateVisibility()
  }

  watch(password, (next, prev) => {
    if (next !== prev && passwordError.value) passwordError.value = null
  })

  watch(
    () => sharedFormView.value?.heading,
    () => {
      useTitle(`${sharedFormView.value?.heading ?? 'NocoDB'}`)
    },
    {
      flush: 'post',
    },
  )

  watch(
    additionalState,
    async () => {
      try {
        await validate(
          Object.keys(additionalState.value)
            .map((title) => fieldMappings.value[title])
            .filter((v) => v !== undefined),
        )
      } catch {}
    },
    {
      deep: true,
    },
  )

  return {
    sharedView,
    sharedFormView,
    loadSharedView,
    columns,
    submitForm,
    clearForm,
    progress,
    meta,
    validators,
    formColumns,
    formState,
    notFound,
    password,
    passwordError,
    submitted,
    secondsRemain,
    passwordDlg,
    isLoading,
    sharedViewMeta,
    onReset: formResetHook.on,
    validate,
    validateInfos,
    clearValidate,
    additionalState,
    isRequired,
    handleAddMissingRequiredFieldDefaultState,
    fieldMappings,
    isValidRedirectUrl,
    loadAllviewFilters,
    checkFieldVisibility,
  }
}, 'shared-form-view-store')

export { useProvideSharedFormStore }

export function useSharedFormStoreOrThrow() {
  const sharedFormStore = useSharedFormStore()

  if (sharedFormStore == null) throw new Error('Please call `useProvideSharedFormStore` on the appropriate parent component')

  return sharedFormStore
}
