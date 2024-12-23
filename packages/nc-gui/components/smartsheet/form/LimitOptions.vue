<script setup lang="ts">
import Draggable from 'vuedraggable'
import tinycolor from 'tinycolor2'
import type { ColumnType, SelectOptionType, SelectOptionsType, UserFieldRecordType } from 'nocodb-sdk'
import { UITypes } from 'nocodb-sdk'
import type { FormFieldsLimitOptionsType } from '~/lib/types'

const props = defineProps<{
  modelValue: FormFieldsLimitOptionsType[]
  formFieldState?: string | null
  column: ColumnType
  isRequired?: boolean
}>()

const emits = defineEmits(['update:modelValue', 'update:formFieldState'])

const meta = inject(MetaInj)!

const { column, formFieldState } = toRefs(props)

const basesStore = useBases()

const { basesUser } = storeToRefs(basesStore)

const baseUsers = computed(() => (meta.value.base_id ? basesUser.value.get(meta.value.base_id) || [] : []))

const searchQuery = ref('')

const drag = ref(false)

const vModel = computed({
  get: () => {
    let order = 1
    const limitOptionsById =
      (props.modelValue || []).reduce((o: Record<string, FormFieldsLimitOptionsType>, f: FormFieldsLimitOptionsType) => {
        if (order < (f?.order ?? 0)) {
          order = f.order
        }
        return {
          ...o,
          [f.id]: f,
        }
      }, {} as Record<string, FormFieldsLimitOptionsType>) ?? {}

    if (UITypes.User === column.value.uidt) {
      const collaborators = ((baseUsers.value || []) as UserFieldRecordType[])
        .filter((user) => !user?.deleted)
        .map((user: any) => ({
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          meta: user.meta,
          order: user.id && limitOptionsById[user.id] ? limitOptionsById[user.id]?.order ?? user.order : order++,
          show: user.id && limitOptionsById[user.id] ? limitOptionsById[user.id]?.show : !(props.modelValue || []).length,
        }))
        .sort((a, b) => a.order - b.order)

      if ((props.modelValue || []).length !== collaborators.length) {
        emits(
          'update:modelValue',
          collaborators.map((o) => ({ id: o.id, order: o.order, show: o.show })),
        )
      }
      return collaborators
    } else if ([UITypes.SingleSelect, UITypes.MultiSelect].includes(column.value.uidt as UITypes)) {
      const updateModelValue = ((column.value.colOptions as SelectOptionsType)?.options || [])
        .map((c) => {
          return {
            ...c,
            order: c.id && limitOptionsById[c.id] ? limitOptionsById[c.id]?.order ?? c.order : order++,
            show: c.id && limitOptionsById[c.id] ? limitOptionsById[c.id]?.show : !(props.modelValue || []).length,
          } as SelectOptionType & { show?: boolean }
        })
        .sort((a, b) => {
          if (a.order !== undefined && b.order !== undefined) {
            return a.order - b.order
          }
          return 0
        })

      if ((props.modelValue || []).length !== ((column.value.colOptions as SelectOptionsType)?.options || []).length) {
        emits(
          'update:modelValue',
          updateModelValue.map((o) => ({ id: o.id, order: o.order, show: o.show })),
        )
      }
      return updateModelValue
    }
    return []
  },
  set: (val) => {
    const fieldState = (formFieldState.value || '').split(',')
    const optionsToRemoveFromFieldState: string[] = []

    emits(
      'update:modelValue',
      val.map((o) => {
        if (!o.show) {
          if (column.value.uidt === UITypes.User && fieldState.includes(o.id)) {
            optionsToRemoveFromFieldState.push(o.id)
          } else if (o?.title && fieldState.includes(o.title)) {
            optionsToRemoveFromFieldState.push(o.title)
          }
        }
        return { id: o.id, order: o.order, show: o.show }
      }),
    )

    emits('update:formFieldState', fieldState.filter((o) => !optionsToRemoveFromFieldState.includes(o)).join(','))
  },
})

