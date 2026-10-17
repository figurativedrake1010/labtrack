-- LabTrack Database Schema

CREATE TABLE IF NOT EXISTS equipment (
  id               bigserial PRIMARY KEY,
  tag              varchar(32) UNIQUE NOT NULL,
  name             varchar(128) NOT NULL,
  category         varchar(64) NOT NULL,
  location         varchar(64) NOT NULL,
  status           varchar(32) NOT NULL DEFAULT 'AVAILABLE', -- 'AVAILABLE' or 'CHECKED_OUT'
  borrower_name    varchar(128) NOT NULL DEFAULT '',
  borrower_contact varchar(128) NOT NULL DEFAULT '',
  purpose          text NOT NULL DEFAULT '',
  checked_out_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS checkout_history (
  id         bigserial PRIMARY KEY,
  tag        varchar(32) NOT NULL,
  action     varchar(32) NOT NULL, -- 'CHECKOUT' or 'RETURN'
  actor      varchar(128) NOT NULL,
  purpose    text NOT NULL DEFAULT '',
  timestamp  timestamptz NOT NULL DEFAULT now()
);

-- Seed initial real inventory if table is empty
INSERT INTO equipment (tag, name, category, location, status, borrower_name, borrower_contact, purpose, checked_out_at)
VALUES 
  ('RP4-01', 'Raspberry Pi 4 Model B (4GB RAM)', 'Compute', 'Locker B1', 'AVAILABLE', '', '', '', NULL),
  ('RP4-02', 'Raspberry Pi 4 Model B (8GB RAM)', 'Compute', 'Locker B1', 'AVAILABLE', '', '', '', NULL),
  ('JET-01', 'NVIDIA Jetson Nano Developer Kit (4GB)', 'Compute', 'Locker B2', 'CHECKED_OUT', 'Aditya Sharma', 'aditya.s@campus.edu', 'Autonomous rover vision project', now() - interval '2 days'),
  ('ARD-01', 'Arduino Mega 2560 Rev3', 'Microcontroller', 'Bin D1', 'AVAILABLE', '', '', '', NULL),
  ('ESP-03', 'ESP32-WROOM-32D Dev Board (Pack of 3)', 'Microcontroller', 'Bin D2', 'AVAILABLE', '', '', '', NULL),
  ('LIDAR-01', 'RPLIDAR A1M8 360-Degree Laser Scanner', 'Sensors', 'Locker C3', 'CHECKED_OUT', 'Tanvi Mehta', 'tanvi.m@campus.edu', 'SLAM mapping test rig', now() - interval '5 hours'),
  ('RS-01', 'Intel RealSense D435i Depth Camera', 'Sensors', 'Locker A1', 'AVAILABLE', '', '', '', NULL),
  ('IMU-02', 'MPU-9250 9-Axis Gyro/Accelerometer/Mag', 'Sensors', 'Bin D3', 'AVAILABLE', '', '', '', NULL),
  ('ULT-01', 'HC-SR04 Ultrasonic Distance Sensor Set (4x)', 'Sensors', 'Bin D2', 'AVAILABLE', '', '', '', NULL),
  ('MD-04', 'TB6612FNG Dual DC Motor Driver Module', 'Actuation', 'Bin D4', 'AVAILABLE', '', '', '', NULL),
  ('SLD-02', 'TS100 Smart Mini Digital Soldering Iron Kit', 'Tools', 'Workbench 3', 'AVAILABLE', '', '', '', NULL),
  ('PS-01', '12V 30A DC Regulated Bench Power Supply', 'Power', 'Workbench 1', 'AVAILABLE', '', '', '', NULL)
ON CONFLICT (tag) DO NOTHING;
