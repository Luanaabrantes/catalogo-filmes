const db = require('./database');
async function listarFavoritos(usuarioId) {
    const [favoritos] = await db.execute(`SELECT tmdb_movie_id FROM favoritos
        WHERE usuario_id = ? ORDER BY criado_em DESC`, [usuarioId]);
    return favoritos.map(f => f.tmdb_movie_id);
}
module.exports = listarFavoritos;
