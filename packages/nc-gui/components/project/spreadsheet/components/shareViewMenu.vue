<template>
  <div>
    <v-btn
      v-t="['share-view:trigger']"
      v-if="_isUIAllowed('add-user')"
      outlined
      class="nc-btn-share-view caption px-2 nc-remove-border font-weight-medium"
      small
      text
      @click="$emit('share')"
    >
      <v-icon size="13" class="mr-1" color="#777">
        mdi-open-in-new
      </v-icon>
      <!-- Share View -->
      {{ $t('activity.shareView') }}
    </v-btn>
  </div>
</template>

<script>
export default {
  name: 'ShareViewMenu'
}
</script>

  <style scoped />
