# Deploy Backend ObraReport / Stock Full no Render

# Servico

Nome sugerido:
obrareport-backend

Tipo:
Web Service

Runtime:
Node.js

Repositorio:
icaroamaralengenharia-source/icaroamaral

Branch:
main

Root Directory:
backend

Build Command:
npm install

Start Command:
npm start

Health Check:

/api/stock-full/health

Variaveis obrigatorias:

NODE_ENV=production

SUPABASE_URL

SUPABASE_SERVICE_ROLE_KEY

OPENAI_API_KEY

Variaveis opcionais:

PORT

OPENAI_MODEL

OPENAI_VISION_MODEL

AI_ALLOWED_ORIGINS

AI_JSON_LIMIT

ELO_VECTOR_MEMORY_PATH

ELO_MAX_ATTACHMENT_BYTES

ELO_MAX_UPLOAD_BYTES

## Checklist de deploy

□ Criar Web Service

□ Conectar GitHub

□ Selecionar branch main

□ Root backend

□ Build npm install

□ Start npm start

□ Configurar variaveis

□ Deploy

□ Testar /health

□ Confirmar:

database = supabase_configured

□ Testar login

□ Testar produto

□ Testar sincronizacao

## Verificacoes tecnicas

- `backend/package.json` define `npm start` como `node src/server.js`.
- `backend/src/server.js` usa `PORT` com fallback para `3000`.
- `backend/src/app.js` expoe `/api/stock-full/health` e exige Supabase para as rotas online do Stock Full.
- `backend/src/supabase.js` le `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- `backend/.env.example` ja contem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
- `backend/DEPLOY.md` documenta Render/Railway, root `backend`, `npm install` e `npm start`, mas ainda estava focado no backend IA.

## Dependencias

As dependencias usadas pelo backend estao declaradas em `backend/package.json`:

- `@supabase/supabase-js`
- `busboy`
- `cors`
- `dotenv`
- `express`
- `pdf-parse`
- `xlsx`

Tambem sao usados modulos nativos do Node.js, como `node:fs`, `node:path`, `node:url`, `node:vm`, `node:test`, `node:assert/strict` e `node:os`.

## Validacao local realizada

- `node --check backend/src/server.js`: passou.
- `node --check backend/src/app.js`: passou.
- `npm install --dry-run` dentro de `backend`: passou.
- Start local temporario com `node src/server.js`: passou.
- `GET /api/health` local respondeu `{"ok":true,"service":"ObraReport AI Backend"}`.

## Pontos de atencao antes da publicacao

- A `SUPABASE_SERVICE_ROLE_KEY` deve ficar somente no Render/backend.
- Nao colocar `SUPABASE_SERVICE_ROLE_KEY` em frontend, HTML, GitHub, prints ou documentos publicos.
- Depois do deploy, validar primeiro `/api/stock-full/health`.
- O Stock Full so deve ir para teste em dois celulares quando o health retornar `database = supabase_configured`.

## Resposta final

O backend esta pronto para ser publicado tecnicamente, desde que o servico Render seja criado/configurado com as variaveis obrigatorias e o schema/tabelas do Stock Full existam no Supabase.

Falta fora do codigo:

- Criar ou localizar o Web Service `obrareport-backend` no Render.
- Conectar o repositorio `icaroamaralengenharia-source/icaroamaral`.
- Selecionar branch `main`.
- Definir Root Directory como `backend`.
- Configurar `SUPABASE_URL`.
- Configurar `SUPABASE_SERVICE_ROLE_KEY`.
- Configurar `OPENAI_API_KEY`.
- Fazer deploy/restart.
- Confirmar `/api/stock-full/health` com `database = supabase_configured`.
