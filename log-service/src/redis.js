const { createClient } = require('redis');

const redis = createClient({
    url: process.env.REDIS_URL || 'redis://redis:6379',
    disableOfflineQueue: true,
    socket: {
        connectTimeout: 3000,
        reconnectStrategy: retries => Math.min(200 * (retries + 1), 3000)
    }
});

redis.on('error', () => {
    console.error('Conexão com Redis indisponível; tentando reconectar.');
});

module.exports = redis;
