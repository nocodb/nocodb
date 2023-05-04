/*

Sakila for Microsoft SQL Server is a port of the Sakila example database available for MySQL, which was originally developed by Mike Hillyer of the MySQL AB documentation team. 
This project is designed to help database administrators to decide which database to use for development of new products
The user can run the same SQL against different kind of databases and compare the performance

License: BSD
Copyright DB Software Laboratory
http://www.etl-tools.com

*/

CREATE DATABASE sakila;
GO
USE sakila;

--
-- Table structure for table actor
--

CREATE TABLE actor (
  actor_id int NOT NULL IDENTITY ,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (actor_id)
  )
GO
 ALTER TABLE actor ADD CONSTRAINT [DF_actor_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_actor_last_name ON actor(last_name)
GO

--
-- Table structure for table country
--


CREATE TABLE country (
  country_id SMALLINT NOT NULL IDENTITY ,
  country VARCHAR(50) NOT NULL,
  last_update DATETIME,
  PRIMARY KEY NONCLUSTERED (country_id)
)
GO
 ALTER TABLE country ADD CONSTRAINT [DF_country_last_update] DEFAULT (getdate()) FOR last_update
GO

--
-- Table structure for table city
--

CREATE TABLE city (
  city_id int NOT NULL IDENTITY ,
  city VARCHAR(50) NOT NULL,
  country_id SMALLINT NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (city_id),
  CONSTRAINT fk_city_country FOREIGN KEY (country_id) REFERENCES country (country_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE city ADD CONSTRAINT [DF_city_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_country_id ON city(country_id)
GO

--
-- Table structure for table address
--

CREATE TABLE address (
  address_id int NOT NULL IDENTITY ,
  address VARCHAR(50) NOT NULL,
  address2 VARCHAR(50) DEFAULT NULL,
  district VARCHAR(20) NOT NULL,
  city_id INT  NOT NULL,
  postal_code VARCHAR(10) DEFAULT NULL,
  phone VARCHAR(20) NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (address_id)
)
GO
ALTER TABLE address ADD CONSTRAINT [DF_address_last_update] DEFAULT (getdate()) FOR last_update
GO
CREATE  INDEX idx_fk_city_id ON address(city_id)
GO
ALTER TABLE address ADD  CONSTRAINT fk_address_city FOREIGN KEY (city_id) REFERENCES city (city_id) ON DELETE NO ACTION ON UPDATE CASCADE
GO

--
-- Table structure for table language
--

CREATE TABLE language (
  language_id TINYINT NOT NULL IDENTITY,
  name CHAR(20) NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (language_id)
)
GO
 ALTER TABLE language ADD CONSTRAINT [DF_language_last_update] DEFAULT (getdate()) FOR last_update
GO

--
-- Table structure for table category
--

CREATE TABLE category (
  category_id TINYINT NOT NULL IDENTITY,
  name VARCHAR(25) NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (category_id)
)
GO
 ALTER TABLE category ADD CONSTRAINT [DF_category_last_update] DEFAULT (getdate()) FOR last_update
GO

--
-- Table structure for table customer
--

CREATE TABLE customer (
  customer_id INT NOT NULL IDENTITY ,
  store_id INT NOT NULL,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  email VARCHAR(50) DEFAULT NULL,
  address_id INT NOT NULL,
  active CHAR(1) NOT NULL DEFAULT 'Y',
  create_date DATETIME NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (customer_id),
  CONSTRAINT fk_customer_address FOREIGN KEY (address_id) REFERENCES address (address_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE customer ADD CONSTRAINT [DF_customer_last_update] DEFAULT (getdate()) FOR last_update
GO
 ALTER TABLE customer ADD CONSTRAINT [DF_customer_create_date] DEFAULT (getdate()) FOR create_date
GO
 CREATE  INDEX idx_fk_store_id ON customer(store_id)
GO
 CREATE  INDEX idx_fk_address_id ON customer(address_id)
GO
 CREATE  INDEX idx_last_name ON customer(last_name)
GO

--
-- Table structure for table film
--

CREATE TABLE film (
  film_id int NOT NULL IDENTITY ,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  release_year VARCHAR(4) NULL,
  language_id TINYINT NOT NULL,
  original_language_id TINYINT DEFAULT NULL,
  rental_duration TINYINT NOT NULL DEFAULT 3,
  rental_rate DECIMAL(4,2) NOT NULL DEFAULT 4.99,
  length SMALLINT DEFAULT NULL,
  replacement_cost DECIMAL(5,2) NOT NULL DEFAULT 19.99,
  rating VARCHAR(10) DEFAULT 'G',
  special_features VARCHAR(255) DEFAULT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (film_id),
  CONSTRAINT fk_film_language FOREIGN KEY (language_id) REFERENCES language (language_id) ,
  CONSTRAINT fk_film_language_original FOREIGN KEY (original_language_id) REFERENCES language (language_id)
)
GO
ALTER TABLE film ADD CONSTRAINT CHECK_special_features CHECK(special_features is null or
                                                              special_features like '%Trailers%' or
                                                              special_features like '%Commentaries%' or
                                                              special_features like '%Deleted Scenes%' or
                                                              special_features like '%Behind the Scenes%')
GO
ALTER TABLE film ADD CONSTRAINT CHECK_special_rating CHECK(rating in ('G','PG','PG-13','R','NC-17'))
GO
ALTER TABLE film ADD CONSTRAINT [DF_film_last_update] DEFAULT (getdate()) FOR last_update
GO
CREATE  INDEX idx_fk_language_id ON film(language_id)
GO
CREATE  INDEX idx_fk_original_language_id ON film(original_language_id)
GO


--
-- Table structure for table film_actor
--

CREATE TABLE film_actor (
  actor_id INT NOT NULL,
  film_id  INT NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (actor_id,film_id),
  CONSTRAINT fk_film_actor_actor FOREIGN KEY (actor_id) REFERENCES actor (actor_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT fk_film_actor_film FOREIGN KEY (film_id) REFERENCES film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE film_actor ADD CONSTRAINT [DF_film_actor_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_film_actor_film ON film_actor(film_id)
GO
 CREATE  INDEX idx_fk_film_actor_actor ON film_actor(actor_id)
GO

--
-- Table structure for table film_category
--

CREATE TABLE film_category (
  film_id INT NOT NULL,
  category_id TINYINT  NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (film_id, category_id),
  CONSTRAINT fk_film_category_film FOREIGN KEY (film_id) REFERENCES film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE,
  CONSTRAINT fk_film_category_category FOREIGN KEY (category_id) REFERENCES category (category_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE film_category ADD CONSTRAINT [DF_film_category_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_film_category_film ON film_category(film_id)
GO
 CREATE  INDEX idx_fk_film_category_category ON film_category(category_id)
GO
--
-- Table structure for table film_text
--

CREATE TABLE film_text (
  film_id SMALLINT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  PRIMARY KEY NONCLUSTERED (film_id),
)

--
-- Table structure for table inventory
--

CREATE TABLE inventory (
  inventory_id INT NOT NULL IDENTITY,
  film_id INT NOT NULL,
  store_id INT NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (inventory_id),
  CONSTRAINT fk_inventory_film FOREIGN KEY (film_id) REFERENCES film (film_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE inventory ADD CONSTRAINT [DF_inventory_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_film_id ON inventory(film_id)
GO
 CREATE  INDEX idx_fk_film_id_store_id ON inventory(store_id,film_id)
GO

--
-- Table structure for table staff
--

CREATE TABLE staff (
  staff_id TINYINT NOT NULL IDENTITY,
  first_name VARCHAR(45) NOT NULL,
  last_name VARCHAR(45) NOT NULL,
  address_id INT NOT NULL,
  picture IMAGE DEFAULT NULL,
  email VARCHAR(50) DEFAULT NULL,
  store_id INT NOT NULL,
  active BIT NOT NULL DEFAULT 1,
  username VARCHAR(16) NOT NULL,
  password VARCHAR(40) DEFAULT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (staff_id),
  CONSTRAINT fk_staff_address FOREIGN KEY (address_id) REFERENCES address (address_id) ON DELETE NO ACTION ON UPDATE CASCADE
)
GO
 ALTER TABLE staff ADD CONSTRAINT [DF_staff_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_store_id ON staff(store_id)
GO
 CREATE  INDEX idx_fk_address_id ON staff(address_id)
GO

--
-- Table structure for table store
--

CREATE TABLE store (
  store_id INT NOT NULL IDENTITY,
  manager_staff_id TINYINT NOT NULL,
  address_id INT NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (store_id),
  CONSTRAINT fk_store_staff FOREIGN KEY (manager_staff_id) REFERENCES staff (staff_id) ,
  CONSTRAINT fk_store_address FOREIGN KEY (address_id) REFERENCES address (address_id)
)

GO
 ALTER TABLE store ADD CONSTRAINT [DF_store_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE UNIQUE NONCLUSTERED INDEX idx_fk_address_id ON store(manager_staff_id)
GO
 CREATE  INDEX idx_fk_store_address ON store(address_id)
GO


--
-- Table structure for table payment
--

CREATE TABLE payment (
  payment_id int NOT NULL IDENTITY ,
  customer_id INT  NOT NULL,
  staff_id TINYINT NOT NULL,
  rental_id INT DEFAULT NULL,
  amount DECIMAL(5,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (payment_id),
  CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ,
  CONSTRAINT fk_payment_staff FOREIGN KEY (staff_id) REFERENCES staff (staff_id)
)
GO
 ALTER TABLE payment ADD CONSTRAINT [DF_payment_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE  INDEX idx_fk_staff_id ON payment(staff_id)
GO
 CREATE  INDEX idx_fk_customer_id ON payment(customer_id)
GO

--
-- Table structure for table rental
--

CREATE TABLE rental (
  rental_id INT NOT NULL IDENTITY,
  rental_date DATETIME NOT NULL,
  inventory_id INT  NOT NULL,
  customer_id INT  NOT NULL,
  return_date DATETIME DEFAULT NULL,
  staff_id TINYINT  NOT NULL,
  last_update DATETIME NOT NULL,
  PRIMARY KEY NONCLUSTERED (rental_id),
  CONSTRAINT fk_rental_staff FOREIGN KEY (staff_id) REFERENCES staff (staff_id) ,
  CONSTRAINT fk_rental_inventory FOREIGN KEY (inventory_id) REFERENCES inventory (inventory_id) ,
  CONSTRAINT fk_rental_customer FOREIGN KEY (customer_id) REFERENCES customer (customer_id)
)
GO
 ALTER TABLE rental ADD CONSTRAINT [DF_rental_last_update] DEFAULT (getdate()) FOR last_update
GO
 CREATE INDEX idx_fk_inventory_id ON rental(inventory_id)
GO
 CREATE INDEX idx_fk_customer_id ON rental(customer_id)
GO
 CREATE INDEX idx_fk_staff_id ON rental(staff_id)
GO
 CREATE UNIQUE INDEX   idx_uq  ON rental (rental_date,inventory_id,customer_id)
GO

-- FK CONSTRAINTS
ALTER TABLE customer ADD CONSTRAINT fk_customer_store FOREIGN KEY (store_id) REFERENCES store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE
GO
ALTER TABLE inventory ADD CONSTRAINT fk_inventory_store FOREIGN KEY (store_id) REFERENCES store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE;
GO
ALTER TABLE staff ADD CONSTRAINT fk_staff_store FOREIGN KEY (store_id) REFERENCES store (store_id) ON DELETE NO ACTION ON UPDATE CASCADE;
GO
ALTER TABLE payment ADD CONSTRAINT fk_payment_rental FOREIGN KEY (rental_id) REFERENCES rental (rental_id) ON DELETE SET NULL ON UPDATE CASCADE;
GO

--
-- View structure for view customer_list
--

CREATE VIEW customer_list
AS
SELECT cu.customer_id AS ID,
       cu.first_name + ' ' + cu.last_name AS name,
       a.address AS address,
       a.postal_code AS zip_code,
	   a.phone AS phone,
	   city.city AS city,
	   country.country AS country,
	   case when cu.active=1 then 'active' else '' end AS notes,
	   cu.store_id AS SID
FROM customer AS cu JOIN address AS a ON cu.address_id = a.address_id JOIN city ON a.city_id = city.city_id
	JOIN country ON city.country_id = country.country_id
GO
--
-- View structure for view film_list
--

CREATE VIEW film_list
AS
SELECT film.film_id AS FID,
       film.title AS title,
       film.description AS description,
       category.name AS category,
       film.rental_rate AS price,
	   film.length AS length,
	   film.rating AS rating,
	   actor.first_name+' '+actor.last_name AS actors
FROM category LEFT JOIN film_category ON category.category_id = film_category.category_id LEFT JOIN film ON film_category.film_id = film.film_id
        JOIN film_actor ON film.film_id = film_actor.film_id
	JOIN actor ON film_actor.actor_id = actor.actor_id
GO

--
-- View structure for view staff_list
--

CREATE VIEW staff_list
AS
SELECT s.staff_id AS ID,
       s.first_name+' '+s.last_name AS name,
       a.address AS address,
       a.postal_code AS zip_code,
       a.phone AS phone,
	   city.city AS city,
	   country.country AS country,
	   s.store_id AS SID
FROM staff AS s JOIN address AS a ON s.address_id = a.address_id JOIN city ON a.city_id = city.city_id
	JOIN country ON city.country_id = country.country_id
GO
--
-- View structure for view sales_by_store
--

CREATE VIEW sales_by_store
AS
SELECT
  s.store_id
 ,c.city+','+cy.country AS store
 ,m.first_name+' '+ m.last_name AS manager
 ,SUM(p.amount) AS total_sales
FROM payment AS p
INNER JOIN rental AS r ON p.rental_id = r.rental_id
INNER JOIN inventory AS i ON r.inventory_id = i.inventory_id
INNER JOIN store AS s ON i.store_id = s.store_id
INNER JOIN address AS a ON s.address_id = a.address_id
INNER JOIN city AS c ON a.city_id = c.city_id
INNER JOIN country AS cy ON c.country_id = cy.country_id
INNER JOIN staff AS m ON s.manager_staff_id = m.staff_id
GROUP BY
  s.store_id
, c.city+ ','+cy.country
, m.first_name+' '+ m.last_name
GO
--
-- View structure for view sales_by_film_category
--
-- Note that total sales will add up to >100% because
-- some titles belong to more than 1 category
--

CREATE VIEW sales_by_film_category
AS
SELECT
c.name AS category
, SUM(p.amount) AS total_sales
FROM payment AS p
INNER JOIN rental AS r ON p.rental_id = r.rental_id
INNER JOIN inventory AS i ON r.inventory_id = i.inventory_id
INNER JOIN film AS f ON i.film_id = f.film_id
INNER JOIN film_category AS fc ON f.film_id = fc.film_id
INNER JOIN category AS c ON fc.category_id = c.category_id
GROUP BY c.name
GO

--
-- View structure for view actor_info
--

/*
CREATE VIEW actor_info
AS
SELECT
a.actor_id,
a.first_name,
a.last_name,
GROUP_CONCAT(DISTINCT CONCAT(c.name, ': ',
		(SELECT GROUP_CONCAT(f.title ORDER BY f.title SEPARATOR ', ')
                    FROM sakila.film f
                    INNER JOIN sakila.film_category fc
                      ON f.film_id = fc.film_id
                    INNER JOIN sakila.film_actor fa
                      ON f.film_id = fa.film_id
                    WHERE fc.category_id = c.category_id
                    AND fa.actor_id = a.actor_id
                 )
             )
             ORDER BY c.name SEPARATOR '; ')
AS film_info
FROM sakila.actor a
LEFT JOIN sakila.film_actor fa
  ON a.actor_id = fa.actor_id
LEFT JOIN sakila.film_category fc
  ON fa.film_id = fc.film_id
LEFT JOIN sakila.category c
  ON fc.category_id = c.category_id
GROUP BY a.actor_id, a.first_name, a.last_name;
*/

-- TO DO PROCEDURES
-- TO DO TRIGGERS

