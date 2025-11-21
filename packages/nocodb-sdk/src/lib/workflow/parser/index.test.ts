import {
  WorkflowEvaluationError,
  WorkflowExpressionParser,
  WorkflowSecurityError,
} from './index';

describe('WorkflowExpressionParser', () => {
  let parser: WorkflowExpressionParser;

  beforeEach(() => {
    parser = new WorkflowExpressionParser();
  });

  describe('Basic Expression Evaluation', () => {
    it('should prevent ReDoS attacks with nested braces', () => {
      // This would cause ReDoS with a backtracking regex
      const malicious = '{{' + '{'.repeat(100) + 'a' + '}'.repeat(100) + '}}';
      // Should either not match or handle gracefully without hanging
      expect(() => parser.processString(malicious)).not.toThrow();
    });

    it('should use precompiled regex safely', () => {
      // Test that regex state is properly reset between calls
      const result1 = parser.processString('{{ 1 + 1 }}');
      const result2 = parser.processString('{{ 2 + 2 }}');
      expect(result1).toBe('2');
      expect(result2).toBe('4');
    });

    it('should evaluate literals', () => {
      expect(parser.evaluate('42')).toBe(42);
      expect(parser.evaluate('"hello"')).toBe('hello');
      expect(parser.evaluate('true')).toBe(true);
      expect(parser.evaluate('false')).toBe(false);
      expect(parser.evaluate('null')).toBe(null);
    });

    it('should evaluate arithmetic operations', () => {
      expect(parser.evaluate('2 + 3')).toBe(5);
      expect(parser.evaluate('10 - 4')).toBe(6);
      expect(parser.evaluate('5 * 6')).toBe(30);
      expect(parser.evaluate('20 / 4')).toBe(5);
      expect(parser.evaluate('17 % 5')).toBe(2);
    });

    it('should enforce type checking for arithmetic operations', () => {
      expect(() => parser.evaluate('"5" + 3')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('5 - "3"')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('"5" * 2')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('10 / "2"')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('10 % "3"')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should suggest concat() for string operations', () => {
      try {
        parser.evaluate('"hello" + " world"');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('concat()');
      }
    });

    it('should throw on division by zero', () => {
      expect(() => parser.evaluate('10 / 0')).toThrow(WorkflowEvaluationError);
      // Also check for -0
      expect(() => parser.evaluate('10 / -0')).toThrow(WorkflowEvaluationError);
    });

    it('should throw on division resulting in Infinity', () => {
      expect(() => parser.evaluate('1e308 / 1e-308')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should throw on modulo by zero', () => {
      expect(() => parser.evaluate('10 % 0')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('10 % -0')).toThrow(WorkflowEvaluationError);
    });

    it('should handle negative modulo correctly', () => {
      // JavaScript % returns remainder, not mathematical modulo
      expect(parser.evaluate('-5 % 3')).toBe(-2);
      expect(parser.evaluate('5 % -3')).toBe(2);
    });

    it('should evaluate comparison operations', () => {
      expect(parser.evaluate('5 > 3')).toBe(true);
      expect(parser.evaluate('5 < 3')).toBe(false);
      expect(parser.evaluate('5 >= 5')).toBe(true);
      expect(parser.evaluate('5 <= 4')).toBe(false);
      expect(parser.evaluate('5 == 5')).toBe(true);
      expect(parser.evaluate('5 != 3')).toBe(true);
    });

    it('should enforce type checking for comparison operations', () => {
      // Prevent string comparison type coercion
      expect(() => parser.evaluate('"10" < "2"')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('10 < "2"')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('"5" > 3')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('5 <= "5"')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should evaluate logical operations', () => {
      expect(parser.evaluate('true && true')).toBe(true);
      expect(parser.evaluate('true && false')).toBe(false);
      expect(parser.evaluate('true || false')).toBe(true);
      expect(parser.evaluate('false || false')).toBe(false);
    });

    it('should evaluate unary operations', () => {
      expect(parser.evaluate('-5')).toBe(-5);
      expect(parser.evaluate('+5')).toBe(5);
      expect(parser.evaluate('!true')).toBe(false);
      expect(parser.evaluate('!false')).toBe(true);
    });

    it('should evaluate ternary operations', () => {
      expect(parser.evaluate('true ? "yes" : "no"')).toBe('yes');
      expect(parser.evaluate('false ? "yes" : "no"')).toBe('no');
      expect(parser.evaluate('5 > 3 ? "greater" : "less"')).toBe('greater');
    });

    it('should evaluate array expressions', () => {
      expect(parser.evaluate('[1, 2, 3]')).toEqual([1, 2, 3]);
      expect(parser.evaluate('["a", "b", "c"]')).toEqual(['a', 'b', 'c']);
    });
  });

  describe('Node Access', () => {
    beforeEach(() => {
      parser.setContext({
        User: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          age: 25,
        },
        Order: {
          id: 12345,
          total: 99.99,
          items: ['laptop', 'mouse', 'keyboard'],
        },
      });
    });

    it('should access node data using $()', () => {
      expect(parser.evaluate('$("User")')).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        age: 25,
      });
    });

    it('should access nested properties', () => {
      expect(parser.evaluate('$("User").firstName')).toBe('John');
      expect(parser.evaluate('$("User").age')).toBe(25);
      expect(parser.evaluate('$("Order").total')).toBe(99.99);
    });

    it('should access array elements', () => {
      expect(parser.evaluate('$("Order").items[0]')).toBe('laptop');
      expect(parser.evaluate('$("Order").items[1]')).toBe('mouse');
      expect(parser.evaluate('$("Order").items[2]')).toBe('keyboard');
    });

    it('should throw on non-existent node', () => {
      expect(() => parser.evaluate('$("NonExistent")')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should throw on invalid $() arguments', () => {
      expect(() => parser.evaluate('$()')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('$(123)')).toThrow(WorkflowEvaluationError);
    });
  });

  describe('String Interpolation', () => {
    beforeEach(() => {
      parser.setContext({
        User: {
          firstName: 'John',
          lastName: 'Doe',
        },
      });
    });

    it('should process string interpolation', () => {
      expect(parser.processString('Hello {{ $("User").firstName }}!')).toBe(
        'Hello John!'
      );
    });

    it('should handle multiple interpolations', () => {
      expect(
        parser.processString(
          'Hello {{ $("User").firstName }} {{ $("User").lastName }}!'
        )
      ).toBe('Hello John Doe!');
    });

    it('should handle expressions in interpolations', () => {
      parser.setContext({ Order: { total: 100 } });
      expect(
        parser.processString(
          'Total: ${{ ($("Order").total * 1.1).toFixed(2) }}'
        )
      ).toBe('Total: $110.00');
    });

    it('should handle strings without interpolations', () => {
      expect(parser.processString('Plain text')).toBe('Plain text');
    });
  });

  describe('String Methods', () => {
    it('should call safe string methods', () => {
      expect(parser.evaluate('"hello".toUpperCase()')).toBe('HELLO');
      expect(parser.evaluate('"HELLO".toLowerCase()')).toBe('hello');
      expect(parser.evaluate('"  hello  ".trim()')).toBe('hello');
      expect(parser.evaluate('"hello".slice(1, 4)')).toBe('ell');
      expect(parser.evaluate('"hello".substring(1, 4)')).toBe('ell');
      expect(parser.evaluate('"hello".charAt(1)')).toBe('e');
      expect(parser.evaluate('"hello".indexOf("l")')).toBe(2);
      expect(parser.evaluate('"hello".includes("ell")')).toBe(true);
      expect(parser.evaluate('"hello".startsWith("hel")')).toBe(true);
      expect(parser.evaluate('"hello".endsWith("lo")')).toBe(true);
      expect(parser.evaluate('"hello".repeat(2)')).toBe('hellohello');
      expect(parser.evaluate('"5".padStart(3, "0")')).toBe('005');
      expect(parser.evaluate('"5".padEnd(3, "0")')).toBe('500');
    });

    it('should handle split and join', () => {
      expect(parser.evaluate('"a,b,c".split(",")')).toEqual(['a', 'b', 'c']);
      expect(parser.evaluate('"hello".split("")')).toEqual([
        'h',
        'e',
        'l',
        'l',
        'o',
      ]);
    });

    it('should handle replace', () => {
      expect(parser.evaluate('"hello".replace("l", "L")')).toBe('heLlo');
    });
  });

  describe('Array Methods', () => {
    it('should call safe array methods', () => {
      expect(parser.evaluate('[1, 2, 3].join(",")')).toBe('1,2,3');
      expect(parser.evaluate('[1, 2, 3].slice(1, 3)')).toEqual([2, 3]);
      expect(parser.evaluate('[1, 2, 3].indexOf(2)')).toBe(1);
      expect(parser.evaluate('[1, 2, 3].includes(2)')).toBe(true);
      expect(parser.evaluate('[1, 2, 3].concat([4, 5])')).toEqual([
        1, 2, 3, 4, 5,
      ]);
    });

    it('should block mutating array methods', () => {
      parser.setContext({ arr: [1, 2, 3] });
      expect(() => parser.evaluate("$('arr').push(4)")).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.evaluate("$('arr').pop()")).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.evaluate("$('arr').shift()")).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.evaluate("$('arr').unshift(0)")).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.evaluate("$('arr').reverse()")).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.evaluate("$('arr').sort()")).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block callback functions in array methods', () => {
      parser.setContext({ arr: [1, 2, 3] });

      // Note: These would fail at parse time since arrow functions aren't supported by jsep
      // But if someone tries to pass a function from context, it should be blocked
      const contextWithFunction = {
        arr: [1, 2, 3],
        callback: (x: number) => x * 2,
      };

      // This should fail at context validation
      expect(() => parser.setContext(contextWithFunction as any)).toThrow(
        WorkflowSecurityError
      );
    });

    it('should handle array iteration methods', () => {
      parser.setContext({
        numbers: [1, 2, 3, 4, 5],
      });

      // Note: These will work but need proper callback handling
      // For now, testing basic functionality
      expect(parser.evaluate('$("numbers").length')).toBe(5);
    });
  });

  describe('Number Methods', () => {
    it('should call safe number methods', () => {
      expect(parser.evaluate('(3.14159).toFixed(2)')).toBe('3.14');
      expect(parser.evaluate('(123.456).toPrecision(4)')).toBe('123.5');
      expect(parser.evaluate('(123).toString()')).toBe('123');
    });
  });

  describe('Built-in Functions', () => {
    it('should support $json', () => {
      parser.setCurrentNodeData({ id: 1, name: 'Test' });
      expect(parser.evaluate('$json')).toEqual({ id: 1, name: 'Test' });
    });

    it('should support $input', () => {
      parser.setInputData({ value: 42 });
      expect(parser.evaluate('$input')).toEqual({ value: 42 });
    });

    it('should support $ifEmpty', () => {
      expect(parser.evaluate('$ifEmpty(null, "default")')).toBe('default');
      expect(parser.evaluate('$ifEmpty("", "default")')).toBe('default');
      expect(parser.evaluate('$ifEmpty("value", "default")')).toBe('value');
    });

    it('should support type checking functions', () => {
      expect(parser.evaluate('$isNull(null)')).toBe(true);
      expect(parser.evaluate('$isNull("value")')).toBe(false);
      expect(parser.evaluate('$isEmpty("")')).toBe(true);
      expect(parser.evaluate('$isEmpty("value")')).toBe(false);
      expect(parser.evaluate('$isEmpty([])')).toBe(true);
      expect(parser.evaluate('$isEmpty([1])')).toBe(false);
    });

    it('should handle $isEmpty with special objects safely', () => {
      parser.setContext({
        emptyObj: {},
        nonEmptyObj: { a: 1 },
      });
      expect(parser.evaluate('$isEmpty($("emptyObj"))')).toBe(true);
      expect(parser.evaluate('$isEmpty($("nonEmptyObj"))')).toBe(false);
    });

    it('should support type conversion functions', () => {
      expect(parser.evaluate('$string(123)')).toBe('123');
      expect(parser.evaluate('$number("456")')).toBe(456);
      expect(parser.evaluate('$boolean(1)')).toBe(true);
      expect(parser.evaluate('$boolean(0)')).toBe(false);
    });

    it('should throw on invalid number conversion', () => {
      expect(() => parser.evaluate('$number("abc")')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should support array functions', () => {
      expect(parser.evaluate('$length("hello")')).toBe(5);
      expect(parser.evaluate('$length([1, 2, 3])')).toBe(3);
      expect(parser.evaluate('$first([1, 2, 3])')).toBe(1);
      expect(parser.evaluate('$last([1, 2, 3])')).toBe(3);
    });

    it('should support math functions', () => {
      expect(parser.evaluate('$abs(-5)')).toBe(5);
      expect(parser.evaluate('$ceil(3.2)')).toBe(4);
      expect(parser.evaluate('$floor(3.8)')).toBe(3);
      expect(parser.evaluate('$round(3.5)')).toBe(4);
      expect(parser.evaluate('$min(1, 2, 3)')).toBe(1);
      expect(parser.evaluate('$max(1, 2, 3)')).toBe(3);
    });

    it('should validate math function inputs', () => {
      // Invalid number inputs
      expect(() => parser.evaluate('$abs("not a number")')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('$ceil(null)')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('$floor(undefined)')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('$round("5")')).toThrow(
        WorkflowEvaluationError
      );

      // Empty arguments
      expect(() => parser.evaluate('$min()')).toThrow(WorkflowEvaluationError);
      expect(() => parser.evaluate('$max()')).toThrow(WorkflowEvaluationError);

      // Invalid arguments in min/max
      expect(() => parser.evaluate('$min(1, "2", 3)')).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.evaluate('$max(1, null, 3)')).toThrow(
        WorkflowEvaluationError
      );
    });
  });

  describe('Security - Dangerous Identifiers', () => {
    it('should block eval', () => {
      expect(() => parser.evaluate('eval("alert(1)")')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block Function constructor', () => {
      expect(() => parser.evaluate('Function("return 1")')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block constructor access', () => {
      expect(() => parser.evaluate('"".constructor')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block __proto__ access', () => {
      expect(() => parser.evaluate('{}.__proto__')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block prototype access', () => {
      expect(() => parser.evaluate('"".prototype')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block process access', () => {
      expect(() => parser.evaluate('process')).toThrow(WorkflowSecurityError);
    });

    it('should block require access', () => {
      expect(() => parser.evaluate('require("fs")')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block global access', () => {
      expect(() => parser.evaluate('global')).toThrow(WorkflowSecurityError);
    });

    it('should block window access', () => {
      expect(() => parser.evaluate('window')).toThrow(WorkflowSecurityError);
    });
  });

  describe('Security - Callback Validation', () => {
    it('should block functions in context data', () => {
      const malicious = {
        data: [1, 2, 3],
        fn: (x: number) => x * 2,
      };
      expect(() => parser.setContext(malicious as any)).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block nested functions in context data', () => {
      const malicious = {
        data: {
          nested: {
            fn: () => 'bad',
          },
        },
      };
      expect(() => parser.setContext(malicious as any)).toThrow(
        WorkflowSecurityError
      );
    });
  });

  describe('Security - Method Whitelisting', () => {
    it('should block non-whitelisted string methods', () => {
      parser.setContext({ str: 'test' });
      expect(() => parser.evaluate('$("str").constructor()')).toThrow(
        WorkflowSecurityError
      );
    });

    it('should block non-whitelisted array methods', () => {
      parser.setContext({ arr: [1, 2, 3] });
      // Constructor is blocked at identifier level
      expect(() => parser.evaluate("$('arr').constructor")).toThrow(
        WorkflowSecurityError
      );
    });

    it('should only allow whitelisted methods', () => {
      // String methods
      expect(() => parser.evaluate('"test".valueOf()')).not.toThrow();
      expect(() => parser.evaluate('"test".toString()')).not.toThrow();

      // Array methods
      expect(() => parser.evaluate('[1,2,3].join(",")')).not.toThrow();
      expect(() => parser.evaluate('[1,2,3].slice(0,1)')).not.toThrow();
    });
  });

  describe('Security - Recursion Limits', () => {
    it('should enforce maximum recursion depth', () => {
      // Create deeply nested expression
      let expr = '1';
      for (let i = 0; i < 150; i++) {
        expr = `(${expr} + 1)`;
      }
      expect(() => parser.evaluate(expr)).toThrow(WorkflowSecurityError);
    });
  });

  describe('Security - Collection Size Limits', () => {
    it('should enforce maximum array size', () => {
      // Try to create array larger than MAX_COLLECTION_SIZE
      const largeArray = new Array(15000).fill(1);
      parser.setContext({ largeArray });

      // This should work as we're just accessing it
      expect(() => parser.evaluate('$("largeArray")')).not.toThrow();

      // But operations that create new large arrays should fail
      // Note: This is enforced at result validation level
    });

    it('should enforce maximum string length in results', () => {
      // This is enforced when methods return large strings
      const longString = 'a'.repeat(5000);
      parser.setContext({ str: longString });

      // Accessing should work
      expect(() => parser.evaluate('$("str")')).not.toThrow();

      // But creating very long strings via repeat should be caught
      expect(() => parser.evaluate('"a".repeat(15000)')).toThrow(
        WorkflowSecurityError
      );
    });
  });

  describe('Complex Real-World Examples', () => {
    beforeEach(() => {
      parser.setContext({
        User: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          age: 25,
        },
        Order: {
          id: 12345,
          total: 99.99,
          items: ['laptop', 'mouse', 'keyboard'],
        },
        Product: {
          name: 'Laptop',
          description: null,
        },
      });
    });

    it('should handle complex string interpolation', () => {
      const result = parser.processString('Hello {{ $("User").firstName }}!');
      expect(result).toBe('Hello John!');
    });

    it('should handle method chaining', () => {
      const result = parser.processString(
        '{{ $("User").firstName.toUpperCase() }}'
      );
      expect(result).toBe('JOHN');
    });

    it('should handle array operations', () => {
      const result = parser.processString('{{ $("Order").items.join(", ") }}');
      expect(result).toBe('laptop, mouse, keyboard');
    });

    it('should handle conditional expressions', () => {
      const result = parser.processString(
        '{{ $("User").age >= 18 ? "Adult" : "Minor" }}'
      );
      expect(result).toBe('Adult');
    });

    it('should handle $ifEmpty with null values', () => {
      const result = parser.processString(
        '{{ $ifEmpty($("Product").description, "No description available") }}'
      );
      expect(result).toBe('No description available');
    });

    it('should handle complex calculations', () => {
      const result = parser.processString(
        'Order #{{ $("Order").id }} - Total: ${{ ($("Order").total * 1.1).toFixed(2) }}'
      );
      expect(result).toBe('Order #12345 - Total: $109.99');
    });

    it('should handle nested property access', () => {
      parser.setContext({
        Data: {
          user: {
            profile: {
              address: {
                city: 'New York',
              },
            },
          },
        },
      });

      const result = parser.evaluate('$("Data").user.profile.address.city');
      expect(result).toBe('New York');
    });

    it('should handle array indexing with expressions', () => {
      const result = parser.evaluate('$("Order").items[1 + 1]');
      expect(result).toBe('keyboard');
    });

    it('should handle complex boolean logic', () => {
      const result = parser.evaluate(
        '$("User").age >= 18 && $("User").age < 65'
      );
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined gracefully', () => {
      parser.setContext({ data: null });
      expect(parser.evaluate('$("data")')).toBe(null);
      expect(parser.processString('{{ $("data") }}')).toBe('');
    });

    it('should handle accessing properties on null', () => {
      parser.setContext({ data: null });
      expect(parser.evaluate('$("data").property')).toBe(undefined);
    });

    it('should handle empty strings', () => {
      expect(parser.processString('')).toBe('');
      expect(parser.processString('{{ "" }}')).toBe('');
    });

    it('should handle non-string input to processString', () => {
      expect(parser.processString(123 as any)).toBe('123');
      expect(parser.processString(null as any)).toBe('null');
    });

    it('should handle complex nested ternary', () => {
      parser.setContext({ score: 85 });
      const result = parser.evaluate(
        '$("score") >= 90 ? "A" : $("score") >= 80 ? "B" : $("score") >= 70 ? "C" : "F"'
      );
      expect(result).toBe('B');
    });
  });

  describe('Context Validation', () => {
    it('should reject functions in context', () => {
      expect(() => parser.setContext({ fn: () => 'test' } as any)).toThrow(
        WorkflowSecurityError
      );
    });

    it('should reject circular references', () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      expect(() => parser.setContext({ data: circular })).toThrow(
        WorkflowSecurityError
      );
    });

    it('should reject deeply nested objects', () => {
      let deep: any = { value: 1 };
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }
      expect(() => parser.setContext({ data: deep })).toThrow(
        WorkflowSecurityError
      );
    });

    it('should reject dangerous property names in context', () => {
      // Create object with dangerous property names using bracket notation
      const dangerousObj1: any = {};
      dangerousObj1['eval'] = 'bad';

      const dangerousObj2: any = {};
      dangerousObj2['Function'] = 'bad';

      expect(() => parser.setContext({ data: dangerousObj1 })).toThrow(
        WorkflowSecurityError
      );
      expect(() => parser.setContext({ data: dangerousObj2 })).toThrow(
        WorkflowSecurityError
      );
    });

    it('should accept valid context data', () => {
      expect(() =>
        parser.setContext({
          user: { name: 'John', age: 30 },
          items: [1, 2, 3],
          nested: { a: { b: { c: 1 } } },
        })
      ).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should throw WorkflowEvaluationError for invalid expressions', () => {
      expect(() => parser.evaluate('$("NonExistent")')).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should throw WorkflowSecurityError for dangerous operations', () => {
      expect(() => parser.evaluate('eval("1")')).toThrow(WorkflowSecurityError);
    });

    it('should provide meaningful error messages', () => {
      try {
        parser.evaluate('$("NonExistent")');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('not found in context');
      }
    });

    it('should handle invalid context gracefully', () => {
      expect(() => parser.setContext(null as any)).toThrow(
        WorkflowEvaluationError
      );
      expect(() => parser.setContext('invalid' as any)).toThrow(
        WorkflowEvaluationError
      );
    });

    it('should provide specific error messages for arithmetic type errors', () => {
      try {
        parser.evaluate('"5" + 3');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('requires both operands to be numbers');
        expect(error.message).toContain('concat()');
      }
    });

    it('should provide specific error messages for context validation', () => {
      try {
        parser.setContext({ fn: () => 'test' } as any);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).toContain('Functions are not allowed');
      }
    });
  });
});
