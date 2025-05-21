const path = require('path');

exports.resolveTsAliases = (tsconfigPath) => {
  const { baseUrl, paths } = require(tsconfigPath).compilerOptions;
  const pathPrefix = path.resolve(path.dirname(tsconfigPath), baseUrl);
  const aliases = {};
  Object.keys(paths).forEach((item) => {
    const name = item.replace('/*', '');
    const value = paths[item].map((p) =>
      path.resolve(pathPrefix, p.replace('/*', '')),
    );
    aliases[name] = value;
  });
  return aliases;
};
