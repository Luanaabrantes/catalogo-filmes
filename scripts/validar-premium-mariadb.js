// Banco descartável isolado, sem portas, sem .env e sem volumes da aplicação.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const name = `premium-qa-${process.pid}-${Date.now()}`;
let created = false;
function docker(args, input) {
    const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 60000 });
    if (result.status !== 0) throw new Error('Comando Docker do laboratório falhou.');
    return result.stdout.trim();
}
function sql(input) { return docker(['exec', '-i', name, 'mariadb', '-uroot', '--batch', '--skip-column-names', 'premium_qa'], input); }
(async () => {
    docker(['run', '--rm', '-d', '--name', name, '--network', 'none', '-e', 'MARIADB_ALLOW_EMPTY_ROOT_PASSWORD=1', '-e', 'MARIADB_DATABASE=premium_qa', 'mariadb:11.4']);
    created = true;
    let ready = false;
    for (let i = 0; i < 60; i++) {
        try { sql('SELECT 1;'); ready = true; break; } catch { await new Promise(r => setTimeout(r, 500)); }
    }
    assert.ok(ready, 'MariaDB não ficou pronto');
    const migration = fs.readFileSync(path.join(__dirname, '../database/migracao-atividade7.sql'), 'utf8');
    sql('CREATE TABLE usuarios (id INT NOT NULL PRIMARY KEY) ENGINE=InnoDB; INSERT INTO usuarios VALUES (1);');
    sql(migration); sql(migration);
    assert.equal(sql('INSERT INTO premium_assinaturas (usuario_id) VALUES (1); SELECT premium FROM premium_assinaturas WHERE usuario_id=1;'), '0');
    assert.equal(sql("START TRANSACTION; INSERT INTO stripe_eventos(id,tipo) VALUES('evt_rollback','invoice.paid'); UPDATE premium_assinaturas SET premium=TRUE WHERE usuario_id=1; ROLLBACK; SELECT premium FROM premium_assinaturas WHERE usuario_id=1; SELECT COUNT(*) FROM stripe_eventos;"), '0\n0');
    assert.equal(sql("START TRANSACTION; INSERT IGNORE INTO stripe_eventos(id,tipo) VALUES('evt_pago','invoice.paid'); SELECT ROW_COUNT(); UPDATE premium_assinaturas SET premium=TRUE WHERE usuario_id=1; COMMIT; INSERT IGNORE INTO stripe_eventos(id,tipo) VALUES('evt_pago','invoice.paid'); SELECT ROW_COUNT(); SELECT premium FROM premium_assinaturas WHERE usuario_id=1;"), '1\n0\n1');
    assert.throws(() => sql('INSERT INTO premium_assinaturas (usuario_id) VALUES (999);'));
    console.log('MariaDB 11.4: migração reexecutável, padrão false, FK, commit/rollback e evento único aprovados.');
})().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => { if (created) docker(['stop', '-t', '2', name]); });
