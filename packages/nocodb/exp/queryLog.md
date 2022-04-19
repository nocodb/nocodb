# Country


```
  knex:client acquired connection from pool: __knexUid15 +1m
  knex:query select * from `nc_models_v2` where `base_id` = ? and `base_id` = ? and `title` = ? limit ? undefined +1m
  knex:bindings [ 'civil_pony_0uaa', 'db', 'country', 1 ] undefined +1m
  knex:client releasing connection to pool: __knexUid15 +8ms
  knex:client acquired connection from pool: __knexUid15 +3ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +9ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26abfe9c-db14-4fd6-b4c5-c752deec8fb9' ] undefined +8ms
  knex:client releasing connection to pool: __knexUid15 +2ms
  knex:client acquired connection from pool: __knexUid15 +2ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +4ms
  knex:bindings [ '740ddb73-18cd-418b-9407-79aab0fa391f', 1 ] undefined +4ms
  knex:client releasing connection to pool: __knexUid15 +2ms
  knex:client acquired connection from pool: __knexUid15 +2ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +4ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26abfe9c-db14-4fd6-b4c5-c752deec8fb9' ] undefined +4ms
  knex:client releasing connection to pool: __knexUid15 +2ms
  knex:client acquired connection from pool: __knexUid15 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +5ms
  knex:bindings [ '740ddb73-18cd-418b-9407-79aab0fa391f', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid15 +3ms
  knex:client acquired connection from pool: __knexUid18 +17ms
  knex:query select `country_id` as `CountryId`, `country` as `Country`, `last_update` as `LastUpdate` from `country` limit ? undefined +18ms
  knex:bindings [ 10 ] undefined +18ms
  knex:client releasing connection to pool: __knexUid18 +3ms
  knex:client acquired connection from pool: __knexUid15 +5s
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +5s
  knex:bindings [ 'civil_pony_0uaa', 'db', '26abfe9c-db14-4fd6-b4c5-c752deec8fb9' ] undefined +5s
  knex:client releasing connection to pool: __knexUid15 +288ms
  knex:client acquired connection from pool: __knexUid15 +2ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +290ms
  knex:bindings [ '740ddb73-18cd-418b-9407-79aab0fa391f', 1 ] undefined +290ms
  knex:client releasing connection to pool: __knexUid15 +4ms
  knex:client acquired connection from pool: __knexUid15 +3ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +7ms
  knex:bindings [ '740ddb73-18cd-418b-9407-79aab0fa391f', 1 ] undefined +7ms
  knex:client releasing connection to pool: __knexUid15 +7ms
  knex:client acquired connection from pool: __knexUid15 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +7ms
  knex:bindings [ '281d0f5e-6c52-422d-a11e-34591b71c3a6', 1 ] undefined +7ms
  knex:client releasing connection to pool: __knexUid15 +4ms
  knex:client acquired connection from pool: __knexUid15 +2ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +6ms
  knex:bindings [ '26316257-7bb6-44dd-b4a9-cc52b06de966', 1 ] undefined +6ms
  knex:client releasing connection to pool: __knexUid15 +5ms
  knex:client acquired connection from pool: __knexUid15 +1ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +6ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26316257-7bb6-44dd-b4a9-cc52b06de966' ] undefined +7ms
  knex:client releasing connection to pool: __knexUid15 +3ms
  knex:client acquired connection from pool: __knexUid15 +3ms
  knex:client acquired connection from pool: __knexUid13 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +7ms
  knex:bindings [ '3bfaed74-1df1-4baf-acbf-d59a30274eb5', 1 ] undefined +6ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'cf603f31-ad81-40c6-bb57-247d9ffae17c', 1 ] undefined +0ms
  knex:client releasing connection to pool: __knexUid15 +2ms
  knex:client releasing connection to pool: __knexUid13 +0ms
  knex:client acquired connection from pool: __knexUid18 +2ms
  knex:query select * from ((select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?) union (select `city`.`country_id` as `CountryId`, `city`.`last_update` as `LastUpdate`, `city`.`city_id` as `CityId`, `city`.`city` as `City` from `city` where `country_id` = ?)) as `list` undefined +4ms
  knex:bindings [
  knex:bindings   1, 2, 3, 4,  5,
  knex:bindings   6, 7, 8, 9, 10
  knex:bindings ] undefined +4ms
  knex:client releasing connection to pool: __knexUid18 +6ms
GET /nc/civil_pony_0uaa/api/v2/country 200 3228 - 9861.459 ms
```

