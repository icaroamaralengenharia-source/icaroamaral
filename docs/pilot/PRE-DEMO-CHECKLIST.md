# Checklist pré-demo

- [ ] AUTH: harness ou conta válida disponível.
- [ ] Usuário e tenant resolvidos; nunca `local@obrareport.app` por fallback silencioso.
- [ ] Fixture `Residencial Horizonte` disponível.
- [ ] Stock fixture carregada: cimento, aço e bloco.
- [ ] RDO fixture disponível.
- [ ] `C:\elo-step05-proof\03-rdo-report.pdf` existe, começa com `%PDF-` e pode abrir; se não, preparar plano B.
- [ ] Vistoria fixture abre.
- [ ] Fixtures TXT/CSV/MD e imagem estão disponíveis.
- [ ] Memória começa limpa no harness.
- [ ] Internet/backend health verificados quando o fluxo depender deles.
- [ ] Browser escolhido e sem abas pessoais expostas.
- [ ] App, se usado, está no ambiente autorizado.
- [ ] `npm.cmd run pilot-demo-smoke` executa com PASS.

## Plano B

Usar o PDF pré-validado, fixtures locais e screenshots somente se necessários para explicar uma tela. Nunca apresentar screenshot como prova de execução nova.
