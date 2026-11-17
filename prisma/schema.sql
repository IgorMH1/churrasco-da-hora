-- prisma/schema.sql
-- Script Oficial DDL PostgreSQL 16 — Sistema Churrasco dos Da Hora
SET TIME ZONE 'America/Sao_Paulo';

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone_anatel VARCHAR(20) NOT NULL,
    ddd_code CHAR(2) NOT NULL,
    cpf_cnpj VARCHAR(18) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADM', 'CLIENTE')),
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ NULL,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NULL,
    phone_anatel VARCHAR(20) NOT NULL,
    staff_type VARCHAR(30) NOT NULL CHECK (staff_type IN ('INTERNA', 'EXTERNA_TERCEIRO')),
    specialty VARCHAR(100) NOT NULL,
    company_name VARCHAR(150) NULL,
    base_daily_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('ANIVERSARIO', 'FESTA', 'FUTEBOL', 'CORPORATIVO')),
    honoree_name VARCHAR(150) NOT NULL, -- "Pra quem é o evento"
    client_id UUID NOT NULL REFERENCES users(id),
    responsible_admin_id UUID NULL REFERENCES users(id),
    event_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'CONCLUIDO')),
    google_calendar_event_id VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE RESTRICT,
    assigned_role VARCHAR(100) NOT NULL,
    agreed_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    UNIQUE(event_id, staff_id)
);

CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    backup_scope VARCHAR(20) NOT NULL CHECK (backup_scope IN ('USERS', 'EVENTS', 'FULL')),
    file_format VARCHAR(10) NOT NULL CHECK (file_format IN ('JSON', 'SQL')),
    sha256_checksum CHAR(64) NOT NULL,
    exported_at_gmt3 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_date_status ON events (event_date, status);