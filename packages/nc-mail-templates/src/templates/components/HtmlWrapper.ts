import {defineComponent, h} from "vue";

export default defineComponent({
    name: "HtmlWrapper",
    setup(_, { slots }) {
        return () => {
            return h(
                "html",
                {
                    dir: "ltr",
                    lang: "en",
                },
                [
                    h("head", {}, [
                        h("meta", { charset: "utf-8" }),
                        h("meta", { name: "x-apple-disable-message-reformatting" }),
                        h("meta", {
                            content: "text/html; charset=UTF-8",
                            "http-equiv": "Content-Type",
                        }),
                        h("meta", { name: "viewport", content: "width=device-width" }),
                        h("link", {
                            href: "https://fonts.googleapis.com/css?family=Manrope",
                            rel: "stylesheet",
                            type: "text/css",
                        }),
                        h(
                            "style",
                            {},
                            `
                @font-face {
                    src: url(https://fonts.gstatic.com/s/manrope/v15/xn7gYHE41ni1AdIRggqxSvfedN62Zw.woff2) format('woff2');
                    font-family: Maprope, sans-serif;
                }

                * {
                    font-family: Manrope, sans-serif;
                }

                body {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    font-family: Manrope, sans-serif;
                }
                `
                        ),
                    ]),
                    h("body", {}, slots?.default()),
                ]
            );
        };
    },
});
