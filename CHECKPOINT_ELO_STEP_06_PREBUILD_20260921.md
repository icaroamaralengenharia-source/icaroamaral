# Checkpoint local — ELO Step 06 prebuild

- Origem: `a07a17729db0ae060bcfbc3581a7a4f0e62ac714`
- Worktree: `C:\elo-worktrees\elo-step06-vistoria-prebuild`
- Branch: `feat/elo-step06-vistoria-controller`
- Persistência executada: JSON local; repositório Supabase preparado, mas não ativado nem aplicado.

## Escopo validado

- `inspection.create`: criação autenticada, projeto obrigatório e idempotência local.
- `inspection.updateItem`: status `C/NC/NA/NV/NI`, severidade, observação e fail-closed para item ambíguo.
- `inspection.attachPhoto`: anexa referência de foto ao item sem inventar upload/storage.
- `inspection.list`, `inspection.get`, `inspection.openNCs` e `inspection.generatePdf`: preservados e cobertos no Action Bus.
- Tenant: instituição obrigatória; acesso cruzado bloqueado.
- Documento controlado: geração HTML transacional; endpoint PDF real coberto pela suíte existente.

## Artefatos preparados

- `backend/src/services/obrareport-apartment-handover-repository.js`
- `backend/src/data/apartment-handover-inspections-migration.sql`
- Testes locais de serviço, Action Bus, E2E HTTP e stress.

## Limites

Nenhuma migração live, escrita Supabase, alteração de produção, ADB, dispositivo, deploy, PR ou merge foi executado. O app Android/P0-3, Mensageiro e Offline V2 ficaram intocados.
