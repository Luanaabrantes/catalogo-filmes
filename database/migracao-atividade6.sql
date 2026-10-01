-- Atividade 6: extensão aditiva no mesmo banco de usuarios.
-- O binário fica exclusivamente no MinIO; aqui existe somente sua chave.
CREATE TABLE IF NOT EXISTS perfis (
    usuario_id INT NOT NULL PRIMARY KEY,
    bio VARCHAR(300) NULL,
    foto_chave VARCHAR(500) NULL,
    CONSTRAINT fk_perfil_usuario
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        ON DELETE CASCADE
) ENGINE=InnoDB;
