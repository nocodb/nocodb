/*
  Script to compare two package.json files and update the version with latest version from the other file
*/

const fs = require("fs");
const path = require("path");
const compare = require("compare-versions");

const compareVersions = compare.compareVersions;
const validate = compare.validate;

const packageJsons = [
  {
    path: path.join(__dirname, "../../packages/nocodb/package.json"),
  },
  {
    path: path.join(__dirname, "../../../nocodb/packages/nocodb/package.json"),
  },
  {
    path: path.join(__dirname, "../../packages/nc-gui/package.json"),
  },
  {
    path: path.join(__dirname, "../../../nocodb/packages/nc-gui/package.json"),
  },
  {
    path: path.join(__dirname, "../../packages/nocodb-sdk/package.json"),
  },
  {
    path: path.join(
      __dirname,
      "../../../nocodb/packages/nocodb-sdk/package.json"
    ),
  },
];

packageJsons.forEach((p) => {
  if (!fs.existsSync(p.path)) {
    console.error(`File not found: ${p.path}`);
    process.exit(1);
  }

  p.json = JSON.parse(fs.readFileSync(p.path));
});

const workspacePackageVersions = {};

for (const pjson of packageJsons) {
  scanVersions(pjson.json.dependencies);
  scanVersions(pjson.json.devDependencies);
}

for (const pjson of packageJsons) {
  updateVersions(pjson.json.dependencies);
  updateVersions(pjson.json.devDependencies);
}

for (const pjson of packageJsons) {
  fs.writeFileSync(pjson.path, `${JSON.stringify(pjson.json, null, 2)}\n`);
}

function scanVersions(dependencies) {
  for (const key in dependencies) {
    const version = dependencies[key].replace(/[\^\~]/, "");
    if (validate(version)) {
      if (workspacePackageVersions[key]) {
        if (compareVersions(version, workspacePackageVersions[key]) === 1) {
          workspacePackageVersions[key] = version;
        }
      } else {
        workspacePackageVersions[key] = version;
      }
    }
  }
}

function updateVersions(dependencies) {
  for (const key in dependencies) {
    const version = dependencies[key].replace(/[\^\~]/, "");
    if (validate(version)) {
      if (compareVersions(version, workspacePackageVersions[key]) === -1) {
        console.log(
          `Updating ${key} from ${version} to ${workspacePackageVersions[key]}`
        );
        dependencies[key] = dependencies[key].replace(
          version,
          workspacePackageVersions[key]
        );
      }
    }
  }
}
