<script lang="ts" setup>
import { Api } from 'nocodb-sdk'
import { useNuxtApp } from '#app'
import { useUser } from '~/composables/user'

const { tabMeta, meta } = defineProps({
  tabMeta: Object,
  meta: Object,
})

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
            <th v-for="col in meta.columns">
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
        <!--        <Column v-for="col in meta.columns" :key="col.id" :field="col.title" :header="col.title">
                  <template v-if="col.uidt === 'LinkToAnotherRecord'" #body="{data:{[col.title]:d}}">
                    {{ d && (Array.isArray(d) ? d : [d]).map(c1 => c1[Object.keys(c1)[1]]).join(', ') }}
                  </template>
                </Column> -->
      </v-table>
    </div>
  </div>
</template>

<style scoped>

</style>
