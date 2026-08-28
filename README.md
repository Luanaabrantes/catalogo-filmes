# Catálogo de Filmes — Tom Hanks

Aplicação desenvolvida para a disciplina **Introdução à Computação em Nuvem (ISW055)**.

**Professor:** [@siriani](https://github.com/siriani)
**Semestre:** 2026.2

## Aplicação publicada

https://luana-abrantes-isw055.lapps.studio/

---

## Sobre o projeto

Aplicação web que consulta filmes com **Tom Hanks** por meio da API do **TMDB**.

O sistema possui cadastro e autenticação próprios e permite que cada usuário:

- visualize filmes com pôster, título, ano e sinopse;
- favorite e desfavorite filmes;
- adicione comentários;
- mantenha seus favoritos e comentários após recarregar a aplicação;
- solicite recuperação de senha por e-mail.

Os filmes são obtidos diretamente da TMDB e **não são armazenados no banco de dados**.

O MariaDB armazena dados relacionados a:

- usuários;
- favoritos;
- comentários;
- tokens de recuperação de senha.

---

# Atividade 3 — Microsserviço de autenticação

Nesta etapa, a autenticação foi **desacoplada do backend principal** e transferida para um serviço independente chamado:

```text
auth-service
```

O catálogo continua sendo o único serviço exposto publicamente.

O `auth-service` é acessado apenas pela **rede interna do Docker**.

---

## Arquitetura

A aplicação passou a utilizar dois serviços:

```text
                         INTERNET / USUÁRIO
                                │
                                ▼
                     http://localhost:3000
                                │
                                ▼
                    ┌──────────────────────┐
                    │       CATÁLOGO       │
                    │   Node.js + Express  │
                    │      porta 3000      │
                    └──────────┬───────────┘
                               │
                     Rede interna Docker
                               │
                               ▼
                    ┌──────────────────────┐
                    │     AUTH-SERVICE     │
                    │   Node.js + Express  │
                    │      porta 3001      │
                    └──────────┬───────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
                 MariaDB              Mailtrap
```

O catálogo é o **único ponto de entrada público**.

O navegador nunca acessa diretamente:

```text
http://auth-service:3001
```

Essa comunicação ocorre somente dentro da rede criada pelo Docker Compose.

---

## Serviços Docker

O projeto possui dois serviços definidos no arquivo:

```text
docker-compose.yml
```

### `catalogo`

Responsável por:

- frontend;
- catálogo de filmes;
- integração com TMDB;
- favoritos;
- comentários;
- receber as requisições públicas;
- encaminhar operações de autenticação ao `auth-service`.

Porta publicada:

```text
3000:3000
```

### `auth-service`

Responsável exclusivamente por:

- cadastro de usuários;
- login;
- validação de autenticação;
- papéis de usuário;
- solicitação de recuperação de senha;
- redefinição de senha;
- envio do e-mail de recuperação.

O serviço utiliza internamente:

```text
3001/tcp
```

Porém **não possui `ports:` no Docker Compose**.

Dessa forma, a porta 3001 não é publicada no computador hospedeiro.

---

## Comunicação entre os serviços

O catálogo acessa o microsserviço por meio do nome do serviço Docker:

```text
http://auth-service:3001
```

A variável utilizada pelo catálogo é:

```env
AUTH_SERVICE_URL=http://auth-service:3001
```

Exemplo:

```text
Usuário
    │
    ▼
POST /api/auth/login
    │
    ▼
Catálogo :3000
    │
    ▼
http://auth-service:3001/auth/login
    │
    ▼
Auth Service
```

O usuário não precisa conhecer nem acessar a porta interna do serviço de autenticação.

---

# Autenticação

O `auth-service` é responsável pela autenticação dos usuários.

São utilizadas as bibliotecas:

- `bcryptjs` para geração e validação de hash das senhas;
- `jsonwebtoken` para criação e validação do JWT.

As senhas **não são armazenadas em texto puro**.

Depois de um login válido, o `auth-service` retorna o JWT para o catálogo.

O catálogo armazena esse token em um cookie:

```text
HttpOnly
```

O frontend não precisa manipular diretamente o JWT.

---

## Validação do usuário autenticado

Quando uma rota do catálogo precisa saber quem está autenticado, o catálogo envia o token internamente para:

```text
GET http://auth-service:3001/auth/validar
```

O `auth-service` valida o JWT e retorna os dados do usuário.

Exemplo:

```json
{
  "usuario": {
    "id": 15,
    "nome": "Teste Docker",
    "email": "docker.auth.20260828@example.com",
    "role": "usuario"
  }
}
```

---

# Papéis de usuário

O sistema possui suporte aos papéis:

```text
usuario
admin
```

O campo utilizado na tabela `usuarios` é:

```text
role
```

Novos usuários são cadastrados por padrão como:

```text
usuario
```

O papel do usuário também é retornado pelo serviço de autenticação durante o login e durante a validação da sessão.

Não foi necessária a criação de uma interface administrativa para esta atividade.

---

# Recuperação de senha

O fluxo de recuperação de senha também pertence ao `auth-service`.

O fluxo implementado é:

```text
Usuário solicita recuperação
            │
            ▼
POST /api/auth/esqueci-senha
            │
            ▼
Catálogo
            │
            ▼
Auth Service
            │
            ├── gera token aleatório
            │
            ├── grava token no MariaDB
            │
            └── envia e-mail pelo Mailtrap
                         │
                         ▼
              Link de recuperação
                         │
                         ▼
http://localhost:3000/redefinir-senha.html?token=...
```

O link sempre retorna para o **catálogo público**.

A página pública envia a nova senha para:

```text
POST /api/auth/redefinir-senha
```

O catálogo então encaminha a requisição para o `auth-service`.

---

## Token de recuperação

Os tokens são armazenados na tabela:

```text
reset_tokens
```

A estrutura utilizada contém:

```text
token
usuario_id
criado_em
expira_em
usado
```

O token é gerado aleatoriamente utilizando:

```javascript
crypto.randomBytes(32)
```

Isso produz um token criptograficamente aleatório de **32 bytes**.

---

## Expiração

Cada token possui validade de:

```text
30 minutos
```

No momento da criação:

```text
expira_em = criado_em + 30 minutos
```

Antes de permitir a redefinição da senha, o `auth-service` verifica se o token:

- existe;
- ainda não expirou;
- ainda não foi utilizado.

Se alguma dessas condições não for satisfeita, a redefinição é recusada.

---

## Uso único

Depois que a senha é alterada com sucesso, o token passa a possuir:

```text
usado = true
```

Uma nova tentativa de utilizar o mesmo link retorna:

```json
{
  "mensagem": "Este link já foi utilizado."
}
```

Portanto, um mesmo link não pode redefinir a senha mais de uma vez.

---

## Token inválido

Tokens inexistentes também são recusados.

Exemplo de resposta:

```text
HTTP/1.1 400 Bad Request
```

```json
{
  "mensagem": "Token inválido."
}
```

---

# Envio de e-mail

## Desenvolvimento

Durante o desenvolvimento foi utilizado o:

```text
Mailtrap Email Testing
```

O Mailtrap funciona como uma caixa SMTP de testes e permite comprovar o envio real do e-mail sem encaminhá-lo para uma caixa de correio pessoal.

A aplicação se conecta ao servidor SMTP configurado pelas variáveis:

```env
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
```

O e-mail enviado contém o link de redefinição e informa que ele:

- expira em 30 minutos;
- pode ser usado apenas uma vez.

## Produção

Em um ambiente de produção, o mesmo mecanismo pode utilizar um provedor SMTP real, como o **Brevo**, substituindo as configurações SMTP de desenvolvimento pelas credenciais do serviço de produção.

Credenciais de SMTP nunca devem ser armazenadas diretamente no código-fonte.

---

# Banco de dados

Além das tabelas utilizadas anteriormente, a Atividade 3 adicionou suporte a papéis de usuário e recuperação de senha.

O campo de papel do usuário é:

```sql
role VARCHAR(20) NOT NULL DEFAULT 'usuario'
```

A tabela de recuperação possui a seguinte estrutura:

```sql
CREATE TABLE reset_tokens (
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
```

---

# Segregação de usuários

Favoritos e comentários continuam vinculados ao usuário autenticado através do campo:

```text
usuario_id
```

Todas as consultas utilizam o usuário identificado pelo backend.

Exemplo:

```sql
SELECT tmdb_movie_id
FROM favoritos
WHERE usuario_id = ?;
```

Os comentários seguem a mesma regra:

```sql
SELECT id, tmdb_movie_id, texto, criado_em
FROM comentarios
WHERE usuario_id = ?;
```

A exclusão também valida o proprietário:

```sql
DELETE FROM comentarios
WHERE id = ?
AND usuario_id = ?;
```

O `usuario_id` não é recebido livremente do frontend.

Ele é obtido a partir do usuário autenticado.

---

# Integração com a TMDB

O catálogo consulta os dados diretamente na API da TMDB.

Fluxo utilizado:

```text
GET /search/person?query=Tom+Hanks
        ↓
Obtém o person_id
        ↓
GET /person/{person_id}/movie_credits
        ↓
Obtém a lista de filmes
        ↓
https://image.tmdb.org/t/p/w500{poster_path}
```

Título, sinopse e pôster são consultados em tempo de execução.

Os filmes não são persistidos no MariaDB.

---

# Estrutura do projeto

```text
catalogo-filmes/
│
├── auth-service/
│   │
│   ├── src/
│   │   ├── auth.js
│   │   ├── database.js
│   │   ├── mailer.js
│   │   ├── recuperacaoSenha.js
│   │   └── server.js
│   │
│   ├── .dockerignore
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
│
├── public/
│   ├── index.html
│   ├── login.js
│   ├── cadastro.html
│   ├── cadastro.js
│   ├── catalogo.html
│   ├── catalogo.js
│   ├── redefinir-senha.html
│   ├── redefinir-senha.js
│   └── style.css
│
├── src/
│   ├── server.js
│   ├── database.js
│   ├── auth.js
│   ├── middlewareAuth.js
│   ├── filmes.js
│   ├── favoritos.js
│   └── comentarios.js
│
├── .dockerignore
├── .env.example
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
├── package-lock.json
└── README.md
```

---

# Variáveis de ambiente

Credenciais reais não são enviadas ao GitHub.

Os arquivos `.env` estão incluídos no `.gitignore`.

## Catálogo

Exemplo de variáveis:

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

TMDB_TOKEN=

PORT=3000
NODE_ENV=development
```

Dentro do Docker Compose, o endereço do serviço de autenticação é configurado como:

```env
AUTH_SERVICE_URL=http://auth-service:3001
```

## Auth Service

O `auth-service` necessita das configurações de:

```env
PORT=3001

DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=

MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=

CATALOGO_URL=http://localhost:3000
```

Nenhuma senha, token da TMDB, segredo JWT ou credencial SMTP deve ser publicada no repositório.

---

# Executando com Docker Compose

Com os arquivos `.env` configurados, execute na raiz do projeto:

```bash
docker compose up -d --build
```

Para verificar os containers:

```bash
docker compose ps
```

O resultado esperado possui comportamento semelhante a:

```text
SERVICE        PORTS

auth-service   3001/tcp
catalogo       0.0.0.0:3000->3000/tcp
```

Observe que apenas o catálogo possui uma porta publicada no host.

---

## Testando o isolamento do auth-service

Uma tentativa de acesso direto pelo computador:

```bash
curl http://localhost:3001/health
```

deve falhar, pois a porta 3001 não é publicada.

Entretanto, dentro da rede Docker o catálogo consegue acessar:

```bash
docker compose exec catalogo node -e "fetch('http://auth-service:3001/health').then(r=>r.text()).then(console.log)"
```

Resultado esperado:

```json
{
  "servico": "auth-service",
  "status": "ok"
}
```

Isso comprova que a comunicação entre os serviços ocorre pela rede interna do Docker.

---

# Validação realizada

Durante os testes da Atividade 3 foram validados:

- execução do catálogo e do `auth-service` em containers separados;
- catálogo publicado na porta 3000;
- `auth-service` sem porta publicada para o host;
- comunicação interna utilizando `http://auth-service:3001`;
- cadastro por meio do catálogo;
- login por meio do catálogo;
- retorno do papel `usuario`;
- validação da sessão pelo `auth-service`;
- solicitação de recuperação de senha;
- envio real do e-mail para o Mailtrap;
- link retornando pela aplicação pública;
- token com validade de 30 minutos;
- alteração da senha;
- login funcionando com a nova senha;
- rejeição de token inválido;
- rejeição de token já utilizado.

---

# Tecnologias utilizadas

- Node.js
- Express
- JavaScript
- HTML
- CSS
- MariaDB
- MySQL2
- bcryptjs
- JSON Web Token
- Nodemailer
- Mailtrap
- TMDB API
- Docker
- Docker Compose
- Portainer
- GitHub

---

# Links

**Aplicação:**
https://luana-abrantes-isw055.lapps.studio/

**Repositório:**
https://github.com/Luanaabrantes/catalogo-filmes

**Professor:**
https://github.com/siriani

---

Desenvolvido por **Luana Abrantes** para a disciplina **ISW055 — Introdução à Computação em Nuvem**.