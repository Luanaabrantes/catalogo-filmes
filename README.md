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
- Perfil com foto no MinIO, bio e favoritos, com edição exclusiva pelo proprietário.

## Arquitetura atual

```text
Navegador
    │ HTTP/HTTPS
    ▼
Catálogo / Express :3000 ───────► auth-service :3001 ───────► MariaDB
    │                                  │                         (externo ao Compose)
    ├──► MinIO :9000 (fotos; volume minio-data)
    │                                  └──── POST /eventos ──┐
    └──────────────────── POST /eventos ────────────────────┤
                                                            ▼
                                                     log-service :3002
                                                            │
                                                            ▼
                                                   Redis Stream :6379
```

O navegador acessa somente o catálogo. `auth-service`, `log-service`, Redis e MinIO não publicam portas no host: a comunicação entre os microsserviços ocorre na rede Docker `catalogo-network`. O `log-service` é o único componente que acessa Redis; catálogo e `auth-service` enviam eventos para ele por HTTP.

O MariaDB continua fornecendo os dados de negócio e autenticação, mas é uma dependência externa: não há serviço MariaDB definido nos Compose deste projeto.

| Serviço | Responsabilidade | Acesso/porta |
|---|---|---|
| `catalogo` | Frontend, API pública, TMDB, favoritos, comentários, sessão e proxy administrativo | Único publicado: local `3000:3000`; Portainer `8216:3000` |
| `auth-service` | Cadastro, autenticação, validação da sessão, papel atual, recuperação de senha e gestão administrativa de usuários | Interno, `3001` |
| `log-service` | Validação, gravação e consulta de eventos de auditoria | Interno, `3002` |
| `redis` | Persistência do Stream `auditoria` | Interno, `6379` |
| `minio` | Fotos de perfil | Interno, `9000`; leitura intermediada pelo catálogo |

Não é necessário expor `3001`, `3002` ou `6379` ao host.

### Evolução das atividades

- **Atividade 3:** autenticação desacoplada no `auth-service`, papéis e recuperação de senha. A descrição daquela etapa com catálogo e `auth-service` corresponde à arquitetura histórica, não à composição atual.
- **Atividade 4:** autorização RBAC aplicada às operações protegidas e moderação de comentários.
- **Atividade 5:** serviço de auditoria próprio, Redis Streams, consulta administrativa e painel de gestão.

## Serviços e Docker Compose

O Compose local é `docker-compose.yml`; para produção no Portainer, use `docker-compose.portainer.yml`. Ambos definem `catalogo`, `auth-service`, `log-service`, `redis` e `minio` na mesma rede `catalogo-network`.

No ambiente local, apenas o catálogo publica `3000:3000`. No Compose do Portainer, ele publica `8216:3000`, usa `NODE_ENV=production` e recebe configuração por variáveis do ambiente do Portainer: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `TMDB_TOKEN`, `JWT_SECRET` e `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`. `CATALOGO_URL` aponta para a aplicação publicada. Esse arquivo também preserva a configuração DNS do `auth-service` e a rede IPAM existente (`10.88.0.0/24`). Valores secretos não são gravados no Compose nem devem ser colocados no Git.

Variáveis internas relevantes:

```text
AUTH_SERVICE_URL=http://auth-service:3001
LOG_SERVICE_URL=http://log-service:3002
REDIS_URL=redis://redis:6379
```

Redis usa a imagem `redis:7.4-alpine`, inicia com AOF (`--appendonly yes`) e persiste dados no volume `audit-redis-data`; o volume precisa ser preservado para manter os dados entre recriações do container. O healthcheck executa `redis-cli ping`; o `log-service` aguarda Redis saudável e também possui healthcheck em `/health`. No Compose do Portainer, os cinco serviços usam `restart: unless-stopped`.

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


## Atividade 6 — Upload e perfil de usuário

A página `/perfil.html`, acessível por **Meu perfil**, apresenta nome, foto, bio e favoritos. Para consultar outro perfil autenticado, use `/perfil.html?id=ID`. A edição aparece somente no próprio perfil; o backend também verifica essa regra.

> A imagem não é armazenada no MariaDB. O arquivo binário é persistido no MinIO e o MariaDB mantém apenas a chave/referência do objeto.

### Estrutura e execução

A migração `database/migracao-atividade6.sql` cria somente `perfis`, com `usuario_id` (chave primária e estrangeira para `usuarios.id`, com exclusão em cascata), `bio VARCHAR(300)` e `foto_chave VARCHAR(500)`. Usa `CREATE TABLE IF NOT EXISTS`, preserva os dados e não recria tabelas anteriores. Favoritos reutilizam a tabela existente e seus IDs do TMDB; os dados visuais dos filmes não são duplicados no MariaDB.

