import { expect } from 'chai';
import 'mocha';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

/**
 * Encodes the postmortem invariants from PR #8883 in CI:
 *
 * 1. `IBaseModelSqlV2` method signatures must match the corresponding
 *    `BaseModelSqlv2` class method signatures (param counts).
 *
 *    The `7e1e7a0bc0` cleanup updated the class but left the interface
 *    declaring the old `_trx` slot. Seven call sites in the split
 *    helpers (`db/BaseModelSqlv2/insert.ts`, `delete.ts`) still passed
 *    `dbDriver` as a positional arg and silently typechecked because
 *    the interface's old shape accepted it. The runtime arg shift broke
 *    the per-row trash audit. (`10f22b33ab` re-aligned them.)
 *
 *    This test would have caught that drift at test time.
 *
 * 2. No `before*`/`after*` data-event hook on `BaseModelSqlv2` (CE or
 *    EE) accepts a `trx` / `_trx` parameter. The whole point of the
 *    cleanup was to encode the architectural rule "audit, webhook,
 *    broadcast must not be coupled to a data trx" in the type system
 *    so it cannot be reintroduced.
 */

const REPO_ROOT = path.resolve(__dirname, '../../..');
const INTERFACE_PATH = path.join(
  REPO_ROOT,
  'src/db/IBaseModelSqlV2.ts',
);
const CLASS_PATH = path.join(
  REPO_ROOT,
  'src/db/BaseModelSqlv2.ts',
);
const EE_CLASS_PATH = path.join(
  REPO_ROOT,
  'src/ee/db/BaseModelSqlv2.ts',
);

const HOOK_NAME_RE = /^(before|after)[A-Z]/;
const TRX_PARAM_RE = /^_?trx$/i;

function parseFile(filePath: string): ts.SourceFile {
  const src = fs.readFileSync(filePath, 'utf8');
  return ts.createSourceFile(
    filePath,
    src,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
}

interface MethodSig {
  name: string;
  paramCount: number;
  paramNames: string[];
}

function collectMethodsFromInterface(
  sourceFile: ts.SourceFile,
  interfaceName: string,
): Map<string, MethodSig> {
  const out = new Map<string, MethodSig>();
  for (const stmt of sourceFile.statements) {
    if (
      !ts.isInterfaceDeclaration(stmt) ||
      stmt.name.text !== interfaceName
    ) {
      continue;
    }
    for (const member of stmt.members) {
      if (!ts.isMethodSignature(member)) continue;
      if (!ts.isIdentifier(member.name)) continue;
      out.set(member.name.text, {
        name: member.name.text,
        paramCount: member.parameters.length,
        paramNames: extractParamNames(member.parameters),
      });
    }
  }
  return out;
}

function collectMethodsFromClass(
  sourceFile: ts.SourceFile,
  className: string,
): Map<string, MethodSig> {
  const out = new Map<string, MethodSig>();
  for (const stmt of sourceFile.statements) {
    if (!ts.isClassDeclaration(stmt)) continue;
    if (!stmt.name || stmt.name.text !== className) continue;
    for (const member of stmt.members) {
      if (!ts.isMethodDeclaration(member)) continue;
      if (!ts.isIdentifier(member.name)) continue;
      out.set(member.name.text, {
        name: member.name.text,
        paramCount: member.parameters.length,
        paramNames: extractParamNames(member.parameters),
      });
    }
  }
  return out;
}

function extractParamNames(
  parameters: ts.NodeArray<ts.ParameterDeclaration>,
): string[] {
  const names: string[] = [];
  for (const p of parameters) {
    if (ts.isIdentifier(p.name)) {
      names.push(p.name.text);
    } else if (ts.isObjectBindingPattern(p.name)) {
      for (const el of p.name.elements) {
        if (ts.isIdentifier(el.name)) {
          names.push(el.name.text);
        }
        if (el.propertyName && ts.isIdentifier(el.propertyName)) {
          names.push(el.propertyName.text);
        }
      }
    }
  }
  return names;
}

function typeAlignmentTests() {
  describe('IBaseModelSqlV2 ↔ BaseModelSqlv2 alignment', () => {
    let interfaceMethods: Map<string, MethodSig>;
    let classMethods: Map<string, MethodSig>;
    let eeClassMethods: Map<string, MethodSig>;

    before(() => {
      interfaceMethods = collectMethodsFromInterface(
        parseFile(INTERFACE_PATH),
        'IBaseModelSqlV2',
      );
      classMethods = collectMethodsFromClass(
        parseFile(CLASS_PATH),
        'BaseModelSqlv2',
      );
      eeClassMethods = fs.existsSync(EE_CLASS_PATH)
        ? collectMethodsFromClass(parseFile(EE_CLASS_PATH), 'BaseModelSqlv2')
        : new Map();
    });

    it('interface methods exist on the CE class with matching param counts', () => {
      expect(interfaceMethods.size, 'interface should declare methods').to.be.greaterThan(
        10,
      );
      expect(classMethods.size, 'class should declare methods').to.be.greaterThan(10);

      const drifts: string[] = [];
      for (const [name, ifaceSig] of interfaceMethods) {
        const classSig = classMethods.get(name);
        if (!classSig) {
          // Some interface methods may be implemented via assignment or
          // inherited. Skip if not declared on the class — TS already
          // enforces `implements` at compile time.
          continue;
        }
        if (classSig.paramCount !== ifaceSig.paramCount) {
          drifts.push(
            `${name}: interface has ${ifaceSig.paramCount} params, class has ${classSig.paramCount}`,
          );
        }
      }

      expect(
        drifts,
        `interface/class param counts must match:\n  ${drifts.join('\n  ')}`,
      ).to.have.lengthOf(0);
    });

    it('no before*/after* hook accepts a trx / _trx parameter (CE)', () => {
      const violations = findHookTrxViolations(classMethods);
      expect(
        violations,
        `data-event hooks must not declare trx/_trx (postmortem invariant). Found:\n  ${violations.join(
          '\n  ',
        )}`,
      ).to.have.lengthOf(0);
    });

    it('no before*/after* hook accepts a trx / _trx parameter (EE)', () => {
      if (!eeClassMethods.size) return; // EE files not present in CE-only checkout
      const violations = findHookTrxViolations(eeClassMethods);
      expect(
        violations,
        `EE data-event hooks must not declare trx/_trx. Found:\n  ${violations.join(
          '\n  ',
        )}`,
      ).to.have.lengthOf(0);
    });

    it('no before*/after* hook on the interface declares trx / _trx', () => {
      const violations = findHookTrxViolations(interfaceMethods);
      expect(
        violations,
        `interface data-event hooks must not declare trx/_trx. Found:\n  ${violations.join(
          '\n  ',
        )}`,
      ).to.have.lengthOf(0);
    });
  });
}

function findHookTrxViolations(methods: Map<string, MethodSig>): string[] {
  const out: string[] = [];
  for (const [name, sig] of methods) {
    if (!HOOK_NAME_RE.test(name)) continue;
    for (const param of sig.paramNames) {
      if (TRX_PARAM_RE.test(param)) {
        out.push(`${name}(${sig.paramNames.join(', ')})`);
        break;
      }
    }
  }
  return out;
}

export { typeAlignmentTests };
