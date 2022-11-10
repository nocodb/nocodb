const mysqlSakilaTables = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'film_text',
  'language',
  'payment',
  'rental',
  'staff',
];

const mysqlSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

const pgSakilaTables = [
  'actor',
  'address',
  'category',
  'city',
  'country',
  'customer',
  'film',
  'language',
  'payment',
  'payment_p2007_01',
  'payment_p2007_02',
  'payment_p2007_03',
  'payment_p2007_04',
  'payment_p2007_05',
  'payment_p2007_06',
  'rental',
  'staff',
];

const pgSakilaSqlViews = [
  'actor_info',
  'customer_list',
  'film_list',
  'nicer_but_slower_film_list',
  'sales_by_film_category',
  'sales_by_store',
  'staff_list',
];

const sqliteSakilaSqlViews = ['customer_list', 'film_list', 'staff_list', 'sales_by_store', 'sales_by_film_category'];

export { mysqlSakilaTables, mysqlSakilaSqlViews, pgSakilaTables, pgSakilaSqlViews, sqliteSakilaSqlViews };
