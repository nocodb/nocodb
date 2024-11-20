<script lang="ts" setup>

/* interface */

const modelValue = defineModel<string>()


/* internal text */

const internalText = ref('')

watch(modelValue, (value) => {
  internalText.value = value || ''
}, { immediate: true })


/* edit mode */

const inputRef = ref()
const isInEditMode = ref(false)

function goToEditMode() {
  isInEditMode.value = true
  nextTick(() => {
    inputRef.value?.select?.()
  })
}

function finishEdit() {
  isInEditMode.value = false
}

function cancelEdit() {
  isInEditMode.value = false
  internalText.value = modelValue.value || ''
}

</script>


<template>
  <div class="inline-block">
    <template v-if="!isInEditMode">
      <span @click="goToEditMode()" class="cursor-pointer">
        {{ internalText }}
      </span>
    </template>
    <template v-else>
      <a-input
        ref="inputRef"
        class="!rounded-lg !w-72"
        v-model:value="internalText"
        @blur="finishEdit()"
        @keyup.enter="finishEdit()"
        @keyup.esc="cancelEdit()"
      />
    </template>
  </div>
</template>