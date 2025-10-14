export const whereDescription = `Filter records using NocoDB syntax: (field,operator,value)

OPERATORS:
- Equality: eq, neq, is, isnot
- Comparison: gt, lt, gte, lte  
- Text: like, nlike, in
- Null/Empty: null, notnull, blank, notblank, empty, notempty
- Boolean: checked, notchecked
- Array: allof, anyof, nallof, nanyof
- Range: btw, nbtw
- Date Range: isWithin (with sub-ops: pastWeek, pastMonth, pastYear, nextWeek, nextMonth, nextYear, pastNumberOfDays, nextNumberOfDays)

LOGICAL OPERATIONS:
- AND: (filter1)(filter2) or (filter1)~and(filter2)
- OR: (filter1)~or(filter2)  
- NOT: ~not(filter)
- Grouping: Use parentheses for precedence

EXAMPLES:
Basic: (name,eq,John), (age,gt,25), (status,in,active,pending)
Text: (title,like,%search%), (email,neq,'')
Null/Empty: (notes,blank), (id,notnull)
Dates: (created_at,eq,today), (due_date,isWithin,pastWeek), (event_date,btw,2024-01-01,2024-12-31)
Logical: (name,eq,John)~and(age,gt,18), ((dept,eq,eng)~or(dept,eq,sales))~and(active,eq,true)
Special: (field,eq,NULL), (field,eq,''), ('field with spaces',eq,value)

TIPS: Use % for wildcards with 'like', wrap values with spaces in quotes, combine filters with ~and/~or
`;

export const aggregationDescription = `Aggregation type:
       • Numerical: sum, min, max, avg, median, std_dev, range (for numbers)
       • Common: count, count_empty, count_filled, count_unique, percent_empty, percent_filled, percent_unique (for all types)
       • Boolean: checked, unchecked, percent_checked, percent_unchecked (for checkboxes)
       • Date: earliest_date, latest_date, date_range, month_range (for dates)`;
