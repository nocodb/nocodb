import {defineComponent, h} from "vue";

export default defineComponent({
    name: "TwitterIcon",
    setup() {
        return () => {
            return h("img", {
                width: "24",
                height: "24",
                src: "https://app.nocodb.com/twitter.png",
                alt: "Twitter Icon",
            });
        };
    },
});
