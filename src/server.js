require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');

// ========================================
// ROTAS
// ========================================

const authRoutes = require('./auth');
const filmesRoutes = require('./filmes');
const favoritosRoutes = require('./favoritos');
const comentariosRoutes = require('./comentarios');


// ========================================
// CONFIGURAÇÃO DO EXPRESS
// ========================================

const app = express();

const PORT = process.env.PORT || 3000;


// ========================================
// MIDDLEWARES
// ========================================

// Permite receber JSON
app.use(express.json());

// Permite receber dados de formulários
app.use(
    express.urlencoded({
        extended: true
    })
);

// Permite trabalhar com cookies
app.use(cookieParser());

// Disponibiliza os arquivos da pasta public
app.use(
    express.static(
        path.join(__dirname, '../public')
    )
);


// ========================================
// ROTAS DA API
// ========================================

// Cadastro, login, logout e usuário logado
app.use(
    '/api/auth',
    authRoutes
);

// Filmes vindos da TMDB
app.use(
    '/api/filmes',
    filmesRoutes
);

// Favoritos do usuário logado
app.use(
    '/api/favoritos',
    favoritosRoutes
);

// Comentários do usuário logado
app.use(
    '/api/comentarios',
    comentariosRoutes
);


// ========================================
// INICIAR SERVIDOR
// ========================================

app.listen(PORT, () => {

    console.log(
        `Servidor rodando na porta ${PORT}`
    );

});