// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();

// ====== CONFIG ======
const SANKHYA_URL = process.env.SANKHYA_URL; // ex: http://seu-servidor:8180
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// CORS e middlewares
app.use(cors({
  origin: CORS_ORIGIN,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS']
}));
app.use(express.json());
app.use(cookieParser());

// Axios base (timeout decente)
const sankhya = axios.create({
  baseURL: SANKHYA_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  validateStatus: () => true
});

// ====== SESSÕES EM MEMÓRIA (troque por Redis em produção) ======
/** sessions[jti] = { jsessionid, usuario, codusu, codvend, name, createdAt } */
const sessions = Object.create(null);

// ====== HELPERS ======
async function sankhyaLogin(usuario, senha) {
  const payload = {
    serviceName: "MobileLoginSP.login",
    requestBody: {
      NOMUSU: { "$": usuario },
      INTERNO: { "$": senha },
      KEEPCONNECTED: { "$": "S" }
    }
  };
  const url = '/mge/service.sbr?serviceName=MobileLoginSP.login&outputType=json';
  const r = await sankhya.post(url, payload);
  if (r.status >= 400) throw new Error(`Falha HTTP ${r.status} no login`);

  const jsessionid = r.data?.responseBody?.jsessionid?.["$"];
  if (!jsessionid) throw new Error('JSESSIONID ausente (login inválido)');
  return jsessionid;
}

async function sankhyaQuery(jsessionid, sql) {
  const payload = {
    serviceName: "DbExplorerSP.executeQuery",
    requestBody: { sql, outputType: "json" }
  };
  const url = '/mge/service.sbr?serviceName=DbExplorerSP.executeQuery&outputType=json';
  const r = await sankhya.post(url, payload, {
    headers: { Cookie: `JSESSIONID=${jsessionid}` }
  });
  if (r.status >= 400) throw new Error(`Falha HTTP ${r.status} na query`);
  const rows = r.data?.responseBody?.rows || [];
  return rows;
}

async function sankhyaLogout(jsessionid) {
  const payload = { serviceName: "LogoutSP.logout", requestBody: {} };
  const url = '/mge/service.sbr?serviceName=LogoutSP.logout&outputType=json';
  try {
    await sankhya.post(url, payload, { headers: { Cookie: `JSESSIONID=${jsessionid}` } });
  } catch (_) { /* ignora erro de logout */ }
}

// ====== AUTH MIDDLEWARE (JWT + sessão em memória) ======
function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ erro: 'Token ausente' });

  try {
    const data = jwt.verify(token, JWT_SECRET);
    const sess = sessions[data.jti];
    if (!sess) return res.status(401).json({ erro: 'Sessão expirada' });

    req.user = data;
    req.sankhya = sess; // contém jsessionid
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

// ====== ROTAS ======

// LOGIN — retorna JWT; mantém JSESSIONID só no servidor
app.post('/api/auth/login', async (req, res) => {
  try {
    let { usuario, senha } = req.body || {};
    if (!usuario || !senha) return res.status(400).json({ erro: 'Usuário e senha são obrigatórios.' });

    const usuarioUpper = String(usuario).trim().toUpperCase();
    const safeUser = usuarioUpper.replace(/'/g, "''"); // simples sanitização para a string do SQL

    // 1) Login no Sankhya
    const jsessionid = await sankhyaLogin(usuarioUpper, senha);

    // 2) Dados do usuário (ajuste os campos ao seu dicionário)
    const sqlUser =
      `SELECT CODUSU, NVL(CODVEND,0) AS CODVEND, NOMEUSU
         FROM TSIUSU
        WHERE UPPER(NOMEUSU) = '${safeUser}'`;
    const rows = await sankhyaQuery(jsessionid, sqlUser);
    const [codusu, codvend, nomeusu] = rows[0] || [];
    const name = nomeusu || usuarioUpper;

    // 3) Criar sessão do app (mapeia JWT -> JSESSIONID)
    const jti = uuidv4();
    sessions[jti] = {
      jsessionid,
      usuario: usuarioUpper,
      codusu: codusu ?? null,
      codvend: codvend ?? null,
      name,
      createdAt: new Date().toISOString()
    };

    // 4) Assinar JWT (não colocar senha nem JSESSIONID no token!)
    const token = jwt.sign(
      { sub: usuarioUpper, name, codusu, codvend, jti },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.json({ token, name, codusu, codvend });
  } catch (err) {
    console.error('Erro /api/auth/login:', err?.response?.data || err.message);
    return res.status(401).json({ erro: 'Falha no login' });
  }
});

// Rota de teste (quem sou eu)
app.get('/api/whoami', auth, (req, res) => {
  res.json({
    user: req.user,
    sankhyaSession: !!req.sankhya?.jsessionid
  });
});

// Exemplo de rota protegida que usa a sessão do Sankhya
app.get('/api/ping-sankhya', auth, async (req, res) => {
  try {
    // Testa a sessão executando um SELECT simples
    const rows = await sankhyaQuery(req.sankhya.jsessionid, 'SELECT 1 FROM DUAL');
    res.json({ ok: true, rows });
  } catch (err) {
    res.status(500).json({ erro: 'Falha ao consultar Sankhya', det: err.message });
  }
});

// LOGOUT — encerra sessão no Sankhya e invalida JWT (apaga da memória)
app.post('/api/auth/logout', auth, async (req, res) => {
  try {
    const { jti } = req.user || {};
    const sess = jti ? sessions[jti] : null;
    if (sess?.jsessionid) await sankhyaLogout(sess.jsessionid);
    if (jti) delete sessions[jti];
    res.json({ sucesso: true });
  } catch (err) {
    res.json({ sucesso: true }); // não vaza erro de logout
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});