O Compose não aplica essa migração automaticamente. Aplique-a ao banco configurado antes de consultar o perfil. Com o catálogo ativo, no PowerShell:

```powershell
Get-Content database/migracao-atividade6.sql -Raw | docker compose exec -T catalogo node -e "const db=require('./src/database');let sql='';process.stdin.on('data',c=>sql+=c);process.stdin.on('end',async()=>{try{await db.query(sql);console.log('Migração aplicada.')}catch(e){console.error(e.code);process.exitCode=1}finally{await db.end()}})"
```

Confirme com `SHOW TABLES LIKE 'perfis';` e `DESCRIBE perfis;`. No Portainer, aplique a migração ao banco correspondente e configure as variáveis abaixo.

| Variável | Uso |
|---|---|
| `MINIO_ENDPOINT` | Host; no Compose, `minio` |
| `MINIO_PORT` | Porta interna; no Compose, `9000` |
| `MINIO_USE_SSL` | TLS entre backend e armazenamento; `false` na rede interna configurada |
| `MINIO_ACCESS_KEY` | Credencial fornecida no ambiente, nunca no frontend |
| `MINIO_SECRET_KEY` | Segredo fornecido no ambiente, nunca no Git |
| `MINIO_BUCKET` | Bucket dedicado; padrão `perfil-fotos` |

Use `.env.example` como referência. Os Compose fixam o endereço interno do MinIO. O volume `minio-data`, montado em `/data`, mantém os arquivos entre reinicializações/recriações. Preserve esse volume e `audit-redis-data`; não use `down -v` para uma simples atualização.

`minio/Dockerfile` compila o código oficial do MinIO na versão fixada no arquivo. A primeira construção pode demorar. O healthcheck consulta `/minio/health/live`; o console não é publicado. Suba com `docker compose up -d --build` e confira os cinco serviços com `docker compose ps`.

### Upload, propriedade e auditoria

O bucket é único para todas as fotos. As chaves seguem `perfis/{usuarioId}/{uuid}.jpg` (ou `.png`/`.webp`), sem usar o nome original enviado. O backend verifica/cria o bucket no primeiro upload.

1. Validar sessão e propriedade a partir de `req.usuario.id`.
2. Receber um arquivo no campo `foto`, por `multipart/form-data`: JPEG, PNG ou WebP, até **5 MB** (5 × 1024 × 1024 bytes).
3. Verificar MIME e decodificar com Sharp, sem confiar somente na extensão; reencodar e remover metadados.
4. Enviar o objeto ao MinIO e persistir sua chave no MariaDB em transação.
5. Somente após o commit, remover a foto anterior. Falha na limpeza não invalida a foto nova.

Falha no banco antes do commit provoca rollback e tentativa de limpeza do objeto novo. Se o resultado do commit for incerto, ambas as imagens são preservadas para evitar apagar uma referência válida. **Alterar foto** abre o seletor oculto e inicia o upload após a seleção, com validações e mensagens de andamento/resultado.

| Método e endpoint | Regra |
|---|---|
| `GET /api/perfil/me` | Perfil da sessão e favoritos |
| `GET /api/perfil/:id` | Consulta por usuário autenticado |
| `PATCH /api/perfil/:id` | Altera somente a própria bio; JSON com `bio`, até 300 caracteres |
| `POST /api/perfil/:id/foto` | Altera somente a própria foto; multipart com campo `foto` |
| `GET /api/perfil/fotos/:usuarioId/:arquivo` | Leitura pública da imagem, intermediada pelo catálogo |

A consulta retorna ID, nome, bio, `foto_chave`, `foto_url`, favoritos e indicação de propriedade. O backend compara `Number(req.params.id)` com `Number(req.usuario.id)` e ignora identidade enviada no corpo. Mesmo um administrador não pode editar perfil alheio. Sem sessão: `401`; tentativa alheia: `403`; arquivo/bio inválido: `400`; tamanho excedido: `413`; falha de infraestrutura: `503`.

A auditoria existente registra `PERFIL_ATUALIZADO`, `FOTO_PERFIL_ATUALIZADA` e `ACAO_NEGADA` para tentativa alheia, com recurso `PERFIL`, operação e ID alvo quando pertinente. Não envia imagem, bio, senha, JWT, cookie ou credenciais. Mantém o melhor esforço do `log-service`.

### Leitura pública e alternativa pré-assinada

O bucket permite somente `s3:GetObject` público no prefixo `perfis/`. A escrita permanece restrita ao backend. A URL estável usa `/api/perfil/fotos/...`; o catálogo lê o objeto anonimamente na rede interna, sem entregar credenciais ao navegador.

