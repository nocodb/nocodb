import { input, select } from "@inquirer/prompts";

import * as prettier from "prettier";

// Function to dynamically generate a TypeScript class based on a given interface and class name
import * as ts from "typescript";
import * as fs from "fs";
import * as path from "path";

// Integrations Root
const rootPath = path.resolve(
  __dirname,
  "..",
  "..",
  "nocodb",
  "src",
  "integrations"
);

// Function to read the abstract class file and generate a new class
async function generateEntryBoilerplate(type: string, subType: string) {
  const filePath = `${rootPath}/${type}/${type}.interface.ts`;

  // Step 1: Read the content of the file
  const fileContent = fs.readFileSync(filePath, "utf-8");

  // Step 2: Use TypeScript Compiler API to parse the source file
  const sourceFile = ts.createSourceFile(
    path.basename(filePath),
    fileContent,
    ts.ScriptTarget.Latest,
    true
  );

  // Step 3: Traverse the AST to find the abstract class
  let abstractClassName = "";
  const abstractMethods: {
    name: string;
    parameters: string;
    returnType: string;
    typeParameters: string;
    async: boolean;
    scope?: "public" | "private" | "protected";
  }[] = [];
  const abstractFields: {
    name: string;
    type: string;
    scope?: "public" | "private" | "protected";
  }[] = [];
  const imports: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isClassDeclaration(node) &&
      node.modifiers?.some((m) => m.kind === ts.SyntaxKind.AbstractKeyword)
    ) {
      abstractClassName = node.name!.text;
      node.members.forEach((member) => {
        if (
          ts.isMethodDeclaration(member) &&
          member.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.AbstractKeyword
          )
        ) {
          const methodName = member.name.getText();
          const parameters = member.parameters
            ?.map((p) => p.getText())
            .join(", ");
          const returnType = member.type?.getText() ?? "void";
          const typeParameters = member.typeParameters
            ?.map((p) => p.getText())
            .join(", ");

          let scope: "public" | "private" | "protected" = "public";

          if (member.modifiers) {
            if (
              member.modifiers.some(
                (m) => m.kind === ts.SyntaxKind.PrivateKeyword
              )
            ) {
              scope = "private";
            } else if (
              member.modifiers.some(
                (m) => m.kind === ts.SyntaxKind.ProtectedKeyword
              )
            ) {
              scope = "protected";
            }
          }

          let async = false;

          if (returnType.includes("Promise")) {
            async = true;
          }

          abstractMethods.push({
            name: methodName,
            parameters,
            returnType,
            typeParameters,
            scope,
            async,
          });
        }
      });
    }

    // Extract fields from the abstract class
    if (ts.isPropertyDeclaration(node)) {
      const name = node.name.getText();
      const type = node.type?.getText() ?? "any";

      let scope: "public" | "private" | "protected" = "public";

      if (node.modifiers) {
        if (
          node.modifiers.some((m) => m.kind === ts.SyntaxKind.PrivateKeyword)
        ) {
          scope = "private";
        } else if (
          node.modifiers.some((m) => m.kind === ts.SyntaxKind.ProtectedKeyword)
        ) {
          scope = "protected";
        }
      }

      abstractFields.push({ name, type, scope });
    }

    // Extract imports
    if (ts.isImportDeclaration(node)) {
      if (node.importClause.getText() !== "IntegrationWrapper") {
        imports.push(node.getText());
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  if (!abstractClassName) {
    throw new Error("No abstract class found in the provided file.");
  }

  const newClassName = `${subType.charAt(0).toUpperCase()}${subType.slice(
    1
  )}Integration`;

  // Step 4: Generate the new class code
  let boilerplate = `${imports.join("\n")}\n`;
  boilerplate += `import ${abstractClassName} from '~/integrations/${type}/${type}.interface';\n\n`;
  boilerplate += `export default class ${newClassName} extends ${abstractClassName} {\n`;

  abstractFields.forEach((field) => {
    boilerplate += `  ${field.scope} ${field.name}: ${field.type};\n`;
  });

  boilerplate += `\n`;

  abstractMethods.forEach((method) => {
    boilerplate += `  ${method.scope}${method.async ? " async" : ""} ${
      method.name
    }${method.typeParameters?.length ? `<${method.typeParameters}>` : ""}(${
      method.parameters ?? ""
    }): ${method.returnType} {\n`;
    boilerplate += `    // TODO: Implement ${method.name}\n`;
    boilerplate += `    return ${
      method.returnType === "void" ? "" : "null"
    };\n`;
    boilerplate += `  }\n`;
  });

  boilerplate += `}\n`;

  fs.mkdirSync(`${rootPath}/${type}/${subType}`, {
    recursive: true,
  });

  const outputFile = `${rootPath}/${type}/${subType}/entry.ts`;

  const options = await prettier.resolveConfig(outputFile);

  fs.writeFileSync(
    outputFile,
    prettier.format(boilerplate, { ...options, parser: "typescript" })
  );
}

async function generateFormBoilerplate(type: string, subType: string) {
  const formFile = `${rootPath}/${type}/${subType}/form.ts`;

  const dynamicComponents = [];

  while (true) {
    console.clear();

    const menu = await select({
      message: "Select component type",
      choices: [
        { name: "Input", value: "Input" },
        { name: "Select", value: "Select" },
        { name: "Space", value: "Space" },
        { name: "Exit", value: "Exit" },
      ],
    });

    if (menu === "Exit") {
      break;
    }

    const label = await input({
      message: "Enter label for the field",
    });

    const width = await input({
      message: "Enter percent width for the field (0-100)",
    });

    const model = await input({
      message:
        "Enter property name for the field \nYou will be able to access this value in the integration via this.getConfig().{property}\n",
    });

    const category = await input({
      message: "Enter category for the field",
    });

    const placeholder = await input({
      message: "Enter placeholder for the field (leave empty if none)",
    });

    const options = [];

    let selectMode: 'single' | 'multiple' | 'multipleWithInput';

    if (menu === "Select") {
      let counter = 0;

      // 'single' | 'multiple' | 'multipleWithInput'
      selectMode = await select({
        message: "Select selectMode",
        choices: [
          { name: "Single", value: "single" },
          { name: "Multiple", value: "multiple" },
          { name: "Multiple with Input", value: "multipleWithInput" },
        ],
      });

      while (true) {
        counter++;

        const optionLabel = await input({
          message: `Enter label for option #${counter}`,
        });

        const value = await input({
          message: `Enter value for option #${counter}`,
        });

        options.push({ value, label: optionLabel });

        const addMore = await select({
          message: "Add more options?",
          choices: [
            { name: "Yes", value: "Yes" },
            { name: "No", value: "No" },
          ],
        });

        if (addMore === "No") {
          break;
        }
      }
    }

    const defaultValue = await input({
      message: "Enter default value (leave empty if none)",
    });

    const isRequired = await select({
      message: "Is this field required?",
      choices: [
        { name: "Yes", value: true },
        { name: "No", value: false },
      ],
    });

    dynamicComponents.push(
      `{
      type: FormBuilderInputType.${menu},
      label: '${label}',
      width: ${width},
      model: 'config.${model}',
      category: '${category}',` +
        `${placeholder ? `\nplaceholder: '${placeholder}',\n` : ""}` +
        `${menu === "Select" ? `selectMode: '${selectMode}',\n` : ""}` +
        `${
          menu === "Select" ? `options: ${JSON.stringify(options)},\n` : ""
        }` +
        `${defaultValue ? `defaultValue: '${defaultValue}',\n` : ""}` +
        `${
          isRequired
            ? `validators: [\n  {\n    type: 'required',\n    message: '${label} is required',\n  }],\n`
            : ""
        }` +
        `}`
    );
  }

  const boilerplate = `import { FormBuilderInputType } from 'nocodb-sdk';
export default [
  {
    type: FormBuilderInputType.Input,
    label: 'Integration name',
    width: 100,
    model: 'title',
    placeholder: 'Integration name',
    category: 'General',
    validators: [
      {
        type: 'required',
        message: 'Integration name is required',
      },
    ],
  },
  ${dynamicComponents.join(",\n  ")}
];`;

  const options = await prettier.resolveConfig(formFile);

  fs.writeFileSync(
    formFile,
    prettier.format(boilerplate, { ...options, parser: "typescript" })
  );
}

async function generateManifest(type: string, subType: string) {
  const manifestFile = `${rootPath}/${type}/${subType}/manifest.ts`;

  console.clear();

  const title = await input({
    message: "Enter title for integration",
  });

  const icon = await input({
    message: "Enter icon URL or name",
  });

  const boilerplate = `export default {
  title: '${title}',
  icon: '${icon}',
};`;

  const options = await prettier.resolveConfig(manifestFile);

  fs.writeFileSync(
    manifestFile,
    prettier.format(boilerplate, { ...options, parser: "typescript" })
  );
}

/*
NocoDB Integration tool
- NocoDB have following categories of integrations:
  - AI (ai)
  - Sync (sync)
- This tool will help you to create a boilerplate for creating a new subType for category
- This tool will create following files:
  - src/integrations/{type}/{subType}/entry.ts
    - This file will refer to type abstract class and implement the required methods (src/integrations/{type}/{type}.interface.ts)
  - src/integrations/{type}/{subType}/form.ts
    - This file will have FormDefinition with bare minimum fields required for the subType
  - src/integrations/{type}/{subType}/manifest.ts
    - This file will have metadata about the subType
*/

async function main() {
  const type = await select({
    message: "Select type",
    choices: [
      { name: "AI", value: "ai" },
      { name: "Sync", value: "sync" },
    ],
  });

  const subType = await input({
    message: "Enter subType you want to create",
  });

  const entryFile = `${rootPath}/${type}/${subType}/entry.ts`;
  const formFile = `${rootPath}/${type}/${subType}/form.ts`;
  const manifestFile = `${rootPath}/${type}/${subType}/manifest.ts`;

  // check if any of these exists and abort process if so
  if (fs.existsSync(entryFile)) {
    console.error(`Entry file already exists: ${entryFile}`);
    return;
  }

  if (fs.existsSync(formFile)) {
    console.error(`Form file already exists: ${formFile}`);
    return;
  }

  if (fs.existsSync(manifestFile)) {
    console.error(`Manifest file already exists: ${manifestFile}`);
    return;
  }

  // generate class from interface
  await generateEntryBoilerplate(type, subType);

  // generate form file
  await generateFormBoilerplate(type, subType);

  // generate manifest file
  await generateManifest(type, subType);
}

main();
