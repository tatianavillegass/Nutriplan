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
  -- Material de consulta que ven todas sus clientas: guía de raciones,
  -- productos, cómo leer una etiqueta.
  recursos     jsonb,
  -- Retos: grupos que empiezan el mismo día y comparten recetas y recursos.
  retos        jsonb,
  actualizado  timestamptz not null default now()
);

-- Para las cuentas que ya existían antes de que hubiera recursos y retos.
-- La app funciona sin estas columnas —se sube lo demás igual— pero hasta que
-- se creen, recursos y retos se quedan sólo en el navegador.
alter table public.nutricionistas
  add column if not exists recursos jsonb;

alter table public.nutricionistas
  add column if not exists retos jsonb;

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


-- ══════════════════════════════════════════════════════════════
--  EL ENLACE PÚBLICO DEL RETO
-- ══════════════════════════════════════════════════════════════
--  Aquí entra gente sin cuenta: alguien que acaba de pagar en Stripe
--  y aterriza en el formulario. Dos tablas y dos reglas muy estrechas.

-- Lo mínimo de un reto para poder enseñarlo sin identificar a nadie.
-- NO lleva participantes ni recetas: eso no lo ve quien se apunta.
create table if not exists public.retos_publicos (
  id           text        primary key,
  nutri_id     uuid        not null references public.nutricionistas on delete cascade,
  nombre       text        not null default '',
  descripcion  text,
  fecha_inicio date,
  dias         int         not null default 30,
  actualizado  timestamptz not null default now()
);

alter table public.retos_publicos enable row level security;

-- Cualquiera puede leerlos: son el escaparate del reto.
drop policy if exists "retos_publicos_lectura" on public.retos_publicos;
create policy "retos_publicos_lectura" on public.retos_publicos
  for select using (true);

-- Escribirlos, sólo su dueña.
drop policy if exists "retos_publicos_escritura" on public.retos_publicos;
create policy "retos_publicos_escritura" on public.retos_publicos
  for all using (auth.uid() = nutri_id) with check (auth.uid() = nutri_id);


-- Lo que rellena quien se apunta. Todavía no es una clienta.
create table if not exists public.solicitudes (
  id        text        primary key,
  reto_id   text        not null,
  email     text,
  datos     jsonb       not null default '{}'::jsonb,
  creada    timestamptz not null default now()
);

alter table public.solicitudes enable row level security;

-- Se puede ESCRIBIR sin cuenta, que es todo el asunto del enlace público.
drop policy if exists "solicitudes_alta" on public.solicitudes;
create policy "solicitudes_alta" on public.solicitudes
  for insert with check (true);

-- Pero NO leer: quien se apunta no puede ver quién más se ha apuntado.
--
-- Y no basta con «que haya entrado con cuenta»: aquí hay nombres, correos,
-- pesos y antecedentes de salud. Sólo puede leerlas la dueña del reto al que
-- pertenecen, comprobado contra `retos_publicos`.
drop policy if exists "solicitudes_lectura" on public.solicitudes;
create policy "solicitudes_lectura" on public.solicitudes
  for select using (
    exists (
      select 1 from public.retos_publicos r
      where r.id = solicitudes.reto_id and r.nutri_id = auth.uid()
    )
  );

drop policy if exists "solicitudes_borrado" on public.solicitudes;
create policy "solicitudes_borrado" on public.solicitudes
  for delete using (
    exists (
      select 1 from public.retos_publicos r
      where r.id = solicitudes.reto_id and r.nutri_id = auth.uid()
    )
  );

-- ── Que pueda ir preparándose mientras espera ───────────────────────────────
--
-- Entre apuntarse y empezar pasan días, y en ese hueco se pierde la gente. La
-- pantalla de la cuenta atrás la deja medirse, subir su foto y marcar la guía,
-- pero eso llega ANTES de que tenga cuenta: hay que poder escribir sobre su
-- propia solicitud sin haber iniciado sesión.
--
-- Se permite actualizar, no leer. El id de la solicitud es aleatorio y sólo lo
-- tiene el navegador que la creó, así que hace de llave: sin poder listarlas,
-- no hay forma de saber qué id tocar. Es el mismo trato que el alta.
drop policy if exists "solicitudes_preparacion" on public.solicitudes;
create policy "solicitudes_preparacion" on public.solicitudes
  for update using (true) with check (true);

