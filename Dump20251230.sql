-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: sga
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `itinerarios`
--

DROP TABLE IF EXISTS `itinerarios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `itinerarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `manifiesto_id` int NOT NULL,
  `port` varchar(80) NOT NULL,
  `port_type` enum('LOAD','DISCHARGE') NOT NULL,
  `eta` datetime DEFAULT NULL,
  `ets` datetime DEFAULT NULL,
  `orden` int NOT NULL DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `fk_itinerarios_manifiestos` (`manifiesto_id`),
  CONSTRAINT `fk_itinerarios_manifiestos` FOREIGN KEY (`manifiesto_id`) REFERENCES `manifiestos` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `itinerarios`
--

LOCK TABLES `itinerarios` WRITE;
/*!40000 ALTER TABLE `itinerarios` DISABLE KEYS */;
INSERT INTO `itinerarios` VALUES (1,2,'VALPARAISO','LOAD','2023-01-01 00:00:00','2025-01-01 00:00:00',1,'2025-12-29 21:03:44'),(2,2,'HONG KONG','DISCHARGE','2025-01-03 00:00:00','2025-01-03 00:00:00',2,'2025-12-29 21:03:44'),(3,2,'GUAM','DISCHARGE','2025-01-03 00:00:00','2025-01-03 00:00:00',3,'2025-12-29 21:03:44');
/*!40000 ALTER TABLE `itinerarios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `manifiestos`
--

DROP TABLE IF EXISTS `manifiestos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `manifiestos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `servicio` varchar(50) NOT NULL,
  `nave` varchar(100) NOT NULL,
  `viaje` varchar(30) NOT NULL,
  `puerto_central` varchar(60) NOT NULL,
  `tipo_operacion` enum('EX','IM','CROSS') NOT NULL,
  `operador_nave` varchar(50) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'En edición',
  `remark` text,
  `emisor_documento` varchar(50) NOT NULL,
  `representante` varchar(80) NOT NULL,
  `fecha_manifiesto_aduana` date NOT NULL,
  `numero_manifiesto_aduana` varchar(40) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `manifiestos`
--

LOCK TABLES `manifiestos` WRITE;
/*!40000 ALTER TABLE `manifiestos` DISABLE KEYS */;
INSERT INTO `manifiestos` VALUES (1,'SWA','EVER FEAT','028W','Valparaíso','EX','OP123','En edición','Primer manifiesto de prueba','EMI456','AJBROOM','2025-11-25','MFT-889922','2025-12-29 18:48:02','2025-12-29 19:01:07'),(2,'SWA','EVER FEAT','029W','Valparaíso','EX','OP123','En edición',NULL,'EMI456','AJBROOM','2025-12-29','MFT-1234','2025-12-29 21:03:44','2025-12-29 21:03:44');
/*!40000 ALTER TABLE `manifiestos` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-30  9:36:19
