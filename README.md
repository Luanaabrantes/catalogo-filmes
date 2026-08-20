# Catálogo de Filmes — Tom Hanks

Aplicação desenvolvida para a disciplina **Introdução à Computação em Nuvem (ISW055)**.

**Professor:** @siriani  

## Aplicação publicada

https://luana-abrantes-isw055.lapps.studio/

## Sobre o projeto

Aplicação web que consulta filmes com **Tom Hanks** por meio da API do **TMDB**.

O sistema possui cadastro e autenticação de usuários próprios e permite que cada usuário:

- visualize filmes com pôster, título, ano e sinopse;
- favorite e desfavorite filmes;
- adicione comentários;
- mantenha seus favoritos e comentários após recarregar a aplicação.

Os filmes são obtidos diretamente da TMDB e **não são armazenados no banco de dados**.

O MariaDB armazena somente:

- usuários;
- favoritos;
- comentários.

---

## Arquitetura

A aplicação possui três camadas principais:

```text
Usuário
   │
   ▼
Frontend
HTML + CSS + JavaScript
   │
   ▼
Backend
Node.js + Express
   │
   ├──────────────► TMDB API
   │                Filmes, sinopses e pôsteres
   │
   └──────────────► MariaDB
                    Usuários, favoritos e comentários
```

O frontend se comunica apenas com o backend da aplicação, sem acesso direto à TMDB ou ao MariaDB.

As chamadas para a **TMDB** e para o **MariaDB** são realizadas exclusivamente pelo servidor.

---

## Integração com a TMDB

O backend segue o fluxo solicitado na atividade:

```text
GET /search/person?query=Tom+Hanks
        ↓
Obtém o person_id de Tom Hanks
        ↓
GET /person/{person_id}/movie_credits
        ↓
Obtém a lista de filmes
        ↓
https://image.tmdb.org/t/p/w500{poster_path}
```

Título, sinopse e pôster são consultados em tempo de execução.

O catálogo de filmes não é persistido no MariaDB.

---

## Segregação de usuários

Favoritos e comentários são vinculados ao usuário autenticado através do campo:

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

A exclusão de comentários também valida o proprietário:

```sql
DELETE FROM comentarios
WHERE id = ?
AND usuario_id = ?;
```

O `usuario_id` não é recebido livremente do frontend; ele é obtido a partir do usuário autenticado no servidor.

Dessa forma, um usuário não consegue visualizar ou excluir favoritos e comentários pertencentes a outra conta.

---

## Autenticação

A aplicação possui cadastro e login próprios, independentes das credenciais utilizadas no MariaDB ou no Portainer.

Foram utilizados:

- `bcryptjs` para gerar o hash das senhas;
- `jsonwebtoken` para autenticação;
- cookie `HttpOnly` para armazenar a sessão do usuário.

As senhas não são armazenadas em texto puro.

---

## Segurança das credenciais

Nenhuma credencial real é armazenada no código-fonte ou no frontend.

As configurações são fornecidas por variáveis de ambiente:

```env
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=
TMDB_TOKEN=
JWT_SECRET=
PORT=
NODE_ENV=
```

O arquivo `.env` está incluído no `.gitignore` e não é enviado ao GitHub.

O repositório contém apenas o arquivo:

```text
.env.example
```

sem valores reais.

No ambiente publicado, as variáveis são configuradas diretamente no Portainer.

---

## Tecnologias utilizadas

- Node.js
- Express
- JavaScript
- HTML
- CSS
- MariaDB
- MySQL2
- TMDB API
- Docker
- Portainer
- GitHub

---

## Estrutura do projeto

```text
catalogo-filmes/
│
├── public/
│   ├── index.html
│   ├── login.js
│   ├── cadastro.html
│   ├── cadastro.js
│   ├── catalogo.html
│   ├── catalogo.js
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
├── Dockerfile
├── package.json
├── package-lock.json
└── README.md
```

---

## Executando localmente

Instale as dependências:

```bash
npm install
```

Crie um arquivo `.env` utilizando o `.env.example` como referência.

Depois execute:

```bash
npm start
```

A aplicação estará disponível em:

```text
http://localhost:3000
```

---

## Docker

Para construir a imagem:

```bash
docker build -t luanaabrantes/catalogo-filmes:latest .
```

Para executar localmente:

```bash
docker run -p 3000:3000 --env-file .env luanaabrantes/catalogo-filmes:latest
```

---

## Validação

Para validar a persistência e a segregação dos dados entre usuários:

1. crie uma primeira conta e faça login;
2. favorite um filme e adicione um comentário;
3. recarregue a página e confirme que o favorito e o comentário continuam disponíveis;
4. faça logout e crie uma segunda conta;
5. confirme que os dados cadastrados pela primeira conta não aparecem;
6. retorne à primeira conta e confirme que seus favoritos e comentários permanecem disponíveis.

---

## Links

**Aplicação:**  
https://luana-abrantes-isw055.lapps.studio/

**Repositório:**  
https://github.com/Luanaabrantes/catalogo-filmes

---

Desenvolvido por **Luana Abrantes** para a disciplina **ISW055 — Introdução à Computação em Nuvem**.
