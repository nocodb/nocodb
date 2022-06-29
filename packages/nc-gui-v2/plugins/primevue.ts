import {defineNuxtPlugin} from "#app";
import PrimeVue from "primevue/config";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Toast from "primevue/toast";
import Card from "primevue/card";
import Sidebar from "primevue/sidebar";
import ToastService from 'primevue/toastservice';

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.use(PrimeVue, {ripple: true});
  nuxtApp.vueApp.use(ToastService);
  nuxtApp.vueApp.component('Button', Button);
  nuxtApp.vueApp.component('InputText', InputText);
  nuxtApp.vueApp.component('Toast', Toast);
  nuxtApp.vueApp.component('Card', Card);
  nuxtApp.vueApp.component('Sidebar', Sidebar);
  //other components that you need
});
