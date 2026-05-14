export function commandRegistryTests() {
  require('./registry.spec');
  require('./record.spec');
  require('./resolvers.spec');
  require('./scope.spec');
  require('./contract-scope.spec');
  require('./replay-scope.spec');
  require('./decorator.spec');
  require('./replay-context.spec');
}
