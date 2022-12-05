 
CREATE TRIGGER actor_trigger_ai AFTER INSERT ON actor
 BEGIN
  UPDATE actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER actor_trigger_au AFTER UPDATE ON actor
 BEGIN
  UPDATE actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER country_trigger_ai AFTER INSERT ON country
 BEGIN
  UPDATE country SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER country_trigger_au AFTER UPDATE ON country
 BEGIN
  UPDATE country SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER city_trigger_ai AFTER INSERT ON city
 BEGIN
  UPDATE city SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER city_trigger_au AFTER UPDATE ON city
 BEGIN
  UPDATE city SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER address_trigger_ai AFTER INSERT ON address
 BEGIN
  UPDATE address SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER address_trigger_au AFTER UPDATE ON address
 BEGIN
  UPDATE address SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER language_trigger_ai AFTER INSERT ON language
 BEGIN
  UPDATE language SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER language_trigger_au AFTER UPDATE ON language
 BEGIN
  UPDATE language SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER category_trigger_ai AFTER INSERT ON category
 BEGIN
  UPDATE category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER category_trigger_au AFTER UPDATE ON category
 BEGIN
  UPDATE category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER customer_trigger_ai AFTER INSERT ON customer
 BEGIN
  UPDATE customer SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER customer_trigger_au AFTER UPDATE ON customer
 BEGIN
  UPDATE customer SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER film_trigger_ai AFTER INSERT ON film
 BEGIN
  UPDATE film SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER film_trigger_au AFTER UPDATE ON film
 BEGIN
  UPDATE film SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER film_actor_trigger_ai AFTER INSERT ON film_actor
 BEGIN
  UPDATE film_actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER film_actor_trigger_au AFTER UPDATE ON film_actor
 BEGIN
  UPDATE film_actor SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER film_category_trigger_ai AFTER INSERT ON film_category
 BEGIN
  UPDATE film_category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER film_category_trigger_au AFTER UPDATE ON film_category
 BEGIN
  UPDATE film_category SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER inventory_trigger_ai AFTER INSERT ON inventory
 BEGIN
  UPDATE inventory SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER inventory_trigger_au AFTER UPDATE ON inventory
 BEGIN
  UPDATE inventory SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER staff_trigger_ai AFTER INSERT ON staff
 BEGIN
  UPDATE staff SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER staff_trigger_au AFTER UPDATE ON staff
 BEGIN
  UPDATE staff SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER store_trigger_ai AFTER INSERT ON store
 BEGIN
  UPDATE store SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER store_trigger_au AFTER UPDATE ON store
 BEGIN
  UPDATE store SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER payment_trigger_ai AFTER INSERT ON payment
 BEGIN
  UPDATE payment SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER payment_trigger_au AFTER UPDATE ON payment
 BEGIN
  UPDATE payment SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;

CREATE TRIGGER rental_trigger_ai AFTER INSERT ON rental
 BEGIN
  UPDATE rental SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;
 
CREATE TRIGGER rental_trigger_au AFTER UPDATE ON rental
 BEGIN
  UPDATE rental SET last_update = DATETIME('NOW')  WHERE rowid = new.rowid;
 END
;