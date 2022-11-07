/*

Sakila for SQLite is a port of the Sakila example database available for MySQL, which was originally developed by Mike Hillyer of the MySQL AB documentation team. 
This project is designed to help database administrators to decide which database to use for development of new products
The user can run the same SQL against different kind of databases and compare the performance

License: BSD
Copyright DB Software Laboratory
http://www.etl-tools.com

*/


CREATE TABLE prefix___actor (
  actor_id numeric NOT NULL ,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (actor_id)
  )  ;

CREATE  INDEX prefix___idx_actor_last_name ON prefix___actor(last_name)
;
 
CREATE TRIGGER prefix___actor_trigger_ai AFTER INSERT ON prefix___actor
 BEGIN
  UPDATE prefix___actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___actor_trigger_au AFTER UPDATE ON prefix___actor
 BEGIN
  UPDATE prefix___actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

 --
-- Table structure for table country
--

CREATE TABLE prefix___country (
  country_id SMALLINT NOT NULL,
  country VARCHAR(50) NOT NULL,
  last_update TIMESTAMP,
  PRIMARY KEY  (country_id)
)
;

CREATE TRIGGER prefix___country_trigger_ai AFTER INSERT ON prefix___country
 BEGIN
  UPDATE prefix___country SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___country_trigger_au AFTER UPDATE ON prefix___country
 BEGIN
  UPDATE prefix___country SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table city
--

