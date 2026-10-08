const swaggerUi = require('swagger-ui-express');
const { gerar } = require('./openapi');

function instalarDocumentacao(app) {
    const catalogo = gerar('catalogo');
    const auth = gerar('auth');
    app.get('/openapi/catalogo.json', (req, res) => res.json(catalogo));
    app.get('/openapi/auth.json', (req, res) => res.json(auth));
    // serveFiles evita compartilhar a configuração entre as duas instâncias.
    const opcoes = {
        customSiteTitle: 'Catálogo — Swagger/OpenAPI',
        swaggerOptions: { validatorUrl: null, persistAuthorization: false, withCredentials: true },
    };
    const opcoesAuth = {
        customSiteTitle: 'Auth-service — documentação interna',
        swaggerOptions: { validatorUrl: null, supportedSubmitMethods: [], persistAuthorization: false },
    };
    // A rota mais específica precisa preceder /apidocs.
    app.use('/apidocs/auth', swaggerUi.serveFiles(auth, opcoesAuth), swaggerUi.setup(auth, opcoesAuth));
    app.use('/apidocs', swaggerUi.serveFiles(catalogo, opcoes), swaggerUi.setup(catalogo, opcoes));
}

module.exports = instalarDocumentacao;
