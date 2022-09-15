<script lang="ts" setup>
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import {
  DropZoneRef,
  computed,
  onKeyStroke,
  provide,
  ref,
  useEventListener,
  useSharedFormStoreOrThrow,
  useStepper,
} from '#imports'

const { v$, formState, formColumns, submitForm, submitted, secondsRemain, sharedFormView } = useSharedFormStoreOrThrow()

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

provide(DropZoneRef, el)

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
    <template v-if="sharedFormView">
      <div class="flex-1" />

      <h1 class="prose-2xl font-bold self-center my-4">{{ sharedFormView.heading }}</h1>

      <h2 v-if="sharedFormView.subheading" class="prose-lg text-gray-500 self-center">{{ sharedFormView.subheading }}</h2>
    </template>

    <Transition :name="`slide-${transitionName}`" mode="out-in">
      <div
        ref="el"
        :key="field.title"
        class="color-transition bg-white dark:bg-slate-700 flex flex-col justify-center gap-4 w-full max-w-[max(33%,600px)] m-auto px-8 pt-8 pb-4 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
      >
        <div v-if="field && !submitted" class="flex flex-col gap-2">
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

          <div>
            <SmartsheetVirtualCell
              v-if="isVirtualCol(field)"
              class="mt-0 nc-input"
              :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
              :column="field"
            />

            <SmartsheetCell
              v-else
              v-model="formState[field.title]"
              class="nc-input"
              :class="`nc-form-input-${field.title.replaceAll(' ', '')}`"
              :column="field"
              :edit-enabled="true"
            />

            <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-[0.75rem] my-2 px-1">
              <div v-for="error of v$.localState[field.title].$errors" :key="error" class="text-red-500">
                {{ error.$message }}
              </div>

              {{ field.description }}
            </div>
          </div>
        </div>

        <div v-if="(!isFirst || !isLast) && !submitted" class="flex w-full text-lg mt-2">
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
              <button type="submit" class="scaling-btn prose-sm" @click="submitForm">
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

        <Transition name="layout">
          <div v-if="submitted" class="flex flex-col justify-center text-center">
            <h2 class="prose-xl mb-2">Thank you!</h2>

            <div v-if="sharedFormView" class="min-w-350px mt-3">
              <a-alert
                type="success"
                class="my-4 text-center"
                outlined
                :message="sharedFormView.success_msg || 'Successfully submitted form data'"
              />

              <p v-if="sharedFormView?.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 text-center my-4">
                New form will be loaded after {{ secondsRemain }} seconds
              </p>

              <div v-if="sharedFormView?.submit_another_form" class="text-center">
                <a-button type="primary" @click="submitted = false"> Submit Another Form</a-button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>

    <div v-if="sharedFormView" class="flex-1" />

    <div class="absolute bottom-12 right-12 flex flex-col">
      <div>{{ index + 1 }} / {{ formColumns?.length }}</div>
    </div>
  </div>
</template>

<style lang="scss">
:global(html, body) {
  @apply overscroll-x-none;
}

.nc-form-column-label {
  > * {
    @apply !prose-lg dark:text-slate-300;
  }

  .nc-icon {
    @apply mr-2;
  }
}
</style>