| Estratégia | Vantagens | Limitações |
|---|---|---|
| Bucket com leitura pública (adotado) | Simples, URL estável e fácil uso no frontend; adequado a fotos públicas | Qualquer pessoa que conheça a URL pode acessar a imagem |
| URL pré-assinada | Maior controle e expiração; adequada a arquivos privados | Mais complexidade e URLs precisam ser regeneradas; desnecessária para fotos públicas neste projeto |

### Arquivos e testes da Atividade 6

- Interface: `public/perfil.html`, `public/perfil.js` e estilos em `public/style.css`.
- Backend: `src/perfil.js`, `src/fotoPerfil.js`, `src/minio.js` e consulta compartilhada em `src/listarFavoritos.js`.
- Infraestrutura: `database/migracao-atividade6.sql`, `minio/Dockerfile`, ambos os Compose e `.env.example`.
- Testes: `test/perfil.test.js`, `test/minio.test.js` e roteiro integrado `test/perfil-integracao.js`.

Com as dependências instaladas na raiz, em `auth-service` e em `log-service`, execute `npm test`. Nesta entrega: **49 testes aprovados, 0 falhas**, incluindo os testes anteriores. Cobrem autenticação, propriedade, favoritos do usuário correto, upload válido/inválido, limite de tamanho, falhas de MinIO/banco e auditoria, usando mocks quando apropriado. O roteiro integrado exige ambiente descartável com banco `catalogo_qa` e serviços de teste; não deve ser executado no banco de produção.

## Demonstração da Atividade 6

### Perfil

1. Fazer login e acessar **Meu perfil**.
2. Usar **Editar perfil** para salvar uma bio e **Alterar foto** para enviar uma imagem válida.
3. Favoritar filmes no catálogo e retornar ao perfil.
4. Confirmar foto realmente carregada, bio e pôsteres dos favoritos; capturar a página.
5. Para conferir persistência, executar `docker compose restart minio` e recarregar a página quando o serviço estiver saudável.

### Tentativa de editar outro usuário

1. Autenticar como usuário A e identificar o ID real de B (na conta B ou no painel de usuários como administrador).
2. No console do navegador da sessão A, executar e informar o ID de B:

```javascript
const idAlvo = Number(prompt('ID do outro usuário'));
const resposta = await fetch('/api/perfil/' + idAlvo, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ bio: 'Tentativa de edição de outro perfil' })
});
console.log(resposta.status, await resposta.json());
```

3. Confirmar `403 Forbidden` e `Você só pode editar o próprio perfil.`; capturar o console ou a requisição na aba Network.
4. Opcionalmente, autenticar como administrador, abrir **Auditoria**, atualizar e filtrar `ACAO_NEGADA`. Conferir recurso `PERFIL`, alvo e operação `ATUALIZAR_BIO`.

### Evidência — perfil com foto, bio e favoritos

![Perfil com foto carregada pelo MinIO, bio e filmes favoritos](docs/evidencias/atividade-6-perfil.png)

### Evidência — tentativa recusada de editar outro perfil

![Tentativa de editar outro perfil recusada com 403 Forbidden](docs/evidencias/atividade-6-perfil-403.png)

### Evidências anteriores — autenticação e recuperação de senha

<details>
<summary>Ver evidências preservadas das atividades anteriores</summary>

![Tela de login](docs/evidencias/tela-login.png)
![Recuperar senha](docs/evidencias/recuperar-senha.png)
![Envio da solicitação de recuperação](docs/evidencias/envio-recuperacao.png)
![Confirmação de e-mail enviado](docs/evidencias/email-enviado.png)
![E-mail recebido no Mailtrap](docs/evidencias/email-mailtrap.png)
![Redefinição de senha](docs/evidencias/redefinir-senha.png)
![Senha redefinida](docs/evidencias/senha-redefinida.png)
![Link de recuperação já utilizado](docs/evidencias/link-utilizado.png)

</details>

## Tecnologias

Node.js, Express, JavaScript, HTML, CSS, MariaDB, MySQL2, `bcryptjs`, `jsonwebtoken`, Nodemailer, API TMDB, Redis, Redis Streams, MinIO, Multer, Sharp, Docker e Docker Compose.

## Links

- **Aplicação:** [https://luana-abrantes-isw055.lapps.studio/](https://luana-abrantes-isw055.lapps.studio/)
- **Repositório:** [https://github.com/Luanaabrantes/catalogo-filmes](https://github.com/Luanaabrantes/catalogo-filmes)
- **Professor:** [@siriani](https://github.com/siriani)

Desenvolvido por **Luana Abrantes** para a disciplina **ISW055 — Introdução à Computação em Nuvem**.
