-- ============================================================
--  EL ACCESO CADUCADO CIERRA DE VERDAD
--  ------------------------------------------------------------
--  Hasta ahora «Acceso hasta» era una nota en la tabla de la
--  nutricionista y nada más: nadie comprobaba la fecha, así que
--  una clienta dada de baja en marzo seguía entrando en octubre
--  y marcando comidas como si siguiera en consulta.
--
--  La pantalla ya se lo dice (ver `AccesoTerminado`), pero una
--  pantalla es un cartel, no una puerta. Esto es la puerta:
--  mientras la fecha esté pasada, el servidor **no le acepta
--  nada escrito**. Ni marcar una comida, ni apuntar un peso, ni
--  subir una foto.
--
--  SE LE CIERRA LA ESCRITURA, NO SE LE BORRA NADA
--  ----------------------------------------------
--  Lo que ya tiene apuntado sigue ahí y lo sigue leyendo la
--  nutricionista: sus medidas de seis meses no son del bono, son
--  suyas. Y si renueva, al alargar la fecha vuelve todo sin
--  tocar ni una fila.
--
--  POR QUÉ NO SE LE ESCONDE LA FICHA
--  ---------------------------------
--  Se probó y es peor: si la regla le oculta la fila de
--  `clientes`, la app no puede saber quién es y le sale «no
--  encontramos tu ficha» — que parece una avería y acaba en un
--  mensaje preguntando si la app está rota. Dejándosela leer, la
--  app lee la fecha y le explica lo que pasa. Lo que no puede es
--  escribir.
--
--  Esto significa que el plan que ya tenía sigue siendo legible
--  para quien sepa mirar por dentro del navegador. Es a
--  propósito: ese plan ya lo pagó.
--
--  CÓMO SE EJECUTA
--  ---------------
--  En Supabase → SQL Editor → pegar todo → Run. Se puede
--  ejecutar las veces que haga falta: sólo reemplaza reglas.
-- ============================================================


-- ------------------------------------------------------------
--  1. ¿Tiene el acceso vigente?
-- ------------------------------------------------------------
--  Sin fecha, el acceso es abierto: es la misma regla que en la
--  app (`estadoAcceso`), y tener dos definiciones distintas de
--  «activa» en los dos lados sería peor que cualquiera de ellas.
--
--  Va en `security definer` por lo mismo que `es_mi_nutri`: si
--  consultara `clientes` con las reglas normales se morderían la
--  cola. Sólo devuelve sí o no, no enseña ningún dato.
create or replace function public.tiene_acceso(cliente text)
  returns boolean
  language sql stable security definer set search_path = public
as $$
  select coalesce(
    (
      select
        case
          when c.ficha->>'accesoHasta' is null
            or btrim(c.ficha->>'accesoHasta') = '' then true
          -- Un texto que no sea una fecha no puede cerrarle la
          -- puerta a nadie: ante la duda, se deja pasar y se
          -- arregla el dato.
          when (c.ficha->>'accesoHasta') !~ '^\d{4}-\d{2}-\d{2}$' then true
          else (c.ficha->>'accesoHasta')::date >= current_date
        end
      from public.clientes c
      where c.id = cliente
    ),
    false
  )
$$;


-- ------------------------------------------------------------
--  2. Con el acceso pasado, no escribe
-- ------------------------------------------------------------
--  La nutricionista sigue pudiendo escribir en el registro de
--  cualquiera de los suyos —corrige, prepara la vuelta, apunta
--  lo que le cuenta por teléfono— y por eso su rama no lleva la
--  comprobación: el candado es para la clienta, no para ella.

drop policy if exists registros_los_escribe_el_cliente on public.registros;
create policy registros_los_escribe_el_cliente on public.registros
  for insert with check (
    cliente_id in (
      select id from public.clientes
      where lower(email) = public.mi_email()
    ) and public.tiene_acceso(cliente_id)
    or cliente_id in (
      select id from public.clientes where nutri_id = auth.uid()
    )
  );

drop policy if exists registros_los_corrige_el_cliente on public.registros;
create policy registros_los_corrige_el_cliente on public.registros
  for update using (
    cliente_id in (
      select id from public.clientes
      where lower(email) = public.mi_email()
    ) and public.tiene_acceso(cliente_id)
    or cliente_id in (
      select id from public.clientes where nutri_id = auth.uid()
    )
  );


-- ------------------------------------------------------------
--  3. Comprobarlo
-- ------------------------------------------------------------
--  Con el id de una clienta a la que se le haya pasado la fecha:
--
--    select public.tiene_acceso('<id-de-la-clienta>');   -- false
--
--  Y con una al día, true. Si sale true en las dos, la fecha no
--  está guardada donde se cree: mirar
--
--    select id, ficha->>'accesoHasta' from public.clientes;
