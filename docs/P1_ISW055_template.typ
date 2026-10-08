// ============================================================
//  P1 — Relatório bimestral de atividades (entrega INDIVIDUAL)
//  ISW055 · Introdução à Computação em Nuvem · Fatec Pompeia · 2026.2
//
//  COMO USAR
//  1. Preencha a seção DADOS DO ALUNO logo abaixo.
//  2. Em cada #atividade(...), preencha "realizada", "situacao" e "url",
//     e escreva o corpo: o que você fez, prints e dificuldades.
//  3. Salve os prints numa pasta "prints/" ao lado deste arquivo e troque
//     `arquivo: none` por `arquivo: "prints/nome-do-print.png"`.
//  4. Compile em https://typst.app (Novo projeto → envie este arquivo e a
//     pasta prints) ou no terminal: typst compile P1_ISW055_template.typ
//  5. Apague os blocos cinza de orientação quando terminar.
//
//  Entrega: 07/10/2026 · PDF nomeado P1_ISW055_Nome_Sobrenome.pdf
// ============================================================

// ---------- DADOS DO ALUNO (edite aqui) ----------
#let aluno = "Luana Beatriz Ribeiro Abrantes"
#let turma = "Sistemas Inteligentes"
#let data-relatorio = "07/10/2026"

// ---------- daqui pra baixo, só mexa nas fichas de atividade ----------
#let disciplina = "Introdução à Computação em Nuvem"
#let codigo = "ISW055"
#let professor = "Prof. Allan Lincoln Rodrigues Siriani"
#let accent = rgb("#b96f1f")

#set document(title: "P1 — " + codigo + " — " + aluno, author: aluno)
#set page(paper: "a4", margin: (top: 2.5cm, bottom: 2.5cm, left: 2.5cm, right: 2cm))
#set text(size: 11pt, lang: "pt", region: "BR")
#set par(justify: true, leading: 0.7em)
#set heading(numbering: "1.1")
#show heading.where(level: 1): it => { v(0.6em); text(size: 16pt, it); v(0.2em) }
#show heading.where(level: 2): it => { v(0.5em); text(size: 13pt, it); v(0.1em) }
#show link: set text(fill: accent)
#show figure.caption: set text(size: 9pt, fill: luma(90))
#set table(stroke: 0.5pt + luma(200), inset: 6pt)
#show table: set text(hyphenate: false)
#show table: set par(justify: false)

// ---------- ajudantes ----------
#let orientacao(body) = block(
  width: 100%, fill: luma(245), inset: 9pt, radius: 4pt,
  stroke: (left: 2pt + luma(180)),
  text(size: 9.5pt, fill: luma(90), body),
)

#let evidencia(legenda, arquivo: none) = figure(
  if arquivo == none {
    rect(width: 100%, height: 5.5cm, radius: 4pt, stroke: (paint: luma(170), dash: "dashed"))[
      #align(center + horizon)[
        #text(fill: luma(130), size: 9.5pt)[
          cole o print aqui \
          troque `arquivo: none` por `arquivo: "prints/nome.png"`
        ]
      ]
    ]
  } else {
    image(arquivo, width: 100%)
  },
  kind: image,
  supplement: [Figura],
  caption: legenda,
)

#let registro = state("registro", ())

