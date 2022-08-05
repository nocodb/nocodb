<script setup lang="ts">
const loadComments = async () => {
  const data = await this.$api.utils.commentList({
    row_id: this.meta.columns
      .filter((c) => c.pk)
      .map((c) => this.localState[c.title])
      .join('___'),
    fk_model_id: this.meta.id,
    comments_only: this.commentsOnly,
  })
}
</script>

<template></template>

<style scoped></style>
