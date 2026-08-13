-- ============================================================
--  NUTRIPLAN — ESQUEMA DE LA BASE DE DATOS
-- ============================================================
--  Pega este archivo entero en Supabase → SQL Editor → Run.
--  Se puede volver a ejecutar sin miedo: no borra nada.
--
--  La idea en una frase: cada nutricionista tiene una fila con
--  lo que comparte (recetas, alimentos, plantillas), cada cliente
--  tiene la suya con su ficha y su plan, y los registros del día
--  son lo que la clienta marca y la nutricionista lee.
-- ============================================================


-- ------------------------------------------------------------
--  1. TABLAS
-- ------------------------------------------------------------

-- La nutricionista. El id es el mismo que le da Supabase al
-- registrarse, así que no hace falta enlazar nada a mano.
create table if not exists public.nutricionistas (
  id           uuid primary key references auth.users on delete cascade,
  nombre       text        not null default '',
  recetas      jsonb       not null default '[]'::jsonb,
  alimentos    jsonb       not null default '[]'::jsonb,
  plantillas   jsonb       not null default '{}'::jsonb,
  actualizado  timestamptz not null default now()
);

-- Un cliente. Conserva el id que ya usa la app (cl_xxxx) para no
-- tener que reescribir los planes al subirlos.
create table if not exists public.clientes (
  id           text        primary key,
  nutri_id     uuid        not null references public.nutricionistas on delete cascade,
  -- Con este email entrará el cliente. Es lo único que le da acceso
  -- a su plan: no hace falta que la nutricionista le mande nada.
  email        text,
  ficha        jsonb       not null default '{}'::jsonb,
  planes       jsonb       not null default '[]'::jsonb,
  mediciones   jsonb       not null default '[]'::jsonb,
  actualizado  timestamptz not null default now()
);

create index if not exists clientes_por_nutri on public.clientes (nutri_id);

-- Un mismo email no puede ser cliente de dos sitios a la vez: si no,
-- al entrar no se sabría qué plan enseñarle.
create unique index if not exists clientes_email_unico
  on public.clientes (lower(email)) where email is not null;

-- Lo que el cliente marca cada día. Es el único sitio donde escribe
-- él, y de aquí sale el seguimiento que ve la nutricionista.
create table if not exists public.registros (
  id           text        primary key,
  cliente_id   text        not null references public.clientes on delete cascade,
  fecha        date        not null,
  datos        jsonb       not null default '{}'::jsonb,
  actualizado  timestamptz not null default now()
);

create unique index if not exists registros_un_dia
  on public.registros (cliente_id, fecha);


-- ------------------------------------------------------------
--  2. AYUDAS
-- ------------------------------------------------------------

-- El email de quien está entrando, en minúsculas.
create or replace function public.mi_email() returns text
  language sql stable
as $$ select lower(auth.jwt() ->> 'email') $$;

-- ¿Soy cliente de esta nutricionista? Va en `security definer` a
-- propósito: si consultara `clientes` con las reglas normales se
-- morderían la cola. Sólo devuelve sí o no, no enseña ningún dato.
create or replace function public.es_mi_nutri(n uuid) returns boolean
  language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.clientes c
    where c.nutri_id = n and lower(c.email) = public.mi_email()
  )
$$;


-- ------------------------------------------------------------
--  3. QUIÉN PUEDE VER QUÉ  (Row Level Security)
-- ------------------------------------------------------------
--  Sin esto cualquiera con la clave pública leería todas las
--  fichas. Con esto, la base de datos misma se encarga: aunque
--  alguien manipule la app, no saca nada que no sea suyo.

alter table public.nutricionistas enable row level security;
alter table public.clientes       enable row level security;
alter table public.registros      enable row level security;

-- --- nutricionistas -----------------------------------------

drop policy if exists nutri_ve_lo_suyo on public.nutricionistas;
create policy nutri_ve_lo_suyo on public.nutricionistas
  for select using (id = auth.uid() or public.es_mi_nutri(id));

drop policy if exists nutri_crea_lo_suyo on public.nutricionistas;
create policy nutri_crea_lo_suyo on public.nutricionistas
  for insert with check (id = auth.uid());

drop policy if exists nutri_edita_lo_suyo on public.nutricionistas;
create policy nutri_edita_lo_suyo on public.nutricionistas
  for update using (id = auth.uid()) with check (id = auth.uid());

-- --- clientes -----------------------------------------------

-- La nutricionista ve a los suyos; el cliente se ve a sí mismo.
drop policy if exists clientes_visibles on public.clientes;
create policy clientes_visibles on public.clientes
  for select using (nutri_id = auth.uid() or lower(email) = public.mi_email());

drop policy if exists clientes_los_crea_la_nutri on public.clientes;
create policy clientes_los_crea_la_nutri on public.clientes
  for insert with check (nutri_id = auth.uid());

drop policy if exists clientes_los_edita_la_nutri on public.clientes;
create policy clientes_los_edita_la_nutri on public.clientes
  for update using (nutri_id = auth.uid()) with check (nutri_id = auth.uid());

drop policy if exists clientes_los_borra_la_nutri on public.clientes;
create policy clientes_los_borra_la_nutri on public.clientes
  for delete using (nutri_id = auth.uid());

-- --- registros ----------------------------------------------

-- El cliente escribe los suyos; la nutricionista los lee.
drop policy if exists registros_visibles on public.registros;
create policy registros_visibles on public.registros
  for select using (
    cliente_id in (select id from public.clientes)
  );

drop policy if exists registros_los_escribe_el_cliente on public.registros;
create policy registros_los_escribe_el_cliente on public.registros
  for insert with check (
    cliente_id in (select id from public.clientes where lower(email) = public.mi_email())
       or cliente_id in (select id from public.clientes where nutri_id = auth.uid())
  );

drop policy if exists registros_los_corrige_el_cliente on public.registros;
create policy registros_los_corrige_el_cliente on public.registros
  for update using (
    cliente_id in (select id from public.clientes where lower(email) = public.mi_email())
       or cliente_id in (select id from public.clientes where nutri_id = auth.uid())
  );

drop policy if exists registros_los_borra_la_nutri on public.registros;
create policy registros_los_borra_la_nutri on public.registros
  for delete using (
    cliente_id in (select id from public.clientes where nutri_id = auth.uid())
  );


-- ------------------------------------------------------------
--  4. SEGUIMIENTO EN VIVO
-- ------------------------------------------------------------
--  Para que la nutricionista vea aparecer lo que la clienta va
--  marcando sin recargar la página, Postgres tiene que publicar
--  los cambios de la tabla. Sin esta línea la app funciona
--  igual, pero hay que recargar para ver lo nuevo.
--
--  Las reglas de arriba se siguen aplicando: cada quien recibe
--  avisos sólo de las filas que ya podía leer.

alter publication supabase_realtime add table public.registros;


-- ------------------------------------------------------------
--  5. LISTO
-- ------------------------------------------------------------
--  Comprobación rápida: estas tres consultas tienen que devolver
--  cero filas y ningún error.
--    select count(*) from public.nutricionistas;
--    select count(*) from public.clientes;
--    select count(*) from public.registros;
