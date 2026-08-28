-- Atividade 3 - Microsserviço de autenticação
-- Alterações necessárias no banco de dados

-- Adiciona o papel do usuário.
-- Novos usuários recebem "usuario" por padrão.
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'usuario';


-- Armazena os tokens utilizados no fluxo de recuperação de senha.
CREATE TABLE IF NOT EXISTS reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    token VARCHAR(128) NOT NULL UNIQUE,
    usuario_id INT NOT NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em TIMESTAMP NOT NULL,
    usado BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_reset_tokens_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);