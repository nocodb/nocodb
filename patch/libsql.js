const fs = require('fs');
const path = require('path');

function patchFile(filePath, isESM) {
  console.log(`Patching ${filePath}...`);

  let content = fs.readFileSync(filePath, 'utf8');

  const valueFromProtoPrefix = isESM ? 'valueFromProto' : '(0, value_js_1.valueFromProto)';

  const regex = /function rowFromProto\(colNames, values, intMode\)[\s\S]+?return row;[\s\S]+?\}/;
  const replacement = `function rowFromProto(colNames, values, intMode) {
    const row = {};
    // make sure that the "length" property is not enumerable
    Object.defineProperty(row, "length", { value: values.length, writable: true, configurable: true });
    for (let i = 0; i < values.length; ++i) {
        const value = ${valueFromProtoPrefix}(values[i], intMode);
        Object.defineProperty(row, i, { value, writable: true, enumerable: true, configurable: true });
        const colName = colNames[i];
        if (colName !== undefined && !Object.hasOwn(row, colName)) {
            Object.defineProperty(row, colName, { value, enumerable: true, writable: true, configurable: true });
        }
    }
    return row;
}`;

  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content);
  console.log(`Successfully patched ${filePath}`);
}

// Patch ESM version
const esmPath = path.join(process.cwd(), 'node_modules/@libsql/hrana-client/lib-esm/result.js');
patchFile(esmPath, true);

// Patch CJS version
const cjsPath = path.join(process.cwd(), 'node_modules/@libsql/hrana-client/lib-cjs/result.js');
patchFile(cjsPath, false);
