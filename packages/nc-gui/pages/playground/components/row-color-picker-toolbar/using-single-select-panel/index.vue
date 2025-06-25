<script lang="ts" setup>
const vModel = ref({
  is_set_as_background: false,
  fk_column_id: '',
})
const removeClicked = ref(0)

const columns = computed(() => [
  { id: 'col_1', title: 'First Column' },
  { id: 'col_2', title: 'Second Column' },
])
</script>

<template>
  <div class="bg-gray-100">
    <a-card>
      <h4>Simple</h4>
      <div class="flex gap-2">
        <div>
          vModel:
          {{ vModel }}
        </div>
        <div>Remove clicked: {{ removeClicked }}</div>
      </div>
    </a-card>
    <div class="m-4">
      <SmartsheetToolbarRowColorFilterUsingSingleSelectPanel v-model="vModel" :columns="columns" @remove="removeClicked++" />
    </div>
  </div>
</template>
