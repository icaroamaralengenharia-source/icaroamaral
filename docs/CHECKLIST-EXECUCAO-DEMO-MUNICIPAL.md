# Checklist de Execucao Demo Municipal

Use este checklist somente para preparar e executar manualmente um ambiente demo isolado. Nao use E2E, producao, Supabase CLI automatizado ou credenciais versionadas.

## FASE 1 - Antes de Criar o Projeto

- [ ] Autorizacao formal registrada.
- [ ] Nome ficticio da demo definido.
- [ ] Responsavel operacional definido.
- [ ] Dominio HTTPS planejado.
- [ ] Backup e janela de reversao definidos.
- [ ] Isolamento confirmado: nao e E2E, producao ou cliente real.

## FASE 2 - Projeto Demo

- [ ] Criar projeto demo manualmente.
- [ ] Registrar project ref em local seguro.
- [ ] Confirmar que o project ref nao e `mplpzyalcxhhinuvjthx`.
- [ ] Confirmar que o project ref nao e `lidueokjpzxdybtongbk`.
- [ ] Salvar credenciais fora do Git.
- [ ] Nao colar credenciais em chat, issue, log ou documento versionado.

## FASE 3 - Usuarios Ficticios

- [ ] Criar usuario ficticio platform_admin.
- [ ] Criar usuario ficticio municipal_admin.
- [ ] Criar usuario ficticio gestor.
- [ ] Criar usuario ficticio leitura.
- [ ] Registrar UUIDs em cofre seguro.
- [ ] Confirmar que nenhum UUID pertence a usuario real.

## FASE 4 - Configuracao

- [ ] Copiar `backend/.env.demo.local.example` para arquivo local nao versionado.
- [ ] Preencher variaveis localmente.
- [ ] Confirmar `APP_ENV=demo`.
- [ ] Confirmar `MUNICIPAL_DEMO_MODE=true`.
- [ ] Configurar CORS sem wildcard.
- [ ] Usar HTTPS publico ou localhost apenas local.
- [ ] Manter WhatsApp desligado.
- [ ] Manter e-mail desligado.

## FASE 5 - Validacao

- [ ] Rodar preflight dry-run.
- [ ] Rodar schema dry-run.
- [ ] Rodar seed dry-run com UUIDs ficticios reais da demo.
- [ ] Rodar verification dry-run.
- [ ] Rodar cleanup dry-run.
- [ ] Rodar smoke local.
- [ ] Confirmar que nenhum comando usou `--execute` sem autorizacao.

## FASE 6 - Aplicacao Manual Autorizada

- [ ] Aplicar bundle manualmente no SQL Editor autorizado.
- [ ] Confirmar usuarios ficticios no Auth demo.
- [ ] Aplicar seed manualmente depois de substituir placeholders.
- [ ] Rodar verificacao manual read-only.
- [ ] Salvar evidencias sanitizadas.
- [ ] Nao repetir aplicacao em caso de erro sem analise.

## FASE 7 - Painel

- [ ] Validar login.
- [ ] Validar estoque.
- [ ] Validar patrimonio.
- [ ] Validar Sentinela.
- [ ] Validar notificacoes in-app.
- [ ] Validar Acervo.
- [ ] Validar relatorios.
- [ ] Validar ELO municipal.
- [ ] Validar offline.
- [ ] Validar responsividade desktop, tablet e celular.

## FASE 8 - Encerramento

- [ ] Fazer backup das evidencias.
- [ ] Fazer logout de todas as sessoes de teste.
- [ ] Desligar demo se a janela de uso terminou.
- [ ] Executar cleanup opcional apenas com revisao humana.
- [ ] Arquivar evidencias.
- [ ] Registrar aceite ou rejeicao.
