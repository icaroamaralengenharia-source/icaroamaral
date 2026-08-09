# Manual Stock Full

Status: producao assistida.
Classificacao: COMPROVADA.
Rotas verificadas: /stock-full-app.html, /stock-full.html e /stockfull.html.

## Para que serve

Stock Full controla estoque e almoxarifado com produtos, entradas, saidas, saldo, auditoria, filtros e PDFs gerenciais/auditoria. Tambem possui evidencias de operacao mobile, fila offline e leitura de NF-e em testes especificos.

## Operacao basica

1. Abrir a rota do Stock Full e confirmar empresa/ambiente.
2. Cadastrar ou localizar item.
3. Registrar entrada com quantidade, fornecedor e observacao.
4. Registrar saida com destino, responsavel e motivo.
5. Conferir saldo e historico.
6. Usar filtros antes de gerar PDF gerencial ou PDF de auditoria.

## Boas praticas

- Conferir unidade de medida antes de somar saldos.
- Evitar misturar empresas, ambientes e filtros em relatorios.
- Usar idempotencia/fila offline quando a conexao oscilar.
- Para grande volume, reduzir periodo ou aplicar filtros antes de gerar PDF de auditoria.

## Comprovado

- Entradas e saidas com auditoria.
- Bloqueio de saida excessiva em cenarios reais.
- Isolamento entre empresas em testes.
- PDFs gerencial e auditoria, inclusive mobile e filtros reais.
- Backup/exportacao de estado em stress de grande volume.

## Limitacoes

A seguranca e as dependencias do ambiente precisam ser auditadas antes de venda autonoma. Fluxos integrados longos com ELO/Stock tiveram timeout na auditoria geral antiga e devem ser usados com acompanhamento ate nova rodada dedicada.
