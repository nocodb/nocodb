import type { Ref } from 'vue'
import { helpers } from '@vuelidate/validators'
import useVuelidate from '@vuelidate/core'
import dayjs from 'dayjs'
import mime from 'mime-lite'
import type { RuleObject } from 'ant-design-vue/es/form'
import type { ColumnType, FormType, TableType, Validation, ViewType } from 'nocodb-sdk'
import {
  AttachmentValidationType,
  DateValidationType,
  InputType,
  NumberValidationType,
  RelationTypes,
  SelectValidationType,
  StringValidationType,
  TimeValidationType,
  UITypes,
  YearValidationType,
  isLinksOrLTAR,
  oppositeValidationTypeMap,
} from 'nocodb-sdk'
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

                  if (column.uidt === UITypes.Rating && (!value || Number(value) < 1)) {
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

    // Initialize form data object with nested objects for each item
    const visibleColumnsMap = computed(() =>
      visibleColumns.value.reduce((acc: Record<string, any>, col) => {
        acc[col.id] = col
        return acc
      }, {} as Record<string, any>),
    )

    const getValidator = (validators: Validation[], type: Validation['type'], index?: number) => {
      if (!validators.length || !type) {
        return null
      }

      return index !== undefined ? validators[index] || null : validators.find((v) => v.type === type) || null
    }

    const getColumnMetaValue = (id: string, key: string) => {
      return (visibleColumnsMap.value[id]?.meta || {})[key] ?? null
    }

    const isValidNumber = (type: Validation['type'], value: any) => {
      if (value === null || value === '-') {
        return true
      }

      return [
        StringValidationType.MinLength,
        StringValidationType.MaxLength,
        SelectValidationType.MinSelected,
        SelectValidationType.MaxSelected,
        AttachmentValidationType.FileCount,
      ].includes(type)
        ? /^-?\d+$/.test(value)
        : /^-?\d*\.?\d+$/.test(value)
    }

    const checkMaxCondition = (minValidator: Validation, maxValidator: Validation, _col: ColumnType) => {
      switch (maxValidator?.type) {
        case StringValidationType.MaxLength:
        case NumberValidationType.Max:
        case YearValidationType.MaxYear:
        case SelectValidationType.MaxSelected: {
          return isValidNumber(maxValidator?.type, maxValidator?.value) && isValidNumber(minValidator?.type, minValidator?.value)
            ? minValidator?.value <= maxValidator?.value
            : true
        }
        case TimeValidationType.MaxTime: {
          const minValue = dayjs(`1999-01-01 ${dayjs(minValidator.value).format('HH:mm:ss')}`)

          const maxValue = dayjs(`1999-01-01 ${dayjs(maxValidator.value).format('HH:mm:ss')}`)

          return minValue.isBefore(maxValue) || minValue.isSame(maxValue)
        }
        case DateValidationType.MaxDate: {
          const minValue = dayjs(minValidator.value)

          const maxValue = dayjs(maxValidator.value)

          return minValue.isBefore(maxValue) || minValue.isSame(maxValue)
        }
      }
    }

    const isValidRegex = (regexPattern: string) => {
      try {
        RegExp(regexPattern)
        return true
      } catch (e) {
        return false
      }
    }

    const validateAttachmentFileTypes = (currVal: Validation) => {
      const duplicateValues = (currVal?.value || []).filter((value, index, self) => {
        return self.indexOf(value) !== index
      })
      const invalidTypes = (currVal?.value || []).filter((m) => {
        return !(
          mime.getExtension(m.trim()) ||
          /image\/jpg/.test(m.trim()) ||
          /^(audio|video|image|application|text)\/\*$/.test(m.trim())
        )
      })

      return {
        isValid: currVal?.type && currVal?.value?.length ? !duplicateValues.length && !invalidTypes.length : true,
        message: duplicateValues.length
          ? `Duplicate mime type '${duplicateValues.join(',')}'`
          : `Invalid mime type '${invalidTypes.join(', ')}'`,
      }
    }

    // Define validation rules for each item's validators
    const rules = computed(() => {
      return visibleColumns.value.reduce((acc, col) => {
        acc[col.id] = {
          meta: {
            validators: (col.meta.validators || []).reduce((vAcc, validator, i) => {
              const validatorKey = `${validator.type}-${i}`

              if (Object.values(StringValidationType).includes(validator.type)) {
                vAcc[`${validatorKey}_requiredValue`] = helpers.withMessage('Value is required', (value) => {
                  const currVal = getValidator(value, validator.type, i)

                  return currVal && currVal.type ? !isEmptyValidatorValue(currVal) : true
                })
              }

              switch (validator.type) {
                case StringValidationType.Regex: {
                  vAcc[validatorKey] = helpers.withMessage('Invalid regular expression', (value) => {
                    const currVal = getValidator(value, validator.type, i)
                    return currVal?.regex ? isValidRegex(currVal.regex) : true
                  })
                  break
                }
                case StringValidationType.NotIncludes: {
                  vAcc[validatorKey] = helpers.withMessage("The doesn't contains value can't be same as contains", (value) => {
                    const currVal = getValidator(value, validator.type, i)
                    const includesVal =
                      value?.find((v) => v.type === oppositeValidationTypeMap[validator.type] && v.value === currVal.value) ||
                      null
                    if (currVal?.value && includesVal) {
                      return false
                    }
                    return true
                  })
                  break
                }
                case StringValidationType.MaxLength:
                case NumberValidationType.Max:
                case YearValidationType.MaxYear:
                case DateValidationType.MaxDate:
                case TimeValidationType.MaxTime:
                case SelectValidationType.MaxSelected: {
                  vAcc[validatorKey] = helpers.withMessage(
                    'The maximum value must be greater than or equal to the minimum value.',
                    (value) => {
                      const currMinVal = getValidator(value, oppositeValidationTypeMap[validator.type])
                      const currVal = getValidator(value, validator.type, i)

                      if (currVal && currMinVal && currVal.value !== null && currMinVal.value !== null) {
                        return checkMaxCondition(currMinVal, currVal, col)
                      } else {
                        return true
                      }
                    },
                  )

                  if (validator.type === SelectValidationType.MaxSelected) {
                    vAcc[`${validatorKey}_max_select`] = helpers.withMessage("The maximum value can't be zero", (value) => {
                      const currVal = getValidator(value, validator.type, i)

                      if (currVal?.value === 0) {
                        return false
                      } else {
                        return true
                      }
                    })
                  }

                  if (validator.type === NumberValidationType.Max && col.uidt === UITypes.Rating) {
                    vAcc[`${validatorKey}_max_rating`] = helpers.withMessage(
                      `The maximum value must be less than or equal to max rating value`,
                      (value) => {
                        const currVal = getValidator(value, validator.type, i)

                        if (currVal && currVal.value !== null && Number(currVal.value) > getColumnMetaValue(col.id, 'max')) {
                          return false
                        } else {
                          return true
                        }
                      },
                    )
                  }
                  break
                }
                case NumberValidationType.Min: {
                  if (col.uidt === UITypes.Rating) {
                    vAcc[`${validatorKey}_min_rating_m`] = helpers.withMessage(
                      `The minimum value must be less than or equal to max rating value`,
                      (value) => {
                        const currVal = getValidator(value, validator.type, i)

                        if (currVal && currVal.value !== null && Number(currVal.value) > getColumnMetaValue(col.id, 'max')) {
                          return false
                        } else {
                          return true
                        }
                      },
                    )

                    vAcc[`${validatorKey}_min_rating_required`] = helpers.withMessage(
                      'The minimum value should be non zero positive integer',
                      (value) => {
                        const currVal = getValidator(value, validator.type, i)

                        if (currVal && currVal.value !== null && isRequired(col, col.required) && Number(currVal.value) < 1) {
                          return false
                        } else {
                          return true
                        }
                      },
                    )
                    vAcc[`${validatorKey}_min_rating_non_required`] = helpers.withMessage(
                      'The minimum value must be greater than or equal to zero',
                      (value) => {
                        const currVal = getValidator(value, validator.type, i)

                        if (currVal && currVal.value !== null && !isRequired(col, col.required) && Number(currVal.value) < 0) {
                          return false
                        } else {
                          return true
                        }
                      },
                    )
                  }

                  break
                }

                case StringValidationType.MinLength:
                case SelectValidationType.MinSelected: {
                  vAcc[validatorKey] = (() => {
                    const msg = {
                      [StringValidationType.MinLength]: 'Min length should be at least 1 for required fields',
                      [SelectValidationType.MinSelected]: 'At least 1 selection has to be made for required fields',
                    }

                    return helpers.withMessage(msg[validator.type], (value) => {
                      const currVal = getValidator(value, validator.type, i)

                      return currVal?.value !== null && isValidNumber(currVal?.type, currVal?.value) && col.required
                        ? currVal?.value >= 1
                        : true
                    })
                  })()
                  break
                }

                case AttachmentValidationType.FileTypes: {
                  vAcc[validatorKey] = helpers.withMessage(
                    ({ $model }) => {
                      const currVal = getValidator($model, validator.type, i)
                      return validateAttachmentFileTypes(currVal).message
                    },
                    (value) => {
                      const currVal = getValidator(value, validator.type, i)

                      return validateAttachmentFileTypes(currVal).isValid
                    },
                  )
                  break
                }
                case AttachmentValidationType.FileSize: {
                  vAcc[validatorKey] = helpers.withMessage('Max file size should be positive integer', (value) => {
                    const currVal = getValidator(value, validator.type, i)

                    return currVal?.value !== null && isValidNumber(currVal?.type, currVal?.value) ? currVal?.value > 0 : true
                  })
                  break
                }
                case AttachmentValidationType.FileCount: {
                  vAcc[validatorKey] = helpers.withMessage('Max file count should be at least 1 for required fields', (value) => {
                    const currVal = getValidator(value, validator.type, i)

                    return currVal?.value !== null && isValidNumber(currVal?.type, currVal?.value) && col.required
                      ? currVal?.value >= 1
                      : true
                  })

                  vAcc[`${validatorKey}_1`] = helpers.withMessage(
                    'Max file count should be non zero positive integer',
                    (value) => {
                      const currVal = getValidator(value, validator.type, i)

                      return currVal?.value !== null && isValidNumber(currVal?.type, currVal?.value) && !col.required
                        ? currVal?.value > 0
                        : true
                    },
                  )
                  break
                }
              }

              if (InputType[validator.type] === 'number') {
                vAcc[`${validatorKey}_number`] = helpers.withMessage(t('msg.plsEnterANumber'), (value) => {
                  const currVal = getValidator(value, validator.type, i)

                  return isValidNumber(currVal?.type, currVal?.value)
                })
              }

              if (
                [
                  StringValidationType.StartsWith,
                  StringValidationType.EndsWith,
                  StringValidationType.Includes,
                  StringValidationType.NotIncludes,
                ].includes(validator.type)
              ) {
                vAcc[`${validatorKey}_invalidLen`] = helpers.withMessage(
                  'value length should not be greater than maximum characters',
                  (value) => {
                    const currVal = getValidator(value, validator.type, i)

                    const maxLengthVal = getValidator(value, StringValidationType.MaxLength)

                    if (
                      maxLengthVal &&
                      maxLengthVal?.value !== null &&
                      currVal?.value &&
                      currVal?.value?.length > maxLengthVal?.value
                    ) {
                      return false
                    }

                    return true
                  },
                )
              }

              return vAcc
            }, {}),
          },
        }
        return acc
      }, {})
    })

    // Use Vuelidate to create validation instance
    const v$ = useVuelidate(rules, visibleColumnsMap)

    onMounted(async () => {
      setTimeout(async () => {
        await v$.value?.$validate()
      }, 500)
    })

    const validateActiveField = async (col: ColumnType) => {
      // Validate field configuration
      try {
        await v$.value[col.id]?.$validate()
      } catch (e: any) {
        console.error('Field config error', e)
      }

      // Validate field value
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

      return !!(required || (columnObj && columnObj.rqd && !columnObj.cdf))
    }

    const getActiveFieldValidationErrors = (type: Validation['type'], index?: number) => {
      if (!activeField.value) return []

      if (index !== undefined && [StringValidationType.Includes, StringValidationType.NotIncludes].includes(type)) {
        return (
          (v$.value?.[activeField.value.id]?.meta?.validators?.$errors || [])
            .filter((v) => v?.$validator?.includes(`${type}-${index}`))
            .map((v) => v.$message) || []
        )
      } else {
        return (
          (v$.value?.[activeField.value.id]?.meta?.validators?.$errors || [])
            .filter((v) => v?.$validator?.includes(type))
            .map((v) => v.$message) || []
        )
      }
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
      validate,
      validateInfos,
      clearValidate,
      getActiveFieldValidationErrors,
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
