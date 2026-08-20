# Catálogo de Filmes — Tom Hanks

Projeto desenvolvido para a disciplina de **Introdução à Computação em Nuvem (ISW055)**.

**Professor:** @siriani

## Sobre o projeto

Aplicação web que consulta filmes com Tom Hanks utilizando a API do TMDB.

O sistema possui cadastro e autenticação de usuários e permite que cada usuário favorite filmes e registre comentários.

Os dados de favoritos e comentários são armazenados no MariaDB e permanecem isolados por usuário.

O catálogo de filmes não é armazenado no banco de dados. Título, sinopse e pôster são consultados diretamente da API do TMDB pelo backend.

## Funcionalidades

- Cadastro de usuários
- Login e logout
- Consulta de filmes com Tom Hanks
- Exibição de título, sinopse e pôster
- Favoritar e desfavoritar filmes
- Adicionar e excluir comentários
- Persistência no MariaDB
- Isolamento de favoritos e comentários por usuário

## Tecnologias utilizadas

- Node.js
- Express
- JavaScript
- HTML
- CSS
- MariaDB / MySQL
- TMDB API
- Docker
- Portainer

## Arquitetura

O navegador acessa somente o backend da aplicação.

O backend é responsável por:

- autenticar os usuários;
- consultar a API do TMDB;
- acessar o MariaDB;
- registrar favoritos e comentários;
- garantir a segregação dos dados pelo `usuario_id`.

As credenciais do MariaDB, o token da TMDB e o segredo JWT são fornecidos por variáveis de ambiente.

## Variáveis de ambiente

Crie um arquivo `.env` baseado no `.env.example`.

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
