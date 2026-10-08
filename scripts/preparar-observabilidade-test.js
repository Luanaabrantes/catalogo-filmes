// Somente credenciais descartáveis; copia o token TMDB para uma chamada GET de leitura.
const fs = require('node:fs');
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const env = fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {};
const token = process.env.TMDB_TOKEN || env.TMDB_TOKEN || '';
fs.mkdirSync('tmp/observabilidade', { recursive: true });
fs.writeFileSync('tmp/observabilidade/.env', `QA_PASSWORD=${crypto.randomBytes(24).toString('hex')}\nTMDB_TOKEN=${JSON.stringify(token)}\n`, { mode: 0o600 });
console.log('Ambiente de teste isolado preparado; valores não exibidos. TMDB configurada: '+Boolean(token));
