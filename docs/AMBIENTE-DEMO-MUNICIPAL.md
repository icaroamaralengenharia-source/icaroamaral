# Ambiente Demo Municipal

## Finalidade

O ambiente demo municipal existe para demonstrar a plataforma a clientes com seguranca, isolamento e dados ficticios. Ele nao substitui E2E, homologacao nem producao, e nao pode reutilizar banco, usuarios ou credenciais desses ambientes como fallback operacional.

## Arquitetura

- Frontend estatico do painel municipal publicado em dominio demo.
- Backend Express municipal em ambiente separado.
- Banco demo dedicado, configurado por variaveis `DEMO_*`.
- CORS fechado por `AI_ALLOWED_ORIGINS`.
- WhatsApp e e-mail externos desligados por padrao.
- ELO Municipal pode funcionar quando `OPENAI_API_KEY` estiver configurada apenas no backend; se ausente, o painel deve continuar operacional.

## Variaveis

Copie o exemplo antes de configurar localmente:

```text
copy backend\.env.demo.example backend\.env.demo.local
```

Preencha somente em ambiente seguro. Nunca coloque valores reais em commits, prints ou documentos.

Variaveis principais:

- `APP_ENV=demo`
- `NODE_ENV=production`
- `MUNICIPAL_DEMO_MODE=true`
- `DEMO_DATABASE_URL`
- `DEMO_SUPABASE_URL`
- `DEMO_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_ALLOWED_ORIGINS`
- `MUNICIPAL_WHATSAPP_ENABLED=false`
- `MUNICIPAL_EMAIL_ENABLED=false`
- `OPENAI_API_KEY`, opcional e somente backend

## Banco Demo

- Criar um projeto/banco exclusivo para demonstracao.
- Nao usar o projeto E2E.
- Nao usar o projeto proibido.
- Nao usar banco de producao.
- Aplicar schemas somente em etapa aprovada, com backup e janela tecnica.
- Usar dados com prefixo `DEMO_MUNICIPAL_`.

## Usuarios E Dados Ficticios

- Prefeitura ficticia, unidades ficticias e usuarios ficticios.
- Nomes, e-mails e registros devem ser claramente demonstrativos.
- Preferir dominios reservados como `example.invalid`.
- Nao usar CPF, telefone, e-mail, nome de cliente real ou imagem real.
- Nao criar senha fixa exposta no repositorio.

## Validacao

Execute os checks locais antes de preparar deploy:

```text
node --test backend/tests/municipal-demo-config.test.js
node --test backend/tests/municipal-deploy-readiness.test.js
```

O loader `backend/src/municipal-demo-config.js` valida:

- variaveis obrigatorias;
- projeto E2E/proibido;
- wildcard em CORS;
- HTTP fora de localhost;
- WhatsApp/e-mail ativos;
- saida sanitizada sem segredos.

## Inicio Local

1. Configure variaveis em terminal local seguro.
2. Rode o backend apontando para o ambiente demo isolado.
3. Abra o painel municipal estatico.
4. Confirme `/api/health`.
5. Confirme que o painel nao quebra sem chave de IA.

## Preparar Deploy

- Configurar dominio HTTPS do ambiente demo.
- Definir `AI_ALLOWED_ORIGINS` com dominios exatos.
- Configurar secrets somente no backend.
- Conferir que `municipal-admin.html` aponta para o backend demo correto via configuracao publica segura.
- Confirmar health sem URL, chave, token ou project ref completo.
- Rodar readiness antes de expor a demonstracao.

## Desligar

- Revogar usuarios demo.
- Desativar dominio ou proteger acesso.
- Limpar caches locais de navegadores usados na apresentacao.
- Manter logs sanitizados pelo periodo aprovado.

## Rollback

- Reverter backend para commit anterior aprovado.
- Reverter arquivos estaticos do painel para versao anterior.
- Nao reverter banco sem plano especifico.
- Preservar logs sanitizados para diagnostico.

## Proibicoes

- Nao executar SQL sem etapa propria.
- Nao acessar Supabase nesta preparacao.
- Nao usar E2E como demo.
- Nao usar producao como demo.
- Nao ativar WhatsApp/e-mail antes de aceite.
- Nao colocar service key no frontend.
- Nao publicar credenciais.
- Nao fazer deploy publico sem checklist e aceite.