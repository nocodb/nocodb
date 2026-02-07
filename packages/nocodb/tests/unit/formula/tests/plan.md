# Formula Test Coverage Analysis

## Current Test Coverage

Tests exist in `tests/unit/formula/tests/`:

| Test File | Coverage |
|-----------|----------|
| `formula-error.test.ts` | Circular references, invalid params, length limits |
| `formula-formula.test.ts` | Formula → formula chains |
| `formula-lookup-ltar.test.ts` | Array operations (ARRAYSORT, ARRAYUNIQUE, etc.) |
| `formula-qr-barcode.test.ts` | Formula referencing QR/barcode columns |
| `formula-rollup.test.ts` | Formula with rollup fields |
| `formula-parsed-tree-builder.test.ts` | COALESCE handling, CONCAT transformations |

---

## Test Scenarios That Can Be Added

### 1. Individual Function Coverage (High Priority)

Currently no comprehensive tests for these functions:

#### Numeric Functions
- `LOG` - logarithm with various bases
- `EXP` - exponential function
- `POWER` - exponentiation with negative/fractional exponents
- `SQRT` - including negative input handling
- `CEILING` / `FLOOR` - with decimals and negatives
- `EVEN` / `ODD` - rounding to nearest even/odd
- `ROUNDUP` / `ROUNDDOWN` - precision handling

#### String Functions
- `REPEAT` - string repetition with edge cases (0, negative count)
- `SEARCH` - find substring index, case sensitivity
- `URLENCODE` - special characters, unicode encoding

#### Type Casting Functions
- `STRING()` - from number, date, boolean, null
- `INT()` / `FLOAT()` - from string, boolean, invalid inputs
- `BOOLEAN()` - truthy/falsy value handling

#### JSON Functions
- `JSON_EXTRACT` - nested paths, arrays, missing keys, invalid JSON

#### Utility Functions
- `RECORD_ID()` - in various contexts
- `COUNT()` / `COUNTA()` / `COUNTALL()` - with mixed null/empty values

---

### 2. Edge Cases (High Priority)

#### NULL Handling
```
- All functions with NULL as input
- NULL in nested function calls
- NULL in array operations
```

#### Empty String vs NULL
```
- LEN('') vs LEN(NULL)
- CONCAT with empty strings vs NULL
- IF conditions with empty vs NULL
```

#### Numeric Edge Cases
```
- Division by zero in MOD
- Negative numbers in FLOOR, CEILING, ROUND
- Very large numbers (overflow)
- Very small decimals (precision)
- NaN and Infinity handling
```

#### String Edge Cases
```
- Unicode/multi-byte characters in LEN, SUBSTR
- Very long strings (performance)
- Special characters in REPLACE, REGEX functions
- Empty string in LEFT, RIGHT, MID
```

---

### 3. Date Function Coverage (Medium Priority)

#### DATETIME_DIFF
```
- All units: years, months, weeks, days, hours, minutes, seconds
- Negative differences (future to past)
- Same date comparison
- Cross-timezone comparisons
```

#### DATEADD
```
- Negative values (subtraction)
- Leap year handling (Feb 29)
- Month boundary crossing (Jan 31 + 1 month)
- End of month edge cases
```

#### LAST_MODIFIED_TIME
```
- With field argument
- Without field argument
- After bulk updates
```

#### Date Extraction
```
- WEEKDAY with different week start conventions
- YEAR/MONTH/DAY with various date formats
```

---

### 4. REGEX Functions (Medium Priority)

Currently only `REGEX_MATCH` is tested.

#### REGEX_EXTRACT
```
- With capture groups
- No match cases (return NULL)
- Multiple matches (first match only)
- Invalid regex pattern handling
```

#### REGEX_REPLACE
```
- Global replacement vs first match
- Special replacement characters ($1, $&)
- Empty replacement string
- Case-insensitive flag
```

---

### 5. Database-Specific Tests (Medium Priority)

#### Cross-Database Compatibility Matrix
```
| Function      | SQLite | MySQL | PostgreSQL |
|---------------|--------|-------|------------|
| REGEX_MATCH   | ❌     | ✅    | ✅         |
| ARRAYSORT     | Custom | Custom| Native     |
| CONCAT        | ||     | CONCAT| CONCAT     |
```

#### SQLite Limitations
```
- Functions not natively supported
- Custom implementations validation
```

#### PostgreSQL Array Functions
```
- Native array handling optimization
- Array type casting
```

---

### 6. Complex Scenarios (Lower Priority)

#### Deeply Nested Formulas
```
- 3+ levels of formula references
- Circular reference detection at depth
- Performance with deep nesting
```

#### Mixed Data Type Operations
```
- Number + String concatenation
- Date + Number arithmetic
- Boolean in numeric context
```

#### Array Operations with Various Types
```
- ARRAYSORT on dates
- ARRAYUNIQUE on user fields
- ARRAYCOMPACT with mixed null/empty
- ARRAYSLICE with negative indices
```

---

### 7. Integration Scenarios (Lower Priority)

#### Formula as Primary Display Value
```
- In lookup fields
- In link records
- In API responses
```

#### Bulk Operations
```
- Formula recalculation on bulk update
- Performance with large datasets
```

#### Concurrent Updates
```
- Formula consistency under concurrent changes
```

---

## Summary Table

| Priority | Category | Estimated Test Count |
|----------|----------|---------------------|
| 1 | Individual function tests | ~50 tests |
| 2 | Edge cases (NULL, empty, overflow) | ~30 tests |
| 3 | Date functions | ~20 tests |
| 4 | REGEX functions | ~15 tests |
| 5 | Database-specific | ~20 tests |
| 6 | Complex scenarios | ~15 tests |
| 7 | Integration scenarios | ~10 tests |

**Total potential new tests: ~160**
