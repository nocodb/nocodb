import { defineComponent, h } from 'vue'
import JsBarcode from 'jsbarcode'

// TODO: add proper reference for the origin of this code here
export default defineComponent({
  name: 'JsBarcodeWrapper',

  props: {
    /**
     * The value of the bar code.
     */
    value: {
      type: String,
      default: undefined,
    },

    /**
     * The options for the bar code generator.
     * {@link https://github.com/lindell/JsBarcode#options}
     */
    options: {
      type: Object,
      default: undefined,
    },

    /**
     * The tag name of the component's root element.
     */
    tag: {
      type: String,
      default: 'canvas',
    },
  },

  watch: {
    $props: {
      deep: true,
      immediate: true,

      /**
       * Update the bar code when props changed.
       */
      handler() {
        if (this.$el) {
          this.generate()
        }
      },
    },
  },

  mounted() {
    this.generate()
  },

  methods: {
    /**
     * Generate bar code.
     */
    generate() {
      JsBarcode(this.$el, String(this.value), this.options)
    },
  },

  render() {
    return h(this.tag, this.$slots.default)
  },
})
