# ObraReport

SaaS para relatórios técnicos de fiscalização de obras da Ícaro Amaral Engenharia.

## Protocolo de Operação do ELO

Toda evolução do ELO deve seguir: docs/POC-ELO-1.0.md

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

## Planos e limites em modo demo

A camada comercial local fica em:

```text
relatorio-qualidade-obras/plans.js
relatorio-qualidade-obras/usage-limits.js
relatorio-qualidade-obras/billing-demo.js
```

Planos disponíveis:

```text
Gratuito: até 2 clientes, 2 obras, 5 relatórios/mês, 10 fotos/relatório, IA limitada e PDF marcado para marca d'água.
Profissional: clientes/obras ilimitados, 100 relatórios/mês, 50 fotos/relatório, IA liberada e PDF sem marca d'água.
Empresa: estrutura preparada para relatórios ilimitados e múltiplos usuários futuramente.
```

No ambiente local (`127.0.0.1` ou `localhost`), a aba **Planos** permite trocar o plano em modo demo, sem pagamento real. Em produção, essa troca fica bloqueada até integrar checkout.

Os limites bloqueiam de forma amigável:

```text
criação de clientes
criação de obras
criação de relatórios mensais
adição de fotos por relatório
uso de IA
```

Pagamentos reais com Stripe ou Mercado Pago ainda não foram implementados.

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

## Portao unico de acesso

Todas as paginas HTML publicaveis devem carregar a mesma protecao frontend:

```html
<script>
document.documentElement.classList.add('site-access-locked');
</script>

<link rel="stylesheet"
href="/assets/site-access-gate.css?v=20260710-access-v2">

<script
src="/assets/site-access-gate.js?v=20260710-access-v2"
defer></script>
```

Arquivos compartilhados:

```text
assets/site-access-gate.css
assets/site-access-gate.js
```

A sessao usa `sessionStorage` com a chave `icaro_site_access_v2`, vale para as paginas protegidas durante a navegacao da mesma aba e pode ser encerrada com `window.logoutSite()`. Ela nao persiste permanentemente no navegador e termina ao fechar completamente a aba.

Ao adicionar qualquer novo arquivo `.html`, incluir o snippet acima no inicio do `<head>` e tambem `<meta name="robots" content="noindex, nofollow, noarchive">` para manter a pagina bloqueada e fora de indexacao temporariamente. Este bloqueio e apenas frontend, temporario e voltado a visitantes comuns; JavaScript frontend pode ser contornado, os arquivos continuam sendo entregues pela hospedagem e protecao real exige Cloudflare Access, autenticacao de servidor ou origem privada.
## Segurança

- Não versionar `backend/.env`.
- Usar apenas `backend/.env.example` como modelo.
- O frontend chama somente o endpoint seguro.
- A IA local continua ativa como fallback.
- Upload de fotos, PDF, Apps Script, IndexedDB e localStorage são preservados.
