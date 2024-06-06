import {defineComponent, h} from "vue";

export default defineComponent({
    name: "LinkedinIcon",
    setup() {
        return () => {
            return h(
                "img",
                {
                    src: "https://app.nocodb.com/linkedin.png",
                    alt: "LinkedIn Icon",
                    width: "24",
                    height: "24",
                },
            );
        };
    },
});