#let atividade(
  numero, titulo,
  descricao: "",
  planejada: "",
  realizada: "—",
  situacao: "entregue",   // entregue · entregue com atraso · não entregue
  evidencia: "",
  url: "",
  link-texto: none,
  corpo,
) = {
  registro.update(l => l + ((
    numero: numero, titulo: titulo, descricao: descricao,
    planejada: planejada, realizada: realizada, situacao: situacao,
  ),))
  heading(level: 2, [Atividade #numero — #titulo])
  table(
    columns: (3.4cm, 1fr),
    fill: (x, y) => if x == 0 { luma(245) } else { none },
    [*Descrição*], [#descricao],
    [*Data planejada*], [#planejada],
    [*Data realizada*], [#realizada],
    [*Situação*], [#situacao],
    [*Evidência*], [#evidencia],
    [*Link*], [#if link-texto != none [#link-texto] else if url == "" [—] else [#link(url)]],
  )
  corpo
}

// ============================================================
//  CAPA
// ============================================================
#align(center)[
  #v(2.5cm)
  #text(size: 12pt, tracking: 0.12em)[FATEC POMPEIA]
  #v(0.4em)
  #text(size: 10.5pt, fill: luma(110))[#disciplina · #codigo · #turma]
  #v(4.5cm)
  #text(size: 26pt, weight: "bold")[P1]
  #v(0.3em)
  #text(size: 18pt, weight: "bold")[Relatório bimestral de atividades]
  #v(0.8em)
  #text(size: 11pt, fill: luma(110))[Avaliação individual · 2026.2]
  #v(5cm)
  #text(size: 14pt)[#aluno]
  #v(1fr)
  #text(size: 10.5pt)[#professor \ Pompeia, #data-relatorio]
]

#set page(
  numbering: "1",
  number-align: right,
  header: context {
    set text(size: 8pt, fill: luma(120))
    [#codigo · P1 — Relatório bimestral #h(1fr) #aluno]
    line(length: 100%, stroke: 0.4pt + luma(200))
  },
)
#counter(page).update(1)

#outline(title: "Sumário", indent: 1.2em, depth: 2)
#pagebreak()

// ============================================================
= Introdução
// ============================================================
A disciplina Introdução à Computação em Nuvem (ISW055) aborda o desenvolvimento e a publicação de aplicações, envolvendo contêineres, microsserviços, autenticação, controle de acesso e armazenamento de dados. Durante o bimestre, esses conceitos foram trabalhados em atividades práticas, permitindo acompanhar a evolução de uma aplicação e compreender a comunicação entre seus serviços.

A primeira atividade foi realizada em sala de aula e consistiu em uma agenda desenvolvida em Python com Flask, com cadastro e listagem de clientes e persistência em arquivo JSON. Em seguida, foi desenvolvido um catálogo de filmes de Tom Hanks com Node.js e Express, integrado à API TMDB e ao MariaDB para armazenar os dados dos usuários, favoritos e comentários. Nas etapas seguintes, o catálogo recebeu um microsserviço de autenticação, permissões para usuários e administradores, registros de auditoria e um perfil de usuário com upload de imagem para o MinIO.

Este relatório apresenta as seis atividades realizadas, descrevendo as funcionalidades implementadas, as dificuldades encontradas e as soluções adotadas. As entregas são acompanhadas de links e capturas de tela, enquanto a metodologia explica o processo de desenvolvimento e os critérios utilizados para registrar as datas de realização.

// ============================================================
= Metodologia
// ============================================================
O desenvolvimento das atividades ocorreu de forma progressiva. A primeira prática foi realizada em sala de aula, com a construção de uma agenda em Python e Flask. A partir da segunda atividade, o trabalho se concentrou no projeto `catalogo-filmes`, desenvolvido no Visual Studio Code e versionado no GitHub. Cada etapa acrescentou funcionalidades ao catálogo, permitindo aplicar os conteúdos da disciplina e verificar sua integração com os recursos já implementados.

As funcionalidades foram verificadas por meio da execução local, de testes das rotas e da interação com as telas do sistema, incluindo cadastro, login, favoritos, comentários e permissões de acesso. O Docker Compose foi utilizado para configurar os contêineres e a comunicação entre os serviços, enquanto a publicação no servidor da disciplina foi gerenciada pelo Portainer. Os problemas encontrados durante a implementação foram investigados e corrigidos, com novas verificações após os ajustes.

As datas e os horários das atividades versionadas foram obtidos pelo histórico de commits do Git, considerando o fuso horário de Brasília (UTC−03). Os registros selecionados como referência são identificados nas fichas e acompanhados de links para consulta no GitHub. Para a atividade em Flask, realizada sem versionamento, foram utilizados a data e o horário informados da prática em sala de aula. A situação de cada entrega foi definida pela comparação entre a data registrada e o prazo previsto pelo professor.

A documentação de cada atividade reúne a descrição do trabalho realizado, as dificuldades encontradas, as soluções adotadas e as evidências correspondentes. As capturas de tela apresentam as interfaces, as configurações e os resultados observados, complementando os registros do repositório e permitindo verificar os recursos descritos no relatório.

// ============================================================
= Quadro de entregas
// ============================================================
#context {
  let l = registro.final()
  table(
    columns: (auto, 1.4fr, 2fr, 2.6cm, 2.9cm, 2.3cm),
    align: (center, left, left, center, center, center),
    fill: (x, y) => if y == 0 { luma(235) } else { none },
    table.header([*Nº*], [*Atividade*], [*Descrição*], [*Data \ planejada*], [*Data \ realizada*], [*Situação*]),
    ..l.map(a => (
      [#a.numero], [#a.titulo], [#text(size: 9pt)[#a.descricao]],
      [#a.planejada], [#a.realizada], [#a.situacao],
    )).flatten()
  )
}

// ============================================================
= Atividades realizadas
// ============================================================
#atividade(
  "1", "Agenda telefônica em Flask",
  descricao: "Aplicação web em Python com Flask para cadastro e listagem de clientes, com persistência em arquivo JSON.",
  planejada: "07/08/2026",
  realizada: "07/08/2026 21:00",
  situacao: "entregue",
  evidencia: "Realizada em sala de aula, sem versionamento — captura de tela da aplicação em funcionamento.",
  link-texto: "Não se aplica — atividade local, sem versionamento.",
)[
  *O que foi feito.*

  Foi desenvolvida uma agenda de clientes em Python com Flask, reunindo o formulário de cadastro, a listagem e o processamento dos dados em uma aplicação monolítica. A interface permite informar nome, telefone e valor, consultar os registros em uma tabela e visualizar a quantidade total de cadastros.

  A persistência foi realizada em um arquivo JSON, utilizado para salvar e recuperar os registros, sem necessidade de um banco de dados relacional. Além da interface no navegador, foram disponibilizadas as rotas `GET /cadastro` e `POST /cadastro`, permitindo consultar e inserir dados por requisições em formato JSON.

  A atividade foi realizada em sala de aula no dia 07/08/2026, às 21h00, e não foi versionada no GitHub. A captura de tela apresenta o formulário e a listagem de clientes, documentando o resultado da aplicação.

  #evidencia([Atividade 1 — Aplicação Flask com formulário de cadastro e listagem de clientes.], arquivo: "prints/atividade-1-flask.png")

  *Dificuldades e como foram resolvidas.*

  A principal dificuldade foi executar a aplicação Flask pelo terminal do Visual Studio Code. Houve dúvida sobre o comando necessário para iniciar o servidor e como acessar o sistema no navegador. A dificuldade foi resolvida em sala de aula com o auxílio do professor, que explicou o procedimento de execução. Após a orientação, foi possível iniciar a aplicação e conferir o formulário e a listagem de clientes.
]

#atividade(
  "2", "Catálogo de filmes — Tom Hanks",
  descricao: "Consumo da API TMDB, persistência em MariaDB e favoritos e comentários separados por usuário.",
  planejada: "20/08/2026",
  realizada: "20/08/2026 13:49",
  situacao: "entregue",
  evidencia: "GitHub — commit 0e3b62a, README e captura do catálogo em funcionamento.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/0e3b62a",
)[
  *O que foi feito.*

  Foi desenvolvida uma aplicação web para consultar filmes de Tom Hanks, utilizando Node.js e Express no backend e integração com a API TMDB para obter os dados apresentados no catálogo. A interface organiza os filmes em cartões com cartaz, título, ano de lançamento e sinopse, além de permitir que o usuário marque seus favoritos e publique comentários.

  A persistência dos dados foi implementada no MariaDB, com armazenamento das contas de usuários, dos favoritos e dos comentários. Cada favorito foi vinculado ao usuário autenticado, mantendo uma seleção individual por conta, enquanto os comentários foram associados ao seu autor e ao filme correspondente.

  Para disponibilizar a aplicação no servidor da disciplina, o projeto foi empacotado em uma imagem Docker e implantado pelo Portainer. Após a publicação, foram verificadas a exibição dos filmes e as operações de favoritar e comentar, confirmando a integração entre a interface, o backend e o banco de dados.

  #evidencia([Atividade 2 — Registro do commit da entrega, com identificação do repositório, data e horário.], arquivo: "prints/atividade-2-commit.png")
  #evidencia([Atividade 2 — Catálogo em funcionamento, com filme favoritado e comentário publicado.], arquivo: "prints/atividade-2-catalogo.png")
  #evidencia([Atividade 2 — README do repositório com a apresentação do catálogo, referência à disciplina e endereço da aplicação publicada.], arquivo: "prints/atividade-2-readme.png")

  *Dificuldades e como foram resolvidas.*

  A atividade envolveu autenticação, integração com a TMDB e deploy da aplicação. Uma das dificuldades foi configurar corretamente a autenticação dos usuários, utilizando `bcryptjs` para proteger as senhas, JWT para autenticação e cookies `HttpOnly` para manter a sessão. Também foi necessário entender o fluxo de consulta da API do TMDB, primeiro buscando o identificador de Tom Hanks e depois seus créditos em filmes, mantendo essas requisições no backend. No deploy, a principal dificuldade foi atualizar corretamente a aplicação no Portainer após alterações no projeto. Para isso, a imagem Docker foi recriada, enviada ao Docker Hub e o container foi atualizado com as variáveis de ambiente e portas configuradas corretamente.
]

#atividade(
  "3", "Desacoplando o login — microsserviço de autenticação",
  descricao: "Separação da autenticação do catálogo em um microsserviço responsável por cadastro, login, validação de sessão e recuperação de senha.",
  planejada: "28/08/2026",
  realizada: "28/08/2026, às 18h20 (UTC−03)",
  situacao: "Entregue",
  evidencia: "Histórico de commits, configuração Docker Compose e capturas das telas de login e cadastro.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/02542ae",
)[
  *O que foi feito.*

  A autenticação foi separada do catálogo de filmes e implementada em um microsserviço chamado `auth-service`, desenvolvido com Node.js e Express. Esse serviço passou a concentrar o cadastro de usuários, o login, a validação de sessão e a recuperação de senha. O catálogo manteve a interface acessada pelo usuário e passou a encaminhar as solicitações de autenticação ao serviço, preservando o acesso às funcionalidades de favoritos e comentários.

  No cadastro e no login, foram utilizados `bcryptjs` para gerar e verificar os hashes das senhas e JWT para identificar o usuário autenticado. O token foi armazenado em um cookie `HttpOnly`, impedindo seu acesso direto pelo JavaScript da interface. A consulta da sessão permitia verificar a autenticação do usuário antes do acesso aos recursos protegidos.

  A recuperação de senha foi implementada com envio de e-mail pelo Mailtrap, contendo um link para redefinição e um token com validade de 30 minutos. Após sua utilização, o token não podia ser reutilizado. Foram realizados testes de cadastro, login, consulta da sessão e redefinição de senha, incluindo tentativas com tokens inválidos ou já utilizados.

  A execução dos serviços foi organizada pelo Docker Compose, com o catálogo e o `auth-service` em contêineres separados. O catálogo utilizava a porta 3000 e se comunicava com a autenticação pela rede interna do Docker, no endereço `http://auth-service:3001`. A porta do `auth-service` não era publicada no host, mantendo o acesso ao microsserviço pela comunicação interna entre os contêineres.

  #evidencia([Atividade 3 — Histórico de commits referente à implementação do microsserviço de autenticação.], arquivo: "prints/atividade-3-commits.png")
  #evidencia([Atividade 3 — Configuração do Docker Compose com o catálogo e o serviço de autenticação em contêineres separados.], arquivo: "prints/atividade-3-compose.png")
  #evidencia([Atividade 3 — Interface de cadastro de usuários.], arquivo: "prints/atividade-3-cadastro.png")
  #evidencia([Atividade 3 — Interface de login com acesso ao cadastro e à recuperação de senha.], arquivo: "prints/atividade-3-login.png")
  #figure(image("prints/atividade-3-recuperacao-envio.png", width: 7cm), kind: image, supplement: [Figura], caption: [Atividade 3 — Confirmação da solicitação de recuperação de senha.])
  #evidencia([Atividade 3 — E-mail de recuperação recebido no Mailtrap, contendo o link para redefinição de senha.], arquivo: "prints/atividade-3-recuperacao-mailtrap.png")
  #figure(image("prints/atividade-3-recuperacao-link.png", width: 7cm), kind: image, supplement: [Figura], caption: [Atividade 3 — Rejeição de um link de recuperação de senha já utilizado.])

  *Dificuldades e como foram resolvidas.*

  A principal dificuldade foi separar a autenticação do catálogo e transferi-la para um microsserviço próprio, mantendo o catálogo como único ponto de entrada público. Também foi necessário configurar o fluxo de recuperação de senha, com geração de token aleatório, validade de 30 minutos, uso único e envio de e-mail. A integração do envio por SMTP exigiu ajustes nas variáveis de ambiente, primeiro utilizando o Mailtrap durante os testes e depois o Brevo no ambiente de produção, sem alterar a lógica principal da aplicação. Outra dificuldade ocorreu no deploy pelo Portainer, pois o Docker não conseguia criar automaticamente uma nova rede devido ao esgotamento e à sobreposição de sub-redes existentes no servidor. A solução foi definir manualmente uma sub-rede livre no `docker-compose.portainer.yml`, utilizando `10.88.0.0/24`.
]

#atividade(
  "4", "Controle de acesso por papel — RBAC",
  descricao: "O campo role passa a decidir permissões reais no backend (403 para usuário comum).",
  planejada: "04/09/2026",
  realizada: "04/09/2026 18:16:15 (UTC−03:00)",
  situacao: "entregue",
  evidencia: "GitHub — commit + print do 403 e da ação de admin",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/03f8d88ebcd2c413d841c5666d29d0aac0c661c5",
)[
  *O que foi feito.*

  Foi implementado o controle de acesso por papéis (RBAC) no catálogo de filmes, com dois tipos de conta: `user`, para usuários comuns, e `admin`, para administradores. Ambos podem consultar o catálogo, favoritar filmes e publicar comentários. As operações administrativas passaram a exigir a validação do papel da conta no backend.

  O `auth-service` foi ajustado para consultar o papel atual do usuário durante a validação da sessão e repassar essa informação ao catálogo. Dessa forma, a autorização considera a permissão registrada para a conta no momento da consulta, sem depender apenas do papel presente no token JWT.

  Na exclusão de comentários, o backend verifica a identidade do usuário autenticado, seu papel e a autoria do comentário. A regra permite que o usuário comum remova somente os próprios comentários e que o administrador exclua comentários de qualquer usuário.

  A validação das permissões foi feita no backend, de forma que tentativas de acesso sem autorização retornem `403 Forbidden`, mesmo quando a requisição é realizada diretamente pela API. A demonstração prática utilizou duas contas para acessar a mesma rota, `/api/admin/usuarios`: a conta comum recebeu HTTP `403 Forbidden`, enquanto a administradora recebeu HTTP `200 OK`, com acesso à listagem de usuários.

  #evidencia([Atividade 4 — Histórico de commits da implementação do controle de acesso por papel.], arquivo: "prints/atividade-4-commits.png")
  #evidencia([Atividade 4 — acesso à rota /api/admin/usuarios negado para usuário comum, com retorno HTTP 403 Forbidden.], arquivo: "prints/atividade-4-rbac-usuario-403.png")
  #evidencia([Atividade 4 — acesso à mesma rota /api/admin/usuarios permitido para administrador, com retorno HTTP 200 OK.], arquivo: "prints/atividade-4-rbac-admin-200.png")

  *Dificuldades e como foram resolvidas.*

  A principal dificuldade foi garantir que o controle de acesso não dependesse apenas da interface ou das informações presentes no token. Para resolver isso, o `auth-service` foi ajustado para consultar no banco de dados o papel atual do usuário durante a validação da sessão, permitindo que o backend utilizasse essa informação para decidir se a operação era permitida.

  Também foi necessário corrigir o tratamento dos códigos de resposta entre o catálogo e o `auth-service`, pois alguns erros poderiam ser interpretados de forma incorreta. O middleware foi ajustado para preservar os códigos HTTP retornados pelo serviço de autenticação, permitindo diferenciar corretamente situações como usuário não autenticado e usuário autenticado sem permissão.

  Para comprovar a restrição de acesso, a mesma rota administrativa foi consultada com uma conta comum e uma conta administradora. A comparação dos resultados confirmou a recusa da requisição para o usuário comum, com retorno `403 Forbidden`, e a autorização para o administrador, com retorno `200 OK`.
]

#atividade(
  "5", "Logs e auditoria",
  descricao: "Implementação de um microsserviço de auditoria com Redis Streams para registrar eventos da aplicação e disponibilizar sua consulta somente a administradores.",
  planejada: "25/09/2026",
  realizada: "24/09/2026 00:40:41 (UTC−03:00)",
  situacao: "entregue",
  evidencia: "GitHub — commit e capturas do painel administrativo e da consulta dos logs.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/25a2304",
)[
  *O que foi feito.*

  Foi desenvolvido um novo microsserviço, o `log-service`, responsável por registrar eventos de auditoria da aplicação utilizando Redis Streams. O serviço registra informações como usuário responsável, ação realizada, data e hora, contexto da operação e IP quando disponível. Foram auditadas ações como `LOGIN`, `LOGOUT`, favoritar e desfavoritar filmes, criação e exclusão de comentários e tentativas de acesso sem permissão, registradas como `ACAO_NEGADA`.

  O `log-service` e o Redis permanecem acessíveis apenas pela rede interna do Docker, sem portas publicadas diretamente para o usuário. A consulta dos eventos foi protegida por RBAC, permitindo acesso somente a usuários com papel `admin`. Para facilitar essa consulta, foi criada uma área de Auditoria no painel administrativo, onde é possível visualizar, pesquisar e filtrar os eventos registrados. Também foi validado que usuários comuns recebem `403 Forbidden` ao tentar acessar os logs administrativos, e essa tentativa é registrada automaticamente na auditoria.

  #evidencia([Atividade 5 — histórico de commits da implementação do serviço de logs e auditoria, com hashes, datas e horários.], arquivo: "prints/atividade-5-commits.png")
  #evidencia([Atividade 5 — painel administrativo com resumo dos eventos de auditoria e registros de tentativas de acesso negadas à consulta de logs.], arquivo: "prints/atividade-5-painel-admin.png")
  #evidencia([Atividade 5 — consulta dos registros de auditoria por uma conta administradora, com filtros e eventos de login, logout e tentativas de acesso negadas.], arquivo: "prints/atividade-5-auditoria-admin.png")

  *Dificuldades e como foram resolvidas.*

  Uma das principais dificuldades foi integrar o novo `log-service` ao catálogo e ao `auth-service` sem fazer com que uma falha no serviço de auditoria impedisse o funcionamento normal da aplicação. Para resolver isso, as chamadas de registro dos eventos foram implementadas com timeout e tratamento de erros, permitindo que ações como login, favoritos e comentários continuem funcionando mesmo se o serviço de logs estiver indisponível.

  Outro ponto foi garantir que as tentativas de acesso sem permissão fossem registradas corretamente. A validação foi mantida no backend por meio do RBAC e as respostas `403 Forbidden` passaram a gerar eventos `ACAO_NEGADA`, evitando depender apenas da interface.

  Também foi necessário configurar a persistência dos eventos no Redis, utilizando Redis Streams, AOF e um volume Docker, para que os registros não fossem perdidos ao reiniciar os containers.

  Por fim, a consulta dos logs foi protegida para permitir acesso somente a administradores, mantendo o `log-service` e o Redis acessíveis apenas pela rede interna do Docker.
]

#atividade(
  "6", "Upload e perfil de usuário",
  descricao: "Implementação do perfil do usuário com foto, biografia e favoritos, upload de imagens para o MinIO e validação de propriedade no backend.",
  planejada: "02/10/2026",
  realizada: "02/10/2026 21:47:33 (UTC−03:00)",
  situacao: "entregue",
  evidencia: "GitHub — commit, print do perfil com foto e print da tentativa de edição de outro perfil recusada.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/b47bef1",
)[
  *O que foi feito.*

  Foi implementada uma página de perfil para cada usuário, contendo nome, foto, bio e filmes favoritados. O upload da foto foi integrado ao MinIO, utilizado como object storage, enquanto o MariaDB armazena somente a chave de referência do objeto na tabela `perfis`, evitando o armazenamento do arquivo binário diretamente no banco.

  O upload aceita imagens nos formatos JPG, PNG e WebP, com limite de 5 MB. A aplicação valida o arquivo antes do envio e gera uma chave própria para armazenamento no MinIO. Para exibição da imagem foi adotada a estratégia de leitura pública do bucket, mantendo a escrita restrita ao backend.

  Também foi implementado o controle de propriedade do perfil. O backend utiliza a identidade obtida pela sessão autenticada e impede que um usuário altere o perfil de outra pessoa. Tentativas desse tipo retornam `403 Forbidden` e são registradas na auditoria como `ACAO_NEGADA`.

  A página de perfil reaproveita os favoritos já existentes no sistema e apresenta os filmes em formato de cards. A atividade também adicionou o MinIO ao Docker Compose, incluiu persistência por volume e preservou os serviços já existentes de autenticação, RBAC, auditoria e Redis. Ao final, foram executados 49 testes automatizados, todos aprovados.

  #evidencia([Atividade 6 — histórico de commits da implementação do perfil e do upload de imagens com MinIO, com hashes, datas e horários.], arquivo: "prints/atividade-6-commits.png")
  #evidencia([Atividade 6 — página de perfil do usuário com foto, biografia e filmes favoritos.], arquivo: "prints/atividade-6-perfil.png")
  #evidencia([Atividade 6 — tentativa de alterar o perfil de outro usuário recusada pelo backend, com retorno HTTP 403 Forbidden.], arquivo: "prints/atividade-6-perfil-403.png")

  *Dificuldades e como foram resolvidas.*

  A principal dificuldade foi integrar o upload da foto de perfil com o MinIO sem armazenar a imagem diretamente no banco de dados. Foi necessário configurar o MinIO no `docker-compose`, criar as variáveis de ambiente e garantir que o catálogo conseguisse acessar o serviço pela rede interna do Docker. Durante os testes, a aplicação inicialmente não subia corretamente porque a variável `MINIO_SECRET_KEY` não estava definida no arquivo `.env`. O problema foi identificado pelo erro do Docker Compose e resolvido com a configuração das variáveis necessárias para o MinIO.

  Outra dificuldade ocorreu quando a página de perfil retornava erro `503`. A investigação mostrou que a tabela `perfis` ainda não existia no MariaDB, pois a migração da Atividade 6 ainda não havia sido aplicada. Após executar a migração e validar a estrutura da tabela, a rota `/api/perfil/me` passou a retornar `200` normalmente.

  Também foi necessário garantir que um usuário não pudesse editar o perfil de outra pessoa. A solução foi realizar essa validação no backend, comparando o ID presente na rota com o ID do usuário autenticado obtido pela sessão. Quando os IDs são diferentes, a aplicação retorna `403 Forbidden` e registra a tentativa como `ACAO_NEGADA` na auditoria.
]


// ============================================================
= Atividades extras (opcional)
// ============================================================
#atividade(
  "E1", "Documentação Swagger/OpenAPI",
  descricao: "Documentação Swagger/OpenAPI de pelo menos dois serviços e chamada real executada pelo Try it out.",
  planejada: "sem prazo",
  realizada: "07/10/2026 21:15:01 (UTC−03:00)",
  situacao: "entregue",
  evidencia: "Repositório público, commit com data e horário, README com referência ao professor e prints do Swagger.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/780dd4f37f3c13471a8e285176372c805753b593",
)[
  *O que foi feito.*

  Foi implementada a documentação das APIs do catálogo e do `auth-service`, desenvolvidos em Node.js com Express, utilizando `swagger-jsdoc` e `swagger-ui-express`. Os contratos OpenAPI 3.0.3 documentam 22 operações do catálogo e oito do serviço de autenticação, incluindo parâmetros, corpos de requisição, autenticação e respostas de sucesso e erro. As especificações foram disponibilizadas em `docs/openapi/catalogo.json` e `docs/openapi/auth.json`, com schemas reutilizáveis e anotações junto às rotas.

  O catálogo documenta autenticação, filmes, favoritos, comentários, auditoria, administração de usuários e perfil com upload de foto. O `auth-service` documenta cadastro, login, validação de sessão, recuperação de senha, administração de usuários e verificação de funcionamento. O Swagger está disponível em `/apidocs/` e `/apidocs/auth/`, e as especificações são servidas em `/openapi/catalogo.json` e `/openapi/auth.json`. O serviço de autenticação permanece na rede interna Docker; o Try it out está desativado na página de suas rotas internas.

  No ambiente publicado, foi executada a chamada `GET /api/filmes` pelo Try it out do Swagger do catálogo, com retorno HTTP 200 e os dados dos filmes. As capturas documentam a execução real na API pública do catálogo, os endpoints do serviço de autenticação e o commit da implementação. O README inclui os links de acesso, as especificações e a referência ao professor.

  #evidencia([Atividade E1 — Execução real do GET /api/filmes pelo Swagger no ambiente publicado, com retorno HTTP 200 e dados dos filmes.], arquivo: "prints/atividade-extra-swagger.png")

  #evidencia([Atividade E1 — Documentação dos endpoints internos do auth-service no Swagger, com Try it out desativado.], arquivo: "prints/atividade-extra-swagger-auth.png")

  #evidencia([Atividade E1 — Commit da implementação Swagger/OpenAPI, com hash, data e horário.], arquivo: "prints/atividade-extra-swagger-commit.png")

  *Dificuldades e como foram resolvidas.*

  Não houve dificuldades significativas durante a atividade. O trabalho exigiu atenção na organização da documentação e na conferência dos parâmetros, da autenticação e das respostas de sucesso e erro, para que as informações apresentadas no Swagger correspondessem ao funcionamento das APIs.
]

#atividade(
  "E2", "CI/CD com GitHub Actions",
  descricao: "Pipeline de testes, validação OpenAPI, builds e publicação de imagens no GHCR, com atualização manual no Portainer.",
  planejada: "sem prazo",
  realizada: "07/10/2026 22:20:50 (UTC−03:00)",
  situacao: "concluída",
  evidencia: "Branch atividade-extra-cicd; commit 0c6577452ec11940cc59339874b2dee2bb40c986; execução aprovada do GitHub Actions e capturas dos commits e containers no Portainer.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/0c6577452ec11940cc59339874b2dee2bb40c986",
)[
  *O que foi feito.*

  Foi criado o workflow `.github/workflows/cicd.yml`, executado a cada `push` e `pull request`. O pipeline instala as dependências do catálogo, do `auth-service` e do `log-service` com `npm ci`, executa os testes automatizados e valida a documentação OpenAPI. Em seguida, constrói e verifica as quatro imagens Docker: catálogo, autenticação, auditoria e MinIO. A etapa de publicação depende da aprovação das verificações, impedindo o envio das imagens quando algum teste ou build falha.
  
  Nos eventos de `push` para a branch `atividade-extra-cicd`, as imagens verificadas são publicadas no GHCR com as tags `latest` e `sha-<hash completo do commit>`, além do label `org.opencontainers.image.revision`. A publicação utiliza o `GITHUB_TOKEN`, com permissão `packages: write`. Os arquivos `.dockerignore` foram revisados para excluir credenciais das imagens e preservar os arquivos necessários à documentação Swagger.
  
  O arquivo `docker-compose.portainer.yml` foi ajustado para utilizar as imagens publicadas, sem build local, selecionando a versão pela variável `IMAGE_TAG`. Foi adotada a modalidade “quase automática”, com testes, builds e publicação automáticos e atualização manual no Portainer. A stack existente foi atualizada com a tag do commit `0c65774`, preservando portas, rede, variáveis e volumes do MinIO e Redis. A execução do GitHub Actions terminou com os jobs `verificar` e `publicar` aprovados, incluindo 52 testes e a validação OpenAPI. Após o redeploy, os containers ficaram em execução ou saudáveis, e a página de perfil carregou com nome, foto e bio. O README foi atualizado com instruções de implantação e rollback; a automação completa do deploy permaneceu como melhoria futura.

  *Execução aprovada:* #link("https://github.com/Luanaabrantes/catalogo-filmes/actions/runs/37712472912")[GitHub Actions — execução 37712472912].

  #evidencia([Histórico de commits da atividade extra de CI/CD, com implementação do pipeline, registro da execução aprovada e integração ao Portainer.], arquivo: "prints/atividade-extra-cicd-commits.png")

  #evidencia([Execução do pipeline no GitHub Actions concluída com sucesso, com os jobs de verificação e publicação das imagens no GHCR aprovados.], arquivo: "prints/atividade-extra-cicd-actions.png")

  #evidencia([Containers da aplicação em execução no Portainer após a atualização com as imagens publicadas pelo pipeline CI/CD no GHCR.], arquivo: "prints/atividade-extra-cicd-container.png")

  *Dificuldades e como foram resolvidas.*

  A principal dificuldade foi compreender como utilizar no Portainer as imagens publicadas pelo GitHub Actions. Foi necessário identificar a relação entre a branch do repositório, o arquivo Compose utilizado pela stack e a tag que determina a versão das imagens. A solução foi ajustar o `docker-compose.portainer.yml` para utilizar as quatro imagens do GHCR, mantendo o caminho já configurado na stack e preservando portas, rede, variáveis de ambiente e volumes persistentes.
  
  Também foi necessário configurar a variável `IMAGE_TAG` no Portainer com a tag SHA completa do commit aprovado no pipeline. Após selecionar a branch `atividade-extra-cicd`, foi realizada a atualização por meio de Pull and redeploy. O resultado foi conferido pelos estados dos containers, pelas imagens e tags exibidas no Portainer e pelo carregamento da página de perfil com nome, foto e bio.
]

