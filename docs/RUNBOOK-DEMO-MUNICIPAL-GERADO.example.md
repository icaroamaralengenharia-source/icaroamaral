# Runbook Demo Municipal Gerado - Exemplo

Gerado em: 2026-08-01T00:00:00.000Z

## Ambiente

- Nome: `DEMO_MUNICIPAL_EXEMPLO`
- Dominio planejado: `https://demo-municipal.exemplo.com`
- Project ref: `demowizardabcdefghij`
- Responsavel tecnico: `OperadorTecnicoDemo`

## Usuarios Ficticios

- Platform admin: `11111111...1111`
- Municipal admin: `22222222...2222`
- Gestor: `33333333...3333`
- Leitura: `44444444...4444`

## Hashes

O wizard calcula localmente os SHA-256 de:

- `backend/src/data/municipal-demo-schema-bundle.sql`
- `backend/src/data/municipal-demo-seed.sql`
- `backend/src/data/municipal-demo-verification.sql`
- `backend/src/data/municipal-demo-live-verification.sql`

## Ordem Manual

1. Criar projeto Supabase demo isolado manualmente.
2. Criar quatro usuarios ficticios no Auth demo.
3. Configurar variaveis fora do Git.
4. Rodar preflight local.
5. Rodar dry-run do schema.
6. Aplicar schema manualmente no SQL Editor.
7. Rodar dry-run do seed.
8. Substituir placeholders.
9. Aplicar seed manualmente no SQL Editor.
10. Rodar verification read-only.
11. Validar health, painel, offline e testes live por blocos.
12. Registrar evidencia.

## Comandos Seguros

- `npm --prefix backend run demo:preflight`
- `npm --prefix backend run demo:apply-schema`
- `npm --prefix backend run demo:apply-seed`
- `npm --prefix backend run demo:verify`
- `npm --prefix backend run demo:smoke:local`

## Escritas Manuais Destacadas

- Aplicar schema manualmente somente apos autorizacao.
- Aplicar seed manualmente somente apos substituir placeholders.
- Cleanup manual somente com evidencia e autorizacao.

## Proibicoes

- Nao executar SQL automaticamente.
- Nao usar Supabase CLI.
- Nao inserir credenciais no Git.
- Nao ativar WhatsApp/e-mail.
- Nao usar E2E ou producao.
- Nao imprimir URL privada, token, senha ou UUID completo.
