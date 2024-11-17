import {defineComponent, h} from "vue";

export default defineComponent({
    name: "Header",
    setup() {
        return () => {
            return h(
                "div",
                {
                    style: {
                        width: "100%",
                        'background-color': "#f4f4f5",
                        'padding-top': "48px",
                        'padding-bottom': "48px",
                        'text-align': "center",
                    },
                },
                [
                    h("img", {
                        src: "https://cdn.nocodb.com/email/logo.png",
                        alt: "NocoDB",
                        style: {
                            height: "48px",
                        },
                    }),
                ]
            );
        };
    },
});
