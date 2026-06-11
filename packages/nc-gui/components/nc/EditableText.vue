<script lang="ts" setup>
/* interface */

const props = defineProps<{
  disabled?: boolean
}>()

const modelValue = defineModel<string>()

/* internal text */

const internalText = ref('')

watch(
  modelValue,
  (value) => {
    internalText.value = value || ''
  },
  { immediate: true },
)

/* edit mode */

const inputRef = ref()
const isInEditMode = ref(false)

function goToEditMode() {
  if (props.disabled) {
    return
  }
  isInEditMode.value = true
  nextTick(() => {
    inputRef.value?.select?.()
  })
}

function finishEdit() {
  isInEditMode.value = false
  modelValue.value = internalText.value
}

function cancelEdit() {
  isInEditMode.value = false
  internalText.value = modelValue.value || ''
}
</script>

<template>
  <div class="inline-block">
    <template v-if="!isInEditMode">
      <span :class="{ 'cursor-pointer': !disabled }" @dblclick="goToEditMode()">
        {{ internalText }}
      </span>
    </template>
    <template v-else>
      <a-input
        ref="inputRef"
        v-model:value="internalText"
        class="!rounded-lg !w-72"
        @blur="finishEdit()"
        @keyup.enter="finishEdit()"
        @keyup.esc="cancelEdit()"
      />
    </template>
  </div>
</template>
