<template>
  <div>
    <gh-btns-star
      icon="mark-github"
      slug="nocodb/nocodb"
      show-count
      :class="{'dark' : isDark}"
    >
      {{ ghStarText }}
    </gh-btns-star>
  </div>
</template>

<script>
export default {
  name: 'GithubStarBtn',
  data: () => ({ ghStarText: 'Star' }),
  mounted() {
    setInterval(() => this.ghStarText = this.ghStarText === 'Star' ? 'Fork' : 'Star', 60000)
  }
}
</script>

<style scoped>
/deep/ .gh-button-container{
  background: #fff2;
  border-radius: 4px;
  margin:0
}
/deep/ .gh-button-container:not(.dark) > a {
  background: transparent !important;
  color: #cdcdcd !important;
}
/deep/ .gh-button-container > a:first-child{
  border-left-color: transparent;
  border-top-color: transparent;
  border-bottom-color: transparent;
}
/deep/ .gh-button-container > a:last-child{
  border-color: transparent;
}

/deep/ .gh-button, /deep/ .social-count{
  padding:1px 5px;
}
</style>
