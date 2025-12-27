
-- SaaS Management Platform - Full Database Schema
-- Compatible with MySQL / MariaDB

CREATE DATABASE IF NOT EXISTS saas_management;
USE saas_management;

CREATE TABLE tenants (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    subscription_status ENUM('ACTIVE','SUSPENDED') DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT NULL,
    name VARCHAR(150),
    email VARCHAR(150) UNIQUE,
    password VARCHAR(255),
    role ENUM('SUPER_ADMIN','ADMIN','USER'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE modules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE,
    name VARCHAR(150),
    description TEXT
);

CREATE TABLE tenant_modules (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    module_id BIGINT,
    is_active BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (module_id) REFERENCES modules(id)
);

CREATE TABLE subscription_plans (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100),
    duration_months INT,
    price DECIMAL(12,2)
);

CREATE TABLE subscriptions (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    plan_id BIGINT,
    start_date DATE,
    end_date DATE,
    status ENUM('ACTIVE','EXPIRED', 'ILLIMITY'),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id)
);

CREATE TABLE subscription_payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    subscription_id BIGINT,
    amount DECIMAL(12,2),
    payment_method ENUM('ORANGE_MONEY','VIREMENT','CHEQUE'),
    reference VARCHAR(150),
    payment_date DATE,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions(id)
);

CREATE TABLE product_categories (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100)
);

CREATE TABLE units (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50),
    conversion_value DECIMAL(10,2)
);

CREATE TABLE products (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    name VARCHAR(150),
    product_category_id BIGINT,
    unit_id BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (product_category_id) REFERENCES product_categories(id),
    FOREIGN KEY (unit_id) REFERENCES units(id)
);

CREATE TABLE containers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    container_number VARCHAR(50),
    capacity_min INT,
    capacity_max INT,
    interest_rate DECIMAL(5,2),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE container_photos (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    container_id BIGINT,
    image_path VARCHAR(255),
    FOREIGN KEY (container_id) REFERENCES containers(id)
);

CREATE TABLE clients (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    name VARCHAR(150),
    phone1 VARCHAR(50),
    phone2 VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE suppliers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    name VARCHAR(150),
    currency VARCHAR(10),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE currencies (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(10)
);

CREATE TABLE exchange_rates (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    currency_id BIGINT,
    rate DECIMAL(10,4),
    rate_date DATE,
    FOREIGN KEY (currency_id) REFERENCES currencies(id)
);

CREATE TABLE payments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    type ENUM('CLIENT','SUPPLIER','DEPOT','RETRAIT'),
    method ENUM('ORANGE_MONEY','VIREMENT','CHEQUE','ESPECES'),
    amount DECIMAL(12,2),
    currency VARCHAR(10),
    proof VARCHAR(255),
    payment_date DATE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE invoices (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    client_id BIGINT,
    invoice_number VARCHAR(100),
    total_amount DECIMAL(12,2),
    status ENUM('PAYE','PARTIEL','IMPAYE'),
    due_date DATE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

CREATE TABLE locations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    name VARCHAR(150)
);

CREATE TABLE buildings (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    location_id BIGINT,
    name VARCHAR(150),
    type VARCHAR(50),
    total_floors INT,
    FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE floors (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    building_id BIGINT,
    floor_number INT,
    FOREIGN KEY (building_id) REFERENCES buildings(id)
);

CREATE TABLE unit_configurations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150),
    bedrooms INT,
    living_rooms INT,
    bathrooms INT,
    has_terrace BOOLEAN
);

CREATE TABLE housing_units (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    floor_id BIGINT,
    unit_configuration_id BIGINT,
    rent_amount DECIMAL(12,2),
    status ENUM('LIBRE','OCCUPE'),
    FOREIGN KEY (floor_id) REFERENCES floors(id),
    FOREIGN KEY (unit_configuration_id) REFERENCES unit_configurations(id)
);

CREATE TABLE drivers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    name VARCHAR(150),
    phone VARCHAR(50),
    contract_end DATE,
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE taxis (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    tenant_id BIGINT,
    plate_number VARCHAR(50),
    FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE taxi_assignments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    taxi_id BIGINT,
    driver_id BIGINT,
    start_date DATE,
    end_date DATE,
    FOREIGN KEY (taxi_id) REFERENCES taxis(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id)
);
