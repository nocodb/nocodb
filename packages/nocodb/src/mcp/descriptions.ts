export const whereDescription = `Filter records using NocoDB query syntax.

SYNTAX:
  Basic:           (field,operator,value)
  No-value ops:    (field,operator)
  Date with sub:   (field,operator,sub_operator) or (field,operator,sub_operator,value)
  Multiple values: (field,operator,value1,value2,value3)

OPERATORS:

  Text/General:
    eq        Equal to                    (name,eq,John)
    neq       Not equal to                (status,neq,archived)
    like      Contains (use % wildcard)   (name,like,%john%)
    nlike     Does not contain            (name,nlike,%test%)
    in        In list of values           (status,in,active,pending,review)

  Numeric:
    gt        Greater than (>)            (price,gt,100)
    lt        Less than (<)               (stock,lt,10)
    gte       Greater than or equal (>=)  (rating,gte,4)
    lte       Less than or equal (<=)     (age,lte,65)

  Range:
    btw       Between (inclusive)         (price,btw,10,100)
    nbtw      Not between                 (score,nbtw,0,50)
    NOTE: btw/nbtw may not work for Currency fields. Use (field,gte,min)~and(field,lte,max) instead.

  Null/Empty (no value needed):
    blank     Is blank (null or empty)    (notes,blank)
    notblank  Is not blank                (email,notblank)
    null      Is null                     (deleted_at,null)
    notnull   Is not null                 (created_by,notnull)
    empty     Is empty string             (description,empty)
    notempty  Is not empty string         (title,notempty)

  Boolean/Checkbox (no value needed):
    checked      Is checked/true          (is_active,checked)
    notchecked   Is not checked/false     (is_archived,notchecked)

  Multi-Select/Tags:
    allof     Contains all of             (tags,allof,urgent,important)
    anyof     Contains any of             (tags,anyof,bug,feature)
    nallof    Does not contain all of     (tags,nallof,spam,junk)
    nanyof    Does not contain any of     (categories,nanyof,draft,deleted)

DATE/TIME FILTERING (for Date, DateTime, CreatedTime, LastModifiedTime fields):

  Date fields require a sub-operator. Syntax: (field,operator,sub_operator) or (field,operator,sub_operator,value)

  isWithin - Check if date falls within a time range:
    Sub-operators (no value): pastWeek, pastMonth, pastYear, nextWeek, nextMonth, nextYear
    Sub-operators (value = days): pastNumberOfDays, nextNumberOfDays
    Examples:
      (created_at,isWithin,pastWeek)           Last 7 days
      (created_at,isWithin,pastMonth)          Last 30 days
      (due_date,isWithin,pastNumberOfDays,14)  Last 14 days
      (due_date,isWithin,nextNumberOfDays,30)  Next 30 days

  eq, neq, gt, lt, gte, lte - Date comparisons (gt=after, lt=before, gte=on or after, lte=on or before):
    Sub-operators (no value): today, tomorrow, yesterday, oneWeekAgo, oneWeekFromNow, oneMonthAgo, oneMonthFromNow
    Sub-operators (value = days): daysAgo, daysFromNow
    Sub-operator (value = YYYY-MM-DD): exactDate
    Examples:
      (created_at,eq,today)                    Created today
      (due_date,lt,today)                      Overdue (before today)
      (updated_at,gt,oneWeekAgo)               Updated after one week ago
      (event_date,eq,exactDate,2024-06-15)     On exact date
      (deadline,lt,exactDate,2024-12-31)       Before Dec 31, 2024
      (created_at,gte,daysAgo,7)               Created within last 7 days

  btw - Date range (no sub-operator, uses YYYY-MM-DD):
      (event_date,btw,2024-01-01,2024-12-31)   Events in year 2024

  Null checks for dates (no sub-operator):
      (due_date,blank)                         Date is not set
      (due_date,notblank)                      Date is set

LOGICAL OPERATIONS:

  IMPORTANT: Use ~and, ~or, ~not (with tilde). Plain "and"/"or" will error.

  AND: (filter1)~and(filter2)           Example: (name,eq,John)~and(age,gte,18)
  OR:  (filter1)~or(filter2)            Example: (status,eq,active)~or(status,eq,pending)
  NOT: ~not(filter)                     Example: ~not(is_deleted,checked)
  
  Complex grouping: Use 'in' operator instead of nested OR conditions:
    Instead of: ((status,eq,active)~or(status,eq,pending))~and(country,eq,USA)
    Use:        (status,in,active,pending)~and(country,eq,USA)

SPECIAL VALUES:
  NULL value:         (field,eq,null)
  Empty string:       (field,eq,'') or (field,eq,"")
  Value with comma:   (field,eq,"hello, world")
  Value with quotes:  (field,eq,"it's here") or (field,eq,'say "hello"')
  Field with spaces:  (Full Name,eq,John)    NOTE: Do NOT use quotes around field names

EXAMPLES:
  Active users this month:     (status,eq,active)~and(created_at,isWithin,pastMonth)
  Overdue high-priority:       (due_date,lt,today)~and(priority,eq,high)~and(completed,notchecked)
  Orders $100-$500 pending:    (amount,gte,100)~and(amount,lte,500)~and(status,in,pending,processing)
  Updated recently, not archived: (updated_at,isWithin,pastNumberOfDays,14)~and~not(is_archived,checked)
  Multiple segments & countries: (Segment,in,Government,Enterprise)~and(Country,in,Germany,France)
`;

export const aggregationDescription = `Aggregation type:
       • Numerical: sum, min, max, avg, median, std_dev, range (for numbers)
       • Common: count, count_empty, count_filled, count_unique, percent_empty, percent_filled, percent_unique (for all types)
       • Boolean: checked, unchecked, percent_checked, percent_unchecked (for checkboxes)
       • Date: earliest_date, latest_date, date_range, month_range (for dates)`;
