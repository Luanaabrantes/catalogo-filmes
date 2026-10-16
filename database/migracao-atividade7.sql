-- Aditiva e reexecutável em MariaDB. Fazer backup antes da execução.
CREATE TABLE IF NOT EXISTS premium_assinaturas (
    usuario_id INT NOT NULL PRIMARY KEY,
    premium BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_customer_id VARCHAR(255) NULL UNIQUE,
    stripe_subscription_id VARCHAR(255) NULL UNIQUE,
    stripe_checkout_id VARCHAR(255) NULL,
    stripe_paid_invoice_id VARCHAR(255) NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'nenhuma',
    CONSTRAINT fk_premium_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Somente identificação do evento; nenhum payload ou dado de cartão.
CREATE TABLE IF NOT EXISTS stripe_eventos (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL,
    processado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
