# ObraReport

SaaS para relatórios técnicos de fiscalização de obras da Ícaro Amaral Engenharia.

## Frontend

```bash
npm install
npm run dev
```

Acesse:

```text
http://127.0.0.1:5500/relatorio-qualidade-obras.html
```

Build de produção:

```bash
npm run build
```

## Backend seguro da IA

O backend fica em:

```text
backend/
```

Ele protege a chave da OpenAI. A chave nunca deve ser colocada no HTML, no JavaScript público ou em arquivos publicados no site.

### Instalar

```bash
cd backend
npm install
```

### Configurar

Crie o arquivo `.env` dentro de `backend/`, usando `.env.example` como base:

```text
OPENAI_API_KEY=sua_chave_aqui
PORT=3000
OPENAI_MODEL=gpt-5.4-mini
AI_ALLOWED_ORIGINS=http://127.0.0.1:5500,http://localhost:5500
```

### Rodar

```bash
cd backend
npm run dev
```

Endpoint:

```text
POST http://localhost:3000/api/ai/improve-text
POST http://localhost:3000/api/ai/analyze-image
```

Actions aceitas:

```text
improve
conclusion
review
```

Se o backend estiver desligado, sem `.env` ou sem `OPENAI_API_KEY`, o frontend continua usando a IA local/mock automaticamente.

### IA visual de fotos

A análise visual usa a foto já comprimida pelo frontend do ObraReport. O upload original não é alterado.

Fluxo:

```text
foto do usuário -> compressão local JPEG/base64 -> botão "Analisar foto com IA" -> backend seguro -> sugestão revisável
```

O backend recebe:

```json
{
  "image": {
    "base64": "...",
    "mimeType": "image/jpeg",
    "fileName": "foto.jpg",
    "width": 1280,
    "height": 720
  },
  "context": {}
}
```

A IA visual retorna descrição técnica, possíveis inconformidades, recomendação e texto pronto para inserir no relatório. O usuário sempre revisa e aceita ou recusa.

## Rodar frontend e backend juntos

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
cd backend
npm run dev
```

## Testes

Frontend:

```bash
npm run build
```

Backend:

```bash
cd backend
npm test
```

## Segurança

- Não versionar `backend/.env`.
- Usar apenas `backend/.env.example` como modelo.
- O frontend chama somente o endpoint seguro.
- A IA local continua ativa como fallback.
- Upload de fotos, PDF, Apps Script, IndexedDB e localStorage são preservados.
