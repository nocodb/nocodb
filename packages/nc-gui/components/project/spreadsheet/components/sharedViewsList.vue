<template>
  <v-card max-width="900">
    <v-container>
      <v-simple-tables dense>
        <thead>
          <tr>
            <th class="caption">
              View Link
            </th>
            <th class="caption">
              View name
            </th>
            <th class="caption">
              Password
            </th>
            <th class="caption">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="link of viewsList" :key="link.id">
            <td class="caption">
              <nuxt-link :to="`/nc/${link.view_type === 'form' ? 'form' : 'view'}/${link.view_id}`">
                {{ `${dashboardUrl}#/nc/${link.view_type === 'form' ? 'form' : 'view'}/${link.view_id}` }}
              </nuxt-link>
            </td>
            <td class="caption">
              {{ link.view_name }}
            </td>
            <td class="caption">
              <template v-if="link.password">
                <span>{{ link.showPassword ? link.password : '***************************' }}</span>
                <v-icon small @click="$set(link, 'showPassword' , !link.showPassword)">
                  {{ link.showPassword ? 'visibility_off' : 'visibility' }}
                </v-icon>
              </template>
            </td>
            <td class="caption">
              <v-icon small @click="deleteLink(link.id)">
                mdi-delete-outline
              </v-icon>
            </td>
          </tr>
        </tbody>
      </v-simple-tables>
    </v-container>
  </v-card>
</template>

<script>
export default {
  name: 'SharedViewsList',
  props: ['modelName', 'nodes'],
  data: () => ({
    viewsList: null
  }),
  computed: {
    origin() {
      return location.origin
    }
  },
  created() {
    this.loadSharedViewsList()
  },
  methods: {
    async loadSharedViewsList() {
      const viewsList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.nodes.dbAlias }, 'listSharedViewLinks', {
        model_name: this.modelName
      }])

      const index = viewsList.findIndex(v => (v.view_name || '').toLowerCase() === (this.$route.query.view || '').toLowerCase())
      if (index > -1) {
        viewsList.unshift(...viewsList.splice(index, 1))
      }

      this.viewsList = viewsList
    },
    async deleteLink(id) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.nodes.dbAlias }, 'deleteSharedViewLink', {
          id
        }])
        this.$toast.success('Deleted shared view successfully').goAway(3000)
        await this.loadSharedViewsList()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>
th, td {
  padding: 0 5px;
}
</style>
