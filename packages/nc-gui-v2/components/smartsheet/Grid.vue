<script lang="ts" setup>
import { useNuxtApp } from '#app'
import { useUser } from '~/composables/user'

interface Props {
  tabMeta: Record<string, any>
  meta: Record<string, any>
}

const { tabMeta, meta } = defineProps<Props>()

const { project } = useProject()
const { user } = useUser()
const rows = ref()

const { $api } = useNuxtApp()

const loadData = async () => {
  const response = await $api.dbTableRow.list('noco',
    project.value.id,
    meta.id, {}, {
      headers: {
        'xc-auth': user.token,
      },
    })

  rows.value = response.list
}

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <div>
    <div class="card">
      <v-table>
        <thead>
          <tr>
            <th v-for="(col, i) of meta.columns" :key="`${col.title}-${i}`">
              {{ col.title }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="i">
            <th v-for="col in meta.columns" :key="col.title">
              {{ row[col.title] }}
            </th>
          </tr>
        </tbody>
      </v-table>
    </div>
  </div>
</template>

<style scoped>

</style>