# City

```
  knex:client acquired connection from pool: __knexUid13 +2m
  knex:query select * from `nc_models_v2` where `base_id` = ? and `base_id` = ? and `title` = ? limit ? undefined +2m
  knex:bindings [ 'civil_pony_0uaa', 'db', 'city', 1 ] undefined +2m
  knex:client releasing connection to pool: __knexUid13 +105ms
  knex:client acquired connection from pool: __knexUid13 +9ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +114ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26316257-7bb6-44dd-b4a9-cc52b06de966' ] undefined +114ms
  knex:client releasing connection to pool: __knexUid13 +3ms
  knex:client acquired connection from pool: __knexUid13 +3ms
  knex:client acquired connection from pool: __knexUid15 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +5ms
  knex:bindings [ '3bfaed74-1df1-4baf-acbf-d59a30274eb5', 1 ] undefined +5ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'cf603f31-ad81-40c6-bb57-247d9ffae17c', 1 ] undefined +0ms
  knex:client releasing connection to pool: __knexUid13 +1ms
  knex:client releasing connection to pool: __knexUid15 +1ms
  knex:client acquired connection from pool: __knexUid15 +2ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +4ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26316257-7bb6-44dd-b4a9-cc52b06de966' ] undefined +4ms
  knex:client releasing connection to pool: __knexUid15 +2ms
  knex:client acquired connection from pool: __knexUid15 +4ms
  knex:client acquired connection from pool: __knexUid13 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +6ms
  knex:bindings [ '3bfaed74-1df1-4baf-acbf-d59a30274eb5', 1 ] undefined +6ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'cf603f31-ad81-40c6-bb57-247d9ffae17c', 1 ] undefined +0ms
  knex:client releasing connection to pool: __knexUid15 +1ms
  knex:client releasing connection to pool: __knexUid13 +0ms
  knex:client acquired connection from pool: __knexUid18 +1ms
  knex:query select `country_id` as `CountryId`, `last_update` as `LastUpdate`, `city_id` as `CityId`, `city` as `City` from `city` limit ? undefined +3ms
  knex:bindings [ 10 ] undefined +3ms
  knex:client releasing connection to pool: __knexUid18 +2ms
  knex:client acquired connection from pool: __knexUid13 +4ms
  knex:client acquired connection from pool: __knexUid15 +0ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +5ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26316257-7bb6-44dd-b4a9-cc52b06de966' ] undefined +5ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +1ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '26abfe9c-db14-4fd6-b4c5-c752deec8fb9' ] undefined +1ms
  knex:client releasing connection to pool: __knexUid13 +3ms
  knex:client acquired connection from pool: __knexUid13 +3ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +5ms
  knex:bindings [ '3bfaed74-1df1-4baf-acbf-d59a30274eb5', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid15 +1ms
  knex:client acquired connection from pool: __knexUid15 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ 'cf603f31-ad81-40c6-bb57-247d9ffae17c', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid15 +1ms
  knex:client acquired connection from pool: __knexUid15 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '740ddb73-18cd-418b-9407-79aab0fa391f', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid13 +1ms
  knex:client acquired connection from pool: __knexUid13 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '3bfaed74-1df1-4baf-acbf-d59a30274eb5', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid15 +0ms
  knex:client acquired connection from pool: __knexUid18 +5ms
  knex:query select `country_id` as `CountryId`, `country` as `Country`, `last_update` as `LastUpdate` from `country` where `country_id` in (?, ?, ?, ?, ?, ?, ?, ?, ?) limit ? undefined +6ms
  knex:bindings [
  knex:bindings   '87',  '82', '101',
  knex:bindings   '60',  '97', '31',
  knex:bindings   '107', '44', '50',
  knex:bindings   10
  knex:bindings ] undefined +6ms
  knex:client releasing connection to pool: __knexUid13 +2ms
  knex:client acquired connection from pool: __knexUid13 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'fec65ed1-ed9c-41f0-b865-50f2e7007f72', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid13 +1ms
  knex:client acquired connection from pool: __knexUid13 +1ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'b5a1ff69-7428-4700-911d-49dca323b54f', 1 ] undefined +3ms
  knex:client releasing connection to pool: __knexUid18 +1ms
  knex:client releasing connection to pool: __knexUid13 +2ms
  knex:client acquired connection from pool: __knexUid13 +1ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +4ms
  knex:bindings [ 'civil_pony_0uaa', 'db', 'b5a1ff69-7428-4700-911d-49dca323b54f' ] undefined +3ms
  knex:client releasing connection to pool: __knexUid13 +1ms
  knex:client acquired connection from pool: __knexUid13 +7ms
  knex:client acquired connection from pool: __knexUid15 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +8ms
  knex:bindings [ '5a1982a1-efd0-4cf9-b793-e40b9550fb5d', 1 ] undefined +8ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '63faf720-0f17-4ead-a889-6552b8b7120c', 1 ] undefined +1ms
  knex:client acquired connection from pool: __knexUid19 +2ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '8fbb44af-5cda-4794-8cf7-83dd1102c166', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid13 +1ms
  knex:client acquired connection from pool: __knexUid13 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ 'b680fceb-a5ea-442e-a2d8-92f0aac4886c', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid15 +1ms
  knex:client releasing connection to pool: __knexUid13 +0ms
  knex:client releasing connection to pool: __knexUid19 +1ms
  knex:client acquired connection from pool: __knexUid18 +2ms
  knex:query select * from ((select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?) union (select `address`.`address_id` as `AddressId`, `address`.`postal_code` as `PostalCode`, `address`.`location` as `Location`, `address`.`phone` as `Phone`, `address`.`last_update` as `LastUpdate`, `address`.`district` as `District`, `address`.`address2` as `Address2`, `address`.`address` as `Address`, `address`.`city_id` as `CityId` from `address` where `city_id` = ?)) as `list` undefined +6ms
  knex:bindings [
  knex:bindings   1, 2, 3, 4,  5,
  knex:bindings   6, 7, 8, 9, 10
  knex:bindings ] undefined +7ms
  knex:client releasing connection to pool: __knexUid18 +15ms
GET /nc/civil_pony_0uaa/api/v2/city 200 4101 - 254.456 ms
```


