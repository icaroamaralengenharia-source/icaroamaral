# Stock Saude - Setup seguro do Supabase real

Este guia prepara o Stock Saude para validar Supabase real sem expor chaves e sem remover o fallback localStorage.

## 1. Variaveis do backend

Configure somente no arquivo local `backend/.env`:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

Nunca coloque valores reais em `backend/.env.example`, commits, prints, issues, logs ou mensagens de chat.

## 2. Onde pegar as variaveis

`SUPABASE_URL`:
- Acesse o projeto no Supabase.
- Abra Project Settings.
- Abra API.
- Copie Project URL.

`SUPABASE_SERVICE_ROLE_KEY`:
- Acesse Project Settings.
- Abra API.
- Copie a chave `service_role`.
- Use somente no backend.
- Nunca use essa chave no frontend.

## 3. Protecao do arquivo .env

Antes de preencher valores reais, confirme:

```powershell
git status --short
git ls-files backend/.env
```

O comando `git ls-files backend/.env` nao deve retornar nada. O arquivo `backend/.env` deve ficar ignorado pelo Git.

## 4. Aplicar o schema no Supabase

1. Abra o Supabase.
2. Entre no SQL Editor.
3. Abra o arquivo local:

```text
backend/src/data/stock-saude-schema.sql
```

4. Cole o conteudo no SQL Editor.
5. Execute o script.
6. Confirme que as tabelas foram criadas:

```text
institutions
units
profiles
stock_items
stock_entries
stock_exits
stock_audit_log
```

Observacao: nesta versao o schema usa `stock_entries` e `stock_exits`. Ainda nao existe uma tabela separada `approval_requests`.

## 5. Criar usuario teste no Supabase Auth

1. Abra Authentication.
2. Abra Users.
3. Crie um usuario de teste com email e senha.
4. Copie o UUID do usuario criado.

Esse UUID sera usado em `profiles.auth_user_id`.

## 6. Criar instituicao, unidade e profile vinculado

No SQL Editor, rode um script adaptado como este:

```sql
insert into institutions (name, document)
values ('Instituicao Teste Stock Saude', 'TESTE')
returning id;
```

Copie o `id` retornado e use como `institution_id`:

```sql
insert into units (institution_id, name, type)
values ('COLE_AQUI_O_INSTITUTION_ID', 'Unidade Teste', 'saude')
returning id;
```

Copie o `id` retornado e use como `unit_id`.

Agora crie o profile vinculado ao usuario Auth:

```sql
insert into profiles (
  auth_user_id,
  institution_id,
  unit_id,
  name,
  email,
  role
)
values (
  'COLE_AQUI_O_UUID_DO_USUARIO_AUTH',
  'COLE_AQUI_O_INSTITUTION_ID',
  'COLE_AQUI_O_UNIT_ID',
  'Usuario Teste Stock Saude',
  'email-do-usuario-teste@exemplo.com',
  'gestor'
)
returning id, auth_user_id, institution_id, unit_id, role;
```

## 7. Testar o endpoint /api/stock-saude/me

1. Inicie o backend local.
2. Gere uma sessao Supabase para o usuario de teste.
3. Copie somente o `access_token` da sessao.
4. Chame:

```powershell
curl.exe -H "Authorization: Bearer COLE_AQUI_O_ACCESS_TOKEN" http://localhost:3000/api/stock-saude/me
```

Resultado esperado:

```json
{
  "ok": true,
  "user": {
    "id": "...",
    "email": "..."
  },
  "profile": {
    "id": "...",
    "institution_id": "...",
    "unit_id": "...",
    "name": "...",
    "email": "...",
    "role": "gestor"
  }
}
```

Se retornar `stock_saude_profile_not_found`, confira se `profiles.auth_user_id` e o UUID do usuario Auth sao iguais.

Se retornar `stock_saude_database_not_configured`, confira `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` no `backend/.env`.

Se retornar `invalid_session`, gere um novo `access_token`.

## 8. Validar fallback local

Sem `SUPABASE_URL` ou sem token no navegador, o frontend deve continuar em modo local e usar localStorage. Isso e esperado nesta fase.

## 9. Nunca commitar

Nunca commitar:

```text
backend/.env
SUPABASE_SERVICE_ROLE_KEY
access_token
refresh_token
prints com chaves
logs com chaves
```

Pode commitar somente placeholders seguros em `backend/.env.example`.

