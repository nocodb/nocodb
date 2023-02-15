-- MySQL dump 10.13  Distrib 8.0.27, for macos11 (arm64)
--
-- Host: 127.0.0.1    Database: meta_v2_2023_02_13
-- ------------------------------------------------------
-- Server version	8.0.29

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `nc_5bf7___Actor`
--

CREATE DATABASE IF NOT EXISTS `meta_v2_2023_02_13`;
USE `meta_v2_2023_02_13`;

DROP TABLE IF EXISTS `nc_5bf7___Actor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_5bf7___Actor` (
  `Name` text,
  `Notes` text,
  `Attachments` text,
  `Status` text,
  `ncRecordId` varchar(255) NOT NULL,
  `ncRecordHash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ncRecordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_5bf7___Actor`
--

LOCK TABLES `nc_5bf7___Actor` WRITE;
/*!40000 ALTER TABLE `nc_5bf7___Actor` DISABLE KEYS */;
INSERT INTO `nc_5bf7___Actor` VALUES ('Actor3','Actor notes 3',NULL,'Done','rec0gLVoEhrmMsFmJ','1c6cd7d71560ca56d313fc64fdeb63f48dcd60ed'),('Actor1','Actor notes 1',NULL,'Todo','rec0GOZWXOGLLiykQ','157fdd78eb3cab906037995be989192e44644cfe'),('Actor1','Actor notes 1',NULL,'Todo','rec0olgwsDVG0JQce','ef914cc304aadb4f9b8a80430319fda9d64c9fc3'),('Actor1','Actor notes 1',NULL,'Todo','rec0Xt82WHYpvqsuR','2251da116513f23881db59025e0f28895504f2ca'),('Actor2','Actor notes 2',NULL,'In progress','rec1KEzm7pAgP9gAR','2301b3c68e129c1e2885ec7eeb7e73b7a600baf1'),('Actor2','Actor notes 2',NULL,'In progress','rec1Z5OM0jsTiNCBK','9dbfea95a086eb3f787d407f8f9dd2d602d81150'),('Actor2','Actor notes 2',NULL,'In progress','rec2a5vv4j8HPlvl3','64462d61e6451308ba9a058d6ebe5c4cb9b950f6'),('Actor2','Actor notes 2',NULL,'In progress','rec2K7kxGyA22OEXL','09d69e4698edda03345293c45c24078bce03cf1f'),('Actor3','Actor notes 3',NULL,'Done','rec2X7PHIMsRui1Fm','b89d7b11eb9519aa68c2e554248f807b75e603ee'),('Actor2','Actor notes 2',NULL,'In progress','rec337y4i19Bc2OSI','53b63e349d7768e3933f6bef4da4441942f54719'),('Actor3','Actor notes 3',NULL,'Done','rec3eOtvgq1M77Sbz','2d9ca7943a40d187aad22c88c59b93ca4355b5e5'),('Actor1','Actor notes 1',NULL,'Todo','rec3lQEaUEiKZqtz4','64d13b146142a47a46e98590d4a21e08d285a90b'),('Actor1','Actor notes 1',NULL,'Todo','rec45vliR6AiDaVmw','94b52296a72d28d5102aa5a4ce414a5341721a3e'),('Actor3','Actor notes 3',NULL,'Done','rec4a53AKAmizcW7P','46cf9f1e78e920e47ca0cb89682591934c062041'),('Actor3','Actor notes 3',NULL,'Done','rec4DltqnPkMhnosC','d066544922a1cf8cfff296e2018e40b7d165c750'),('Actor2','Actor notes 2',NULL,'In progress','rec4foBIt3wPdGr3x','1f5c441f1ab7c230d9d6845cd29dde95b44f4535'),('Actor1','Actor notes 1',NULL,'Todo','rec4Re52CZJfbtBlF','e7c557fb0564180d2747e5c166bad485ef269393'),('Actor1','Actor notes 1',NULL,'Todo','rec4SCNu8JR2hgtho','5351e669d223bc6b9aa2511938cdf64655913998'),('Actor3','Actor notes 3',NULL,'Done','rec5AeGw9g2Zcc1Dp','e8d5e5f8d0ba73f892973884ada616eb1f3e8b73'),('Actor2','Actor notes 2',NULL,'In progress','rec5QcDQfZp8Sz1jm','9136e2a84d09b7e344332be1f094ef11dcf6674c'),('Actor3','Actor notes 3',NULL,'Done','rec5qYEMRbcpJGft8','9d6e636efffd91faf277a4703609cd47c7d26d31'),('Actor2','Actor notes 2',NULL,'In progress','rec6aChhNw7tancKN','1c2bdf4d8f111bab86f357fbeca4bc8d2c72a442'),('Actor1','Actor notes 1',NULL,'Todo','rec6RrmaUXupCy9mc','970925f77f301b1439ac74cc75b4a1b5b067bf75'),('Actor1','Actor notes 1',NULL,'Todo','rec86NVuZaUA8tLHm','3c52a6afc6452f3fda991ab3417c82c3e64a430d'),('Actor2','Actor notes 2',NULL,'In progress','rec8Aol4XCyUzbYm4','ed3871c62dba258a25e2f24d45e97bdd34296730'),('Actor2','Actor notes 2',NULL,'In progress','rec8spbeeptRkTwI2','dfa5e37fe80b8ea82eaf725416ccc40caa054841'),('Actor3','Actor notes 3',NULL,'Done','rec8YiSwi0df0VGWX','69df15d6b65d6ec678275a98e281aee3be2a1367'),('Actor1','Actor notes 1',NULL,'Todo','rec9igOVcmimT3Y9L','371f70ac0628f900993cba647a5818f604e9b2e9'),('Actor3','Actor notes 3',NULL,'Done','rec9kclXgbyrj9NO9','abc9bdb501b15ac9f61c46ff3cc4819fcf317994'),('Actor2','Actor notes 2',NULL,'In progress','recAFnq5rEHIHXbMm','411aa1a1a52b3769f0b19f55a087da0b0e8a0dec'),('Actor2','Actor notes 2',NULL,'In progress','recaGHGpGVuAs9WyH','dbeda9f1dd525018715f7a691ce6c46bb132fedc'),('Actor1','Actor notes 1',NULL,'Todo','recAkkzpObSp0nBl6','9c5fa4a199c05cfa42ef8e1a12588bd79132a9ee'),('Actor3','Actor notes 3',NULL,'Done','recamda0g39Z1wSl2','da19558135eafbee792d3d19329d3c5b5ebda9d5'),('Actor2','Actor notes 2',NULL,'In progress','recAnNQ8UN0KLwYCq','0abace8f2579d27f1c774506a2b1e7fe2e24de8a'),('Actor1','Actor notes 1',NULL,'Todo','recb3GCenF2uOL4hq','b87b9fbbad2ce05919a80977a9b9a3ef73dbfb4f'),('Actor1','Actor notes 1',NULL,'Todo','recb7hRShr26MYsV3','251bf1684c17c047f05ffe7c55ad726065aa3c3d'),('Actor1','Actor notes 1',NULL,'Todo','recb9LQnoNwZR1lJN','a415b176b1a1e0c5ab1564b61550033e6f22ed35'),('Actor3','Actor notes 3',NULL,'Done','recbprSmTSBa5TCsh','eb33a9051b68b6549e511add803456ad74883351'),('Actor2','Actor notes 2',NULL,'In progress','recbWNyIOvqryshGl','238e06ba587bf6735da87e6c11f5808024723f66'),('Actor3','Actor notes 3',NULL,'Done','recBzO7ZWYO2qjS8w','c2e1474dfd5e5e9a7d9c3817399fd92d5b45d9ec'),('Actor2','Actor notes 2',NULL,'In progress','recc3Qtmjv3qUmqXX','fe7b56a4c3cf94098be67aa65ba9a62d2210dbe8'),('Actor3','Actor notes 3',NULL,'Done','recc5FllnrmN08sgx','21245e5921443ad83ef46b6a035877c2e4e4c408'),('Actor2','Actor notes 2',NULL,'In progress','recC8CayGDDjMZpEd','2abc4af0f78efd6d2e1e222f8df91902cf41087f'),('Actor3','Actor notes 3',NULL,'Done','recCjRYEkCma75s0v','058aaeb1f95bb376cbb2d5ae26e41aac10f91559'),('Actor3','Actor notes 3',NULL,'Done','reccnKJZ8YDG2i4Gd','40c412596ce12062395cfcd91710a21ef633449e'),('Actor2','Actor notes 2',NULL,'In progress','recCRLjpSO3ddMXiL','614e9ec4a9adf46f734f6fd2697b29da9661fdff'),('Actor2','Actor notes 2',NULL,'In progress','recCtFNiJbVgfGsHT','17a413895737da44952bbea7a0e1644cc62308dd'),('Actor2','Actor notes 2',NULL,'In progress','recd5rwGHkJh5rntn','d23eefb1bbadd623ad06348b647f55a6d35aad2f'),('Actor1','Actor notes 1',NULL,'Todo','recD6a4sCqt8TiR8Q','0b1b21e672a2d7f778d11bc95a4a97d861ac7804'),('Actor1','Actor notes 1',NULL,'Todo','recDaofOTvuRvI1pr','f6e2c3873c5d449141c8e3aa8743d864eed75081'),('Actor1','Actor notes 1',NULL,'Todo','recdC6OoGlEPbJ3h8','1116dd7c1aa04e8517c0eae6a630f33622fa6b3c'),('Actor2','Actor notes 2',NULL,'In progress','recDF2KCpnNeChhlk','7d2d95b99a392dcf1a663047ae32f8eabeb34575'),('Actor3','Actor notes 3',NULL,'Done','recdKb5n4le8cioD3','34c8f4fd2ff92578e7f4e5a314d72ac16f85c419'),('Actor3','Actor notes 3',NULL,'Done','recDQFTzHLfuXKiaL','c1ea503f9691beee02e3abeb6535f6ba08f4a1c1'),('Actor2','Actor notes 2',NULL,'In progress','recdRTwLsPHuKwWsT','2a14ed091b9262597ef97d52d40d2d6eca940a58'),('Actor3','Actor notes 3',NULL,'Done','receO8urhOYPs1NI2','af649354ec47c11b11100da0ff295585140f4d90'),('Actor1','Actor notes 1',NULL,'Todo','recEOhFGsGeZGosYQ','31fc8327725cb0746d36f0f8c0911fd4ae4dcef9'),('Actor3','Actor notes 3',NULL,'Done','recf1y4xCsFC3te37','4a6d446405c452cbf7900414f18da95f80c07b29'),('Actor1','Actor notes 1',NULL,'Todo','recf2JH4or0jl7B5c','28108c0109cdaf0e09603fd941b95170f0445be6'),('Actor3','Actor notes 3',NULL,'Done','recf4U7FlIvyl8Opg','9aaa42fddc13df63e397bdfdb99bad97e629f7a5'),('Actor3','Actor notes 3',NULL,'Done','recfCaaaYQgmOD0O5','59ae1ed22f9c71e2d36550ad58ca6552d57aebbf'),('Actor2','Actor notes 2',NULL,'In progress','recfEdPY3TzUUkLTD','65338a1dec83ce4d0cab41193e39098315fd0cac'),('Actor3','Actor notes 3',NULL,'Done','recfEeOlkOZHw7sYd','aa2a86dc69ade093810bb61d72d271196dff8039'),('Actor2','Actor notes 2',NULL,'In progress','recfgN5PY80xWoQWv','5c36e4a486a2c0f76f0ecc9946a0955a1b1881c3'),('Actor1','Actor notes 1',NULL,'Todo','recFmTKVp4rz4nOBD','c89d3042f66dc6d7b04cb21e936f69ccbf92d016'),('Actor1','Actor notes 1',NULL,'Todo','recFT3n4ePuL8uYot','cd0474bb6e9866906b5aa4b633729aba2ad8fbbe'),('Actor3','Actor notes 3',NULL,'Done','recfTYe9r3080Wl8o','014892cd4dca124ba482c01155c376b6abedb2b1'),('Actor1','Actor notes 1',NULL,'Todo','recfy4MJmjF1En3ni','186ae5505dba4199f42f8f849ebcf1f4da07823c'),('Actor2','Actor notes 2',NULL,'In progress','recfYrDQdv9JnlNrO','2c975afa1693b1565df22efa6a507059c9ef8af7'),('Actor2','Actor notes 2',NULL,'In progress','recfySCJJBA4X3DFk','2e1a358724c0af947f5007bd1bce6540604ec6e4'),('Actor2','Actor notes 2',NULL,'In progress','recGcbwKYAwciQM4C','a4c7d906bbf3759168fb352f6b0c7b7f44be8587'),('Actor2','Actor notes 2',NULL,'In progress','recgjCe9RbaymMdiN','8ebc7abf59496421439fea012cfddfe7a6d38fbe'),('Actor2','Actor notes 2',NULL,'In progress','recGk76vMgL6fW3ea','3422ffda574dcbc2c68b2f07ef585be52483841f'),('Actor2','Actor notes 2',NULL,'In progress','recgp3aTnqZk9PK4P','4bfa9919d0b7afb34fe41dce6a75072905bc5751'),('Actor3','Actor notes 3',NULL,'Done','recGqPjCMniPFLkZN','3adac39c2c6198efe5132ec0df24c589d45736be'),('Actor3','Actor notes 3',NULL,'Done','recGRJClFb1GnVtzQ','7e8f1f1824c2f9a98d057d1f90d04b3ba5c54d28'),('Actor3','Actor notes 3',NULL,'Done','rech2KmCV6ukgAbBZ','7d62ce1cbb9297e1c4fc80b19b31b2178afcc0cb'),('Actor3','Actor notes 3',NULL,'Done','recH2PpevmlFJxLBx','21dff2317e40d2f07fa9ea447560d4163226edb6'),('Actor3','Actor notes 3',NULL,'Done','recH7aAzL1ptbPi1o','1b5f9b245f977877c616298374b634a5db21e8c7'),('Actor1','Actor notes 1',NULL,'Todo','rechCRF0dRijW1KwV','d245f91f3292dba35bc8217717a097ef5df334e2'),('Actor1','Actor notes 1',NULL,'Todo','recHF6ZtxyTKFZIf9','70b88b22db58d883952b2027e1e17b4980976d9b'),('Actor1','Actor notes 1',NULL,'Todo','recHhMtpN2wfSEMHw','e6395f4291b23b6c84bfa0a9c576001b930c0c30'),('Actor3','Actor notes 3',NULL,'Done','recHJy6mtOWBvAtuh','1d1358c253d869186f06ec6e8f4515ed936c365e'),('Actor3','Actor notes 3',NULL,'Done','recHk0bvsd5kRw0y6','2142afa4b1c4268844fcec8695b0b62d85283b09'),('Actor2','Actor notes 2',NULL,'In progress','rechLRwOdYouGu0Ev','9e031e654f17709aa41fe376c2ab90192ccaa6e8'),('Actor2','Actor notes 2',NULL,'In progress','recHnYMoL8U1HrQyY','64bd6321b9ef779696521482e2415b54427274d3'),('Actor2','Actor notes 2',NULL,'In progress','rechydeoKFxr1a4XP','d341730891e4d890a9073313924cb75fcbe8c331'),('Actor2','Actor notes 2',NULL,'In progress','recIhywTbygbQQgbN','f9ec41981f77d4053f992e223b76b5af7eccc927'),('Actor1','Actor notes 1',NULL,'Todo','recIJF4xTafBDQnjc','1eeb5b1cc5ecc320dcc34b681c49b72109da826b'),('Actor2','Actor notes 2',NULL,'In progress','recIozhMGB6WwBdmx','f8b3d68a3939aadbb8115fe486891e515d29bf12'),('Actor1','Actor notes 1',NULL,'Todo','recirWAgCAgRaJRqY','bdcb899f06ab681deaa0ccbc93e1f952fa85f678'),('Actor1','Actor notes 1',NULL,'Todo','recItcezxgQNENw8x','42c7530ff07039430ac92b7ce15740a740eb72ac'),('Actor3','Actor notes 3',NULL,'Done','recJ9NZnOI6KkyU34','ca16cca976f790288520b047f65dddd4b669adaa'),('Actor2','Actor notes 2',NULL,'In progress','recJfrPbGmoUgFXaP','fb8cfea03ef5dba421696cafc22fae93d1075d2e'),('Actor3','Actor notes 3',NULL,'Done','recjghoZaMwGX9Rzi','93bc2bf240d39d0281ee5f467be36109c62a7e5a'),('Actor1','Actor notes 1',NULL,'Todo','recJMGnuXpWaUqDW1','6799f09fb3cb2708d7f684b481b0c5dc6ea645dd'),('Actor2','Actor notes 2',NULL,'In progress','recjQxQwPvMtcHXYm','5e671e856f6c4ea77993f6c6c4c9904774ece8fb'),('Actor1','Actor notes 1',NULL,'Todo','reck9Z2W74Jve8aZJ','5587d944e3b947c01fa77b5e2323c0159ec18029'),('Actor2','Actor notes 2',NULL,'In progress','recKFbGbAWHmNggbY','6b3310b8486aeb91eeea3514cc06dfff113d0f6b'),('Actor2','Actor notes 2',NULL,'In progress','reckqzyxcJAvKQNzQ','eeeedc94f708a9d4c04ac9fa7bcb565e0da4eff8'),('Actor1','Actor notes 1',NULL,'Todo','reclFv9CTC3uPyajU','4da96812b225b21760e5aadcc40d697e4a5d7f3b'),('Actor2','Actor notes 2',NULL,'In progress','reclN3ip7cNP8djR5','8751213cec9a614d7f8687f9ffeddd95f62bcf73'),('Actor1','Actor notes 1',NULL,'Todo','reclOUmBuUI2qlsjk','8674c2c4f615d91a28f0ed9c88176de72b645097'),('Actor2','Actor notes 2',NULL,'In progress','recLRD8BHPV8hIxWe','a6f9d53f8635d434f2b37f9facd38fdaef805e9f'),('Actor2','Actor notes 2',NULL,'In progress','recLSReM55Y1toCWG','3d5dbf6223b4da23f87461bfa27f185d476a6cc0'),('Actor3','Actor notes 3',NULL,'Done','reclvhYSr2Q0KDjGe','bca87455ac7ea4ea0fba56cbdaf90a0a5244baed'),('Actor3','Actor notes 3',NULL,'Done','recLvMNasOG29wfpF','dd53336fdd0ce8b24c600cc5e62818c1d4e445b6'),('Actor3','Actor notes 3',NULL,'Done','reclY7bVVoqDZSrYS','ea3a75030050fc1beb07a99ef1f4ff1874208f06'),('Actor1','Actor notes 1',NULL,'Todo','recm0dvwScejYal3g','3700964b8895cc83767da5e6945713bb5e5ed770'),('Actor1','Actor notes 1',NULL,'Todo','recm9ASi6H2s3gv3y','0539313ccc9c5dc727da2a45f2a489fcbf0bea85'),('Actor3','Actor notes 3',NULL,'Done','recMayLuH1MTgTR72','226ecf10adf511b8df2aeb58d73de29f2fc27ac1'),('Actor3','Actor notes 3',NULL,'Done','recMht7cKMbPR6ech','5534c3f9ea25920b1843acb2f5e55f39578bc497'),('Actor2','Actor notes 2',NULL,'In progress','recmnwDF4EDDrMVDX','b8d5615efc9b746a114c8be6a0512324da7b4a94'),('Actor3','Actor notes 3',NULL,'Done','recmsEciB1t7NVSee','dee313a3abd5b594575b7cdb5adc91a6289e9d41'),('Actor1','Actor notes 1',NULL,'Todo','recMUaqN1gmCKlp7b','4c03906bfd8179d0301fe9a7f36ce4928afb8819'),('Actor2','Actor notes 2',NULL,'In progress','recN9q2iKnlPAd6WO','a49a3889c7addb3dda82972430b76a347c786f4a'),('Actor3','Actor notes 3',NULL,'Done','recnaVAH8l49Uiy5C','5ff6f37f375578b55c16a24aaf297434bf4db2e3'),('Actor3','Actor notes 3',NULL,'Done','recNftEXzsGkCvNDs','a932087ce15dcd7bcbba7c7fc8e330bc1dcc6208'),('Actor1','Actor notes 1',NULL,'Todo','recnhw2lM7tzaHAsF','07ed07d46e46a5273ec09c310bff97a23ebaf24b'),('Actor1','Actor notes 1',NULL,'Todo','recNk2Yp3vM8AgHI5','4437f070ca73ac41f9dcd2a4bc4579f0ed0c7e42'),('Actor2','Actor notes 2',NULL,'In progress','recnQTMUTD7qFcX46','d847ad1278c1ac1c8cc032f20f9810a74d2ea7ac'),('Actor1','Actor notes 1',NULL,'Todo','recNRXqmiaezz5S0q','915117014fc3ba3662b1bbf67bd0a0a588ac0906'),('Actor1','Actor notes 1',NULL,'Todo','recnwttKkvqklJenW','6369665cb5db74e89bb0c6e945db3c0b10b0b32b'),('Actor2','Actor notes 2',NULL,'In progress','recNydhq15SM1Nc8n','f67b7b3b886f14d508898ab19599d6964c9aefa8'),('Actor1','Actor notes 1',NULL,'Todo','recOB7seRuOwLjp0g','593356f7ef59faef1d3ca7791a704fc9628811c9'),('Actor3','Actor notes 3',NULL,'Done','recOkdHYP4Lf7CejL','0db7cc66985ac69c00c01261fee7d99899a6966a'),('Actor2','Actor notes 2',NULL,'In progress','recoMBjRcJTxeg8QT','42b8c4f9d5cfe180b841f7f6c8d1222c2d84c3db'),('Actor1','Actor notes 1',NULL,'Todo','recOnazU5kf9OqQaR','63b9ace0a9bb804b9222eff4d825dc83d3f3b554'),('Actor1','Actor notes 1',NULL,'Todo','recOnZcfciELmGjx1','6ac747bf67f8f216d351acc5a491712f09f05eea'),('Actor3','Actor notes 3',NULL,'Done','recoOZi2F5RovSQtw','c59f2edd7b428f0648904cc0917067009d20a509'),('Actor2','Actor notes 2',NULL,'In progress','recOQ2D1sPlO1LC4t','a7c28edc09f4472a8ae14b6f6f1136c9a38e3405'),('Actor3','Actor notes 3',NULL,'Done','recoQ6GdO1CG0BaIf','120ede76221343ba6a4633757dd6d1b34be071cc'),('Actor2','Actor notes 2',NULL,'In progress','recOx2XKWOkAq2qPA','2fdaa13543a1f5a7d827ab680d6e4bea36732d78'),('Actor1','Actor notes 1',NULL,'Todo','recPMXTd653F1VemE','065f863ea3c941188cf710ab281ec2efd98da1dd'),('Actor3','Actor notes 3',NULL,'Done','recq08YiQkoqTW1U6','5936f51438cbb752d58c349e089aa99c34ab9e66'),('Actor3','Actor notes 3',NULL,'Done','recq4xHpuf56vXo19','683a080c29ad4a0fc2eacc8e908925d1d9f9669b'),('Actor3','Actor notes 3',NULL,'Done','recQRG9uvMJfbE9Iu','18a1c78f97532ea9f2030ca3f783f94096935716'),('Actor1','Actor notes 1',NULL,'Todo','recqUeem4vXy6EUaK','f3941b03041efe2a261e905a2533d1015f9d7fdd'),('Actor1','Actor notes 1',NULL,'Todo','recR3RO50q16Xe8yX','e23a3408882825e10b104780a9b37a0e7e1110f8'),('Actor3','Actor notes 3',NULL,'Done','recr7iBB0mAeMN9TQ','81cbcad0fe58974a7408adb4b41481b567e47609'),('Actor3','Actor notes 3',NULL,'Done','recRiEi9GEqaE1Us3','a45693d88d1fef0d4655f6f7b4dc4d98ee795587'),('Actor1','Actor notes 1',NULL,'Todo','recROj25L2pDcrPd5','89a509a493fd5a8a7139906d75c8c61cc668a803'),('Actor3','Actor notes 3',NULL,'Done','recrUCRhEjHmLSMut','499583ba693f0866017887006340c9ae61bf8863'),('Actor1','Actor notes 1',NULL,'Todo','recruKbdthW5YsNDf','07fba6ce70153cc6d5db510a6bbf5e268b4156d3'),('Actor3','Actor notes 3',NULL,'Done','recrWLwR1NbyRXHs7','b7476581ed7de16597b9c4a2ae692adea092239c'),('Actor2','Actor notes 2',NULL,'In progress','recsEpQxbmydcIIkR','751889c52be9ee1dbaa67e9a860071c806065ab0'),('Actor2','Actor notes 2',NULL,'In progress','recsJBFU28TmwaNCQ','55e3a87f26f0a6252a91dc42dada646facb11153'),('Actor1','Actor notes 1',NULL,'Todo','recSKn79mRptU7ICJ','48d020da315799fa32bdc53dc995c0edb3f89bad'),('Actor1','Actor notes 1',NULL,'Todo','recSLRsxNScBn5610','fa91e71a1f841c0fb925f5a76ae9e7a4eea47fbc'),('Actor1','Actor notes 1',NULL,'Todo','recsRMDjXsPBw60AZ','b8c571791eb5e90bbd19171ad94bed759bacf5ee'),('Actor3','Actor notes 3',NULL,'Done','rect0gTA4wDYn2BKH','ccffbb006c73bce076377c68c1a95789ff47e643'),('Actor1','Actor notes 1',NULL,'Todo','rect9kzlRMc12Mvi8','93392fd2df5764277bad939c73b2cfd4890fcb83'),('Actor2','Actor notes 2',NULL,'In progress','rectIdUq5aSUz6ZH0','c0a1a458a98fe1672f9611e11d686dbd24f9fa3a'),('Actor1','Actor notes 1',NULL,'Todo','recTmD65r9aLpUOqu','27d5d281e9b5b1aa58199af2a64eead774b4c1c1'),('Actor3','Actor notes 3',NULL,'Done','rectT25FhViZOypqX','e3bf7b1b96922a23a716b000de5107ffaa56c484'),('Actor3','Actor notes 3',NULL,'Done','recu3SBZzdX6YZCB6','ae43ea5f0308da87c1e2ef109498e71397f82c13'),('Actor2','Actor notes 2',NULL,'In progress','recUAamBRzAplmdB1','03766d648e6b03d12d4e5b5e254d433f904815e0'),('Actor3','Actor notes 3',NULL,'Done','recUmma3kPXHX0IIl','91cc96d1e89d9345e30437346bd7480906bbe195'),('Actor2','Actor notes 2',NULL,'In progress','recUVNIgnUw4ptKnZ','a098741c0f5708dcf1e289e32e985f1f3fe5ffbc'),('Actor3','Actor notes 3',NULL,'Done','recUxtjxYai7E1Zbp','bc4977c104b876e7803fc23adc362607263ce6c0'),('Actor3','Actor notes 3',NULL,'Done','recv0r2dGRYbhT63F','ead5b3617cda7e9d1a096931c396f3f2bcf38ce5'),('Actor2','Actor notes 2',NULL,'In progress','recv0sFzxriYXODWl','abac1cfcc0111bf576300b85f29d2fa76d657046'),('Actor1','Actor notes 1',NULL,'Todo','recVCh2XGcVi59SXV','308fe5aa1827b87b6fb79334b45a4013f6f69cea'),('Actor2','Actor notes 2',NULL,'In progress','recvkU85tMv1rCJQF','568386ee13be1558f98852c054be6cf5ad4f7cd2'),('Actor1','Actor notes 1',NULL,'Todo','recvmVSWTF1bsC9Xx','1dd51f8d2b4b34d1a98b9cc5c09591b22ea4614c'),('Actor2','Actor notes 2',NULL,'In progress','recVnZ9JJA0JOY8F9','e1ea4271bdad13fd3f9ceccfc5ea729a2c28c8a1'),('Actor3','Actor notes 3',NULL,'Done','recvSHqAI5lYUDfIS','aec5cba7fd2f973b00554010b895a3672d12e7f0'),('Actor1','Actor notes 1',NULL,'Todo','recVv1dc7Fs9F0sMB','3840da3d3a9da41c67542c0c2dec4f40ae3983ff'),('Actor3','Actor notes 3',NULL,'Done','recVVeJo2sohQQxoM','0472c0a1f181cbaf2510f13f08b832183f665975'),('Actor3','Actor notes 3',NULL,'Done','recVxrLCku2fQBoZm','3429f9fea52de2faae01a294d06b7880176d7214'),('Actor2','Actor notes 2',NULL,'In progress','recVZZeKqrddTn6Pe','b2fe5e61484081c08ed83639822e9c9c08eb748f'),('Actor2','Actor notes 2',NULL,'In progress','recWi2YTm7YMu4ThT','8568fbb5da92ff4e7e16ffe4249ebe7934d8b018'),('Actor1','Actor notes 1',NULL,'Todo','recwk9Nzp7ah6X7Kn','e51b8fd8259030c21d7ea43024cbc99c89e37f84'),('Actor3','Actor notes 3',NULL,'Done','recWpO9fxhfhmWpmS','e9c4de22334669f905180bc3180e574506134be3'),('Actor3','Actor notes 3',NULL,'Done','recWslJq7SdOT5lCG','2f5cc8593d2d00faef3fef8c7ed83a7c8cf59cbd'),('Actor2','Actor notes 2',NULL,'In progress','recWtyv4YElGJrKk2','661e20543226ba355d9159e88092bf0d18bf720a'),('Actor1','Actor notes 1',NULL,'Todo','recWusbxFCdIrmM6s','444ea2e4f5447973658d005dc7a605cb1a30edfd'),('Actor1','Actor notes 1',NULL,'Todo','recx03ffx0xTpIy46','a8bef944cffd45d30b2eadda06e146e93ae6e2f9'),('Actor1','Actor notes 1',NULL,'Todo','recxDWye6rkGb7mx5','f5ea429f006d455bf16227cc12e155d7aa7a7e80'),('Actor2','Actor notes 2',NULL,'In progress','recXGsSw4fEs3njLg','2fa74ef318d409b5972dc2808927b30f061e5912'),('Actor1','Actor notes 1',NULL,'Todo','recxPMNXTYYyvADzO','f7fe7f4d3c949f5ca52d0ef75db02fb2f956a3bd'),('Actor1','Actor notes 1',NULL,'Todo','recXyaklZivud9LCw','3190fa445581b1d3be88afe5fe864056a6c950d7'),('Actor1','Actor notes 1',NULL,'Todo','recYDCAnL8kc7Nykz','d4baa5e2fc617c7220a8fa070c8869b29ac17b47'),('Actor3','Actor notes 3',NULL,'Done','recYGt6tejUzU3Sgw','5846691bd77fafc0f1b9ee0bf4b35c992d3de196'),('Actor2','Actor notes 2',NULL,'In progress','recYKZYyHVWfGeH51','81af221c18a9249730bff3d74afac1f92a86c61d'),('Actor1','Actor notes 1',NULL,'Todo','recZ7PaS4sjeg2Yxf','49ba52df2fafe4dc04901dcd8bf4d19b4e50f963'),('Actor3','Actor notes 3',NULL,'Done','reczJ0qYK15MpjOT7','ba3c3700b03429332ab5fc14794fa4d13a4d41a8'),('Actor1','Actor notes 1',NULL,'Todo','reczJJ4AWGa5J2v8d','5a5cddb59da3a5befc41d7bfec93f34700814ba7'),('Actor2','Actor notes 2',NULL,'In progress','reczn8vfg579HZ2yi','e68964689fd06361a9144b038af2ddb7c95f0c21'),('Actor3','Actor notes 3',NULL,'Done','reczo05lSAgw0Ox4o','b527000da9a9b3e096cee6658f2f6ec9a6ecc73e'),('Actor2','Actor notes 2',NULL,'In progress','reczv5NMjux3yZmFB','2c5b048b806f3b0e0db00e31bdda91212ddf8ee4'),('Actor2','Actor notes 2',NULL,'In progress','reczyMVGQs0YIw6lw','a43448c855ccac1af1469a25d3bb3620edd3fcb8');
/*!40000 ALTER TABLE `nc_5bf7___Actor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_5bf7___Film`
--

DROP TABLE IF EXISTS `nc_5bf7___Film`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_5bf7___Film` (
  `Name` text,
  `Notes` text,
  `Attachments` text,
  `Status` text,
  `Done` tinyint(1) DEFAULT NULL,
  `Tags` text,
  `Date` varchar(255) DEFAULT NULL,
  `Phone` varchar(255) DEFAULT NULL,
  `Email` text,
  `URL` text,
  `Number` double(22,2) DEFAULT NULL,
  `Value` decimal(10,2) DEFAULT NULL,
  `Percent` double(22,2) DEFAULT NULL,
  `Duration` decimal(10,2) DEFAULT NULL,
  `Rating` int DEFAULT NULL,
  `ncRecordId` varchar(255) NOT NULL,
  `ncRecordHash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ncRecordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_5bf7___Film`
--

LOCK TABLES `nc_5bf7___Film` WRITE;
/*!40000 ALTER TABLE `nc_5bf7___Film` DISABLE KEYS */;
INSERT INTO `nc_5bf7___Film` VALUES ('Movie-3','Ugly',NULL,'Done',1,'Apr,May,Jun','2022-06-02','456456456','c@b.com','www.c.com',3.00,3.00,0.03,180.00,3,'rec0CvbxNpbj5GuRn','ec286700338246676305c91b1a1f84b939dbc3a3'),('Movie-2','Bad',NULL,'In progress',NULL,'Feb,Mar','2022-06-01','234234234','b@b.com','www.b.com',2.00,2.00,0.02,120.00,2,'recaIDk49KXAJej9D','af938b2567ce2764fbfd15bab3448dd853ac5f7b'),('Movie-1','Good',NULL,'Todo',1,'Jan','2022-05-31','123123123','a@b.com','www.a.com',1.00,1.00,0.01,60.00,1,'recyalS7o5nh2Ec76','e25f13e9f5dda36b4acb143c1fad819a8ece2bdd');
/*!40000 ALTER TABLE `nc_5bf7___Film` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_5bf7___Producer`
--

DROP TABLE IF EXISTS `nc_5bf7___Producer`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_5bf7___Producer` (
  `Name` text,
  `Notes` text,
  `Attachments` text,
  `Status` text,
  `ncRecordId` varchar(255) NOT NULL,
  `ncRecordHash` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`ncRecordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_5bf7___Producer`
--

LOCK TABLES `nc_5bf7___Producer` WRITE;
/*!40000 ALTER TABLE `nc_5bf7___Producer` DISABLE KEYS */;
INSERT INTO `nc_5bf7___Producer` VALUES ('P2','Notes of P2',NULL,'In progress','rec7CflqABElKe2iz','4ca4d1433b8dbefd90116a9fecd2cf28ef4facc5'),('P1','Notes of P1',NULL,'Todo','rectTeNHuBbaFBjAv','5c5e6ff7b14b2f9bf3d1bc45b79cc667833abc68'),('P3','Notes of P3',NULL,'Done','recxenRrH5sVUoV8M','a25e35eac6fb5b7be78f0601849119c6a4e3d463');
/*!40000 ALTER TABLE `nc_5bf7___Producer` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_5bf7___nc_m2m_grcpporlwy`
--

DROP TABLE IF EXISTS `nc_5bf7___nc_m2m_grcpporlwy`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_5bf7___nc_m2m_grcpporlwy` (
  `table2_id` varchar(255) NOT NULL,
  `table1_id` varchar(255) NOT NULL,
  PRIMARY KEY (`table2_id`,`table1_id`),
  KEY `nc_5bf7___nc_m2m_grcpporlwy_table1_id_foreign` (`table1_id`),
  CONSTRAINT `nc_5bf7___nc_m2m_grcpporlwy_table1_id_foreign` FOREIGN KEY (`table1_id`) REFERENCES `nc_5bf7___Film` (`ncRecordId`),
  CONSTRAINT `nc_5bf7___nc_m2m_grcpporlwy_table2_id_foreign` FOREIGN KEY (`table2_id`) REFERENCES `nc_5bf7___Actor` (`ncRecordId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_5bf7___nc_m2m_grcpporlwy`
--

LOCK TABLES `nc_5bf7___nc_m2m_grcpporlwy` WRITE;
/*!40000 ALTER TABLE `nc_5bf7___nc_m2m_grcpporlwy` DISABLE KEYS */;
INSERT INTO `nc_5bf7___nc_m2m_grcpporlwy` VALUES ('rec0gLVoEhrmMsFmJ','rec0CvbxNpbj5GuRn'),('rec0GOZWXOGLLiykQ','rec0CvbxNpbj5GuRn'),('rec0olgwsDVG0JQce','rec0CvbxNpbj5GuRn'),('rec0Xt82WHYpvqsuR','rec0CvbxNpbj5GuRn'),('rec2X7PHIMsRui1Fm','rec0CvbxNpbj5GuRn'),('rec3eOtvgq1M77Sbz','rec0CvbxNpbj5GuRn'),('rec3lQEaUEiKZqtz4','rec0CvbxNpbj5GuRn'),('rec45vliR6AiDaVmw','rec0CvbxNpbj5GuRn'),('rec4a53AKAmizcW7P','rec0CvbxNpbj5GuRn'),('rec4DltqnPkMhnosC','rec0CvbxNpbj5GuRn'),('rec4Re52CZJfbtBlF','rec0CvbxNpbj5GuRn'),('rec4SCNu8JR2hgtho','rec0CvbxNpbj5GuRn'),('rec5AeGw9g2Zcc1Dp','rec0CvbxNpbj5GuRn'),('rec5qYEMRbcpJGft8','rec0CvbxNpbj5GuRn'),('rec6RrmaUXupCy9mc','rec0CvbxNpbj5GuRn'),('rec86NVuZaUA8tLHm','rec0CvbxNpbj5GuRn'),('rec8YiSwi0df0VGWX','rec0CvbxNpbj5GuRn'),('rec9igOVcmimT3Y9L','rec0CvbxNpbj5GuRn'),('rec9kclXgbyrj9NO9','rec0CvbxNpbj5GuRn'),('recAkkzpObSp0nBl6','rec0CvbxNpbj5GuRn'),('recamda0g39Z1wSl2','rec0CvbxNpbj5GuRn'),('recb3GCenF2uOL4hq','rec0CvbxNpbj5GuRn'),('recb7hRShr26MYsV3','rec0CvbxNpbj5GuRn'),('recb9LQnoNwZR1lJN','rec0CvbxNpbj5GuRn'),('recbprSmTSBa5TCsh','rec0CvbxNpbj5GuRn'),('recBzO7ZWYO2qjS8w','rec0CvbxNpbj5GuRn'),('recc5FllnrmN08sgx','rec0CvbxNpbj5GuRn'),('recCjRYEkCma75s0v','rec0CvbxNpbj5GuRn'),('reccnKJZ8YDG2i4Gd','rec0CvbxNpbj5GuRn'),('recD6a4sCqt8TiR8Q','rec0CvbxNpbj5GuRn'),('recDaofOTvuRvI1pr','rec0CvbxNpbj5GuRn'),('recdC6OoGlEPbJ3h8','rec0CvbxNpbj5GuRn'),('recdKb5n4le8cioD3','rec0CvbxNpbj5GuRn'),('recDQFTzHLfuXKiaL','rec0CvbxNpbj5GuRn'),('receO8urhOYPs1NI2','rec0CvbxNpbj5GuRn'),('recEOhFGsGeZGosYQ','rec0CvbxNpbj5GuRn'),('recf1y4xCsFC3te37','rec0CvbxNpbj5GuRn'),('recf2JH4or0jl7B5c','rec0CvbxNpbj5GuRn'),('recf4U7FlIvyl8Opg','rec0CvbxNpbj5GuRn'),('recfCaaaYQgmOD0O5','rec0CvbxNpbj5GuRn'),('recfEeOlkOZHw7sYd','rec0CvbxNpbj5GuRn'),('recFmTKVp4rz4nOBD','rec0CvbxNpbj5GuRn'),('recFT3n4ePuL8uYot','rec0CvbxNpbj5GuRn'),('recfTYe9r3080Wl8o','rec0CvbxNpbj5GuRn'),('recfy4MJmjF1En3ni','rec0CvbxNpbj5GuRn'),('recGqPjCMniPFLkZN','rec0CvbxNpbj5GuRn'),('recGRJClFb1GnVtzQ','rec0CvbxNpbj5GuRn'),('rech2KmCV6ukgAbBZ','rec0CvbxNpbj5GuRn'),('recH2PpevmlFJxLBx','rec0CvbxNpbj5GuRn'),('recH7aAzL1ptbPi1o','rec0CvbxNpbj5GuRn'),('rechCRF0dRijW1KwV','rec0CvbxNpbj5GuRn'),('recHF6ZtxyTKFZIf9','rec0CvbxNpbj5GuRn'),('recHhMtpN2wfSEMHw','rec0CvbxNpbj5GuRn'),('recHJy6mtOWBvAtuh','rec0CvbxNpbj5GuRn'),('recHk0bvsd5kRw0y6','rec0CvbxNpbj5GuRn'),('recIJF4xTafBDQnjc','rec0CvbxNpbj5GuRn'),('recirWAgCAgRaJRqY','rec0CvbxNpbj5GuRn'),('recItcezxgQNENw8x','rec0CvbxNpbj5GuRn'),('recJ9NZnOI6KkyU34','rec0CvbxNpbj5GuRn'),('recjghoZaMwGX9Rzi','rec0CvbxNpbj5GuRn'),('recJMGnuXpWaUqDW1','rec0CvbxNpbj5GuRn'),('reck9Z2W74Jve8aZJ','rec0CvbxNpbj5GuRn'),('reclFv9CTC3uPyajU','rec0CvbxNpbj5GuRn'),('reclOUmBuUI2qlsjk','rec0CvbxNpbj5GuRn'),('reclvhYSr2Q0KDjGe','rec0CvbxNpbj5GuRn'),('recLvMNasOG29wfpF','rec0CvbxNpbj5GuRn'),('reclY7bVVoqDZSrYS','rec0CvbxNpbj5GuRn'),('recm0dvwScejYal3g','rec0CvbxNpbj5GuRn'),('recm9ASi6H2s3gv3y','rec0CvbxNpbj5GuRn'),('recMayLuH1MTgTR72','rec0CvbxNpbj5GuRn'),('recMht7cKMbPR6ech','rec0CvbxNpbj5GuRn'),('recmsEciB1t7NVSee','rec0CvbxNpbj5GuRn'),('recMUaqN1gmCKlp7b','rec0CvbxNpbj5GuRn'),('recnaVAH8l49Uiy5C','rec0CvbxNpbj5GuRn'),('recNftEXzsGkCvNDs','rec0CvbxNpbj5GuRn'),('recnhw2lM7tzaHAsF','rec0CvbxNpbj5GuRn'),('recNk2Yp3vM8AgHI5','rec0CvbxNpbj5GuRn'),('recNRXqmiaezz5S0q','rec0CvbxNpbj5GuRn'),('recnwttKkvqklJenW','rec0CvbxNpbj5GuRn'),('recOB7seRuOwLjp0g','rec0CvbxNpbj5GuRn'),('recOkdHYP4Lf7CejL','rec0CvbxNpbj5GuRn'),('recOnazU5kf9OqQaR','rec0CvbxNpbj5GuRn'),('recOnZcfciELmGjx1','rec0CvbxNpbj5GuRn'),('recoOZi2F5RovSQtw','rec0CvbxNpbj5GuRn'),('recoQ6GdO1CG0BaIf','rec0CvbxNpbj5GuRn'),('recPMXTd653F1VemE','rec0CvbxNpbj5GuRn'),('recq08YiQkoqTW1U6','rec0CvbxNpbj5GuRn'),('recq4xHpuf56vXo19','rec0CvbxNpbj5GuRn'),('recQRG9uvMJfbE9Iu','rec0CvbxNpbj5GuRn'),('recqUeem4vXy6EUaK','rec0CvbxNpbj5GuRn'),('recR3RO50q16Xe8yX','rec0CvbxNpbj5GuRn'),('recr7iBB0mAeMN9TQ','rec0CvbxNpbj5GuRn'),('recRiEi9GEqaE1Us3','rec0CvbxNpbj5GuRn'),('recROj25L2pDcrPd5','rec0CvbxNpbj5GuRn'),('recrUCRhEjHmLSMut','rec0CvbxNpbj5GuRn'),('recruKbdthW5YsNDf','rec0CvbxNpbj5GuRn'),('recrWLwR1NbyRXHs7','rec0CvbxNpbj5GuRn'),('recSKn79mRptU7ICJ','rec0CvbxNpbj5GuRn'),('recSLRsxNScBn5610','rec0CvbxNpbj5GuRn'),('recsRMDjXsPBw60AZ','rec0CvbxNpbj5GuRn'),('rect0gTA4wDYn2BKH','rec0CvbxNpbj5GuRn'),('rect9kzlRMc12Mvi8','rec0CvbxNpbj5GuRn'),('recTmD65r9aLpUOqu','rec0CvbxNpbj5GuRn'),('rectT25FhViZOypqX','rec0CvbxNpbj5GuRn'),('recu3SBZzdX6YZCB6','rec0CvbxNpbj5GuRn'),('recUmma3kPXHX0IIl','rec0CvbxNpbj5GuRn'),('recUxtjxYai7E1Zbp','rec0CvbxNpbj5GuRn'),('recv0r2dGRYbhT63F','rec0CvbxNpbj5GuRn'),('recVCh2XGcVi59SXV','rec0CvbxNpbj5GuRn'),('recvmVSWTF1bsC9Xx','rec0CvbxNpbj5GuRn'),('recvSHqAI5lYUDfIS','rec0CvbxNpbj5GuRn'),('recVv1dc7Fs9F0sMB','rec0CvbxNpbj5GuRn'),('recVVeJo2sohQQxoM','rec0CvbxNpbj5GuRn'),('recVxrLCku2fQBoZm','rec0CvbxNpbj5GuRn'),('recwk9Nzp7ah6X7Kn','rec0CvbxNpbj5GuRn'),('recWpO9fxhfhmWpmS','rec0CvbxNpbj5GuRn'),('recWslJq7SdOT5lCG','rec0CvbxNpbj5GuRn'),('recWusbxFCdIrmM6s','rec0CvbxNpbj5GuRn'),('recx03ffx0xTpIy46','rec0CvbxNpbj5GuRn'),('recxDWye6rkGb7mx5','rec0CvbxNpbj5GuRn'),('recxPMNXTYYyvADzO','rec0CvbxNpbj5GuRn'),('recXyaklZivud9LCw','rec0CvbxNpbj5GuRn'),('recYDCAnL8kc7Nykz','rec0CvbxNpbj5GuRn'),('recYGt6tejUzU3Sgw','rec0CvbxNpbj5GuRn'),('recZ7PaS4sjeg2Yxf','rec0CvbxNpbj5GuRn'),('reczJ0qYK15MpjOT7','rec0CvbxNpbj5GuRn'),('reczJJ4AWGa5J2v8d','rec0CvbxNpbj5GuRn'),('reczo05lSAgw0Ox4o','rec0CvbxNpbj5GuRn'),('rec0gLVoEhrmMsFmJ','recaIDk49KXAJej9D'),('rec1KEzm7pAgP9gAR','recaIDk49KXAJej9D'),('rec1Z5OM0jsTiNCBK','recaIDk49KXAJej9D'),('rec2a5vv4j8HPlvl3','recaIDk49KXAJej9D'),('rec2K7kxGyA22OEXL','recaIDk49KXAJej9D'),('rec2X7PHIMsRui1Fm','recaIDk49KXAJej9D'),('rec337y4i19Bc2OSI','recaIDk49KXAJej9D'),('rec3eOtvgq1M77Sbz','recaIDk49KXAJej9D'),('rec4a53AKAmizcW7P','recaIDk49KXAJej9D'),('rec4DltqnPkMhnosC','recaIDk49KXAJej9D'),('rec4foBIt3wPdGr3x','recaIDk49KXAJej9D'),('rec5AeGw9g2Zcc1Dp','recaIDk49KXAJej9D'),('rec5QcDQfZp8Sz1jm','recaIDk49KXAJej9D'),('rec5qYEMRbcpJGft8','recaIDk49KXAJej9D'),('rec6aChhNw7tancKN','recaIDk49KXAJej9D'),('rec8Aol4XCyUzbYm4','recaIDk49KXAJej9D'),('rec8spbeeptRkTwI2','recaIDk49KXAJej9D'),('rec8YiSwi0df0VGWX','recaIDk49KXAJej9D'),('rec9kclXgbyrj9NO9','recaIDk49KXAJej9D'),('recAFnq5rEHIHXbMm','recaIDk49KXAJej9D'),('recaGHGpGVuAs9WyH','recaIDk49KXAJej9D'),('recamda0g39Z1wSl2','recaIDk49KXAJej9D'),('recAnNQ8UN0KLwYCq','recaIDk49KXAJej9D'),('recbprSmTSBa5TCsh','recaIDk49KXAJej9D'),('recbWNyIOvqryshGl','recaIDk49KXAJej9D'),('recBzO7ZWYO2qjS8w','recaIDk49KXAJej9D'),('recc3Qtmjv3qUmqXX','recaIDk49KXAJej9D'),('recc5FllnrmN08sgx','recaIDk49KXAJej9D'),('recC8CayGDDjMZpEd','recaIDk49KXAJej9D'),('recCjRYEkCma75s0v','recaIDk49KXAJej9D'),('reccnKJZ8YDG2i4Gd','recaIDk49KXAJej9D'),('recCRLjpSO3ddMXiL','recaIDk49KXAJej9D'),('recCtFNiJbVgfGsHT','recaIDk49KXAJej9D'),('recd5rwGHkJh5rntn','recaIDk49KXAJej9D'),('recDF2KCpnNeChhlk','recaIDk49KXAJej9D'),('recdKb5n4le8cioD3','recaIDk49KXAJej9D'),('recDQFTzHLfuXKiaL','recaIDk49KXAJej9D'),('recdRTwLsPHuKwWsT','recaIDk49KXAJej9D'),('receO8urhOYPs1NI2','recaIDk49KXAJej9D'),('recf1y4xCsFC3te37','recaIDk49KXAJej9D'),('recf4U7FlIvyl8Opg','recaIDk49KXAJej9D'),('recfCaaaYQgmOD0O5','recaIDk49KXAJej9D'),('recfEdPY3TzUUkLTD','recaIDk49KXAJej9D'),('recfEeOlkOZHw7sYd','recaIDk49KXAJej9D'),('recfgN5PY80xWoQWv','recaIDk49KXAJej9D'),('recfTYe9r3080Wl8o','recaIDk49KXAJej9D'),('recfYrDQdv9JnlNrO','recaIDk49KXAJej9D'),('recfySCJJBA4X3DFk','recaIDk49KXAJej9D'),('recGcbwKYAwciQM4C','recaIDk49KXAJej9D'),('recgjCe9RbaymMdiN','recaIDk49KXAJej9D'),('recGk76vMgL6fW3ea','recaIDk49KXAJej9D'),('recgp3aTnqZk9PK4P','recaIDk49KXAJej9D'),('recGqPjCMniPFLkZN','recaIDk49KXAJej9D'),('recGRJClFb1GnVtzQ','recaIDk49KXAJej9D'),('rech2KmCV6ukgAbBZ','recaIDk49KXAJej9D'),('recH2PpevmlFJxLBx','recaIDk49KXAJej9D'),('recH7aAzL1ptbPi1o','recaIDk49KXAJej9D'),('recHJy6mtOWBvAtuh','recaIDk49KXAJej9D'),('recHk0bvsd5kRw0y6','recaIDk49KXAJej9D'),('rechLRwOdYouGu0Ev','recaIDk49KXAJej9D'),('recHnYMoL8U1HrQyY','recaIDk49KXAJej9D'),('rechydeoKFxr1a4XP','recaIDk49KXAJej9D'),('recIhywTbygbQQgbN','recaIDk49KXAJej9D'),('recIozhMGB6WwBdmx','recaIDk49KXAJej9D'),('recJ9NZnOI6KkyU34','recaIDk49KXAJej9D'),('recJfrPbGmoUgFXaP','recaIDk49KXAJej9D'),('recjghoZaMwGX9Rzi','recaIDk49KXAJej9D'),('recjQxQwPvMtcHXYm','recaIDk49KXAJej9D'),('recKFbGbAWHmNggbY','recaIDk49KXAJej9D'),('reckqzyxcJAvKQNzQ','recaIDk49KXAJej9D'),('reclN3ip7cNP8djR5','recaIDk49KXAJej9D'),('recLRD8BHPV8hIxWe','recaIDk49KXAJej9D'),('recLSReM55Y1toCWG','recaIDk49KXAJej9D'),('reclvhYSr2Q0KDjGe','recaIDk49KXAJej9D'),('recLvMNasOG29wfpF','recaIDk49KXAJej9D'),('reclY7bVVoqDZSrYS','recaIDk49KXAJej9D'),('recMayLuH1MTgTR72','recaIDk49KXAJej9D'),('recMht7cKMbPR6ech','recaIDk49KXAJej9D'),('recmnwDF4EDDrMVDX','recaIDk49KXAJej9D'),('recmsEciB1t7NVSee','recaIDk49KXAJej9D'),('recN9q2iKnlPAd6WO','recaIDk49KXAJej9D'),('recnaVAH8l49Uiy5C','recaIDk49KXAJej9D'),('recNftEXzsGkCvNDs','recaIDk49KXAJej9D'),('recnQTMUTD7qFcX46','recaIDk49KXAJej9D'),('recNydhq15SM1Nc8n','recaIDk49KXAJej9D'),('recOkdHYP4Lf7CejL','recaIDk49KXAJej9D'),('recoMBjRcJTxeg8QT','recaIDk49KXAJej9D'),('recoOZi2F5RovSQtw','recaIDk49KXAJej9D'),('recOQ2D1sPlO1LC4t','recaIDk49KXAJej9D'),('recoQ6GdO1CG0BaIf','recaIDk49KXAJej9D'),('recOx2XKWOkAq2qPA','recaIDk49KXAJej9D'),('recq08YiQkoqTW1U6','recaIDk49KXAJej9D'),('recq4xHpuf56vXo19','recaIDk49KXAJej9D'),('recQRG9uvMJfbE9Iu','recaIDk49KXAJej9D'),('recr7iBB0mAeMN9TQ','recaIDk49KXAJej9D'),('recRiEi9GEqaE1Us3','recaIDk49KXAJej9D'),('recrUCRhEjHmLSMut','recaIDk49KXAJej9D'),('recrWLwR1NbyRXHs7','recaIDk49KXAJej9D'),('recsEpQxbmydcIIkR','recaIDk49KXAJej9D'),('recsJBFU28TmwaNCQ','recaIDk49KXAJej9D'),('rect0gTA4wDYn2BKH','recaIDk49KXAJej9D'),('rectIdUq5aSUz6ZH0','recaIDk49KXAJej9D'),('rectT25FhViZOypqX','recaIDk49KXAJej9D'),('recu3SBZzdX6YZCB6','recaIDk49KXAJej9D'),('recUAamBRzAplmdB1','recaIDk49KXAJej9D'),('recUmma3kPXHX0IIl','recaIDk49KXAJej9D'),('recUVNIgnUw4ptKnZ','recaIDk49KXAJej9D'),('recUxtjxYai7E1Zbp','recaIDk49KXAJej9D'),('recv0r2dGRYbhT63F','recaIDk49KXAJej9D'),('recv0sFzxriYXODWl','recaIDk49KXAJej9D'),('recvkU85tMv1rCJQF','recaIDk49KXAJej9D'),('recVnZ9JJA0JOY8F9','recaIDk49KXAJej9D'),('recvSHqAI5lYUDfIS','recaIDk49KXAJej9D'),('recVVeJo2sohQQxoM','recaIDk49KXAJej9D'),('recVxrLCku2fQBoZm','recaIDk49KXAJej9D'),('recVZZeKqrddTn6Pe','recaIDk49KXAJej9D'),('recWi2YTm7YMu4ThT','recaIDk49KXAJej9D'),('recWpO9fxhfhmWpmS','recaIDk49KXAJej9D'),('recWslJq7SdOT5lCG','recaIDk49KXAJej9D'),('recWtyv4YElGJrKk2','recaIDk49KXAJej9D'),('recXGsSw4fEs3njLg','recaIDk49KXAJej9D'),('recYGt6tejUzU3Sgw','recaIDk49KXAJej9D'),('recYKZYyHVWfGeH51','recaIDk49KXAJej9D'),('reczJ0qYK15MpjOT7','recaIDk49KXAJej9D'),('reczn8vfg579HZ2yi','recaIDk49KXAJej9D'),('reczo05lSAgw0Ox4o','recaIDk49KXAJej9D'),('reczv5NMjux3yZmFB','recaIDk49KXAJej9D'),('reczyMVGQs0YIw6lw','recaIDk49KXAJej9D'),('rec0GOZWXOGLLiykQ','recyalS7o5nh2Ec76'),('rec0olgwsDVG0JQce','recyalS7o5nh2Ec76'),('rec0Xt82WHYpvqsuR','recyalS7o5nh2Ec76'),('rec1KEzm7pAgP9gAR','recyalS7o5nh2Ec76'),('rec1Z5OM0jsTiNCBK','recyalS7o5nh2Ec76'),('rec2a5vv4j8HPlvl3','recyalS7o5nh2Ec76'),('rec2K7kxGyA22OEXL','recyalS7o5nh2Ec76'),('rec337y4i19Bc2OSI','recyalS7o5nh2Ec76'),('rec3lQEaUEiKZqtz4','recyalS7o5nh2Ec76'),('rec45vliR6AiDaVmw','recyalS7o5nh2Ec76'),('rec4foBIt3wPdGr3x','recyalS7o5nh2Ec76'),('rec4Re52CZJfbtBlF','recyalS7o5nh2Ec76'),('rec4SCNu8JR2hgtho','recyalS7o5nh2Ec76'),('rec5QcDQfZp8Sz1jm','recyalS7o5nh2Ec76'),('rec6aChhNw7tancKN','recyalS7o5nh2Ec76'),('rec6RrmaUXupCy9mc','recyalS7o5nh2Ec76'),('rec86NVuZaUA8tLHm','recyalS7o5nh2Ec76'),('rec8Aol4XCyUzbYm4','recyalS7o5nh2Ec76'),('rec8spbeeptRkTwI2','recyalS7o5nh2Ec76'),('rec9igOVcmimT3Y9L','recyalS7o5nh2Ec76'),('recAFnq5rEHIHXbMm','recyalS7o5nh2Ec76'),('recaGHGpGVuAs9WyH','recyalS7o5nh2Ec76'),('recAkkzpObSp0nBl6','recyalS7o5nh2Ec76'),('recAnNQ8UN0KLwYCq','recyalS7o5nh2Ec76'),('recb3GCenF2uOL4hq','recyalS7o5nh2Ec76'),('recb7hRShr26MYsV3','recyalS7o5nh2Ec76'),('recb9LQnoNwZR1lJN','recyalS7o5nh2Ec76'),('recbWNyIOvqryshGl','recyalS7o5nh2Ec76'),('recc3Qtmjv3qUmqXX','recyalS7o5nh2Ec76'),('recC8CayGDDjMZpEd','recyalS7o5nh2Ec76'),('recCRLjpSO3ddMXiL','recyalS7o5nh2Ec76'),('recCtFNiJbVgfGsHT','recyalS7o5nh2Ec76'),('recd5rwGHkJh5rntn','recyalS7o5nh2Ec76'),('recD6a4sCqt8TiR8Q','recyalS7o5nh2Ec76'),('recDaofOTvuRvI1pr','recyalS7o5nh2Ec76'),('recdC6OoGlEPbJ3h8','recyalS7o5nh2Ec76'),('recDF2KCpnNeChhlk','recyalS7o5nh2Ec76'),('recdRTwLsPHuKwWsT','recyalS7o5nh2Ec76'),('recEOhFGsGeZGosYQ','recyalS7o5nh2Ec76'),('recf2JH4or0jl7B5c','recyalS7o5nh2Ec76'),('recfEdPY3TzUUkLTD','recyalS7o5nh2Ec76'),('recfgN5PY80xWoQWv','recyalS7o5nh2Ec76'),('recFmTKVp4rz4nOBD','recyalS7o5nh2Ec76'),('recFT3n4ePuL8uYot','recyalS7o5nh2Ec76'),('recfy4MJmjF1En3ni','recyalS7o5nh2Ec76'),('recfYrDQdv9JnlNrO','recyalS7o5nh2Ec76'),('recfySCJJBA4X3DFk','recyalS7o5nh2Ec76'),('recGcbwKYAwciQM4C','recyalS7o5nh2Ec76'),('recgjCe9RbaymMdiN','recyalS7o5nh2Ec76'),('recGk76vMgL6fW3ea','recyalS7o5nh2Ec76'),('recgp3aTnqZk9PK4P','recyalS7o5nh2Ec76'),('rechCRF0dRijW1KwV','recyalS7o5nh2Ec76'),('recHF6ZtxyTKFZIf9','recyalS7o5nh2Ec76'),('recHhMtpN2wfSEMHw','recyalS7o5nh2Ec76'),('rechLRwOdYouGu0Ev','recyalS7o5nh2Ec76'),('recHnYMoL8U1HrQyY','recyalS7o5nh2Ec76'),('rechydeoKFxr1a4XP','recyalS7o5nh2Ec76'),('recIhywTbygbQQgbN','recyalS7o5nh2Ec76'),('recIJF4xTafBDQnjc','recyalS7o5nh2Ec76'),('recIozhMGB6WwBdmx','recyalS7o5nh2Ec76'),('recirWAgCAgRaJRqY','recyalS7o5nh2Ec76'),('recItcezxgQNENw8x','recyalS7o5nh2Ec76'),('recJfrPbGmoUgFXaP','recyalS7o5nh2Ec76'),('recJMGnuXpWaUqDW1','recyalS7o5nh2Ec76'),('recjQxQwPvMtcHXYm','recyalS7o5nh2Ec76'),('reck9Z2W74Jve8aZJ','recyalS7o5nh2Ec76'),('recKFbGbAWHmNggbY','recyalS7o5nh2Ec76'),('reckqzyxcJAvKQNzQ','recyalS7o5nh2Ec76'),('reclFv9CTC3uPyajU','recyalS7o5nh2Ec76'),('reclN3ip7cNP8djR5','recyalS7o5nh2Ec76'),('reclOUmBuUI2qlsjk','recyalS7o5nh2Ec76'),('recLRD8BHPV8hIxWe','recyalS7o5nh2Ec76'),('recLSReM55Y1toCWG','recyalS7o5nh2Ec76'),('recm0dvwScejYal3g','recyalS7o5nh2Ec76'),('recm9ASi6H2s3gv3y','recyalS7o5nh2Ec76'),('recmnwDF4EDDrMVDX','recyalS7o5nh2Ec76'),('recMUaqN1gmCKlp7b','recyalS7o5nh2Ec76'),('recN9q2iKnlPAd6WO','recyalS7o5nh2Ec76'),('recnhw2lM7tzaHAsF','recyalS7o5nh2Ec76'),('recNk2Yp3vM8AgHI5','recyalS7o5nh2Ec76'),('recnQTMUTD7qFcX46','recyalS7o5nh2Ec76'),('recNRXqmiaezz5S0q','recyalS7o5nh2Ec76'),('recnwttKkvqklJenW','recyalS7o5nh2Ec76'),('recNydhq15SM1Nc8n','recyalS7o5nh2Ec76'),('recOB7seRuOwLjp0g','recyalS7o5nh2Ec76'),('recoMBjRcJTxeg8QT','recyalS7o5nh2Ec76'),('recOnazU5kf9OqQaR','recyalS7o5nh2Ec76'),('recOnZcfciELmGjx1','recyalS7o5nh2Ec76'),('recOQ2D1sPlO1LC4t','recyalS7o5nh2Ec76'),('recOx2XKWOkAq2qPA','recyalS7o5nh2Ec76'),('recPMXTd653F1VemE','recyalS7o5nh2Ec76'),('recqUeem4vXy6EUaK','recyalS7o5nh2Ec76'),('recR3RO50q16Xe8yX','recyalS7o5nh2Ec76'),('recROj25L2pDcrPd5','recyalS7o5nh2Ec76'),('recruKbdthW5YsNDf','recyalS7o5nh2Ec76'),('recsEpQxbmydcIIkR','recyalS7o5nh2Ec76'),('recsJBFU28TmwaNCQ','recyalS7o5nh2Ec76'),('recSKn79mRptU7ICJ','recyalS7o5nh2Ec76'),('recSLRsxNScBn5610','recyalS7o5nh2Ec76'),('recsRMDjXsPBw60AZ','recyalS7o5nh2Ec76'),('rect9kzlRMc12Mvi8','recyalS7o5nh2Ec76'),('rectIdUq5aSUz6ZH0','recyalS7o5nh2Ec76'),('recTmD65r9aLpUOqu','recyalS7o5nh2Ec76'),('recUAamBRzAplmdB1','recyalS7o5nh2Ec76'),('recUVNIgnUw4ptKnZ','recyalS7o5nh2Ec76'),('recv0sFzxriYXODWl','recyalS7o5nh2Ec76'),('recVCh2XGcVi59SXV','recyalS7o5nh2Ec76'),('recvkU85tMv1rCJQF','recyalS7o5nh2Ec76'),('recvmVSWTF1bsC9Xx','recyalS7o5nh2Ec76'),('recVnZ9JJA0JOY8F9','recyalS7o5nh2Ec76'),('recVv1dc7Fs9F0sMB','recyalS7o5nh2Ec76'),('recVZZeKqrddTn6Pe','recyalS7o5nh2Ec76'),('recWi2YTm7YMu4ThT','recyalS7o5nh2Ec76'),('recwk9Nzp7ah6X7Kn','recyalS7o5nh2Ec76'),('recWtyv4YElGJrKk2','recyalS7o5nh2Ec76'),('recWusbxFCdIrmM6s','recyalS7o5nh2Ec76'),('recx03ffx0xTpIy46','recyalS7o5nh2Ec76'),('recxDWye6rkGb7mx5','recyalS7o5nh2Ec76'),('recXGsSw4fEs3njLg','recyalS7o5nh2Ec76'),('recxPMNXTYYyvADzO','recyalS7o5nh2Ec76'),('recXyaklZivud9LCw','recyalS7o5nh2Ec76'),('recYDCAnL8kc7Nykz','recyalS7o5nh2Ec76'),('recYKZYyHVWfGeH51','recyalS7o5nh2Ec76'),('recZ7PaS4sjeg2Yxf','recyalS7o5nh2Ec76'),('reczJJ4AWGa5J2v8d','recyalS7o5nh2Ec76'),('reczn8vfg579HZ2yi','recyalS7o5nh2Ec76'),('reczv5NMjux3yZmFB','recyalS7o5nh2Ec76'),('reczyMVGQs0YIw6lw','recyalS7o5nh2Ec76');
/*!40000 ALTER TABLE `nc_5bf7___nc_m2m_grcpporlwy` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_acl`
--

DROP TABLE IF EXISTS `nc_acl`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_acl` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `tn` varchar(255) DEFAULT NULL,
  `acl` text,
  `type` varchar(255) DEFAULT 'table',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_acl`
--

LOCK TABLES `nc_acl` WRITE;
/*!40000 ALTER TABLE `nc_acl` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_acl` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_api_tokens`
--

DROP TABLE IF EXISTS `nc_api_tokens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_api_tokens` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `permissions` text,
  `token` text,
  `expiry` varchar(255) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_api_tokens`
--

LOCK TABLES `nc_api_tokens` WRITE;
/*!40000 ALTER TABLE `nc_api_tokens` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_api_tokens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_audit`
--

DROP TABLE IF EXISTS `nc_audit`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_audit` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `user` varchar(255) DEFAULT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `model_name` varchar(100) DEFAULT NULL,
  `model_id` varchar(100) DEFAULT NULL,
  `op_type` varchar(255) DEFAULT NULL,
  `op_sub_type` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `description` text,
  `details` text,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY ```nc_audit_index``` (`db_alias`,`project_id`,`model_name`,`model_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_audit`
--

LOCK TABLES `nc_audit` WRITE;
/*!40000 ALTER TABLE `nc_audit` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_audit` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_audit_v2`
--

DROP TABLE IF EXISTS `nc_audit_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_audit_v2` (
  `id` varchar(20) NOT NULL,
  `user` varchar(255) DEFAULT NULL,
  `ip` varchar(255) DEFAULT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_model_id` varchar(20) DEFAULT NULL,
  `row_id` varchar(255) DEFAULT NULL,
  `op_type` varchar(255) DEFAULT NULL,
  `op_sub_type` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `description` text,
  `details` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_audit_v2_base_id_foreign` (`base_id`),
  KEY `nc_audit_v2_project_id_foreign` (`project_id`),
  KEY `nc_audit_v2_fk_model_id_foreign` (`fk_model_id`),
  KEY `nc_audit_v2_row_id_index` (`row_id`),
  CONSTRAINT `nc_audit_v2_base_id_foreign` FOREIGN KEY (`base_id`) REFERENCES `nc_bases_v2` (`id`),
  CONSTRAINT `nc_audit_v2_fk_model_id_foreign` FOREIGN KEY (`fk_model_id`) REFERENCES `nc_models_v2` (`id`),
  CONSTRAINT `nc_audit_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `nc_projects_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_audit_v2`
--

LOCK TABLES `nc_audit_v2` WRITE;
/*!40000 ALTER TABLE `nc_audit_v2` DISABLE KEYS */;
INSERT INTO `nc_audit_v2` VALUES ('adt_2666rko2r8wz0l','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE_COLUMN','CREATED',NULL,'created column Status_from_Actor_ with alias Status (from Actor) from table nc_5bf7___Film',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('adt_gwzhswvdtfnb2j','user@nocodb.com','::1',NULL,NULL,NULL,NULL,'AUTHENTICATION','SIGNUP',NULL,'signed up ',NULL,'2023-02-13 13:20:27','2023-02-13 13:20:27'),('adt_lxgvnfxlzobotw','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE_COLUMN','UPDATED',NULL,'updated column null with alias Film List from table nc_5bf7___Actor',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('adt_otujb3a59ct84x','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE','CREATED',NULL,'created table nc_5bf7___Film with alias Film  ',NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('adt_pxjmct633h7uj0','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE','CREATED',NULL,'created table nc_5bf7___Producer with alias Producer  ',NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('adt_v0tv76no71w20u','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE_COLUMN','CREATED',NULL,'created column Actor with alias Actor from table nc_5bf7___Film',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('adt_x9jk3dw1fbg7tg','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'AUTHENTICATION','INVITE',NULL,'invited a@b.com to p_4d1tukupf1njth project ',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('adt_ypskqvbv4lx46d','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'TABLE','CREATED',NULL,'created table nc_5bf7___Actor with alias Actor  ',NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('adt_ys3f18w7y115dq','user@nocodb.com','::ffff:127.0.0.1',NULL,'p_4d1tukupf1njth',NULL,NULL,'AUTHENTICATION','INVITE',NULL,'invited airtable.dummy@gmail.com to p_4d1tukupf1njth project ',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39');
/*!40000 ALTER TABLE `nc_audit_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_bases_v2`
--

DROP TABLE IF EXISTS `nc_bases_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_bases_v2` (
  `id` varchar(20) NOT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `alias` varchar(255) DEFAULT NULL,
  `config` text,
  `meta` text,
  `is_meta` tinyint(1) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `inflection_column` varchar(255) DEFAULT NULL,
  `inflection_table` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_bases_v2_project_id_foreign` (`project_id`),
  CONSTRAINT `nc_bases_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `nc_projects_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_bases_v2`
--

LOCK TABLES `nc_bases_v2` WRITE;
/*!40000 ALTER TABLE `nc_bases_v2` DISABLE KEYS */;
INSERT INTO `nc_bases_v2` VALUES ('ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'U2FsdGVkX1+RFNhg4kwjEJ4BAsoA8hOykJmhJ6vMsHI=',NULL,1,'mysql2','camelize','camelize','2023-02-13 13:20:32','2023-02-13 13:20:32');
/*!40000 ALTER TABLE `nc_bases_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_col_formula_v2`
--

DROP TABLE IF EXISTS `nc_col_formula_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_col_formula_v2` (
  `id` varchar(20) NOT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `formula` text NOT NULL,
  `formula_raw` text,
  `error` text,
  `deleted` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_col_formula_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_col_formula_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_col_formula_v2`
--

LOCK TABLES `nc_col_formula_v2` WRITE;
/*!40000 ALTER TABLE `nc_col_formula_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_col_formula_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_col_lookup_v2`
--

DROP TABLE IF EXISTS `nc_col_lookup_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_col_lookup_v2` (
  `id` varchar(20) NOT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `fk_relation_column_id` varchar(20) DEFAULT NULL,
  `fk_lookup_column_id` varchar(20) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_col_lookup_v2_fk_column_id_foreign` (`fk_column_id`),
  KEY `nc_col_lookup_v2_fk_relation_column_id_foreign` (`fk_relation_column_id`),
  KEY `nc_col_lookup_v2_fk_lookup_column_id_foreign` (`fk_lookup_column_id`),
  CONSTRAINT `nc_col_lookup_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_lookup_v2_fk_lookup_column_id_foreign` FOREIGN KEY (`fk_lookup_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_lookup_v2_fk_relation_column_id_foreign` FOREIGN KEY (`fk_relation_column_id`) REFERENCES `nc_columns_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_col_lookup_v2`
--

LOCK TABLES `nc_col_lookup_v2` WRITE;
/*!40000 ALTER TABLE `nc_col_lookup_v2` DISABLE KEYS */;
INSERT INTO `nc_col_lookup_v2` VALUES ('lk_pj0c99ji0t5doq','cl_b7rbheoh081vl1','cl_v5s25ktqvz2ona','cl_piz68jzu6bkpo7',NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39');
/*!40000 ALTER TABLE `nc_col_lookup_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_col_relations_v2`
--

DROP TABLE IF EXISTS `nc_col_relations_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_col_relations_v2` (
  `id` varchar(20) NOT NULL,
  `ref_db_alias` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `virtual` tinyint(1) DEFAULT NULL,
  `db_type` varchar(255) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `fk_related_model_id` varchar(20) DEFAULT NULL,
  `fk_child_column_id` varchar(20) DEFAULT NULL,
  `fk_parent_column_id` varchar(20) DEFAULT NULL,
  `fk_mm_model_id` varchar(20) DEFAULT NULL,
  `fk_mm_child_column_id` varchar(20) DEFAULT NULL,
  `fk_mm_parent_column_id` varchar(20) DEFAULT NULL,
  `ur` varchar(255) DEFAULT NULL,
  `dr` varchar(255) DEFAULT NULL,
  `fk_index_name` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_col_relations_v2_fk_column_id_foreign` (`fk_column_id`),
  KEY `nc_col_relations_v2_fk_related_model_id_foreign` (`fk_related_model_id`),
  KEY `nc_col_relations_v2_fk_child_column_id_foreign` (`fk_child_column_id`),
  KEY `nc_col_relations_v2_fk_parent_column_id_foreign` (`fk_parent_column_id`),
  KEY `nc_col_relations_v2_fk_mm_model_id_foreign` (`fk_mm_model_id`),
  KEY `nc_col_relations_v2_fk_mm_child_column_id_foreign` (`fk_mm_child_column_id`),
  KEY `nc_col_relations_v2_fk_mm_parent_column_id_foreign` (`fk_mm_parent_column_id`),
  CONSTRAINT `nc_col_relations_v2_fk_child_column_id_foreign` FOREIGN KEY (`fk_child_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_mm_child_column_id_foreign` FOREIGN KEY (`fk_mm_child_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_mm_model_id_foreign` FOREIGN KEY (`fk_mm_model_id`) REFERENCES `nc_models_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_mm_parent_column_id_foreign` FOREIGN KEY (`fk_mm_parent_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_parent_column_id_foreign` FOREIGN KEY (`fk_parent_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_relations_v2_fk_related_model_id_foreign` FOREIGN KEY (`fk_related_model_id`) REFERENCES `nc_models_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_col_relations_v2`
--

LOCK TABLES `nc_col_relations_v2` WRITE;
/*!40000 ALTER TABLE `nc_col_relations_v2` DISABLE KEYS */;
INSERT INTO `nc_col_relations_v2` VALUES ('ln_12f5gozqq1o4kf',NULL,'mm',NULL,NULL,'cl_epypq0k15jopob','md_ait5ocwdiqf23s','cl_uofshxgieasrmb','cl_i5shxg3b6ot0o5','md_7qix1x0cjo8kal','cl_kr40dj7104eis9','cl_6j2c4u80qkicrn',NULL,NULL,NULL,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('ln_16ithfa9zw41hb',NULL,'hm',0,NULL,'cl_8gy9ckj926s41s','md_7qix1x0cjo8kal','cl_6j2c4u80qkicrn','cl_i5shxg3b6ot0o5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('ln_1km6fg0pufruzy',NULL,'hm',0,NULL,'cl_t57vyfdrwh3qy0','md_7qix1x0cjo8kal','cl_kr40dj7104eis9','cl_uofshxgieasrmb',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('ln_7se2qhcykdaz4p',NULL,'bt',0,NULL,'cl_3bsyaugjw1rql9','md_ait5ocwdiqf23s','cl_6j2c4u80qkicrn','cl_i5shxg3b6ot0o5',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('ln_crqgv3vdt6p5c6',NULL,'bt',0,NULL,'cl_q18joopt0ovev4','md_ubgh6h4q1y9q7l','cl_kr40dj7104eis9','cl_uofshxgieasrmb',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('ln_kxu1on7qgdvqur',NULL,'mm',NULL,NULL,'cl_v5s25ktqvz2ona','md_ubgh6h4q1y9q7l','cl_i5shxg3b6ot0o5','cl_uofshxgieasrmb','md_7qix1x0cjo8kal','cl_6j2c4u80qkicrn','cl_kr40dj7104eis9',NULL,NULL,NULL,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39');
/*!40000 ALTER TABLE `nc_col_relations_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_col_rollup_v2`
--

DROP TABLE IF EXISTS `nc_col_rollup_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_col_rollup_v2` (
  `id` varchar(20) NOT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `fk_relation_column_id` varchar(20) DEFAULT NULL,
  `fk_rollup_column_id` varchar(20) DEFAULT NULL,
  `rollup_function` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_col_rollup_v2_fk_column_id_foreign` (`fk_column_id`),
  KEY `nc_col_rollup_v2_fk_relation_column_id_foreign` (`fk_relation_column_id`),
  KEY `nc_col_rollup_v2_fk_rollup_column_id_foreign` (`fk_rollup_column_id`),
  CONSTRAINT `nc_col_rollup_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_rollup_v2_fk_relation_column_id_foreign` FOREIGN KEY (`fk_relation_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_col_rollup_v2_fk_rollup_column_id_foreign` FOREIGN KEY (`fk_rollup_column_id`) REFERENCES `nc_columns_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_col_rollup_v2`
--

LOCK TABLES `nc_col_rollup_v2` WRITE;
/*!40000 ALTER TABLE `nc_col_rollup_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_col_rollup_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_col_select_options_v2`
--

DROP TABLE IF EXISTS `nc_col_select_options_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_col_select_options_v2` (
  `id` varchar(20) NOT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_col_select_options_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_col_select_options_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_col_select_options_v2`
--

LOCK TABLES `nc_col_select_options_v2` WRITE;
/*!40000 ALTER TABLE `nc_col_select_options_v2` DISABLE KEYS */;
INSERT INTO `nc_col_select_options_v2` VALUES ('sl_4t5xmvundacb4q','cl_ym94hdk5d0slso','\'In progress\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_5bxaswnbdefois','cl_pbm85tom9ej8o1','\'Todo\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_7253tvhhiui5rs','cl_piz68jzu6bkpo7','\'In progress\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_99lyrfyrfwzih5','cl_piz68jzu6bkpo7','\'Done\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_9wlse74lica3xm','cl_pbm85tom9ej8o1','\'In progress\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_b2ft1u9ahfv0ks','cl_pqv9761yol4u9b','\'Mar\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_dgo2tz0hja3w9j','cl_pqv9761yol4u9b','\'Nov\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_g57h4lc1l88oxa','cl_pbm85tom9ej8o1','\'Done\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_hknmy2qahjdjb8','cl_pqv9761yol4u9b','\'Jan\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_joc9jx5hjkr7xn','cl_pqv9761yol4u9b','\'May\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_kw8ilvggzjddyi','cl_pqv9761yol4u9b','\'Jun\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_mln8ljn5f9of5s','cl_pqv9761yol4u9b','\'Jul\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_nbngajsffaj4h6','cl_pqv9761yol4u9b','\'Feb\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_nin41mv9y9qyi2','cl_pqv9761yol4u9b','\'Apr\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_p3t9phdx3m9wmv','cl_pqv9761yol4u9b','\'Sep\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_rrjbf2rexpz4x0','cl_pqv9761yol4u9b','\'Dec\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_t2dg9j06oenqsa','cl_pqv9761yol4u9b','\'Oct\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_ucvj383grkvfwy','cl_ym94hdk5d0slso','\'Todo\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_uuui713lp0jnmv','cl_ym94hdk5d0slso','\'Done\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('sl_x0vocefi3endoi','cl_piz68jzu6bkpo7','\'Todo\'',NULL,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('sl_xo2xitso69wnpr','cl_pqv9761yol4u9b','\'Aug\'',NULL,NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37');
/*!40000 ALTER TABLE `nc_col_select_options_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_columns_v2`
--

DROP TABLE IF EXISTS `nc_columns_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_columns_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_model_id` varchar(20) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `column_name` varchar(255) DEFAULT NULL,
  `uidt` varchar(255) DEFAULT NULL,
  `dt` varchar(255) DEFAULT NULL,
  `np` varchar(255) DEFAULT NULL,
  `ns` varchar(255) DEFAULT NULL,
  `clen` varchar(255) DEFAULT NULL,
  `cop` varchar(255) DEFAULT NULL,
  `pk` tinyint(1) DEFAULT NULL,
  `pv` tinyint(1) DEFAULT NULL,
  `rqd` tinyint(1) DEFAULT NULL,
  `un` tinyint(1) DEFAULT NULL,
  `ct` text,
  `ai` tinyint(1) DEFAULT NULL,
  `unique` tinyint(1) DEFAULT NULL,
  `cdf` text,
  `cc` text,
  `csn` varchar(255) DEFAULT NULL,
  `dtx` varchar(255) DEFAULT NULL,
  `dtxp` text,
  `dtxs` varchar(255) DEFAULT NULL,
  `au` tinyint(1) DEFAULT NULL,
  `validate` text,
  `virtual` tinyint(1) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `system` tinyint(1) DEFAULT '0',
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `meta` text,
  PRIMARY KEY (`id`),
  KEY `nc_columns_v2_fk_model_id_foreign` (`fk_model_id`),
  CONSTRAINT `nc_columns_v2_fk_model_id_foreign` FOREIGN KEY (`fk_model_id`) REFERENCES `nc_models_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_columns_v2`
--

LOCK TABLES `nc_columns_v2` WRITE;
/*!40000 ALTER TABLE `nc_columns_v2` DISABLE KEYS */;
INSERT INTO `nc_columns_v2` VALUES ('cl_0pfssczng1a9mf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Notes','Notes','LongText','text',NULL,NULL,'65535','2',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_1zs2ggcj06s92o','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Attachments','Attachments','Attachment','text',NULL,NULL,'65535','3',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_3bsyaugjw1rql9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_7qix1x0cjo8kal','Film',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_4zfo6wk5855ppm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Name','Name','SingleLineText','text',NULL,NULL,'65535','1',0,1,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:39',NULL),('cl_6j2c4u80qkicrn','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_7qix1x0cjo8kal','table1_id','table1_id','ForeignKey','varchar',NULL,NULL,NULL,NULL,1,NULL,1,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'255',NULL,NULL,NULL,NULL,NULL,0,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_6zowm2vxblwms4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','ncRecordHash','ncRecordHash','SingleLineText','varchar',NULL,NULL,'255','17',0,0,0,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,1,17.00,'2023-02-13 13:21:38','2023-02-13 13:21:39',NULL),('cl_8cahy77edg5odh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','ncRecordId','ncRecordId','ID','varchar',NULL,NULL,'255','5',1,NULL,1,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:38','2023-02-13 13:21:38','{\"ag\":\"nc\"}'),('cl_8gy9ckj926s41s','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','nc_5bf7___nc_m2m_grcpporlwy List',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_b2gz24q6qjr3qr','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','URL','URL','URL','text',NULL,NULL,'65535','10',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,'{\"func\":[\"isURL\"],\"args\":[\"\"],\"msg\":[\"Validation failed : isURL ({cn})\"]}',NULL,NULL,0,10.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_b7rbheoh081vl1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Status (from Actor)','Status_from_Actor_','Lookup',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39',NULL),('cl_emh6h3xorqflvy','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Email','Email','Email','text',NULL,NULL,'65535','9',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,'{\"func\":[\"isEmail\"],\"args\":[\"\"],\"msg\":[\"Validation failed : isEmail ({cn})\"]}',NULL,NULL,0,9.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_epypq0k15jopob','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Film',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39',NULL),('cl_evby555os6s87a','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Notes','Notes','LongText','text',NULL,NULL,'65535','2',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_fu4d3tdkojkihq','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Value','Value','Currency','decimal','10','2',NULL,'12',0,NULL,0,0,'decimal(10,2)',0,0,NULL,'',NULL,'specificType','10','2',0,'{\"func\":[\"isCurrency\"],\"args\":[\"\"],\"msg\":[\"Validation failed : isCurrency\"]}',NULL,NULL,0,12.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_fuxwap6zxz7mq2','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Attachments','Attachments','Attachment','text',NULL,NULL,'65535','3',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,3.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_i362ai4i2bg9g9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Date','Date','Date','varchar',NULL,NULL,'255','7',0,NULL,0,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,0,7.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_i5shxg3b6ot0o5','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','ncRecordId','ncRecordId','ID','varchar',NULL,NULL,'255','16',1,NULL,1,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,0,16.00,'2023-02-13 13:21:37','2023-02-13 13:21:37','{\"ag\":\"nc\"}'),('cl_ikq1v1533n2zhg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Number','Number','Decimal','double','22','2',NULL,'11',0,NULL,0,0,'double(22,2)',0,0,NULL,'',NULL,'specificType','22','2',0,NULL,NULL,NULL,0,11.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_jeewz056vnwx0k','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','ncRecordHash','ncRecordHash','SingleLineText','varchar',NULL,NULL,'255','6',0,0,0,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,1,6.00,'2023-02-13 13:21:38','2023-02-13 13:21:39',NULL),('cl_jrxkx01ck8k3rs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Attachments','Attachments','Attachment','text',NULL,NULL,'65535','3',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_k0mlvez2byv7h1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Notes','Notes','LongText','text',NULL,NULL,'65535','2',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,2.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_kr40dj7104eis9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_7qix1x0cjo8kal','table2_id','table2_id','ForeignKey','varchar',NULL,NULL,NULL,NULL,1,NULL,1,0,NULL,0,NULL,NULL,NULL,NULL,NULL,'255',NULL,NULL,NULL,NULL,NULL,0,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_pbm85tom9ej8o1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Status','Status','SingleSelect','text',NULL,NULL,'65535','4',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','\'Todo\',\'In progress\',\'Done\'',NULL,0,NULL,NULL,NULL,0,4.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_piz68jzu6bkpo7','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Status','Status','SingleSelect','text',NULL,NULL,'65535','4',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','\'Todo\',\'In progress\',\'Done\'',NULL,0,NULL,NULL,NULL,0,4.00,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_pp8up2muaqrre4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Name','Name','SingleLineText','text',NULL,NULL,'65535','1',0,1,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,1.00,'2023-02-13 13:21:37','2023-02-13 13:21:39',NULL),('cl_pqv9761yol4u9b','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Tags','Tags','MultiSelect','text',NULL,NULL,'65535','6',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','\'Jan\',\'Feb\',\'Mar\',\'Apr\',\'May\',\'Jun\',\'Jul\',\'Aug\',\'Sep\',\'Oct\',\'Nov\',\'Dec\'',NULL,0,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_q18joopt0ovev4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_7qix1x0cjo8kal','Actor',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_rjwrppaoc25v53','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Name','Name','SingleLineText','text',NULL,NULL,'65535','1',0,1,0,0,'text',0,0,NULL,'','utf8mb4','specificType','65535',NULL,0,NULL,NULL,NULL,0,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:39',NULL),('cl_roks3fmhcu7aht','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Duration','Duration','Duration','decimal','10','2',NULL,'14',0,NULL,0,0,'decimal(10,2)',0,0,NULL,'',NULL,'specificType','10','2',0,NULL,NULL,NULL,0,14.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_rrp6yxgieh1kz0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Phone','Phone','PhoneNumber','varchar',NULL,NULL,'255','8',0,NULL,0,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,'{\"func\":[\"isMobilePhone\"],\"args\":[\"\"],\"msg\":[\"Validation failed : isMobilePhone ({cn})\"]}',NULL,NULL,0,8.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_t57vyfdrwh3qy0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','nc_5bf7___nc_m2m_grcpporlwy List',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,1,NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38',NULL),('cl_thn2fwlcnhdy81','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Percent','Percent','Percent','double','22','2',NULL,'13',0,NULL,0,0,'double(22,2)',0,0,NULL,'',NULL,'specificType','22','2',0,NULL,NULL,NULL,0,13.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_umoy40pl5k7xdg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','ncRecordHash','ncRecordHash','SingleLineText','varchar',NULL,NULL,'255','6',0,0,0,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,1,6.00,'2023-02-13 13:21:38','2023-02-13 13:21:39',NULL),('cl_uofshxgieasrmb','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','ncRecordId','ncRecordId','ID','varchar',NULL,NULL,'255','5',1,NULL,1,0,'varchar(255)',0,0,NULL,'','utf8mb4','specificType','255',NULL,0,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:38','2023-02-13 13:21:38','{\"ag\":\"nc\"}'),('cl_uompf0ryh112pc','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Rating','Rating','Rating','int','10','0',NULL,'15',0,NULL,0,0,'int',0,0,NULL,'',NULL,'specificType','','0',0,NULL,NULL,NULL,0,15.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_v5s25ktqvz2ona','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Actor',NULL,'LinkToAnotherRecord',NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39',NULL),('cl_vltfj7iq9n8s82','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Done','Done','Checkbox','tinyint','3','0',NULL,'5',0,NULL,0,0,'tinyint(1)',0,0,NULL,'',NULL,'specificType','1','0',0,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL),('cl_ym94hdk5d0slso','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Status','Status','SingleSelect','text',NULL,NULL,'65535','4',0,NULL,0,0,'text',0,0,NULL,'','utf8mb4','specificType','\'Todo\',\'In progress\',\'Done\'',NULL,0,NULL,NULL,NULL,0,4.00,'2023-02-13 13:21:37','2023-02-13 13:21:37',NULL);
/*!40000 ALTER TABLE `nc_columns_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_cron`
--

DROP TABLE IF EXISTS `nc_cron`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_cron` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `env` varchar(255) DEFAULT NULL,
  `pattern` varchar(255) DEFAULT NULL,
  `webhook` varchar(255) DEFAULT NULL,
  `timezone` varchar(255) DEFAULT 'America/Los_Angeles',
  `active` tinyint(1) DEFAULT '1',
  `cron_handler` text,
  `payload` text,
  `headers` text,
  `retries` int DEFAULT '0',
  `retry_interval` int DEFAULT '60000',
  `timeout` int DEFAULT '60000',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_cron`
--

LOCK TABLES `nc_cron` WRITE;
/*!40000 ALTER TABLE `nc_cron` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_cron` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_disabled_models_for_role`
--

DROP TABLE IF EXISTS `nc_disabled_models_for_role`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_disabled_models_for_role` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(45) DEFAULT NULL,
  `title` varchar(45) DEFAULT NULL,
  `type` varchar(45) DEFAULT NULL,
  `role` varchar(45) DEFAULT NULL,
  `disabled` tinyint(1) DEFAULT '1',
  `tn` varchar(255) DEFAULT NULL,
  `rtn` varchar(255) DEFAULT NULL,
  `cn` varchar(255) DEFAULT NULL,
  `rcn` varchar(255) DEFAULT NULL,
  `relation_type` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `parent_model_title` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `xc_disabled124_idx` (`project_id`,`db_alias`,`title`,`type`,`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_disabled_models_for_role`
--

LOCK TABLES `nc_disabled_models_for_role` WRITE;
/*!40000 ALTER TABLE `nc_disabled_models_for_role` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_disabled_models_for_role` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_disabled_models_for_role_v2`
--

DROP TABLE IF EXISTS `nc_disabled_models_for_role_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_disabled_models_for_role_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `role` varchar(45) DEFAULT NULL,
  `disabled` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_disabled_models_for_role_v2_fk_view_id_foreign` (`fk_view_id`),
  CONSTRAINT `nc_disabled_models_for_role_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_disabled_models_for_role_v2`
--

LOCK TABLES `nc_disabled_models_for_role_v2` WRITE;
/*!40000 ALTER TABLE `nc_disabled_models_for_role_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_disabled_models_for_role_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_evolutions`
--

DROP TABLE IF EXISTS `nc_evolutions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_evolutions` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `titleDown` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `checksum` varchar(255) DEFAULT NULL,
  `status` int DEFAULT NULL,
  `created` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_evolutions`
--

LOCK TABLES `nc_evolutions` WRITE;
/*!40000 ALTER TABLE `nc_evolutions` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_evolutions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_filter_exp_v2`
--

DROP TABLE IF EXISTS `nc_filter_exp_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_filter_exp_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_hook_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `fk_parent_id` varchar(20) DEFAULT NULL,
  `logical_op` varchar(255) DEFAULT NULL,
  `comparison_op` varchar(255) DEFAULT NULL,
  `value` varchar(255) DEFAULT NULL,
  `is_group` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_filter_exp_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_filter_exp_v2_fk_hook_id_foreign` (`fk_hook_id`),
  KEY `nc_filter_exp_v2_fk_column_id_foreign` (`fk_column_id`),
  KEY `nc_filter_exp_v2_fk_parent_id_foreign` (`fk_parent_id`),
  CONSTRAINT `nc_filter_exp_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_filter_exp_v2_fk_hook_id_foreign` FOREIGN KEY (`fk_hook_id`) REFERENCES `nc_hooks_v2` (`id`),
  CONSTRAINT `nc_filter_exp_v2_fk_parent_id_foreign` FOREIGN KEY (`fk_parent_id`) REFERENCES `nc_filter_exp_v2` (`id`),
  CONSTRAINT `nc_filter_exp_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_filter_exp_v2`
--

LOCK TABLES `nc_filter_exp_v2` WRITE;
/*!40000 ALTER TABLE `nc_filter_exp_v2` DISABLE KEYS */;
INSERT INTO `nc_filter_exp_v2` VALUES ('fi_2ej5ugnjp20urg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_w2ic883r1bw3zp',NULL,'cl_rjwrppaoc25v53',NULL,'or','like','1',NULL,1.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('fi_ka2jmn0pbelbiz','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_w2ic883r1bw3zp',NULL,'cl_rjwrppaoc25v53',NULL,'or','like','2',NULL,2.00,'2023-02-13 13:21:42','2023-02-13 13:21:42');
/*!40000 ALTER TABLE `nc_filter_exp_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_form_view_columns_v2`
--

DROP TABLE IF EXISTS `nc_form_view_columns_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_form_view_columns_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `help` varchar(255) DEFAULT NULL,
  `description` text,
  `required` tinyint(1) DEFAULT NULL,
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_form_view_columns_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_form_view_columns_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_form_view_columns_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_form_view_columns_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_form_view_v2` (`fk_view_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_form_view_columns_v2`
--

LOCK TABLES `nc_form_view_columns_v2` WRITE;
/*!40000 ALTER TABLE `nc_form_view_columns_v2` DISABLE KEYS */;
INSERT INTO `nc_form_view_columns_v2` VALUES ('fvc_1rijc1p8b6x8cr','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_8cahy77edg5odh',NULL,NULL,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_240s5art0b1jox','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_pp8up2muaqrre4',NULL,'DisplayName',NULL,'HelpText',1,1,3.00,'2023-02-13 13:21:46','2023-02-13 13:21:47'),('fvc_43kewosolnh5k5','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_0pfssczng1a9mf',NULL,NULL,NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_475k4ul7uzt4be','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_v5s25ktqvz2ona',NULL,NULL,NULL,NULL,NULL,0,17.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_4jam950o4gy66h','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_8gy9ckj926s41s',NULL,NULL,NULL,NULL,NULL,0,18.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_572c6id92o5xvb','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_uompf0ryh112pc',NULL,NULL,NULL,NULL,NULL,0,15.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_57jjll0fykfqn8','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_ym94hdk5d0slso',NULL,NULL,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:46','2023-02-13 13:21:47'),('fvc_5f8m9xl53cc67c','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_vltfj7iq9n8s82',NULL,NULL,NULL,NULL,NULL,0,2.00,'2023-02-13 13:21:46','2023-02-13 13:21:47'),('fvc_68vc0bw7dzy94h','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_fuxwap6zxz7mq2',NULL,NULL,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:46','2023-02-13 13:21:47'),('fvc_7bfhsr63pc3670','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_7o7i0t30jfyebs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_6zowm2vxblwms4',NULL,NULL,NULL,NULL,NULL,0,21.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_85xtwa7ywu7wst','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_4zfo6wk5855ppm',NULL,NULL,NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_a4xh5qcb3p7jhd','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_pbm85tom9ej8o1',NULL,NULL,NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_cdsvxen7v1nf51','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_4zfo6wk5855ppm',NULL,NULL,NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_csbf0q0rhu8eg8','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_emh6h3xorqflvy',NULL,NULL,NULL,NULL,NULL,1,9.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_dcrjjxm3u4wz65','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_jeewz056vnwx0k',NULL,NULL,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_dkiiswzwrcyb0b','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_f0bfnu5ho03aml','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_4zfo6wk5855ppm',NULL,NULL,NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_g6o2mkuf0vf42q','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_8cahy77edg5odh',NULL,NULL,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_hddus3767pr0un','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_pbm85tom9ej8o1',NULL,NULL,NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_hrwnr5dsmutv6s','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_thn2fwlcnhdy81',NULL,NULL,NULL,NULL,NULL,0,13.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_iwscer94tb7x9o','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_b2gz24q6qjr3qr',NULL,NULL,NULL,NULL,NULL,0,10.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_k94revbxntc8in','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_pbm85tom9ej8o1',NULL,NULL,NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_kt784wrgxfbl7m','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_jeewz056vnwx0k',NULL,NULL,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_lb4ncsqt7dfher','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_8cahy77edg5odh',NULL,NULL,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_mearpee8pjzuc0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_pqv9761yol4u9b',NULL,NULL,NULL,NULL,NULL,0,1.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_mqo2bhk5kky4al','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_pbm85tom9ej8o1',NULL,NULL,NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_mu8kqh3hnlf8c3','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_8cahy77edg5odh',NULL,NULL,NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_n83v75d030f1sx','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','cl_4zfo6wk5855ppm',NULL,NULL,NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('fvc_o3tkr1le1ecub8','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_rrp6yxgieh1kz0',NULL,NULL,NULL,NULL,NULL,0,8.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_ogat0em1vu3mo2','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_jeewz056vnwx0k',NULL,NULL,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_p1g8cyj493t5s2','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_i362ai4i2bg9g9',NULL,NULL,NULL,NULL,NULL,0,7.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_qvi1jqz5y2ox2q','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_roks3fmhcu7aht',NULL,NULL,NULL,NULL,NULL,0,14.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_s3l3fzkoz1jp5x','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_shdmvtss0u69g1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_jeewz056vnwx0k',NULL,NULL,NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_th07ee7usqxrl3','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_ikq1v1533n2zhg',NULL,NULL,NULL,NULL,NULL,0,11.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_v87pgqkzijm5bh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_0pfssczng1a9mf',NULL,NULL,NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_vr1xxjd11i28q8','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_b7rbheoh081vl1',NULL,NULL,NULL,NULL,NULL,0,18.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_wocd1909bqwz1z','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','cl_0pfssczng1a9mf',NULL,NULL,NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('fvc_x3vaj4ad67zxld','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_fu4d3tdkojkihq',NULL,NULL,NULL,NULL,NULL,0,12.00,'2023-02-13 13:21:47','2023-02-13 13:21:47'),('fvc_xak5osfzpkqgje','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_k0mlvez2byv7h1',NULL,NULL,NULL,NULL,NULL,0,4.00,'2023-02-13 13:21:46','2023-02-13 13:21:47'),('fvc_xxwmtqojbrwu2e','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','cl_0pfssczng1a9mf',NULL,NULL,NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('fvc_zeajmcaf1f1iib','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('fvc_zzvxg0df22hydd','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','cl_i5shxg3b6ot0o5',NULL,NULL,NULL,NULL,NULL,0,20.00,'2023-02-13 13:21:47','2023-02-13 13:21:47');
/*!40000 ALTER TABLE `nc_form_view_columns_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_form_view_v2`
--

DROP TABLE IF EXISTS `nc_form_view_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_form_view_v2` (
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) NOT NULL,
  `heading` varchar(255) DEFAULT NULL,
  `subheading` varchar(255) DEFAULT NULL,
  `success_msg` text,
  `redirect_url` text,
  `redirect_after_secs` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `submit_another_form` tinyint(1) DEFAULT NULL,
  `show_blank_form` tinyint(1) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `banner_image_url` text,
  `logo_url` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fk_view_id`),
  CONSTRAINT `nc_form_view_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_form_view_v2`
--

LOCK TABLES `nc_form_view_v2` WRITE;
/*!40000 ALTER TABLE `nc_form_view_v2` DISABLE KEYS */;
INSERT INTO `nc_form_view_v2` VALUES ('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_0n2afljavfxdtn','FormTitle','FormDescription','Thank you for submitting the form!',NULL,NULL,NULL,1,1,NULL,NULL,NULL,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_35blg8fwng91pw','Form 2','','Thank you for submitting the form!',NULL,NULL,NULL,0,0,NULL,NULL,NULL,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_fpby7jrdcanlha','Form 3','','Thank you for submitting the form!',NULL,NULL,NULL,0,0,NULL,NULL,NULL,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_isske9c4xpwnms','Form 4','','Thank you for submitting the form!',NULL,NULL,NULL,0,0,NULL,NULL,NULL,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_le3c5ucb4q0bjg','Form','','Thank you for submitting the form!',NULL,NULL,NULL,0,0,NULL,NULL,NULL,'2023-02-13 13:21:48','2023-02-13 13:21:48');
/*!40000 ALTER TABLE `nc_form_view_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_gallery_view_columns_v2`
--

DROP TABLE IF EXISTS `nc_gallery_view_columns_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_gallery_view_columns_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `help` varchar(255) DEFAULT NULL,
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_gallery_view_columns_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_gallery_view_columns_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_gallery_view_columns_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_gallery_view_columns_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_gallery_view_v2` (`fk_view_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_gallery_view_columns_v2`
--

LOCK TABLES `nc_gallery_view_columns_v2` WRITE;
/*!40000 ALTER TABLE `nc_gallery_view_columns_v2` DISABLE KEYS */;
INSERT INTO `nc_gallery_view_columns_v2` VALUES ('gvc_09hdya1k2ro9jk','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_4zfo6wk5855ppm',NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('gvc_3hpho2l4q2uny4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_0pfssczng1a9mf',NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_8nzee0yuugj29x','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_0pfssczng1a9mf',NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('gvc_95rng9nn8izelz','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_jeewz056vnwx0k',NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('gvc_bjp8q29uho5ha5','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_d2e31otymgirfm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_jeewz056vnwx0k',NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_dsp49tvqz5h2fw','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_8cahy77edg5odh',NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('gvc_eu2l3axfxh7s3i','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_4zfo6wk5855ppm',NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_fdy1kuaovmvec7','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_jeewz056vnwx0k',NULL,NULL,NULL,0,6.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_fxpbbmn6fk72hp','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_8cahy77edg5odh',NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_grq7bhutw51zf8','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_0pfssczng1a9mf',NULL,NULL,NULL,1,2.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_h6zr3hvu9jaavh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_pbm85tom9ej8o1',NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_jxxp6mhtzy0hnq','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_8cahy77edg5odh',NULL,NULL,NULL,0,5.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_wb626kgpwy5u8c','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_pbm85tom9ej8o1',NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_wcoik5ue87ve8q','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('gvc_wojg8bf0cj4do1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt','cl_4zfo6wk5855ppm',NULL,NULL,NULL,1,1.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('gvc_y7j3wvr2cnkhof','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_pbm85tom9ej8o1',NULL,NULL,NULL,1,4.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('gvc_zxl0rm4kv23y82','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks','cl_jrxkx01ck8k3rs',NULL,NULL,NULL,1,3.00,'2023-02-13 13:21:53','2023-02-13 13:21:53');
/*!40000 ALTER TABLE `nc_gallery_view_columns_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_gallery_view_v2`
--

DROP TABLE IF EXISTS `nc_gallery_view_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_gallery_view_v2` (
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) NOT NULL,
  `next_enabled` tinyint(1) DEFAULT NULL,
  `prev_enabled` tinyint(1) DEFAULT NULL,
  `cover_image_idx` int DEFAULT NULL,
  `fk_cover_image_col_id` varchar(20) DEFAULT NULL,
  `cover_image` varchar(255) DEFAULT NULL,
  `restrict_types` varchar(255) DEFAULT NULL,
  `restrict_size` varchar(255) DEFAULT NULL,
  `restrict_number` varchar(255) DEFAULT NULL,
  `public` tinyint(1) DEFAULT NULL,
  `dimensions` varchar(255) DEFAULT NULL,
  `responsive_columns` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fk_view_id`),
  KEY `nc_gallery_view_v2_fk_cover_image_col_id_foreign` (`fk_cover_image_col_id`),
  CONSTRAINT `nc_gallery_view_v2_fk_cover_image_col_id_foreign` FOREIGN KEY (`fk_cover_image_col_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_gallery_view_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_gallery_view_v2`
--

LOCK TABLES `nc_gallery_view_v2` WRITE;
/*!40000 ALTER TABLE `nc_gallery_view_v2` DISABLE KEYS */;
INSERT INTO `nc_gallery_view_v2` VALUES ('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_1r3c694ch2j1cf',NULL,NULL,NULL,'cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_g1bovqofu6jkrt',NULL,NULL,NULL,'cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_pu9hmgmaljzeks',NULL,NULL,NULL,'cl_jrxkx01ck8k3rs',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:53','2023-02-13 13:21:53');
/*!40000 ALTER TABLE `nc_gallery_view_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_grid_view_columns_v2`
--

DROP TABLE IF EXISTS `nc_grid_view_columns_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_grid_view_columns_v2` (
  `id` varchar(20) NOT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `help` varchar(255) DEFAULT NULL,
  `width` varchar(255) DEFAULT '200px',
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_grid_view_columns_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_grid_view_columns_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_grid_view_columns_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_grid_view_columns_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_grid_view_v2` (`fk_view_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_grid_view_columns_v2`
--

LOCK TABLES `nc_grid_view_columns_v2` WRITE;
/*!40000 ALTER TABLE `nc_grid_view_columns_v2` DISABLE KEYS */;
INSERT INTO `nc_grid_view_columns_v2` VALUES ('nc_0uig02s1rrq97t','vw_r2fyxtu9gny1yu','cl_4zfo6wk5855ppm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_22hw57f4eai2e3','vw_kjggqdazx92inj','cl_rjwrppaoc25v53','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_22ssfp5bmrdrdr','vw_kp06e9c28s4531','cl_i362ai4i2bg9g9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,7.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_27ksqyoson3utt','vw_m0uymfk23usf12','cl_3bsyaugjw1rql9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('nc_2krzo60e41dvcd','vw_r2fyxtu9gny1yu','cl_jeewz056vnwx0k','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_36z1l0cqj72mzz','vw_yjfuvexq9jiuel','cl_8cahy77edg5odh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,5.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_47fvi7h1kzb9bi','vw_kp06e9c28s4531','cl_ikq1v1533n2zhg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,11.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_4w03raz588jvlg','vw_kp06e9c28s4531','cl_b7rbheoh081vl1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,18.00,'2023-02-13 13:21:39','2023-02-13 13:21:40'),('nc_5c8couf95bp7n9','vw_rn2uzmjddnajp6','cl_jeewz056vnwx0k','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_7dcg1gueupuxq7','vw_kp06e9c28s4531','cl_pqv9761yol4u9b','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,5.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_7p6uz32lh1zeok','vw_r2fyxtu9gny1yu','cl_jrxkx01ck8k3rs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,3.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_8234xyzdwymkqh','vw_kp06e9c28s4531','cl_pp8up2muaqrre4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_86air8thmlauyt','vw_kjggqdazx92inj','cl_t57vyfdrwh3qy0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,7.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('nc_8ryrvqxjp5l8h4','vw_kjggqdazx92inj','cl_umoy40pl5k7xdg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,7.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_902vlejb43blnu','vw_kp06e9c28s4531','cl_fu4d3tdkojkihq','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,12.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_9v8cji3w0uvvt4','vw_kp06e9c28s4531','cl_rrp6yxgieh1kz0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,8.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_abhkt3gu04zyk5','vw_r2fyxtu9gny1yu','cl_pbm85tom9ej8o1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_awhlh45cox5bk5','vw_0cwp0eh7j2w0sj','cl_pbm85tom9ej8o1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_d0wx0vhiwf6xpp','vw_0cwp0eh7j2w0sj','cl_jrxkx01ck8k3rs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,3.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_dhfody6o5lcq9o','vw_yjfuvexq9jiuel','cl_jrxkx01ck8k3rs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_eiutwrfh5aauk8','vw_m0uymfk23usf12','cl_q18joopt0ovev4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('nc_em6cfipmqc2115','vw_m0uymfk23usf12','cl_kr40dj7104eis9','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('nc_fqkp0qi0jen14e','vw_w2ic883r1bw3zp','cl_uofshxgieasrmb','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_fudrxij6f3iqjz','vw_yjfuvexq9jiuel','cl_0pfssczng1a9mf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_g4cwc65znof7ni','vw_0cwp0eh7j2w0sj','cl_8cahy77edg5odh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,5.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_ghgcc3zmey2d5k','vw_rn2uzmjddnajp6','cl_0pfssczng1a9mf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_gnhkie48mpy2qn','vw_rn2uzmjddnajp6','cl_jrxkx01ck8k3rs','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,3.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_ix721hr2gvdmhh','vw_w2ic883r1bw3zp','cl_piz68jzu6bkpo7','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_jag1akr9fhe77f','vw_w2ic883r1bw3zp','cl_1zs2ggcj06s92o','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,3.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_jrgo13jxe9653y','vw_kp06e9c28s4531','cl_i5shxg3b6ot0o5','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,20.00,'2023-02-13 13:21:38','2023-02-13 13:21:40'),('nc_k5gy7qg4wdp56z','vw_kp06e9c28s4531','cl_thn2fwlcnhdy81','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,13.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_l11uztptmkps98','vw_kp06e9c28s4531','cl_roks3fmhcu7aht','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,14.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_l98z166hh1zhte','vw_kp06e9c28s4531','cl_v5s25ktqvz2ona','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,17.00,'2023-02-13 13:21:39','2023-02-13 13:21:40'),('nc_lddgkxej1mhyoi','vw_kjggqdazx92inj','cl_epypq0k15jopob','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,5.00,'2023-02-13 13:21:39','2023-02-13 13:21:41'),('nc_levfd43ykwksky','vw_w2ic883r1bw3zp','cl_umoy40pl5k7xdg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,7.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_m8rc7bkhoaew60','vw_kp06e9c28s4531','cl_ym94hdk5d0slso','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_mjdz4w3bwu257p','vw_rn2uzmjddnajp6','cl_pbm85tom9ej8o1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_n1k2micqfff91i','vw_kp06e9c28s4531','cl_vltfj7iq9n8s82','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,6.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_n4ycxo607ry3jp','vw_w2ic883r1bw3zp','cl_t57vyfdrwh3qy0','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,7.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_nm2z49y52nf5v3','vw_kjggqdazx92inj','cl_uofshxgieasrmb','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_o1t8lz0m9cqe0p','vw_kjggqdazx92inj','cl_evby555os6s87a','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_o9mlavk2dzy0gw','vw_m0uymfk23usf12','cl_6j2c4u80qkicrn','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('nc_oyaoewr3guyuya','vw_kp06e9c28s4531','cl_fuxwap6zxz7mq2','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,3.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_q68kxpjwdf6iwl','vw_kjggqdazx92inj','cl_piz68jzu6bkpo7','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_qinhmtv3f7avjr','vw_0cwp0eh7j2w0sj','cl_4zfo6wk5855ppm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_rn88g6kpr8tgq1','vw_kp06e9c28s4531','cl_uompf0ryh112pc','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,15.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_ru19rpdb43xww0','vw_kp06e9c28s4531','cl_emh6h3xorqflvy','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,9.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_ruepynq51dvmin','vw_yjfuvexq9jiuel','cl_pbm85tom9ej8o1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,4.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_s5gmc7rx9fymcl','vw_0cwp0eh7j2w0sj','cl_jeewz056vnwx0k','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_s5x7g50x2xv3u5','vw_w2ic883r1bw3zp','cl_epypq0k15jopob','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,5.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_sqn7tmlybzlt10','vw_yjfuvexq9jiuel','cl_4zfo6wk5855ppm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_svtak7xbdm7pmt','vw_0cwp0eh7j2w0sj','cl_0pfssczng1a9mf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('nc_t19xr6nm29psoa','vw_kjggqdazx92inj','cl_1zs2ggcj06s92o','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:41'),('nc_tes2z8khn24s9g','vw_rn2uzmjddnajp6','cl_4zfo6wk5855ppm','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_tsveu1czb3weey','vw_kp06e9c28s4531','cl_6zowm2vxblwms4','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,21.00,'2023-02-13 13:21:38','2023-02-13 13:21:40'),('nc_ua5ix2i6so1p62','vw_kp06e9c28s4531','cl_b2gz24q6qjr3qr','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,10.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_uo1hyoadqub48h','vw_r2fyxtu9gny1yu','cl_0pfssczng1a9mf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_v75ijz2u9wzmmc','vw_r2fyxtu9gny1yu','cl_8cahy77edg5odh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,5.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('nc_wnp8sa0kzhhi3q','vw_rn2uzmjddnajp6','cl_8cahy77edg5odh','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,5.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('nc_x2wk8xbd1kfnwj','vw_kp06e9c28s4531','cl_k0mlvez2byv7h1','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:37','2023-02-13 13:21:40'),('nc_xti5qymwjlocem','vw_yjfuvexq9jiuel','cl_jeewz056vnwx0k','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',0,6.00,'2023-02-13 13:21:38','2023-02-13 13:21:43'),('nc_yvcfoleu1z5q5t','vw_w2ic883r1bw3zp','cl_rjwrppaoc25v53','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,1.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('nc_yvvg4yuyqlvuel','vw_kp06e9c28s4531','cl_8gy9ckj926s41s','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,18.00,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('nc_yxdxkqoryxiv1m','vw_w2ic883r1bw3zp','cl_evby555os6s87a','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,NULL,NULL,'200px',1,2.00,'2023-02-13 13:21:42','2023-02-13 13:21:42');
/*!40000 ALTER TABLE `nc_grid_view_columns_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_grid_view_v2`
--

DROP TABLE IF EXISTS `nc_grid_view_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_grid_view_v2` (
  `fk_view_id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fk_view_id`),
  CONSTRAINT `nc_grid_view_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_grid_view_v2`
--

LOCK TABLES `nc_grid_view_v2` WRITE;
/*!40000 ALTER TABLE `nc_grid_view_v2` DISABLE KEYS */;
INSERT INTO `nc_grid_view_v2` VALUES ('vw_0cwp0eh7j2w0sj','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('vw_kjggqdazx92inj','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('vw_kp06e9c28s4531','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('vw_m0uymfk23usf12','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('vw_r2fyxtu9gny1yu','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('vw_rn2uzmjddnajp6','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('vw_w2ic883r1bw3zp','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('vw_yjfuvexq9jiuel','ds_h9mnbtiglsiddj','p_4d1tukupf1njth',NULL,'2023-02-13 13:21:38','2023-02-13 13:21:38');
/*!40000 ALTER TABLE `nc_grid_view_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_hook_logs_v2`
--

DROP TABLE IF EXISTS `nc_hook_logs_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_hook_logs_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_hook_id` varchar(20) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `event` varchar(255) DEFAULT NULL,
  `operation` varchar(255) DEFAULT NULL,
  `test_call` tinyint(1) DEFAULT '1',
  `payload` text,
  `conditions` text,
  `notification` text,
  `error_code` varchar(255) DEFAULT NULL,
  `error_message` varchar(255) DEFAULT NULL,
  `error` text,
  `execution_time` int DEFAULT NULL,
  `response` varchar(255) DEFAULT NULL,
  `triggered_by` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_hook_logs_v2`
--

LOCK TABLES `nc_hook_logs_v2` WRITE;
/*!40000 ALTER TABLE `nc_hook_logs_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_hook_logs_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_hooks`
--

DROP TABLE IF EXISTS `nc_hooks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_hooks` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `env` varchar(255) DEFAULT 'all',
  `tn` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `event` varchar(255) DEFAULT NULL,
  `operation` varchar(255) DEFAULT NULL,
  `async` tinyint(1) DEFAULT '0',
  `payload` tinyint(1) DEFAULT '1',
  `url` text,
  `headers` text,
  `condition` text,
  `notification` text,
  `retries` int DEFAULT '0',
  `retry_interval` int DEFAULT '60000',
  `timeout` int DEFAULT '60000',
  `active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_hooks`
--

LOCK TABLES `nc_hooks` WRITE;
/*!40000 ALTER TABLE `nc_hooks` DISABLE KEYS */;
INSERT INTO `nc_hooks` VALUES (1,NULL,'db',NULL,NULL,'all',NULL,'AUTH_MIDDLEWARE',NULL,NULL,0,1,NULL,NULL,NULL,NULL,0,60000,60000,1,NULL,NULL);
/*!40000 ALTER TABLE `nc_hooks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_hooks_v2`
--

DROP TABLE IF EXISTS `nc_hooks_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_hooks_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_model_id` varchar(20) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `env` varchar(255) DEFAULT 'all',
  `type` varchar(255) DEFAULT NULL,
  `event` varchar(255) DEFAULT NULL,
  `operation` varchar(255) DEFAULT NULL,
  `async` tinyint(1) DEFAULT '0',
  `payload` tinyint(1) DEFAULT '1',
  `url` text,
  `headers` text,
  `condition` tinyint(1) DEFAULT '0',
  `notification` text,
  `retries` int DEFAULT '0',
  `retry_interval` int DEFAULT '60000',
  `timeout` int DEFAULT '60000',
  `active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_hooks_v2_fk_model_id_foreign` (`fk_model_id`),
  CONSTRAINT `nc_hooks_v2_fk_model_id_foreign` FOREIGN KEY (`fk_model_id`) REFERENCES `nc_models_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_hooks_v2`
--

LOCK TABLES `nc_hooks_v2` WRITE;
/*!40000 ALTER TABLE `nc_hooks_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_hooks_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_kanban_view_columns_v2`
--

DROP TABLE IF EXISTS `nc_kanban_view_columns_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_kanban_view_columns_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `label` varchar(255) DEFAULT NULL,
  `help` varchar(255) DEFAULT NULL,
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_kanban_view_columns_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_kanban_view_columns_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_kanban_view_columns_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_kanban_view_columns_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_kanban_view_v2` (`fk_view_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_kanban_view_columns_v2`
--

LOCK TABLES `nc_kanban_view_columns_v2` WRITE;
/*!40000 ALTER TABLE `nc_kanban_view_columns_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_kanban_view_columns_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_kanban_view_v2`
--

DROP TABLE IF EXISTS `nc_kanban_view_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_kanban_view_v2` (
  `fk_view_id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `public` tinyint(1) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `show_all_fields` tinyint(1) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`fk_view_id`),
  CONSTRAINT `nc_kanban_view_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_kanban_view_v2`
--

LOCK TABLES `nc_kanban_view_v2` WRITE;
/*!40000 ALTER TABLE `nc_kanban_view_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_kanban_view_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_loaders`
--

DROP TABLE IF EXISTS `nc_loaders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_loaders` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `parent` varchar(255) DEFAULT NULL,
  `child` varchar(255) DEFAULT NULL,
  `relation` varchar(255) DEFAULT NULL,
  `resolver` varchar(255) DEFAULT NULL,
  `functions` text,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_loaders`
--

LOCK TABLES `nc_loaders` WRITE;
/*!40000 ALTER TABLE `nc_loaders` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_loaders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_migrations`
--

DROP TABLE IF EXISTS `nc_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `up` text,
  `down` text,
  `title` varchar(255) NOT NULL,
  `title_down` varchar(255) DEFAULT NULL,
  `description` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `checksum` varchar(255) DEFAULT NULL,
  `status` int DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_migrations`
--

LOCK TABLES `nc_migrations` WRITE;
/*!40000 ALTER TABLE `nc_migrations` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_models`
--

DROP TABLE IF EXISTS `nc_models`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_models` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `alias` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT 'table',
  `meta` mediumtext,
  `schema` text,
  `schema_previous` text,
  `services` mediumtext,
  `messages` text,
  `enabled` tinyint(1) DEFAULT '1',
  `parent_model_title` varchar(255) DEFAULT NULL,
  `show_as` varchar(255) DEFAULT 'table',
  `query_params` mediumtext,
  `list_idx` int DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `pinned` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `mm` int DEFAULT NULL,
  `m_to_m_meta` text,
  `order` float(8,2) unsigned DEFAULT NULL,
  `view_order` float(8,2) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nc_models_db_alias_title_index` (`db_alias`,`title`),
  KEY `nc_models_order_index` (`order`),
  KEY `nc_models_view_order_index` (`view_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_models`
--

LOCK TABLES `nc_models` WRITE;
/*!40000 ALTER TABLE `nc_models` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_models` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_models_v2`
--

DROP TABLE IF EXISTS `nc_models_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_models_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `table_name` varchar(255) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT 'table',
  `meta` mediumtext,
  `schema` text,
  `enabled` tinyint(1) DEFAULT '1',
  `mm` tinyint(1) DEFAULT '0',
  `tags` varchar(255) DEFAULT NULL,
  `pinned` tinyint(1) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_models_v2_base_id_foreign` (`base_id`),
  KEY `nc_models_v2_project_id_foreign` (`project_id`),
  CONSTRAINT `nc_models_v2_base_id_foreign` FOREIGN KEY (`base_id`) REFERENCES `nc_bases_v2` (`id`),
  CONSTRAINT `nc_models_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `nc_projects_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_models_v2`
--

LOCK TABLES `nc_models_v2` WRITE;
/*!40000 ALTER TABLE `nc_models_v2` DISABLE KEYS */;
INSERT INTO `nc_models_v2` VALUES ('md_7qix1x0cjo8kal','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','nc_5bf7___nc_m2m_grcpporlwy','nc_5bf7___nc_m2m_grcpporlwy','table',NULL,NULL,1,1,NULL,NULL,NULL,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('md_ait5ocwdiqf23s','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','nc_5bf7___Film','Film','table',NULL,NULL,1,0,NULL,NULL,NULL,1.00,'2023-02-13 13:21:37','2023-02-13 13:21:37'),('md_ubgh6h4q1y9q7l','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','nc_5bf7___Actor','Actor','table',NULL,NULL,1,0,NULL,NULL,NULL,2.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('md_vskhvehp8f346v','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','nc_5bf7___Producer','Producer','table',NULL,NULL,1,0,NULL,NULL,NULL,3.00,'2023-02-13 13:21:38','2023-02-13 13:21:38');
/*!40000 ALTER TABLE `nc_models_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_orgs_v2`
--

DROP TABLE IF EXISTS `nc_orgs_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_orgs_v2` (
  `id` varchar(20) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_orgs_v2`
--

LOCK TABLES `nc_orgs_v2` WRITE;
/*!40000 ALTER TABLE `nc_orgs_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_orgs_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_plugins`
--

DROP TABLE IF EXISTS `nc_plugins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_plugins` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `title` varchar(45) DEFAULT NULL,
  `description` text,
  `active` tinyint(1) DEFAULT '0',
  `rating` float(8,2) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `docs` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'install',
  `status_details` varchar(255) DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `input_schema` text,
  `input` text,
  `creator` varchar(255) DEFAULT NULL,
  `creator_website` varchar(255) DEFAULT NULL,
  `price` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_plugins`
--

LOCK TABLES `nc_plugins` WRITE;
/*!40000 ALTER TABLE `nc_plugins` DISABLE KEYS */;
INSERT INTO `nc_plugins` VALUES (1,NULL,NULL,'Google','Google OAuth2 login.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/google.png',NULL,'Authentication','Google','{\"title\":\"Configure Google Auth\",\"items\":[{\"key\":\"client_id\",\"label\":\"Client ID\",\"placeholder\":\"Client ID\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"client_secret\",\"label\":\"Client Secret\",\"placeholder\":\"Client Secret\",\"type\":\"Password\",\"required\":true},{\"key\":\"redirect_url\",\"label\":\"Redirect URL\",\"placeholder\":\"Redirect URL\",\"type\":\"SingleLineText\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and configured Google Authentication, restart NocoDB\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,'Free',NULL,NULL),(3,NULL,NULL,'Metadata LRU Cache','A cache object that deletes the least-recently-used items.',1,NULL,'0.0.1',NULL,'install',NULL,'plugins/xgene.png',NULL,'Cache','Cache','{\"title\":\"Configure Metadata LRU Cache\",\"items\":[{\"key\":\"max\",\"label\":\"Maximum Size\",\"placeholder\":\"Maximum Size\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"maxAge\",\"label\":\"Maximum Age(in ms)\",\"placeholder\":\"Maximum Age(in ms)\",\"type\":\"SingleLineText\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully updated LRU cache options.\",\"msgOnUninstall\":\"\"}','{\"max\":500,\"maxAge\":86400000}',NULL,NULL,'Free',NULL,NULL);
/*!40000 ALTER TABLE `nc_plugins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_plugins_v2`
--

DROP TABLE IF EXISTS `nc_plugins_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_plugins_v2` (
  `id` varchar(20) NOT NULL,
  `title` varchar(45) DEFAULT NULL,
  `description` text,
  `active` tinyint(1) DEFAULT '0',
  `rating` float(8,2) DEFAULT NULL,
  `version` varchar(255) DEFAULT NULL,
  `docs` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT 'install',
  `status_details` varchar(255) DEFAULT NULL,
  `logo` varchar(255) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `tags` varchar(255) DEFAULT NULL,
  `category` varchar(255) DEFAULT NULL,
  `input_schema` text,
  `input` text,
  `creator` varchar(255) DEFAULT NULL,
  `creator_website` varchar(255) DEFAULT NULL,
  `price` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_plugins_v2`
--

LOCK TABLES `nc_plugins_v2` WRITE;
/*!40000 ALTER TABLE `nc_plugins_v2` DISABLE KEYS */;
INSERT INTO `nc_plugins_v2` VALUES ('nc_1ycx3pjb3jfehv','UpCloud Object Storage','The perfect home for your data. Thanks to the S3-compatible programmable interface,\nyou have a host of options for existing tools and code implementations.\n',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/upcloud.png',NULL,'Storage','Storage','{\"title\":\"Configure UpCloud Object Storage\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"endpoint\",\"label\":\"Endpoint\",\"placeholder\":\"Endpoint\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in UpCloud Object Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_3szxygrt8evjgf','Twilio','With Twilio, unite communications and strengthen customer relationships across your business – from marketing and sales to customer service and operations.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/twilio.png',NULL,'Chat','Twilio','{\"title\":\"Configure Twilio\",\"items\":[{\"key\":\"sid\",\"label\":\"Account SID\",\"placeholder\":\"Account SID\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"token\",\"label\":\"Auth Token\",\"placeholder\":\"Auth Token\",\"type\":\"Password\",\"required\":true},{\"key\":\"from\",\"label\":\"From Phone Number\",\"placeholder\":\"From Phone Number\",\"type\":\"SingleLineText\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Twilio is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_92704s9o4l6pjd','OvhCloud Object Storage','Upload your files to a space that you can access via HTTPS using the OpenStack Swift API, or the S3 API. ',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/ovhCloud.png',NULL,'Storage','Storage','{\"title\":\"Configure OvhCloud Object Storage\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in OvhCloud Object Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_983idcbk8f02mr','Linode Object Storage','S3-compatible Linode Object Storage makes it easy and more affordable to manage unstructured data such as content assets, as well as sophisticated and data-intensive storage challenges around artificial intelligence and machine learning.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/linode.svg',NULL,'Storage','Storage','{\"title\":\"Configure Linode Object Storage\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in Linode Object Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_bmupl3q959o9on','Slack','Slack brings team communication and collaboration into one place so you can get more work done, whether you belong to a large enterprise or a small business. ',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/slack.webp',NULL,'Chat','Chat','{\"title\":\"Configure Slack\",\"array\":true,\"items\":[{\"key\":\"channel\",\"label\":\"Channel Name\",\"placeholder\":\"Channel Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"webhook_url\",\"label\":\"Webhook URL\",\"placeholder\":\"Webhook URL\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Slack is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_c1je3czwh7zxys','SMTP','SMTP email client',0,NULL,'0.0.1',NULL,'install',NULL,NULL,NULL,'Email','Email','{\"title\":\"Configure Email SMTP\",\"items\":[{\"key\":\"from\",\"label\":\"From\",\"placeholder\":\"eg: admin@run.com\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"host\",\"label\":\"Host\",\"placeholder\":\"eg: smtp.run.com\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"port\",\"label\":\"Port\",\"placeholder\":\"Port\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"secure\",\"label\":\"Secure\",\"placeholder\":\"Secure\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"ignoreTLS\",\"label\":\"Ignore TLS\",\"placeholder\":\"Ignore TLS\",\"type\":\"Checkbox\",\"required\":false},{\"key\":\"username\",\"label\":\"Username\",\"placeholder\":\"Username\",\"type\":\"SingleLineText\",\"required\":false},{\"key\":\"password\",\"label\":\"Password\",\"placeholder\":\"Password\",\"type\":\"Password\",\"required\":false}],\"actions\":[{\"label\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and email notification will use SMTP configuration\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_ejl2pa6kwqfduk','SES','Amazon Simple Email Service (SES) is a cost-effective, flexible, and scalable email service that enables developers to send mail from within any application.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/aws.png',NULL,'Email','Email','{\"title\":\"Configure Amazon Simple Email Service (SES)\",\"items\":[{\"key\":\"from\",\"label\":\"From\",\"placeholder\":\"From\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and email notification will use Amazon SES\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_i3w492m7w54vwx','Microsoft Teams','Microsoft Teams is for everyone · Instantly go from group chat to video call with the touch of a button.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/teams.ico',NULL,'Chat','Chat','{\"title\":\"Configure Microsoft Teams\",\"array\":true,\"items\":[{\"key\":\"channel\",\"label\":\"Channel Name\",\"placeholder\":\"Channel Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"webhook_url\",\"label\":\"Webhook URL\",\"placeholder\":\"Webhook URL\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Microsoft Teams is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_iuc6i6sdow4722','Scaleway Object Storage','Scaleway Object Storage is an S3-compatible object store from Scaleway Cloud Platform.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/scaleway.png',NULL,'Storage','Storage','{\"title\":\"Setup Scaleway\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket name\",\"placeholder\":\"Bucket name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region of bucket\",\"placeholder\":\"Region of bucket\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed Scaleway Object Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_jcigjdpdnu9hgu','MailerSend','MailerSend email client',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/mailersend.svg',NULL,'Email','Email','{\"title\":\"Configure MailerSend\",\"items\":[{\"key\":\"api_key\",\"label\":\"API KEy\",\"placeholder\":\"eg: ***************\",\"type\":\"Password\",\"required\":true},{\"key\":\"from\",\"label\":\"From\",\"placeholder\":\"eg: admin@run.com\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"from_name\",\"label\":\"From Name\",\"placeholder\":\"eg: Adam\",\"type\":\"SingleLineText\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and email notification will use MailerSend configuration\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_kj9my54pp3jcgg','Minio','MinIO is a High Performance Object Storage released under Apache License v2.0. It is API compatible with Amazon S3 cloud storage service.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/minio.png',NULL,'Storage','Storage','{\"title\":\"Configure Minio\",\"items\":[{\"key\":\"endPoint\",\"label\":\"Minio Endpoint\",\"placeholder\":\"Minio Endpoint\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"port\",\"label\":\"Port\",\"placeholder\":\"Port\",\"type\":\"Number\",\"required\":true},{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true},{\"key\":\"useSSL\",\"label\":\"Use SSL\",\"placeholder\":\"Use SSL\",\"type\":\"Checkbox\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in Minio\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_km1noqerocmiil','Whatsapp Twilio','With Twilio, unite communications and strengthen customer relationships across your business – from marketing and sales to customer service and operations.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/whatsapp.png',NULL,'Chat','Twilio','{\"title\":\"Configure Twilio\",\"items\":[{\"key\":\"sid\",\"label\":\"Account SID\",\"placeholder\":\"Account SID\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"token\",\"label\":\"Auth Token\",\"placeholder\":\"Auth Token\",\"type\":\"Password\",\"required\":true},{\"key\":\"from\",\"label\":\"From Phone Number\",\"placeholder\":\"From Phone Number\",\"type\":\"SingleLineText\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Whatsapp Twilio is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_n5iggpmuw2jpic','Mattermost','Mattermost brings all your team communication into one place, making it searchable and accessible anywhere.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/mattermost.png',NULL,'Chat','Chat','{\"title\":\"Configure Mattermost\",\"array\":true,\"items\":[{\"key\":\"channel\",\"label\":\"Channel Name\",\"placeholder\":\"Channel Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"webhook_url\",\"label\":\"Webhook URL\",\"placeholder\":\"Webhook URL\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Mattermost is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_nx3vp1eqivyry6','GCS','Google Cloud Storage is a RESTful online file storage web service for storing and accessing data on Google Cloud Platform infrastructure.',0,NULL,'0.0.2',NULL,'install',NULL,'plugins/gcs.png',NULL,'Storage','Storage','{\"title\":\"Configure Google Cloud Storage\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"client_email\",\"label\":\"Client Email\",\"placeholder\":\"Client Email\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"private_key\",\"label\":\"Private Key\",\"placeholder\":\"Private Key\",\"type\":\"Password\",\"required\":true},{\"key\":\"project_id\",\"label\":\"Project ID\",\"placeholder\":\"Project ID\",\"type\":\"SingleLineText\",\"required\":false}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in Google Cloud Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_plkjkymbztl9ti','Backblaze B2','Backblaze B2 is enterprise-grade, S3 compatible storage that companies around the world use to store and serve data while improving their cloud OpEx vs. Amazon S3 and others.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/backblaze.jpeg',NULL,'Storage','Storage','{\"title\":\"Configure Backblaze B2\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in Backblaze B2\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_rphp4nuugjljoe','S3','Amazon Simple Storage Service (Amazon S3) is an object storage service that offers industry-leading scalability, data availability, security, and performance.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/s3.png',NULL,'Storage','Storage','{\"title\":\"Configure Amazon S3\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in AWS S3\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_tb9go9zgblouio','Discord','Discord is the easiest way to talk over voice, video, and text. Talk, chat, hang out, and stay close with your friends and communities.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/discord.png',NULL,'Chat','Chat','{\"title\":\"Configure Discord\",\"array\":true,\"items\":[{\"key\":\"channel\",\"label\":\"Channel Name\",\"placeholder\":\"Channel Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"webhook_url\",\"label\":\"Webhook URL\",\"type\":\"Password\",\"placeholder\":\"Webhook URL\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and Discord is enabled for notification.\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_ydrmt361gc4bar','Spaces','Store & deliver vast amounts of content with a simple architecture.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/spaces.png',NULL,'Storage','Storage','{\"title\":\"DigitalOcean Spaces\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"region\",\"label\":\"Region\",\"placeholder\":\"Region\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in DigitalOcean Spaces\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),('nc_zr0wpsl0rl7xo6','Vultr Object Storage','Using Vultr Object Storage can give flexibility and cloud storage that allows applications greater flexibility and access worldwide.',0,NULL,'0.0.1',NULL,'install',NULL,'plugins/vultr.png',NULL,'Storage','Storage','{\"title\":\"Configure Vultr Object Storage\",\"items\":[{\"key\":\"bucket\",\"label\":\"Bucket Name\",\"placeholder\":\"Bucket Name\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_key\",\"label\":\"Access Key\",\"placeholder\":\"Access Key\",\"type\":\"SingleLineText\",\"required\":true},{\"key\":\"access_secret\",\"label\":\"Access Secret\",\"placeholder\":\"Access Secret\",\"type\":\"Password\",\"required\":true}],\"actions\":[{\"label\":\"Test\",\"placeholder\":\"Test\",\"key\":\"test\",\"actionType\":\"TEST\",\"type\":\"Button\"},{\"label\":\"Save\",\"placeholder\":\"Save\",\"key\":\"save\",\"actionType\":\"SUBMIT\",\"type\":\"Button\"}],\"msgOnInstall\":\"Successfully installed and attachment will be stored in Vultr Object Storage\",\"msgOnUninstall\":\"\"}',NULL,NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40');
/*!40000 ALTER TABLE `nc_plugins_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_project_users_v2`
--

DROP TABLE IF EXISTS `nc_project_users_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_project_users_v2` (
  `project_id` varchar(128) DEFAULT NULL,
  `fk_user_id` varchar(20) DEFAULT NULL,
  `roles` text,
  `starred` tinyint(1) DEFAULT NULL,
  `pinned` tinyint(1) DEFAULT NULL,
  `group` varchar(255) DEFAULT NULL,
  `color` varchar(255) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `hidden` float(8,2) DEFAULT NULL,
  `opened_date` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `nc_project_users_v2_project_id_foreign` (`project_id`),
  KEY `nc_project_users_v2_fk_user_id_foreign` (`fk_user_id`),
  CONSTRAINT `nc_project_users_v2_fk_user_id_foreign` FOREIGN KEY (`fk_user_id`) REFERENCES `nc_users_v2` (`id`),
  CONSTRAINT `nc_project_users_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `nc_projects_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_project_users_v2`
--

LOCK TABLES `nc_project_users_v2` WRITE;
/*!40000 ALTER TABLE `nc_project_users_v2` DISABLE KEYS */;
INSERT INTO `nc_project_users_v2` VALUES ('p_4d1tukupf1njth','us_4ubhyt5npdeyyu','owner',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:20:32','2023-02-13 13:20:32'),('p_4d1tukupf1njth','us_aqnwxjt1a58rec','creator',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39'),('p_4d1tukupf1njth','us_j7tl3yrjofd9rx','owner',NULL,NULL,NULL,NULL,NULL,NULL,NULL,'2023-02-13 13:21:39','2023-02-13 13:21:39');
/*!40000 ALTER TABLE `nc_project_users_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_projects`
--

DROP TABLE IF EXISTS `nc_projects`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_projects` (
  `id` varchar(128) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `description` text,
  `config` text,
  `meta` text,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_projects`
--

LOCK TABLES `nc_projects` WRITE;
/*!40000 ALTER TABLE `nc_projects` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_projects` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_projects_users`
--

DROP TABLE IF EXISTS `nc_projects_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_projects_users` (
  `project_id` varchar(255) DEFAULT NULL,
  `user_id` int unsigned DEFAULT NULL,
  `roles` text,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  KEY `nc_projects_users_project_id_index` (`project_id`),
  KEY `nc_projects_users_user_id_index` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_projects_users`
--

LOCK TABLES `nc_projects_users` WRITE;
/*!40000 ALTER TABLE `nc_projects_users` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_projects_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_projects_v2`
--

DROP TABLE IF EXISTS `nc_projects_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_projects_v2` (
  `id` varchar(128) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `prefix` varchar(255) DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `description` text,
  `meta` text,
  `color` varchar(255) DEFAULT NULL,
  `uuid` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `roles` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT '0',
  `is_meta` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_projects_v2`
--

LOCK TABLES `nc_projects_v2` WRITE;
/*!40000 ALTER TABLE `nc_projects_v2` DISABLE KEYS */;
INSERT INTO `nc_projects_v2` VALUES ('p_4d1tukupf1njth','sample','nc_5bf7__',NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,1,NULL,'2023-02-13 13:20:32','2023-02-13 13:20:32');
/*!40000 ALTER TABLE `nc_projects_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_relations`
--

DROP TABLE IF EXISTS `nc_relations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_relations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `tn` varchar(255) DEFAULT NULL,
  `rtn` varchar(255) DEFAULT NULL,
  `_tn` varchar(255) DEFAULT NULL,
  `_rtn` varchar(255) DEFAULT NULL,
  `cn` varchar(255) DEFAULT NULL,
  `rcn` varchar(255) DEFAULT NULL,
  `_cn` varchar(255) DEFAULT NULL,
  `_rcn` varchar(255) DEFAULT NULL,
  `referenced_db_alias` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `db_type` varchar(255) DEFAULT NULL,
  `ur` varchar(255) DEFAULT NULL,
  `dr` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `fkn` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nc_relations_db_alias_tn_index` (`db_alias`,`tn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_relations`
--

LOCK TABLES `nc_relations` WRITE;
/*!40000 ALTER TABLE `nc_relations` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_relations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_resolvers`
--

DROP TABLE IF EXISTS `nc_resolvers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_resolvers` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `resolver` text,
  `type` varchar(255) DEFAULT NULL,
  `acl` text,
  `functions` text,
  `handler_type` int DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_resolvers`
--

LOCK TABLES `nc_resolvers` WRITE;
/*!40000 ALTER TABLE `nc_resolvers` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_resolvers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_roles`
--

DROP TABLE IF EXISTS `nc_roles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_roles` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT 'CUSTOM',
  `description` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_roles`
--

LOCK TABLES `nc_roles` WRITE;
/*!40000 ALTER TABLE `nc_roles` DISABLE KEYS */;
INSERT INTO `nc_roles` VALUES (1,'','','owner','SYSTEM','Can add/remove creators. And full edit database structures & fields.',NULL,NULL),(2,'','','creator','SYSTEM','Can fully edit database structure & values',NULL,NULL),(3,'','','editor','SYSTEM','Can edit records but cannot change structure of database/fields',NULL,NULL),(4,'','','commenter','SYSTEM','Can view and comment the records but cannot edit anything',NULL,NULL),(5,'','','viewer','SYSTEM','Can view the records but cannot edit anything',NULL,NULL);
/*!40000 ALTER TABLE `nc_roles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_routes`
--

DROP TABLE IF EXISTS `nc_routes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_routes` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `tn` varchar(255) DEFAULT NULL,
  `tnp` varchar(255) DEFAULT NULL,
  `tnc` varchar(255) DEFAULT NULL,
  `relation_type` varchar(255) DEFAULT NULL,
  `path` text,
  `type` varchar(255) DEFAULT NULL,
  `handler` text,
  `acl` text,
  `order` int DEFAULT NULL,
  `functions` text,
  `handler_type` int DEFAULT '1',
  `is_custom` tinyint(1) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nc_routes_db_alias_title_tn_index` (`db_alias`,`title`,`tn`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_routes`
--

LOCK TABLES `nc_routes` WRITE;
/*!40000 ALTER TABLE `nc_routes` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_routes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_rpc`
--

DROP TABLE IF EXISTS `nc_rpc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_rpc` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `title` varchar(255) DEFAULT NULL,
  `tn` varchar(255) DEFAULT NULL,
  `service` text,
  `tnp` varchar(255) DEFAULT NULL,
  `tnc` varchar(255) DEFAULT NULL,
  `relation_type` varchar(255) DEFAULT NULL,
  `order` int DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `acl` text,
  `functions` text,
  `handler_type` int DEFAULT '1',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_rpc`
--

LOCK TABLES `nc_rpc` WRITE;
/*!40000 ALTER TABLE `nc_rpc` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_rpc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_shared_bases`
--

DROP TABLE IF EXISTS `nc_shared_bases`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_shared_bases` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `roles` varchar(255) DEFAULT 'viewer',
  `shared_base_id` varchar(255) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `password` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_shared_bases`
--

LOCK TABLES `nc_shared_bases` WRITE;
/*!40000 ALTER TABLE `nc_shared_bases` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_shared_bases` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_shared_views`
--

DROP TABLE IF EXISTS `nc_shared_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_shared_views` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT NULL,
  `model_name` varchar(255) DEFAULT NULL,
  `meta` mediumtext,
  `query_params` mediumtext,
  `view_id` varchar(255) DEFAULT NULL,
  `show_all_fields` tinyint(1) DEFAULT NULL,
  `allow_copy` tinyint(1) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `view_type` varchar(255) DEFAULT NULL,
  `view_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_shared_views`
--

LOCK TABLES `nc_shared_views` WRITE;
/*!40000 ALTER TABLE `nc_shared_views` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_shared_views` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_shared_views_v2`
--

DROP TABLE IF EXISTS `nc_shared_views_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_shared_views_v2` (
  `id` varchar(20) NOT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `meta` mediumtext,
  `query_params` mediumtext,
  `view_id` varchar(255) DEFAULT NULL,
  `show_all_fields` tinyint(1) DEFAULT NULL,
  `allow_copy` tinyint(1) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `deleted` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_shared_views_v2_fk_view_id_foreign` (`fk_view_id`),
  CONSTRAINT `nc_shared_views_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_shared_views_v2`
--

LOCK TABLES `nc_shared_views_v2` WRITE;
/*!40000 ALTER TABLE `nc_shared_views_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_shared_views_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_sort_v2`
--

DROP TABLE IF EXISTS `nc_sort_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_sort_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_view_id` varchar(20) DEFAULT NULL,
  `fk_column_id` varchar(20) DEFAULT NULL,
  `direction` varchar(255) DEFAULT 'false',
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_sort_v2_fk_view_id_foreign` (`fk_view_id`),
  KEY `nc_sort_v2_fk_column_id_foreign` (`fk_column_id`),
  CONSTRAINT `nc_sort_v2_fk_column_id_foreign` FOREIGN KEY (`fk_column_id`) REFERENCES `nc_columns_v2` (`id`),
  CONSTRAINT `nc_sort_v2_fk_view_id_foreign` FOREIGN KEY (`fk_view_id`) REFERENCES `nc_views_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_sort_v2`
--

LOCK TABLES `nc_sort_v2` WRITE;
/*!40000 ALTER TABLE `nc_sort_v2` DISABLE KEYS */;
INSERT INTO `nc_sort_v2` VALUES ('so_06lug03km3px87','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','vw_w2ic883r1bw3zp','cl_rjwrppaoc25v53','asc',1.00,'2023-02-13 13:21:42','2023-02-13 13:21:42');
/*!40000 ALTER TABLE `nc_sort_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_store`
--

DROP TABLE IF EXISTS `nc_store`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_store` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `project_id` varchar(255) DEFAULT NULL,
  `db_alias` varchar(255) DEFAULT 'db',
  `key` varchar(255) DEFAULT NULL,
  `value` text,
  `type` varchar(255) DEFAULT NULL,
  `env` varchar(255) DEFAULT NULL,
  `tag` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `nc_store_key_index` (`key`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_store`
--

LOCK TABLES `nc_store` WRITE;
/*!40000 ALTER TABLE `nc_store` DISABLE KEYS */;
INSERT INTO `nc_store` VALUES (1,NULL,'','NC_DEBUG','{\"nc:app\":false,\"nc:api:rest\":false,\"nc:api:base\":false,\"nc:api:gql\":false,\"nc:api:grpc\":false,\"nc:migrator\":false,\"nc:datamapper\":false}',NULL,NULL,NULL,NULL,NULL),(2,NULL,'','NC_PROJECT_COUNT','0',NULL,NULL,NULL,NULL,NULL),(3,'','','nc_auth_jwt_secret','7cfce825-7a23-4c1d-a267-4485bc0121b9',NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),(4,'','','nc_server_id','6f06d97c2c27dd051c8dbb7dac19e082d64b4c0ebe8cb0487c473ad81f5f573e',NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40'),(5,'','','NC_CONFIG_MAIN','{\"version\":\"0090000\"}',NULL,NULL,NULL,'2023-02-13 13:19:40','2023-02-13 13:19:40');
/*!40000 ALTER TABLE `nc_store` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_sync_logs_v2`
--

DROP TABLE IF EXISTS `nc_sync_logs_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_sync_logs_v2` (
  `id` varchar(20) NOT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_sync_source_id` varchar(20) DEFAULT NULL,
  `time_taken` int DEFAULT NULL,
  `status` varchar(255) DEFAULT NULL,
  `status_details` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_sync_logs_v2`
--

LOCK TABLES `nc_sync_logs_v2` WRITE;
/*!40000 ALTER TABLE `nc_sync_logs_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_sync_logs_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_sync_source_v2`
--

DROP TABLE IF EXISTS `nc_sync_source_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_sync_source_v2` (
  `id` varchar(20) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `type` varchar(255) DEFAULT NULL,
  `details` text,
  `deleted` tinyint(1) DEFAULT NULL,
  `enabled` tinyint(1) DEFAULT '1',
  `order` float(8,2) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_user_id` varchar(128) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_sync_source_v2_project_id_foreign` (`project_id`),
  KEY `nc_sync_source_v2_fk_user_id_foreign` (`fk_user_id`),
  CONSTRAINT `nc_sync_source_v2_fk_user_id_foreign` FOREIGN KEY (`fk_user_id`) REFERENCES `nc_users_v2` (`id`),
  CONSTRAINT `nc_sync_source_v2_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `nc_projects_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_sync_source_v2`
--

LOCK TABLES `nc_sync_source_v2` WRITE;
/*!40000 ALTER TABLE `nc_sync_source_v2` DISABLE KEYS */;
INSERT INTO `nc_sync_source_v2` VALUES ('nc_d408ga5ktypghy',NULL,'Airtable','{\"syncInterval\":\"15mins\",\"syncDirection\":\"Airtable to NocoDB\",\"syncRetryCount\":1,\"apiKey\":\"keyn1MR87qgyUsYg4\",\"shareId\":\"shr4z0qmh6dg5s3eB\",\"options\":{\"syncViews\":true,\"syncData\":true,\"syncRollup\":true,\"syncLookup\":true,\"syncFormula\":false,\"syncAttachment\":true}}',NULL,1,NULL,'p_4d1tukupf1njth','us_4ubhyt5npdeyyu','2023-02-13 13:21:33','2023-02-13 13:21:33');
/*!40000 ALTER TABLE `nc_sync_source_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_team_users_v2`
--

DROP TABLE IF EXISTS `nc_team_users_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_team_users_v2` (
  `org_id` varchar(20) DEFAULT NULL,
  `user_id` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `nc_team_users_v2_org_id_foreign` (`org_id`),
  KEY `nc_team_users_v2_user_id_foreign` (`user_id`),
  CONSTRAINT `nc_team_users_v2_org_id_foreign` FOREIGN KEY (`org_id`) REFERENCES `nc_orgs_v2` (`id`),
  CONSTRAINT `nc_team_users_v2_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `nc_users_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_team_users_v2`
--

LOCK TABLES `nc_team_users_v2` WRITE;
/*!40000 ALTER TABLE `nc_team_users_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_team_users_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_teams_v2`
--

DROP TABLE IF EXISTS `nc_teams_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_teams_v2` (
  `id` varchar(20) NOT NULL,
  `title` varchar(255) DEFAULT NULL,
  `org_id` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_teams_v2_org_id_foreign` (`org_id`),
  CONSTRAINT `nc_teams_v2_org_id_foreign` FOREIGN KEY (`org_id`) REFERENCES `nc_orgs_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_teams_v2`
--

LOCK TABLES `nc_teams_v2` WRITE;
/*!40000 ALTER TABLE `nc_teams_v2` DISABLE KEYS */;
/*!40000 ALTER TABLE `nc_teams_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_users_v2`
--

DROP TABLE IF EXISTS `nc_users_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_users_v2` (
  `id` varchar(20) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `salt` varchar(255) DEFAULT NULL,
  `firstname` varchar(255) DEFAULT NULL,
  `lastname` varchar(255) DEFAULT NULL,
  `username` varchar(255) DEFAULT NULL,
  `refresh_token` varchar(255) DEFAULT NULL,
  `invite_token` varchar(255) DEFAULT NULL,
  `invite_token_expires` varchar(255) DEFAULT NULL,
  `reset_password_expires` timestamp NULL DEFAULT NULL,
  `reset_password_token` varchar(255) DEFAULT NULL,
  `email_verification_token` varchar(255) DEFAULT NULL,
  `email_verified` tinyint(1) DEFAULT NULL,
  `roles` varchar(255) DEFAULT 'editor',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `token_version` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_users_v2`
--

LOCK TABLES `nc_users_v2` WRITE;
/*!40000 ALTER TABLE `nc_users_v2` DISABLE KEYS */;
INSERT INTO `nc_users_v2` VALUES ('us_4ubhyt5npdeyyu','user@nocodb.com','$2a$10$cFJDmNvbGmBmFCM18VD.jeoSwKc3QykgByU8MpkIQ2OJkLsKxnEQG','$2a$10$cFJDmNvbGmBmFCM18VD.je',NULL,NULL,NULL,'d3674e15d897d7aaeed6918d3bd6fd2ba3aec600e5fd69fd08a97ea7fa98aedf645b8c4a72394206',NULL,NULL,NULL,NULL,'5a4081fe-f0a2-4ec6-8e88-1bed57eda008',NULL,'user,super','2023-02-13 13:20:27','2023-02-13 13:20:27','85fe892e5d284493079283fcb5deae06fc33fbb4f5cc71201a45fc067976419a83152a52bd28d863'),('us_aqnwxjt1a58rec','a@b.com',NULL,NULL,NULL,NULL,NULL,NULL,'c5f0f38b-1dfc-4647-a041-a8446edeb242','2023-02-14 18:51:39.285',NULL,NULL,NULL,NULL,'user','2023-02-13 13:21:39','2023-02-13 13:21:39','44fa53cc4142996feb1a4db715a47d97df855ba40be692bed573043ab706d5d2a9b523cd2121ad53'),('us_j7tl3yrjofd9rx','airtable.dummy@gmail.com',NULL,NULL,NULL,NULL,NULL,NULL,'be4a01e3-e2c8-4a6a-989c-9a2fe0868794','2023-02-14 18:51:39.284',NULL,NULL,NULL,NULL,'user','2023-02-13 13:21:39','2023-02-13 13:21:39','a7077758d2cd4fa3e71c41f173572f6dd0dd1fd7439f0104d7252b01b3e13e75d38aa238ea2db0f5');
/*!40000 ALTER TABLE `nc_users_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `nc_views_v2`
--

DROP TABLE IF EXISTS `nc_views_v2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `nc_views_v2` (
  `id` varchar(20) NOT NULL,
  `base_id` varchar(20) DEFAULT NULL,
  `project_id` varchar(128) DEFAULT NULL,
  `fk_model_id` varchar(20) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `type` int DEFAULT NULL,
  `is_default` tinyint(1) DEFAULT NULL,
  `show_system_fields` tinyint(1) DEFAULT NULL,
  `lock_type` varchar(255) DEFAULT 'collaborative',
  `uuid` varchar(255) DEFAULT NULL,
  `password` varchar(255) DEFAULT NULL,
  `show` tinyint(1) DEFAULT NULL,
  `order` float(8,2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `nc_views_v2_fk_model_id_foreign` (`fk_model_id`),
  CONSTRAINT `nc_views_v2_fk_model_id_foreign` FOREIGN KEY (`fk_model_id`) REFERENCES `nc_models_v2` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `nc_views_v2`
--

LOCK TABLES `nc_views_v2` WRITE;
/*!40000 ALTER TABLE `nc_views_v2` DISABLE KEYS */;
INSERT INTO `nc_views_v2` VALUES ('vw_0cwp0eh7j2w0sj','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Grid 3',3,NULL,NULL,'collaborative',NULL,NULL,1,3.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('vw_0n2afljavfxdtn','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','FormTitle',1,NULL,NULL,'collaborative',NULL,NULL,1,2.00,'2023-02-13 13:21:46','2023-02-13 13:21:46'),('vw_1r3c694ch2j1cf','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Gallery 3',2,NULL,NULL,'collaborative',NULL,NULL,1,11.00,'2023-02-13 13:21:54','2023-02-13 13:21:54'),('vw_35blg8fwng91pw','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Form 2',1,NULL,NULL,'collaborative',NULL,NULL,1,6.00,'2023-02-13 13:21:49','2023-02-13 13:21:49'),('vw_fpby7jrdcanlha','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Form 3',1,NULL,NULL,'collaborative',NULL,NULL,1,7.00,'2023-02-13 13:21:50','2023-02-13 13:21:50'),('vw_g1bovqofu6jkrt','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Gallery',2,NULL,NULL,'collaborative',NULL,NULL,1,9.00,'2023-02-13 13:21:52','2023-02-13 13:21:52'),('vw_isske9c4xpwnms','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Form 4',1,NULL,NULL,'collaborative',NULL,NULL,1,8.00,'2023-02-13 13:21:51','2023-02-13 13:21:51'),('vw_kjggqdazx92inj','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Grid view',3,1,NULL,'collaborative',NULL,NULL,1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('vw_kp06e9c28s4531','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ait5ocwdiqf23s','Grid view',3,1,NULL,'collaborative',NULL,NULL,1,1.00,'2023-02-13 13:21:37','2023-02-13 13:21:38'),('vw_le3c5ucb4q0bjg','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Form',1,NULL,NULL,'collaborative',NULL,NULL,1,5.00,'2023-02-13 13:21:48','2023-02-13 13:21:48'),('vw_m0uymfk23usf12','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_7qix1x0cjo8kal','nc_5bf7___nc_m2m_grcpporlwy',3,1,NULL,'collaborative',NULL,NULL,1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:38'),('vw_pu9hmgmaljzeks','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Gallery 2',2,NULL,NULL,'collaborative',NULL,NULL,1,10.00,'2023-02-13 13:21:53','2023-02-13 13:21:53'),('vw_r2fyxtu9gny1yu','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Grid 4',3,NULL,NULL,'collaborative',NULL,NULL,1,4.00,'2023-02-13 13:21:45','2023-02-13 13:21:45'),('vw_rn2uzmjddnajp6','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Grid 2',3,NULL,NULL,'collaborative',NULL,NULL,1,2.00,'2023-02-13 13:21:44','2023-02-13 13:21:44'),('vw_w2ic883r1bw3zp','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_ubgh6h4q1y9q7l','Filter&Sort',3,NULL,NULL,'collaborative',NULL,NULL,1,2.00,'2023-02-13 13:21:42','2023-02-13 13:21:42'),('vw_yjfuvexq9jiuel','ds_h9mnbtiglsiddj','p_4d1tukupf1njth','md_vskhvehp8f346v','Grid view',3,1,NULL,'collaborative',NULL,NULL,1,1.00,'2023-02-13 13:21:38','2023-02-13 13:21:38');
/*!40000 ALTER TABLE `nc_views_v2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xc_knex_migrations`
--

DROP TABLE IF EXISTS `xc_knex_migrations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xc_knex_migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xc_knex_migrations`
--

LOCK TABLES `xc_knex_migrations` WRITE;
/*!40000 ALTER TABLE `xc_knex_migrations` DISABLE KEYS */;
INSERT INTO `xc_knex_migrations` VALUES (1,'project',1,'2023-02-13 18:49:30'),(2,'m2m',1,'2023-02-13 18:49:30'),(3,'fkn',1,'2023-02-13 18:49:30'),(4,'viewType',1,'2023-02-13 18:49:31'),(5,'viewName',1,'2023-02-13 18:49:31'),(6,'nc_006_alter_nc_shared_views',1,'2023-02-13 18:49:31'),(7,'nc_007_alter_nc_shared_views_1',1,'2023-02-13 18:49:31'),(8,'nc_008_add_nc_shared_bases',1,'2023-02-13 18:49:31'),(9,'nc_009_add_model_order',1,'2023-02-13 18:49:31'),(10,'nc_010_add_parent_title_column',1,'2023-02-13 18:49:31'),(11,'nc_011_remove_old_ses_plugin',1,'2023-02-13 18:49:31');
/*!40000 ALTER TABLE `xc_knex_migrations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xc_knex_migrations_lock`
--

DROP TABLE IF EXISTS `xc_knex_migrations_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xc_knex_migrations_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xc_knex_migrations_lock`
--

LOCK TABLES `xc_knex_migrations_lock` WRITE;
/*!40000 ALTER TABLE `xc_knex_migrations_lock` DISABLE KEYS */;
INSERT INTO `xc_knex_migrations_lock` VALUES (1,0);
/*!40000 ALTER TABLE `xc_knex_migrations_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xc_knex_migrationsv2`
--

DROP TABLE IF EXISTS `xc_knex_migrationsv2`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xc_knex_migrationsv2` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) DEFAULT NULL,
  `batch` int DEFAULT NULL,
  `migration_time` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xc_knex_migrationsv2`
--

LOCK TABLES `xc_knex_migrationsv2` WRITE;
/*!40000 ALTER TABLE `xc_knex_migrationsv2` DISABLE KEYS */;
INSERT INTO `xc_knex_migrationsv2` VALUES (1,'nc_011',1,'2023-02-13 18:49:38'),(2,'nc_012_alter_column_data_types',1,'2023-02-13 18:49:39'),(3,'nc_013_sync_source',1,'2023-02-13 18:49:39'),(4,'nc_014_alter_column_data_types',1,'2023-02-13 18:49:40'),(5,'nc_015_add_meta_col_in_column_table',1,'2023-02-13 18:49:40'),(6,'nc_016_alter_hooklog_payload_types',1,'2023-02-13 18:49:40'),(7,'nc_017_add_user_token_version_column',1,'2023-02-13 18:49:40');
/*!40000 ALTER TABLE `xc_knex_migrationsv2` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `xc_knex_migrationsv2_lock`
--

DROP TABLE IF EXISTS `xc_knex_migrationsv2_lock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `xc_knex_migrationsv2_lock` (
  `index` int unsigned NOT NULL AUTO_INCREMENT,
  `is_locked` int DEFAULT NULL,
  PRIMARY KEY (`index`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `xc_knex_migrationsv2_lock`
--

LOCK TABLES `xc_knex_migrationsv2_lock` WRITE;
/*!40000 ALTER TABLE `xc_knex_migrationsv2_lock` DISABLE KEYS */;
INSERT INTO `xc_knex_migrationsv2_lock` VALUES (1,0);
/*!40000 ALTER TABLE `xc_knex_migrationsv2_lock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'meta_v2_2023_02_13'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2023-02-13 18:52:44
