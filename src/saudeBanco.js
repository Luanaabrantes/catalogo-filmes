const mysql = require('mysql2/promise');
// Conexão curta e descartável: falhas de readiness não ocupam o pool da aplicação.
module.exports = async function banco(env = process.env) {
    let connection;
    try {
        connection = await mysql.createConnection({ host: env.DB_HOST, port: env.DB_PORT,
            user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME, connectTimeout: 900 });
        await connection.query({ sql: 'SELECT 1', timeout: 900 });
    } finally { connection?.destroy(); }
};