# Film

```
  knex:client acquired connection from pool: __knexUid20 +53s
  knex:query select * from `nc_models_v2` where `base_id` = ? and `base_id` = ? and `title` = ? limit ? undefined +53s
  knex:bindings [ 'civil_pony_0uaa', 'db', 'film', 1 ] undefined +53s
  knex:client releasing connection to pool: __knexUid20 +9ms
  knex:client acquired connection from pool: __knexUid20 +7ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +15ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +15ms
  knex:client releasing connection to pool: __knexUid20 +7ms
  knex:client acquired connection from pool: __knexUid20 +17ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +24ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +24ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +130ms
  knex:client acquired connection from pool: __knexUid20 +3ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +132ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +132ms
  knex:client releasing connection to pool: __knexUid19 +2ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid20 +2ms
  knex:client acquired connection from pool: __knexUid20 +0ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid19 +1ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +2ms
  knex:client acquired connection from pool: __knexUid20 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +9ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +9ms
  knex:client releasing connection to pool: __knexUid19 +10ms
  knex:client releasing connection to pool: __knexUid20 +4ms
  knex:client acquired connection from pool: __knexUid20 +3ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +10ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +10ms
  knex:client releasing connection to pool: __knexUid20 +3ms
  knex:client acquired connection from pool: __knexUid20 +7ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +11ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +11ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +1ms
  knex:client acquired connection from pool: __knexUid21 +3ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +2ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +2ms
  knex:client acquired connection from pool: __knexUid22 +2ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +1ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +1ms
  knex:client acquired connection from pool: __knexUid25 +5ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +6ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +6ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client releasing connection to pool: __knexUid21 +1ms
  knex:client releasing connection to pool: __knexUid22 +0ms
  knex:client releasing connection to pool: __knexUid23 +0ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client releasing connection to pool: __knexUid19 +0ms
  knex:client releasing connection to pool: __knexUid25 +0ms
  knex:client acquired connection from pool: __knexUid18 +4ms
  knex:query select `rental_duration` as `RentalDuration`, `release_year` as `ReleaseYear`, `length` as `Length`, `title` as `Title`, `special_features` as `SpecialFeatures`, `language_id` as `LanguageId`, `last_update` as `LastUpdate`, `replacement_cost` as `ReplacementCost`, `rating` as `Rating`, `description` as `Description`, `film_id` as `FilmId`, `rental_rate` as `RentalRate`, `original_language_id` as `OriginalLanguageId` from `film` limit ? undefined +6ms
  knex:bindings [ 10 ] undefined +6ms
  knex:client releasing connection to pool: __knexUid18 +4ms
  knex:client acquired connection from pool: __knexUid25 +7ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:client acquired connection from pool: __knexUid24 +0ms
  knex:client acquired connection from pool: __knexUid23 +0ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +14ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +14ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +0ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +0ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +1ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +3ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +2ms
  knex:bindings [ 'civil_pony_0uaa', 'db', 'e841c594-87da-45e5-b56e-94f9539823f0' ] undefined +0ms
  knex:client releasing connection to pool: __knexUid25 +7ms
  knex:client acquired connection from pool: __knexUid25 +13ms
  knex:client acquired connection from pool: __knexUid22 +0ms
  knex:client acquired connection from pool: __knexUid21 +0ms
  knex:client acquired connection from pool: __knexUid20 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +14ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +14ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +0ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +1ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +0ms
  knex:client releasing connection to pool: __knexUid19 +2ms
  knex:client acquired connection from pool: __knexUid19 +6ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +8ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +8ms
  knex:client releasing connection to pool: __knexUid24 +5ms
  knex:client acquired connection from pool: __knexUid24 +5ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +10ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +10ms
  knex:client releasing connection to pool: __knexUid25 +2ms
  knex:client acquired connection from pool: __knexUid25 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid19 +1ms
  knex:client acquired connection from pool: __knexUid19 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +5ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +7ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +7ms
  knex:client releasing connection to pool: __knexUid22 +2ms
  knex:client acquired connection from pool: __knexUid22 +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +2ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +2ms
  knex:client releasing connection to pool: __knexUid21 +1ms
  knex:client acquired connection from pool: __knexUid21 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client acquired connection from pool: __knexUid20 +0ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid25 +1ms
  knex:client acquired connection from pool: __knexUid25 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid19 +1ms
  knex:client acquired connection from pool: __knexUid19 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid23 +2ms
  knex:client acquired connection from pool: __knexUid23 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid22 +1ms
  knex:client acquired connection from pool: __knexUid22 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid21 +5ms
  knex:client acquired connection from pool: __knexUid21 +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +5ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +5ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid25 +1ms
  knex:client acquired connection from pool: __knexUid25 +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid19 +0ms
  knex:client acquired connection from pool: __knexUid19 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid23 +0ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid22 +0ms
  knex:client acquired connection from pool: __knexUid22 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'b2cfb93b-ed5e-458f-bbfa-4d86392e08fe', 1 ] undefined +0ms
  knex:client releasing connection to pool: __knexUid21 +1ms
  knex:client acquired connection from pool: __knexUid21 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'b8957323-63d7-4234-9718-ed549eee548b', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client acquired connection from pool: __knexUid24 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client acquired connection from pool: __knexUid20 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +2ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid25 +7ms
  knex:client releasing connection to pool: __knexUid19 +0ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +9ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +9ms
  knex:client releasing connection to pool: __knexUid22 +1ms
  knex:client releasing connection to pool: __knexUid21 +0ms
  knex:client acquired connection from pool: __knexUid18 +3ms
  knex:query select `language_id` as `LanguageId`, `last_update` as `LastUpdate`, `name` as `Name` from `language` where `language_id` in (?) limit ? undefined +5ms
  knex:bindings [ '1', 10 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid24 +2ms
  knex:client acquired connection from pool: __knexUid24 +2ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +3ms
  knex:bindings [ '64c69c32-f2fd-4165-a778-3f9be23a1fa8', 1 ] undefined +3ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client acquired connection from pool: __knexUid20 +1ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ '80dafa38-489a-44e3-8b69-46ed8d968910', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +3ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +5ms
  knex:bindings [ 'dac5d9d9-4975-445c-99e7-ad21558a6518', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +1ms
  knex:bindings [ 'fd27f9e2-5bc5-4d5e-ac77-8224d0eb12ef', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +3ms
  knex:client acquired connection from pool: __knexUid20 +2ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +5ms
  knex:bindings [ 'de1149a5-1bbd-4596-8c37-571cce4aa7c9', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid18 +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +4ms
  knex:bindings [ '7b6b9191-90aa-40bc-8e42-425bd1f8dc31', 1 ] undefined +4ms
  knex:client releasing connection to pool: __knexUid24 +0ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'd0429da6-98cb-41e8-8658-bf98fc641a12', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client acquired connection from pool: __knexUid20 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +1ms
  knex:bindings [ 'f5236883-5484-434a-9f38-5a0428c9cef7', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'b9564356-bf51-4dea-a637-246d1adfd6f7', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid24 +3ms
  knex:client acquired connection from pool: __knexUid24 +2ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +5ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid20 +0ms
  knex:client acquired connection from pool: __knexUid20 +2ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +0ms
  knex:client acquired connection from pool: __knexUid23 +2ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ '3d5766d6-296f-419d-b0c6-e0f9fd2a7480', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid20 +1ms
  knex:client acquired connection from pool: __knexUid20 +1ms
  knex:query select * from `nc_columns_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ 'c693f4b7-b885-4dc7-b98f-104240e24c2e', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +1ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +2ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +2ms
  knex:client releasing connection to pool: __knexUid24 +1ms
  knex:client acquired connection from pool: __knexUid24 +0ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +2ms
  knex:bindings [ '3d5766d6-296f-419d-b0c6-e0f9fd2a7480', 1 ] undefined +2ms
  knex:client releasing connection to pool: __knexUid23 +1ms
  knex:client acquired connection from pool: __knexUid23 +8ms
  knex:client acquired connection from pool: __knexUid28 +0ms
  knex:client acquired connection from pool: __knexUid27 +0ms
  knex:client acquired connection from pool: __knexUid26 +0ms
  knex:client acquired connection from pool: __knexUid21 +0ms
  knex:client acquired connection from pool: __knexUid22 +0ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +8ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +8ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +0ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +0ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +3ms
  knex:client acquired connection from pool: __knexUid20 +2ms
  knex:query select * from `nc_models_v2` where `id` = ? limit ? undefined +3ms
  knex:bindings [ '3d5766d6-296f-419d-b0c6-e0f9fd2a7480', 1 ] undefined +3ms
  knex:client releasing connection to pool: __knexUid23 +2ms
  knex:client releasing connection to pool: __knexUid24 +0ms
  knex:client acquired connection from pool: __knexUid24 +1ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +2ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +2ms
  knex:client releasing connection to pool: __knexUid28 +1ms
  knex:client releasing connection to pool: __knexUid27 +2ms
  knex:client releasing connection to pool: __knexUid26 +0ms
  knex:client releasing connection to pool: __knexUid21 +1ms
  knex:client releasing connection to pool: __knexUid22 +0ms
  knex:client releasing connection to pool: __knexUid19 +0ms
  knex:client acquired connection from pool: __knexUid18 +2ms
  knex:query (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_category`.`film_id` as `film_film_id` from `film` inner join `film_category` on `film_category`.`category_id` = `film`.`film_id` where `film_category`.`film_id` = ?) undefined +8ms
  knex:bindings [
  knex:bindings   1, 2, 3, 4,  5,
  knex:bindings   6, 7, 8, 9, 10
  knex:bindings ] undefined +10ms
  knex:client releasing connection to pool: __knexUid24 +5ms
  knex:client acquired connection from pool: __knexUid24 +19ms
  knex:client acquired connection from pool: __knexUid19 +0ms
  knex:client acquired connection from pool: __knexUid22 +0ms
  knex:client acquired connection from pool: __knexUid21 +0ms
  knex:client acquired connection from pool: __knexUid26 +1ms
  knex:client acquired connection from pool: __knexUid27 +0ms
  knex:client acquired connection from pool: __knexUid28 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +23ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +21ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +27ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +28ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +0ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +0ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +11ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +12ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid20 +51ms
  knex:client acquired connection from pool: __knexUid20 +1ms
  knex:query select * from `nc_columns_v2` where `base_id` = ? and `base_id` = ? and `fk_model_id` = ? undefined +11ms
  knex:bindings [ 'civil_pony_0uaa', 'db', '3d5766d6-296f-419d-b0c6-e0f9fd2a7480' ] undefined +11ms
  knex:client releasing connection to pool: __knexUid24 +2ms
  knex:client releasing connection to pool: __knexUid20 +0ms
  knex:client acquired connection from pool: __knexUid20 +7ms
  knex:client acquired connection from pool: __knexUid24 +0ms
  knex:client acquired connection from pool: __knexUid23 +0ms
  knex:client acquired connection from pool: __knexUid25 +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +9ms
  knex:bindings [ '19d37522-45d8-4fe1-8f53-c73554f203bb', 1 ] undefined +9ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ '5b2f6ec4-3fb3-41cf-b579-a41d967f75c6', 1 ] undefined +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? undefined +0ms
  knex:bindings [ '5d179126-d2db-4054-ab1a-04538743ae53' ] undefined +0ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +5ms
  knex:bindings [ '62926ef8-893f-4e4a-9afc-08d837b69e3a', 1 ] undefined +5ms
  knex:client releasing connection to pool: __knexUid18 +9ms
  knex:client releasing connection to pool: __knexUid19 +24ms
  knex:client acquired connection from pool: __knexUid19 +1ms
  knex:query select * from `nc_col_select_options_v2` where `fk_column_id` = ? limit ? undefined +28ms
  knex:bindings [ 'b3dba5bf-0ef7-4ce1-aa78-dd8418f1adc6', 1 ] undefined +28ms
  knex:client releasing connection to pool: __knexUid22 +0ms
  knex:client acquired connection from pool: __knexUid22 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +1ms
  knex:bindings [ 'cab81fbb-4cfa-4a46-801d-ee2508e84bf1', 1 ] undefined +1ms
  knex:client releasing connection to pool: __knexUid21 +0ms
  knex:client acquired connection from pool: __knexUid21 +1ms
  knex:query select * from `nc_col_relations_v2` where `fk_column_id` = ? limit ? undefined +3ms
  knex:bindings [ 'e5da5b88-b280-4b67-b302-d44756c4d470', 1 ] undefined +3
  
  
  
  
  ms
  knex:client releasing connection to pool: __knexUid26 +3ms
  knex:client releasing connection to pool: __knexUid27 +0ms
  knex:client releasing connection to pool: __knexUid28 +0ms
  knex:client acquired connection from pool: __knexUid18 +2ms
  knex:query (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `inventory`.`film_id` as `film_film_id` from `film` inner join `inventory` on `inventory`.`store_id` = `film`.`film_id` where `inventory`.`film_id` = ?) undefined +4ms
  knex:bindings [
  knex:bindings   1, 2, 3, 4,  5,
  knex:bindings   6, 7, 8, 9, 10
  knex:bindings ] undefined +7ms
  knex:client releasing connection to pool: __knexUid24 +9ms
  knex:client releasing connection to pool: __knexUid20 +0ms
  knex:client releasing connection to pool: __knexUid19 +1ms
  knex:client releasing connection to pool: __knexUid22 +0ms
  knex:client releasing connection to pool: __knexUid21 +0ms
  knex:client releasing connection to pool: __knexUid23 +0ms
  knex:client releasing connection to pool: __knexUid25 +1ms
  knex:client releasing connection to pool: __knexUid18 +2ms
  knex:client acquired connection from pool: __knexUid18 +1ms
  knex:query (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) union (select `film`.`rental_duration` as `RentalDuration`, `film`.`release_year` as `ReleaseYear`, `film`.`length` as `Length`, `film`.`title` as `Title`, `film`.`special_features` as `SpecialFeatures`, `film`.`language_id` as `LanguageId`, `film`.`last_update` as `LastUpdate`, `film`.`replacement_cost` as `ReplacementCost`, `film`.`rating` as `Rating`, `film`.`description` as `Description`, `film`.`film_id` as `FilmId`, `film`.`rental_rate` as `RentalRate`, `film`.`original_language_id` as `OriginalLanguageId`, `film_actor`.`film_id` as `film_film_id` from `film` inner join `film_actor` on `film_actor`.`actor_id` = `film`.`film_id` where `film_actor`.`film_id` = ?) undefined +14ms
  knex:bindings [
  knex:bindings   1, 2, 3, 4,  5,
  knex:bindings   6, 7, 8, 9, 10
  knex:bindings ] undefined +40ms
  knex:client releasing connection to pool: __knexUid18 +38ms
GET /nc/civil_pony_0uaa/api/v2/film 200 41139 - 584.371 ms
```


# Lookup creation

- Add a row to lookup
- Update model cache






# Type generatr

class Country{

constructor(data){
 
}


countryList() {

}

}





