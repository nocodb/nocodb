---
title: "Formulas"
description: "Formulas"
position: 570
category: "Product"
menuTitle: "Formulas"
---

## Adding formula column

![Formula](https://user-images.githubusercontent.com/86527202/144246227-42c44df6-7e3e-4b2c-9bb9-a3c213bcad20.png)

### 1. Click on '+' (Add column)

### 2. Populate column Name

### 3. Select column Type as 'Formula'

### 4. Insert required formula

- Can use column names in equation
- Can use explicit numberical values/ strings as needed
- Table below lists supported formula & associated syntax
- Nested formula (formula equation referring to another formula column) are not supported

### 5. Click on 'Save'

## Available Formula Features

### Numeric Functions

| Name        | Syntax                     | Sample                           | Output                                                           |
|-------------|----------------------------|----------------------------------|------------------------------------------------------------------|
| **ABS**     | `ABS(value)`               | `ABS(Column)`                    | Absolute value of the input parameter                            |
| **ADD**     | `ADD(value1,[value2,...])` | `ADD(Column1, Column1)`          | Sum of input parameters                                          |
| **AVG**     | `AVG(value1,[value2,...])` | `AVG(Column1, Column1)`          | Average of input parameters                                      |
| **CEILING** | `CEILING(value)`           | `CEILING(Column)`                | Rounded next largest integer value of input parameter            |
| **EXP**     | `EXP(value)`               | `EXP(Column)`                    | Exponential value of input parameter (`e^x`)                     |
| **FLOOR**   | `FLOOR(value)`             | `FLOOR(Column)`                  | Rounded largest integer less than or equal to input parameter    |
| **INT**     | `INT(value)`               | `INT(Column)`                    | Integer value of input parameter                                 |
| **LOG**     | `LOG([base], value)`       | `LOG(10, Column)`                | Logarithm of input parameter to the base (default = e) specified |
| **MAX**     | `MAX(value1,[value2,...])` | `MAX(Column1, Column2, Column3)` | Maximum value amongst input parameters                           |
| **MIN**     | `MIN(value1,[value2,...])` | `MIN(Column1, Column2, Column3)` | Minimum value amongst input parameters                           |
| **MOD**     | `MOD(value1, value2)`      | `MOD(Column, 2)`                 | Remainder after integer division of input parameters             |
| **POWER**   | `POWER(base, exponent)`    | `POWER(Column, 3)`               | `base` to the `exponent` power, as in `base^exponent`            |
| **ROUND**   | `ROUND(value)`             | `ROUND(Column)`                  | Nearest integer to the input parameter                           |
| **SQRT**    | `SQRT(value)`              | `SQRT(Column)`                   | Square root of the input parameter                               |


### Numeric Operators

| Operator | Sample                  | Description                      |
| -------- | ----------------------- | -------------------------------- |
| `+`      | `column1 + column2 + 2` | Addition of numeric values       |
| `-`      | `column1 - column2`     | Subtraction of numeric values    |
| `*`      | `column1 * column2`     | Multiplication of numeric values |
| `/`      | `column1 / column2`     | Division of numeric values       |

> To change order of arithmetic operation, use round bracket parantheses `()`  
> Example: `(column1 + (column2 * column3) / (3 - column4 ))`


### String Functions

| Name        | Syntax                           | Sample                          | Output                                                                    |
|-------------|----------------------------------|---------------------------------|---------------------------------------------------------------------------|
| **CONCAT**  | `CONCAT(str1, [str2,...])`       | `CONCAT(fName, ' ', lName)`     | Concatenated string of input parameters                                   |
| **LEFT**    | `LEFT(str1, [str2,...])`         | `LEFT(Column, 3)`               | `n` characters from the beginning of input parameter                      |
| **LEN**     | `LEN(str)`                       | `LEN(Title)`                    | Input parameter character length                                          |
| **LOWER**   | `LOWER(str)`                     | `LOWER(Title)`                  | Lower case converted string of input parameter                            |
| **MID**     | `SUBTR(str, position, [count])`  | `MID(Column, 3, 2)`             | Alias for `SUBSTR`                                                        |
| **REPEAT**  | `REPEAT(str, count)`             | `REPEAT(Column, 2)`             | Specified copies of the input parameter string concatenated together      |
| **REPLACE** | `REPLACE(str, srchStr, rplcStr)` | `REPLACE(Column, 'int', 'num')` | String, after replacing all occurrences of `srchStr` with `rplcStr`       |
| **RIGHT**   | `RIGHT(str, count)`              | `RIGHT(Column, 3)`              | `n` characters from the end of input parameter                            |
| **SEARCH**  | `SEARCH(str, srchStr)`           | `SEARCH(Column, 'str')`         | Index of `srchStr` specified if found, 0 otherwise                        |
| **SUBSTR**  | `SUBTR(str, position, [count])`  | `SUBSTR(Column, 3, 2)`          | Substring of length 'count' of input string, from the postition specified |
| **TRIM**    | `TRIM(str)`                      | `TRIM(Title)`                   | Remove trailing and leading whitespaces from input parameter              |
| **UPPER**   | `UPPER(str)`                     | `UPPER(Title)`                  | Upper case converted string of input parameter                            |
| **URL**     | `URL(str)`                       | `URL(Column)`                   | Convert to a hyperlink if it is a valid URL                               |

### Date Functions

| Name        | Syntax                                                    | Sample                                                | Output                                                                                                |
|-------------|-----------------------------------------------------------|-------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| **DATEADD** | `DATEADD(DATE_COL, 1, 'day')`                             | `DATEADD(date, 1, 'day')`                             | Supposing the DATE_COL is 2022-03-14. The result is 2022-03-15.                                       |
|             | `DATEADD(DATE_TIME_COL, 2, 'month')`                      | `DATEADD(datetime, 2, 'month')`                       | Supposing the DATE_COL is 2022-03-14 03:14. The result is 2022-05-14 03:14.                           |
|             | `IF(NOW() < DATE_COL, "true", "false")`                   | `IF(NOW() < date, "true", "false")`                   | If current date is less than DATE_COL, it returns true. Otherwise, it returns false.                  |
|             | `IF(NOW() < DATEADD(DATE_COL,10,'day'), "true", "false")` | `IF(NOW() < DATEADD(date,10,'day'), "true", "false")` | If the current date is less than DATE_COL plus 10 days, it returns true. Otherwise, it returns false. |

### Logical Operators

| Operator | Sample               | Description              |
| -------- | -------------------- | ------------------------ |
| `<`      | `column1 < column2`  | Less than                |
| `>`      | `column1 > column2`  | Greater than             |
| `<=`     | `column1 <= column2` | Less than or equal to    |
| `>=`     | `column1 >= column2` | Greater than or equal to |
| `==`     | `column1 == column2` | Equal to                 |
| `!=`     | `column1 != column2` | Not equal to             |


### Conditional Expressions

| Name       | Syntax                                         | Sample                                      | Output                                                      |
|------------|------------------------------------------------|---------------------------------------------|-------------------------------------------------------------|
| **IF**     | `IF(expr, successCase, [failCase])`            | `IF(Column > 1, Value1, Value2)`            | successCase if `expr` evaluates to TRUE, elseCase otherwise |
| **SWITCH** | `SWITCH(expr, [pattern, value, ..., default])` | `SWITCH(Column1, 1, 'One', 2, 'Two', '--')` | Switch case value based on `expr` output                    |
| **AND**    | `AND(expr1, [expr2,...])`                      | `AND(Column > 2, Column < 10)`              | TRUE if all `expr` evaluate to TRUE                         |
| **OR**     | `OR(expr1, [expr2,...])`                       | `OR(Column > 2, Column < 10)`               | TRUE if at least one `expr` evaluates to TRUE               |

Logical operators, along with Numerical operators can be used to build conditional `expressions`.   

Examples: 

```bash
IF(marksSecured > 80, "GradeA", "GradeB")  
```

```bash
SWITCH(quarterNumber,  
    1, 'Jan-Mar',
    2, 'Apr-Jun',
    3, 'Jul-Sep',
    4, 'Oct-Dec',
    'INVALID'
)
```

