---
title: 'Formula' 
description: 'Formula' 
position: 13 
category: 'Setup and Usages' 
menuTitle: 'Formula'
---

## Available Formula Features

### Functions

| Name  | Syntax | Sample | Description |
|---|---|---|---|
| AVG | `AVG(value1, [value2,...])` | `AVG(Column1, Column1)` | Calculates the average of provided values and it requires minimum 1 argument |
| ADD | `ADD(value1, [value2,...])` |  `ADD(Column1, Column1)` | Calculates the sum of provided values and requires a minimum of 1 argument |
| CONCAT | `CONCAT(value1, [value2,...])` |  `CONCAT(FirstName, ' ', LastName)` | Outputs concatenated string of provided arguments |
| TRIM | `TRIM(value1)` |  `TRIM(Title)` | Removes trailing and leading whitespaces |
| UPPER | `UPPER(value1)` |  `UPPER(Title)` | Converts provided string arguments to upper case |
| LOWER | `LOWER(value1)` |  `LOWER(Title)` | Converts provided string arguments to lower case |
| LEN | `LEN(value)` |  `LEN(Title)` | Outputs provided arguments character length |
| MIN | `MIN(value1, [value2,...])` |  `MIN(Column1, Column2, Column3)` | Outputs lowest value among provided arguments |
| MAX | `MAX(value1, [value2,...])` |  `MAX(Column1, Column2, Column3)` | Outputs greatest value among provided arguments |
| CEILING | `CEILING(value1)` |  `CEILING(Column)` | Rounds a number up to the next largest integer value |
| FLOOR | `FLOOR(value1)`|  `FLOOR(Column)` | Outputs the largest integer which is less than or equal to the provided |
| ROUND | `ROUND(value1)`|  `ROUND(Column)` | Outputs the nearest integer to the provided value |
| MOD |`MOD(value1, value2)` |  `MOD(Column, 2)` | Outputs the remainder after integer division, it requires 2 arguments  |
| REPEAT | `REPEAT(value1, count)`|  `REPEAT(Column, 2)` | Generate a specified number of copies of the string concatenated together |
| LOG | `LOG(value1, [base])`|  `LOG(Column)` | Outputs logarithm of a value|
| EXP | `EXP(value1)` |  `EXP(Column)` | Outputs the exponential value of a number (`e^x`) |
| POWER | `POWER(base, exponent)` |  `POWER(Column, 3)`  | Outputs the `base` to the `exponent` power, as in `base^exponent`|
| SQRT | `SQRT(value1)` |  `SQRT(Column)` | Outputs square root of the value |
| ABS | `ABS(value1)` |  `ABS(Column)` | Provides absolute value of the value |
| NOW | `NOW()` |  `NOW()` | Use to get current date time |
| REPLACE | `REPLACE(value1, old_str,new_str)` |  `REPLACE(Column, old_string, new_String)` | Replaces all occurrences of `old_string` with `new_String` and returns the new string |
| SEARCH | `SEARCH(value1, search_val)` |  `SEARCH(Column, 'str')` | Search for a string and returns the index of the string position |
| INT | `INT(value1)` |  `INT(Column)` | Converts the value to integer and returns |
| RIGHT | `RIGHT(value1, count)` |  `RIGHT(Column, 3)` | Extracts `n` characters from the ending of string |
| LEFT | `LEFT(value1, [value2,...])` |  `LEFT(Column, 3)` | Extracts `n` characters from the sbeginning of string |
| SUBSTR | `SUBTR(value1, position, [count])` |  `SUBSTR(Column, 3, 2)` | Extract substring from a string |
| MID | `SUBTR(value1, position, [count])` |  `MID(Column, 3, 2)` |  It's an alias for `SUBSTR` |
| IF | `MIN(expression, success_case, [else_case])` |  `IF(Column > 1, Value1, Value2)`  | If condition satisfies it return `Value1` or it returns `Value2` |
| SWITCH | `MIN(expression, [pattern,value,..., default_value])` |  `SWITCH(Column1, 1, 'One', 2, 'Two', '--')` | Based on pattern match it return corresponding values |
| AND | `AND(expression1, [expression2,...])` |  `AND(Column > 2, Column < 10)` | Checks all conditions are satisfying |
| OR | `OR(expression1, [expression2,...])` | `OR(Column > 2, Column < 10)` | Checks at least  one condition is satisfying |

### Numeric Operators

| Operator | Sample | Description |
|---|---|---|
| `+` | `column1 + column2 + 2` | Addition of numeric values |
| `-` | `column1 - column2` | Subtraction of numeric values |
| `*` | `column1 * column2` | Multiplication of numeric values |
| `-` | `column1 / column2` | Divide numeric values |

### Logical operators

| Operator | Sample | Description |
|---|---|---|
| `<` | `column1 < column2` | Less than |
| `>` | `column1 > column2` | Greater than |
| `<=` | `column1 <= column2` | Less than or equal to |
| `>=` | `column1 >= column2` | Greater than or equal to  |
| `==` | `column1 == column2` | Equal to  |
| `!=` | `column1 != column2` | Not equal to  |
