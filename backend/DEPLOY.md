# Deploy do Backend IA ObraReport

## Plataforma recomendada

Use Render ou Railway. Para publicar hoje com menor atrito, Render é a opção mais simples para um serviço Node.js com variáveis de ambiente.

## Configuração do serviço

- Pasta raiz: `backend`
- Comando de instalação: `npm install`
- Comando de start: `npm start`

## Variáveis necessárias

Cadastre no painel da plataforma:

```text
OPENAI_API_KEY=sua_chave_da_openai
NODE_ENV=production
```

Opcionalmente, ajuste:

```text
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4.1-mini
AI_ALLOWED_ORIGINS=https://www.icaroamaral.com.br,https://icaroamaral.com.br,http://localhost,http://localhost:3000,http://127.0.0.1:5500,http://127.0.0.1:5502
AI_JSON_LIMIT=3mb
```

## Teste apos deploy

Verifique a saude do backend:

```text
GET https://URL-DO-BACKEND/api/health
```

Resposta esperada:

```json
{
  "ok": true,
  "service": "ObraReport AI Backend"
}
```

## Teste da IA visual

Envie um `POST` para:

```text
https://URL-DO-BACKEND/api/ai/analyze-image
```

O corpo deve conter uma imagem processada em base64:

```json
{
  "image": {
    "base64": "BASE64_DA_IMAGEM",
    "mimeType": "image/jpeg",
    "fileName": "foto.jpg",
    "width": 1280,
    "height": 720
  },
  "context": {
    "report": {
      "obra": "Obra teste"
    },
    "imageLabel": "Foto da inconformidade 01"
  }
}
```

## Configurar o frontend

No site publicado, defina a URL publica do backend antes de carregar `relatorio-config.js`:

```html
<script>
  window.OBRAREPORT_API_BASE_URL = "https://URL-DO-BACKEND";
</script>
```

Em desenvolvimento local, se `window.OBRAREPORT_API_BASE_URL` nao for definida, o frontend usa automaticamente:

```text
http://localhost:3000
```

## Seguranca

- Nao exponha `OPENAI_API_KEY` no frontend.
- Nao commite `.env`.
- O frontend chama apenas o backend.
- O backend chama a OpenAI usando variavel de ambiente.
