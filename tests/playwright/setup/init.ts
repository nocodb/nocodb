/* import express from 'express';
import { initializeSakilaTemplatePg } from './knexHelper';

const app = express();

async function init() {
  await initializeSakilaTemplatePg();
  app.listen(8001, () => {
    console.log('Initialized');
  });
}

app.get('/', (_req, res) => {
  res.send('OK');
});

init();
*/
