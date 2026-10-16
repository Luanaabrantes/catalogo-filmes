require('dotenv').config({ quiet: true });
const { criarPremium, ErroPremium } = require('../src/premium');
const db = require('../src/database');
(async () => {
    const args = process.argv.slice(2);
    if (args.length < 2 || args[0] !== '--usuario-id' || !/^[1-9]\d*$/.test(args[1]) || args.slice(2).some(a => a !== '--aplicar') || args.length > 3) {
        throw new ErroPremium('Uso: node scripts/sincronizar-premium.js --usuario-id ID [--aplicar]');
    }
    const resultado = await criarPremium({ db }).sincronizar(args[1], args.includes('--aplicar'));
    console.log(JSON.stringify(resultado));
})().catch(e => {
    console.error(e instanceof ErroPremium ? e.message : 'Sincronização não concluída. Confira configuração, migração e vínculos; detalhes privados omitidos.');
    process.exitCode = 1;
}).finally(() => db.end());
