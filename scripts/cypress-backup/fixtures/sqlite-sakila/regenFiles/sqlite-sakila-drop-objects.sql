/*

Sakila for SQLite is a port of the Sakila example database available for MySQL, which was originally developed by Mike Hillyer of the MySQL AB documentation team. 
This project is designed to help database administrators to decide which database to use for development of new products
The user can run the same SQL against different kind of databases and compare the performance

License: BSD
Copyright DB Software Laboratory
http://www.etl-tools.com

*/

-- Drop Views

DROP VIEW customer_list
;
DROP VIEW film_list
;
--DROP VIEW nicer_but_slower_film_list;
DROP VIEW sales_by_film_category
;
DROP VIEW sales_by_store
;
DROP VIEW staff_list
;

-- Drop Tables

DROP TABLE payment
;
DROP TABLE rental
;
DROP TABLE inventory
;
DROP TABLE film_text
;
DROP TABLE film_category
;
DROP TABLE film_actor
;
DROP TABLE film
;
DROP TABLE language
;
DROP TABLE customer
;
DROP TABLE actor
;
DROP TABLE category
;
DROP TABLE store
;
DROP TABLE address
;
DROP TABLE staff
;
DROP TABLE city
;
DROP TABLE country
;

-- Procedures and views
--drop procedure film_in_stock;
--drop procedure film_not_in_stock;
--drop function get_customer_balance;
--drop function inventory_held_by_customer;
--drop function inventory_in_stock;
--drop procedure rewards_report;