async function onMove(_event: { moved: { newIndex: number; oldIndex: number; element: any } }) {
  const {
    moved: { newIndex = 0, oldIndex = 0, element },
  } = _event

  let nextOrder: number

  // set new order value based on the new order of the items
  if (!vModel.value.length || vModel.value.length === 1) {
    nextOrder = 1
  } else if (vModel.value.length - 1 === newIndex) {
    // If moving to the end, set nextOrder greater than the maximum order in the list
    nextOrder = Math.max(...vModel.value.map((item) => item?.order ?? 0)) + 1
  } else if (newIndex === 0) {
    // If moving to the beginning, set nextOrder smaller than the minimum order in the list
    nextOrder = Math.min(...vModel.value.map((item) => item?.order ?? 0)) / 2
  } else {
    nextOrder =
      (parseFloat(String(vModel.value[newIndex - 1]?.order ?? 0)) + parseFloat(String(vModel.value[newIndex + 1]?.order ?? 0))) /
      2
  }
  const _nextOrder = !isNaN(Number(nextOrder)) ? nextOrder : oldIndex

  element.order = _nextOrder

  vModel.value = [...vModel.value]
}

const showOrHideAll = (showAll: boolean) => {
  if (props.isRequired && !showAll) {
    return
  }
  vModel.value = vModel.value.map((o) => {
    return {
      ...o,
      show: showAll,
    }
  })
}
</script>

