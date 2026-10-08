// Schemas reutilizáveis dos contratos reais; exemplos sem credenciais.
module.exports = {
  "schemas": {
    "Mensagem": {
      "type": "object",
      "properties": {
        "mensagem": {
          "type": "string"
        }
      },
      "required": [
        "mensagem"
      ]
    },
    "Usuario": {
      "type": "object",
      "properties": {
        "id": {
          "type": "integer",
          "minimum": 1,
          "example": 1
        },
        "nome": {
          "type": "string",
          "example": "Pessoa de exemplo"
        },
        "email": {
          "type": "string",
          "example": "pessoa@example.invalid"
        },
        "role": {
          "type": "string",
          "enum": [
            "usuario",
            "admin"
          ],
          "example": "usuario"
        }
      },
      "required": [
        "id",
        "nome",
        "email",
        "role"
      ]
    },
    "Cadastro": {
      "type": "object",
      "properties": {
        "nome": {
          "type": "string",
          "minLength": 1,
          "description": "String não vazia após trim."
        },
        "email": {
          "type": "string",
          "minLength": 1,
          "description": "Normalizado com trim e lowercase; não há validação de formato no servidor."
        },
        "senha": {
          "type": "string",
          "minLength": 6,
          "writeOnly": true,
          "description": "Senha escolhida em uma conta local de teste; nunca use credenciais reais nos exemplos."
        }
      },
      "required": [
        "nome",
        "email",
        "senha"
      ]
    },
    "Login": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "minLength": 1,
          "description": "Não vazio após trim."
        },
        "senha": {
          "type": "string",
          "minLength": 1,
          "writeOnly": true
        }
      },
      "required": [
        "email",
        "senha"
      ]
    },
    "Recuperacao": {
      "type": "object",
      "properties": {
        "email": {
          "type": "string",
          "minLength": 1,
          "description": "Não vazio após trim; a resposta não revela se a conta existe."
        }
      },
      "required": [
        "email"
      ]
    },
    "Redefinicao": {
      "type": "object",
      "properties": {
        "token": {
          "type": "string",
          "minLength": 1,
          "writeOnly": true,
          "description": "Obtido no e-mail; válido por 30 minutos e de uso único. Sem exemplo de token."
        },
        "senha": {
          "type": "string",
          "minLength": 6,
          "writeOnly": true
        }
      },
      "required": [
        "token",
        "senha"
      ]
    },
    "Role": {
      "type": "object",
      "properties": {
        "role": {
          "type": "string",
          "enum": [
            "usuario",
            "admin"
          ],
          "example": "usuario"
        }
      },
      "required": [
        "role"
      ]
    },
    "Filme": {
      "type": "object",
      "properties": {
        "id": {
          "type": "integer",
          "minimum": 1,
          "example": 1
        },
        "titulo": {
          "type": "string",
          "example": "Forrest Gump"
        },
        "sinopse": {
          "type": "string"
        },
        "data_lancamento": {
          "type": "string",
          "description": "Data enviada pela TMDB, que pode ser vazia."
        },
        "poster_url": {
          "type": "string",
          "nullable": true
        }
      },
      "required": [
        "id",
        "titulo",
        "sinopse",
        "data_lancamento",
        "poster_url"
      ]
    },
    "Comentario": {
      "type": "object",
      "properties": {
        "id": {
          "type": "integer",
          "minimum": 1,
          "example": 1
        },
        "tmdb_movie_id": {
          "type": "integer",
          "minimum": 1,
          "example": 1
        },
        "texto": {
          "type": "string",
          "example": "Comentário de exemplo"
        },
        "criado_em": {
          "type": "string",
          "format": "date-time"
        }
      },
      "required": [
        "id",
        "tmdb_movie_id",
        "texto"
      ]
    },
    "NovoComentario": {
      "type": "object",
      "properties": {
        "texto": {
          "type": "string",
          "minLength": 1,
          "description": "Texto não vazio após trim. Não existe limite de comprimento validado nesta rota.",
          "example": "Comentário de exemplo"
        }
      },
      "required": [
        "texto"
      ]
    },
    "Bio": {
      "type": "object",
      "properties": {
        "bio": {
          "type": "string",
          "maxLength": 300,
          "description": "Até 300 pontos de código Unicode após trim; string vazia é aceita.",
          "example": "Gosto de cinema."
        }
      },
      "required": [
        "bio"
      ]
    },
    "Foto": {
      "type": "object",
      "properties": {
        "foto": {
          "type": "string",
          "format": "binary",
          "description": "Uma única foto JPEG, PNG ou WebP estática; até 5 MiB (5242880 bytes) e 25 megapixels. Sem campos adicionais. Conteúdo decodificado, metadados removidos e imagem redimensionada até 1600×1600 mantendo proporção."
        }
      },
      "required": [
        "foto"
      ]
    },
    "FotoSalva": {
      "type": "object",
      "properties": {
        "foto_chave": {
          "type": "string",
          "example": "perfis/1/00000000-0000-0000-0000-000000000000.jpg"
        },
        "foto_url": {
          "type": "string",
          "example": "/api/perfil/fotos/1/00000000-0000-0000-0000-000000000000.jpg"
        }
      },
      "required": [
        "foto_chave",
        "foto_url"
      ]
    },
    "Perfil": {
      "type": "object",
      "properties": {
        "id": {
          "type": "integer",
          "minimum": 1,
          "example": 1
        },
        "nome": {
          "type": "string"
        },
        "bio": {
          "type": "string"
        },
        "foto_chave": {
          "type": "string",
          "nullable": true
        },
        "foto_url": {
          "type": "string",
          "nullable": true
        },
        "favoritos": {
          "type": "array",
          "items": {
            "type": "integer",
            "minimum": 1,
            "example": 1
          }
        },
        "proprio": {
          "type": "boolean"
        }
      },
      "required": [
        "id",
        "nome",
        "bio",
        "foto_chave",
        "foto_url",
        "favoritos",
        "proprio"
      ]
    },
    "Evento": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "example": "1720000000000-0"
        },
        "usuario_id": {
          "type": "string",
          "description": "ID armazenado como string pelo Redis."
        },
        "acao": {
          "type": "string",
          "example": "LOGIN"
        },
        "timestamp": {
          "type": "string",
          "format": "date-time"
        },
        "ip": {
          "type": "string"
        },
        "detalhes": {
          "type": "object",
          "additionalProperties": true
        }
      },
      "required": [
        "id",
        "usuario_id",
        "acao",
        "timestamp"
      ]
    }
  },
  "securitySchemes": {
    "sessao": {
      "type": "apiKey",
      "in": "cookie",
      "name": "token",
      "description": "Cookie HttpOnly criado por POST /api/auth/login. Faça login pelo formulário /login.html no mesmo navegador ou execute o login no Swagger. O navegador envia o cookie automaticamente; não leia nem cole o cookie no Authorize. SameSite=Lax; Secure em produção; duração 8 horas."
    },
    "bearerAuth": {
      "type": "http",
      "scheme": "bearer",
      "bearerFormat": "JWT",
      "description": "Somente rotas internas que efetivamente leem Authorization: Bearer. Use um JWT de teste apenas na rede interna; nunca publique o token."
    }
  }
};
