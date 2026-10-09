// Execução explícita, nunca no startup. Usa o banco configurado no ambiente.
require('dotenv').config({ quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const db = require('../src/database');
(async () => {
    if (process.argv[2] !== '--aplicar') throw new Error('Uso: node scripts/migrar-premium.js --aplicar (faça backup e confira o banco antes).');
    const sql = fs.readFileSync(path.join(__dirname, '../database/migracao-atividade7.sql'), 'utf8').replace(/^--.*$/gm, '');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.query(statement);
    console.log('Migração aditiva da atividade 7 aplicada.');
})().catch(() => { console.error('Migração não concluída. Confira acesso, backup e estrutura do banco; nenhuma credencial foi exibida.'); process.exitCode = 1; }).finally(() => db.end());
