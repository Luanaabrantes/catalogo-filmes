-- Complemento aditivo reexecutável. Faça backup atualizado.
-- Sem datas inventadas: assinaturas existentes exigem sincronização.
ALTER TABLE premium_assinaturas
    ADD COLUMN IF NOT EXISTS stripe_price_id VARCHAR(255) NULL,
    ADD COLUMN IF NOT EXISTS paid_period_start BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS paid_period_end BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS cancel_at BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS next_renewal_at BIGINT UNSIGNED NULL,
    ADD COLUMN IF NOT EXISTS payment_problem BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS state_event_created BIGINT UNSIGNED NOT NULL DEFAULT 0;
