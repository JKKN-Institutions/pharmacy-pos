-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: Mar 02, 2026 at 10:14 AM
-- Server version: 8.0.45
-- PHP Version: 8.4.17

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `pmsoftware_pms`
--

-- --------------------------------------------------------

--
-- Table structure for table `ds_suppliers`
--

CREATE TABLE `ds_suppliers` (
  `id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(100) NOT NULL,
  `address` text NOT NULL,
  `user_id` int NOT NULL,
  `date_of_joining` datetime NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;

--
-- Dumping data for table `ds_suppliers`
--

INSERT INTO `ds_suppliers` (`id`, `name`, `email`, `phone`, `address`, `user_id`, `date_of_joining`) VALUES
(1, 'Gaja lakshmi pharma', 'gajalakshmipharma@gmail.com', '1234567890', 'Kumarapalayam', 1, '2023-08-18 22:42:00'),
(2, 'Nandhi Pharma', 'dentalpurchase@jkkn.ac.in', '8903715864', '', 1, '2023-08-21 12:55:05'),
(3, 'RATHNA PHARMA', 'RATHNA@GMAIL.COM', '43243678870', '', 1, '2024-02-14 09:56:31'),
(4, 'VENUS AGENSY', 'VENUS@GMAIL.COM', '897676478', '', 1, '2024-02-14 09:56:57'),
(5, 'SRI AMMAN PHARMA', 'sriamman@gmail.com', '76563978667', '', 1, '2024-02-14 10:49:45'),
(6, 'KVB TRADERS', 'kvbtraders@gmail.com', '765479808908', '', 1, '2024-02-14 10:50:24'),
(7, 'TAMILNADU PHARMA', 'tamilnadupharma@gmail.com', '8657690076576', '', 1, '2024-02-14 10:51:02'),
(8, 'SRI MEDICAL DISTRIBUTOR', 'NIL', '8667473020', 'PALLIPALAYAM', 1, '2024-02-15 12:49:47'),
(9, 'RAGAVENDRA MEDICAL AGENCY', '', '9842031313', 'KPM', 1, '2024-02-16 18:52:12'),
(10, 'SHREE AMMAN AGENCIES  GODOWN', 'bppitnj@gmail.com', '9344110311', 'tnj', 1, '2024-02-22 15:30:20'),
(11, 'SMART MEDICAL AGENCIES', 'NIL', '8807262673', '', 1, '2024-04-16 13:04:30'),
(12, 'SRI VIGNESH MEDICAL AGENCIES', 'svmaerd@gmail.com', '9994954555', '9,POWER HOUSE ROAD, ERODE -638 001.', 1, '2024-12-21 16:36:53'),
(13, 'pandi', 'pandi@gmail.com', '1234567899', 'hgvhghgvh ', 1, '2025-09-10 18:30:45');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `ds_suppliers`
--
ALTER TABLE `ds_suppliers`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `ds_suppliers`
--
ALTER TABLE `ds_suppliers`
  MODIFY `id` int NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=14;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
