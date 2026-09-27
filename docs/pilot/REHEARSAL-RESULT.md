# Ensaio do piloto — 27/09/2026

Ambiente: `C:\elo-pilot-rc`, Pilot RC local/harness.

## Resultado

- Demo Flow 1 — auth e tenant: PASS
- Demo Flow 2 — obra Residencial Horizonte: PASS
- Demo Flow 3 — Stock: PASS
- Demo Flow 4 — RDO: PASS
- Demo Flow 5 — artefato PDF pré-validado: PASS
- Demo Flow 6 — vistoria: PASS
- Demo Flow 7 — anexo e análise de fixture: PASS
- Demo Flow 8 — relatório a partir da análise: PASS
- Demo Flow 9 — memória explícita: PASS
- Demo reset: PASS, estado temporário isolado e removido ao final

## Evidência automatizada

```text
pilot-demo-smoke: 1/1 PASS
Step 06 focado: 7/7 PASS
Step 07 + auth/memória: 16/16 PASS
Step 08 + auth/core: 18/18 PASS
roteamento/regressões imediatas/auth: 39/39 PASS
```

O smoke não acessa banco live, não executa migration live e não publica produção. A análise semântica real continua condicionada ao backend/modelo configurado; quando indisponível, o roteiro usa a fixture e declara o limite.
