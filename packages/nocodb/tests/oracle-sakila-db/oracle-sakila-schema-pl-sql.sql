BEGIN
  FOR r IN (SELECT * FROM user_types) LOOP
    EXECUTE IMMEDIATE 'DROP TYPE ' || r.type_name || ' FORCE';
  END LOOP;
END;
/

CREATE TYPE LANGUAGE_T AS OBJECT (
  language_id SMALLINT,
  name CHAR(20),
  last_update DATE
);
/

CREATE TYPE LANGUAGES_T AS TABLE OF LANGUAGE_T;
/

CREATE TYPE FILM_T AS OBJECT (
  film_id int,
  title VARCHAR(255),
  description CLOB,
  release_year VARCHAR(4),
  language LANGUAGE_T,
  original_language LANGUAGE_T,
  rental_duration SMALLINT,
  rental_rate DECIMAL(4,2),
  length SMALLINT,
  replacement_cost DECIMAL(5,2),
  rating VARCHAR(10),
  special_features VARCHAR(100),
  last_update DATE
);
/

CREATE TYPE FILMS_T AS TABLE OF FILM_T;
/

CREATE TYPE ACTOR_T AS OBJECT (
  actor_id numeric,
  first_name VARCHAR(45),
  last_name VARCHAR(45),
  last_update DATE
);
/

CREATE TYPE ACTORS_T AS TABLE OF ACTOR_T;
/

CREATE TYPE CATEGORY_T AS OBJECT (
  category_id SMALLINT,
  name VARCHAR(25),
  last_update DATE
);
/

CREATE TYPE CATEGORIES_T AS TABLE OF CATEGORY_T;
/

CREATE TYPE FILM_INFO_T AS OBJECT (
  film FILM_T,
  actors ACTORS_T,
  categories CATEGORIES_T
);
/

CREATE TYPE COUNTRY_T AS OBJECT (
  country_id SMALLINT,
  country VARCHAR(50),
  last_update DATE
);
/

CREATE TYPE CITY_T AS OBJECT (
  city_id int,
  city VARCHAR(50),
  country COUNTRY_T,
  last_update DATE
);
/

CREATE TYPE ADDRESS_T AS OBJECT (
  address_id int,
  address VARCHAR(50),
  address2 VARCHAR(50),
  district VARCHAR(20),
  city CITY_T,
  postal_code VARCHAR(10),
  phone VARCHAR(20),
  last_update DATE
);
/

CREATE TYPE CUSTOMER_T AS OBJECT (
  customer_id INT,
  first_name VARCHAR(45),
  last_name VARCHAR(45),
  email VARCHAR(50),
  address ADDRESS_T,
  active CHAR(1),
  create_date DATE,
  last_update DATE
);
/

CREATE TYPE CUSTOMERS_T AS TABLE OF CUSTOMER_T;
/

CREATE TYPE CUSTOMER_RENTAL_HISTORY_T AS OBJECT (
  customer CUSTOMER_T,
  films FILMS_T
);
/

CREATE OR REPLACE PACKAGE RENTALS AS
  FUNCTION GET_ACTOR(p_actor_id INT) RETURN ACTOR_T;
  FUNCTION GET_ACTORS RETURN ACTORS_T;
  FUNCTION GET_CUSTOMER(p_customer_id INT) RETURN CUSTOMER_T;
  FUNCTION GET_CUSTOMERS RETURN CUSTOMERS_T;
  FUNCTION GET_FILM(p_film_id INT) RETURN FILM_T;
  FUNCTION GET_FILMS RETURN FILMS_T;
  FUNCTION GET_CUSTOMER_RENTAL_HISTORY(p_customer_id INT) RETURN CUSTOMER_RENTAL_HISTORY_T;
  FUNCTION GET_CUSTOMER_RENTAL_HISTORY(p_customer CUSTOMER_T) RETURN CUSTOMER_RENTAL_HISTORY_T;
  FUNCTION GET_FILM_INFO(p_film_id INT) RETURN FILM_INFO_T;
  FUNCTION GET_FILM_INFO(p_film FILM_T) RETURN FILM_INFO_T;
