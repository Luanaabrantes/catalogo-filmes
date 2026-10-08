const SwaggerParser = require('@apidevtools/swagger-parser');
const { gerar } = require('../src/openapi');
(async () => {
    for (const servico of ['catalogo', 'auth']) {
        await SwaggerParser.validate(structuredClone(gerar(servico)));
        console.log(`${servico}: OpenAPI 3.0.3 válido`);
    }
})().catch(erro => { console.error(erro); process.exitCode = 1; });