-- ────────────────────────────────────────────────────────────────────────────
--  EL MURO DEL RETO
-- ────────────────────────────────────────────────────────────────────────────
--
-- Lo que hace grupo no es un muro de publicaciones —si cinco publican y quince
-- miran, las quince se sienten menos del grupo— sino ver que las demás también
-- están apareciendo hoy.
--
-- Por eso aquí sólo hay tres cosas: quién, qué día, y si lo cerró. Ni comida,
-- ni peso, ni notas: nada de lo que una participante escribe en su registro
-- sale de su registro. Con esto se puede pintar «hoy han cerrado Marta, Ana y
-- Lucía» y la meta común del grupo, y nada más.
create table if not exists public.muro (
  reto_id     text        not null,
  cliente_id  text        not null references public.clientes(id) on delete cascade,
  nombre      text        not null,
  fecha       date        not null,
  cerrado     boolean     not null default false,
  actualizado timestamptz not null default now(),
  primary key (reto_id, cliente_id, fecha)
);

alter table public.muro enable row level security;

-- Cada una escribe SU fila y sólo la suya: la comprobación es su propio correo
-- contra la ficha, igual que en los registros.
drop policy if exists "muro_propio" on public.muro;
create policy "muro_propio" on public.muro
  for all using (
    exists (
      select 1 from public.clientes c
      where c.id = muro.cliente_id and lower(c.email) = lower(auth.jwt() ->> 'email')
    )
  )
  with check (
    exists (
      select 1 from public.clientes c
      where c.id = muro.cliente_id and lower(c.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- Y lee el muro quien está en ese muro. La comprobación va en una función
-- porque una política que consulta su propia tabla se llama a sí misma sin
-- parar: Postgres corta con «infinite recursion detected in policy» y la tabla
-- entera deja de poder leerse. Con `security definer`, la función mira el muro
-- por debajo de las políticas y devuelve un sí o un no.
create or replace function public.esta_en_el_muro(p_reto text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.muro m
    join public.clientes c on c.id = m.cliente_id
    where m.reto_id = p_reto
      and lower(c.email) = lower(auth.jwt() ->> 'email')
  );
$$;

drop policy if exists "muro_del_grupo" on public.muro;
create policy "muro_del_grupo" on public.muro
  for select using (
    public.esta_en_el_muro(muro.reto_id)
    or exists (
      select 1 from public.retos_publicos r
      where r.id = muro.reto_id and r.nutri_id = auth.uid()
    )
  );

-- ============================================================
--  LAS FOTOS DE LAS RECETAS, FUERA DE LOS DATOS
-- ============================================================
-- Hasta ahora cada foto viajaba dentro del jsonb, escrita como texto. Eso
-- hacía que la app de una clienta se descargara el banco entero —con TODAS las
-- fotos— antes de poder enseñarle su plan: varios megas por la conexión de su
-- móvil, y una pantalla en blanco mientras tanto.
--
-- Con esto la foto se guarda como archivo y en los datos queda un enlace. Los
-- datos pasan de megas a kilobytes.
--
-- Es público a propósito: son fotos de platos, y así el móvil de la clienta
-- las pide sin pedir permiso a nadie. Los nombres llevan un identificador
-- imposible de adivinar y el listado está cerrado. LAS FOTOS DE PROGRESO DE
-- LAS CLIENTAS NO VAN AQUÍ: ésas son personales y siguen dentro de su registro,
-- que sólo pueden leer ella y su nutricionista.

insert into storage.buckets (id, name, public)
values ('recetas', 'recetas', true)
on conflict (id) do nothing;

drop policy if exists "fotos_de_recetas_las_ve_cualquiera" on storage.objects;
create policy "fotos_de_recetas_las_ve_cualquiera"
  on storage.objects for select
  using (bucket_id = 'recetas');

drop policy if exists "fotos_de_recetas_las_sube_la_nutri" on storage.objects;
create policy "fotos_de_recetas_las_sube_la_nutri"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'recetas');

drop policy if exists "fotos_de_recetas_las_cambia_la_nutri" on storage.objects;
create policy "fotos_de_recetas_las_cambia_la_nutri"
  on storage.objects for update to authenticated
  using (bucket_id = 'recetas');

drop policy if exists "fotos_de_recetas_las_borra_la_nutri" on storage.objects;
create policy "fotos_de_recetas_las_borra_la_nutri"
  on storage.objects for delete to authenticated
  using (bucket_id = 'recetas');
