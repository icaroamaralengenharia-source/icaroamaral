# Guia de Criacao do Ambiente Demo Municipal

Este guia prepara um ambiente demonstrativo isolado para a Plataforma Municipal Integrada. Ele nao autoriza uso de E2E nem producao.

## 1. Banco Demo Isolado

1. Criar um novo projeto Supabase exclusivo para demonstracao.
2. Nao reutilizar E2E, homologacao de cliente ou producao.
3. Registrar o identificador do projeto demo em documento interno seguro.
4. Confirmar que o projeto nao contem dados reais.

## 2. Dominio e HTTPS

1. Configurar dominio publico da demo com HTTPS.
2. Nao usar wildcard em CORS.
3. Nao expor localhost em ambiente publico.
4. Liberar somente origens da demo.

## 3. Variaveis

Configurar no backend:

- `APP_ENV=demo`
- `NODE_ENV=production`
- `MUNICIPAL_DEMO_MODE=true`
- `DEMO_SUPABASE_URL`
- `DEMO_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_ALLOWED_ORIGINS`
- `MUNICIPAL_WHATSAPP_ENABLED=false`
- `MUNICIPAL_EMAIL_ENABLED=false`
- `MUNICIPAL_DEMO_SEED_ENABLED=false`

Nao registrar valores de chaves em documentos, logs ou prints.

## 4. Isolamento

Antes de aplicar qualquer SQL:

1. Confirmar visualmente que o projeto aberto e o banco demo isolado.
2. Confirmar que nao e E2E.
3. Confirmar que nao e producao.
4. Confirmar que nao ha dados de cliente.

## 5. Preflight Seguro

Antes da aplicacao manual, rodar em dry-run:

```bash
cd backend
npm run demo:preflight
```

O preflight nao executa SQL e bloqueia E2E/producao conhecida.

## 6. Aplicar Bundle

1. Abrir o SQL Editor do banco demo.
2. Copiar integralmente `backend/src/data/municipal-demo-schema-bundle.sql`.
3. Executar uma unica vez.
4. Salvar o resultado exibido.
5. Em caso de erro, parar e analisar antes de repetir.

## 7. Usuarios Ficticios

Criar manualmente usuarios ficticios no Auth do projeto demo para:

- platform_admin demo;
- municipal_admin demo;
- gestor demo;
- leitura demo.

Nao usar nome real, CPF, telefone, e-mail real ou cliente real.

## 8. Substituir Placeholders

No arquivo `backend/src/data/municipal-demo-seed.sql`, substituir:

- `DEMO_PLATFORM_ADMIN_USER_ID`
- `DEMO_MUNICIPAL_ADMIN_USER_ID`
- `DEMO_GESTOR_USER_ID`
- `DEMO_LEITURA_USER_ID`

Usar somente UUIDs reais dos usuarios ficticios criados no Auth demo.

## 9. Aplicar Seed

1. Confirmar que todos os placeholders foram substituidos.
2. Copiar integralmente o seed ajustado.
3. Executar uma unica vez.
4. Confirmar que todos os dados criados usam prefixo `DEMO_MUNICIPAL_`.

## 10. Rodar Verificacao

1. Abrir nova consulta.
2. Copiar `backend/src/data/municipal-demo-verification.sql`.
3. Executar.
4. Salvar todos os resultados.
5. Confirmar tabelas, RLS, policies, indices, dados demo e inconsistencias zero.

## 11. Iniciar Backend

1. Subir backend com variaveis demo.
2. Validar `/api/health`.
3. Confirmar que a resposta nao exibe segredos.
4. Confirmar WhatsApp e e-mail desativados.

## 12. Testar Painel

Validar:

- Visao Geral;
- Almoxarifados;
- Sentinela;
- Relatorios;
- Acervo;
- Patrimonio;
- Auditoria;
- Notificacoes;
- Assistente ELO.

Usar somente usuarios ficticios e dados `DEMO_MUNICIPAL_`.

## 13. Testar Offline

1. Sincronizar patrimonio autorizado.
2. Desconectar rede.
3. Consultar bens e historico sincronizados.
4. Confirmar `last_synced_at`.
5. Confirmar que nenhuma escrita funciona offline.
6. Fazer logout e confirmar invalidacao do cache sensivel.

## 14. Rollback

Rollback de schema e somente documentado/aditivo: nao usar `DROP` ou `TRUNCATE`.

Para remover dados demo, usar apenas o cleanup manual depois de revisar filtros.

## 15. Cleanup

1. Confirmar que todos os dados a remover usam `DEMO_MUNICIPAL_`.
2. Copiar `backend/src/data/municipal-demo-cleanup.sql`.
3. Executar manualmente apenas no banco demo.
4. Nunca apagar usuarios Auth automaticamente.
5. Rodar verificacao novamente.

## 16. Encerramento

Encerrar a demo somente apos:

- evidencias salvas;
- usuarios ficticios desativados ou removidos manualmente;
- cleanup revisado, se necessario;
- ambiente isolado confirmado;
- nenhum segredo publicado.