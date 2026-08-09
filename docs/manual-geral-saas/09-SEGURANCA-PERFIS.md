# Manual Seguranca e Perfis

Status: base operacional com ressalvas.
Classificacao: COMPROVADA_COM_RESSALVA.

## Principios

O ecossistema usa controle de sessao, perfis, escopo por empresa/instituicao/projeto/unidade e separacao entre leitura e escrita. O backend deve ser a fonte final de autorizacao.

## Perfis comuns

- Platform admin: administracao ampla do ambiente.
- Municipal admin: administracao do escopo municipal.
- Gestor: operacao com escrita dentro do escopo.
- Leitura/read-only: consulta sem alteracao.
- Operador/funcionario: fluxo reduzido quando aplicavel.

## Boas praticas

- Nao compartilhar sessao.
- Validar empresa/unidade antes de registrar dado.
- Usar ambiente demo isolado para apresentacao.
- Nao colocar credenciais em arquivos versionados.
- Revalidar RLS/permissoes no Supabase antes de piloto externo.

## Ressalvas

A auditoria registrou vulnerabilidades npm como ressalva de seguranca. Isso nao bloqueia uso assistido, mas impede declarar maturidade comercial plena sem tratamento posterior.
