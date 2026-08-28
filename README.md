# Catálogo de Filmes — Tom Hanks

Aplicação desenvolvida para a disciplina **Introdução à Computação em Nuvem (ISW055)**.

**Professor:** [@siriani](https://github.com/siriani)
**Semestre:** 2026.2

## Aplicação publicada

https://luana-abrantes-isw055.lapps.studio/

---

# Sobre o projeto

Aplicação web que consulta filmes com **Tom Hanks** por meio da API do **TMDB**.

O sistema possui cadastro e autenticação próprios e permite que cada usuário:

- visualize filmes com pôster, título, ano e sinopse;
- favorite e desfavorite filmes;
- adicione comentários;
- mantenha seus favoritos e comentários após recarregar a aplicação;
- realize login e logout;
- solicite recuperação de senha por e-mail;
- redefina a senha por meio de um link temporário.

Os filmes são obtidos diretamente da API do TMDB e **não são armazenados no banco de dados**.

O MariaDB armazena somente dados relacionados a:

- usuários;
- favoritos;
- comentários;
- tokens de recuperação de senha.

---

# Atividade 3 — Microsserviço de autenticação

Nesta atividade, a autenticação foi **desacoplada do backend principal do catálogo** e transferida para um serviço independente chamado:

```text
auth-service
```

O projeto passou a possuir dois serviços principais:

- `catalogo`;
- `auth-service`.

O **catálogo é o único serviço exposto publicamente**.

O `auth-service` não publica sua porta para o computador hospedeiro e é acessado somente pela **rede interna do Docker Compose**.

---

# Arquitetura

A arquitetura da aplicação é:

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

O navegador acessa somente o catálogo.

O navegador **não acessa diretamente**:

```text
http://auth-service:3001
```

A comunicação entre o catálogo e o `auth-service` acontece apenas dentro da rede Docker.

---

# Serviços Docker

O projeto utiliza o arquivo:

```text
docker-compose.yml
```

para executar os dois serviços.

## Catálogo

O serviço `catalogo` é responsável por:

- servir o frontend;
- consultar a API do TMDB;
- gerenciar favoritos;
- gerenciar comentários;
- receber as requisições públicas;
- armazenar o JWT em cookie HttpOnly;
- encaminhar as operações de autenticação para o `auth-service`.

Porta publicada:

```text
3000:3000
```

## Auth Service

O serviço `auth-service` é responsável por:

- cadastro;
- login;
- hash de senha;
- geração de JWT;
- validação da sessão;
- papéis de usuário;
- recuperação de senha;
- geração de token de redefinição;
- validação do token;
- alteração da senha;
- envio de e-mail.

O serviço utiliza internamente:

```text
3001/tcp
```

Porém **não possui uma porta publicada para o host**.

---

# Docker Compose

A configuração utilizada possui os dois serviços conectados à mesma rede:

```yaml
services:
  catalogo:
    build:
      context: .
      dockerfile: Dockerfile

    ports:
      - "3000:3000"

    env_file:
      - .env

    environment:
      AUTH_SERVICE_URL: http://auth-service:3001

    depends_on:
      - auth-service

    networks:
      - catalogo-network

  auth-service:
    build:
      context: ./auth-service
      dockerfile: Dockerfile

    env_file:
      - ./auth-service/.env

    expose:
      - "3001"

    dns:
      - 8.8.8.8
      - 1.1.1.1

    networks:
      - catalogo-network

networks:
  catalogo-network:
    driver: bridge
```

Observe que somente o catálogo possui:

```yaml
ports:
  - "3000:3000"
```

O `auth-service` utiliza apenas:

```yaml
expose:
  - "3001"
```

Portanto, a porta `3001` fica disponível apenas para os containers da rede Docker.

---

# Comunicação entre os serviços

O catálogo acessa o serviço de autenticação utilizando o próprio nome do serviço Docker:

```text
http://auth-service:3001
```

A variável utilizada é:

```env
AUTH_SERVICE_URL=http://auth-service:3001
```

Exemplo do fluxo de login:

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

O usuário não precisa conhecer nem acessar diretamente a porta interna do serviço de autenticação.

---

# Autenticação

Toda a lógica de autenticação está concentrada no `auth-service`.

O microsserviço utiliza:

- `bcryptjs` para gerar e verificar o hash das senhas;
- `jsonwebtoken` para gerar e validar JWT.

As senhas **não são armazenadas em texto puro**.

Durante o cadastro, a senha é transformada em hash antes de ser armazenada no MariaDB.

Após um login válido, o `auth-service` gera um JWT contendo informações do usuário.

Exemplo do conteúdo utilizado:

```json
{
  "id": 16,
  "nome": "Administrador Teste",
  "email": "admin.auth.20260828@example.com",
  "role": "admin"
}
```

O catálogo recebe o token e o armazena em um cookie:

```text
HttpOnly
```

Dessa forma, o JavaScript do frontend não precisa manipular diretamente o JWT.

---

# Validação da autenticação

Quando uma rota do catálogo precisa identificar o usuário autenticado, o catálogo encaminha internamente o token para:

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

Assim, a responsabilidade de interpretar e validar o JWT permanece no microsserviço de autenticação.

---

# Papéis de usuário

O sistema possui suporte a pelo menos dois papéis:

```text
usuario
admin
```

O papel é armazenado no campo:

```text
role
```

da tabela `usuarios`.

Novos usuários são cadastrados por padrão como:

```text
usuario
```

A criação pública de contas não permite escolher livremente o papel `admin`.

O papel do usuário é retornado pelo `auth-service` durante:

- login;
- validação da sessão.

Durante os testes também foi validado um usuário com:

```json
{
  "role": "admin"
}
```

Não foi necessária a criação de uma interface administrativa para esta atividade.

---

# Recuperação de senha

O fluxo de recuperação de senha também pertence ao `auth-service`.

Na tela de login existe a opção:

```text
Esqueci minha senha
```

O usuário é direcionado para:

```text
/esqueci-senha.html
```

onde informa o e-mail cadastrado.

O fluxo completo é:

```text
Usuário
   │
   ▼
Tela "Esqueci minha senha"
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
   ├── verifica o usuário
   ├── gera token aleatório
   ├── grava o token no MariaDB
   └── envia e-mail pelo Mailtrap
                    │
                    ▼
             E-mail recebido
                    │
                    ▼
             Link temporário
                    │
                    ▼
http://localhost:3000/redefinir-senha.html?token=...
```

O e-mail nunca direciona o usuário diretamente para o `auth-service`.

O link retorna para o **catálogo público**.

A página de redefinição envia a nova senha para:

```text
POST /api/auth/redefinir-senha
```

O catálogo encaminha essa requisição internamente ao `auth-service`.

---

# Token de recuperação

Os tokens são armazenados na tabela:

```text
reset_tokens
```

A tabela possui:

```text
token
usuario_id
criado_em
expira_em
usado
```

O token é criado utilizando:

```javascript
crypto.randomBytes(32)
```

e convertido para hexadecimal.

Isso gera um token criptograficamente aleatório de **32 bytes**.

---

# Expiração do token

Cada token de recuperação possui validade de:

```text
30 minutos
```

No momento da criação:

```text
expira_em = criado_em + 30 minutos
```

Antes de permitir a alteração da senha, o `auth-service` verifica se o token:

- existe;
- ainda não expirou;
- ainda não foi utilizado.

Se qualquer uma dessas validações falhar, a redefinição da senha é recusada.

Um token expirado retorna uma resposta informando que um novo processo de recuperação deve ser solicitado.

---

# Token de uso único

Após a alteração da senha com sucesso, o token utilizado é atualizado para:

```text
usado = true
```

Uma nova tentativa de utilizar o mesmo link retorna:

```json
{
  "mensagem": "Este link já foi utilizado."
}
```

Portanto, um mesmo link não pode ser utilizado duas vezes.

---

# Token inválido

Tokens inexistentes também são recusados.

Exemplo:

```text
HTTP/1.1 400 Bad Request
```

Resposta:

```json
{
  "mensagem": "Token inválido."
}
```

---

# Envio de e-mail

## Desenvolvimento

Durante o desenvolvimento foi utilizado:

```text
Mailtrap Email Testing
```

O `auth-service` realiza uma conexão SMTP utilizando o Nodemailer.

As configurações são fornecidas por variáveis de ambiente:

```env
MAIL_HOST=
MAIL_PORT=
MAIL_USER=
MAIL_PASS=
MAIL_FROM=
```

O e-mail enviado contém:

- informação de solicitação de redefinição;
- link para o catálogo;
- informação de expiração em 30 minutos;
- informação de uso único do link.

O envio foi validado utilizando uma caixa de testes real do Mailtrap.

## Produção

Em produção, o mesmo mecanismo pode utilizar um serviço SMTP real, como:

```text
Brevo
```

Nesse caso, as variáveis SMTP devem receber as credenciais do provedor de produção.

Credenciais SMTP **não devem ser armazenadas diretamente no código-fonte nem enviadas ao GitHub**.

---

# Banco de dados

Além das tabelas utilizadas anteriormente, a Atividade 3 adicionou suporte a papéis de usuário e recuperação de senha.

## Papel do usuário

Foi adicionado à tabela `usuarios`:

```sql
role VARCHAR(20) NOT NULL DEFAULT 'usuario'
```

## Tokens de recuperação

Foi adicionada a tabela:

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

As alterações necessárias estão documentadas no arquivo:

```text
database/migracao-atividade3.sql
```

Esse script permite preparar um banco da Atividade 2 para receber as estruturas utilizadas na Atividade 3.

---

# Segregação de usuários

Favoritos e comentários continuam associados ao usuário autenticado por meio do campo:

```text
usuario_id
```

Exemplo para favoritos:

```sql
SELECT tmdb_movie_id
FROM favoritos
WHERE usuario_id = ?;
```

Exemplo para comentários:

```sql
SELECT id, tmdb_movie_id, texto, criado_em
FROM comentarios
WHERE usuario_id = ?;
```

A exclusão de comentários também considera o proprietário:

```sql
DELETE FROM comentarios
WHERE id = ?
AND usuario_id = ?;
```

O `usuario_id` não é recebido livremente do frontend.

Ele é obtido a partir da sessão autenticada.

Isso mantém os dados de cada usuário segregados.

---

# Integração com a TMDB

Os dados dos filmes continuam sendo consultados diretamente na API do TMDB.

Fluxo:

```text
GET /search/person?query=Tom+Hanks
        ↓
Obtém o person_id
        ↓
GET /person/{person_id}/movie_credits
        ↓
Obtém os filmes
        ↓
https://image.tmdb.org/t/p/w500{poster_path}
```

Título, ano, sinopse e pôster são consultados em tempo de execução.

Os filmes **não são persistidos no MariaDB**.

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
│   ├── .env.example
│   ├── Dockerfile
│   ├── package.json
│   └── package-lock.json
│
├── database/
│   └── migracao-atividade3.sql
│
├── public/
│   ├── index.html
│   ├── login.js
│   ├── cadastro.html
│   ├── cadastro.js
│   ├── catalogo.html
│   ├── catalogo.js
│   ├── esqueci-senha.html
│   ├── esqueci-senha.js
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

Os arquivos `.env` estão ignorados pelo Git.

## Catálogo

Arquivo:

```text
.env
```

Exemplo:

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

TMDB_TOKEN=

AUTH_SERVICE_URL=http://localhost:3001

PORT=3000
NODE_ENV=development
```

Ao executar com Docker Compose, `AUTH_SERVICE_URL` é substituído por:

```env
AUTH_SERVICE_URL=http://auth-service:3001
```

## Auth Service

Arquivo:

```text
auth-service/.env
```

Exemplo:

```env
PORT=3001

DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=

JWT_SECRET=

MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=587
MAIL_USER=
MAIL_PASS=
MAIL_FROM=no-reply@catalogo-filmes.local

CATALOGO_URL=http://localhost:3000
```

Os arquivos de exemplo podem ser utilizados como referência:

```text
.env.example
auth-service/.env.example
```

Nenhuma senha de banco, token do TMDB, segredo JWT ou credencial SMTP deve ser publicada no repositório.

---

# Executando o projeto

## Pré-requisitos

É necessário possuir:

- Docker;
- Docker Compose;
- credenciais do banco MariaDB;
- token da API do TMDB;
- credenciais de uma caixa SMTP do Mailtrap.

Configure:

```text
.env
```

e:

```text
auth-service/.env
```

Depois, na raiz do projeto, execute:

```bash
docker compose up -d --build
```

Para verificar os containers:

```bash
docker compose ps
```

O comportamento esperado é semelhante a:

```text
SERVICE        PORTS

auth-service   3001/tcp
catalogo       0.0.0.0:3000->3000/tcp
```

Somente o catálogo possui uma porta publicada para o computador hospedeiro.

A aplicação pode ser acessada em:

```text
http://localhost:3000
```

---

# Testando o isolamento do auth-service

Uma tentativa de acesso direto pelo host:

```bash
curl http://localhost:3001/health
```

deve falhar, pois a porta `3001` não está publicada.

Por outro lado, o catálogo consegue acessar o serviço através da rede Docker:

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

Isso demonstra que o `auth-service` está isolado da rede pública e que a comunicação ocorre internamente entre os containers.

---

# Validação realizada

Durante os testes da Atividade 3 foram validados:

- execução do catálogo e do `auth-service` em containers separados;
- catálogo publicado na porta `3000`;
- `auth-service` sem porta publicada para o host;
- comunicação interna por `http://auth-service:3001`;
- cadastro por meio do catálogo;
- novos cadastros recebendo `role: "usuario"`;
- login por meio do catálogo;
- validação da sessão pelo `auth-service`;
- retorno do papel `usuario`;
- retorno do papel `admin`;
- acesso à tela "Esqueci minha senha";
- solicitação da recuperação pela interface;
- geração do token de recuperação;
- envio do e-mail para o Mailtrap;
- recebimento do link pelo Mailtrap;
- link retornando para o catálogo público;
- token configurado com validade de 30 minutos;
- redefinição da senha pela interface;
- login funcionando com a nova senha;
- rejeição de token inválido;
- rejeição de token já utilizado.

---

# Fluxo de recuperação validado

O fluxo testado foi:

```text
Login
  ↓
Esqueci minha senha
  ↓
Informar e-mail
  ↓
Catálogo
  ↓
Auth Service
  ↓
Token salvo no banco
  ↓
E-mail enviado ao Mailtrap
  ↓
Link de redefinição
  ↓
Nova senha
  ↓
Token marcado como usado
  ↓
Login com a nova senha
```

Também foi validado que uma nova tentativa de utilizar o mesmo link é recusada.

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
- Git
- GitHub

---

# Segurança

Foram adotadas algumas medidas de segurança no projeto:

- senhas armazenadas utilizando hash com `bcryptjs`;
- JWT gerado somente pelo `auth-service`;
- token armazenado no catálogo em cookie HttpOnly;
- `auth-service` sem porta publicada no host;
- segredos fornecidos por variáveis de ambiente;
- arquivos `.env` ignorados pelo Git;
- tokens de recuperação aleatórios;
- expiração de token em 30 minutos;
- token de recuperação de uso único;
- mensagem genérica ao solicitar recuperação de senha, evitando indicar se determinado e-mail está cadastrado;
- isolamento de favoritos e comentários por usuário.

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