<template>
  <div class="w-full h-full nc-col-select-option nc-form-scrollbar">
    <div v-if="vModel.length > 12">
      <a-input
        v-model:value="searchQuery"
        class="!h-9 !px-3 !py-1 !rounded-lg mb-2"
        :placeholder="`${$t('placeholder.searchOptions')}...`"
        name="nc-form-field-limit-option-search-input"
        data-testid="nc-form-field-limit-option-search-input"
      >
        <template #prefix>
          <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500 group-hover:text-black" />
        </template>
        <template #suffix>
          <GeneralIcon
            v-if="searchQuery.length > 0"
            icon="close"
            class="ml-2 h-4 w-4 text-gray-500 group-hover:text-black"
            data-testid="nc-form-field-clear-search"
            @click="searchQuery = ''"
          />
        </template>
      </a-input>
    </div>

    <div v-if="vModel.length" class="flex items-stretch gap-2 pr-2 pl-3 py-1.5 rounded-t-lg border-1 border-b-0 border-gray-200">
      <NcTooltip :disabled="!isRequired">
        <template #title> {{ $t('msg.info.preventHideAllOptions') }} </template>

        <NcButton
          type="secondary"
          size="xxsmall"
          class="!border-none !px-2 !text-xs !text-gray-500 !disabled:text-gray-300"
          :disabled="isRequired || vModel.filter((o) => !o.show).length === vModel.length"
          :shadow="false"
          @click="showOrHideAll(false)"
        >
          {{ $t('general.hideAll') }}
        </NcButton>
      </NcTooltip>

      <div>
        <NcButton
          type="secondary"
          size="xxsmall"
          class="!border-none !px-2 !text-xs !text-gray-500 !disabled:text-gray-300"
          :disabled="vModel.filter((o) => o.show).length === vModel.length"
          :shadow="false"
          @click="showOrHideAll(true)"
        >
          {{ $t('general.showAll') }}
        </NcButton>
      </div>
    </div>

    <Draggable
      v-if="vModel.length"
      :model-value="vModel"
      item-key="id"
      handle=".nc-child-draggable-icon"
      ghost-class="nc-form-field-limit-option-ghost"
      class="rounded-b-lg border-1 border-gray-200 !max-h-[224px] overflow-y-auto nc-form-scrollbar"
      @change="onMove($event)"
      @start="drag = true"
      @end="drag = false"
    >
      <template #item="{ element }">
        <div
          v-if="
            column.uidt === UITypes.User
              ? (element?.display_name?.trim() || element?.email)?.toLowerCase().includes(searchQuery.toLowerCase())
              : element.title?.toLowerCase().includes(searchQuery.toLowerCase())
          "
          :key="element.id"
          class="w-full h-10 px-2 py-1.5 flex flex-row items-center gap-3 border-b-1 last:border-none border-gray-200"
          :class="[
            `nc-form-field-${column.title?.replaceAll(' ', '')}-limit-option-${element.title?.replaceAll(' ', '')}`,
            `${element.show ? 'hover:bg-gray-50' : 'bg-gray-100'}`,
          ]"
          :data-testid="`nc-form-field-${column.title?.replaceAll(' ', '')}-limit-option-${element.title?.replaceAll(' ', '')}`"
        >
          <component :is="iconMap.drag" class="nc-child-draggable-icon flex-none cursor-move !h-4 !w-4 text-gray-600" />

          <NcTooltip :disabled="!isRequired || !(element.show && isRequired && vModel.filter((o) => o.show).length === 1)">
            <template #title> {{ $t('msg.info.preventHideAllOptions') }} </template>

            <div
              class="!border-none !px-2"
              @click="
                () => {
                  if (element.show && isRequired && vModel.filter((o) => o.show).length === 1) return
                  element.show = !element.show
                  vModel = [...vModel]
                }
              "
            >
              <component
                :is="element.show ? iconMap.eye : iconMap.eyeSlash"
                class="flex-none cursor-pointer !h-4 !w-4 text-gray-600"
              />
            </div>
          </NcTooltip>

          <a-tag v-if="column.uidt === UITypes.User" class="rounded-tag max-w-[calc(100%_-_70px)] !pl-0" color="'#ccc'">
            <span
              :style="{
                'color': tinycolor.isReadable('#ccc' || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable('#ccc' || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                'font-size': '13px',
              }"
              class="flex items-stretch gap-2"
            >
              <div>
                <GeneralUserIcon size="auto" :user="element" class="!text-[0.65rem] !h-[16.8px]" />
              </div>
              <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                <template #title>
                  {{ element.display_name?.trim() || element?.email }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ element.display_name?.trim() || element?.email }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
          <a-tag v-else class="rounded-tag max-w-[calc(100%_-_70px)]" :color="element.color">
            <span
              :style="{
                'color': tinycolor.isReadable(element.color || '#ccc', '#fff', { level: 'AA', size: 'large' })
                  ? '#fff'
                  : tinycolor.mostReadable(element.color || '#ccc', ['#0b1d05', '#fff']).toHex8String(),
                'font-size': '13px',
              }"
            >
              <NcTooltip class="truncate max-w-full" show-on-truncate-only>
                <template #title>
                  {{ element.title }}
                </template>
                <span
                  class="text-ellipsis overflow-hidden"
                  :style="{
                    wordBreak: 'keep-all',
                    whiteSpace: 'nowrap',
                    display: 'inline',
                  }"
                >
                  {{ element.title }}
                </span>
              </NcTooltip>
            </span>
          </a-tag>
        </div>
      </template>
      <template v-if="!vModel.length" #footer
        ><div class="px-0.5 py-2 text-gray-500 text-center">{{ $t('title.noOptionsFound') }}</div></template
      >
      <template
        v-else-if="
          vModel.length &&
          searchQuery &&
          !vModel?.filter((element) => {
            return column.uidt === UITypes.User
              ? (element?.display_name?.trim() || element?.email)?.toLowerCase().includes(searchQuery.toLowerCase())
              : element.title?.toLowerCase().includes(searchQuery.toLowerCase())
          })?.length
        "
        #footer
      >
        <div class="px-0.5 py-2 text-gray-500 text-center">{{ $t('title.noOptionsFound') }} with title `{{ searchQuery }}`</div>
      </template>
    </Draggable>
  </div>
</template>

<style scoped lang="scss">
.nc-form-scrollbar {
  @apply scrollbar scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent;
  &::-webkit-scrollbar-thumb:hover {
    @apply !scrollbar-thumb-gray-300;
  }
}
.rounded-tag {
  @apply py-0 px-[12px] rounded-[12px];
}

:deep(.ant-tag) {
  @apply rounded-tag my-[2px];
}
.nc-form-field-limit-option-ghost {
  @apply bg-gray-50;
}
</style>
