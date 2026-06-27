# Stock Full Runtime Schema

Este documento explica o schema SQL compatível com o backend atual do Stock Full.

O arquivo SQL correspondente é:

```text
backend/src/data/stock-full-runtime-schema.sql
```

## Por Que Este Schema Existe

O backend atual do Stock Full, em `backend/src/app.js`, não usa o modelo SaaS novo com `companies`, `products`, `stock_movements` e `audit_logs`.

As rotas atuais usam:

- `profiles` com `institution_id`;
- `stock_full_items`;
- `stock_full_entries`;
- `stock_full_exits`;
- `stock_full_audit_log`.

Por isso foi criado um schema runtime específico, alinhado ao que o código realmente consulta hoje.

## Por Que Não Usar `stock-full-saas-schema.sql` Agora

O arquivo `backend/src/data/stock-full-saas-schema.sql` cria tabelas como:

- `companies`;
- `products`;
- `stock_movements`;
- `audit_logs`.

Esse modelo usa `company_id`, mas o backend atual usa `institution_id`.

Aplicar esse schema sozinho não atenderia as rotas atuais do Stock Full, porque o backend não consulta `products` nem `stock_movements`.

## Por Que Não Usar `stock-full-schema.sql` Sozinho

O arquivo `backend/src/data/stock-full-schema.sql` cria as tabelas `stock_full_*`, mas não cria `profiles`.

O backend precisa de `profiles` para:

- login real;
- associação com `auth_user_id`;
- leitura de `institution_id`;
- leitura de `role`;
- autorização de admin/funcionário.

Sem `profiles`, o endpoint `/api/stock-full/login` pode autenticar o usuário no Supabase Auth, mas falhará com `stock_full_profile_not_found`.

## Tabelas Esperadas Pelo Backend

Obrigatórias:

- `profiles`;
- `stock_full_items`;
- `stock_full_entries`;
- `stock_full_exits`;
- `stock_full_audit_log`.

Campos críticos:

- `profiles.auth_user_id`;
- `profiles.institution_id`;
- `profiles.role`;
- `stock_full_items.institution_id`;
- `stock_full_items.current_quantity`;
- `stock_full_entries.item_id`;
- `stock_full_exits.item_id`;
- `stock_full_audit_log.institution_id`.

## Como Aplicar No Supabase SQL Editor

1. Abrir o projeto Supabase correto.
2. Abrir o SQL Editor.
3. Revisar o arquivo `backend/src/data/stock-full-runtime-schema.sql`.
4. Conferir que não há secrets, tokens ou chaves no SQL.
5. Executar o SQL manualmente somente após revisão.
6. Verificar no Table Editor se as tabelas foram criadas.

Nenhum SQL deve ser executado antes de revisar.

## Segurança

Este schema não ativa RLS agora.

Motivo:

- o backend atual usa `SUPABASE_SERVICE_ROLE_KEY`;
- as rotas validam `institution_id`;
- as políticas de RLS ainda não foram definidas para este modelo runtime.

RLS pode ser ativado futuramente quando houver política definida.

Nunca colocar no SQL:

- `SUPABASE_SERVICE_ROLE_KEY`;
- tokens de sessão;
- senhas;
- chaves privadas;
- dados reais sensíveis.

## Próximos Passos Após Aplicar

1. Configurar o serviço Render paralelo `obrareport-backend-stockfull`.
2. Configurar `SUPABASE_URL`.
3. Configurar `SUPABASE_SERVICE_ROLE_KEY`.
4. Configurar `OPENAI_API_KEY`.
5. Validar:

```text
https://obrareport-backend-stockfull.onrender.com/api/stock-full/health
```

6. Confirmar retorno:

```json
"database": "supabase_configured"
```

7. Criar usuários reais no Supabase Auth.
8. Criar registros correspondentes em `profiles`.
9. Testar login real.
10. Testar produto compartilhado entre duas sessões.
11. Testar entrada, saída e bloqueio de saldo negativo.
12. Testar offline queue e sincronização.

## Exemplo De Perfil

Após criar o usuário em Supabase Auth, copie o UUID do usuário e crie o perfil correspondente:

```sql
-- Admin
insert into public.profiles (auth_user_id, institution_id, unit_id, name, email, role)
values ('UUID_DO_AUTH_USER', 'empresa-teste', 'matriz', 'Admin Teste', 'admin@empresa.com', 'admin');

-- Operador
insert into public.profiles (auth_user_id, institution_id, unit_id, name, email, role)
values ('UUID_DO_AUTH_USER', 'empresa-teste', 'matriz', 'Operador Teste', 'operador@empresa.com', 'operador');
```

Os e-mails acima são exemplos. Use usuários reais criados no Supabase Auth durante a validação.
