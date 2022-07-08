<script setup lang="ts">
import { computed, inject } from 'vue'
import { ChangePageInj, PaginationDataInj } from '~/components'
import MdiKeyboardIcon from '~icons/mdi/keyboard-return'

const paginatedData = inject(PaginationDataInj)

const changePage = inject(ChangePageInj)

const count = computed(() => paginatedData?.value?.totalRows ?? Infinity)

const size = computed(() => paginatedData?.value?.pageSize ?? 25)

const page = computed({
  get: () => paginatedData?.value?.page ?? 1,
  set: (p) => changePage?.(p),
})
/*
export default {
  name: 'Pagination',
  props: {
    count: [Number, String],
    value: [Number, String],
    size: [Number, String],
  },
  data: () => ({
    page: 1,
  }),
  watch: {
    value(v) {
      this.page = v
    },
    count(c) {
      const page = Math.max(1, Math.min(this.page, Math.ceil(c / this.size)))
      if (this.value !== page) {
        this.$emit('input', page)
      }
    },
  },
  mounted() {
    this.page = this.value
  },
}
*/
</script>

<template>
  <div class="d-flex align-center">
    <span v-if="count !== null && count !== Infinity" class="caption ml-2"> {{ count }} record{{ count !== 1 ? 's' : '' }} </span>
    <v-spacer />
    <v-pagination
      v-if="count !== Infinity"
      v-model="page"
      style="max-width: 100%"
      :length="Math.ceil(count / size)"
      :total-visible="8"
      color="primary lighten-2"
      class="nc-pagination"
    />
    <div v-else class="mx-auto d-flex align-center mt-n1" style="max-width: 250px">
      <span class="caption" style="white-space: nowrap"> Change page:</span>
      <v-text-field
        :value="page"
        class="ml-1 caption"
        :full-width="false"
        outlined
        dense
        hide-details
        type="number"
        @keydown.enter="changePage(page)"
      >
        <template #append>
          <MdiKeyboardIcon small icon.class="mt-1" @click="changePage(page)" />
        </template>
      </v-text-field>
    </div>

    <v-spacer />
    <v-spacer />
  </div>
</template>
