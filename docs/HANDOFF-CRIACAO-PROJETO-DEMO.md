# Handoff Criacao Projeto Demo Municipal

Use este handoff para criar manualmente o projeto demo e devolver ao Codex apenas dados nao sensiveis.

## Passos do Operador

1. Abrir o provedor autorizado.
2. Criar um projeto exclusivo de demonstracao.
3. Usar nome interno obrigatoriamente iniciado por `DEMO_MUNICIPAL_`.
4. Nao reutilizar:
   - E2E;
   - producao;
   - projeto de cliente.
5. Escolher uma regiao adequada para a demonstracao.
6. Definir senha forte fora do Git e fora do chat.
7. Nunca enviar ao Codex/chat:
   - senha;
   - token;
   - credencial de sessao;
   - chave administrativa;
   - string de conexao.
8. Registrar somente:
   - nome interno;
   - dominio HTTPS planejado;
   - project ref;
   - regiao;
   - data;
   - responsavel;
   - isolamento;
   - backup;
   - WhatsApp desligado;
   - e-mail desligado.
9. Confirmar que o project ref nao e:
   - `mplpzyalcxhhinuvjthx`
   - `lidueokjpzxdybtongbk`
10. Parar antes de executar qualquer SQL.

## Bloco Copiavel Para Retorno

Preencha somente estes campos e devolva ao Codex.

```text
NOME_INTERNO=
DOMINIO_HTTPS=
PROJECT_REF=
REGIAO=
RESPONSAVEL=
ISOLAMENTO=SIM
BACKUP=SIM
WHATSAPP_DESLIGADO=SIM
EMAIL_DESLIGADO=SIM
```

## Regras de Seguranca

- Nao enviar senha.
- Nao enviar token.
- Nao enviar credencial de sessao.
- Nao enviar chave administrativa.
- Nao enviar string de conexao.
- Nao executar SQL nesta fase.
- Nao criar usuarios nesta fase.
- Nao fazer deploy nesta fase.
- Nao colar prints com credenciais.
- Parar se o projeto aberto parecer E2E, producao ou cliente.

## Primeira Acao Manual

Abrir o provedor autorizado e criar um projeto novo e exclusivo com nome interno iniciado por `DEMO_MUNICIPAL_`.