#atividade(
  "E3", "Observabilidade — health checks e métricas",
  descricao: "Endpoints de saúde e métricas, com o container reagindo à queda do Redis.",
  planejada: "sem prazo",
  realizada: "07/10/2026 23:15:00 (UTC−03:00)",
  situacao: "entregue",
  evidencia: "Commit d672301f5defa185e96ba3118f2605ca12057cd2, execução aprovada do GitHub Actions e capturas da validação no laboratório isolado.",
  url: "https://github.com/Luanaabrantes/catalogo-filmes/commit/d672301f5defa185e96ba3118f2605ca12057cd2",
)[
  *O que foi feito.*

  Foram implementados health checks reais no catálogo, no `auth-service` e no `log-service`. A rota `GET /live` verifica somente se o processo responde, enquanto `GET /health` consulta as dependências e retorna HTTP 200 quando o serviço está pronto ou HTTP 503 quando uma dependência falha. O catálogo verifica MariaDB, autenticação, MinIO e TMDB; o serviço de autenticação verifica MariaDB e SMTP; e o serviço de logs verifica Redis e autenticação. Os probes utilizam timeouts curtos e retornam informações de estado sem expor credenciais ou detalhes sensíveis.

  Os Dockerfiles e os arquivos Compose foram ajustados para consultar `/health`, preservando portas, redes, volumes e o fluxo existente de CI/CD. No catálogo, a biblioteca `prom-client` disponibiliza `GET /metrics`, com contador de requisições e histograma de latência por método, template de rota e código de status. As métricas registram também respostas de erro e evitam criar séries diferentes para IDs ou parâmetros de consulta. A documentação Swagger/OpenAPI foi atualizada para os novos endpoints.

  A validação foi realizada em um laboratório Docker isolado, sem implantação da observabilidade em produção. Foram aprovados 56 testes automatizados e a validação OpenAPI. Os serviços ficaram `healthy`; ao interromper somente o Redis, o `log-service` passou a `unhealthy`, com `/health` retornando HTTP 503 e `/live` retornando HTTP 200. Após restaurar o Redis, o serviço de logs recuperou automaticamente o estado `healthy`, sem reinício manual. Também foram verificadas as métricas reais do catálogo. A execução do GitHub Actions concluiu as verificações com sucesso; a publicação foi ignorada nessa branch, conforme a restrição existente à branch de CI/CD.

  *Execução aprovada:* #link("https://github.com/Luanaabrantes/catalogo-filmes/actions/runs/37716954218")[GitHub Actions — execução 37716954218].

  #evidencia([Serviços do laboratório com health checks em estado healthy.], arquivo: "prints/observabilidade-healthy.png")

  #evidencia([Redis interrompido: log-service unhealthy, /health com HTTP 503 e /live com HTTP 200.], arquivo: "prints/observabilidade-redis-unhealthy.png")

  #evidencia([Recuperação do log-service para healthy após restaurar o Redis, sem reiniciar o serviço de logs.], arquivo: "prints/observabilidade-recuperacao.png")

  #evidencia([Endpoint /metrics com HTTP 200, contador de requisições e histograma de latência por método, rota e status.], arquivo: "prints/observabilidade-metrics.png")

  *Dificuldades e como foram resolvidas.*

  Foi necessário separar a disponibilidade do processo da prontidão para atender requisições e evitar dependências circulares entre os serviços. A solução foi manter `/live` independente e consultar apenas as dependências necessárias em `/health`, com timeouts e respostas de estado. A auditoria permaneceu de melhor esforço, permitindo que o catálogo continuasse pronto durante a interrupção do Redis. O teste utilizou uma stack separada com banco, Redis e MinIO próprios, preservando o ambiente de produção.

  Outro ajuste foi garantir que as métricas utilizassem o template da rota mesmo quando o middleware de autenticação encerrasse a requisição antes do handler. Os contratos OpenAPI foram usados para identificar essas rotas, permitindo agrupar as respostas negadas sem incluir IDs nos labels. Testes automatizados e requisições reais no laboratório confirmaram o contador, o histograma e a recuperação do serviço de logs após a restauração do Redis.
]


