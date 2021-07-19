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
              <nuxt-link :to="`/nc/view/${link.view_id}`">
                {{ `${origin}/dashboard#/xc/view/${link.view_id}` }}
              </nuxt-link>
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
      this.viewsList = await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.nodes.dbAlias }, 'listSharedViewLinks', {
        model_name: this.modelName
      }])
    },
    async deleteLink(id) {
      try {
        await this.$store.dispatch('sqlMgr/ActSqlOp', [{ dbAlias: this.nodes.dbAlias }, 'deleteSharedViewLink', {
          id
        }])
        this.$toast.success('Deleted shared view successfully').goAway(3000)
        this.loadSharedViewsList()
      } catch (e) {
        this.$toast.error(e.message).goAway(3000)
      }
    }
  }
}
</script>

<style scoped>

</style>