END RENTALS;
/

CREATE OR REPLACE PACKAGE BODY RENTALS AS
  FUNCTION GET_ACTOR(p_actor_id INT) RETURN ACTOR_T IS
    v_result ACTOR_T;
  BEGIN
    SELECT ACTOR_T(
      a.actor_id,
      a.first_name,
      a.last_name,
      a.last_update
    )
    INTO v_result
    FROM actor a
    WHERE a.actor_id = p_actor_id;
    
    RETURN v_result;
  END GET_ACTOR;
  
  FUNCTION GET_ACTORS RETURN ACTORS_T IS
    v_result ACTORS_T;
  BEGIN
    SELECT ACTOR_T(
      a.actor_id,
      a.first_name,
      a.last_name,
      a.last_update
    )
    BULK COLLECT INTO v_result
    FROM actor a;
    
    RETURN v_result;
  END GET_ACTORS;
  
  FUNCTION GET_CUSTOMER(p_customer_id INT) RETURN CUSTOMER_T IS
    v_result CUSTOMER_T;
  BEGIN
    SELECT CUSTOMER_T(
      c.customer_id,
      c.first_name,
      c.last_name,
      c.email,
      ADDRESS_T(
        a.address_id,
        a.address,
        a.address2,
        a.district,
        CITY_T(
          i.city_id,
          i.city,
          COUNTRY_T(
            o.country_id,
            o.country,
            o.last_update
          ),
          i.last_update
        ),
        a.postal_code,
        a.phone,
        a.last_update
      ),
      c.active,
      c.create_date,
      c.last_update
    )
    INTO v_result
    FROM customer c
    LEFT JOIN address a ON c.address_id = a.address_id
    LEFT JOIN city i ON a.city_id = i.city_id
    LEFT JOIN country o ON i.country_id = o.country_id
    WHERE c.customer_id = p_customer_id;
    
    RETURN v_result;
  END GET_CUSTOMER;
  
  FUNCTION GET_CUSTOMERS RETURN CUSTOMERS_T IS
    v_result CUSTOMERS_T;
  BEGIN
    SELECT CUSTOMER_T(
      c.customer_id,
      c.first_name,
      c.last_name,
      c.email,
      ADDRESS_T(
        a.address_id,
        a.address,
        a.address2,
        a.district,
        CITY_T(
          i.city_id,
          i.city,
          COUNTRY_T(
            o.country_id,
            o.country,
            o.last_update
          ),
          i.last_update
        ),
        a.postal_code,
        a.phone,
        a.last_update
      ),
      c.active,
      c.create_date,
      c.last_update
    )
    BULK COLLECT INTO v_result
    FROM customer c
    LEFT JOIN address a ON c.address_id = a.address_id
    LEFT JOIN city i ON a.city_id = i.city_id
    LEFT JOIN country o ON i.country_id = o.country_id;
    
    RETURN v_result;
  END GET_CUSTOMERS;
  
  FUNCTION GET_FILM(p_film_id INT) RETURN FILM_T IS
    v_result FILM_T;
  BEGIN
    SELECT FILM_T(
      f.film_id,
      f.title,
      f.description,
      f.release_year,
      NVL2(l1.language_id,
        LANGUAGE_T(
          l1.language_id,
          l1.name,
          l1.last_update
        ),
        NULL
      ),
      NVL2(l2.language_id, 
        LANGUAGE_T(
          l2.language_id,
          l2.name,
          l2.last_update
        ),
        NULL
      ),
      f.rental_duration,
      f.rental_rate,
      f.length,
      f.replacement_cost,
      f.rating,
      f.special_features,
      f.last_update
    )
    INTO v_result
    FROM film f
    LEFT JOIN language l1 ON f.language_id = l1.language_id
    LEFT JOIN language l2 ON f.original_language_id = l2.language_id
    WHERE f.film_id = p_film_id;
    
    RETURN v_result;
  END GET_FILM;
  
  FUNCTION GET_FILMS RETURN FILMS_T IS
    v_result FILMS_T;
  BEGIN
    SELECT FILM_T(
      f.film_id,
      f.title,
      f.description,
      f.release_year,
      NVL2(l1.language_id,
        LANGUAGE_T(
          l1.language_id,
          l1.name,
          l1.last_update
        ),
        NULL
      ),
      NVL2(l2.language_id, 
        LANGUAGE_T(
          l2.language_id,
          l2.name,
          l2.last_update
        ),
        NULL
      ),
      f.rental_duration,
      f.rental_rate,
      f.length,
      f.replacement_cost,
      f.rating,
      f.special_features,
      f.last_update
    )
    BULK COLLECT INTO v_result
    FROM film f
    LEFT JOIN language l1 ON f.language_id = l1.language_id
    LEFT JOIN language l2 ON f.original_language_id = l2.language_id;
    
    RETURN v_result;
  END GET_FILMS;
  
  FUNCTION GET_CUSTOMER_RENTAL_HISTORY(p_customer_id INT) RETURN CUSTOMER_RENTAL_HISTORY_T IS
  BEGIN
    RETURN GET_CUSTOMER_RENTAL_HISTORY(GET_CUSTOMER(p_customer_id));
  END GET_CUSTOMER_RENTAL_HISTORY;
  
  FUNCTION GET_CUSTOMER_RENTAL_HISTORY(p_customer CUSTOMER_T) RETURN CUSTOMER_RENTAL_HISTORY_T IS
    v_films FILMS_T;
  BEGIN
    SELECT GET_FILM(f.film_id)
    BULK COLLECT INTO v_films
    FROM (
      SELECT DISTINCT f.film_id
      FROM film f
      LEFT JOIN inventory i ON i.film_id = f.film_id
      LEFT JOIN rental r ON r.inventory_id = i.inventory_id
      WHERE r.customer_id = p_customer.customer_id
    ) f
    ORDER BY f.film_id;
  
    RETURN CUSTOMER_RENTAL_HISTORY_T(
      p_customer,
      v_films
    );
  END GET_CUSTOMER_RENTAL_HISTORY;
  
  FUNCTION GET_FILM_INFO(p_film_id INT) RETURN FILM_INFO_T IS
  BEGIN
    RETURN GET_FILM_INFO(GET_FILM(p_film_id));
  END GET_FILM_INFO;
  
  FUNCTION GET_FILM_INFO(p_film FILM_T) RETURN FILM_INFO_T IS
    v_actors ACTORS_T;
    v_categories CATEGORIES_T;
  BEGIN
    SELECT ACTOR_T(
      a.actor_id,
      a.first_name,
      a.last_name,
      a.last_update
    )
    BULK COLLECT INTO v_actors
    FROM actor a
    JOIN film_actor fa ON fa.actor_id = a.actor_id
    WHERE fa.film_id = p_film.film_id
    ORDER BY a.actor_id;
    
    SELECT CATEGORY_T(
      c.category_id,
      c.name,
      c.last_update
    )
    BULK COLLECT INTO v_categories
    FROM category c
    JOIN film_category fc ON fc.category_id = c.category_id
    WHERE fc.film_id = p_film.film_id
    ORDER BY c.category_id;
    
    RETURN FILM_INFO_T(
      p_film,
      v_actors,
      v_categories
    );
  END GET_FILM_INFO;
  
END RENTALS;
/

CREATE PACKAGE customers AS
  TYPE person IS RECORD (
    first_name VARCHAR2(50),
    last_name VARCHAR2(50)
  );
  
  FUNCTION get_customer(p_customer_id NUMBER) RETURN person;
END customers;
/

CREATE PACKAGE BODY customers AS
  FUNCTION get_customer(p_customer_id NUMBER) RETURN person IS
    v_person customers.person;
  BEGIN
    SELECT c.first_name, c.last_name
    INTO v_person
    FROM customer c
    WHERE c.customer_id = p_customer_id;
    
    RETURN v_person;
  END get_customer;
END customers;
/
