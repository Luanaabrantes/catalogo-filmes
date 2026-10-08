const fs = require('node:fs');
const path = require('node:path');
const { gerar } = require('../src/openapi');
const pasta = path.resolve(__dirname, '../docs/openapi');
fs.mkdirSync(pasta, { recursive: true });
for (const servico of ['catalogo', 'auth']) {
    const spec = gerar(servico);
    fs.writeFileSync(path.join(pasta, `${servico}.json`), `${JSON.stringify(spec, null, 2)}\n`);
    console.log(`${servico}: ${Object.values(spec.paths).reduce((n, p) => n + Object.keys(p).length, 0)} operações`);
}
