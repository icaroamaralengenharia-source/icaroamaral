# Evidencias de Homologacao E2E Municipal

## Identificacao

- Data e hora:
- Operador:
- Projeto confirmado visualmente: `mplpzyalcxhhinuvjthx`
- Projeto proibido nao utilizado: `lidueokjpzxdybtongbk`

## Arquivos aplicados

- SHA-256 do bundle `municipal-e2e-homologation.sql`:
- SHA-256 da verificacao `municipal-e2e-verification.sql`:

## Resultado da aplicacao

- SQL executado uma unica vez:
- Resultado exibido pelo Supabase:
- Erros na aplicacao:
- Analise antes de qualquer reexecucao:

## Verificacao pos-SQL

- Tabelas criadas/encontradas:
  - `municipal_assets`:
  - `municipal_asset_history`:
  - `municipal_notifications`:
- RLS ativado:
  - `municipal_assets`:
  - `municipal_asset_history`:
  - `municipal_notifications`:
- Policies encontradas:
  - `municipal_assets_select_scoped`:
  - `municipal_assets_write_admin_scoped`:
  - `municipal_asset_history_select_scoped`:
  - `municipal_asset_history_write_admin_scoped`:
  - `municipal_notifications_select_scoped`:
  - `municipal_notifications_service_all`:
- Indices encontrados:
- Constraint de tombamento unico:

## Consistencia dos dados

- Tombamentos duplicados:
- Registros sem `institution_id`:
- Registros com `unit_id` invalido:
- Quantidade de registros por tabela:

## Validacao funcional posterior

- Patrimonio validado no painel:
- Notificacoes validadas no painel:
- Painel integrado validado:
- Evidencias anexadas:

## Decisao

- Aprovacao ou reprovacao:
- Responsavel pela decisao:
- Observacoes:

## Registro da homologacao E2E basica

- Projeto: `mplpzyalcxhhinuvjthx`
- Aplicacao: SUCCESS — No rows returned
- Tabelas: 3 confirmadas (`municipal_assets`, `municipal_asset_history`, `municipal_notifications`)
- RLS: true nas 3 tabelas
- Policies: confirmadas
- Indices: confirmados
- Tombamento unico: UNIQUE confirmado
- Channel/status: constraints confirmadas
- Inconsistencias: 0
- Observacao: primeira verificacao falhou por alias `cc.table_name`; arquivo corrigido.
- Resultado final: APROVADO NO E2E