CREATE TABLE prefix___city (
  city_id int NOT NULL,
  city VARCHAR(50) NOT NULL,
  country_id SMALLINT NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (city_id),
  CONSTRAINT prefix___fk_city_country FOREIGN KEY (country_id) REFERENCES prefix___country (country_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;
CREATE  INDEX prefix___idx_fk_country_id ON prefix___city(country_id)
;

CREATE TRIGGER prefix___city_trigger_ai AFTER INSERT ON prefix___city
 BEGIN
  UPDATE prefix___city SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___city_trigger_au AFTER UPDATE ON prefix___city
 BEGIN
  UPDATE prefix___city SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table address
--

CREATE TABLE prefix___address (
  address_id int NOT NULL,
  address VARCHAR(50) NOT NULL,
  address2 VARCHAR(50) DEFAULT NULL,
  district VARCHAR(20) NOT NULL,
  city_id INT  NOT NULL,
  postal_code VARCHAR(10) DEFAULT NULL,
  phone VARCHAR(20) NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (address_id),
  CONSTRAINT prefix___fk_address_city FOREIGN KEY (city_id) REFERENCES prefix___city (city_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;

CREATE  INDEX prefix___idx_fk_city_id ON prefix___address(city_id)
;

CREATE TRIGGER prefix___address_trigger_ai AFTER INSERT ON prefix___address
 BEGIN
  UPDATE prefix___address SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___address_trigger_au AFTER UPDATE ON prefix___address
 BEGIN
  UPDATE prefix___address SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table language
--

CREATE TABLE prefix___language (
  language_id SMALLINT NOT NULL ,
  name CHAR(20) NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY (language_id)
)
;

CREATE TRIGGER prefix___language_trigger_ai AFTER INSERT ON prefix___language
 BEGIN
  UPDATE prefix___language SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___language_trigger_au AFTER UPDATE ON prefix___language
 BEGIN
  UPDATE prefix___language SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table category
--

CREATE TABLE prefix___category (
  category_id SMALLINT NOT NULL,
  name VARCHAR(25) NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (category_id)
);

CREATE TRIGGER prefix___category_trigger_ai AFTER INSERT ON prefix___category
 BEGIN
  UPDATE prefix___category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___category_trigger_au AFTER UPDATE ON prefix___category
 BEGIN
  UPDATE prefix___category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table customer
--

CREATE TABLE prefix___customer (
  customer_id INT NOT NULL,
  store_id INT NOT NULL,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  email VARCHAR(50) DEFAULT NULL,
  address_id INT NOT NULL,
  active CHAR(1) DEFAULT 'Y' NOT NULL,
  create_date TIMESTAMP NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (customer_id),
  CONSTRAINT prefix___fk_customer_store FOREIGN KEY (store_id) REFERENCES prefix___store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_customer_address FOREIGN KEY (address_id) REFERENCES prefix___address (address_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;

CREATE  INDEX prefix___idx_customer_fk_store_id ON prefix___customer(store_id)
;
CREATE  INDEX prefix___idx_customer_fk_address_id ON prefix___customer(address_id)
;
CREATE  INDEX prefix___idx_customer_last_name ON prefix___customer(last_name)
;

CREATE TRIGGER prefix___customer_trigger_ai AFTER INSERT ON prefix___customer
 BEGIN
  UPDATE prefix___customer SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___customer_trigger_au AFTER UPDATE ON prefix___customer
 BEGIN
  UPDATE prefix___customer SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table film
--

CREATE TABLE prefix___film (
  film_id int NOT NULL,
  title VARCHAR(255) NOT NULL,
  description BLOB SUB_TYPE TEXT DEFAULT NULL,
  release_year VARCHAR(4) DEFAULT NULL,
  language_id SMALLINT NOT NULL,
  original_language_id SMALLINT DEFAULT NULL,
  rental_duration SMALLINT  DEFAULT 3 NOT NULL,
  rental_rate DECIMAL(4,2) DEFAULT 4.99 NOT NULL,
  length SMALLINT DEFAULT NULL,
  replacement_cost DECIMAL(5,2) DEFAULT 19.99 NOT NULL,
  rating VARCHAR(10) DEFAULT 'G',
  special_features VARCHAR(100) DEFAULT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (film_id),
  CONSTRAINT CHECK_special_features CHECK(special_features is null or
                                                           special_features like '%Trailers%' or
                                                           special_features like '%Commentaries%' or
                                                           special_features like '%Deleted Scenes%' or
                                                           special_features like '%Behind the Scenes%'),
  CONSTRAINT CHECK_special_rating CHECK(rating in ('G','PG','PG-13','R','NC-17')),
  CONSTRAINT prefix___fk_film_language FOREIGN KEY (language_id) REFERENCES prefix___language (language_id) ,
  CONSTRAINT prefix___fk_film_language_original FOREIGN KEY (original_language_id) REFERENCES prefix___language (language_id)
)
;
CREATE  INDEX prefix___idx_fk_language_id ON prefix___film(language_id)
;
CREATE  INDEX prefix___idx_fk_original_language_id ON prefix___film(original_language_id)
;

CREATE TRIGGER prefix___film_trigger_ai AFTER INSERT ON prefix___film
 BEGIN
  UPDATE prefix___film SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___film_trigger_au AFTER UPDATE ON prefix___film
 BEGIN
  UPDATE prefix___film SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table film_actor
--

CREATE TABLE prefix___film_actor (
  actor_id INT NOT NULL,
  film_id  INT NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (actor_id,film_id),
  CONSTRAINT prefix___fk_film_actor_actor FOREIGN KEY (actor_id) REFERENCES prefix___actor (actor_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_film_actor_film FOREIGN KEY (film_id) REFERENCES prefix___film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;

CREATE  INDEX prefix___idx_fk_film_actor_film ON prefix___film_actor(film_id)
;

CREATE  INDEX prefix___idx_fk_film_actor_actor ON prefix___film_actor(actor_id) 
;

CREATE TRIGGER prefix___film_actor_trigger_ai AFTER INSERT ON prefix___film_actor
 BEGIN
  UPDATE prefix___film_actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___film_actor_trigger_au AFTER UPDATE ON prefix___film_actor
 BEGIN
  UPDATE prefix___film_actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;


--
-- Table structure for table film_category
--

CREATE TABLE prefix___film_category (
  film_id INT NOT NULL,
  category_id SMALLINT  NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY (film_id, category_id),
  CONSTRAINT prefix___fk_film_category_film FOREIGN KEY (film_id) REFERENCES prefix___film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_film_category_category FOREIGN KEY (category_id) REFERENCES prefix___category (category_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;

CREATE  INDEX prefix___idx_fk_film_category_film ON prefix___film_category(film_id)
;

CREATE  INDEX prefix___idx_fk_film_category_category ON prefix___film_category(category_id)
;

CREATE TRIGGER prefix___film_category_trigger_ai AFTER INSERT ON prefix___film_category
 BEGIN
  UPDATE prefix___film_category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___film_category_trigger_au AFTER UPDATE ON prefix___film_category
 BEGIN
  UPDATE prefix___film_category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table film_text
--

CREATE TABLE prefix___film_text (
  film_id SMALLINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description BLOB SUB_TYPE TEXT,
  PRIMARY KEY  (film_id)
)
;

--
-- Table structure for table inventory
--

CREATE TABLE prefix___inventory (
  inventory_id INT NOT NULL,
  film_id INT NOT NULL,
  store_id INT NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (inventory_id),
  CONSTRAINT prefix___fk_inventory_store FOREIGN KEY (store_id) REFERENCES prefix___store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_inventory_film FOREIGN KEY (film_id) REFERENCES prefix___film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;

CREATE  INDEX prefix___idx_fk_film_id ON prefix___inventory(film_id)
;

CREATE  INDEX prefix___idx_fk_film_id_store_id ON prefix___inventory(store_id,film_id)
;

CREATE TRIGGER prefix___inventory_trigger_ai AFTER INSERT ON prefix___inventory
 BEGIN
  UPDATE prefix___inventory SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___inventory_trigger_au AFTER UPDATE ON prefix___inventory
 BEGIN
  UPDATE prefix___inventory SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table staff
--

CREATE TABLE prefix___staff (
  staff_id SMALLINT NOT NULL,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  address_id INT NOT NULL,
  picture BLOB DEFAULT NULL,
  email VARCHAR(50) DEFAULT NULL,
  store_id INT NOT NULL,
  active SMALLINT DEFAULT 1 NOT NULL,
  username VARCHAR(16) NOT NULL,
  password VARCHAR(40) DEFAULT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (staff_id),
  CONSTRAINT prefix___fk_staff_store FOREIGN KEY (store_id) REFERENCES prefix___store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_staff_address FOREIGN KEY (address_id) REFERENCES prefix___address (address_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
;
CREATE  INDEX prefix___idx_fk_staff_store_id ON prefix___staff(store_id)
;

CREATE  INDEX prefix___idx_fk_staff_address_id ON prefix___staff(address_id)
;

CREATE TRIGGER prefix___staff_trigger_ai AFTER INSERT ON prefix___staff
 BEGIN
  UPDATE prefix___staff SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___staff_trigger_au AFTER UPDATE ON prefix___staff
 BEGIN
  UPDATE prefix___staff SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table store
--

CREATE TABLE prefix___store (
  store_id INT NOT NULL,
  manager_staff_id SMALLINT NOT NULL,
  address_id INT NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (store_id),
  CONSTRAINT prefix___fk_store_staff FOREIGN KEY (manager_staff_id) REFERENCES prefix___staff (staff_id) ,
  CONSTRAINT prefix___fk_store_address FOREIGN KEY (address_id) REFERENCES prefix___address (address_id)
)
;

CREATE  INDEX prefix___idx_store_fk_manager_staff_id ON prefix___store(manager_staff_id)
;

CREATE  INDEX prefix___idx_fk_store_address ON prefix___store(address_id)
;

CREATE TRIGGER prefix___store_trigger_ai AFTER INSERT ON prefix___store
 BEGIN
  UPDATE prefix___store SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___store_trigger_au AFTER UPDATE ON prefix___store
 BEGIN
  UPDATE prefix___store SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

--
-- Table structure for table payment
--

CREATE TABLE prefix___payment (
  payment_id int NOT NULL,
  customer_id INT  NOT NULL,
  staff_id SMALLINT NOT NULL,
  rental_id INT DEFAULT NULL,
  amount DECIMAL(5,2) NOT NULL,
  payment_date TIMESTAMP NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY  (payment_id),
  CONSTRAINT prefix___fk_payment_rental FOREIGN KEY (rental_id) REFERENCES prefix___rental (rental_id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT prefix___fk_payment_customer FOREIGN KEY (customer_id) REFERENCES prefix___customer (customer_id) ,
  CONSTRAINT prefix___fk_payment_staff FOREIGN KEY (staff_id) REFERENCES prefix___staff (staff_id)
)
;
CREATE  INDEX prefix___idx_fk_staff_id ON prefix___payment(staff_id)
;
CREATE  INDEX prefix___idx_fk_customer_id ON prefix___payment(customer_id)
;

CREATE TRIGGER prefix___payment_trigger_ai AFTER INSERT ON prefix___payment
 BEGIN
  UPDATE prefix___payment SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___payment_trigger_au AFTER UPDATE ON prefix___payment
 BEGIN
  UPDATE prefix___payment SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;

CREATE TABLE prefix___rental (
  rental_id INT NOT NULL,
  rental_date TIMESTAMP NOT NULL,
  inventory_id INT  NOT NULL,
  customer_id INT  NOT NULL,
  return_date TIMESTAMP DEFAULT NULL,
  staff_id SMALLINT  NOT NULL,
  last_update TIMESTAMP NOT NULL,
  PRIMARY KEY (rental_id),
  CONSTRAINT prefix___fk_rental_staff FOREIGN KEY (staff_id) REFERENCES prefix___staff (staff_id) ,
  CONSTRAINT prefix___fk_rental_inventory FOREIGN KEY (inventory_id) REFERENCES prefix___inventory (inventory_id) ,
  CONSTRAINT prefix___fk_rental_customer FOREIGN KEY (customer_id) REFERENCES prefix___customer (customer_id)
)
;
CREATE INDEX prefix___idx_rental_fk_inventory_id ON prefix___rental(inventory_id)
;
CREATE INDEX prefix___idx_rental_fk_customer_id ON prefix___rental(customer_id)
;
CREATE INDEX prefix___idx_rental_fk_staff_id ON prefix___rental(staff_id)
;
CREATE UNIQUE INDEX   prefix___idx_rental_uq  ON prefix___rental (rental_date,inventory_id,customer_id)
;

CREATE TRIGGER prefix___rental_trigger_ai AFTER INSERT ON prefix___rental
 BEGIN
  UPDATE prefix___rental SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;
 
CREATE TRIGGER prefix___rental_trigger_au AFTER UPDATE ON prefix___rental
 BEGIN
  UPDATE prefix___rental SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid
 END
;


--
-- View structure for view customer_list
--

CREATE VIEW prefix___customer_list
AS
SELECT cu.customer_id AS ID,
       cu.first_name||' '||cu.last_name AS name,
       a.address AS address,
       a.postal_code AS zip_code,
       a.phone AS phone,
       prefix___city.city AS city,
       prefix___country.country AS country,
       case when cu.active=1 then 'active' else '' end AS notes,
       cu.store_id AS SID
FROM prefix___customer AS cu JOIN prefix___address AS a ON cu.address_id = a.address_id JOIN prefix___city ON a.city_id = prefix___city.city_id
    JOIN prefix___country ON prefix___city.country_id = prefix___country.country_id
;
--
-- View structure for view film_list
--

CREATE VIEW prefix___film_list
AS
SELECT prefix___film.film_id AS FID,
       prefix___film.title AS title,
       prefix___film.description AS description,
       prefix___category.name AS category,
       prefix___film.rental_rate AS price,
       prefix___film.length AS length,
       prefix___film.rating AS rating,
       prefix___actor.first_name||' '||prefix___actor.last_name AS actors
FROM prefix___category LEFT JOIN prefix___film_category ON prefix___category.category_id = prefix___film_category.category_id LEFT JOIN prefix___film ON prefix___film_category.film_id = prefix___film.film_id
        JOIN prefix___film_actor ON prefix___film.film_id = prefix___film_actor.film_id
    JOIN prefix___actor ON prefix___film_actor.actor_id = prefix___actor.actor_id
;

--
-- View structure for view staff_list
--

CREATE VIEW prefix___staff_list
AS
SELECT s.staff_id AS ID,
       s.first_name||' '||s.last_name AS name,
       a.address AS address,
       a.postal_code AS zip_code,
       a.phone AS phone,
       prefix___city.city AS city,
       prefix___country.country AS country,
       s.store_id AS SID
FROM prefix___staff AS s JOIN prefix___address AS a ON s.address_id = a.address_id JOIN prefix___city ON a.city_id = prefix___city.city_id
    JOIN prefix___country ON prefix___city.country_id = prefix___country.country_id
;
--
-- View structure for view sales_by_store
--

CREATE VIEW prefix___sales_by_store
AS
SELECT
  s.store_id
 ,c.city||','||cy.country AS store
 ,m.first_name||' '||m.last_name AS manager
 ,SUM(p.amount) AS total_sales
FROM prefix___payment AS p
INNER JOIN prefix___rental AS r ON p.rental_id = r.rental_id
INNER JOIN prefix___inventory AS i ON r.inventory_id = i.inventory_id
INNER JOIN prefix___store AS s ON i.store_id = s.store_id
INNER JOIN prefix___address AS a ON s.address_id = a.address_id
INNER JOIN prefix___city AS c ON a.city_id = c.city_id
INNER JOIN prefix___country AS cy ON c.country_id = cy.country_id
INNER JOIN prefix___staff AS m ON s.manager_staff_id = m.staff_id
GROUP BY  
  s.store_id
, c.city||','||cy.country
, m.first_name||' '||m.last_name
;
--
-- View structure for view sales_by_film_category
--
-- Note that total sales will add up to >100% because
-- some titles belong to more than 1 category
--

CREATE VIEW prefix___sales_by_film_category
AS
SELECT
c.name AS category
, SUM(p.amount) AS total_sales
FROM prefix___payment AS p
INNER JOIN prefix___rental AS r ON p.rental_id = r.rental_id
INNER JOIN prefix___inventory AS i ON r.inventory_id = i.inventory_id
INNER JOIN prefix___film AS f ON i.film_id = f.film_id
INNER JOIN prefix___film_category AS fc ON f.film_id = fc.film_id
INNER JOIN prefix___category AS c ON fc.category_id = c.category_id
GROUP BY c.name
;
