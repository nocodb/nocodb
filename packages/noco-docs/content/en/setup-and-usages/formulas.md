---
title: 'Formulas' 
description: 'Formulas' 
position: 43 
category: 'Usage' 
menuTitle: 'Formulas'
---

## Adding Formula column
![Formula](https://user-images.githubusercontent.com/86527202/144246227-42c44df6-7e3e-4b2c-9bb9-a3c213bcad20.png)

#### 1. Click on '+' (Add column)
#### 2. Populate Column Name
#### 3. Select Column Type as 'Formula'
#### 4. Insert required formula
  - Can use column names in equation
  - Can use explicit numberical values/ strings as needed
  - Table below lists supported formula & associated syntax
  - Nested formula (formula equation referring to another formula column) are not supported
#### 5. Click on 'Save'  
  
  
  
## Available Formula Features

### Functions

| Name  | Syntax | Sample | Output | Minimum arguments |
|---|---|---|---|---|
| AVG | `AVG(value1, [value2,...])` | `AVG(Column1, Column1)` | Average of input parameters | 1 |
| ADD | `ADD(value1, [value2,...])` |  `ADD(Column1, Column1)` | Sum of input parameters | 1 |
| CONCAT | `CONCAT(value1, [value2,...])` |  `CONCAT(FirstName, ' ', LastName)` | Concatenated string of input parameters |
| TRIM | `TRIM(value1)` |  `TRIM(Title)` | Removes trailing and leading whitespaces from input parameter |
| UPPER | `UPPER(value1)` |  `UPPER(Title)` | Upper case converted string of input parameter |
| LOWER | `LOWER(value1)` |  `LOWER(Title)` | Lower case converted string of input parameter |
| LEN | `LEN(value)` |  `LEN(Title)` | Input parameter charachter length |
| MIN | `MIN(value1, [value2,...])` |  `MIN(Column1, Column2, Column3)` | Minimum value amongst input parameters |
| MAX | `MAX(value1, [value2,...])` |  `MAX(Column1, Column2, Column3)` | Maximum value amongst input parameters |
| CEILING | `CEILING(value1)` |  `CEILING(Column)` | Rounded next largest integer value of input parameter |
| FLOOR | `FLOOR(value1)`|  `FLOOR(Column)` | Rounded largest integer less than or equal to input parameter |
| ROUND | `ROUND(value1)`|  `ROUND(Column)` | Nearest integer to the input parameter |
| MOD |`MOD(value1, value2)` |  `MOD(Column, 2)` | Remainder after integer division of input parameters | 2 |
| REPEAT | `REPEAT(value1, count)`|  `REPEAT(Column, 2)` | Specified copies of the input parameter string concatenated together |
| LOG | `LOG(value1, [base])`|  `LOG(Column)` | Logarithm of input parameter to the base specified |
| EXP | `EXP(value1)` |  `EXP(Column)` | Exponential value of input parameter (`e^x`) |
| POWER | `POWER(base, exponent)` |  `POWER(Column, 3)`  | `base` to the `exponent` power, as in `base^exponent` |
| SQRT | `SQRT(value1)` |  `SQRT(Column)` | Square root of the input parameter |
| ABS | `ABS(value1)` |  `ABS(Column)` | Absolute value of the input parameter |
| NOW | `NOW()` |  `NOW()` | Current date time |
| REPLACE | `REPLACE(value1, old_str,new_str)` |  `REPLACE(Column, old_string, new_String)` | String, after replacing all occurrences of `old_string` with `new_String` |
| SEARCH | `SEARCH(value1, search_val)` |  `SEARCH(Column, 'str')` | Index of sub-string specified if found, 0 otherwise |
| INT | `INT(value1)` |  `INT(Column)` | Integer value of input parameter |
| RIGHT | `RIGHT(value1, count)` |  `RIGHT(Column, 3)` | `n` characters from the end of input parameter |
| LEFT | `LEFT(value1, [value2,...])` |  `LEFT(Column, 3)` | `n` characters from the beginning of input parameter |
| SUBSTR | `SUBTR(value1, position, [count])` |  `SUBSTR(Column, 3, 2)` | Substring of length 'count' of input string, from the postition specified |
| MID | `SUBTR(value1, position, [count])` |  `MID(Column, 3, 2)` |  Alias for `SUBSTR` |
| IF | `IF(expression, success_case, [else_case])` |  `IF(Column > 1, Value1, Value2)`  | success_case if expression evaluates to TRUE, else_case otherwise |
| SWITCH | `SWITCH(expression, [pattern,value,..., default_value])` |  `SWITCH(Column1, 1, 'One', 2, 'Two', '--')` | Switch case value based on expression output |
| AND | `AND(expression1, [expression2,...])` |  `AND(Column > 2, Column < 10)` | TRUE if all expressions evaluate to TRUE |
| OR | `OR(expression1, [expression2,...])` | `OR(Column > 2, Column < 10)` | TRUE if at least one expression evaluates to TRUE |

### Numeric Operators

| Operator | Sample | Description |
|---|---|---|
| `+` | `column1 + column2 + 2` | Addition of numeric values |
| `-` | `column1 - column2` | Subtraction of numeric values |
| `*` | `column1 * column2` | Multiplication of numeric values |
| `-` | `column1 / column2` | Division of numeric values |

### Logical operators

| Operator | Sample | Description |
|---|---|---|
| `<` | `column1 < column2` | Less than |
| `>` | `column1 > column2` | Greater than |
| `<=` | `column1 <= column2` | Less than or equal to |
| `>=` | `column1 >= column2` | Greater than or equal to  |
| `==` | `column1 == column2` | Equal to  |
| `!=` | `column1 != column2` | Not equal to  |
