export const dataApiV3Test = async () => {
  await import('./error-handling.test');
  await import('./get-list.test');
  await import('./get-record.test');
  await import('./post-insert.test');
  await import('./patch-update.test');
  await import('./delete.test');
  await import('./list-and-crud.test');
};
