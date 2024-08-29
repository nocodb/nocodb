import {defineComponent, h} from "vue";

export default defineComponent({
    name: "LinkedinIcon",
    setup() {
        return () => {
            return h(
                "img",
                {
                    src: "https://cdn.nocodb.com/email/linkedin.png",
                    alt: "LinkedIn Icon",
                    width: "24",
                    height: "24",
                },
            );
        };
    },
});