// ============================================================
= Considerações finais
// ============================================================
O principal aprendizado deste bimestre foi compreender o fluxo entre o desenvolvimento da aplicação e sua disponibilização em um servidor. Antes das atividades, eu não conhecia algumas das ferramentas utilizadas e imaginava que colocar um sistema no ar seria mais difícil. Ao trabalhar com Docker e Portainer, pude entender como uma aplicação desenvolvida localmente pode ser publicada e ficar disponível para acesso pela internet.

Encarar as atividades como desafios também tornou o aprendizado mais interessante. A cada semana, foi possível acompanhar o catálogo de filmes tomando forma com a implementação de novas funcionalidades. A autenticação, o controle de acesso, a auditoria e o perfil com upload de imagem ajudaram a compreender como diferentes serviços se relacionam e contribuem para o funcionamento de uma mesma aplicação.

As atividades extras ampliaram esse entendimento ao abordar a documentação das APIs, a automação de testes e publicação de imagens e a verificação da saúde dos serviços. Com isso, passei a perceber a importância de verificar o funcionamento da aplicação, registrar suas interfaces e acompanhar possíveis falhas, além de implementar as funcionalidades solicitadas.

As aulas foram de grande importância para ampliar meus conhecimentos e relacionar os conceitos apresentados com a prática. As explicações e orientações do professor ajudaram a esclarecer dúvidas e a avançar nas etapas do projeto, principalmente no contato com ferramentas e procedimentos que eram novos para mim.

Ao final do bimestre, considero que o desenvolvimento gradual do projeto contribuiu para aumentar minha confiança e autonomia. Ainda há conhecimentos a aprofundar, mas a experiência permitiu compreender melhor as etapas necessárias para desenvolver, publicar e acompanhar uma aplicação em nuvem, formando uma base para as próximas atividades e outros projetos.

// ============================================================
= Declaração de autoria
// ============================================================
Declaro que este relatório foi elaborado por mim, individualmente, e que as evidências apresentadas correspondem a entregas de minha autoria, verificáveis nos links informados. Nas atividades realizadas em grupo, o conteúdo aqui descrito refere-se à minha participação.

#v(1.5cm)
#grid(
  columns: (1fr, 1fr), gutter: 2cm,
  align(center)[#line(length: 100%, stroke: 0.5pt) \ #aluno],
  align(center)[#line(length: 100%, stroke: 0.5pt) \ Pompeia, #data-relatorio],
)
