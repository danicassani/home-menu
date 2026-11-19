-- Ejecutar manualmente en SQL Editor como propietario del proyecto.
-- Sustituye el UUID por el de TU cuenta en Authentication > Users.
-- No es una migración y no se concede ningún permiso automáticamente.
insert into public.catalog_admins(user_id)
values ('REEMPLAZAR_POR_TU_UUID_DE_AUTH'::uuid)
on conflict (user_id) do nothing;
