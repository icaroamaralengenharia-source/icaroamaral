-- CLEANUP MANUAL DA HOMOLOGACAO FUNCIONAL 43.
-- Projeto autorizado: mplpzyalcxhhinuvjthx.
-- Projeto proibido: lidueokjpzxdybtongbk.
-- Execute somente no Supabase E2E, depois de confirmar visualmente o project ref.
-- Remove exclusivamente dados com prefixo HOMOLOGACAO_FUNCIONAL_43_.
-- Nunca remove instituicao, unidade ou usuario.

do $$
begin
  if current_setting('municipal_e2e.project_ref', true) is distinct from 'mplpzyalcxhhinuvjthx' then
    raise exception 'Defina SET municipal_e2e.project_ref = mplpzyalcxhhinuvjthx antes do cleanup manual E2E.';
  end if;
end $$;

delete from public.municipal_notifications
where title like 'HOMOLOGACAO_FUNCIONAL_43_%'
   or deduplication_key like 'HOMOLOGACAO_FUNCIONAL_43_%'
   or source_id like 'HOMOLOGACAO_FUNCIONAL_43_%';

delete from public.municipal_asset_history
where asset_id in (
  select id from public.municipal_assets
  where asset_tag like 'HOMOLOGACAO_FUNCIONAL_43_%'
     or name like 'HOMOLOGACAO_FUNCIONAL_43_%'
     or category like 'HOMOLOGACAO_FUNCIONAL_43_%'
);

delete from public.municipal_assets
where asset_tag like 'HOMOLOGACAO_FUNCIONAL_43_%'
   or name like 'HOMOLOGACAO_FUNCIONAL_43_%'
   or category like 'HOMOLOGACAO_FUNCIONAL_43_%';
