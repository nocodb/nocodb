export default {
  name: 'DynamicStyle',
  render(createElement) {
    return createElement('style', this.$slots.default)
  }
}
