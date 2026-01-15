import { workflowJsep } from '~/lib/formula/jsepInstances';

/**
 * Security Error for workflow expression parser
 */
export class WorkflowSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowSecurityError';
  }
}

/**
 * Evaluation Error for workflow expression parser
 */
export class WorkflowEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowEvaluationError';
  }
}

/**
 * Symbol used to identify arrow function wrappers
 */
const ARROW_FN_SYMBOL = Symbol('WorkflowArrowFunction');

/**
 * Wrapper for arrow function AST nodes
 * This allows us to pass arrow functions to array methods without creating actual JS functions
 */
interface ArrowFunctionWrapper {
  readonly [ARROW_FN_SYMBOL]: true;
  readonly params: string[];
  readonly body: any;
}

/**
 * Whitelisted string methods that are safe to execute
 */
const SAFE_STRING_METHODS = new Set([
  'toUpperCase',
  'toLowerCase',
  'trim',
  'slice',
  'substring',
  'charAt',
  'charCodeAt',
  'indexOf',
  'lastIndexOf',
  'split',
  'replace',
  'startsWith',
  'endsWith',
  'includes',
  'repeat',
  'padStart',
  'padEnd',
  'concat',
  'toString',
  'valueOf',
]);

/**
 * Whitelisted array methods that are safe to execute
 * Note: Mutating methods (push, pop, shift, unshift, reverse, sort) are excluded
 */
const SAFE_ARRAY_METHODS = new Set([
  'join',
  'concat',
  'slice',
  'indexOf',
  'lastIndexOf',
  'includes',
  'find',
  'findIndex',
  'filter',
  'map',
  'reduce',
  'some',
  'every',
]);

/**
 * Whitelisted number methods that are safe to execute
 */
const SAFE_NUMBER_METHODS = new Set([
  'toFixed',
  'toPrecision',
  'toExponential',
  'toString',
]);

/**
 * Whitelisted object methods that are safe to execute
 */
const SAFE_OBJECT_METHODS = new Set(['toString', 'valueOf']);

/**
 * Maximum recursion depth to prevent stack overflow
 */
const MAX_RECURSION_DEPTH = 100;

/**
 * Maximum array/string length to prevent DoS
 */
const MAX_COLLECTION_SIZE = 10000;

/**
 * Maximum number of iterations in loops
 */
const MAX_ITERATIONS = 1000;

/**
 * Precompiled regex for interpolation to prevent ReDoS
 * Uses character class [^{}] to avoid backtracking on nested braces
 */
const INTERPOLATION_REGEX = /\{\{\s*([^{}]+?)\s*}}/g;

/**
 * Secure sandboxed expression parser for automation workflows.
 * Uses AST interpretation (jsep) to safely evaluate expressions without eval.
 */
export class WorkflowExpressionParser {
  private context: Record<string, unknown>;
  private currentNodeData: unknown;
  private inputData: unknown;
  private recursionDepth: number;
  private iterationCount: number;
  private localScope: Record<string, unknown>;

  constructor() {
    this.context = {};
    this.currentNodeData = null;
    this.inputData = null;
    this.recursionDepth = 0;
    this.iterationCount = 0;
    this.localScope = {};
  }

  /**
   * Set the context data (workflow nodes)
   * @param context - Object mapping node names to their data
   */
  public setContext(context: Record<string, unknown>): void {
    if (typeof context !== 'object' || context === null) {
      throw new WorkflowEvaluationError('Context must be a non-null object');
    }
    // Deep validate context data for security
    this.validateContextData(context);
    this.context = context;
  }

  /**
   * Set the current node data (accessible via $json)
   * @param data - Current node data
   */
  public setCurrentNodeData(data: unknown): void {
    this.currentNodeData = data;
  }

  /**
   * Set the input data (accessible via $input)
   * @param data - Input data
   */
  public setInputData(data: unknown): void {
    this.inputData = data;
  }

