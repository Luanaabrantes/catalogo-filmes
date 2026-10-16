# Documentação reversa — Catálogo de Filmes

**Disciplina:** Introdução à Computação em Nuvem (ISW055), 2026.2

**Autoria:** Luana Abrantes — professor [@siriani](https://github.com/siriani)

**Entrega:** 16/10/2026

**Repositório:** [Luanaabrantes/catalogo-filmes](https://github.com/Luanaabrantes/catalogo-filmes)

**Base:** main no merge [f16a71e](https://github.com/Luanaabrantes/catalogo-filmes/commit/f16a71e0902f29e774698a04c0535b713d982189), que incorpora a atividade 7 e preserva o relatório P1.

## 1. Escopo e rastreabilidade

Esta documentação reversa descreve a implementação versionada, não uma arquitetura proposta. Foram confrontados código, migrações, consultas SQL, interfaces, testes, Compose, Dockerfiles, OpenAPI e commits. O README é fonte complementar. Alterações locais não commitadas do checkout original não integram a base analisada.

A atividade modifica apenas documentação: não executa migração, sincronização, checkout, pagamento, escrita no banco ou deploy. A topologia representa a configuração do repositório, não uma inspeção em tempo real da VM/Portainer.

| Fontes primárias | Conteúdo analisado |
|---|---|
| [src/server.js](src/server.js), [src/auth.js](src/auth.js), [src/middlewareAuth.js](src/middlewareAuth.js) | Rotas, cookie, proxies e validação |
| [auth-service/src](auth-service/src) | Cadastro/login, JWT, recuperação, SMTP e administração |
| [src/filmes.js](src/filmes.js), [src/favoritos.js](src/favoritos.js), [src/comentarios.js](src/comentarios.js) | Catálogo e interações |
| [src/perfil.js](src/perfil.js), [src/fotoPerfil.js](src/fotoPerfil.js), [src/minio.js](src/minio.js) | Perfil, avatar e objetos |
| [log-service/src](log-service/src), [src/auditoria.js](src/auditoria.js) | Auditoria e Redis |
| [src/premium.js](src/premium.js), [src/premiumPeriodo.js](src/premiumPeriodo.js), [public/perfil.js](public/perfil.js) | Cobrança e acesso efetivo |
| [database](database), [esquema de QA](test/perfil-integracao.js) | Estrutura relacional e suas limitações |
| [Compose local](docker-compose.yml), [Compose Portainer](docker-compose.portainer.yml), [workflow](.github/workflows/cicd.yml) | Topologia, configuração e entrega |
| [OpenAPI catálogo](docs/openapi/catalogo.json), [OpenAPI auth](docs/openapi/auth.json), [test](test), [testes auth](auth-service/test), [testes log](log-service/test) | Contratos e comportamento testado |

### 1.1 Evolução no histórico Git

| Etapa | Commits representativos | Resultado |
|---|---|---|
| Catálogo inicial | 0e3b62a | Filmografia de Tom Hanks e interações |
| Autenticação desacoplada | 6940546, f1440c5, 55d4e46, f6ca4c2 | auth-service, login, cadastro e recuperação |
| RBAC | a00a0a7, 5395b23 | Papel atual consultado no banco e moderação |
| Auditoria/administração | 03f8d88, 31a667c, e2090fe, 7517fae, 94024d9 | Redis, consulta e gestão de usuários |
| Perfil/MinIO | 66a9996, b291a5d, 9090e0d, 11f1746, 7ff8345 | Bio, foto e edição pelo dono |
| Swagger | 780dd4f | Documentação pública e interna |
| CI/CD/observabilidade | 24abe30, 0c65774, d672301 | GHCR, atualização manual, health checks e métricas |
| Premium | 1c2912a, ec5df7e | Stripe de teste, período pago e sincronização |
| Evidências/integração | ea17ab6, c7d4dd1, 1a23979, f16a71e | Legendas fiéis, limites e merge na main |

Commits comprovam evolução do código, não execução de integrações externas. O sistema atual executa Node.js/Express; referências históricas à atividade inicial não significam um serviço Flask na stack atual.

## 2. Visão geral e especificação funcional

Usuários autenticados consultam a filmografia de Tom Hanks no TMDB, mantêm favoritos e comentários pessoais e personalizam o perfil. A administração controla papéis e consulta auditoria. Premium, por R$ 9,90/mês, acrescenta selo durante o período pago; não é um terceiro papel.

| Ator/função | Comportamento implementado |
|---|---|
| Visitante | Abre páginas estáticas, cadastra-se, entra e solicita recuperação; fotos públicas e documentação são acessíveis sem sessão. APIs de negócio exigem autenticação. |
| Usuário autenticado | Consulta filmes, adiciona/remove favoritos próprios, escreve/lista comentários próprios e exclui os próprios. Consulta perfis e edita somente sua bio/foto. |
| Sessão | Cookie HttpOnly no navegador; catálogo valida no auth-service; identidade/papel atual vêm do banco. Logout limpa cookie. |
| Recuperação | E-mail com link de token aleatório, validade de 30 minutos e flag de uso único; formulário define nova senha. |
| Plano Gratuito | Catálogo, favoritos, comentários, foto e bio permanecem disponíveis; não há quota de favoritos por plano no backend. |
| Plano Premium | Checkout de assinatura de teste; backend confirma período; perfil exibe selo, preço, situação e data disponível. |
| Admin | Também lista usuários, altera papel de outros sob restrições, consulta auditoria e exclui comentário alheio pelo ID. |
| Operador autorizado | Executa migrações/sincronização administrativa por CLI, fora das funções do painel e das rotas públicas. |

O painel [public/admin.js](public/admin.js) tem Visão geral, Auditoria e Usuários. Contadores de eventos usam a janela carregada, não toda a história. Busca/filtros atuam nos dados obtidos. Não existe listagem administrativa global de comentários: GET filtra usuario_id da sessão, mesmo para admin; a moderação adicional está na exclusão por ID.

As páginas em [public](public) cobrem cadastro, login, recuperação/redefinição, catálogo, painel e perfil. A comparação de planos e o selo são apresentados no próprio perfil; a seção da assinatura fica oculta ao consultar outro perfil. Favoritos de outro perfil são consultáveis por usuário autenticado.

### 2.1 Rotas e superfícies

| Grupo | Rotas principais | Controle |
|---|---|---|
| Identidade | POST /api/auth/cadastro, /login, /esqueci-senha, /redefinir-senha | Público, processado no auth-service |
| Sessão | GET /api/auth/me; POST /api/auth/logout | Cookie válido |
| Filmes | GET /api/filmes | Sessão |
| Favoritos | GET /api/favoritos; POST/DELETE /api/favoritos/{movieId} | Próprio usuário |
| Comentários | GET /api/comentarios e /{movieId}; POST /{movieId}; DELETE /{id} | Consulta/criação próprias; exclusão por dono/admin |
| Admin | GET /api/admin/usuarios; PATCH /api/admin/usuarios/{id}/role; GET /api/logs | Papel admin atual |
| Perfil | GET /api/perfil/me e /{id}; PATCH /{id}; POST /{id}/foto | Leitura autenticada; escrita pelo dono |
| Fotos | GET /api/perfil/fotos/{usuarioId}/{arquivo} | Público, chave limitada |
| Premium | GET /api/premium/status; POST /api/premium/checkout | Própria sessão |
| Stripe | POST /api/stripe/webhook | Assinatura Stripe, sem cookie |
| Operação/docs | /live, /health, /metrics, /apidocs/, /apidocs/auth/, /openapi/catalogo.json, /openapi/auth.json | Leitura pública no catálogo |

Há 28 operações OpenAPI do catálogo e 9 do auth-service. O Swagger interno de auth tem Try it out desabilitado; não cria novos proxies. O log-service possui POST/GET /eventos e /live, /health internos, sem especificação OpenAPI própria.

## 3. Arquitetura e topologia

Setas contínuas representam comunicação da aplicação; pontilhadas representam gestão/execução. A VM é o contexto acadêmico informado. Provedor, capacidade, proxy TLS e encaminhamento do domínio não estão descritos em infraestrutura como código neste repositório.

~~~mermaid
flowchart LR
    B["Navegador do usuario"]
    subgraph VM["VM academica - IaaS no recorte didatico"]
        P["Portainer - gestao da stack"]
        D["Docker Engine"]
        subgraph ST["Stack catalogo-network - PaaS didatico"]
            C["catalogo - Express :3000"]
            A["auth-service :3001"]
            L["log-service :3002"]
            R["Redis :6379 - Stream auditoria"]
            M["MinIO :9000 - fotos"]
        end
        P -. "gerencia" .-> D
        D -. "executa" .-> C
        D -. "executa" .-> A
        D -. "executa" .-> L
        D -. "executa" .-> R
        D -. "executa" .-> M
    end
    subgraph EXT["Dependencias externas ao Compose"]
        SQL["MariaDB - hospedagem nao determinada"]
        T["API TMDB e CDN de posters"]
        S["Stripe - exclusivamente teste"]
        E["Servico SMTP de e-mail"]
    end
    B -->|"HTTP local ou HTTPS publico"| C
    B -->|"HTTPS - posters"| T
    B -->|"HTTPS - Checkout"| S
    C -->|"HTTP - validacao Bearer e proxies"| A
    C -->|"SQL - favoritos, comentarios, perfil e Premium"| SQL
    A -->|"SQL - usuarios e recuperacao"| SQL
    C -->|"HTTP - POST eventos e GET admin"| L
    A -->|"HTTP - POST eventos"| L
    L -->|"HTTP - validacao de sessao"| A
    L -->|"XADD e XREVRANGE"| R
    C -->|"S3 SDK escrita; HTTP leitura"| M
    C -->|"HTTPS - pessoa e creditos"| T
    A -->|"SMTP - link de redefinicao"| E
    C -->|"HTTPS - SDK Stripe"| S
    S -->|"HTTPS POST - webhook assinado"| C
~~~

Não há container MariaDB na stack do projeto. Catálogo e auth-service compartilham a instância SQL; desacoplar autenticação não significa bancos independentes por serviço.

### 3.1 Responsabilidades e dados

| Componente | Responsabilidade e dados trafegados |
|---|---|
| Navegador | HTML/CSS/JS, JSON, formulários, cookie automático, imagens TMDB e navegação ao Stripe |
| Catálogo Express | API pública/frontend; identidade validada, filmes, comentário/bio, avatar, referências Stripe; SQL direto |
| auth-service | Cadastro, hash de senha, emissão/validação JWT, papel atual, recuperação e envio SMTP |
| log-service | JSON de auditoria; valida sessão em auth; serializa campos no Redis |
| Redis | Stream auditoria: ID, usuário, ação, timestamp, IP e detalhes; AOF no volume audit-redis-data |
| MinIO | Objetos perfis/usuario/UUID.ext; binários no volume minio-data e referências no SQL |
| MariaDB externo | Usuários, favoritos, comentários, recuperação, perfis, assinatura e IDs de eventos Stripe |
| TMDB | Busca de pessoa/créditos, títulos, sinopses, datas e URLs de pôster |
| Stripe | Cliente, preço, assinatura, fatura, Checkout e webhook; cartão completo tratado no Stripe |
| SMTP | Destinatário, assunto e mensagem de recuperação; exemplo de desenvolvimento usa Mailtrap |
| Docker/Portainer/VM | Imagens, variáveis privadas, rede, volumes e ciclo de vida; sem regras de negócio |

### 3.2 Infraestrutura e entrega

Fontes: [Compose local](docker-compose.yml), [Portainer](docker-compose.portainer.yml), [Compose CI/CD](docker-compose.cicd.yml), [Dockerfile](Dockerfile), [auth Dockerfile](auth-service/Dockerfile), [log Dockerfile](log-service/Dockerfile), [MinIO Dockerfile](minio/Dockerfile), [workflow](.github/workflows/cicd.yml).

- Local: somente catálogo publica 3000:3000. Auth 3001, log 3002, Redis 6379 e MinIO 9000 são internos.
- Portainer: catálogo publica 8216:3000, NODE_ENV=production; rede bridge catalogo-network, subnet 10.88.0.0/24. Não se presume nome de proxy TLS/provedor.
- --console-address :9001 do MinIO não publica a porta no host; fotos passam pelo catálogo.
- Volumes são minio-data e audit-redis-data. Persistência do banco externo é administrada fora da stack.
- Catálogo depende de auth-service; log aguarda Redis saudável. depends_on sem condição de saúde não garante prontidão.
- Serviços Node usam Node 20 Alpine; MinIO compila código oficial em versão fixada; Redis usa redis:7.4-alpine.
- Compose local faz build; Portainer/CI/CD usam quatro imagens GHCR por IMAGE_TAG. Redis não faz parte dessas quatro imagens construídas.
- Workflow em push/pull_request instala dependências, executa testes/OpenAPI, constrói e verifica imagens sem credenciais.
- Publicação GHCR só ocorre em push de atividade-extra-cicd ou atividade-7-stripe-premium. Premium publica SHA; só atividade-extra-cicd muda latest. Main e esta branch de documentação não satisfazem essa condição.
- Não há job de deploy automático. Atualização manual da stack é distinta de push/merge. Esta atividade não alterou o Portainer.


## 4. Regras de negócio extraídas do código

As tabelas expressam condições e consequências reais. Autorização é feita no backend; ocultar botões não é controle de segurança.

### 4.1 Identidade, recuperação e administração

Fontes: [auth](auth-service/src/auth.js), [validação](auth-service/src/middlewareAuth.js), [proxy](src/auth.js), [middleware catálogo](src/middlewareAuth.js), [recuperação](auth-service/src/recuperacaoSenha.js), [gestão](auth-service/src/gestaoUsuarios.js), [admin](auth-service/src/admin.js).

| Regra | Se ocorrer esta condição | Então o sistema executa este comportamento |
|---|---|---|
| RN01 | Nome/e-mail/senha não forem strings preenchidas no cadastro | Retorna 400; nome/e-mail são aparados e e-mail convertido para minúsculas. Não há validação completa de formato de e-mail. |
| RN02 | Senha de cadastro/redefinição tiver menos de seis caracteres | Retorna 400; senha aceita é armazenada como hash bcrypt com custo 10. |
| RN03 | E-mail normalizado já existir | Retorna 409. Cadastro público sempre grava role usuario; o cliente não escolhe admin. |
| RN04 | Credenciais não corresponderem | Retorna 401; dados obrigatórios ausentes geram 400. Login válido emite JWT de oito horas. |
| RN05 | Login interno devolver JWT | Catálogo grava cookie token HttpOnly, SameSite=Lax, oito horas e Secure em NODE_ENV=production; não devolve JWT no JSON do navegador. |
| RN06 | Cookie estiver ausente, JWT inválido/expirado ou usuário removido | Recusa sessão com 401; falha de consulta HTTP ao auth-service gera 503 no catálogo. |
| RN07 | JWT válido tiver papel antigo | Auth consulta identidade/role atuais no banco; autorização não usa apenas o claim antigo. |
| RN08 | Logout autenticado for solicitado | Tenta auditar e limpa cookie. Não há tabela de sessões, blacklist ou revogação central JWT. |
| RN09 | E-mail de recuperação não existir | Responde a mesma mensagem genérica do caso cadastrado; se existir, gera 32 bytes aleatórios em hexadecimal e persiste token válido por 30 minutos. |
| RN10 | Token de redefinição não existir, estiver usado ou expirado | Retorna 400. Se aceito, atualiza senha e marca aquele token usado; não invalida explicitamente outros tokens ou JWTs. |
| RN11 | Usuário autenticado sem role admin acessar logs/gestão | Retorna 403 e tenta ACAO_NEGADA; sessão ausente/inválida é 401, não ação negada autenticada. |
| RN12 | Alteração de papel tiver ID inválido ou role diferente de usuario/admin | Retorna 400; transação revalida executor/alvo sob lock e rejeita executor sem permissão atual. |
| RN13 | Alteração remover o último admin ou modificar o próprio papel | Retorna 409. Pedido do papel já existente não faz UPDATE nem emite ROLE_ALTERADA. |
| RN14 | Papel de outro usuário mudar efetivamente | Faz commit SQL antes de enviar ROLE_ALTERADA; falha de auditoria não desfaz a alteração. |

A redefinição realiza dois UPDATEs separados, sem transação explícita. Há verificação de usado, mas não consumo atômico para requisições concorrentes. Falha SMTP pode retornar 500 após o token já ter sido persistido. O documento registra essas limitações, sem corrigi-las.

### 4.2 Catálogo, favoritos, comentários e perfil

Fontes: [filmes](src/filmes.js), [favoritos](src/favoritos.js), [listagem](src/listarFavoritos.js), [comentários](src/comentarios.js), [perfil](src/perfil.js), [imagem](src/fotoPerfil.js), [storage](src/minio.js).

| Regra | Se ocorrer esta condição | Então o sistema executa este comportamento |
|---|---|---|
| RN15 | Usuário consultar filmes com sessão | Busca Tom Hanks pelo nome e retorna créditos de elenco em pt-BR; pessoa ausente gera 404, falha TMDB gera 500. Não persiste cópia dos filmes. |
| RN16 | movieId de favorito/comentário não for inteiro positivo | Retorna 400. Não consulta obrigatoriamente TMDB antes de gravar cada ID. |
| RN17 | Usuário adicionar favorito | Insere usuario_id da sessão e tmdb_movie_id; ER_DUP_ENTRY vira 409. Remove só sua dupla usuário/filme; ausência gera 404. Não há quota por plano. |
| RN18 | Usuário listar favoritos/comentários | Filtra sua identidade, ordenando por criado_em decrescente; comentários de um filme também filtram usuario_id. |
| RN19 | Comentário estiver vazio ou só com espaços | Retorna 400; texto aceito é aparado. Não há limite funcional explícito além dos limites técnicos de parser/coluna. Entrada não textual não tem validação de tipo completa nessa rota. |
| RN20 | Comentário existir e solicitante for dono/admin | Permite exclusão por ID; ausência gera 404, falta de permissão gera 403. Evento marca moderação apenas para admin excluindo conteúdo alheio. |
| RN21 | Perfil alheio for consultado com sessão | Retorna nome, bio, foto e favoritos se o usuário existir; ausência gera 404. Escrita é exclusiva do proprietário, inclusive para admin. |
| RN22 | Bio não for string ou exceder 300 pontos de código após trim | Retorna 400; valor válido, inclusive vazio, é gravado por upsert. |
| RN23 | Upload não contiver um único arquivo no campo foto | Recusa partes/campos extras, formato não permitido ou ausência. Limite é 5 × 1024 × 1024 bytes; excesso gera 413. |
| RN24 | Arquivo não for JPEG/PNG/WebP estático compatível com MIME/decodificação | Retorna 400. Sharp limita entrada a 25 milhões de pixels, rejeita múltiplas páginas e reencoda, removendo metadados; corrige orientação e encaixa em 1600 × 1600 sem ampliar. Não exige imagem quadrada. |
| RN25 | Foto válida for enviada | Envia objeto com UUID ao MinIO, trava usuário/perfil e grava chave em transação. Após commit tenta apagar foto antiga. Falha antes do commit tenta limpar objeto novo; commit incerto preserva objetos. |
| RN26 | Navegador pedir foto pública | Aceita apenas chave no padrão perfis/ID/UUID.jpg, .png ou .webp. Chave/objeto ausente gera 404; storage inválido/indisponível, 503. |

Bucket permite GetObject anônimo só no prefixo de perfis, sem listagem/escrita pública; SDK autenticado prepara bucket/política ao enviar. Fotos são públicas pelo desenho atual. Favoritos do perfil combinam IDs locais com dados TMDB; falta de informação visual gera mensagem, sem apagar favorito.

### 4.3 Auditoria e falhas

Fontes: [produtor catálogo](src/auditoria.js), [produtor auth](auth-service/src/auditoria.js), [rotas](log-service/src/eventos.js), [validação](log-service/src/evento.js), [consulta](log-service/src/consulta.js), [Redis](log-service/src/redis.js).

| Regra | Se ocorrer esta condição | Então o sistema executa este comportamento |
|---|---|---|
| RN27 | Ação auditável for concluída | Produtor envia usuário, ação, IP e detalhes específicos; não envia texto integral de comentário, senha ou JWT como conteúdo de negócio. |
| RN28 | Evento não tiver usuário positivo, ação preenchida ou timestamp válido com fuso | Retorna 400; timestamp ausente é gerado em UTC. detalhes deve ser objeto; nomes sensíveis são recusados recursivamente, sem detector universal de segredos em texto livre. |
| RN29 | POST /eventos receber JSON maior que 32 KB | Retorna 413; JSON inválido retorna 400. POST interno não exige JWT; confiança atual depende da rede interna, não da autenticação dos produtores. |
| RN30 | GET /eventos for solicitado | Exige Bearer validado em auth e role admin. limit padrão 50, de 1 a 100; repetição/array inválido é recusado. Busca últimos N e devolve recorte em ordem crescente de ID do Stream. |
| RN31 | Redis/log estiver indisponível ao auditar | Operação principal continua; produtor registra falha genérica, sem fila local durável/reenvio garantido. Consulta administrativa indisponível gera 503. |
| RN32 | Redis desconectar | Cliente reconecta com espera limitada a três segundos e sem fila offline. AOF não recupera eventos que nunca chegaram ao Redis. |

| Evento implementado | Disparo e fonte |
|---|---|
| LOGIN | Login aceito, auth-service/src/auth.js |
| LOGOUT | Logout autenticado, src/auth.js |
| FILME_FAVORITADO / FILME_DESFAVORITADO | Inserção/remoção efetiva, src/favoritos.js |
| COMENTARIO_CRIADO / COMENTARIO_APAGADO | Inserção/exclusão autorizada, src/comentarios.js |
| ROLE_ALTERADA | Mudança efetiva após commit, auth-service/src/admin.js |
| PERFIL_ATUALIZADO / FOTO_PERFIL_ATUALIZADA | Bio/foto confirmada, src/perfil.js |
| ACAO_NEGADA | Exclusão proibida, logs, gestão ou edição de perfil alheio |

Eventos Stripe são distintos: idempotência fica no MariaDB, em stripe_eventos. O módulo Premium não emite esses eventos no Redis.

### 4.4 Checkout e acesso Premium

Fontes: [Premium](src/premium.js), [período](src/premiumPeriodo.js), [CLI](scripts/sincronizar-premium.js), [interface](public/perfil.js), [datas](public/premiumApresentacao.js).

| Regra | Se ocorrer esta condição | Então o sistema executa este comportamento |
|---|---|---|
| RN33 | Stripe não estiver configurado | Funções anteriores não passam a depender de Stripe; checkout retorna 503 claro. Status pode consultar SQL se migração existir. |
| RN34 | Chave não for de teste, objeto/evento não tiver livemode=false ou APP_BASE_URL for inválida | Recusa configuração/objeto. Origem só aceita HTTP(S), sem credenciais, caminho adicional, query ou fragmento. NODE_ENV=production não autoriza Stripe live. |
| RN35 | Preço não for ativo, BRL, 990 centavos e recorrente a cada um mês | Recusa checkout; não aceita preço/valor escolhido pelo navegador. SDK oficial usa API 2026-09-30.endive. |
| RN36 | Cliente ainda não estiver persistido | Cria cliente Stripe com metadata definida pelo backend e chave idempotente; persiste antes da assinatura remota. |
| RN37 | Cliente tiver assinatura não terminal ou lista ambígua/paginada | Retorna 409; só canceled/incomplete_expired são terminais. Checkout aberto é reutilizado; concluído sem assinatura visível permanece pendente. |
| RN38 | Novo checkout for elegível | Cria mode=subscription, quantidade um, metadata/client_reference_id da sessão. URLs vêm de APP_BASE_URL; resposta contém URL de navegação. |
| RN39 | Navegador voltar com premium=sucesso | Frontend consulta status; não concede benefício nem altera banco. Sem confirmação, mostra pendência. |
| RN40 | Webhook não tiver assinatura válida sobre corpo bruto | SDK constructEvent recusa com 400; configuração ausente gera 503. express.raw é instalado antes de express.json. |
| RN41 | ID de evento já estiver em stripe_eventos | INSERT IGNORE por PK evita reaplicar. Registro e atualização são transacionais; erro faz rollback e 503. Evento ignorado pode ser registrado sem mudar assinatura: 200 isolado não prova ativação. |
| RN42 | Assinatura, cliente, metadata ou Checkout divergirem do vínculo backend | Não concede acesso. Consulta assinatura atual sob lock, sem confiar só no snapshot recebido. |
| RN43 | invoice.paid tiver fatura elegível | Recupera fatura atual; exige teste, status paid, BRL, amount_paid de pelo menos 990, vínculos cliente/assinatura/item/preço, quantidade um e uma linha não proporcional com período válido; lista de linhas deve estar completa. Avança período pago. |
| RN44 | Evento indicar apenas assinatura active sem fatura paga validada | Atualiza situação sem criar período pago. Trata invoice.paid, invoice.payment_failed e customer.subscription.created/updated/deleted; não depende de checkout.session.completed. |
| RN45 | Pagamento/situação forem antigos | Fim pago não retrocede; situação só muda com marca temporal não anterior à persistida. Períodos consecutivos são unidos. Snapshot atual sob lock e state_event_created protegem contra ordem invertida. |
| RN46 | Acesso for consultado | Exige cliente, assinatura, fatura paga, preço correto, início já ocorrido, fim futuro, cancel_at não vencido e status active/past_due/unpaid. Não depende só de premium=true nem chama Stripe a cada requisição. |
| RN47 | Período vencer sem renovação paga | GET status calcula premium=false, mesmo se projeção SQL ainda disser true. exigirPremium usa mesma regra para benefícios que o adotem; benefício atual é selo via estado público. |
| RN48 | Cancelamento for programado | Preserva acesso até o menor limite entre fim pago e cancel_at. Cancelamento imediato/status não permitido retira acesso. Não há botão/endpoint local de cancelamento ou portal de cobrança. |
| RN49 | Pagamento falhar | Mostra regularização e não cria período; preserva apenas período pago ainda válido em past_due/unpaid. Renovação paga válida estende acesso. |
| RN50 | Renovação automática ativa tiver data futura | Retorna renovacao_em; cancelamento programado retorna termina_em enquanto acesso válido. Frontend usa datas reais em America/Sao_Paulo; omite linha sem data. |
| RN51 | Operador executar sincronização | Recupera assinatura/faturas pagas existentes e valida metadata/cliente/preço; prévia não faz UPDATE. Só --aplicar grava em transação. Não cria checkout/pagamento e não tem endpoint para identidade de terceiros. |

Há um registro de assinatura por usuário. Novo checkout elegível pode substituir referências terminais: não é histórico completo de assinaturas. Sincronização pagina faturas pagas e escolhe período elegível com maior término. Rateios e lista incompleta de linhas não confirmam período neste plano simples.

### 4.5 Observabilidade e disponibilidade

Fontes: [probes](src/saude.js), [SQL de saúde](src/saudeBanco.js), [métricas](src/metricas.js), servidores dos três serviços.

- Se /live responde, então retorna 200 sem consultar dependências.
- Se algum probe de /health falha/excede prazo, então retorna 503 com nomes/estados, sem mensagens privadas das dependências.
- Catálogo verifica MariaDB, readiness de auth, MinIO e TMDB; auth verifica MariaDB e SMTP sem enviar e-mail; log verifica Redis e readiness de auth.
- /health do catálogo não consulta log-service nem Stripe. Saúde não comprova checkout ou auditoria.
- Prazo geral dos probes: dois segundos; HTTP: 1,8 segundo; SQL: conexão/consulta de 900 ms; SMTP: prazos de 700 ms.
- Healthcheck falho marca container unhealthy. restart: unless-stopped não reinicia automaticamente um processo só por estar unhealthy.
- /metrics expõe contador HTTP e histograma de duração, com método, template da rota e status; sem IDs, query, usuário ou tokens nos labels. Compose não define Prometheus/Grafana.
- Falhas não têm status universal: cadastro/login/comentários usam 500 em vários casos; perfil/Premium usam 503. Nem toda chamada de negócio tem timeout/retry explícito.


## 5. Modelo de dados

### 5.1 Origem e limites do esquema

Migrações criam reset_tokens, perfis, premium_assinaturas e stripe_eventos e acrescentam role a usuarios. O DDL inicial de usuarios, favoritos e comentarios não está em database.

O diagrama usa campos das consultas/migrações e o [esquema de referência de QA](test/perfil-integracao.js). As marcações PK em usuarios.id e comentarios.id são confirmadas nesse esquema de teste, não por DDL inicial de produção versionado. Relações logico_sem_DDL expressam o vínculo por usuario_id nas consultas; FKs físicas/cascatas dessas tabelas no banco publicado não foram verificadas nesta atividade. Não se afirma inspeção atual do banco real.

~~~mermaid
erDiagram
    usuarios {
        INT id PK "PK no esquema QA; referenciada nas migracoes"
        VARCHAR nome "consultado e gravado"
        VARCHAR email "busca normalizada"
        VARCHAR senha_hash "hash bcrypt; valor privado"
        VARCHAR role "padrao usuario na migracao 3"
    }
    favoritos {
        INT usuario_id "vinculo por SQL; DDL original ausente"
        INT tmdb_movie_id "identificador externo"
        TIMESTAMP criado_em "ordenacao por SQL"
    }
    comentarios {
        INT id PK "PK no esquema QA"
        INT usuario_id "vinculo por SQL; DDL original ausente"
        INT tmdb_movie_id "identificador externo"
        TEXT texto "aparado; tipo no esquema QA"
        TIMESTAMP criado_em "ordenacao por SQL"
    }
    reset_tokens {
        INT id PK
        VARCHAR token UK "128; valor privado"
        INT usuario_id FK
        TIMESTAMP criado_em
        TIMESTAMP expira_em
        BOOLEAN usado
    }
    perfis {
        INT usuario_id PK,FK
        VARCHAR bio "300"
        VARCHAR foto_chave "500; referencia MinIO"
    }
    premium_assinaturas {
        INT usuario_id PK,FK
        BOOLEAN premium "projecao; padrao false"
        VARCHAR stripe_customer_id UK "255; nullable"
        VARCHAR stripe_subscription_id UK "255; nullable"
        VARCHAR stripe_checkout_id "255; nullable"
        VARCHAR stripe_paid_invoice_id "255; nullable"
        VARCHAR status "40; padrao nenhuma"
        VARCHAR stripe_price_id "255; nullable"
        BIGINT paid_period_start "unsigned; epoch segundos"
        BIGINT paid_period_end "unsigned; epoch segundos"
        BOOLEAN cancel_at_period_end "padrao false"
        BIGINT cancel_at "unsigned; nullable"
        BIGINT next_renewal_at "unsigned; nullable"
        BOOLEAN payment_problem "padrao false"
        BIGINT state_event_created "unsigned; padrao zero"
    }
    stripe_eventos {
        VARCHAR id PK "255; ID externo"
        VARCHAR tipo "100"
        TIMESTAMP processado_em "padrao CURRENT_TIMESTAMP"
    }
    usuarios ||..o{ favoritos : "logico_sem_DDL"
    usuarios ||..o{ comentarios : "logico_sem_DDL"
    usuarios ||..o{ reset_tokens : "FK_migracao3"
    usuarios ||--o| perfis : "PK_FK_migracao6"
    usuarios ||--o| premium_assinaturas : "PK_FK_migracao7"
~~~

Um usuário pode ter zero ou muitos favoritos/comentários/tokens e zero ou um perfil/assinatura persistida. Cada registro relacionado pressupõe um usuário. As três FKs criadas pelas migrações de reset_tokens, perfis e premium_assinaturas têm ON DELETE CASCADE. Não há rota de exclusão de usuário.

stripe_eventos não tem FK para usuário, assinatura ou fatura. ID é a chave idempotente externa; processado_em é o horário local de inserção, não necessariamente a origem do evento. Não se desenha relação física inexistente com premium_assinaturas.

### 5.2 Campos e persistências distintas

| Estrutura | Afirmação sustentada pelas fontes |
|---|---|
| usuarios | SQL usa id, nome, email, senha_hash e role; migração 3 define role VARCHAR(20) NOT NULL DEFAULT usuario. Comprimentos originais e unicidade física de email na produção exigem DDL/inspeção autorizada. |
| favoritos | SQL usa usuario_id, tmdb_movie_id e criado_em; código trata ER_DUP_ENTRY. UNIQUE(usuario_id,tmdb_movie_id) existe em QA, mas migração original não está versionada. O ER parcial não inventa a PK original. |
| comentarios | SQL comprova id, usuario_id, tmdb_movie_id, texto e criado_em; TEXT/PK vêm do esquema QA. Não se inventa limite funcional de caracteres. |
| reset_tokens | Migração 3: ID autoincremental, token único, expiração, usado e FK. Token é texto, não hash; seus valores não são documentados. |
| perfis | Migração 6: usuario_id PK/FK, bio e foto_chave opcionais; sem linha de perfil, API devolve bio vazia/foto ausente. |
| premium_assinaturas | Migração 7 e complemento: cliente/assinatura únicos, referências opcionais, status e período. Epochs são UTC em segundos. Booleano é projeção, não autorização suficiente. |
| stripe_eventos | Migração 7: ID único, tipo e processado_em. Sem payload, usuário ou histórico de sincronização CLI. |
| Filmes | TMDB é a origem; não há tabela local filmes nas migrações/consultas atuais. tmdb_movie_id não é FK para tabela de filmes local. |
| Fotos | Binário no MinIO; foto_chave no SQL. foto_url é montada pelo proxy do catálogo. |
| Auditoria | Redis Stream auditoria, sem tabela SQL/FK; não se confunde com stripe_eventos. |
| Cartões | Checkout Stripe coleta; catálogo não persiste número completo, CVV ou validade. |

Migrações são explícitas, não automáticas no startup. O script [migrar-premium](scripts/migrar-premium.js) com --aplicar executa original e complemento Premium; não cria esquema inicial. DDL MariaDB pode fazer commit implícito: backup/conferência do destino são requisitos operacionais, não ações desta documentação.

## 6. Fluxos importantes

### 6.1 Login e validação de sessão

1. Navegador envia e-mail/senha ao POST /api/auth/login; catálogo encaminha ao /auth/login interno.
2. Auth normaliza e-mail, consulta usuário e compara bcrypt. Emite JWT de oito horas e tenta registrar LOGIN.
3. Catálogo grava cookie HttpOnly e devolve apenas usuário/mensagem.
4. Em rota protegida, encaminha cookie como Bearer ao GET /auth/validar. Auth verifica JWT e consulta identidade/role atuais no SQL.
5. Sessão inválida retorna 401; logout autenticado tenta auditar e limpa cookie, sem revogação central.

### 6.2 Recuperação de senha

1. Formulário envia e-mail pelo catálogo ao auth-service.
2. Havendo conta, auth gera token, grava validade de 30 minutos e envia link via SMTP. Resposta bem-sucedida é genérica com ou sem conta.
3. Link abre redefinir-senha.html; formulário envia token e nova senha pelo proxy.
4. Auth confere existência, usado e expiração; atualiza hash e depois marca token usado.
5. Nova senha permite login. Não há consumo atômico do token nem revogação dos JWTs existentes.

### 6.3 Upload de avatar

1. Perfil próprio envia multipart/form-data com uma foto.
2. Backend valida sessão/ID/propriedade antes do upload.
3. Multer limita arquivo/partes; Sharp valida conteúdo, formato e pixels, rejeita animação e reencoda.
4. Storage prepara bucket/política e envia objeto com UUID.
5. Transação trava usuário/perfil e faz upsert da chave; após commit tenta apagar foto antiga.
6. Frontend usa foto_url do catálogo; GET público valida chave e busca imagem no MinIO.

### 6.4 Registro e consulta administrativa de auditoria

1. Após ação, catálogo/auth tenta POST interno /eventos com usuário, ação, IP e detalhes.
2. Log valida JSON/campos e usa XADD no Stream auditoria. Falha não desfaz a ação principal.
3. Admin solicita GET /api/logs?limit=N; catálogo valida sessão/papel.
4. Log também valida Bearer/role em auth e consulta XREVRANGE.
5. Retorna últimos N em ordem crescente de ID; painel filtra/renderiza recorte e calcula contadores dessa janela.

### 6.5 Checkout, pagamento e ativação Premium

1. Perfil próprio obtém status backend; elegibilidade visual não substitui validação.
2. POST checkout valida sessão, configuração de teste e preço; garante cliente persistido com metadata.
3. Consulta assinaturas para impedir duplicação, reutiliza sessão aberta ou cria subscription; devolve URL de navegação.
4. Stripe coleta pagamento na página hospedada. Retorno premium=sucesso é somente navegação.
5. Webhook recebe bytes brutos; SDK valida Stripe-Signature e modo de teste.
6. Transação insere ID idempotente, trava registros e confere vínculos com consultas atuais no Stripe.
7. invoice.paid elegível confirma período. Outros eventos atualizam estado sem inventar pagamento. Commit registra evento e atualização; erro faz rollback/503.
8. Status calcula acesso por período persistido e relógio backend; frontend mostra selo/situação/data ou pendência. Consulta ocorre ao carregar e no botão Atualizar confirmação, sem polling contínuo obrigatório.
9. Renovação paga estende período; falha não estende; cancelamento programado preserva somente o período válido.
10. CLI pode recuperar faturas pagas de vínculo existente sem novo pagamento. Prévia e --aplicar são distintos; não executados nesta atividade.

## 7. Classificação cloud

A tabela está no [README — Classificação SaaS, PaaS e IaaS](README.md#classificação-saas-paas-e-iaas). No recorte didático, catálogo é SaaS, VM é IaaS e Docker/Portainer representam PaaS de execução.

Containers próprios em VM não comprovam contratação de PaaS gerenciado. Redis/MinIO são componentes autogerenciados; MariaDB externo não revela se está em VM, container, máquina física ou DBaaS. SMTP é protocolo, não prova de modalidade contratual. Não se deduz hospedagem pelo nome do host.

Valores privados vêm do ambiente, sem reprodução aqui. Limites de confiança: cookie no catálogo; Bearer interno para validação/consulta; POST de auditoria sem autenticação de produtor; webhook Stripe com assinatura própria. Cadastro/login encaminham credenciais em JSON na rede interna HTTP; TLS no acesso público não comprova criptografia entre containers.

## 8. Verificação, evidências e limitações

### 8.1 Verificações desta entrega

Os comandos foram executados no checkout isolado, sem copiar .env reais:

~~~sh
npm test
npm run docs:validate
git diff --check
~~~

Resultado: **84 testes aprovados, zero falhas**, OpenAPI 3.0.3 válido para catálogo e auth-service. Os dois diagramas Mermaid e os links relativos/âncoras visíveis foram validados antes do commit. Validador em diretório temporário não altera dependências da aplicação.

npm test inclui test/*.test.js, auth-service/test/*.test.js e log-service/test/consulta.js. O teste log-service/test/eventos.js depende de Redis/log-service ativos, grava eventos e não foi executado nesta entrega. A suíte padrão também não inclui o cenário manual [perfil-integracao.js](test/perfil-integracao.js), que exige laboratório catalogo_qa e serviços próprios. Esse script não deve ser apontado ao banco publicado.

### 8.2 Implementação, teste e evidência externa

As [evidências Premium no README](README.md#evidências-reais-da-atividade-7) mostram perfil Gratuito, tela do Checkout, pagamento no Dashboard, entrega do webhook, Premium no banco e perfil Premium anterior com data. São registros de momentos/contas que não devem ser apresentados como uma única sequência. Não há captura da confirmação final dentro do Checkout.

Testes Premium simulam Stripe, banco e relógio, com assinatura criptográfica real do SDK no webhook. Comprovam cenários programados, não um novo checkout externo. Capturas históricas não são uma validação integrada reexecutada nesta atividade.

### 8.3 Limitações conhecidas

- DDL inicial incompleto: usuarios, favoritos e comentarios usam esquema QA como referência explicitada; não houve inspeção do banco publicado.
- Sem inventário versionado da VM, proxy TLS ou modalidade de hospedagem do banco/SMTP.
- JWT sem revogação central; redefinição de senha sem consumo transacional do token.
- Auditoria de melhor esforço, sem fila durável; POST interno confia na rede e filtro de sensíveis usa nomes de campos.
- Moderação sem listagem global de comentários; sem exclusão de usuário ou portal local de cancelamento Stripe.
- Premium mantém estado/referências, não histórico completo. stripe_eventos não permite atribuição por SQL a usuário nem distingue sincronização de webhook.
- premium armazenado pode ficar desatualizado com o tempo: função acessoValido decide o benefício na consulta.
- Health checks não garantem todo fluxo nem reiniciam sozinhos containers unhealthy; sem serviço Prometheus/Grafana definido.
- Suíte padrão não é teste integrado de rede real com SMTP, TMDB, Stripe, MinIO e banco publicado.

Nenhuma limitação foi corrigida por alteração de código nesta atividade documental.

### 8.4 Cinco requisitos atendidos

| Requisito | Local |
|---|---|
| 1. Especificação funcional | Seção 2: funcionalidades, atores e acesso |
| 2. Arquitetura | Seção 3: Mermaid próprio, topologia e responsabilidades |
| 3. Regras de negócio | Seção 4: condições/consequências com fontes; seção 6: fluxos |
| 4. Modelo de dados | Seção 5: ER, chaves/cardinalidades e limites do DDL |
| 5. SaaS/PaaS/IaaS | Seção 7 e tabela no README, com ressalvas técnicas |

Link visível, históricos, imagens e menção ao professor são preservados no README. Esta entrega não faz merge na main, release ou deploy.
