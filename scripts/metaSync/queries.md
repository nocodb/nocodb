

### Init

```sql
CREATE TABLE `table_col_delete` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(45) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_col_add` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_rel_add_child` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_rel_add_parent` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_rel_remove_parent` (
  `id` int NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_rel_remove_child` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_to_rel_remove_parent_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `table_to_rel_remove_parent_fk_idx` (`table_to_rel_remove_parent_id`),
  CONSTRAINT `table_to_rel_remove_parent_fk` FOREIGN KEY (`table_to_rel_remove_parent_id`) REFERENCES `table_to_rel_remove_parent` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE `table_to_remove` (
  `id` int NOT NULL AUTO_INCREMENT,
  `table_to_removecol` varchar(45) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

```


## Col delete

```sql
ALTER TABLE `table_col_delete` 
DROP COLUMN `title`;
```

## Rel delete

```sql
ALTER TABLE `table_to_rel_remove_child` 
DROP FOREIGN KEY `table_to_rel_remove_parent_fk`;
ALTER TABLE `table_to_rel_remove_child` 
DROP COLUMN `table_to_rel_remove_parent_id`,
DROP INDEX `table_to_rel_remove_parent_fk_idx` ;
```

## table delete

```sql
DROP TABLE `table_to_remove`;`
```

## column add

```sql
ALTER TABLE `table_to_col_add` 
ADD COLUMN `new_col_1` VARCHAR(45) NULL AFTER `new_col`;
```


## Add rel

```sql
ALTER TABLE `table_to_rel_add_child` 
ADD COLUMN `parent_id` INT NULL AFTER `id`,
ADD INDEX `_p_fk_idx` (`parent_id` ASC) VISIBLE;
;
ALTER TABLE `table_to_rel_add_child` 
ADD CONSTRAINT `_p_fk`
  FOREIGN KEY (`parent_id`)
  REFERENCES `table_to_rel_add_parent` (`id`)
  ON DELETE NO ACTION
  ON UPDATE NO ACTION;
```
