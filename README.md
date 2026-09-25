# Catálogo de Filmes — Tom Hanks

Aplicação acadêmica desenvolvida para a disciplina **Introdução à Computação em Nuvem (ISW055)**, no semestre 2026.2, com catálogo de filmes, autenticação, controle de acesso por papel e auditoria centralizada.

**Professor:** [@siriani](https://github.com/siriani)

**Aplicação publicada:** [https://luana-abrantes-isw055.lapps.studio/](https://luana-abrantes-isw055.lapps.studio/)

## Funcionalidades

- Consulta filmes relacionados a Tom Hanks pela API do TMDB. Os dados dos filmes não são persistidos no MariaDB.
- Cadastro, login, logout e recuperação de senha por e-mail.
- Favoritos e comentários persistidos e associados ao usuário autenticado.
- Autorização RBAC para ações administrativas, incluindo moderação de comentários, auditoria e gerenciamento de papéis.
- Painel administrativo com Visão geral, Auditoria e Usuários.
- Registro de eventos em um Redis Stream pelo serviço dedicado `log-service`.

## Arquitetura atual

```text
Navegador
    │ HTTP/HTTPS
    ▼
Catálogo / Express :3000 ───────► auth-service :3001 ───────► MariaDB
    │                                  │                         (externo ao Compose)
    │                                  └──── POST /eventos ──┐
    └──────────────────── POST /eventos ────────────────────┤
                                                            ▼
                                                     log-service :3002
                                                            │
                                                            ▼
                                                   Redis Stream :6379
```

O navegador acessa somente o catálogo. `auth-service`, `log-service` e Redis não publicam portas no host: a comunicação entre os microsserviços ocorre na rede Docker `catalogo-network`. O `log-service` é o único componente que acessa Redis; catálogo e `auth-service` enviam eventos para ele por HTTP.

O MariaDB continua fornecendo os dados de negócio e autenticação, mas é uma dependência externa: não há serviço MariaDB definido nos Compose deste projeto.

| Serviço | Responsabilidade | Acesso/porta |
|---|---|---|
| `catalogo` | Frontend, API pública, TMDB, favoritos, comentários, sessão e proxy administrativo | Único publicado: local `3000:3000`; Portainer `8216:3000` |
| `auth-service` | Cadastro, autenticação, validação da sessão, papel atual, recuperação de senha e gestão administrativa de usuários | Interno, `3001` |
| `log-service` | Validação, gravação e consulta de eventos de auditoria | Interno, `3002` |
| `redis` | Persistência do Stream `auditoria` | Interno, `6379` |

Não é necessário expor `3001`, `3002` ou `6379` ao host.

### Evolução das atividades

- **Atividade 3:** autenticação desacoplada no `auth-service`, papéis e recuperação de senha. A descrição daquela etapa com catálogo e `auth-service` corresponde à arquitetura histórica, não à composição atual.
- **Atividade 4:** autorização RBAC aplicada às operações protegidas e moderação de comentários.
- **Atividade 5:** serviço de auditoria próprio, Redis Streams, consulta administrativa e painel de gestão.

## Serviços e Docker Compose

O Compose local é `docker-compose.yml`; para produção no Portainer, use `docker-compose.portainer.yml`. Ambos definem `catalogo`, `auth-service`, `log-service` e `redis` na mesma rede `catalogo-network`.

No ambiente local, apenas o catálogo publica `3000:3000`. No Compose do Portainer, ele publica `8216:3000`, usa `NODE_ENV=production` e recebe configuração por variáveis do ambiente do Portainer: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `TMDB_TOKEN`, `JWT_SECRET` e `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`. `CATALOGO_URL` aponta para a aplicação publicada. Esse arquivo também preserva a configuração DNS do `auth-service` e a rede IPAM existente (`10.88.0.0/24`). Valores secretos não são gravados no Compose nem devem ser colocados no Git.

Variáveis internas relevantes:

```text
AUTH_SERVICE_URL=http://auth-service:3001
LOG_SERVICE_URL=http://log-service:3002
REDIS_URL=redis://redis:6379
```

Redis usa a imagem `redis:7.4-alpine`, inicia com AOF (`--appendonly yes`) e persiste dados no volume `audit-redis-data`; o volume precisa ser preservado para manter os dados entre recriações do container. O healthcheck executa `redis-cli ping`; o `log-service` aguarda Redis saudável e também possui healthcheck em `/health`. No Compose do Portainer, os quatro serviços usam `restart: unless-stopped`.

O Compose não define container para MariaDB: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` e `DB_NAME` devem apontar para a instância externa configurada no ambiente. Da mesma forma, TMDB, JWT e SMTP são configurados por variáveis de ambiente.

## Autenticação, sessão e segurança

O `auth-service` gera e valida JWT. No login, o catálogo armazena o token em cookie `HttpOnly`, com `SameSite=Lax`; `Secure` é ativado quando `NODE_ENV=production`. O JWT e o cookie têm duração de **8 horas**, conforme a implementação atual. O logout registra o evento quando possível e limpa o cookie.

O frontend não lê nem armazena o token em `localStorage` ou `sessionStorage`. Abas da mesma origem compartilham o cookie de sessão; ao voltar a ficar visível, o painel administrativo consulta `/api/auth/me` para atualizar a identidade e redirecionar conforme o papel atual.

Em cada validação, o `auth-service` verifica assinatura e validade do JWT e consulta o usuário no MariaDB pelo ID do token. O `id`, nome, e-mail e `role` retornados vêm do estado atual do banco; o papel antigo incluído na emissão do JWT não é a fonte de autorização. Uma alteração de papel pode, portanto, refletir na sessão existente na próxima validação.

Senhas são armazenadas como hash com `bcryptjs`. Segredos e credenciais são fornecidos por variáveis de ambiente; arquivos `.env` reais não devem ser versionados. Os produtores da auditoria não enviam senha, hash, JWT, cookie ou token de recuperação. O `log-service` também recusa campos sensíveis em `detalhes`, inclusive em estruturas aninhadas; isso é uma validação por nomes de campos, não um detector geral de segredos em texto livre.

### Recuperação de senha

O fluxo é intermediado pelo catálogo e processado pelo `auth-service`. O token de recuperação é aleatório, armazenado em `reset_tokens`, expira em 30 minutos e só pode ser usado uma vez. A resposta da solicitação não revela se o e-mail existe. O envio usa as variáveis SMTP `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS` e `MAIL_FROM`; o exemplo de desenvolvimento configura Mailtrap Email Testing.

## RBAC e operações administrativas

Os únicos papéis são `usuario` e `admin`. O cadastro público sempre define `usuario`; o cliente não escolhe `admin`. Autenticação identifica a sessão, enquanto autorização verifica o papel atual no backend. A interface não é a fronteira de segurança.

Um usuário comum pode consultar o catálogo, gerir os próprios favoritos, criar comentários e excluir os próprios comentários. Um administrador pode também excluir comentários alheios para moderação, consultar auditoria e gerenciar os papéis dos usuários.

O gerenciamento de usuários é implementado no `auth-service` e protegido por autenticação e verificação administrativa. A alteração de papel:

- aceita somente `usuario` ou `admin`;
- não permite alterar o próprio papel;
- impede rebaixar o último administrador;
- responde sem alteração quando o usuário já possui o papel solicitado;
- registra `ROLE_ALTERADA` somente quando o papel realmente muda.

As tentativas autenticadas sem papel suficiente retornam `403` e geram `ACAO_NEGADA`. Falta de autenticação ou sessão inválida retorna `401` e não é registrada como ação negada. A aplicação atualiza a autorização com base no papel consultado no banco, não somente no conteúdo original do JWT.

### Endpoints administrativos

| Método e endpoint público | Acesso | Descrição |
|---|---|---|
| `GET /api/admin/usuarios` | Admin | Lista usuários com nome, e-mail e papel |
| `PATCH /api/admin/usuarios/:id/role` | Admin | Altera o papel do usuário indicado |
| `GET /api/logs` ou `GET /api/logs?limit=N` | Admin | Consulta eventos de auditoria via catálogo |

O catálogo valida a sessão e o papel antes de encaminhar operações administrativas. O `auth-service` também valida Bearer Token e papel atual nas rotas internas `/auth/admin/usuarios` e `/auth/admin/usuarios/:id/role`.

## Atividade 5 — Logs e auditoria

A auditoria registra quem executou uma ação, qual ação ocorreu, quando ocorreu e o contexto associado; o IP é incluído quando disponível. O log-service centraliza a persistência, em vez de gravar logs de auditoria em arquivos locais dos serviços.

### Evento e Redis Stream

Cada registro pode conter:

| Campo | Significado |
|---|---|
| `usuario_id` | ID do usuário responsável, como string no Stream |
| `acao` | Nome da ação registrada |
| `timestamp` | Data e hora ISO 8601 normalizada para UTC pelo `log-service` |
| `ip` | Endereço de origem, quando disponível |
| `detalhes` | Contexto opcional em objeto JSON |

O timestamp recebido precisa ser ISO 8601 válido com fuso; se não for enviado, o `log-service` define a data/hora atual. O Redis Stream se chama `auditoria`. O serviço grava com `XADD` e consulta os N registros mais recentes com `XREVRANGE`; em seguida, devolve a seleção em ordem cronológica crescente. O AOF e o volume `audit-redis-data` mantêm os dados do Redis entre reinicializações do container.

### Eventos implementados

| Evento | Quando é registrado |
|---|---|
| `LOGIN` | Após credenciais confirmadas e JWT gerado |
| `LOGOUT` | Quando a sessão validada é encerrada |
| `FILME_FAVORITADO` | Após inserir o favorito |
| `FILME_DESFAVORITADO` | Quando a remoção realmente exclui o favorito |
| `COMENTARIO_CRIADO` | Após inserir o comentário |
| `COMENTARIO_APAGADO` | Após exclusão autorizada de comentário |
| `ACAO_NEGADA` | Para operação proibida de usuário autenticado |
| `ROLE_ALTERADA` | Quando o papel de outro usuário é realmente alterado |

Na exclusão de comentário, o proprietário pode remover o próprio conteúdo. Admin pode remover comentário alheio; nesse caso, o evento contém `moderacao: true`. A remoção do próprio comentário, mesmo pelo admin, não é marcada como moderação. A auditoria registra IDs e contexto, não o texto completo do comentário.

Os casos de negação incluem exclusão proibida de comentário, consulta administrativa de logs e gestão administrativa de usuários. O catálogo interrompe uma consulta de logs negada antes de chamar o serviço interno, evitando duplicar `ACAO_NEGADA`. Uma chamada direta autenticada ao GET interno do `log-service` por usuário comum gera o evento específico `CONSULTA_LOGS_INTERNA`. Erros `401` não geram ação negada.

O registro é de melhor esforço: se o `log-service` falha depois que a operação de negócio foi concluída, a falha de auditoria não desfaz a operação. A chamada pode aguardar até dois segundos antes de falhar e emitir aviso no log do serviço chamador; não há fila de reenvio. Em contraste, a consulta administrativa retorna `503` quando o serviço de auditoria necessário está indisponível.

### Consulta administrativa

O navegador consulta o catálogo com cookie HttpOnly. O catálogo valida a sessão e o papel atual e encaminha um Bearer Token ao `log-service`, que consulta novamente o `auth-service` antes de ler o Redis:

```text
Admin ── GET /api/logs?limit=N + cookie ──► Catálogo
                                              │ valida sessão e papel atual
                                              │ Authorization: Bearer <token>
                                              ▼
                                         log-service
                                              │ valida no auth-service
                                              ▼
                                      Redis Stream auditoria
```

| Método e endpoint | Serviço | Regra |
|---|---|---|
| `GET /api/logs` | Catálogo | Rota do catálogo; exige sessão e papel `admin` |
| `GET /api/logs?limit=N` | Catálogo | Repassa o limite para o serviço interno |
| `GET /eventos` ou `GET /eventos?limit=N` | log-service | Interno; exige Bearer Token válido e papel atual `admin` |
| `POST /eventos` | log-service | Interno; recebe e valida evento para gravação |
| `GET /health` | log-service | Indica estado do serviço e conexão Redis |

O limite de leitura padrão é **50**, com faixa de **1 a 100** (inteiros). O retorno inclui `quantidade` e `eventos`. Limite inválido retorna `400`; ausência de sessão ou token inválido retorna `401`; usuário autenticado sem papel admin retorna `403`; indisponibilidade do serviço ou Redis retorna `503`. A rota interna de gravação não exige token na implementação atual e não é publicada no host.

### Painel administrativo

O painel em `/admin.html` fica disponível somente a usuários cujo papel atual seja `admin`. A interface tem três áreas:

#### Visão geral

Apresenta eventos analisados, logins, ações negadas e alterações de acesso referentes à quantidade de eventos carregada naquele momento, além de usuários cadastrados, número de administradores, atividade recente e eventos de segurança/acesso. As métricas não representam necessariamente o histórico total. A lista recente mostra até cinco eventos; a lista de segurança, até três eventos `ACAO_NEGADA` ou `ROLE_ALTERADA`. Totais de usuários usam `GET /api/admin/usuarios` e podem aparecer como indisponíveis se essa consulta falhar.

#### Auditoria

Permite consultar e pesquisar eventos por ação, usuário ou recurso, filtrar pela ação, selecionar 20, 50 ou 100 registros e atualizar a consulta. Exibe data/hora, usuário, ação, contexto, IP e detalhes no drawer. Quando a lista de usuários está disponível, a interface pode apresentar nome e ID; a consulta de auditoria não depende dessa lista. A interface é apenas apresentação: catálogo, log-service e auth-service mantêm as verificações de sessão e autorização no backend.

#### Usuários

Lista nome, e-mail e papel, oferece pesquisa e identifica a própria conta. Admin pode alternar papéis entre `usuario` e `admin`, sujeito às proteções do backend descritas acima. Não há outros papéis nem permissões granulares nesta implementação.

## API do catálogo

Rotas públicas do catálogo incluem:

| Método e endpoint | Acesso/uso |
|---|---|
| `POST /api/auth/cadastro` | Cadastro; novo papel sempre `usuario` |
| `POST /api/auth/login` | Autenticação e emissão do cookie de sessão |
| `GET /api/auth/me` | Identidade e papel atuais da sessão |
| `POST /api/auth/logout` | Encerra sessão |
| `POST /api/auth/esqueci-senha` | Inicia recuperação de senha |
| `POST /api/auth/redefinir-senha` | Redefine a senha com token válido |
| `GET /api/filmes` | Catálogo de filmes, com sessão |
| `GET /api/favoritos`, `POST /api/favoritos/:movieId`, `DELETE /api/favoritos/:movieId` | Consulta e gestão de favoritos da sessão |
| `GET /api/comentarios`, `GET /api/comentarios/:movieId`, `POST /api/comentarios/:movieId`, `DELETE /api/comentarios/:id` | Consulta, criação e exclusão autorizada de comentários |

Rotas administrativas adicionais estão listadas acima. O frontend não chama diretamente os microsserviços internos.

## Banco de dados e TMDB

O MariaDB guarda usuários, favoritos, comentários e tokens de recuperação. A migração `database/migracao-atividade3.sql` adiciona `role` com padrão `usuario` e a tabela `reset_tokens`. Favoritos e comentários são associados a `usuario_id` obtido da sessão autenticada, não de um ID de proprietário livremente escolhido no frontend.

O catálogo consulta a API do TMDB em tempo de execução para localizar filmes relacionados a Tom Hanks e seus dados, incluindo pôster. Esses dados não são armazenados no MariaDB.

## Estrutura representativa

```text
catalogo-filmes/
├── public/
│   ├── admin.html
│   ├── admin.js
│   ├── catalogo.html
│   ├── catalogo.js
│   └── style.css
├── src/
│   ├── admin.js
│   ├── auditoria.js
│   ├── auth.js
│   ├── comentarios.js
│   ├── favoritos.js
│   ├── logs.js
│   ├── middlewareAuth.js
│   └── server.js
├── auth-service/
│   └── src/
│       ├── admin.js
│       ├── auditoria.js
│       ├── auth.js
│       ├── gestaoUsuarios.js
│       ├── middlewareAuth.js
│       ├── recuperacaoSenha.js
│       └── server.js
├── log-service/
│   ├── src/
│   │   ├── consulta.js
│   │   ├── evento.js
│   │   ├── eventos.js
│   │   ├── middlewareAuth.js
│   │   ├── redis.js
│   │   └── server.js
│   ├── test/
│   ├── Dockerfile
│   └── package.json
├── database/
│   └── migracao-atividade3.sql
├── docker-compose.yml
├── docker-compose.portainer.yml
└── README.md
```

## Configuração e execução local

Pré-requisitos: Docker com Docker Compose, acesso a um MariaDB externo, credencial do TMDB e configuração SMTP para recuperação de senha.

Use `.env.example`, `auth-service/.env.example` e `log-service/.env.example` como referência. Preencha localmente `.env` e `auth-service/.env` com seus próprios valores; não versione arquivos reais nem compartilhe segredos. O Compose injeta as URLs internas de serviço e configura Redis sem instalação manual na máquina.

Na raiz do projeto:

```bash
docker compose up -d --build
docker compose ps
```

A aplicação local fica em [http://localhost:3000](http://localhost:3000). Apenas o serviço `catalogo` deve mostrar porta publicada no host; os outros serviços ficam disponíveis pela rede interna.

Para executar no Portainer, configure as variáveis de ambiente exigidas em `docker-compose.portainer.yml` e use esse arquivo como Compose da stack. O catálogo será publicado na porta `8216` do host. Não configure mapeamentos de host para as portas 3001, 3002 ou 6379.

Verificações internas opcionais:

```bash
docker compose exec log-service node -e "fetch('http://127.0.0.1:3002/health').then(async r => console.log(r.status, await r.text()))"
docker compose exec redis redis-cli PING
docker compose exec redis redis-cli XRANGE auditoria - +
docker compose exec redis redis-cli XREVRANGE auditoria + - COUNT 20
```

`XRANGE` percorre o Stream do ID mais antigo ao mais recente. `XREVRANGE` mostra os registros mais novos primeiro; a API inverte o conjunto selecionado para retornar sequência cronológica dentro do limite escolhido.

## Testes disponíveis

Os testes automatizados do projeto estão em `test/admin.test.js`, `auth-service/test/admin.test.js` e `log-service/test/consulta.js`. Execute-os com Node.js:

```bash
node --test test/admin.test.js
node --test auth-service/test/admin.test.js
node --test log-service/test/consulta.js
```

Eles cobrem, respectivamente, proxy e rotas administrativas do catálogo, gestão de papéis e leitura/autenticação do Stream. `log-service/test/eventos.js` é um roteiro de integração que exige os containers ativos; no PowerShell, pode ser executado assim:

```powershell
Get-Content log-service/test/eventos.js -Raw | docker compose exec -T log-service node
```

Os incrementos da Atividade 5 também foram validados com Docker Compose e testes de integração para healthcheck, isolamento das portas, respostas 400/401/403/503, persistência Redis, auditoria de operações e comportamento quando o serviço de logs fica indisponível. Resultados anteriores documentam cenários de teste, não garantem disponibilidade contínua do ambiente externo.

## Demonstração da Atividade 5

### Usuário comum

1. Fazer login com conta de papel `usuario`.
2. Favoritar um filme e criar um comentário.
3. Tentar consultar uma operação administrativa sem permissão, como `GET /api/logs`.
4. Confirmar `403 Forbidden` e o evento `ACAO_NEGADA` correspondente na auditoria.

### Administrador

1. Fazer login com uma conta cujo papel atual seja `admin`.
2. Abrir o painel, acessar **Auditoria** e consultar os eventos recentes.
3. Inspecionar a sequência, o contexto e os detalhes no painel.

Uma sequência conceitual possível é `LOGIN`, `FILME_FAVORITADO`, `COMENTARIO_CRIADO` e `ACAO_NEGADA`. IDs e timestamps dependem da execução; não há IDs fixos necessários para a demonstração.

### Evidência — consulta como administrador

A evidência visual da consulta dos logs pelo painel administrativo será adicionada antes da entrega final.

<!--
![Consulta dos logs de auditoria realizada como administrador](docs/evidencias/atividade-5-logs-admin.png)
-->

## Tecnologias

Node.js, Express, JavaScript, HTML, CSS, MariaDB, MySQL2, `bcryptjs`, `jsonwebtoken`, Nodemailer, API TMDB, Redis, Redis Streams, Docker e Docker Compose.

## Links

- **Aplicação:** [https://luana-abrantes-isw055.lapps.studio/](https://luana-abrantes-isw055.lapps.studio/)
- **Repositório:** [https://github.com/Luanaabrantes/catalogo-filmes](https://github.com/Luanaabrantes/catalogo-filmes)
- **Professor:** [@siriani](https://github.com/siriani)

Desenvolvido por **Luana Abrantes** para a disciplina **ISW055 — Introdução à Computação em Nuvem**.
