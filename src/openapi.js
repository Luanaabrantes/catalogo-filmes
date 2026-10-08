const path = require('node:path');
const swaggerJsdoc = require('swagger-jsdoc');
const components = require('../docs/openapi/components');

const root = path.resolve(__dirname, '..');
function gerar(servico) {
    const catalogo = servico === 'catalogo';
    const pasta = catalogo ? 'src' : 'auth-service/src';
    return swaggerJsdoc({
        failOnErrors: true,
        definition: {
            openapi: '3.0.3',
            info: {
                title: catalogo ? 'Catálogo de filmes — API pública' : 'Auth-service — API interna',
                version: '1.0.0',
                description: catalogo
                    ? 'Sessão pelo cookie HttpOnly token. Faça login em /login.html no mesmo navegador ou execute POST /api/auth/login com uma conta local. Não cole o cookie no Authorize. GET /api/auth/me sem sessão retorna 401 e é uma chamada segura para demonstrar Try it out. Papel comum: usuario; administrador: admin. Alterações de dados devem ser testadas somente no ambiente local.'
                    : 'Rotas internas reais, acessíveis apenas na rede Docker. Try it out desabilitado nesta página: o navegador não alcança auth-service:3001. Use os proxies públicos correspondentes em /apidocs com sessão por cookie; x-public-proxy identifica cada correspondência. /health não tem proxy público. Para acesso direto, use curl ou fetch dentro de um contêiner da rede catalogo-network; Authorization: Bearer somente em /auth/validar e /auth/admin/*. Nenhuma nova rota interna foi exposta.',
            },
            ...(catalogo ? { servers: [{ url: '/', description: 'Mesma origem do catálogo (local ou publicada)' }] }
                : { servers: [{ url: 'http://auth-service:3001', description: 'Somente rede interna Docker; não acessível pelo navegador' }] }),
            components: {
                schemas: components.schemas,
                securitySchemes: catalogo ? { sessao: components.securitySchemes.sessao }
                    : { bearerAuth: components.securitySchemes.bearerAuth },
            },
        },
        apis: [path.join(root, pasta, '*.js').replace(/\\/g, '/')],
    });
}

module.exports = { gerar };
