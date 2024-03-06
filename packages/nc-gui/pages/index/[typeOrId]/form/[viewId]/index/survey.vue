<script lang="ts" setup>
import type { ColumnType, LinkToAnotherRecordType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import { breakpointsTailwind } from '@vueuse/core'
import {
  DropZoneRef,
  IsSurveyFormInj,
  computed,
  iconMap,
  isValidURL,
  onKeyStroke,
  onMounted,
  provide,
  ref,
  useBreakpoints,
  useI18n,
  usePointerSwipe,
  useSharedFormStoreOrThrow,
  useStepper,
  validateEmail,
} from '#imports'

enum TransitionDirection {
  Left = 'left',
  Right = 'right',
}

enum AnimationTarget {
  ArrowLeft = 'arrow-left',
  ArrowRight = 'arrow-right',
  OkButton = 'ok-button',
  SubmitButton = 'submit-button',
}

const { md } = useBreakpoints(breakpointsTailwind)

const { v$, formState, formColumns, submitForm, submitted, secondsRemain, sharedFormView, sharedViewMeta, onReset } =
  useSharedFormStoreOrThrow()

const { t } = useI18n()

const isTransitioning = ref(false)

const transitionName = ref<TransitionDirection>(TransitionDirection.Left)

const animationTarget = ref<AnimationTarget>(AnimationTarget.ArrowRight)

const isAnimating = ref(false)

const el = ref<HTMLDivElement>()

provide(DropZoneRef, el)

provide(IsSurveyFormInj, ref(true))

const transitionDuration = computed(() => sharedViewMeta.value.transitionDuration || 50)

const steps = computed(() => {
  if (!formColumns.value) return []

  return formColumns.value.reduce<string[]>((acc, column) => {
    const title = column.label || column.title

    if (!title) return acc

    acc.push(title)

    return acc
  }, [])
})

const { index, goToPrevious, goToNext, isFirst, isLast, goTo } = useStepper(steps)

const field = computed(() => formColumns.value?.[index.value])

const columnValidationError = ref(false)

function isRequired(column: ColumnType, required = false) {
  let columnObj = column
  if (
    columnObj.uidt === UITypes.LinkToAnotherRecord &&
    columnObj.colOptions &&
    (columnObj.colOptions as { type: RelationTypes }).type === RelationTypes.BELONGS_TO
  ) {
    columnObj = formColumns.value?.find(
      (c) => c.id === (columnObj.colOptions as LinkToAnotherRecordType).fk_child_column_id,
    ) as ColumnType
  }

  return required || (columnObj && columnObj.rqd && !columnObj.cdf)
}

function transition(direction: TransitionDirection) {
  isTransitioning.value = true
  transitionName.value = direction

  setTimeout(() => {
    transitionName.value =
      transitionName.value === TransitionDirection.Left ? TransitionDirection.Right : TransitionDirection.Left
  }, transitionDuration.value / 2)

  setTimeout(() => {
    isTransitioning.value = false

    setTimeout(focusInput, 100)
  }, transitionDuration.value)
}

function animate(target: AnimationTarget) {
  animationTarget.value = target

  isAnimating.value = true

  setTimeout(() => {
    isAnimating.value = false
  }, transitionDuration.value / 2)
}

async function validateColumn() {
  const f = field.value!
  if (parseProp(f.meta)?.validate && formState.value[f.title!]) {
    if (f.uidt === UITypes.Email) {
      if (!validateEmail(formState.value[f.title!])) {
        columnValidationError.value = true
        message.error(t('msg.error.invalidEmail'))
        return false
      }
    } else if (f.uidt === UITypes.URL) {
      if (!isValidURL(formState.value[f.title!])) {
        columnValidationError.value = true
        message.error(t('msg.error.invalidURL'))
        return false
      }
    }
  }
  return true
}

async function goNext(animationTarget?: AnimationTarget) {
  columnValidationError.value = false

  if (isLast.value || submitted.value) return

  if (!field.value || !field.value.title) return

  const validationField = v$.value.localState[field.value.title]

  if (validationField) {
    const isValid = await validationField.$validate()
    if (!isValid) return
  }

  if (!(await validateColumn())) return

  animate(animationTarget || AnimationTarget.ArrowRight)

  setTimeout(
    () => {
      transition(TransitionDirection.Left)

      goToNext()
    },
    animationTarget === AnimationTarget.OkButton ? 300 : 0,
  )
}

async function goPrevious(animationTarget?: AnimationTarget) {
  if (isFirst.value || submitted.value) return

  animate(animationTarget || AnimationTarget.ArrowLeft)

  transition(TransitionDirection.Right)

  goToPrevious()
}

function focusInput() {
  if (document && typeof document !== 'undefined') {
    const inputEl =
      (document.querySelector('.nc-cell input') as HTMLInputElement) ||
      (document.querySelector('.nc-cell textarea') as HTMLTextAreaElement)

    if (inputEl) {
      inputEl.select()
      inputEl.focus()
    }
  }
}

function resetForm() {
  v$.value.$reset()
  submitted.value = false
  transition(TransitionDirection.Right)
  goTo(steps.value[0])
}

async function submit() {
  if (submitted.value || !(await validateColumn())) return
  submitForm()
}

onReset(resetForm)

onKeyStroke(['ArrowLeft', 'ArrowDown'], () => {
  goPrevious(AnimationTarget.ArrowLeft)
})
onKeyStroke(['ArrowRight', 'ArrowUp'], () => {
  goNext(AnimationTarget.ArrowRight)
})
onKeyStroke(['Enter', 'Space'], () => {
  if (isLast.value) {
    submit()
  } else {
    goNext(AnimationTarget.OkButton, true)
  }
})

onMounted(() => {
  focusInput()

  if (!md.value) {
    const { direction } = usePointerSwipe(el, {
      onSwipe: () => {
        if (isTransitioning.value) return

        if (direction.value === 'left') {
          goNext()
        } else if (direction.value === 'right') {
          goPrevious()
        }
      },
    })
  }
})
</script>

<template>
  <div ref="el" class="survey pt-8 md:p-0 w-full h-full flex flex-col">
    <div
      v-if="sharedFormView"
      style="height: max(40vh, 225px); min-height: 225px"
      class="w-full max-w-[max(33%,600px)] mx-auto flex flex-col justify-end"
    >
      <div class="px-4 md:px-0 flex flex-col justify-end">
        <h1 class="text-2xl font-bold text-gray-900 self-center text-center my-4" data-testid="nc-survey-form__heading">
          {{ sharedFormView.heading }}
        </h1>
        <div v-if="sharedFormView.subheading?.trim()" class="w-full">
          <LazyCellRichText
            :value="sharedFormView.subheading"
            class="font-medium text-base text-gray-500 dark:text-slate-300 !h-auto mb-4 -ml-1"
            is-form-field
            read-only
            sync-value-change
            data-testid="nc-survey-form__sub-heading"
          />
        </div>
      </div>
    </div>

    <div class="h-full w-full flex items-center px-4 md:px-0">
      <Transition :name="`slide-${transitionName}`" :duration="transitionDuration" mode="out-in">
        <div
          ref="el"
          :key="field?.title"
          class="color-transition h-full flex flex-col mt-6 gap-4 w-full max-w-[max(33%,600px)] m-auto"
        >
          <div v-if="field && !submitted" class="flex flex-col gap-2">
            <div class="nc-form-column-label text-sm font-semibold text-gray-800" data-testid="nc-form-column-label">
              <span>
                {{ field.label || field.title }}
              </span>
              <span v-if="isRequired(field, field.required)" class="text-red-500 text-base leading-[18px]">&nbsp;*</span>
            </div>
            <div
              v-if="field?.description"
              class="nc-form-column-description text-gray-500 text-sm"
              data-testid="nc-survey-form__field-description"
            >
              <LazyCellRichText :value="field?.description" class="!h-auto -ml-1" is-form-field read-only sync-value-change />
            </div>

            <NcTooltip :disabled="!field?.read_only">
              <template #title> {{ $t('activity.preFilledFields.lockedFieldTooltip') }} </template>
              <LazySmartsheetDivDataCell v-if="field.title" class="relative nc-form-data-cell">
                <LazySmartsheetVirtualCell
                  v-if="isVirtualCol(field)"
                  v-model="formState[field.title]"
                  class="mt-0 nc-input h-auto"
                  :class="{
                    readonly: field?.read_only,
                  }"
                  :row="{ row: {}, oldRow: {}, rowMeta: {} }"
                  :data-testid="`nc-survey-form__input-${field.title.replaceAll(' ', '')}`"
                  :column="field"
                  :read-only="field?.read_only"
                />

                <LazySmartsheetCell
                  v-else
                  v-model="formState[field.title]"
                  class="nc-input h-auto"
                  :class="{ 'layout-list': parseProp(field?.meta)?.isList, 'readonly': field?.read_only }"
                  :data-testid="`nc-survey-form__input-${field.title.replaceAll(' ', '')}`"
                  :column="field"
                  :edit-enabled="!field?.read_only"
                  :read-only="field?.read_only"
                />

                <div class="flex flex-col gap-2 text-slate-500 dark:text-slate-300 text-[0.75rem] my-2 px-1">
                  <div v-for="error of v$.localState[field.title]?.$errors" :key="error" class="text-red-500">
                    {{ error.$message }}
                  </div>

                  <div v-if="field.uidt === UITypes.LongText" class="text-sm text-gray-500 flex flex-wrap items-center">
                    {{ $t('general.shift') }} <MdiAppleKeyboardShift class="mx-1 text-primary" /> + {{ $t('general.enter') }}
                    <MaterialSymbolsKeyboardReturn class="mx-1 text-primary" /> {{ $t('msg.makeLineBreak') }}
                  </div>
                </div>
              </LazySmartsheetDivDataCell>
            </NcTooltip>
          </div>

          <div class="ml-1 mt-4 flex w-full text-lg">
            <div class="flex-1 flex justify-center">
              <div v-if="isLast && !submitted && !v$.$invalid" class="text-center my-4">
                <NcButton
                  :class="
                    animationTarget === AnimationTarget.SubmitButton && isAnimating
                      ? 'transform translate-y-[1px] translate-x-[1px] ring ring-accent ring-opacity-100'
                      : ''
                  "
                  html-type="submit"
                  data-testid="nc-survey-form__btn-submit"
                  @click="submit"
                >
                  {{ $t('general.submit') }}
                </NcButton>
              </div>

              <div v-else-if="!submitted" class="flex items-center gap-3 flex-col">
                <a-tooltip
                  :title="
                    v$.localState[field.title]?.$error ? v$.localState[field.title].$errors[0].$message : $t('msg.info.goToNext')
                  "
                  :mouse-enter-delay="0.25"
                  :mouse-leave-delay="0"
                >
                  <!-- Ok button for question -->
                  <NcButton
                    data-testid="nc-survey-form__btn-next"
                    :class="[
                      v$.localState[field.title]?.$error || columnValidationError ? 'after:!bg-gray-100 after:!ring-red-500' : '',
                      animationTarget === AnimationTarget.OkButton && isAnimating
                        ? 'transform translate-y-[2px] translate-x-[2px] after:(!ring !ring-accent !ring-opacity-100)'
                        : '',
                    ]"
                    @click="goNext()"
                  >
                    <div class="flex items-center gap-1">
                      <Transition name="fade">
                        <span v-if="!v$.localState[field.title]?.$error" class="uppercase text-white">Ok</span>
                      </Transition>

                      <Transition name="slide-right" mode="out-in">
                        <component
                          :is="iconMap.closeCircle"
                          v-if="v$.localState[field.title]?.$error || columnValidationError"
                          class="text-red-500 md:text-md"
                        />
                        <component :is="iconMap.check" v-else class="text-white md:text-md" />
                      </Transition>
                    </div>
                  </NcButton>
                </a-tooltip>

                <div class="hidden md:flex text-sm text-gray-500 items-center gap-1">
                  {{ $t('labels.pressEnter') }} <MaterialSymbolsKeyboardReturn class="text-primary" />
                </div>
              </div>
            </div>
          </div>

          <Transition name="slide-left">
            <div v-if="submitted" class="flex flex-col justify-center items-center text-center">
              <a-alert
                class="!my-4 !py-4 !rounded-lg text-left w-full"
                type="success"
                data-testid="nc-survey-form__success-msg"
                outlined
              >
                <template #message>
                  <LazyCellRichText
                    v-if="sharedFormView?.success_msg?.trim()"
                    :value="sharedFormView?.success_msg"
                    class="!h-auto -ml-1"
                    is-form-field
                    read-only
                    sync-value-change
                  />
                  <span v-else>
                    {{ $t('msg.info.thankYou') }}
                  </span>
                </template>
                <template v-if="!sharedFormView?.success_msg?.trim()" #description>
                  {{ $t('msg.info.submittedFormData') }}
                </template>
              </a-alert>

              <div v-if="sharedFormView" class="mt-3 w-full">
                <p v-if="sharedFormView?.show_blank_form" class="text-xs text-slate-500 dark:text-slate-300 text-left my-4">
                  {{ $t('labels.newFormLoaded') }} {{ secondsRemain }} {{ $t('general.seconds') }}
                </p>

                <div v-if="sharedFormView?.submit_another_form" class="text-right">
                  <NcButton type="primary" size="medium" data-testid="nc-survey-form__btn-submit-another-form" @click="resetForm">
                    {{ $t('activity.submitAnotherForm') }}
                  </NcButton>
                </div>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </div>

    <template v-if="!submitted">
      <div class="mb-24 md:my-4 select-none text-center text-gray-500 dark:text-slate-200" data-testid="nc-survey-form__footer">
        {{ index + 1 }} / {{ formColumns?.length }}
      </div>
    </template>

    <div class="relative flex w-full items-end">
      <Transition name="fade">
        <div
          v-if="!submitted"
          class="color-transition shadow-sm absolute bottom-18 right-1/2 transform translate-x-[50%] md:bottom-4 md:(right-12 transform-none) flex items-center bg-white border dark:bg-slate-500 rounded divide-x-1"
        >
          <a-tooltip :title="isFirst ? '' : $t('msg.info.goToPrevious')" :mouse-enter-delay="0.25" :mouse-leave-delay="0">
            <button
              :class="
                animationTarget === AnimationTarget.ArrowLeft && isAnimating
                  ? 'transform translate-y-[1px] translate-x-[1px] text-primary'
                  : ''
              "
              class="p-0.5 flex items-center group color-transition"
              data-testid="nc-survey-form__icon-prev"
              @click="goPrevious()"
            >
              <component
                :is="iconMap.chevronLeft"
                :class="isFirst ? 'text-gray-300' : 'group-hover:text-accent'"
                class="text-2xl md:text-md"
              />
            </button>
          </a-tooltip>

          <a-tooltip
            :title="v$.localState[field.title]?.$error ? '' : $t('msg.info.goToNext')"
            :mouse-enter-delay="0.25"
            :mouse-leave-delay="0"
          >
            <button
              :class="
                animationTarget === AnimationTarget.ArrowRight && isAnimating
                  ? 'transform translate-y-[1px] translate-x-[-1px] text-primary'
                  : ''
              "
              class="p-0.5 flex items-center group color-transition"
              data-testid="nc-survey-form__icon-next"
              @click="goNext()"
            >
              <component
                :is="iconMap.chevronRight"
                :class="[isLast || v$.localState[field.title]?.$error ? 'text-gray-300' : 'group-hover:text-accent']"
                class="text-2xl md:text-md"
              />
            </button>
          </a-tooltip>
        </div>
      </Transition>

      <div class="w-full flex justify-center">
        <GeneralFormBranding class="inline-flex mx-auto" />
      </div>
    </div>
  </div>
</template>

<style lang="scss">
:global(html, body) {
  @apply overscroll-x-none;
}

.survey {
  .nc-form-column-label {
    > * {
      @apply !prose-lg;
    }

    .nc-icon {
      @apply mr-2;
    }
  }

  .nc-form-column-label__checkbox {
    @apply flex items-center justify-center gap-2 text-left;
  }

  .nc-form-data-cell.nc-data-cell {
    @apply !border-none rounded-none;

    &:focus-within {
      @apply !border-none;
    }
  }
}
</style>