  /**
   * Process a string containing {{ }} interpolations
   * @param input - String with expressions to evaluate
   * @returns Processed string with expressions replaced
   */
  public processString(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Reset counters for each top-level evaluation
    this.recursionDepth = 0;
    this.iterationCount = 0;

    // Reset regex lastIndex for safety (global regex maintains state)
    INTERPOLATION_REGEX.lastIndex = 0;

    return input.replace(INTERPOLATION_REGEX, (_match, expression) => {
      try {
        const result = this.evaluate(expression);
        return this.stringifyResult(result);
      } catch (error) {
        // Return original match if evaluation fails
        console.error('Expression evaluation error:', error);
        throw error;
      }
    });
  }

  /**
   * Evaluate a single expression
   * @param expression - Expression string to evaluate
   * @returns Evaluation result
   */
  public evaluate(expression: string): unknown {
    if (typeof expression !== 'string') {
      throw new WorkflowEvaluationError('Expression must be a string');
    }

    // Reset counters
    this.recursionDepth = 0;
    this.iterationCount = 0;

    try {
      const ast = workflowJsep(expression);
      return this.evaluateNode(ast);
    } catch (error) {
      if (
        error instanceof WorkflowSecurityError ||
        error instanceof WorkflowEvaluationError
      ) {
        throw error;
      }
      throw new WorkflowEvaluationError(
        `Failed to evaluate expression: ${error.message}`
      );
    }
  }

  /**
   * Evaluate an AST node
   * @param node - AST node to evaluate
   * @returns Evaluation result
   */
  private evaluateNode(node: any): unknown {
    // Check recursion depth
    this.recursionDepth++;
    if (this.recursionDepth > MAX_RECURSION_DEPTH) {
      throw new WorkflowSecurityError('Maximum recursion depth exceeded');
    }

    try {
      switch (node.type) {
        case 'Literal':
          return node.value;

        case 'Identifier':
          return this.evaluateIdentifier(node.name);

        case 'MemberExpression':
          return this.evaluateMemberExpression(node);

        case 'CallExpression':
          return this.evaluateCallExpression(node);

        case 'BinaryExpression':
          return this.evaluateBinaryExpression(node);

        case 'UnaryExpression':
          return this.evaluateUnaryExpression(node);

        case 'ConditionalExpression':
          return this.evaluateConditionalExpression(node);

        case 'ArrayExpression':
          return this.evaluateArrayExpression(node);

        case 'LogicalExpression':
          return this.evaluateLogicalExpression(node);

        case 'TemplateLiteral':
          return this.evaluateTemplateLiteral(node);

        case 'ArrowFunctionExpression':
          return this.createArrowFunction(node);

        default:
          throw new WorkflowSecurityError(
            `Unsupported node type: ${node.type}`
          );
      }
    } finally {
      this.recursionDepth--;
    }
  }

  /**
   * Evaluate an identifier (variable name)
   */
  private evaluateIdentifier(name: string): unknown {
    // Check local scope first (for arrow function parameters)
    if (name in this.localScope) {
      return this.localScope[name];
    }

    // Check for dangerous identifiers
    this.validateIdentifier(name);

    // Handle special identifiers
    if (name === '$json') {
      return this.currentNodeData;
    }
    if (name === '$input') {
      return this.inputData;
    }

    // Return undefined for unknown identifiers
    return undefined;
  }

  /**
   * Evaluate a member expression (e.g., obj.prop or obj[prop])
   */
  private evaluateMemberExpression(node: any): unknown {
    const object = this.evaluateNode(node.object);

    if (object === null || object === undefined) {
      return undefined;
    }

    let property: string | number;
    if (node.computed) {
      // Bracket notation: obj[expr]
      property = this.evaluateNode(node.property) as string | number;
    } else {
      // Dot notation: obj.prop
      property = node.property.name;
    }

    // Validate property access
    this.validatePropertyAccess(property);

    // Safe property access
    return this.safePropertyAccess(object, property);
  }

