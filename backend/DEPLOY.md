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
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=chave_privilegiada_apenas_no_backend
ELO_TELEMETRY_ADMIN_TOKEN=segredo_privado_apenas_no_backend
ELO_RDO_STORE=supabase
```
Para produção, mantenha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `ELO_RDO_STORE=supabase` configurados. O backend falha no startup se o armazenamento Supabase do RDO não estiver disponível; o JSON local só é usado em testes ou quando `ELO_RDO_STORE=file` é escolhido explicitamente.

Para a observabilidade do ELO Oficial, aplique `src/data/elo-telemetry-migration.sql` no mesmo projeto Supabase de produção e configure `ELO_TELEMETRY_ADMIN_TOKEN` somente no serviço backend. O dashboard usa a sessão Bearer de uma role interna no navegador; o segredo administrativo não é enviado ao cliente. Não há job de retenção criado por esta migration: a política deve ser definida e automatizada separadamente antes de declarar retenção ativa.

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
