import type { ColumnType } from 'nocodb-sdk'
import { SqlUiFactory, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { ComputedRef, Ref } from 'vue'
import { computed, dataTypeLow, isBoolean, isPrimary, isString, isTextArea, useProject } from '#imports'

export function useColumn(column: Ref<ColumnType | undefined>) {
  const { project } = useProject()

  const data = computed(() => {
    if (!column.value) return null

    const abstractType = computed(() => {
      // kludge: CY test hack; column.value is being received NULL during attach cell delete operation
      return (column.value && isVirtualCol(column.value)) || !column.value
        ? null
        : SqlUiFactory.create(
            project.value?.bases?.[0]?.type ? { client: project.value.bases[0].type } : { client: 'mysql2' },
          ).getAbstractType(column.value)
    })

    return {
      abstractType,
      dataTypeLow: dataTypeLow(column.value),
      isPrimary: isPrimary(column.value),
      isBoolean: isBoolean(abstractType.value),
      isString: isString(column.value, abstractType.value),
      isTextArea: isTextArea(column.value),
      isInt,
      isFloat,
      isDate,
      isYear,
      isTime,
      isDateTime,
      isJSON,
      isEnum,
      isSet,
      isURL,
      isEmail,
      isAttachment,
      isRating,
      isCurrency,
      isDecimal,
      isDuration,
      isAutoSaved,
      isManualSaved,
      isSingleSelect,
      isMultiSelect,
      isPercent,
      isPhoneNumber,
      isSpecificDBType,
    }
  })
}