  /**
   * Evaluate a call expression (function call)
   */
  private evaluateCallExpression(node: any): unknown {
    // Evaluate arguments first
    const args = node.arguments.map((arg: any) => this.evaluateNode(arg));

    // Check if it's a built-in function
    if (node.callee.type === 'Identifier') {
      const fnName = node.callee.name;

      // Handle special functions
      if (fnName === '$') {
        return this.handleNodeAccess(args);
      }

      // Handle built-in functions
      const builtInFn = this.getBuiltInFunction(fnName);
      if (builtInFn) {
        return builtInFn(...args);
      }

      throw new WorkflowSecurityError(`Unknown function: ${fnName}`);
    }

    // Handle method calls (e.g., str.toUpperCase())
    if (node.callee.type === 'MemberExpression') {
      const object = this.evaluateNode(node.callee.object);
      const methodName = node.callee.property.name;

      return this.callMethod(object, methodName, args);
    }

    throw new WorkflowSecurityError('Invalid function call');
  }

  /**
   * Evaluate a binary expression (e.g., a + b, a > b)
   */
  private evaluateBinaryExpression(node: any): unknown {
    // Handle logical operators with short-circuit evaluation
    if (node.operator === '&&' || node.operator === '||') {
      const left = !!this.evaluateNode(node.left);

      if (node.operator === '&&') {
        return left && !!this.evaluateNode(node.right);
      } else {
        return left || !!this.evaluateNode(node.right);
      }
    }

    const left = this.evaluateNode(node.left);
    const right = this.evaluateNode(node.right);

    switch (node.operator) {
      // Arithmetic operators
      case '+':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Arithmetic addition requires both operands to be numbers. Use concat() for strings.'
          );
        }
        return left + right;
      case '-':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Subtraction requires both operands to be numbers'
          );
        }
        return left - right;
      case '*':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Multiplication requires both operands to be numbers'
          );
        }
        return left * right;
      case '/': {
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Division requires both operands to be numbers'
          );
        }
        // Check for zero (including -0)
        if (right === 0 || Object.is(right, -0)) {
          throw new WorkflowEvaluationError('Division by zero');
        }
        const result = left / right;
        // Check for Infinity (overflow)
        if (!isFinite(result)) {
          throw new WorkflowEvaluationError(
            'Division result is too large (Infinity)'
          );
        }
        return result;
      }
      case '%':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Modulo requires both operands to be numbers'
          );
        }
        if (right === 0 || Object.is(right, -0)) {
          throw new WorkflowEvaluationError('Modulo by zero');
        }
        // Note: JavaScript % can return negative results (e.g., -5 % 3 = -2)
        // This is remainder, not mathematical modulo
        return left % right;

      // Comparison operators
      case '==':
      case '===':
        return left === right;
      case '!=':
      case '!==':
        return left !== right;
      case '<':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Comparison operators require both operands to be numbers'
          );
        }
        return left < right;
      case '>':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Comparison operators require both operands to be numbers'
          );
        }
        return left > right;
      case '<=':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Comparison operators require both operands to be numbers'
          );
        }
        return left <= right;
      case '>=':
        if (typeof left !== 'number' || typeof right !== 'number') {
          throw new WorkflowEvaluationError(
            'Comparison operators require both operands to be numbers'
          );
        }
        return left >= right;

      default:
        throw new WorkflowSecurityError(
          `Unsupported operator: ${node.operator}`
        );
    }
  }

  /**
   * Evaluate a unary expression (e.g., -x, !x)
   */
  private evaluateUnaryExpression(node: any): unknown {
    const argument = this.evaluateNode(node.argument);

    switch (node.operator) {
      case '-':
        if (typeof argument !== 'number' || isNaN(argument)) {
          throw new WorkflowSecurityError(
            `Unary '-' operator requires a valid number, got ${typeof argument}`
          );
        }
        return -(argument as number);
      case '+':
        if (typeof argument !== 'number' || isNaN(argument)) {
          throw new WorkflowSecurityError(
            `Unary '+' operator requires a valid number, got ${typeof argument}`
          );
        }
        return +(argument as number);
      case '!':
        return !argument;
      default:
        throw new WorkflowSecurityError(
          `Unsupported unary operator: ${node.operator}`
        );
    }
  }

  /**
   * Evaluate a conditional expression (ternary operator)
   */
  private evaluateConditionalExpression(node: any): unknown {
    const test = this.evaluateNode(node.test);
    return test
      ? this.evaluateNode(node.consequent)
      : this.evaluateNode(node.alternate);
  }

  /**
   * Evaluate an array expression
   */
  private evaluateArrayExpression(node: any): unknown {
    const elements = node.elements.map((element: any) =>
      this.evaluateNode(element)
    );

    // Check array size
    if (elements.length > MAX_COLLECTION_SIZE) {
      throw new WorkflowSecurityError('Array size exceeds maximum allowed');
    }

    return elements;
  }

  /**
   * Evaluate a logical expression (&&, ||)
   */
  private evaluateLogicalExpression(node: any): unknown {
    const left = this.evaluateNode(node.left);

    switch (node.operator) {
      case '&&':
        return left ? this.evaluateNode(node.right) : left;
      case '||':
        return left ? left : this.evaluateNode(node.right);
      default:
        throw new WorkflowSecurityError(
          `Unsupported logical operator: ${node.operator}`
        );
    }
  }

  /**
   * Evaluate a template literal
   */
  private evaluateTemplateLiteral(node: any): unknown {
    let result = '';
    for (let i = 0; i < node.quasis.length; i++) {
      result += node.quasis[i].value.cooked;
      if (i < node.expressions.length) {
        result += this.stringifyResult(this.evaluateNode(node.expressions[i]));
      }
    }
    return result;
  }

  /**
   * Create an arrow function wrapper (AST representation, not actual JS function)
   * This wrapper will be recognized and evaluated by array methods
   */
  private createArrowFunction(node: any): ArrowFunctionWrapper {
    const params = node.params.map((p: any) => {
      this.validateIdentifier(p.name);
      if (p.name.startsWith('$')) {
        throw new WorkflowSecurityError(
          `Parameter name "${p.name}" cannot start with $`
        );
      }
      return p.name;
    });
    const body = node.body;

    return {
      [ARROW_FN_SYMBOL]: true,
      params,
      body,
    };
  }

  /**
   * Check if a value is an arrow function wrapper
   */
  private isArrowFunction(value: unknown): value is ArrowFunctionWrapper {
    return (
      typeof value === 'object' && value !== null && ARROW_FN_SYMBOL in value
    );
  }

  /**
   * Evaluate an arrow function with given arguments
   */
  private evaluateArrowFunction(
    arrowFn: ArrowFunctionWrapper,
    args: unknown[]
  ): unknown {
    // Save previous local scope
    const previousScope = { ...this.localScope };

    try {
      // Set arrow function parameters in local scope
      arrowFn.params.forEach((param: string, index: number) => {
        this.localScope[param] = args[index];
      });

      // Evaluate the body of the arrow function
      return this.evaluateNode(arrowFn.body);
    } finally {
      // Restore previous local scope
      this.localScope = previousScope;
    }
  }

  /**
   * Handle $() node access function
   */
  private handleNodeAccess(args: unknown[]): unknown {
    if (args.length !== 1 || typeof args[0] !== 'string') {
      throw new WorkflowEvaluationError(
        '$() requires exactly one string argument'
      );
    }

    const nodeName = args[0] as string;

    // Validate node name
    this.validateIdentifier(nodeName);

    if (!(nodeName in this.context)) {
      throw new WorkflowEvaluationError(
        `Node "${nodeName}" not found in context`
      );
    }

    return this.context[nodeName];
  }

  /**
   * Get built-in function by name
   */
  private getBuiltInFunction(
    name: string
  ): ((...args: unknown[]) => unknown) | null {
    const builtInFns: Record<string, (...args: unknown[]) => unknown> = {
      // Special variables
      $json: () => this.currentNodeData,
      $input: () => this.inputData,

      // Utility functions
      $ifEmpty: (value: unknown, defaultValue: unknown) => {
        return value === null || value === undefined || value === ''
          ? defaultValue
          : value;
      },

      // Type checking
      $isNull: (value: unknown) => value === null,
      $isUndefined: (value: unknown) => value === undefined,
      $isEmpty: (value: unknown) => {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') {
          try {
            return Object.keys(value).length === 0;
          } catch {
            // If Object.keys() throws (e.g., special objects), consider it not empty
            return false;
          }
        }
        return false;
      },

      // Type conversion
      $string: (value: unknown) => String(value),
      $number: (value: unknown) => {
        const num = Number(value);
        if (isNaN(num)) {
          throw new WorkflowEvaluationError('Cannot convert to number');
        }
        return num;
      },
      $boolean: (value: unknown) => Boolean(value),

      // Array functions
      $length: (value: unknown) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length;
        }
        throw new WorkflowEvaluationError('$length requires string or array');
      },
      $first: (arr: unknown) => {
        if (!Array.isArray(arr)) {
          throw new WorkflowEvaluationError('$first requires an array');
        }
        return arr[0];
      },
      $last: (arr: unknown) => {
        if (!Array.isArray(arr)) {
          throw new WorkflowEvaluationError('$last requires an array');
        }
        return arr[arr.length - 1];
      },

      // Math functions
      $abs: (value: unknown) => {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new WorkflowEvaluationError('$abs requires a valid number');
        }
        return Math.abs(value);
      },
      $ceil: (value: unknown) => {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new WorkflowEvaluationError('$ceil requires a valid number');
        }
        return Math.ceil(value);
      },
      $floor: (value: unknown) => {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new WorkflowEvaluationError('$floor requires a valid number');
        }
        return Math.floor(value);
      },
      $round: (value: unknown) => {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new WorkflowEvaluationError('$round requires a valid number');
        }
        return Math.round(value);
      },
      $min: (...values: unknown[]) => {
        if (values.length === 0) {
          throw new WorkflowEvaluationError(
            '$min requires at least one argument'
          );
        }
        const numbers = values.map((v, i) => {
          if (typeof v !== 'number' || isNaN(v)) {
            throw new WorkflowEvaluationError(
              `$min argument ${i + 1} must be a valid number`
            );
          }
          return v;
        });
        return Math.min(...numbers);
      },
      $max: (...values: unknown[]) => {
        if (values.length === 0) {
          throw new WorkflowEvaluationError(
            '$max requires at least one argument'
          );
        }
        const numbers = values.map((v, i) => {
          if (typeof v !== 'number' || isNaN(v)) {
            throw new WorkflowEvaluationError(
              `$max argument ${i + 1} must be a valid number`
            );
          }
          return v;
        });
        return Math.max(...numbers);
      },
    };

    return builtInFns[name] || null;
  }

  /**
   * Call a method on an object
   */
  private callMethod(
    object: unknown,
    methodName: string,
    args: unknown[]
  ): unknown {
    if (object === null || object === undefined) {
      throw new WorkflowEvaluationError(
        'Cannot call method on null or undefined'
      );
    }

    // Validate method name
    this.validateMethodName(methodName);

    // Check if method is whitelisted for this type
    if (!this.isMethodAllowed(object, methodName)) {
      throw new WorkflowSecurityError(`Method "${methodName}" is not allowed`);
    }

    // Handle array methods with arrow function callbacks manually
    if (Array.isArray(object) && this.isCallbackMethod(methodName)) {
      const callback = args[0];
      if (this.isArrowFunction(callback)) {
        return this.evaluateArrayMethodWithArrowFunction(
          object,
          methodName,
          callback,
          args.slice(1)
        );
      }
    }

    // Validate callback arguments for array methods that accept them
    if (this.isCallbackMethod(methodName)) {
      this.validateCallbackArguments(args);
    }

    // Check iteration limit for iterative methods
    if (this.isIterativeMethod(methodName)) {
      this.iterationCount++;
      if (this.iterationCount > MAX_ITERATIONS) {
        throw new WorkflowSecurityError('Maximum iteration count exceeded');
      }
    }

    // Get the method
    const method = (object as any)[methodName];
    if (typeof method !== 'function') {
      throw new WorkflowEvaluationError(`"${methodName}" is not a function`);
    }

    // Call the method safely
    try {
      const result = method.apply(object, args);

      // Validate result size
      if (Array.isArray(result) && result.length > MAX_COLLECTION_SIZE) {
        throw new WorkflowSecurityError(
          'Result array size exceeds maximum allowed'
        );
      }
      if (typeof result === 'string' && result.length > MAX_COLLECTION_SIZE) {
        throw new WorkflowSecurityError(
          'Result string length exceeds maximum allowed'
        );
      }

      return result;
    } catch (error) {
      if (error instanceof WorkflowSecurityError) {
        throw error;
      }
      throw new WorkflowEvaluationError(
        `Method "${methodName}" failed: ${error.message}`
      );
    }
  }

  /**
   * Manually evaluate array methods with arrow functions
   * This avoids creating actual JS functions and keeps everything in AST evaluation
   */
  private evaluateArrayMethodWithArrowFunction(
    array: unknown[],
    methodName: string,
    arrowFn: ArrowFunctionWrapper,
    extraArgs: unknown[]
  ): unknown {
    // Check iteration limit
    this.iterationCount++;
    if (this.iterationCount > MAX_ITERATIONS) {
      throw new WorkflowSecurityError('Maximum iteration count exceeded');
    }

    // Validate array size
    if (array.length > MAX_COLLECTION_SIZE) {
      throw new WorkflowSecurityError('Array size exceeds maximum allowed');
    }

    switch (methodName) {
      case 'map': {
        const result: unknown[] = [];
        for (let i = 0; i < array.length; i++) {
          const value = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          result.push(value);
        }
        return result;
      }

      case 'filter': {
        const result: unknown[] = [];
        for (let i = 0; i < array.length; i++) {
          const shouldInclude = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (shouldInclude) {
            result.push(array[i]);
          }
        }
        return result;
      }

      case 'find': {
        for (let i = 0; i < array.length; i++) {
          const matches = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (matches) {
            return array[i];
          }
        }
        return undefined;
      }

      case 'findIndex': {
        for (let i = 0; i < array.length; i++) {
          const matches = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (matches) {
            return i;
          }
        }
        return -1;
      }

      case 'findLastIndex': {
        for (let i = array.length - 1; i >= 0; i--) {
          const matches = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (matches) {
            return i;
          }
        }
        return -1;
      }

      case 'some': {
        for (let i = 0; i < array.length; i++) {
          const matches = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (matches) {
            return true;
          }
        }
        return false;
      }

      case 'every': {
        for (let i = 0; i < array.length; i++) {
          const matches = this.evaluateArrowFunction(arrowFn, [
            array[i],
            i,
            array,
          ]);
          if (!matches) {
            return false;
          }
        }
        return true;
      }

      case 'reduce': {
        if (array.length === 0 && extraArgs.length === 0) {
          throw new WorkflowEvaluationError(
            'Reduce of empty array with no initial value'
          );
        }

        let accumulator: unknown;
        let startIndex: number;

        if (extraArgs.length > 0) {
          accumulator = extraArgs[0];
          startIndex = 0;
        } else {
          accumulator = array[0];
          startIndex = 1;
        }

        for (let i = startIndex; i < array.length; i++) {
          accumulator = this.evaluateArrowFunction(arrowFn, [
            accumulator,
            array[i],
            i,
            array,
          ]);
        }

        return accumulator;
      }

      default:
        throw new WorkflowSecurityError(
          `Array method "${methodName}" with arrow functions is not supported`
        );
    }
  }

  /**
   * Check if a method is allowed for the given object type
   */
  private isMethodAllowed(object: unknown, methodName: string): boolean {
    if (typeof object === 'string') {
      return SAFE_STRING_METHODS.has(methodName);
    }
    if (Array.isArray(object)) {
      return SAFE_ARRAY_METHODS.has(methodName);
    }
    if (typeof object === 'number') {
      return SAFE_NUMBER_METHODS.has(methodName);
    }
    if (typeof object === 'object' && object !== null) {
      return SAFE_OBJECT_METHODS.has(methodName);
    }
    return false;
  }

  /**
   * Check if a method is iterative (for iteration counting)
   */
  private isIterativeMethod(methodName: string): boolean {
    return [
      'map',
      'filter',
      'reduce',
      'find',
      'findIndex',
      'findLastIndex',
      'some',
      'every',
    ].includes(methodName);
  }

  /**
   * Check if a method accepts callback functions
   */
  private isCallbackMethod(methodName: string): boolean {
    return [
      'map',
      'filter',
      'reduce',
      'find',
      'findIndex',
      'some',
      'every',
      'forEach',
    ].includes(methodName);
  }

  /**
   * Validate callback arguments to prevent function injection
   * Allows arrow function wrappers created by the parser, but blocks external functions
   */
  private validateCallbackArguments(args: unknown[]): void {
    for (const arg of args) {
      // Allow arrow function wrappers created by the parser
      if (this.isArrowFunction(arg)) {
        continue;
      }

      // Block any actual JavaScript functions (security risk)
      if (typeof arg === 'function') {
        throw new WorkflowSecurityError(
          'Callback functions are not supported. Use arrow function syntax in expressions instead.'
        );
      }

      // Check for objects that might contain external functions
      if (arg !== null && typeof arg === 'object') {
        this.validateContextData(arg, 0, new WeakSet());
      }
    }
  }

  /**
   * Safely access a property on an object
   */
  private safePropertyAccess(
    object: unknown,
    property: string | number
  ): unknown {
    if (object === null || object === undefined) {
      return undefined;
    }

    // Prevent prototype pollution
    if (
      property === '__proto__' ||
      property === 'constructor' ||
      property === 'prototype'
    ) {
      throw new WorkflowSecurityError(
        'Access to prototype properties is not allowed'
      );
    }

    return (object as any)[property];
  }

  /**
   * Validate an identifier name
   */
  private validateIdentifier(name: string, isRoot = true): void {
    // Block dangerous identifiers for root access
    if (isRoot) {
      const rootDangerous = [
        'eval',
        'Function',
        'constructor',
        '__proto__',
        'prototype',
        'process',
        'require',
        'import',
        'global',
        'globalThis',
        'window',
        'document',
        'location',
        'localStorage',
        'sessionStorage',
      ];

      if (rootDangerous.includes(name)) {
        throw new WorkflowSecurityError(`Root identifier "${name}" is not allowed`);
      }
    } else {
      // Less restrictive validation for non-root property access
      const nonRootDangerous = [
        '__proto__',
        'constructor',
        'prototype',
      ];

      if (nonRootDangerous.includes(name)) {
        throw new WorkflowSecurityError(`Property "${name}" is not allowed`);
      }
    }
  }

  /**
   * Validate a property name
   */
  private validatePropertyAccess(property: string | number): void {
    if (typeof property === 'string') {
      this.validateIdentifier(property, false);
    }
  }

  /**
   * Validate a method name
   */
  private validateMethodName(name: string): void {
    this.validateIdentifier(name, false);
  }

  /**
   * Deep validate context data for security
   * Checks for functions, circular references, and excessive nesting
   */
  private validateContextData(
    data: unknown,
    depth = 0,
    seen = new WeakSet()
  ): void {
    // Check nesting depth to prevent stack overflow
    if (depth > 10) {
      throw new WorkflowSecurityError(
        'Context nesting depth exceeds maximum allowed (10 levels)'
      );
    }

    // Reject functions
    if (typeof data === 'function') {
      throw new WorkflowSecurityError(
        'Functions are not allowed in context data'
      );
    }

    // Handle arrays
    if (Array.isArray(data)) {
      // Check for circular references
      if (seen.has(data)) {
        throw new WorkflowSecurityError(
          'Circular references are not allowed in context data'
        );
      }
      seen.add(data);

      // Validate each element
      for (const item of data) {
        this.validateContextData(item, depth + 1, seen);
      }
      return;
    }

    // Handle objects
    if (data !== null && typeof data === 'object') {
      // Check for circular references
      if (seen.has(data as object)) {
        throw new WorkflowSecurityError(
          'Circular references are not allowed in context data'
        );
      }
      seen.add(data as object);

      // Validate each property
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          // Validate property name
          this.validateIdentifier(key, false);
          // Validate property value
          this.validateContextData((data as any)[key], depth + 1, seen);
        }
      }
    }

    // Primitives (string, number, boolean, null, undefined) are safe
  }

  /**
   * Convert a result to a string for interpolation
   */
  private stringifyResult(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value) || typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }
    return String(value);
  }
}

export default WorkflowExpressionParser;
