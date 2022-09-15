<script lang="ts" setup>
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { computed, onKeyStroke, ref, useEventListener, useSharedFormStoreOrThrow, useStepper, watch } from '#imports'

const { v$, formState, formColumns, submitForm, submitted, secondsRemain } = useSharedFormStoreOrThrow()

function isRequired(_columnObj: Record<string, any>, required = false) {
  let columnObj = _columnObj
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    columnObj.colOptions.type === RelationTypes.BELONGS_TO
  ) {
    columnObj = formColumns.value?.find((c) => c.id === columnObj.colOptions.fk_child_column_id) as Record<string, any>
  }

  return !!(required || (columnObj && columnObj.rqd && !columnObj.cdf))
}

const steps = computed(() => {
  if (!formColumns.value) return []
  return formColumns.value.reduce((acc, column) => {
    acc.push((column as any).label || column.title)

    return acc
  }, [] as string[])
})

const { index, goToPrevious, goToNext, isFirst, isLast, steps: _steps } = useStepper(steps)

const isTransitioning = ref(false)

const transitionName = ref<'left' | 'right'>('left')

const field = computed(() => formColumns.value?.[index.value])

const el = ref<HTMLDivElement>()

const transition = (direction: 'left' | 'right') => {
  isTransitioning.value = true
  transitionName.value = direction

  setTimeout(() => {
    transitionName.value = transitionName.value === 'left' ? 'right' : 'left'
  }, 500)

  setTimeout(() => {
    isTransitioning.value = false
  }, 1000)
}

const goNext = async () => {
  if (isLast.value) return

  const isValid = await v$.value.localState[field.value!.title!].$validate()
  if (!isValid) return

  transition('left')

  goToNext()
}

const goPrevious = async () => {
  if (isFirst.value) return

  transition('right')

  goToPrevious()
}

useEventListener('wheel', (event) => {
  if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) {
    // Scrolling more vertically than horizontally
    return
  }

  if (isTransitioning.value) return

  if (event.deltaX < -15) {
    goPrevious()
  } else if (event.deltaX > 15) {
    goNext()
  }
})

onKeyStroke(['ArrowLeft', 'ArrowDown'], goPrevious)
onKeyStroke(['ArrowRight', 'ArrowUp', 'Enter', 'Space'], goNext)
</script>

<template>
  <div class="w-full h-full flex flex-col justify-center items-center">
    <Transition :name="`slide-${transitionName}`" mode="out-in">
      <div
        ref="el"
        :key="field.title"
        class="bg-white flex flex-col justify-center gap-4 w-full lg:max-w-1/2 max-w-500px m-auto px-8 pt-8 pb-4 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
      >
        <div v-if="field" class="flex flex-col gap-2">
          <div class="flex nc-form-column-label">
            <SmartsheetHeaderVirtualCell
              v-if="isVirtualCol(field)"
              :column="{ ...field, title: field.label || field.title }"
              :required="isRequired(field, field.required)"
              :hide-menu="true"
            />

            <SmartsheetHeaderCell
              v-else
              :column="{ ...field, title: field.label || field.title }"
              :required="isRequired(field, field.required)"
              :hide-menu="true"
            />
          </div>

          <div v-if="isVirtualCol(field)">
            <SmartsheetVirtualCell
              class="mt-0 nc-input"
              :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
              :column="field"
            />

            <div v-if="field.description" class="text-gray-500 text-[10px] mb-2 ml-1">{{ field.description }}</div>

            <template v-if="v$.virtual.$dirty && v$.virtual?.[field.title]">
              <div v-for="error of v$.virtual[field.title].$errors" :key="error" class="text-xs text-red-500">
                {{ error.$message }}
              </div>
            </template>
          </div>

          <div v-else>
            <SmartsheetCell
              v-model="formState[field.title]"
              class="nc-input"
              :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
              :column="field"
              :edit-enabled="true"
            />

            <div class="flex flex-col gap-2 text-gray-500 text-xs my-2 px-1">
              <div v-for="error of v$.localState[field.title].$errors" :key="error" class="text-red-500">
                {{ error.$message }}
              </div>

              {{ field.description }}
            </div>
          </div>
        </div>

        <div v-if="!isFirst || !isLast" class="flex w-full text-lg mt-2">
          <a-tooltip v-if="!isFirst" title="Go to previous" :mouse-enter-delay="1" :mouse-leave-delay="0">
            <button
              class="group color-transition transform hover:scale-110 absolute left-5 top-1/2 md:static"
              @click="goPrevious"
            >
              <MdiChevronLeft class="group-hover:text-accent text-2xl md:text-md" />
            </button>
          </a-tooltip>

          <div class="flex-1">
            <div v-if="isLast && !submitted && !v$.$invalid" class="text-center my-4">
              <button type="submit" class="submit !px-4 !py-2 prose-sm" @click="submitForm">
                {{ $t('general.submit') }}
              </button>
            </div>
          </div>

          <a-tooltip
            v-if="!isLast"
            placement="left"
            :title="v$.localState[field.title]?.$error ? v$.localState[field.title].$errors[0].$message : 'Go to next'"
            :mouse-enter-delay="v$.localState[field.title]?.$error ? 0 : 1"
            :mouse-leave-delay="0"
          >
            <button class="group color-transition transform absolute right-5 top-1/2 md:static hover:scale-110" @click="goNext">
              <TransitionGroup name="layout">
                <MdiCloseCircleOutline v-if="v$.localState[field.title]?.$error" class="text-red-500 text-2xl md:text-md" />
                <MdiChevronRight v-else class="group-hover:text-accent text-2xl md:text-md" />
              </TransitionGroup>
            </button>
          </a-tooltip>
        </div>
      </div>
    </Transition>

    <div class="absolute bottom-12 right-12">{{ index }} / {{ formColumns?.length }}</div>
  </div>
</template>

<style lang="scss" scoped>
:global(html, body) {
  @apply overscroll-x-none;
}

:deep(.nc-form-column-label) {
  > * {
    @apply !prose-lg;
  }

  .nc-icon {
    @apply mr-2;
  }
}

:deep(.nc-cell-attachment) {
  @apply p-0;

  .nc-attachment-cell {
    @apply px-4 min-h-[75px] w-full h-full;

    .nc-attachment {
      @apply md:(w-[50px] h-[50px]) lg:(w-[75px] h-[75px]) min-h-[50px] min-w-[50px];
    }

    .nc-attachment-cell-dropzone {
      @apply rounded bg-gray-400/75;
    }
  }
}
</style>
