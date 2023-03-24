import { validatePayload } from '../meta/api/helpers';
import Store from '../models/Store';
import Noco from '../Noco';

export async function customizationGet() {
  const css = await Store.get('customization-css');
  const js = await Store.get('customization-js');

  return {css: css.value, js: js.value};
}

export async function customizationSet(param: { css: string, js: string }) {
  validatePayload('swagger.json#/components/schemas/CustomizationReq', param);

  await Store.saveOrUpdate({ value: param.css, key: 'customization-css' });
  await Store.saveOrUpdate({ value: param.js, key: 'customization-js' });
  await Noco.loadEEState();
  return true;
}
