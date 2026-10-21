# NutriPlan — lee esto antes de tocar nada

Este archivo lo lee Claude solo al abrir un chat nuevo. Si estás empezando una
conversación, aquí tienes todo lo que hace falta saber.

Vive **dentro del repo** para que viaje con el código: se sube a GitHub con
cada commit, así que tiene copia y se puede ver cómo ha ido cambiando. Fuera
quedó un recordatorio de tres líneas que apunta aquí — si la sesión se abre en
la carpeta de arriba, ése es el que se lee primero.

## Qué es

App web para que Tatiana Villegas (nutricionista) monte planes por
intercambios. El código está en esta misma carpeta (`nutriplan/`), que cuelga
de `UPGRADE APP/`.

Cuatro fases de entrega, cada una da más libertad al cliente:

1. **Fase 1** — recetas cerradas, escaladas a lo pautado.
2. **Fase 2** — combinaciones ya calculadas que el cliente pulsa.
3. **Fase 3** — porciones abiertas: el cliente elige de su despensa.
4. **Fase 4** — conteo de macros en gramos, sin porciones. Es el alta.

## Cómo se trabaja

```bash
# desde esta carpeta (nutriplan/)
npm test          # vitest — han de pasar TODOS antes de dar nada por hecho
npx tsc -b        # sin errores
npm run build     # dist/, lo que publica Vercel
npm run build:file && cp dist-file/index.html ../NutriPlan.html
```

Al terminar un bloque de trabajo: tests + build + `git commit`. **El push lo
hace Tats** desde GitHub Desktop — Claude no tiene credenciales de GitHub y
`git push` va a fallar. Decírselo, no intentarlo.

Los mensajes de commit van en castellano, explicando **por qué** se hizo el
cambio, no qué archivos se tocaron.

## Reglas de negocio que NO se pueden romper

Están todas implementadas y con tests. Si algo parece un fallo, mirar primero
si es una de estas decisiones:

- **Macros, no familias ni subgrupos.** Lo que tiene que cuadrar son las
  porciones de proteína, carbohidrato y grasa; de dónde salgan es cosa de la
  receta. Si el desayuno pauta 1 almidón y 1 fruta y la receta sólo trae pan,
  el pan crece hasta cubrir el hidrato de los dos y **no falta nada**. Igual
  con lácteo proteico y proteico magro. Vale para el escalado
  (`recipeScaling`), la completitud (`completitud`), el recomendador
  (`recipeMatcher`) y **las combinaciones de fase 2** (`combos`): los cuatro
  tienen que decir lo mismo. En combos, lo pautado sale primero y las que
  mezclan familias detrás; el techo pasa a ser del macro entero
  (`objetivoUnificado`), así que se cambia de familia pero no se infla la
  comida, y una nota dice con cuántos gramos se queda —«cubre fruta con otra
  familia: 20 g de carbohidrato en vez de 29»— sin bloquear. **Cambiar de
  macro sí es un error**: una grasa donde se pautaba carbohidrato no entra.
- **Los platos son del plan; las cantidades, de cada tipo de día.** Quien
  entrena los lunes no come otra cosa: come lo mismo con más arroz. Por eso las
  recetas de fase 1 viven en `Plan.recetasAsignadas` (comida → recetas) y no en
  el tipo de día. Elegirlas día a día era pautar dos veces y le dejaba a la
  clienta el doble de recetas que repartir en su semana sin que ninguna fuera
  nueva de verdad. Lo que **sí** es de cada tipo de día: el reparto
  (`grid`), los gramos ajustados a mano (`ajustesReceta`) y los
  acompañamientos — ahí es donde ella retoca el día de pierna. Una comida que
  sólo existe un día —la merienda del día de entreno— no necesita nada
  especial: tiene su hueco en el plan como cualquier otra y sólo se le enseña
  los días en que lleva intercambios repartidos (`comidasConPauta`). Para
  organizar la semana se usan **todas** las comidas de todos los días
  (`comidasDeLaSemana`), que si no, en domingo no se puede dejar puesta la
  merienda del martes. Lo que se pautó con el formato viejo **no se pierde**:
  `recetasDelPlan` junta lo que hubiera en los tipos de día —sin repetir— y
  deja que mande lo del plan comida a comida.
- **Lo que se pierde al contar por macro es la grasa de la proteína.** Dos
  claras y dos huevos son 2 porciones igual, pero se llevan 9 g de grasa de
  diferencia. `avisoDeGrasa` lo dice, y sólo con `paraNutricionista`: no es una
  alerta, la comida está bien de macros.
- **Bajar de escalón es libre.** Aceite donde había nueces, proteína magra
  donde había grasa: misma o menos energía, así que ni se avisa ni se recorta.
  Subir sí avisa. Vale también **al escalar la receta**: si lo que trae la
  receta cuesta lo mismo o menos por porción que lo pautado, no se le aplica
  ningún tope. Sin eso, con lácteos proteicos pautados (0 g de grasa) el tope
  de grasa dejaba la whey de la receta en cero gramos y el desayuno se quedaba
  sin proteína, en silencio.
- **Comparar por familia es de todos, también del recomendador.** El «no cubre
  X» de las tarjetas mira familias, no subgrupos: una receta con whey cubre un
  lácteo pautado. Cuando lo cubre con otro subgrupo lo dice, y una receta con
  el subgrupo exacto puntúa por encima.
- **La comida filtra, no puntúa.** La categoría (`Receta.categorias`) sólo
  sumaba 25 puntos en `matchRecipes`, así que un café proteico de desayuno se
  colaba en la cena si cubría bien los macros. En la pantalla de fase 1 ya
  estaba arreglado, pero **en el componente y no en el recomendador**, así que
  la hoja de la nevera y el «¿sin ideas?» de la app seguían con el fallo. Ahora
  filtra `matchRecipes` y vale para todos. Una receta **sin categorías
  declaradas entra en todas**: no se ha dicho dónde va, y esconderla sería
  borrarle recetas del banco sin avisar. `slot: 'todas'` desactiva el filtro, y
  lo usan el selector de fase 1 y **la búsqueda por nombre** —si escribes el
  nombre, la quieres, esté donde esté—.
- **Al pautar se elige mirando, no leyendo.** El recomendador enseñaba **ocho**
  tarjetas y, si lo que querías no estaba entre ellas, una lista de **nombres
  sin foto**: con doscientas recetas en el banco eso es casi siempre, así que la
  mitad de las veces se elegía a ciegas. Ahora es **una sola cuadrícula con
  todas**, en tarjetas con su foto (`components/recipes/RecipeCard.tsx`,
  extraída porque estaba escrita a mano en cinco sitios), ordenadas por lo que
  cubren del reparto: las primeras son las que la app propondría y a partir de
  ahí se sigue bajando. Se pintan **de doce en doce** (`PASO`) con un «ver
  más» — con foto es lo que entra en una pantalla sin que tarde. Una receta sin
  foto **deja el hueco igual**, con un plato en gris: alturas distintas hacen
  que las filas bailen, y el hueco además recuerda que falta la foto.
  **Se dice qué cubre y qué falta, no un porcentaje** (`MatchResult.cubiertos` y
  `requeridos`): «cubre 2 de 3 · falta grasa» es accionable —le pones un yogur
  al lado— y un 96 % no dice si lo que falla es la proteína o el hidrato. **Las
  bloqueadas salen en la cuadrícula**, en gris y sin poder elegirse, con el
  motivo: esconderlas es lo que hacía parecer que faltaban del banco.
  **Y se busca por ingrediente, no sólo por nombre** (`utils/buscarRecetas.ts`).
  Al pautar la pregunta casi nunca es «¿cómo se llamaba?» sino «¿qué tengo con
  salmón?». Se miran el nombre, los **tags** y los ingredientes — el texto
  escrito **y** el nombre del alimento del catálogo, porque la receta pone
  «salmón» y el catálogo «Salmón fresco», y los sueltos sin `foodId` cuentan
  igual o media receta sería invisible. Buscando se **salta el filtro de
  comida**: si la escribes, la quieres. Y se dice **por qué salió**
  (`porQueCoincide`): buscando «huevo» aparece un bizcocho y sin esa línea
  parece un fallo del buscador. La comida sigue filtrando de entrada, con un
  botón para abrirla a las demás.
  **Y va plegado, una comida abierta a la vez.** Con la cuadrícula, cinco
  comidas abiertas son cinco pantallas de fotos: elegir el desayuno y bajar a la
  cena era un viaje, y volver arriba otro. Se abre la que se trabaja
  (`comidaAbierta` en `ClientDetail`) y el resto se queda en una fila — nombre,
  cuántas opciones lleva y **las elegidas en miniatura**, porque una fila que
  sólo dijera «Desayuno» obligaría a abrirla para acordarse de qué le pusiste, y
  así se repasa el plan entero de un vistazo. **Se cierra desde abajo**
  («Cerrar desayuno» y «Siguiente comida →», que cierra ésta y abre la de
  abajo): después de elegir estás al final de la cuadrícula y subir a la
  cabecera para plegarla es el mismo viaje. Al cerrar **se vuelve a su
  cabecera** con `scrollIntoView`, o te quedas a media pantalla de fotos que
  acaba de desaparecer. Empieza **todo cerrado**: al abrir la pestaña lo primero
  es ver cómo está el plan, no meterse en el desayuno. Sin las props
  (`abierto`/`onAlternar`) el componente se comporta como antes —siempre
  abierto—, que es como lo usa cualquier pantalla de una sola comida.
- **Las ideas de fase 2 las elige ella, no el recomendador.** En fase 1 las
  recetas son los platos que come; en fase 2 come combinaciones y las recetas
  son **ideas** de cómo juntarlas. Las ponía el recomendador por su cuenta y no
  había forma de quitar una que no encajaba, porque la tarjeta «Recetas por
  comida» era sólo de fase 1 — y `RepartirLaSemana`, que sí se enseña en fase 2,
  leía esas mismas recetas sin que hubiera dónde ponerlas. La tarjeta se abre en
  fase 2 (`plan.fase <= 2`) con otro nombre, y `ideasDeLaComida` **da las suyas
  si las hay y propone sólo si no**: una hoja sin ideas es peor que unas ideas
  mejorables, y a quien acaba de montar su primer plan no se le puede pedir que
  además elija recetas para que la hoja salga completa. Las suyas van **en su
  orden y sin filtrar por comida** —si la puso ahí, va ahí— pero pasan igual por
  el recomendador, para que sigan trayendo lo que cubren y lo que les falta.
- **Medio gramo de grasa no es pasarse.** El techo de proteicos y grasas se
  mide en gramos de grasa, y un margen del 2 % sobre un número tan pequeño no
  es nada: pautando un lácteo proteico (0 g) y dos magros (0,5 g) el techo era
  1 g y el 2 % dos centésimas, así que cambiar el lácteo por otro magro
  bloqueaba la combinación. Hay un margen fijo de **un gramo**
  (`MARGEN_GRASA_G`, `techoDeFamilia`), y **tiene que quedarse por debajo de
  1,5 g**: eso es lo que cuesta subir una porción de magro a semigraso, y ese
  salto es lo único que el tope existe para vigilar. Con 1,5 se colaba y se
  pasaba de calorías la comida entera.
- **En grasas manda la grasa, no las calorías.** Una porción de nueces son
  59 kcal frente a las 45 del aceite; medirlo en calorías las dejaba siempre
  cortas. En proteicos se miran grasa y calorías.
- **Un subgrupo que no pautaste no es un aviso.** Si el macro del día está
  pautado, elegir otro subgrupo de ese macro no dice nada: almendras donde
  había aceite, yogur proteico donde había pollo. El «X no entra en tu plan de
  hoy» sólo sale cuando el macro entero falta ese día. Sin esto, pautar
  «grasas» y «proteicos magros» —que es como se pauta— llenaba la pantalla de
  avisos por elegir bien, y obligaba a pautar subgrupo por subgrupo. Lo que
  sigue vigilando el plan es el total del macro y, en la proteína, los gramos
  de grasa del día (`balanceGrasa`).
- **Una legumbre gasta carbohidrato Y proteína.** 14 g de hidrato y 7 g de
  proteína son una porción entera de cada. Va en `bucketExtra` de la tabla y lo
  usa `bucketsDeGrupo`: cambia a qué macro se apunta la porción, no los gramos
  —cada macro lee lo suyo de la misma porción, así que no se cuenta dos veces—.
  Sin esto, un plato de lentejas dejaba la proteína del día pidiendo un pollo
  que ya estaba comido. Los lácteos no proteicos (12 g de hidrato) son el mismo
  caso a medias y siguen sin hacerlo: pendiente de decidir.
  **Y el techo también lee lo suyo** (`costeDeFamilia`, `kcalDeOtroMacro`): al
  medir una combinación de carbohidrato se le cobraban a la legumbre las 28
  calorías de su proteína, así que tres lentejas donde había tres almidones se
  pasaban sesenta calorías y quedaban bloqueadas — cuando lo que se comía de
  más era proteína. Al carbohidrato se le cobra el carbohidrato, y la proteína
  que trae se avisa con una **nota** para descontarla de esa comida, igual que
  ya se hacía con el hidrato que traen los lácteos. No bloquea: lo que sigue
  vigilado es que no se infle el hidrato.
  **Pero el descuento es de las opciones, no del techo** (`topeDeLoPautado`):
  aplicárselo también a lo pautado rompía el caso del espejo. Con 1,5 almidones
  y 1,5 legumbres pautados, al techo se le quitaban las 42 calorías de la
  proteína de la legumbre —193,5 en vez de 235,5— mientras que ofrecer 3
  almidones costaba 205,5, así que se bloqueaba la opción que **no** llevaba
  legumbre teniendo los mismos 42 g de hidrato. Son dos preguntas distintas: el
  techo es la energía que ella puso en esa comida, y el coste es lo que esa
  opción gasta de ese macro.
  **Y la columna de proteína lo descuenta sola**: `columnasDeComida` recibe lo
  que la clienta lleva marcado y `cubiertoPorOtroMacro` le resta al objetivo las
  porciones que ya le trae otro macro, así que al elegir 3 lentejas la proteína
  pasa de pedir 4 porciones a pedir 1 —y lo dice en pantalla, que si no parece
  un fallo—. Es lo mismo que el aceite de cocinar, que se descuenta de las
  grasas porque no se elige. Sólo cuenta lo que viene **de otro macro**: si
  contara también lo marcado en la propia columna, cada porción de pollo bajaría
  el objetivo y no se llegaría nunca. Sin `porciones` —el PDF, la pantalla de la
  nutricionista— se comporta como antes.
- **Cada alimento de la despensa tiene su turno en las opciones.** Con dos
  porciones de fruta pautadas y cuatro frutas en la despensa salían **dos**
  opciones, las dos del mismo alimento: la clienta no podía cambiar la fruta.
  Se sumaban tres cosas. Las candidatas se ordenaban **por calorías**, así que
  las treinta primeras eran todas de la que más llena —«370 g de melón», «melón
  con membrillo»— y un plátano no aparecía; ahora mandan las de **un solo
  alimento** antes que las mezclas, porque a las ocho de la mañana se elige un
  alimento y no una receta, y las calorías siguen ordenando dentro de cada
  grupo. La que repetía protagonista se **descartaba en silencio** en vez de
  pasar al siguiente alimento, así que se aceptaban dos y se tiraban veintiocho
  dejando la lista a medias; ahora se elige la primera candidata del alimento
  que **menos veces haya salido**, así que nadie repite hasta que todos han
  salido una vez. Y se reservaban **dos** huecos de cinco para las
  combinaciones que mezclan familias aunque no fuera a haber ninguna —con una
  sola familia cubierta no se genera ni una—, lo que además dejaba dos frutas de
  cuatro cuando sí las había: ahora se reserva **uno**, y sólo si de verdad van
  a generarse. Con una sola fruta en la despensa sigue saliendo **una** opción,
  que es la verdad: lo que hay que hacer es añadir frutas a esa comida.
- **Una combinación de fase 2 no es un bloque cerrado: se le cambia un
  alimento.** En cuanto la nutricionista compone una a mano —avena con
  arándanos— `columnasDeComida` deja de proponer y **ésa es la única que ve la
  clienta**: el día que no le apetezcan arándanos no hay nada que hacer. Y
  pedirle a ella que escriba avena+arándanos, avena+plátano y avena+manzana es
  repetir el mismo trabajo tres veces por comida y por clienta. Ahora se pulsa
  el alimento dentro de la opción elegida y salen sus alternativas con los
  gramos hechos (`utils/cambiarAlimento.ts`); la avena se queda. Es el mismo
  gesto que en fase 1, donde se cambia un ingrediente de la receta pulsándolo.
  **Se cambia por su mismo subgrupo**: fruta por fruta. Dentro de un subgrupo la
  porción es la misma —los mismos 15 g de hidrato— así que el cambio es exacto,
  `cubre` no se toca y no hay techo que comprobar ni nada que avisar.
  **Y en la fruta y la verdura las alternativas son todo el catálogo**
  (`utils/subgruposAbiertos.ts`). Salían sólo de su despensa, y con una sola
  fruta en el desayuno no había ninguna otra que ofrecer: el botón no aparecía
  y la clienta se quedaba comiendo arándanos todos los días. Una porción de
  fruta es cualquier fruta, y eso ya lo decidió la fase 3 con su genérico
  «Fruta»; la regla vive en un sitio y las dos fases la leen.
  **En los demás subgrupos NO se abre, y se probó.** Se abrió en todos un rato
  —la proteína son tres subgrupos y una cena con pollo, salmón y tofu es uno de
  cada, así que ninguno tenía con quién cambiarse— y **Tats lo mandó retirar**:
  en fase 2 lo que ella compone es la comida entera, y ofrecerle a la clienta
  los veintiséis proteicos magros del catálogo le quita a ella la decisión de
  qué cena. **La proteína se cambia en las recetas de fase 1**, que es donde el
  plato ya está escrito y cambiar el pollo por merluza no lo deshace.
  Las de su despensa van **primero**, que son las que ella sugirió. Siguen fuera
  **lo que ella tachó a mano** (`tachadoAMano`, que no es `estaExcluido`: con
  una lista propia todo lo que no esté en ella sale «excluido», y eso son las
  cuarenta frutas del catálogo que nadie ha mirado) y **lo que la clienta tiene
  vetado** (`permitido`, que `ClientView` arma con `evaluarAlimento`). Este
  segundo filtro **no existía**: el catálogo que lee su app **no viene filtrado
  por alérgenos**, así que al abrir la fruta se le podían ofrecer frutas
  vetadas. Se aplica **también a lo de su despensa**: un alérgeno es sí o no y
  da igual quién lo pusiera, así que si le apuntó una alergia después de
  montarle la despensa, lo que quedó ahí tampoco se le ofrece. En la vista
  previa y en el PDF no se pasa filtro: ahí no come nadie.
  Con más de ocho alternativas sale **buscador** —con cuarenta frutas en
  pantalla no se encuentra ninguna— y en su vista previa se dice «puede cambiar
  arándanos por **cualquier fruta**» en vez de enumerar cuatro y «y 36 más»,
  que haría pensar que hay una lista corta que revisar.
  **Y la combinación que resulta del cambio se añade a su columna**
  (`opcionDeLoMarcado` + `conLaElegida` en `ScaledOptionsBoard`). La lista que
  ve la clienta son las que ella guardó o las que propone la app, y «avena con
  manzana» no es ninguna de las dos: al cambiar la fruta, la comida se quedaba
  **sin nada marcado** y parecía que pulsar no hacía nada. Ahora se rehace la
  opción desde lo que hay marcado y se pinta al final, ya elegida — así se le
  puede volver a cambiar la fruta, que es lo normal. **Se mira si alguna de las
  que ya están sale marcada, no si el id coincide**: una combinación guardada
  conserva su propio id (`materializar`), así que la suya y la misma rehecha no
  se llaman igual y comparando ids se pintaba dos veces.
  **Y POR ESO LA FASE 2 NO TIENE DESPENSA.** Se le abrió una cuando estas
  alternativas salían de ella, y eso convirtió el cambio de fruta en trabajo
  suyo: para que la clienta pudiera cambiar, había que cargarle antes cuatro
  frutas en cada comida de cada tipo de día. Media tarde por plan, y trabajo
  que no se ve. Con la fruta y la verdura abiertas al catálogo ya no hace
  falta, así que la fase 2 vuelve a **una sola tarjeta con las combinaciones**
  y `ComidaDeFase2` se retiró. **En fase 3 la despensa sigue**: ahí es la
  clienta quien compone la comida entera y hay que acotarle de qué. Lo que
  quedó guardado de esos días **no se borra solo** —una lista sigue mandando
  sobre lo que se propone— pero se avisa en ámbar en esa tarjeta, con un botón
  para quitarla: un plan al que le salen dos opciones y ningún sitio donde
  mirar por qué es peor que el trabajo que esto ahorraba.
  Cubrir la
  fruta con almidón también se puede, pero **eso ya existe** y es otra cosa: es
  una de las opciones de la columna, con su nota de cuántos gramos se queda;
  meterlo aquí mezclaría una sustitución exacta con una que cambia lo pautado,
  en el mismo gesto. **Las alternativas salen de su despensa, no del catálogo**:
  ahí es donde ya están filtrados sus alérgenos, sus patologías y lo que no le
  gusta, y ofrecerle el catálogo entero se los saltaría justo al comer. La
  opción se rehace con `opcionDeItems` —la misma del generador— para que el id
  salga **ordenado igual**: armado a mano, la misma combinación propuesta por la
  app no se reconocería como la que acaba de elegir. Sólo se ofrece **bajo la
  opción marcada**: con cinco opciones de dos alimentos, diez botones de cambiar
  convierten la comida en un formulario. **Y en la vista previa de la
  nutricionista se dice en gris** («puede cambiar arándanos por plátano,
  manzana»): esa pantalla no es pulsable, así que ninguna opción llega a estar
  elegida y el botón no aparecía nunca — desde la ficha parecía que la función
  no existía. En el PDF no sale: ahí las cantidades vienen hechas y sería ruido.
- **Se puede querer la libertad de la fase 3 y las ideas de la fase 1.** Hay
  quien se maneja con sus porciones pero se queda en blanco delante de la
  nevera: saber que le tocan dos almidones y un proteico no contesta «¿pero qué
  cocino?». Ahora **se le eligen recetas comida a comida en todas las fases**
  —la tarjeta de fase 1 se abre también en la 3 y la 4, con otro subtítulo— y a
  ella le sale una **pestaña «Recetas»** (`BibliotecaDeRecetas`) con lo elegido
  agrupado por comida y **los gramos ya escalados a lo que le toca ese día**:
  una biblioteca con los gramos del banco obligaría a echar la cuenta a mano
  cada vez, y en día de entreno la misma receta lleva más arroz.
  **Es una pestaña y no un trozo del día**: en su pantalla de hoy lo que manda
  son sus porciones, y meter las recetas ahí volvería a decirle qué comer, que
  es justo lo que esta fase deja atrás. Se entra cuando no se te ocurre nada,
  que es cuando hace falta — y por eso la pestaña **sólo aparece si tiene
  recetas puestas** (`hayBiblioteca`): una pestaña vacía es una pestaña que
  enseña que le falta algo. (Desde el cambio a cinco pestañas la biblioteca
  comparte pestaña con los postres y los recursos, pero sigue apareciendo sólo
  si tiene recetas puestas.) **«Me lo he comido» la apunta de un toque**: en
  fase 3 le fija las porciones de esa comida (`aportesDeLaReceta` + el mismo
  atajo de siempre) y en fase 4 le mete el bocado con sus gramos; después
  retoca lo que quiera, que es la regla de todos los atajos. **`RecetasDeConsulta`
  se retiró**: enseñaba lo mismo dentro del día de fase 4 y dos sitios con el
  mismo material acaban discrepando.
- **Una revisión mensual no es un plan nuevo: es el mismo que cambia.** Cada
  mes se vuelven a tomar medidas, se recalcula el gasto y sale otra
  planificación — que **nace clonada de la anterior**, así que en pantalla las
  dos son idénticas hasta que se toca algo. Lo que hace falta tener delante no
  es el plan, que ése ya se está mirando, sino **la diferencia**: sin eso hay
  que abrir la archivada en otra pestaña e ir comparando a ojo, doce veces al
  año. `utils/compararPlanes.ts` + `CambiosDesdeLaAnterior`, **una barra fija
  arriba** mientras se monta —«Planificación 1 → 2 · 404 → 267 kcal · H, P, G»
  con el reparto comida a comida desplegable—: se mira **mientras** se retoca
  el reparto, que es cuando se decide, y una tarjeta que hay que abrir se abre
  una vez y no se vuelve a mirar. **Se calla si no hay nada que decir**
  (`hayCambios`): recién creada es idéntica y «0 kcal, sin cambios» ocupa sitio
  para no informar de nada. Se compara **el primer tipo de día** —el de entreno
  es el mismo plan con más arroz, y meter los dos al lado convierte una línea
  en una tabla— y las comidas se emparejan **por slot y no por id**, que los
  ids de comida son de cada plan. El color del salto **no es verde ni rojo**:
  subir no es bueno ni malo, depende de a quién; sólo dice hacia dónde.
  **Y en la cuadrícula se marca lo que ya tenía** (`recetasPorSlot`,
  `deLaAnterior`): al revisar, la pregunta no es «qué le pongo» sino cuáles le
  deja, cuáles le cambia y cuántas le suma. «Ya la tenía» va **en el pie de la
  tarjeta y no en la esquina**, porque la esquina se esconde en cuanto la
  tarjeta está elegida y las que ya tenía son justo las elegidas. La cabecera
  de cada comida cuenta «2 de antes · 1 nueva · 1 fuera» y **las que se van se
  dicen por su nombre**: una receta que desaparece de la lista no se echa de
  menos, se olvida — y la clienta se queda sin el desayuno que ya se sabía sin
  que nadie lo haya decidido. **Y la nueva nace sin enviar**
  (`nuevaPlanificacion` limpia `envio`, no `publicado`): copiando el envío, la
  planificación recién creada creía estar mandada y el ámbar de «sin enviar»
  no salía nunca; conservando `publicado`, la clienta sigue comiendo la
  anterior hasta que se le manda ésta.
- **Una pareja come los mismos platos con distintas cantidades.**
  `utils/basarEnOtroPlan.ts` + «Basarme en otro plan», en Cálculo plan. Muchas
  parejas comparten platos, compra y nevera pero no cantidades, y montarle a
  ella el plan entero cuando el de él ya está hecho es repetir el trabajo dos
  veces — y deja dos listas de la compra distintas para una sola casa.
  **Las recetas se copian; las cantidades son de cada uno**, que es la regla de
  siempre: los platos son del plan y los gramos salen del reparto de cada
  persona. **El reparto se copia en forma, no en porciones**
  (`repartoEscalado`): qué macros en qué comidas y en qué proporción, escalado
  a las kcal que ella tiene calculadas —lo mismo que ya hacen las plantillas de
  reparto—, porque copiarlo tal cual sería darle el plan de él. Se dice **con
  qué números se escala antes de pulsar**: copiar entre fichas es de las pocas
  cosas que tocan trabajo ya hecho. **Todo se traduce por slot y no por id**,
  que los ids de comida son de cada plan; una comida que él no tiene **se queda
  como estaba** y las recetas **se suman a las de ella** en vez de pisarlas.
  **Se elige qué copiar** (`QueCopiar`: recetas, reparto, despensa y
  combinaciones, menú): para una pareja suele ser todo, pero un botón que lo
  copiara entero pisaría el reparto recién calculado.
  **Lo que no cuadra se dice, no se esconde ni se tira** (`loQueNoCuadra`): si
  él lleva carbohidrato en la cena y ella no, esas recetas se copian igual y
  sale un aviso en ámbar **con nombres y por comida** —«la cena no cuadra» a
  secas obliga a abrirlas todas—. Descartarlas dejaría una cena con cero
  recetas; callarlo sería enviar un plan que no cuadra. Lo calcula
  `matchRecipes`, el mismo que pinta las tarjetas, para que no haya dos cuentas
  que puedan discrepar. **Sólo se ofrece copiar de planes en uso**: de uno
  archivado se traería lo que ya se cambió.
- **El lácteo, según si lo pautaste.** Si el plan pauta lácteo, cada uno cubre
  lo suyo: es el plato de pollo con un yogur de postre y ahí la proteína la
  pone el pollo. Si NO pautaste lácteo, los dos son fuentes de proteína y se
  reparten lo pautado en la proporción de la receta. Antes el proteico se
  estiraba hasta cubrirlo todo y el lácteo entraba con el sitio que sobrara:
  en un bol de avena con yogur y whey salían 5 porciones donde había 4, y en
  un plato de pollo el yogur desaparecía.
- **El lácteo proteico son 7 g de proteína, como un proteico magro.** Iba a 10
  y eso lo hacía un caso aparte de su familia: cambiarlo por un magro perdía
  3 g de proteína y 23 kcal. Ahora se cambian casi 1:1 (40 kcal contra 32,5) y
  el hidrato que arrastra (3 g) ya no llega a media porción de almidón. Los
  otros lácteos siguen a 8 g. **Un bote entero de yogur son ~1,4 intercambios**,
  no uno: por eso esos alimentos llevan `intercambios: 1.4` y la medida casera
  sigue siendo el bote.
- **Piezas enteras.** Huevos, lonchas, rebanadas: nunca 1,5. Se redondea a
  piezas y nunca a cero.
- **Al cambiar un ingrediente manda el plato, no lo pautado.** Cuántas
  porciones «es» un ingrediente salía de `requeridos[su subgrupo]`, que es el
  reparto de **la comida entera**. Con 70 g de aguacate en una comida donde se
  pautó 1 grasa, el cambio lo contaba como **una** porción y devolvía 35 g de
  guacamole donde tenían que ser 70 — los dos pesan 35 g por porción, así que
  el cambio es 1:1. Y al revés: en una comida con aguacate **y** aceite, al
  cambiar el aguacate se le cargaban las grasas de los dos y se inflaba. Ahora
  se cuenta lo que hay en el plato: sus gramos entre los que pesa una porción
  de su alimento (`cantidad_final / gramosPorIntercambio`). Lo pautado sólo
  manda cuando no hay alimento del catálogo detrás, que es lo único que se sabe
  — y ahí no sale botón de cambiar. `applySubstitutions` arrastra el criterio
  viejo pero **no lo llama nadie**.
- **«Lo que pesa cocido» y «lo que hay que comprar» son dos campos.**
  `Alimento.gramos` manda: es la medida en que está escrito todo lo demás y en
  la que sale la receta escalada. Lo que cambia es si esos gramos son de olla o
  de plato, y eso lo dice cuál de los dos campos lleva: `equivalencia_cocido`
  en los alimentos escritos **en crudo** (arroz blanco crudo, 18 g → 50 g
  cocidos) y `equivalencia_cruda` en los escritos **en cocido** (arroz blanco
  cocido, 50 g → 18 g a comprar). Estaban en uno solo y la lista de la compra
  dividía por él, así que **150 g de arroz cocido salían como 150 g a comprar**
  —no había equivalencia que leer— y, peor, rellenar la casilla en un alimento
  escrito en crudo le habría quitado dos tercios a lo que sí estaba bien.
  La conversión vive en **un solo sitio** (`gramosEnCrudo` en `types/food.ts`,
  antes copiada tres veces) y la usan la lista de la compra de fase 1/3, la de
  fase 2 y el batch cooking. **El arroz crece y la carne encoge**: el factor va
  hacia abajo en lo que absorbe agua —150 g de arroz cocido se compran con 54—
  y hacia **arriba** en lo que la suelta —120 g de pollo en el plato se compran
  con 144—. La primera versión sólo dejaba pasar los factores menores que 1 y
  se comía justo el caso de la carne, que es donde más se pierde; ahora se
  descarta lo que esté fuera de 0,2–4, que eso es un dedazo.
  **Ninguno de los 263 alimentos tenía el campo relleno**: el catálogo lo
  resolvía con dos entradas separadas, crudo y cocido, que no se conocían entre
  sí. Ya están los **19 pares** —arroz blanco, integral y basmati, quinoa,
  cuscús, pasta, pasta integral, frekkeh, lentejas, alubias blancas y rojas,
  garbanzos, y también pollo, contramuslo, pavo, ternera, lomo, merluza y
  salmón—, en los dos sentidos y **sin inventar ninguno**: el par ya estaba en
  el catálogo. **Los de microondas se quedan fuera** (vienen cocidos de fábrica
  y lo que se compra es el paquete; además están en `TAL_CUAL`, que no se
  cocina en tanda) y también el boniato, la castaña, el maíz en mazorca y los
  mejillones, que **no tienen pareja cruda**: ahí no hay nada que deducir y
  `seSabeEnCrudo` lo dice en vez de inventarlo.
  Y a la clienta se le dicen **los dos números** (`losDosGramajes`): «54 g en
  crudo · 150 g ya cocido», porque quien pone la olla pesa antes y quien se
  sirve del táper pesa después, y del 18 al 50 no hay cuenta que se haga a ojo.
  Lo dicen igual la receta de fase 1 y las combinaciones de fase 2
  (`ItemOpcion.dosGramajes`): estaba escrito a mano en cuatro sitios como
  `equivalencia_cocido × porciones`, que se salta la división entre los
  intercambios del alimento y con un yogur de 1,4 salía mal. **Sin gramos no
  se dice nada**, o un ingrediente «al gusto» leía «(0 g en crudo · 0 g ya
  cocido)». La unidad del ingrediente **ya no se escribe como «g crudo»**: con
  los dos gramajes al lado salía «60 g crudo (60 g en crudo · 167 g ya
  cocido)».
  **Y la lista de la compra dice cuándo esos gramos son de olla**
  (`LineaCompra.enCrudo`): sin eso la línea pone «Arroz blanco cocido · 60 g» y
  esos 60 g son de arroz seco — el nombre dice una cosa y el número otra. Ahí
  tampoco se cuenta por piezas, que la pieza sale de `food.gramos` y en un
  alimento escrito en cocido ésos son los del plato.
- **Los gramos a mano ganan al cálculo, y son de esa clienta.** Al pautar, el
  botón «Ajustar cantidades» abre la receta con lo que propone la app y deja
  cambiar cada gramaje, con lo pautado delante. Se guardan en
  `DayType.ajustesReceta` (comida → receta → ingrediente → gramos), **no** en
  la receta del banco: la misma receta se cuadra distinto según a quién se le
  pauta. `scaleRecipe` los respeta y marca el ingrediente como `ajustado`, y
  **lo que la receta cubre se recalcula con esos gramos**: en el grupo que ella
  toca, `cubiertos` sale de los gramos del plato (final/base) y no del factor
  del cálculo. Sin eso, poner 150 g de salmón donde el cálculo había dejado 90
  cambiaba la lista de ingredientes pero la pantalla seguía diciendo «falta
  proteína, 11 g». Sólo en ese grupo: el redondeo a piezas enteras también
  separa gramos de factor, pero ahí la diferencia es de medio huevo y darla por
  buena movería los intercambios de todas las recetas.
- **Y un ingrediente se le puede quitar a una clienta sin tocar el banco.**
  «Me cuadra todo menos el pimentón»: la receta es la misma para las treinta y
  el plato de ésta no. La × de cada ingrediente en «Ajustar cantidades» lo
  guarda en `DayType.ingredientesQuitados` (comida → receta → ingredientes),
  mismo sitio y misma forma que los gramos a mano, porque es la misma clase de
  cosa. **Se quita, no se pone a cero**: un ingrediente con «0 g» sigue
  saliendo en la lista, en el PDF y en la hoja de la nevera, y leer «pimentón:
  0 g» es peor que no leer nada. **Se puede quitar cualquiera, también el
  salmón** —quien pauta sabe lo que hace— pero entonces **lo que el plato cubre
  se recalcula sin él** y el grupo que se queda en nada pasa a «falta
  proteína»: callarlo sería enviar un plan que no cuadra, y lo que hay que
  hacer es ponerle algo al lado. Lo que **no** pasa es que el resto crezca para
  compensar: quitar el pimentón no engorda el arroz. **Lo quitado sigue a la
  vista con un botón para devolverlo**, que un cambio que no se deshace da
  miedo de hacer — y al repasar el plan hay que poder acordarse de por qué esa
  receta cubre menos de lo que dice el banco. Al quitarlo se le quita también
  su gramaje a mano: si vuelve, vuelve con lo que calcula la app.
  **Y la otra mitad: se le mete otra cosa** (`DayType.ingredientesAnadidos`,
  `IngredienteAnadido`). Quitar el pimentón y poner zanahoria es un solo gesto,
  y la zanahoria va **dentro de la receta y no bajo «Además»**: se pica y se
  cocina con lo demás. Un acompañamiento es el yogur que se come después; esto
  es el sofrito. Por eso el buscador está pegado a la lista de ingredientes y
  no dentro de «Acompañamientos», aunque por dentro se parezcan. Entra con una
  porción —que es la medida con la que se piensa—, **no escala** (son los
  gramos que ella escribió) y cuenta en lo que el plato cubre, así que puede
  tapar el hueco que dejó lo quitado. **La preparación no se reescribe sola**:
  el texto de la receta sigue siendo el del banco y lo retoca ella.
  Los cuatro retoques se guardan juntos (`guardarRetoques` en `ClientDetail`):
  estaban escritos dos veces —la ficha y la tarjeta del reto— y la del reto se
  había quedado a medias, perdiendo en silencio lo quitado y lo añadido.
  **Y la compra y el batch cooking leen lo mismo**: hasta ahora escalaban la
  receta del banco, así que ignoraban los gramos a mano y los acompañamientos —
  se compraba lo que no se iba a comer y faltaba lo que sí.
- **Los acompañamientos tapan huecos sin tocar la receta.** A una arepa con
  huevo no se le echa más huevo: se le pone un yogur al lado. Se añaden desde
  «Ajustar cantidades», con tipo (acompañamiento, postre, café, suplemento),
  y viven en `DayType.acompanamientos` igual que los gramos ajustados.
  `scaleRecipe` los mete como un ingrediente más con sus gramos fijos, así que
  cuentan en los macros y en la completitud sin que ninguna pantalla se entere
  por su cuenta. La clienta los ve bajo «Además», aparte de los ingredientes.
- **Un acompañamiento es una receta, pero no es un plato.** La ensalada de
  tomate o el puré van al lado del salmón, no en su lugar: `Receta.acompanamiento`
  los saca de las carpetas del banco —tienen la suya, con foto pequeña, que es
  como se eligen— y del recomendador (`matchRecipes` los filtra), así que no se
  le pueden asignar a una clienta como una de sus opciones de cena. Se ponen al
  lado de un plato desde «Ajustar cantidades», con foto pequeña: entran con los
  gramos con los que están escritos —una guarnición no se escala, es la de
  siempre— y sus ingredientes pasan a `DayType.acompanamientos`, así que
  cuentan sin que ninguna pantalla se entere por su cuenta. **Sólo cuenta lo
  enlazado al catálogo**, y los que no lo están se avisan con un `!`: la
  verdura, una gelatina o la bebida de almendras entran igual y suman cero,
  que es lo que se espera de ellos. En la ficha de la clienta se ve **como una
  receta**: nombre y foto pequeña, y al pulsarlo salen sus ingredientes con sus
  gramos y su preparación (`Acompanamiento.deReceta` es lo que mantiene el
  vínculo). Deshecho en alimentos sueltos no se entendía que aquello había que
  cocinarlo.
- **La semana se la puede repartir ella, y sigue siendo una propuesta.** A mucha
  gente le da pereza organizarse la semana, y sin eso no hay compra ni batch
  cooking. `Plan.menuPropuesto` son **una o dos semanas que se alternan** (día de
  la semana → comida → receta, más el tipo de día), y se reparte desde la ficha
  marcando los días de cada plato — por receta, no por día, que es como se
  piensa. **Una receta por día y comida**: si no, un día acaba con tres
  desayunos y deja de ser un reparto. Lo que quede vacío lo elige ella ese día.
  **No se copia a su registro**: se solapa al vuelo (`menuEfectivo`), la
  propuesta debajo y lo suyo encima, **comida a comida** — cambiar la cena del
  martes no tira por tierra el resto. Copiándolo, un cambio de la nutricionista
  no le llegaría nunca. Quitar un plato se escribe **en blanco** (`''`), que es
  lo que impide que la propuesta reasome por debajo; `menuDelDia` los filtra. La
  lista de la compra y el batch cooking leen el **menú efectivo**, así que dicen
  siempre lo mismo que ella está viendo.
- **En fase 2 se cuentan veces, no días.** Ahí no se comen platos sino
  combinaciones que la clienta elige cada mañana, así que repartirlas por días
  le quitaría justo la libertad que esa fase existe para darle — y como
  «Organiza tu semana» repartía *recetas*, en fase 2 no había lista de la compra
  en absoluto. Ahora dice **cuántas veces come cada opción**
  (`MenuSemana.veces`: comida → opción → veces) y la compra es una
  multiplicación (`listaDesdeVeces`), pasando por el mismo redondeo y las mismas
  secciones que la de fase 1. Son tres o cuatro números por comida en vez de
  siete casillas por opción, y es como se piensa al comprar. **Se cuenta por
  macro**, no por comida: las columnas son independientes y cada una llega a
  siete por su cuenta. **No es un menú**: la app nunca dice «hoy te tocan
  huevos», y dejar días sin decidir se dice sin reñir —improvisar es una
  decisión—. **Una sola forma de organizar por fase**: fase 1 por días, fase 2
  por veces; dos que dieran dos listas distintas sería el lío de las dos
  tarjetas de pagos. En fase 2 no hay pestaña de cocina: no hay recetas que
  cocinar en tanda y sin días no se puede decir «cocina el domingo».
- **El menú de la semana es lo que hace posible la lista de la compra.** En
  fases 1 y 2 la clienta elige cada día entre sus recetas, así que nadie sabe
  qué va a comer el jueves hasta el jueves: sin eso no hay compra ni batch
  cooking. `MenuSemana` (día → comida → receta, más el tipo de día de cada
  fecha) vive en `RegistroDia.menuSemana` **del lunes** de esa semana, como las
  comidas guardadas. Se organiza **por receta, no por día** —«pan con huevo,
  lunes y miércoles»—, que es como se piensa y son siete pantallas menos. Decir
  qué días entrena hace que **las cantidades se ajusten solas**: la misma
  receta escalada a otro `dayType`. **Es una propuesta, no un contrato**: si
  ese día le apetece otra cosa la cambia y no hay ningún aviso; un menú que
  riñe se convierte en una jaula y se deja de abrir. **Lo que organizó manda en
  el día**: la receta que puso ese día sale la primera y ya elegida, y el tipo
  de día también sale del menú —decir «entreno los lunes» una vez es media
  gracia de organizarla—. Si ese día cambia el tipo, **la receta se queda y sólo
  cambian las cantidades**. En la lista de la compra
  (`utils/listaCompra.ts`) se suma **por alimento del catálogo** —lo no
  enlazado va aparte y marcado, que no se puede sumar lo que no se sabe qué
  es—, se pasa **de cocido a crudo** con la equivalencia del alimento, se
  **redondea a lo que se vende** (piezas enteras, gramos a la decena) y la
  verdura se cuenta **por comidas, no por peso**. El **batch cooking**
  (`utils/batchCooking.ts`) lee lo mismo **por ingrediente y no por receta** —el
  arroz del wok del martes y el del bowl del jueves son una olla— y **en
  crudo**, que es lo que se pesa antes de cocinar. Sólo entra **lo que pide
  fuego** (`seCocinaEnTanda`): el arroz, el pollo o las verduras al horno sí; el
  huevo revuelto y el queso feta no, aunque sean del mismo subgrupo, porque no
  hay nada que adelantar. Lo decide el nombre y la equivalencia de cocido, y
  `Alimento.batch` lo fija a mano cuando la cocina de alguien va de otra
  manera. Sólo si sale dos veces o más:
  cocinar para una comida no es batch cooking, es cenar. Y va **partido en
  tandas de 3 días**, porque es lo que aguanta un táper: no se inventa una
  caducidad por alimento —depende de cómo lo guarde— pero decirle que cocine el
  domingo lo que se come el sábado sí sería mentirle. **En su pantalla se llama
  «Mealprep»**, no «Cocina de una vez»: es la palabra que ella y sus clientas ya
  usan, y la app no está para enseñarles otra. **La despensa no se
  descuenta a propósito**: si la app se equivoca en lo que cree que hay en
  casa, se queda sin cenar.
- **Las porciones son del plan; las calorías, de la comida.** Lo que una receta
  *cuesta* se cuenta en porciones, porque el plan se pauta en porciones. Las
  calorías no las decide el plan: son las de lo que se come, y se leen de los
  gramos y la etiqueta de cada ingrediente (`macrosDeIngredientes`). Sacándolas
  de las porciones, la tabla de intercambios se colaba en el número: el yogur
  griego light entra como lácteo proteico —0 g de grasa— y sus 2 g por cada 100
  desaparecían, así que el mismo froyo salía a 60 kcal en «¿Algo dulce?» y a
  104 en «Mis recetas» de fase 4, que cuenta por gramos. Si la receta no tiene
  ningún ingrediente enlazado al catálogo no hay gramos que leer y entonces sí
  se dicen las de las porciones: es lo único que se sabe.
- **Un postre es una idea, y lo paga quien ella diga.** `Receta.postre` los
  saca de las carpetas normales y del recomendador —como los acompañamientos— y
  los pone en «¿Algo dulce?», plegado y **fuera de las comidas**: el antojo no
  tiene hora. Se escriben una vez para toda la consulta y **los ven todas**:
  asignarlos una a una sería un paso más en cada entrega. Al elegir uno decide
  **contarlo en su plan** —gasta sus porciones (fases 2 y 3) o entra como
  bocado (fase 4)— **o apuntarlo como extra**, que suma encima sin recortar
  nada. Las dos son verdad: guardarse el hidrato de la cena para el postre es
  planificar, y comérselo después de haber cenado es un extra. **En fase 1 se
  cambia por una comida**: ahí no hay porciones que gastar, así que la única
  forma de que no se sume encima es dejarse otra cosa —hoy no meriendo, que he
  comido bizcocho—. Se apunta en `RegistroDia.cambiadasPorPostre` (comida →
  postre) y `balanceDelDia` deja de contar esa comida; **lo pautado no se
  toca**, que es lo que su cuerpo necesitaba, así que si el postre pesa
  parecido el día cuadra y si pesa más se pasa. Que es la verdad. **Se enseñan todos**,
  con los que le cuadran hoy delante (`utils/postres.ts`): esconder un postre
  porque «hoy no le toca» es la app dando lecciones, y a quien tiene mala
  relación con la comida eso le hace daño.
- **Hay alimentos que gastan dos intercambios.** Los productos que no caben en
  un grupo (mezcla de tortitas proteicas: 2 almidones Y 2 proteicos) llevan
  `Alimento.equivale`, y al marcarlos se descuenta de todos sus grupos a la
  vez. Para decidir si un alimento lo necesita: pasa cada macro de una medida
  real a porciones y **si el segundo no llega a media porción, se ignora**,
  igual que se ignoran los 2 g de proteína de cualquier almidón. El reparto se
  comprueba **por calorías**, no macro a macro: cada grupo arrastra sus macros
  de regalo, así que la proteína declarada siempre sale un poco alta.
  Casos ya resueltos: edamame → proteico semigraso (~60 g cocido por
  intercambio); queso crema light → grasas proteicas; yogur griego light →
  lácteo proteico + ½ grasa + 0,2 almidones. **Y lo gasta también dentro de una
  receta**: `composicionDesdeIngredientes` reparte por `equivale` igual que
  `aporteDeAlimento` cuando la clienta marca una porción. Antes la receta
  apuntaba todo al grupo principal y la grasa del yogur desaparecía de lo que
  costaba el plato.
- **La fibra alta se descuenta a medias.** Si una ración pasa de 5 g de fibra,
  se le resta la mitad al carbohidrato antes de calcular porción y calorías
  (`utils/portions.ts`). Por debajo no se toca nada, así que legumbres, avena y
  pan integral siguen donde estaban. Hace falta por los procesados keto: un
  cereal con 41 g de hidrato de los que 25 son fibra salía un 13 % pasado de
  calorías. En los grupos anclados al hidrato la porción se calcula **dos
  veces**, porque el descuento depende de la ración y la ración del hidrato.
- **En fase 3 manda el total del día, no la comida.** Arriba va el presupuesto
  del día en porciones por subgrupo (`PresupuestoDia`) y el desglose por
  comidas baja al final como «Completado». El reparto por comidas sigue
  existiendo y se explica que tiene una intención, pero deja de parecer la
  regla. En fases 1 y 2 el orden no cambia: ahí las comidas son el hilo. El
  esquema ya no se le enseña al cliente —repetía lo mismo tres veces—, pero
  sigue en el PDF y en la pantalla de la nutricionista.
- **El primer toque mete lo que falta de ese macro.** La comida se resuelve
  casi siempre con un alimento por macro —cuatro porciones de pollo, no cuatro
  alimentos—, así que pulsar cuatro veces era trabajo inventado, y se hace de
  pie en la cocina con una mano (`utils/rellenoRapido.ts`). Los toques
  siguientes suman de uno en uno, que es cuando ella afina. **No se le quita
  nada a nadie**: si después añade un yogur, el pollo se queda como está y el
  día se pasa. Pasarse un poco es información honesta; bajarle el pollo sería
  la app corrigiendo lo que ya se comió.
- **El aceite de cocinar no se escoge, así que no se pide.** `PresupuestoDia`
  descuenta `reservaAceiteDelDia` de las grasas: si no, el cliente llenaba
  todas sus comidas y el día seguía pidiéndole grasas que no había forma de
  marcar, porque eran las del aceite.
- **Un avituallamiento no es una comida: es un ritmo.** Lo que se come encima
  de la bici no se elige como un plato. `DayType.avituallamientos` (mealId →
  cómo se pauta) convierte esa toma en un objetivo en **gramos de hidrato**, y
  la clienta suma fuentes de la despensa hasta llegar — geles, isotónica,
  dátiles, plátano— en **unidades reales**: un gel son 25 g, un dátil 15, un
  bidón 30. Partirlo en bloques de 20 obligaría a inventar «1,25 geles». **Dos
  modos, y no son intercambiables**: *total* para quien sale hora y media,
  *por hora × duración* en cuanto se alarga —60 g para dos horas y media no es
  el avituallamiento, son los primeros cuarenta y cinco minutos—. Es la
  diferencia entre una amateur y alguien que compite, así que se elige persona
  a persona. Los umbrales se **dicen, no bloquean**: hasta 60 g/h una fuente
  basta, por encima hay que mezclar glucosa y fructosa (transportadores
  distintos), y por encima de 90 hace falta intestino entrenado.
  `Alimento.conFructosa` marca los geles y bebidas que mezclan, y el
  recordatorio salta sólo si a ese ritmo eligió únicamente glucosa. **Cuenta en
  el día**: al pautarlo se escriben sus porciones de azúcares en el reparto de
  esa comida (`repartoDelAvituallamiento`), porque 150 g de hidrato son 150 g
  se coman donde se coman; después se puede retocar el reparto a mano y no se
  vuelve a pisar. Se enseña **lo que lleva, no lo que le queda**, y pasarse se
  dice sin bloquear, con el margen del 10 % de siempre.
  **Y el reloj es opcional, que es lo que separa la bici de correr**
  (`Avituallamiento.pauta`: minuto + alimento + unidades). En bici se elige
  sobre la marcha —lo que apetece, lo que se lleva en el maillot— y ahí basta
  con el objetivo en gramos. Corriendo no funciona: quien no lleva pautado el
  **cuándo** o se toma los tres geles en la última media hora o no se toma
  ninguno. Sin pauta, todo sigue como estaba; con pauta, la clienta ve qué y
  cuándo. Es la misma regla de las combinaciones de fase 2: lo que se pauta
  manda, y lo que no se pauta lo elige quien come — así una sola pantalla sirve
  para los dos deportes. **Se propone y se retoca** (`proponerPauta`): los
  gramos y la duración ya están escritos, así que repartir es una división —el
  paso que ella hacía con calculadora—. Las tomas caen en `duración / (n+1)`,
  redondeadas a cinco minutos, así que **la primera cae pronto** —90 min con
  cuatro geles: a los 20— y **la última no queda pegada al final**, que llegar
  con un gel a meta no sirve de nada. **Lo hecho no se guarda aparte**
  (`tomasHechas`): se leen las porciones marcadas de siempre y las tomas de ese
  producto se dan por hechas **en orden**, porque dos geles iguales son dos
  geles iguales y en gramos da igual cuál se tomó — guardar cuál obligaría a
  inventar un sitio nuevo y a que dos pantallas dijeran lo mismo con dos
  números. **Y se puede cambiar**: si ese día se le acabaron los geles y tiró de
  dátiles, la pauta no se tacha —no se tomó eso— pero los gramos cuentan igual.
  **Los productos de avituallamiento se marcan, no son un grupo**
  (`Alimento.avituallamiento`). Un grupo de intercambio nuevo —«geles»,
  «suplementación»— tendría que traer su porción, su equivalencia y **una
  columna en el reparto que estaría vacía todos los días menos el de la tirada
  larga**: un gel sigue siendo azúcar, lo que cambia es dónde se come. Con la
  marca puesta pasan tres cosas. **La despensa de una comida de avituallamiento
  ofrece éstos y sólo éstos** (`esAvituallamiento` en `alimentosDeComida`
  sustituye la comida sugerida por la marca), y en el editor se ven como una
  lista corta de botones con los gramos de hidrato de una unidad, no como tres
  columnas de macros: encima de la bici no se elige proteína. **La isotónica
  entra**: no tenía subgrupo, así que era un alimento «libre» y no se podía ni
  meter en la despensa — ahora es azúcares y su medida es el bidón de 500 ml,
  30 g de hidrato, que es como se sale a rodar. Y **la lista de la compra los
  cuenta en unidades** (`LineaCompra.medida`): «6 × gel», «2 × bidón (500 ml)»
  es lo que se mete en la mochila; «1000 ml de isotónica» no lo compra nadie.
  El avituallamiento no llevaba receta, así que **no entraba en la lista en
  absoluto**: ahora se lee la pauta del reloj, día a día del menú. **Sin reloj
  no se inventa qué compra** —en bici elige ella sobre la marcha— y lo que entra
  es un recordatorio con los gramos pautados. En fase 2 no hay días, así que
  tampoco hay avituallamiento que contar.
  **Lo que NO se hizo: un módulo de entrenamientos.** El «día de tirada larga»
  ya es un tipo de día, elegir qué día toca ya se hace al organizar la semana, y
  el pre y el post-entreno ya son comidas con su reparto y su despensa. Copiar
  eso sería tener cuatro sitios diciendo lo mismo.
- **En fase 2 lo que se exporta es una hoja para la nevera, no un informe.**
  El PDF era el mismo tablero de la pantalla en blanco y negro: un documento de
  trabajo que no necesitaba nadie —esos datos la nutricionista los tiene en la
  ficha—. `HojaNeveraPDF` **lo sustituye**, no se añade al lado: dos botones que
  dan dos PDF parecidos es el lío de las dos tarjetas de pagos otra vez. Un
  bloque por comida con las tres columnas y las opciones **numeradas** —en la
  cocina se señala con el dedo y en consulta se dice «tira de la 2»—, las
  **recetas que encajan** con su nombre y su foto pequeña, y la marca: el brote
  en la cabecera, muy pálido de fondo y su nombre en el pie. **Tres opciones por
  columna** (`TOPE_DE_OPCIONES`), no las cinco de la pantalla: en papel cada una
  puede ocupar tres líneas y el día se iba a dos folios — y una hoja de nevera
  que ocupa dos folios ya no se cuelga. La lista entera sigue en la app. **Ni
  kcal ni porciones ni la palabra «fase»**: las cantidades ya vienen hechas, un
  número al lado invita a sumar cuando no hay nada que sumar, y «fase 2» es
  vocabulario de la consulta. Una comida **nunca se parte entre dos hojas**
  (`break-inside-avoid`): media comida en la página de detrás, colgada en la
  nevera, no se ve. El logo va **incrustado como PNG transparente**
  (`components/brand/brote.ts`, 18 kB) y no como archivo: el original es un JPG
  de dos megas con fondo blanco —que en papel se ve como un recuadro— y así
  sigue estando en la versión de un solo HTML. Y el CSS de impresión lleva
  `print-color-adjust: exact`, porque por defecto el navegador tira los fondos
  al imprimir y toda la marca se perdía. La fase 3 se queda con `PlanPDF` y su
  esquema de porciones: ahí el cliente sí cuenta intercambios.
- **Hay alimentos que no caben en ningún grupo, y eso es una respuesta.** La
  bebida de almendras, la de coco, el zumo de limón, el café, una infusión: no
  aportan nada que pautar. Un `Alimento` sin `grupo` ya era «libre» por dentro,
  pero **no había forma de guardarlo así**: el desplegable en blanco no valía
  porque `sugerirSubgrupo` volvía a rellenarlo por los nutrientes —una bebida
  de soja sale lácteo—, así que tocaba inventarle un subgrupo con el que no
  cuadra o dejarlo fuera del plan. Ahora hay una opción **«Libre · sin
  subgrupo»** que gana a la sugerencia: el formulario distingue «aún no lo he
  mirado» (`''`, manda la sugerencia) de «no lleva ninguno» (`LIBRE`).
  **Y entran en la despensa** (`ofrecible`, `libresDeComida` en `pantry.ts`):
  el filtro era «tiene porción de intercambio», que es lo mismo que «tiene
  grupo», así que un libre no se podía ni ofrecer. Entran **sin gastar nada** y
  **fuera de las tres columnas**: no tienen porción que marcar, así que meterlos
  en una columna sería mentir sobre lo que cubren. En el editor van en su propia
  fila y en la comida de la clienta salen como una línea, «Libres, al gusto:
  bebida de almendras, café». `alimentosDeBucket` sigue pidiendo `grupo`, así
  que **no se cuelan en las combinaciones de fase 2, ni en las columnas de fase
  3, ni en el cambio de alimento**. Sus calorías cuentan donde se cuentan
  calorías —fase 4 y los gramos de una receta—, que es lo honesto: no quitan
  porciones pero tampoco son cero.
  **La verdura no va por aquí**: es libre igual, pero tiene su regla de medio
  plato escrita en el esquema y repetirla en cada despensa sería ruido.
- **El mismo alimento no se enseña dos veces, y se quita en el buscador.** A la
  clienta se le juntan tres orígenes —el catálogo, lo que se calculó con la
  etiqueta (`alimentosPropios`) y lo que cocina (`recetasPropias`)— y cada uno
  pone su prefijo de id (`f_`, `mio_`, `rp_`), así que la única deduplicación
  que había —**por id**— no quitaba nada nunca. El mismo yogur salía dos veces.
  Pasa por dos caminos y los dos son normales: **al aceptar un alimento de una
  clienta** nace una copia en el catálogo con id nuevo y el de la clienta
  **sigue vivo** —no se puede borrar, el registro del día es suyo y sólo lo
  escribe ella—; y **calcular la misma etiqueta dos días distintos** creaba otro
  con id nuevo sin que nadie tocara nada.
  Se quitan **por nombre** (sin tildes ni mayúsculas, `utils/sinRepetidos.ts`) y
  **en el `FoodPicker`, no en la lista de alimentos**. Esto es lo importante:
  esa lista es también con la que se leen los días viejos, y un alimento que
  desaparece de ella se lleva por delante lo que la clienta marcó con él hace un
  mes. En el buscador sólo se elige lo que se come hoy, así que esconder el
  repetido no puede romper nada. **Manda el del catálogo**, que va primero en la
  lista: está revisado —alérgenos, medida casera, equivalencia de cocido— y el
  de la clienta se escribió deprisa con una etiqueta delante.
  **Y la calculadora reutiliza el suyo** (`suyoConEseNombre`): si ya tenía uno
  con ese nombre se conserva su id y se reescriben los macros, para que lo
  marcado con él siga en pie. **Nunca reutiliza uno del catálogo**: los macros
  que acaba de copiar son los de SU bote. En el alta del catálogo se avisa si ya
  hay uno que se llama así, pero **no se bloquea**: dos yogures griegos de dos
  marcas son dos alimentos.
- **Lo que se pesa va en gramos; el ml es de lo que se sirve en un vaso.**
  `Alimento.unidad` venía del Excel y unos cuantos sólidos estaban marcados en
  ml —el chocolate, el aguacate, la crema de cacahuete, el queso batido—, así
  que en el plan de la clienta ponía «11 ml de chocolate». **Y no había forma
  de arreglarlo**: el formulario del catálogo no tenía esa casilla y, aunque la
  hubiera tenido, `guardar` no escribía `unidad`, así que lo que nacía en ml se
  quedaba en ml para siempre. Ahora se elige al lado de los gramos de la
  porción y se guarda. Los cinco sólidos están corregidos; **las bebidas siguen
  en ml**, que ahí sí es la medida.
- **Una foto que falla se dice; lo que no se puede abrir no se guarda.** «No
  me deja subir las fotos» no era que no dejara: era que **cuando fallaba no
  decía nada**. Ni la preparación del reto ni «Mis medidas» tenían `catch`, así
  que el «Subiendo…» se apagaba y ahí acababa todo — desde el móvil parece que
  el botón no hace nada. Se sumaban tres cosas y ninguna se veía. **El tope de
  peso estaba en 12 MB** y una foto de móvil de hoy se pasa: ahora son 30, que
  lo que importa es lo que se guarda —900 px— y no de qué archivo se parte.
  **La preparación encogía con `createImageBitmap`**, que no abre el HEIC del
  iPhone ni existe en Safari viejo: ahora usa `prepararFoto`, la misma que todo
  lo demás, que va por `FileReader` + `<img>` y aguanta mucho más. Y **lo que
  el navegador no sabe abrir ya no se guarda tal cual**: eran cuatro megas
  metidos en los datos —que viajan en cada guardado— y una foto que además no
  se ve, porque Chrome no pinta HEIC; ahora se dice que no entró y qué hacer
  («hazle una captura y sube la captura»). El original se sigue guardando
  cuando el navegador **sí** pudo abrirlo y lo único que falló fue el
  recomprimido: ahí la foto es buena.
- **Verduras ilimitadas.** No gastan intercambios ni escalan. En las recetas
  ponen «al gusto» y ya: el mínimo de medio plato vive en el esquema, no
  repetido en cada línea de cada plato.
- **Cambiar de tipo de día con cosas marcadas pregunta.** Lo marcado no se
  borraba al cambiar, así que quien marcaba en «descanso» y se pasaba a «base»
  se lo encontraba hecho, y al volver a marcar porciones se le sumaban a las de
  antes (`marcarAlimento` acumula). Ahora se ofrece empezar de cero o
  conservarlo: las dos respuestas son legítimas.
- **Comer fuera no se mide.** El cliente marca la comida como **libre** y ya:
  sin gramos, sin kcal, sin puntuarse. Poner un número a una hamburguesa que no
  has cocinado tú no informa de nada, sólo da sensación de control, y a quien
  tiene mala relación con la comida eso le hace daño. Lo que sirve es la
  frecuencia (`contarLibres`) y la nota que quiera escribir, que es el material
  de consulta. Va en las tres fases. Los botones («Marcar hecha», «Libre») van
  en la cabecera de la comida, junto a su nombre: sueltos al final del bloque
  no se sabía si eran de la comida de arriba o de la de abajo. Por eso
  `ComidaLibre` acepta `sinBoton` y se abre desde fuera, y el de extras lleva
  el nombre de la comida escrito.
- **«Comí otra cosa» no es comer fuera, y no puede sumarse encima.** Era la
  queja que más se repetía en fase 1, y eran tres: «no comí tus recetas pero
  comí sano — no quiero marcarlo libre», «comí menos de lo que me pusiste» y
  «no merendé, pero comí otra cosa». Las tres acababan igual de mal: o se
  marcaba hecha una comida que no se hizo, o se apuntaba como **extra** — y
  entonces un día en que comió MENOS salía pasado de calorías, porque el extra
  se sumaba encima de una merienda que nunca se comió.
  `RegistroDia.sustituidas` (mealId → nota) marca esa comida y lo que de verdad
  comió va en **`bocados` con ese `momento`**, el mismo sitio de la fase 4: una
  sola forma de decir «esto me he comido» en toda la app, y por eso
  `AnadirBocado` se sacó de `ContadorDia` a su propio archivo. **Sustituye, no
  suma**: `balanceDelDia` saca esa comida de `delPlanEntero` —igual que ya hacía
  con `cambiadasPorPostre`— y añade lo apuntado; lo **pautado no se toca**, que
  es lo que su cuerpo necesitaba, así que comer menos deja el día corto y comer
  más lo pasa. Que es la verdad. Y **no cuenta como desvío**: no entra en
  `pesoExtras`, porque no se ha pasado, ha comido otra cosa.
  **Sin bocados significa «no comí nada»**, que es una respuesta y no un hueco
  a rellenar: hasta ahora una comida sin marcar era lo mismo que una que se
  olvidó de apuntar. Cierra el día (`diaCerrado`) como lo cierra una libre.
  **Ahí hubo un fallo a punto de colarse**: `diaCerrado` daba el día por cerrado
  con un solo bocado —el atajo de la fase 4— así que en fase 1 apuntar la
  merienda regalaba la racha con la cena sin contestar; ahora sólo cuentan los
  bocados **sueltos**, los que no pertenecen a una comida sustituida, y en fase
  4 no hay ninguna sustituida, así que ahí se comporta igual que siempre.
  **Se llama «Otra cosa» y va al lado de «Libre», con su misma forma.** Empezó
  siendo un enlace pequeño debajo de la comida, pensando que lo discreto
  evitaría que se usara de más. No se usaba de más: **no se encontraba**. Son
  los dos la misma cosa —la excepción del día— así que son el mismo botón con
  dos colores y en la misma fila. En primera persona («Comí otra cosa») sonaba
  a confesión y no cabía en la fila: es un botón, no una declaración. El panel
  (`ComiOtraCosa`) **no pinta nada cuando está cerrado**: tenía su propio
  enlace y salían los dos, uno debajo del otro. **Y hay que ponerlo en los dos
  sitios**: `accionesDe` sirve a las fases 2, 3 y 4, pero la tarjeta de fase 1
  (`MealCard`) pinta sus propios botones y no pasa por ahí — se quedó sin él en
  la fase donde más falta hace, la de las recetas cerradas. Ahora `MealCard`
  tiene `onOtra` al lado de `onLibre`.
  Deshacerlo **borra lo apuntado ahí**: si vuelve a la receta pautada, lo de
  antes ya no es lo que comió. La nutricionista lo ve en «Hoy» con nombres y
  gramos, en azul y aparte de las libres, que es justo lo que se perdía cuando
  esto se apuntaba como extra.
- **Comer fuera también en fase 4.** El botón «Libre» sólo se pintaba en las
  fases 1, 2 y 3 porque el contador (`ContadorDia`) se dibuja por otro camino.
  Y es donde más falta hace: a una hamburguesa no se le ponen gramos. A la
  comida marcada se le quita el «+ Añadir» —pedir gramos de lo que no se cuenta
  es lo contrario de la comida libre— y arriba se dice «una comida fuera, que
  no se cuenta», que si no el total del día parece que se queda corto de
  comida. Ni el conteo ni la racha se tocaron: el conteo nunca miró las libres.
- **La lista de clientas se busca, no se lee.** Buscador por nombre y correo
  (sin tildes), filtro por estado de acceso y —el que más falta hacía— «sin
  enviar» (`utils/filtrarClientas.ts`). **No se ordena por peso a propósito**:
  eso es un ranking de cuerpos, lo mismo que se rechazó en el reto. La barra
  sale a partir de cinco clientas; con cuatro es ruido.
- **El informe de antropometría es para dársela a ella.** Hoja A4 desde la
  pestaña de antropometría (`components/export/AnthroReportPDF.tsx`), de la
  medición abierta y no siempre de la última. **No lleva lo que faltó por
  medir** —eso le sirve a la nutricionista en pantalla; en una hoja que se
  entrega sólo dice que el trabajo está a medias—, **ni juicios** más allá de
  las categorías clínicas que ya se calculan, **ni filas vacías**. La
  bioimpedancia va en su bloque con el aviso de que no se mezcla, como en
  pantalla.
- **La calculadora es para lo envasado, no para comer fuera.** En fase 3, la
  clienta copia la etiqueta y los gramos y ve a cuántas porciones equivale. El
  alimento que sale vive en `RegistroDia.alimentosPropios` y se pasa junto al
  catálogo a todo lo que cuenta porciones, así que funciona sin tocar ninguna
  cuenta. Se apunta con `equivale`, por eso cuenta en los tres macros a la vez.
- **El extra se apunta, no se corrige.** El cliente añade lo que se ha comido
  de más en la comida en la que se lo comió (`Extra.momento` = id de la
  comida). No recorta nada del plan: suma a las calorías del día y el pie dice
  si el desvío importa. El margen está en `utils/diary.ts`: hasta 10 % el día
  sigue en línea, hasta 25 % es moderado, por encima se dice y se pasa página.
  **Pero en fase 3 lo mismo apuntado puede ser su comida** (`Extra.enElPlan`).
  Hay quien el fin de semana no come por comidas: pica, come con amigas, hace
  dos tomas y ninguna es lo pautado. Apuntándolo como extra de siempre, los
  anillos no se movían: veía «0 de 7 proteicos» habiendo comido pollo, que es
  justo lo que quería saber. Ahora al apuntarlo elige —**«cuéntamelo en el
  plan»** o **«fue de más»**, y se puede cambiar después pulsando la etiqueta
  de la línea—, igual que ya se hacía con los postres, porque las dos son
  verdad y sólo lo sabe quien se lo ha comido. Lo que cuenta **gasta sus
  porciones** (`porcionesSueltas` pasa gramos a porciones por
  `gramosPorIntercambio` y reparte los compuestos con `aporteDeAlimento`) y
  **deja de ser un desvío**: entra en `delPlan` y no en `pesoExtras`, que si no
  un fin de semana entero apuntado salía como un 80 % de desviación cuando lo
  que ha hecho es comer. Va **al total del día y no a ninguna comida**
  (tercer argumento de `presupuestoDelDia`): en fase 3 el total es lo que
  manda, y cuadrar los anillos de cada comida sería inventarse a cuál pertenece
  cada cosa un día en el que no se come por comidas. Se **dice en pantalla**
  —«aquí dentro van 3 cosas que apuntaste fuera de las comidas»— porque si no
  la cuenta de arriba se mueve sola y parece un fallo. **Sólo con alimento del
  catálogo y sus gramos**: unas calorías escritas a ojo no dicen de qué grupo
  son, así que ahí no se ofrece la elección. Y **sólo en fase 3**: en la 1 no se
  marca nada, en la 2 se elige la comida entera y en la 4 todo son bocados.
- **El cliente no personaliza la receta.** Había un panel para quitar
  ingredientes, sustituirlos y tapar huecos: demasiadas cosas a la vez en el
  momento de comer. Se retiró. Cambiar un ingrediente por su equivalente sigue
  estando, pulsando sobre el propio ingrediente de la lista.
  **Y ahí es donde se cambia la proteína** (`IngredientSwap`): el plato ya está
  escrito, así que cambiar el pollo por merluza no lo deshace — a diferencia de
  la fase 2, donde abrir la proteína al catálogo le quitaba a la nutricionista
  la decisión de qué cena.
  **Cuántas porciones es un ingrediente sale del plato, no del reparto.** Se
  leía de `requeridos[su subgrupo]`, y eso dejaba sin botón a **todo lo que
  cubre un macro con otro subgrupo** —que es la regla de siempre: pautas
  proteicos magros y la receta lo trae con salmón, que es graso—. Ahí
  `requeridos['proteicos_grasos']` no existe, salía 0 y no había nada que
  cambiar: por eso a unas recetas les salía el botón en la proteína y a otras
  no. Cuando el subgrupo **sí** está pautado se sigue leyendo de ahí —es lo que
  ya funcionaba y no se toca—; si no, se cuenta lo que hay en el plato: sus
  gramos entre los que hacen una porción de su alimento. Sin alimento del
  catálogo detrás no hay porción que calcular, y ahí no sale botón.
- **El perfil de la clienta tiene cinco pestañas: Reajustes, Compra, Plan,
  Resumen y Recetas.** Antes eran tres y se usaba una. El feedback de las
  clientas fue el mismo tres veces: en «Plan» había demasiado —organiza tu
  semana, la compra, los postres, la pausa, la encuesta, los extras— y las
  otras dos no se abrían, «Resumen» porque se miraba poco y «Recursos» porque
  casi siempre estaba vacía. Así que **lo que se hace una vez a la semana sale
  del día**: «Reajustes» es dejar puesto qué come cada día y qué días entrena,
  y «Compra» es el carrito y el cocinado de una vez. **«Plan» va en el centro**:
  en el móvil es donde cae el pulgar y es la que se pulsa diez veces por cada
  una de las otras. En «Resumen» van peso y % de grasa con su cambio, la
  racha, las comidas fuera del mes en círculos y **la encuesta semanal**, que
  pregunta por la semana que acaba y por eso no es del día. **No hay porcentaje
  de adherencia ni nota del día**: un número que resume «qué tal lo haces»
  invita a puntuarse y eso no enseña a comer mejor. En «Recetas» va todo lo que
  puede cocinar —la biblioteca, los postres (`AlgoDulce`) y sus propias recetas
  de fase 4— y **dentro, los recursos**: lo que la nutricionista escribe en
  `/recursos` (guía de raciones, productos) y ven todas sus clientas, que vive
  en `useAppStore.recursos` y en la columna `recursos` de `nutricionistas`. Se
  entra aquí cuando no se te ocurre qué hacer de comer, y lo que se lee («cómo
  cocino las legumbres») es de la misma familia que lo que se cocina. **La
  pausa se queda en «Plan»**: el impulso no tiene hora, y si hay que cambiar de
  pestaña para encontrarla, cuando se encuentre ya se ha comido.
- **«Cómo va tu día» no lleva contador.** Decía «0 de 3 comidas hechas» encima
  de las pastillas que ya dicen lo mismo con colores y con palabras («✓ hecha»,
  «libre», «otra cosa»), y en una pantalla que se mira de reojo dos formas de
  contar lo mismo es una de más. Cada pastilla sigue diciendo cómo está en su
  `title`, que es lo que lee un lector de pantalla. **Y tampoco en la tira de
  números de debajo**, que llevaba el mismo recuento con barra («0/3 comidas
  hechas») a dos centímetros del otro: esa tira es de kcal y macros, y contar
  comidas no es un número de esos.
- **«Exportar PDF» no va en la cabecera.** Estaba arriba, al lado de su nombre,
  compitiendo con lo primero que se mira — y es algo que se hace una vez, el
  día que llega el plan, para colgarlo en la nevera. Ahora es una tarjeta al
  final de «Recetas» («Tu plan en papel», o «Tus comidas en papel» en fase 2)
  que dice para qué sirve, porque un botón suelto no lo dice. Si esa pestaña no
  existe en su fase se queda al final del plan: fuera del paso, pero nunca
  inalcanzable.
- **El nombre del plato no se corta en «Reajustes».** Iba con `truncate` y al
  lado van siete botones de día: en un móvil lo que sobraba era el nombre,
  justo lo que hay que leer para decidir. Ahora se envuelve y en pantalla
  estrecha se lleva la línea entera, con los días debajo.
- **Una pestaña vacía enseña a no pulsarla.** Es lo que pasó con «Recursos»: se
  entró dos veces, no había nada, y se dejó de entrar — también cuando luego
  hubo algo. Así que cada pestaña aparece sólo donde tiene algo que enseñar
  (`hayPestana` en `ClientView`): «Reajustes» y «Compra» sólo en fases 1 y 2
  —en 3 y 4 elige alimentos sueltos y la lista de la compra sería un invento— y
  «Recetas» sólo si hay biblioteca, postres, recursos o es fase 4. Si la que
  tenía abierta deja de existir se cae a «Plan» (`laPestana`), que nunca falta.
- **«Organiza tu semana» es un componente y dos pestañas.** La lista de la
  compra y el cocinado SALEN del menú, así que duplicar el componente sería
  duplicar ese cálculo y acabarían dando listas distintas. La prop `solo`
  (`'menu' | 'compra'`) dice qué mitad enseña: sin ella sigue siendo la tarjeta
  plegable de siempre, que es como la ve la nutricionista al mirar el plan. En
  «Compra» la sub-pestaña de cocina sigue dentro, porque comprar y cocinar son
  el mismo momento —el de preparar— y el menú ya se eligió en «Reajustes».
- **Los recursos se abren de uno en uno.** Se escriben una vez para toda la
  consulta (`/recursos`) pero cada clienta ve sólo los de `Client.recursos`.
  Sin lista, ninguno: el error de dar de más no se puede deshacer, porque ya lo
  ha visto. Se marcan en la pestaña de entrega.
- **La pausa no se cuenta.** El botón de hambre emocional (`Client.pausa`, que
  ella enciende persona a persona) hace el árbol de decisión de su guía en dos o
  tres toques y lleva al ejercicio que toca; lo que escribe va a
  `RegistroDia.pausas` y **es el diario de emociones, escrito solo** — el
  ejercicio 5 pide rellenar una tabla el domingo y esa tabla no se rellena. Se
  llama **«Pausa» y no «he tenido un episodio»**: un botón que se llama así es
  una casilla de confesión y a las once de la noche no lo pulsa nadie. En su
  pantalla **no hay ningún número**: ni cuántas van, ni racha, ni si sube o baja
  —un contador de episodios es un marcador de fracasos, lo mismo que se rechazó
  con la adherencia y con el ranking de peso—; ve lo que escribió, porque
  releerlo ES el ejercicio. Los números y los patrones (qué emoción, a qué hora,
  qué le funcionó) van en la ficha. **Tampoco hay «resistí» ni «caí»**: a veces
  comer es la respuesta correcta. Las **señales** —perder el control, comer a
  escondidas, culpa alta, compensar— se preguntan en primera persona, son
  opcionales y **sólo las ve ella**: la app no diagnostica, se las enseña para
  que se hablen en consulta. Y sirve también **después de comer**, con otro
  tono: quien abre la app tarde no puede encontrarse una pantalla que le diga
  que llegó tarde.
- **La encuesta es semanal y es de todas.** Iba cada catorce días contados
  desde el inicio de un `Programa`, así que a una clienta de consulta normal
  —que son la mayoría— no le salía nunca; y preguntar qué tal va la semana no es
  cosa de los programas, es lo que ella pregunta igual por WhatsApp los lunes.
  Un check-in es de una **semana** (`CheckIn.semana`, el lunes en ISO) y no del
  día siete de cada una: contándolo desde que cada una empieza, las respuestas
  llegan repartidas por los siete días y revisarlas es perseguirlas de una en
  una. Se abre el **domingo** y pregunta por la semana que se cierra ese día —una
  semana a medias se contesta peor, que el miércoles no sabes aún si has pasado
  hambre— y sigue disponible hasta el domingo siguiente. **No se pregunta por
  una semana anterior al envío del plan**: qué tal comió antes de tenerlo no
  informa de nada. Los ya contestados con el formato viejo llevan `numero` en
  vez de `semana` y se siguen enseñando como «Quincena 1»: el día en que se
  escribieron no se puede reescribir desde hoy.
- **Que se mida ella es para las online, y se enciende a mano.** A las
  presenciales las mide la nutricionista con el plicómetro, y pedirles además
  que se pasen la cinta en casa es duplicar el trabajo con peor dato. A las
  online se les mandaba una planilla por correo, que se rellena una vez y se
  deja de rellenar. `Client.medidas` + `seMide(client, enUnReto)`: el
  interruptor manda y, sin tocarlo, se miden las de un reto —ahí no hay consulta
  donde medirlas— y nadie más. **Ser online no lo enciende solo**: se avisa en
  ámbar y decide ella, que hay a quien pedirle que se mida le hace daño. Los
  campos son **los de su planilla, con la referencia escrita en el nombre**
  (`CAMPOS`): peso, altura, brazo relajado, brazo contraído, cintura (mínimo),
  abdominal (máximo), cadera (máximo), muslo (medio), pierna (máximo) — una
  cinta puesta dos centímetros más arriba inventa una bajada de un centímetro,
  que es justo lo que esto viene a recoger. Más lo que marque su báscula de
  bioimpedancia, **tres fotos** (frente, perfil y espalda, encogidas con
  `prepararFoto`) y una nota. Va en `RegistroDia.medidas` porque el registro es
  lo único que sube su app. **No entra en `Medicion`**: su báscula de casa y unos
  pliegues medidos en consulta no se comparan, igual que no se comparan la
  bioimpedancia y los pliegues, así que vive en Seguimiento y no en
  Antropometría. Se enseña **lo último, el cambio desde la anterior y el cambio
  desde el día 1** (`evolucionDe`), que es la columna «Diferencia» de su
  planilla: un mal día se ve en la primera y no toca la segunda. Del peso, la
  **media de la semana** y nada de tendencia hasta tener dos. Los campos que no
  ha llegado a apuntar no salen: una fila de guiones sólo dice que el trabajo
  está a medias.
  **Las primeras las pone la nutricionista, y van en la misma línea del tiempo**
  (`historialDeMedidas`). A las online les pide medidas y fotos antes de la
  primera consulta y se las mandan por correo, así que esa toma —la única contra
  la que se compara todo lo demás— la escribe ella desde la ficha
  (`ApuntarUnaToma`, con la fecha a mano porque se apunta cuando llega el
  correo, no cuando se midió). Se guarda como `Medicion`, que es donde escribe
  la nutricionista: **la regla de que el registro del día sólo lo escribe la
  clienta no se toca**. Y sirve para cualquier fecha, no sólo la primera: hay
  quien manda las medidas por mensaje. Juntarlas **no es mezclar métodos**,
  porque en las dos mide la misma persona con la misma cinta — lo que sigue
  aparte son los pliegues, que esos sí los toma ella con el plicómetro. Si dos
  tomas caen el mismo día manda la de la clienta: si ha apuntado algo hoy es
  porque acaba de medirse. Los perímetros del perfil ISAK se traducen a los
  nombres de su planilla (`deLaMedicion`, `A_PERIMETRO`), y se añadió el
  **abdominal (máximo)** a `Perimetros`, que faltaba: no es la cintura —que va
  por el mínimo— y en una barriga que baja el mínimo se mueve antes.
- **El recorrido cuenta lo que la báscula se calla.** `EvolucionDeMedidas` es un
  `path` de SVG —sin librería, como el resto de gráficos— con **una medida cada
  vez y pestañas para cambiar**: nueve gráficos pequeños se ven todos a la vez y
  no se lee ninguno. **No empieza en cero**, que un peso de 68 a 70 sobre un eje
  desde cero es una línea plana y es justo el cambio que hay que ver. **No une
  lo que no se midió** (`serieDe` salta las fechas sin ese dato): cruzando enero
  con marzo porque en febrero no se midió la cintura, la línea diría que bajó en
  línea recta durante dos meses. Y **no dice si va bien o mal**: es el recorrido,
  y lo que significa se habla en consulta. `ComparaFotos` pone dos fotos lado a
  lado por ángulo, **empezando por la primera contra la última** y dejando
  elegir las dos fechas —un estancamiento se ve entre el mes 3 y el 5, no en el
  total—. Si a una toma le falta ese ángulo se deja el hueco en vez de saltarla,
  que si no parecería que la comparación es de otra fecha. Las dos cosas salen
  en su «Resumen» y en la ficha.
- **Los entrenos se cuentan, no se aprueban.** Varias clientas pedían llevar la
  cuenta de lo que entrenan, y la tentación es copiar las metas: objetivo
  semanal, anillo y racha. **Aquí no vale.** Una meta —dos litros de agua— se
  cumple o no se cumple; un entrenamiento no: tres a la semana es mucho para
  quien venía de cero y poco para quien prepara una carrera, y quien está
  lesionada, con la regla o con una semana imposible no ha fallado nada. Un
  «2 de 4» en rojo el jueves no enseña a moverse más — sólo dice que va tarde,
  en la misma app donde además apunta lo que come. Así que **no hay objetivo, ni
  racha de entrenos, ni ningún día en rojo**, y no toca la racha de las comidas:
  hay una cuenta («3 esta semana», sin «de») y lo que ella escriba. Los días que
  no han llegado se pintan en gris y no cuentan como huecos, como en el programa.
  Se enciende **persona a persona** (`Client.entrenos`), como la pausa y las
  medidas. Un entreno es **tipo + duración + cómo fue + nota**, y **sólo el tipo
  es obligatorio**: si para apuntar una salida hay que contestar tres preguntas
  se deja de apuntar, y un registro a medias sigue contando. Los tipos son una
  **lista cerrada** (`TIPOS_DE_ENTRENO`) con «otro» para escribirlo, porque a
  texto libre «fuerza», «Fuerza» y «gym» son tres cosas y entonces «este mes, 6
  de fuerza y 4 de correr» —que es lo que se mira en consulta— no se puede
  decir; cada «otro» agrupa por su nombre. El «cómo fue» son **tres caras y no
  del 1 al 10**: puntuarse el entrenamiento lleva al mismo sitio que puntuarse
  el día, y flojo no es malo. Van **varios por día**: hay quien corre por la
  mañana y va a pilates por la tarde. Viven en `RegistroDia.actividad` —**y no
  en `entrenos`, que ya existe** y es otra cosa: los vídeos de un reto que ella
  marca como hechos; por eso el tipo se llama `Actividad` y en pantalla los dos
  se llaman entrenos, que es como se llaman—. En la ficha (`SusEntrenos`, en
  Seguimiento) **sí hay medias y comparaciones** —ocho semanas, de qué entrena,
  los últimos con su nota— porque eso es material de consulta y en su app no
  sale, igual que con la pausa. La media es de **semanas cerradas**: la de esta
  semana iría siempre baja y bajaría sola cada lunes.
- **Las metas diarias hacen racha aparte de las comidas.** La nutricionista las
  escribe en `Client.metas` (10.000 pasos, 2 l de agua) y la clienta las marca
  en `RegistroDia.metas`. Un día de poca agua no puede tirar por tierra veinte
  días de comer bien, ni al revés. El día de metas se cierra con TODAS las
  activas marcadas, así que la lista corta es parte del diseño: con seis nadie
  cierra un día. Se pausan en vez de borrarse, que borrarlas se lleva por
  delante los días ya marcados.
- **Un bono sí sabe lo que se debe; unos pagos sueltos no.** `Bono` (nombre,
  importe, desde, vence, y las líneas que ella escriba: «3 consultas», «3
  llamadas»), los `Pago` se cuelgan con `bonoId` y las `Sesion` se marcan **a
  mano** — darlas por consumidas al pasar la cita haría que una cita anulada
  contara y el «2 de 3» mentiría. Esto **cambia la regla de más abajo**: en
  pagos sueltos «debe X» sería inventado, pero el importe del bono lo escribió
  ella, así que «faltan 90 €» es una resta. Un bono **se cierra, no se borra**:
  cerrado conserva sus pagos y sus sesiones. `tocaRenovar` (terminado, vencido
  o a una sesión / quince días) sale como aviso **en la lista de clientas** y
  como filtro, porque es ahí donde se hace la pregunta. **La clienta no lo
  ve**: «te queda 1 consulta» en la app donde come mete presión donde no toca.
- **«Mi cuenta» es el correo con el que entra y cómo va la consulta.** Se abre
  pulsando su nombre arriba a la derecha (`/perfil`), no desde una pestaña más.
  Deja cambiar la contraseña sin pasar por «se me olvidó»; con servidor no se
  pide la actual porque Supabase no la comprueba, y pedir un dato que nadie
  mira es teatro. **Los ingresos no se apuntan ahí**: salen de los pagos de
  cada ficha, y duplicar el sitio donde se apunta un pago garantiza que los dos
  acaben diciendo cosas distintas.
- **Lo cobrado y lo trabajado no son lo mismo.** «Mi cuenta» tiene tres
  pestañas —Resumen, Gastos y Acceso— y la pareja que importa del resumen es
  **cobrado** (lo que entró en caja ese mes) contra **devengado** (el trabajo
  hecho, `utils/consulta.ts`). Si alguien paga 270 € en enero y hace sus tres
  consultas en enero, febrero y marzo, enero cobra 270 y devenga 90: un agosto
  con mucha caja puede ser el peor mes de trabajo del año. El devengado se
  reparte solo —precio del bono entre las sesiones que incluye—, así que no hay
  ningún precio nuevo que mantener. Los gastos salen **por categoría y mes**,
  que un total no dice si el consultorio ha subido.
- **El dinero de una clienta vive en una sola tarjeta.** Había dos —bonos
  arriba, tarifa y pagos abajo— y no se hablaban: apuntar un pago abajo no lo
  colgaba de ningún bono, así que el «faltan 90» no se enteraba. Y la tarifa
  preguntaba «cuánto paga al mes», que es de cuando no había bonos. Ahora
  `BonosPanel` lo lleva todo y de la tarifa sólo queda **lo que cobras por una
  consulta suelta**. **La fecha se escribe, no se adivina**: cada consulta y
  cada pago llevan su fecha en un campo editable, porque se apuntan cuando se
  acuerda —a veces semanas después— y la de hoy convertía la consulta de agosto
  en una de septiembre.
- **La modalidad va en la ficha; el descuento, en el bono.** `Client.modalidad`
  (online o presencial) vale para todas sus consultas y `Sesion.modalidad` sólo
  se guarda cuando es la excepción: casi nadie alterna, y preguntarlo en cada
  sesión era un clic que se deja sin pulsar. El descuento va en `Bono`
  (`precioBase` + `motivoDescuento`) porque la misma persona entra rebajada por
  una derivación y renueva al precio de siempre; así se sabe **cuánto has
  dejado de cobrar** y no sólo cuántas son. Lo que no se puede calcular se dice
  en vez de esconderlo: consultas sin modalidad y sesiones sin bono.
- **«Acceso hasta» era una nota, no una puerta — y ahora cierra.** Una clienta
  dada de baja en marzo seguía entrando en octubre y marcando comidas: la fecha
  no la comprobaba nadie. `estadoAcceso` sólo se usaba en las pantallas de la
  nutricionista (la columna «Acceso», el filtro «Caducadas», el recuento de
  activas) y la app de la clienta nunca preguntaba. Ahora `ClientView` se para
  antes de pintar nada (`AccesoTerminado`): su nombre, **la fecha en que
  terminó** —para que no parezca una avería—, que **lo suyo sigue guardado**
  —es lo primero que se piensa, y es lo que convierte un final en una pausa— y
  un botón para escribirle. **A la nutricionista no se le cierra**: entra en
  esa misma pantalla para repasar cómo le fue y preparar la vuelta, y si le
  saltara el cartel no podría ver a quien tiene de baja, que es justo a quien
  va a llamar. **No se enseña el plan en gris**: un plan que se ve y no se
  toca es una tienda con la persiana a medias — se intenta, no funciona, y
  escribe preguntando si está roto. Y **no se pide pagar ahí**: lo que viene
  después se habla con ella.
- **El candado de verdad está en el servidor, y es de escritura.**
  `supabase/acceso-caducado.sql` añade `tiene_acceso(cliente)` y lo mete en las
  reglas de `insert`/`update` de `registros`: con la fecha pasada el servidor
  **no le acepta nada escrito**, ni una comida marcada ni un peso. **No se le
  esconde la ficha**, que se probó y es peor: sin poder leer su fila la app no
  sabe quién es y le sale «no encontramos tu ficha» —parece una avería— así
  que se le deja leer la ficha para poder explicarle lo que pasa. Eso significa
  que el plan que ya tenía sigue siendo legible para quien sepa mirar por
  dentro del navegador, **a propósito: ese plan ya lo pagó**. La rama de la
  nutricionista no lleva la comprobación: el candado es para la clienta, no
  para ella. Y **sin fecha el acceso es abierto**, la misma regla que en la
  app: dos definiciones distintas de «activa» en los dos lados serían peores
  que cualquiera de ellas.
- **La unidad la dice el catálogo, no lo que se tecleó en la receta.** El
  chocolate salía en mililitros. En el catálogo son gramos —es un sólido— pero
  esa línea de la receta llevaba `ml` escrito a mano: el editor copia la unidad
  del alimento al elegirlo, así que una línea escrita antes de eso, o duplicada
  de una de leche, se queda con la unidad vieja para siempre. Y pedirle que
  repase receta a receta las que ya tiene no es una solución. Así que cuando el
  ingrediente **está enlazado a un alimento** manda el alimento, que es quien
  sabe si eso se pesa o se mide (`unidadDeIngrediente` en `types/food.ts`).
  **Sólo se corrige `g` ↔ `ml`**: lo que ella haya escrito con sentido propio
  —«g en crudo», «uds», «cdta»— se respeta, porque ahí la línea sabe algo que
  el alimento no. De paso salió que las recetas semilla daban el aceite en
  gramos y el catálogo en ml: corregida la semilla, que tener los datos
  peleados es lo que hace falsos los dos.
- **«24 clientes» no es un dato: lo es «18 activas y 61 € por clienta».** La
  línea de arriba de `/clientes` contaba la lista entera, y dentro están las de
  esta semana y las que se fueron en marzo — así que no contestaba ninguna de
  las dos preguntas que ella se hace: a cuántas personas atiende ahora y cuánto
  le deja cada una. Ahora las activas van delante y en negro, el total detrás y
  en gris (sigue haciendo falta: es a quién puedes buscar en la lista) y al lado
  lo cobrado del mes entre las activas (`utils/clientasActivas.ts`).
  **Activa es «tiene el acceso vigente»** (`estadoAcceso` ≠ caducado, y sin
  `accesoHasta` el acceso es abierto): de las tres formas posibles es la única
  que ella ya mantiene al día —el acceso se alarga al renovar y se deja caducar
  cuando alguien lo deja— así que el número sale solo y no hay un campo nuevo
  que acordarse de rellenar. Y tener dos definiciones de «activa» en la misma
  app sería peor que cualquiera de las dos. Las otras se descartaron por lo que
  esconden: «con bono abierto» deja fuera a quien paga por sesión, y «con
  movimiento en los últimos 60 días» se hunde en agosto sin que nadie se haya
  ido. **Es distinto del ticket medio** del resumen de la consulta: aquél
  divide por consultas —cuánto deja cada visita— y éste por personas, y con
  bonos trimestrales las dos cifras se separan mucho. **Sólo sale del mes en
  curso y sólo si hay cobros apuntados**: de un mes pasado el divisor serían
  las activas de hoy y el dividendo lo de entonces —un número que miente— y
  «0 € por clienta» a primeros de mes no es un dato, es un susto.
- **Los gastos son de dos clases, y los fijos se cuentan solos.** Sueltos
  (`Gasto` sin `cada`) y fijos, que se apuntan una vez con su periodicidad y
  entran todos los meses (`utils/finanzas.ts`). Sin los fijos el flujo de caja
  es mentira: son los que nadie se acuerda de teclear y los que están siempre.
  Un fijo **se da de baja** (`hasta`) en vez de borrarse, que borrarlo se lleva
  por delante los meses en que sí se pagó. **No se proyecta el futuro** —los
  gastos se saben y los ingresos no, así que un mes futuro sería un agujero
  inventado— y **no se calcula lo que le deben**, por lo mismo que en la ficha.
  Sin IVA ni retenciones: eso sale de las facturas de verdad. Los gastos viven
  en la columna `gastos` de `nutricionistas`, con el patrón tolerante de
  siempre.
- **Marcar la cita como realizada es lo que gasta la sesión del bono.** Antes
  había **una sola cita por clienta** —la siguiente— así que al poner la de
  octubre se perdía la de septiembre: no había semana que pintar ni forma de
  saber qué consultas se dieron, y las sesiones y los pagos había que ir a
  apuntarlos a mano en cada ficha. Eso es lo que se queda sin hacer un jueves
  de quince citas. Ahora `Client.citas` las guarda todas (`utils/citas.ts`,
  pantalla `/agenda`) y **marcar una como realizada crea su `Sesion`** con el
  bono y la línea que le tocan. La regla de que una cita anulada no cuenta
  **no se rompe** —era el motivo de marcarlas a mano—: lo que descuenta es el
  gesto de decir que se dio, no que pase la hora. **Darlas por hechas al pasar
  la hora se descartó**: quien no viene y no se anula deja el «2 de 3»
  mintiendo, y un contador que miente es peor que uno con retraso.
  **La sesión lleva la fecha de la cita, no la de hoy**: las del lunes se
  marcan el miércoles y el mes en que se dio la consulta es el que manda en el
  trabajo hecho. **Y se puede deshacer**: `Cita.sesionId` guarda cuál creó, así
  que desmarcar quita **ésa** y no la última que haya, que podría ser una
  apuntada a mano. Una llamada gasta una llamada y una consulta una consulta,
  mirando el nombre de la línea; sin bono vigente se apunta igual como sesión
  suelta con su tarifa por sesión.
  **Se agenda pulsando el hueco, no rellenando un formulario**
  (`SemanaDeCitas`, `AgendarCita`). La semana es una rejilla con **franjas de
  cuarto de hora** —empezó en media hora dando por hecho que ninguna consulta
  empieza a y cuarto, y **no es verdad: una llamada dura quince minutos**, así
  que después de la de y media entra otra a menos cuarto y ese hueco tiene que
  poder pulsarse; las filas son más bajas para que la jornada siga entrando en
  una pantalla— y cada franja libre es un botón: se pulsa el
  viernes a las once y la ficha se abre con ese día y esa hora ya escritos.
  Escribir la fecha a mano es el paso que hace que una cita se apunte «luego».
  **Cada cita ocupa lo que dura**, así que se ve de un vistazo que el jueves
  está lleno y el viernes no, que es la pregunta cuando alguien pide hora por
  teléfono. La rejilla **se estira** si hay algo fuera del horario de ocho a
  nueve: una cita a las siete no puede quedarse fuera de donde se mira.
  **Se busca a la clienta por su nombre, no se elige de una lista**: con
  cuarenta fichas un desplegable obliga a bajar con el ojo. **Y al elegirla se
  dice cómo va su bono** —por cuántas va, lo pagado y lo que falta—, que es la
  pregunta que se hace justo al dar hora, con un enlace a su ficha para lo
  demás. **La duración viene puesta por el servicio** (`duracionPorDefecto`):
  15 minutos una llamada, 30 una consulta, y se cambia a 45 o 60 para una
  primera visita. Sólo se agenda a quien ya tiene ficha: un nombre suelto en la
  agenda no tiene bono del que descontar ni pagos que apuntar.
  **La rejilla va de media hora, pero la cita es al minuto**: el hueco
  *propone* la hora y en la ficha se afina —después de Nicolás, Norma entra a
  las 15:45—. La franja es para que la semana se lea de un vistazo, no para
  decidir a qué hora se puede citar. **Dos a la vez se puede, y se avisa**
  (`seSolapanCon`): hay días de doblar y llamadas que se meten encima de una
  consulta, así que sale un ámbar con el nombre de quien ya está ahí y **no
  bloquea** — lo que no puede es pasar desapercibido. Las que se pisan **se
  reparten el ancho del día** (`carrilesDelDia`): pintadas una encima de otra,
  la de abajo desaparece y parece que la agenda se ha comido una cita.
  **La agenda va de seis de la mañana a diez de la noche**, con las 24 horas a
  un botón. Y **la rejilla nunca se sale del día**: se estiraba sin tope para
  que cupiera cualquier cita, así que **un dedazo en los minutos la mandaba a
  «las 78:00»** y la columna de horas seguía bajando sin fin. Ahora una cita
  dura entre cinco minutos y cuatro horas (`duracionDe`, `DURACION_MAX`) —lo de
  fuera es un error de tecleo, no una consulta— y el estiramiento se recorta
  siempre a las 24 horas.
  **Lo que se abre se ve**: la cita y la ficha de agendar se pintan debajo de
  la rejilla, que ocupa la pantalla entera, así que al pulsar una consulta no
  pasaba nada a la vista y había que bajar a buscarla — `scrollIntoView`, como
  al cerrar una comida en el selector de recetas. Y **a su ficha se va por un
  botón**, no por el nombre subrayado: desde la cita parecía que no había forma
  de llegar a ella. El buscador de clientas va **palabra a palabra**: con la
  frase entera, escribir nombre y dos apellidos no encontraba a nadie si uno
  estaba escrito de otra manera.
  **Y la ficha enseña TODAS sus citas, no sólo la próxima** (`SusCitas`, en
  «Citas y pagos»): las que vienen arriba, las que pasaron debajo, con su
  estado y **con el mismo botón de marcarlas**. Al repasar en consulta hace
  falta poder decir «ésta la diste el 3 y ésta no vino», y marcar la que se
  quedó sin marcar sin irse a buscar la semana que fuera. Es el mismo sitio
  (`Client.citas`) leído dos veces, así que lo que se toca aquí sale en la
  agenda y al revés — y el aviso de «pasó y sigue sin marcar» se repite aquí,
  porque es la que deja el «2 de 3» mintiendo.
  **Una sesión que no cuadra con ninguna línea del bono ya no desaparece**
  (`ComoVaElBono.sueltas`): `sesionesHechas` sólo sumaba las que tenían
  `lineaId`, así que en un bono escrito **sin líneas** marcar la consulta no se
  veía en ninguna parte — que es lo mismo que no haberla marcado, y es
  exactamente lo que se notaba como «no se sincroniza». Ahora cuentan como
  hechas y se dice en ámbar que no tienen dónde apuntarse.
  **Al abrir una cita se ve su bono entero**: qué incluye y por cuántas va
  línea a línea, **los pagos con su fecha** y el total / pagado / debe. Al
  terminar una consulta las dos preguntas son «¿por cuántas va?» y «¿me debe
  algo?», y las dos obligaban a abrir su ficha. Se lee de `comoVaElBono`, el
  mismo de la ficha: no hay dos cuentas que puedan discrepar.
  **Se cobra desde la propia cita**, con el pendiente del bono ya escrito y el
  `Pago` colgado de ese `bonoId`, que es lo que hace que el «faltan 90 €» se
  entere solo. No es un sitio nuevo donde se apuntan pagos: es otra puerta al
  mismo, y la ficha sigue igual.
  **`Client.cita` no se toca: es un espejo de la próxima.** La app de la
  clienta lee ese campo desde siempre, así que `conLaCita` lo reescribe solo y
  lo que hubiera guardado ahí entra como una cita más (`citasDe`) en vez de
  perderse el día del despliegue. **Las anuladas se guardan** en vez de
  borrarse: un hueco vacío en la semana no cuenta que alguien no vino.
  **Dos avisos y sólo dos**: citas que ya pasaron y siguen sin marcar —el
  olvido que esto viene a resolver; las de hoy no se reclaman, que a las siete
  aún se está trabajando— y clientas sin la siguiente puesta, sólo de quien
  tiene bono por gastar: a quien se le acabó no le falta cita, le toca renovar,
  y de eso ya avisa la lista de clientas. **Abajo, el mes en cuatro números**
  (`mesDeConsulta`, el mismo de «Mi cuenta»): consultas hechas y lo que entró
  en caja salen de lo que ella acaba de marcar, así que no hay dos cuentas que
  puedan discrepar.
- **Las citas van en .ics, no en Google Calendar.** `Client.cita` y un enlace
  de descarga (`utils/agenda.ts`): lo entienden Google, Apple y Outlook por
  igual. Conectar la cuenta de Google pediría permisos, claves y una pantalla
  de conexión para ahorrar dos clics. La cita la ve también la clienta; la
  tarifa y los pagos, sólo la nutricionista. **De los pagos se suma y ya**: la
  app no sabe cuántos periodos han pasado ni qué se pactó de palabra, así que
  un «debe X» en rojo sería un número inventado.
- **La racha cuenta días cerrados, y una comida libre cierra igual que una
  hecha.** Si una cena con amigas tira por tierra veinte días, la app está
  enseñando que salir a cenar es un fallo (`utils/racha.ts`). Que hoy esté a
  medias no la rompe: se cuenta desde ayer y hoy se suma al cerrarlo. Un día
  sin marcar nada sí la corta, porque no hay forma honesta de contarlo.
- **Una opción de fase 2 se puede desmarcar.** Volver a pulsar la que está
  marcada la quita y la comida se queda en blanco (`elegirOpcion`). Antes, una
  vez marcada algo tenía que quedar marcado sí o sí: sólo se podía cambiar por
  otra. Y arrepentirse es normal —te equivocaste de comida, o al final no lo
  comiste—, así que la única salida era dejar puesto algo que no era verdad.
  Quitarla no toca lo marcado de los demás macros.
- **La comida se marca sola al tocar todos sus macros (fases 2 y 3).** Marcar
  las porciones ya es decir lo que has comido; pedir después «marcar hecha» es
  repetirlo con otro botón y lo que pasaba es que se quedaba sin pulsar.
  `comidaCubierta` pide **algo de cada macro pautado** —el aceite de cocinar
  descontado—, no cubrirlo del todo: en fase 3 manda el total del día, así que
  quedarse corta de una grasa en la comida es normal y se completa en la
  merienda. Exigiendo la cuenta exacta, la comida se quedaba sin marcar aunque
  estuviera comida, que es justo lo que esto venía a evitar. Se marca **sólo al
  cruzar** de incompleta a completa, así que si ella lo deshace a mano no se le
  vuelve a marcar. En fase 1 no aplica: ahí no se elige nada.
- **La fase 4 es el alta, y cuenta gramos.** El objetivo del día sale de los
  mismos intercambios pautados traducidos a gramos (`objetivoDelDia` sobre
  `gridMacros`): no es un número que se escriba en otro sitio, así que pasar de
  la 3 a la 4 no cambia lo que tiene que comer, sólo cómo se lo cuenta. La
  clienta busca el alimento, pone los gramos y se apunta en la comida donde se
  lo comió (`Bocado.momento`, con su botón propio en cada comida: se apunta
  donde se mira). El día se sigue juzgando entero —lo que manda es el total de
  arriba—, pero en una lista corrida hay que acordarse de qué has metido ya.
  Va en `RegistroDia.bocados`
  —aparte de `extras`, que son «lo comido de más» y en fase 4 no hay plan que
  superar—. Se le van las comidas, las porciones y el panel de extras; las
  recetas se quedan plegadas, que terminar el proceso no es perder el material.
  **El día se cierra apuntando algo** (`diaCerrado` mira `bocados`): sin eso,
  quien cuenta macros perdía la racha todos los días haciéndolo bien.
- **Lo que cocina ella se guarda con lo que SALE de ello.** En fase 4 hay dos
  casos que no se parecen: el mugcake es una ración y se come entero; del
  banana bread salen diez rebanadas, o un kilo del que mañana se sirve 50 g.
  `RecetaPropia` guarda los ingredientes y el rendimiento —`raciones`,
  `gramosFinales` o las dos— y de ahí sale un alimento normal con sus macros
  por 100 g (`utils/recetasPropias.ts`), así que se apunta desde el mismo
  buscador que todo lo demás y no hace falta ninguna cuenta aparte. Si dijo
  cuántas raciones salen, al elegirla la casilla ya trae los gramos de una.
  **El peso final manda sobre la suma de los ingredientes**: al horno se va el
  agua, y contar sobre lo crudo dejaría cada rebanada corta. Vive en
  `RegistroDia.recetasPropias` con su `recetasBorradas`, como las comidas
  guardadas, y **no lleva subgrupo**: es de fase 4, donde se cuentan gramos, y
  ponerle uno le haría gastar intercambios en fase 3 sin que nadie lo revise.
- **Lo de siempre se repite, no se vuelve a apuntar.** En cada comida (fases 3
  y 4) hay dos atajos: repetir lo que apuntó **la última vez** en esa comida
  —no hace falta que sea ayer, pero se dice de qué día viene— y sus comidas
  guardadas con nombre («Pancakes de avena»). Entra tal cual y luego retoca.
  Viven en `RegistroDia.comidasGuardadas` **y no en la ficha de la clienta**,
  porque el registro es lo único que sube el cliente: en su ficha se las
  pisaría la nutricionista. La lista se junta leyendo todos sus días y borrar
  una se apunta en `comidasBorradas`, ya que el día en que se creó no se puede
  reescribir desde hoy. Al traer una comida vieja **se arrastran sus alimentos
  de etiqueta** (`alimentosPropios` es de un día), o apuntaría a algo que hoy
  no existe.
- **De MyFitnessPal se copia el contador, no lo que engancha.** Se enseña lo
  que llevas, nunca lo que te queda: un número que baja hasta cero y se pone en
  rojo convierte cenar en un descubierto. Sin racha de días apuntados —premiar
  el registro por el registro engancha al contador, no a comer mejor—, sin nota
  del día y sin la proyección de peso, que es una cuenta falsa e invita a
  compensar. El margen es del **10 %**, el mismo con el que ya se juzga un día.
- **Un color, una cosa: ámbar falta, verde está, rojo te has pasado.** Vale
  para los anillos del presupuesto del día y para los de cada comida
  (`PortionRing`). Antes cada macro llevaba su color y el de la grasa era rosa,
  así que un día a medias se veía igual de alarmante que uno pasado. **El
  margen es media porción**, arriba y abajo: nadie come un cuarto de porción,
  así que pasarse 0,1 de hidrato —decimales que salen de la calculadora de
  etiquetas y de los alimentos con `equivale`— no puede pintar de rojo un día
  bien comido.
- **La barra de pestañas va abajo en el móvil y arriba en pantalla ancha.** La
  app se usa de pie en la cocina, con una mano: arriba no llega el pulgar y la
  barra se va con el scroll. En el ordenador el ojo la busca arriba. Son los
  mismos botones pintados dos veces (`PESTANAS`), y en los tests salen los dos.
- **Nadie tiene que hacer zoom para leer lo que come, y por eso el desplegable
  se salía.** Llegaron dos quejas el mismo día —«se le corta en la mitad los
  intercambios» y «la letra es muy pequeña»— y eran **la misma**. La app se
  escribió con la letra de una pantalla de ordenador: 14 px el cuerpo, 11 px
  las etiquetas (450 sitios) y 9 px en algún rincón. En un móvil, 11 px no se
  lee de un vistazo, así que la clienta ampliaba con los dedos — y la lista de
  equivalentes estaba `fixed`, centrada en **la ventana** y del ancho de la
  pantalla. Un elemento `fixed` se coloca respecto a la ventana entera y no
  respecto a lo que se ve, así que al ampliar mide más que la vista y aparece
  cortado por un lado. El desplegable roto era la consecuencia de la letra
  pequeña, no un fallo aparte.
  Por un lado, **la lista se abre debajo del ingrediente**, empujando lo de
  abajo como cualquier otra cosa de la página (`IngredientSwap`): aparece donde
  ella acaba de tocar, se puede ampliar cuanto haga falta y no hay capa oscura
  que tocar para cerrar, sino un botón. Un test recorre los padres y comprueba
  que **ninguno** vuelve a estar `fixed`.
  Por el otro, **la letra sube en un solo sitio** y no en cincuenta archivos:
  `.vista-cliente` en `index.css`, puesto en la raíz de `ClientView`. El cuerpo
  pasa de 14 a 16 px, el suelo es 13 px para lo que hay que leer y 12 para los
  adornos. Se hace así por tres razones: se cambia de una vez en vez de tocarlo
  pantalla a pantalla con el riesgo de dejarse la mitad; **no toca la pantalla
  de la nutricionista**, que se usa en el ordenador con tablas densas —la
  agenda por cuartos de hora— donde la letra grande quita filas; y va dentro de
  `@media screen`, así que **no toca el papel** y la hoja de la nevera sigue
  entrando en un folio. Es el tamaño y el aire, no el estilo: ni colores
  nuevos, ni modo oscuro, ni otra tipografía.
  **Y el nombre de la comida se lee, no se etiqueta.** «COMIDA» iba en 11 px,
  en mayúsculas y en gris claro: una etiqueta de esquina. Pero al abrir la app
  lo primero que se busca es «¿esto es el desayuno o la comida?», y en
  mayúsculas pequeñas eso cuesta más que en cualquier otro sitio — las
  mayúsculas quitan la forma de la palabra, que es por donde se reconoce de un
  vistazo. Ahora va en el tamaño del cuerpo, en minúsculas y en un gris que se
  ve, y el nombre del plato sube un escalón: la comida orienta y el plato
  manda. Igual en las tres fases (`MealCard`, `ScaledOptionsBoard`,
  `FoodPortionPicker`), que es la misma pregunta en las tres.
- **La bioimpedancia se copia tal cual y no se mezcla con los pliegues.** Cada
  báscula usa su fórmula, así que en el seguimiento van en filas distintas y
  cada una se compara consigo misma.
- **Los g/kg no siempre se multiplican por el peso total.** `Client.basePeso`
  elige entre peso total, ajustado (ideal + ¼ de lo que sobra) y masa libre de
  grasa (`utils/pesoReferencia.ts`). Pautar 2 g/kg sobre 110 kg da 220 g de
  proteína, el 40 % de las calorías del día. Con antropometría manda la masa
  magra; sin ella y con IMC ≥ 27, el ajustado. **Sólo afecta a los g/kg**: el
  gasto se sigue calculando con el peso real, que mover un cuerpo pesa lo que
  pesa. Se sugiere pero no se impone.
- **Lo que la nutricionista toca es un borrador; la clienta ve lo enviado.**
  `Plan.publicado` guarda la foto (fase + dayTypes) del último envío y
  `planParaCliente` es lo único que lee la vista del cliente. Sin esto, cambiar
  la fase un martes por la tarde le cambiaba la app mientras cenaba. El precio
  es olvidarse de enviar, y por eso `hayCambiosSinEnviar` sale en ámbar en la
  ficha **y en la lista de clientas**. Los planes anteriores a esto no tienen
  foto: si tienen `envio` se les enseña el plan vivo, o el día del despliegue
  todas se quedaban sin plan.
- **El cliente relee su plan solo.** Antes sólo leía al iniciar sesión, así que
  un cambio no le llegaba hasta cerrar la app. Ahora se repasa al recuperar el
  foco y cada cinco minutos (`bajarPlanDelCliente`), y **nunca trae registros**:
  los del servidor pueden ir por detrás de lo que acaba de marcar.
- **«Sin conexión» sólo cuando no hay red.** El plan gratuito duerme el
  servidor y despertarlo cuesta veinte o treinta segundos por consulta; en ese
  rato cualquier guardado fallaba y arriba ponía «Sin conexión» con el wifi
  perfecto, que es mandarla a mirar el router. Ahora se mira `navigator.onLine`:
  sin red, «Sin conexión»; con red, «Reintentando…», y sólo tras tres intentos
  fallidos «Sin guardar» en ámbar. Y **un guardado cada vez** (`subiendo` en
  `sincronizacion.ts`): con envíos de treinta segundos y el temporizador de
  1,5 s, teclear un nombre despacio lanzaba cinco envíos idénticos peleándose
  por el mismo servidor. Lo que se toca mientras sube sale detrás, y el
  reintento va doblando la espera hasta un minuto: insistir cada ocho segundos
  con todo el envío sólo entretiene a un servidor que está despertando.
- **Prohibir y vigilar son dos cosas distintas.** Un alérgeno es sí o no —un
  miligramo de gluten importa— y saca el alimento del catálogo. Una carga es
  *cuánto*: media aguacate cuadra en una dieta baja en FODMAP y uno entero no,
  así que se marca en ámbar con la porción segura y decide ella
  (`Patologia.bloquea` contra `Patologia.vigila`, y `Bloqueo.avisos`).
  Bloquearlo todo parece más seguro y no lo es: deja a una paciente de SIBO con
  arroz y pollo y a la nutricionista levantando excepciones a mano. **Sin dato
  no es sin problema**: un eje sin etiquetar sale en `Bloqueo.sinDatos` y se
  dice en gris, porque pintar de verde lo que nadie ha mirado es mentir. Los
  ejes son `EJES_CLINICOS`; oxalatos, purinas y salicilatos están preparados y
  sin rellenar. **Una receta carga lo que cargue su peor ingrediente**, así que
  se etiquetan solas.
- **La lactosa y la proteína de la leche no son lo mismo.** La lactosa es el
  azúcar; la proteína son la caseína y el suero. Una leche sin lactosa está
  llena de caseína, así que a una APLV no le vale. Iban con la misma etiqueta y
  se le colaban todos los «sin lactosa». Los alérgenos son ahora **los catorce
  del reglamento UE 1169/2011** —los que vienen escritos en el envase— y el
  marisco va partido en crustáceos y moluscos. Lo guardado se traduce **hacia
  el lado seguro** (`migrarAlergenos`): lo que llevaba lactosa lleva también
  proteína, y `marisco` marca los dos.
- **Los avisos técnicos son para la nutricionista, no para quien come.** La
  grasa escondida de un alimento, las notas del escalado y si la comida cuadra
  con lo pautado: sólo con `paraNutricionista`.
- **«¿Qué desayuna normalmente?» no se contesta con una lista de alimentos.**
  «Qué elige de verdad» decía qué repite en el mes, pero suelto: un mes de
  avena con plátano quedaba partido en dos líneas que no se hablan.
  `utils/loQueRepite.ts` + `QueRepite` lo cuentan **comida a comida con su
  frecuencia**, y lo que se cuenta es **lo que hay en cada fase** —en la 1 la
  receta elegida, en la 2 la combinación entera (sus alimentos en una línea, y
  ordenados, que si no el orden en que los marcó haría dos combinaciones de
  una), y en la 3 y la 4 los alimentos de esa comida, cada uno por su lado—.
  Así la tarjeta siempre dice algo. Las comidas salen **del plan y no de lo
  apuntado**: lo que se comió en una comida que ya no existe no contesta a
  nada, pero la merienda que sólo existe el día de entreno sí cuenta. **No se
  juzga**: ni «variedad baja», ni colores, ni avisos — comer siempre lo mismo
  le va bien a mucha gente, y el juicio es de la consulta. Lo único que se
  dice es «casi siempre lo mismo, X %», y sólo con una semana de datos: con
  tres días, un 100 % no informa de nada.
- **A quien contar le hace daño se le quitan los números, no se le quita el
  plan.** `Client.sinNumeros` (interruptor por clienta, como la pausa) deja su
  app sin calorías **ni macros** en fases 1, 2 y 3: sigue viendo sus
  porciones, sus recetas y sus gramos. Los macros se van **con** las calorías
  y no aparte: a quien lleva una cuenta de más en la cabeza, los gramos de
  proteína son otro número que vigilar, y dejarlos sería quitar el cartel
  grande y dejar los pequeños. Va por **contexto**
  (`components/client/SinNumeros.tsx`) y no por props: los números salen en
  una docena de sitios, varios compartidos con la pantalla de la
  nutricionista, y bastaba olvidarse de uno para que se colara justo donde más
  daño hace; por defecto está apagado, así que la pantalla de ella no se
  entera. **El PDF va dentro**, que si al exportar su plan le salieran las
  kcal que no se le enseñan, esconderlas no habría servido de nada. Lo que se
  esconde se esconde **entero** —la barra de macros desaparece en vez de
  quedarse vacía— porque «P —» sigue diciendo que hay algo que no estás
  mirando. Y el aviso de «te has pasado un 25 % en extras» también se va: lo
  apuntado se queda, el juicio sobre lo apuntado no. **En fase 4 no se
  aplica**, y no es un olvido: esa fase ES contar gramos, así que sin números
  no queda nada — si una clienta lo necesita, la fase 4 no es su sitio, y eso
  lo decide la nutricionista.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Tabla de intercambios (fuente de verdad) | `src/data/exchangeGroups.ts` |
| Catálogo de alimentos (262) | `src/data/foodCatalog.ts` |
| Escalado de recetas | `src/utils/recipeScaling.ts` |
| Avisos de fase 3 | `src/utils/dailyBudget.ts` |
| Conteo de macros (fase 4) | `src/utils/conteo.ts`, `components/phase4/` |
| Añadidos y completitud | `src/utils/anadidos.ts`, `utils/completitud.ts` |
| Cuentas (dos modos) | `src/utils/auth.ts`, `src/store/useAuthStore.ts` |
| Servidor | `src/utils/supabase.ts`, `nube.ts`, `sincronizacion.ts` |

## Servidor (Supabase) — ya configurado

- Proyecto `nutriplan`, región Irlanda. Esquema en `supabase/esquema.sql`.
- Tres variables en Vercel: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
  `VITE_NUTRI_EMAIL` (sólo ese correo puede ser nutricionista).
- Sin esas variables la app funciona igual, guardando en el navegador. Los
  tests corren en ese modo.
- App publicada: `https://app.tatiana-villegas.com` (sigue funcionando la vieja,
  `https://nutriplan-fawn-three.vercel.app`, para quien la tenga guardada).
  El dominio es de Tats, comprado en GoDaddy, y en su DNS conviven el correo de
  Outlook y su web. **En GoDaddy sólo se toca el `app`**: `www` apunta a otro
  sitio (CloudFront/systeme.io) y el `@` al aparcamiento de GoDaddy.
- **Los repartos se guardan y se reutilizan.** Un reparto es el grid de
  intercambios por comida (`utils/repartos.ts`), y se guarda **por slot** —los
  ids de comida son de cada plan—, con las kcal y el número de comidas con que
  se creó. Se sugieren primero los que encajan (mismas comidas y ±10 % de kcal)
  pero se ven todos: dos personas con las mismas calorías pueden necesitar
  repartos distintos y eso lo sabe ella. Al aplicarlo, **lo que la plantilla no
  cubre se queda como estaba**: es un punto de partida, no un borrado. Viajan
  dentro del jsonb `plantillas` (clave `repartos`), así que no hicieron falta
  columnas nuevas.
- **Las plantillas viven fuera del store y hay que avisarlas a mano.** Las de
  despensa y las de día se guardan en el navegador por su cuenta
  (`utils/plantillas.ts`), y la subida automática escucha el store. Por eso
  `guardarPlantillas` llama a `observarPlantillas`: sin ese aviso se guardaban
  sólo en ese navegador y al volver a entrar las pisaba lo que había en el
  servidor. `sinAvisar` es para escribir lo que acaba de bajar.
- **El registro del día es del cliente y sólo lo escribe él.** La nutricionista
  lo lee, nunca lo sube: subirlo con el resto de sus datos le borraba a la
  clienta lo que acababa de marcar, porque su copia era la de al iniciar sesión.
- **Seguimiento en vivo**: la nutricionista se suscribe a `registros` por
  Supabase Realtime. Necesita la línea `alter publication supabase_realtime add
  table public.registros;` del esquema. Sin ella la app funciona, pero hay que
  recargar para ver lo nuevo.
- **Lo que se repite cada poco tiene que pedir poco.** Se reventó la cuota del
  plan gratuito y después la memoria de la pestaña, y eran cuatro cosas que se
  multiplicaban entre sí:
  · **El sondeo de respaldo traía el histórico entero cada 20 segundos.**
  `bajarRegistros` pedía todos los registros de todas las clientas, de todas
  las fechas —con las fotos de progreso dentro— y lo hacía **aunque el directo
  estuviera conectado** y **con la pestaña al fondo**. Ahora lleva `desde`
  (`.gt("actualizado", …)`), así que en un rato tranquilo trae **cero filas**;
  sólo pregunta con el directo caído y con la pantalla delante, y se pone al
  día al volver a la pestaña. El histórico completo sigue bajando una vez al
  entrar (`bajar`) y con el botón «Actualizar», que es donde tiene sentido:
  la racha, las comidas fuera del mes y los check-ins se leen de ahí.
  · **La clienta subía sus 180 días en cada toque.** `subirRegistros` reescribe
  `actualizado` en todas las filas, así que marcar el desayuno disparaba 180
  avisos en directo, cada uno con su día entero. `soloLosQueCambiaron` manda lo
  que de verdad cambió —un día— y **sólo se da por enviado si el envío entra**,
  para que un corte de red no pierda nada.
  · **El cliente se bajaba su ficha entera cada cinco minutos** (cada treinta
  segundos esperando plan) con `select("*")`: todas sus planificaciones y todas
  sus mediciones con las fotos dentro, para leer sólo el plan — y las
  mediciones se tiraban ahí mismo. Ahora se mira primero `actualizado` (unos
  bytes) y sólo se baja `ficha, planes` si ha cambiado.
  · **Y al navegador no van las fotos** (`utils/sinFotos.ts`). La copia local
  guardaba registros y mediciones con las fotos en texto: no caben en los pocos
  megas de `localStorage`, así que el guardado fallaba en silencio —llevaba
  meses sin servir— y aun así se pagaba convertir cientos de megas a texto **en
  cada cambio**, incluido cada aviso en directo de cualquier clienta. Eso es lo
  que dejaba la pestaña sin memoria («Aw Snap»). Se quita también la del
  recurso y la de la receta que siga en texto. **Y el tamaño de la copia de
  seguridad se mide al bajarla, no al pintar la pantalla**: ese
  `JSON.stringify` de todo se rehacía con cada aviso que llegaba.
- **Las fotos personales tienen su almacén, y es privado.** Era lo de fondo: las
  de progreso (`RegistroDia.medidas.fotos`, `preparacion.foto`) y las de
  antropometría (`Medicion.foto`/`fotos`) seguían escritas **en texto dentro
  del jsonb** porque el almacén de recetas es **público** y éstas no pueden
  serlo. Medio mega por sesión de fotos, viajando en cada consulta del
  seguimiento y copiándose en cada guardado: es lo que llenó la base de datos y
  reventó la memoria de la pestaña.
  Bucket **`progreso`, `public = false`**. La carpeta es el **id de la
  clienta** (`cl_a1b2/2026-09-01-frente-1730….jpg`) y la regla del servidor lee
  esa primera carpeta y la busca en `clientes`, que ya tiene sus propias reglas
  —la nutricionista ve a las suyas, la clienta se ve a sí misma—, así que el
  permiso **sale solo y no hay una segunda lista que mantener**. Borrar sólo la
  nutricionista: la foto del día 1 es contra lo que se compara todo lo demás.
  **En los datos se guarda la ruta, no un enlace** (`esRutaGuardada`): un
  enlace a un sitio cerrado caduca, así que guardarlo sería guardar algo que
  mañana no sirve. Para verla se pide uno firmado en ese momento
  (`enlaceDeFoto`, una hora, con **caché**: el comparador repinta las mismas
  dos fotos al cambiar de ángulo y si no serían veinte consultas). Lo pinta
  todo `components/common/FotoPersonal`, que **sigue pintando tal cual lo que
  esté en el formato viejo**, así que lo que aún no se ha movido se ve igual.
  **La foto nueva sube al hacerla** —Mis medidas, Apuntar una toma, la
  preparación del reto— y **las viejas se arrastran de tres en tres por
  guardado**, como las de receta: si el almacén no contesta se quedan donde
  están y se reintenta, nunca se pierde una por intentar moverla. Antes de
  recorrer el histórico se mira **sin esperar a nadie** si queda alguna
  (`quedanFotosEnTexto`): casi ningún guardado tiene fotos que mover y pagar
  ese paseo en todos sería pagar para siempre un trabajo que se hace una vez.
  Cada una la mueve **quien puede escribirla**: la clienta las suyas —el
  registro del día sólo lo escribe ella, y esa regla no se toca— y la
  nutricionista las mediciones que apuntó ella.
  **La cuenta atrás pública se queda fuera**: ahí todavía no hay cuenta ni
  ficha, así que esa foto sigue en texto y se mueve al darla de alta, cuando ya
  es una `Medicion`. **Y la `imagen` de un recurso sigue en texto**: es la
  única que queda, son pocas y las escribe ella.
- **Nunca pedir columnas por su nombre en `nutricionistas`.** Se pide `select('*')`:
  pidiendo una columna que todavía no existe, PostgREST devuelve un 400 y con él
  se cae la fila entera —recetas, catálogo y plantillas—. Y si una consulta da
  error, `bajar` **lanza**: tratar un error como «no tienes nada» hacía que la
  app plantara las recetas de ejemplo encima del banco y borrara las plantillas.
  Al subir, si la columna nueva falla se reintenta sin ella: que falte la guía
  de raciones no puede impedir que se guarde un plan.
- **El enlace de la contraseña no puede acabar en almohadilla.** La app usa
  rutas con almohadilla (`#/clientes/...`) y el `redirectTo` volvía a `…/#/`,
  así que Supabase colgaba su `?code=` **detrás** de la almohadilla:
  `https://…/#/?code=abc`. Para el navegador eso no es un parámetro, es texto
  dentro del ancla, así que `location.search` salía vacío, la librería no
  encontraba nada que canjear y no había sesión — y sin sesión no hay
  contraseña que cambiar. Se vuelve a la raíz limpia (`?recuperar=1`,
  `utils/recuperacion.ts`). **La marca la ponemos nosotros** porque con el
  flujo nuevo (PKCE) lo que llega es un `SIGNED_IN` normal y el evento
  `PASSWORD_RECOVERY` —que es el del formato viejo— ya no salta; leerla de la
  URL además no depende de cuándo se registre el oyente. **Y `arrancar` no
  resuelve el perfil durante una recuperación**: si falla cierra la sesión, que
  es justo la ventana que ella necesita para escribir la contraseña; se
  resuelve al terminar de cambiarla, para que no tenga que volver a entrar. La
  URL **se limpia** en cuanto se usa el código: se canjea una vez, y recargar
  con él escrito fallaba en inglés. `ClaveNueva` comprueba que hay sesión antes
  de pedir nada y, si no la hay, dice por qué —caducado, ya usado, o abierto en
  otro móvil del que se pidió, que con PKCE el verificador se queda en el
  navegador de origen—. Lo enviado con el formato viejo (`#type=recovery`)
  sigue reconociéndose: esos correos ya están en bandejas de entrada.
- **Pendiente**: volver a activar «Confirm email» en Supabase cuando se deje
  de probar. Ahora está apagado y cualquiera que sepa el correo de una
  clienta podría crearse su cuenta.

## Cómo se maneja Vercel y Supabase

Con la extensión de Chrome (`mcp__claude-in-chrome__*`). Tats aprueba el
acceso cada sesión. Nunca escribir contraseñas por ella: preparar el
formulario y que lo envíe ella.

## Programas personales (RESET 90)

Un reto consigo misma: consulta individual de siempre, pero con principio y
final. `Client.programa` (nombre, inicio, días) y `utils/programa.ts`; **no es
un `Reto`** —no hay grupo, ni muro, ni recetas compartidas— y por eso son tres
datos en su ficha y no una pantalla aparte.

- **Se cuenta por meses, no por noventa días.** «Día 1 de 90» el primer día
  dice *te quedan 89*, que es lo contrario de lo que hace falta al empezar. En
  su app pone «Mes 1 · día 12», la tira es la de **ese mes** —treinta casillas
  se leen, noventa son un muro— y el total sólo sale al cambiar de mes, que es
  cuando es buena noticia. **Nunca una cuenta atrás.**
- **Los días que no han llegado no están fallados**, así que se pintan en gris
  y `comoVaElMes` sólo cuenta los que ya han pasado.
- **Al estrenar mes se felicita por lo que hizo**, no por lo que pesa: días
  cerrados y su mejor racha (`felicitacionDeMes`). Un mensaje que celebra kilos
  convierte en suspenso el mes que no baje.
- En la lista de clientas sale un **chip con el nombre del programa y el mes**,
  que es lo que las distingue de las de consulta normal.
- **El check-in va cada dos semanas, no cada mes.** Si el hambre se disparó la
  segunda semana, saberlo el día 30 es tarde (`utils/checkin.ts`). Cinco
  preguntas de 1 a 5 —energía, digestión, sueño, hambre, antojos— con lo que
  significa cada extremo escrito al lado, y una línea libre que suele ser lo
  más útil. **No hay nota ni media**: ponerle un número global lo convertiría
  en algo que aprobar, que es lo mismo que se rechazó con la adherencia del
  día. Se puede dejar para otro momento y **sigue disponible hasta el
  siguiente**: perseguir a alguien con una encuesta no funciona, pero hacerla
  desaparecer por un día tampoco. Vive en `RegistroDia.checkins` y en la ficha
  se ve el último **con su cambio respecto al anterior**, porque en consulta lo
  que importa es hacia dónde va y no el número suelto.

## Retos (UPGRADE 1.0)

Un grupo que empieza el mismo día. `types/reto.ts` y `utils/retos.ts`; la
pantalla es `/retos`.

- **Una participante es una clienta más, pero no sale en la lista de
  clientas.** Por dentro es una clienta —así hereda el acceso por correo, el
  plan, el registro del día, las rachas y el seguimiento sin escribir nada
  nuevo—, y quien llega por el enlace se marca con `Client.soloReto`, que la
  saca de `/clientes`: con veinte apuntadas, esa lista dejaba de servir para
  encontrar a las de consulta. Una clienta de siempre puede apuntarse sin dejar
  de ser tu clienta (no lleva la marca y sale en las dos).
- **Todo el reto se monta y se sigue desde `/retos`.** Ahí están las
  solicitudes del enlace, quién está dentro, las recetas, los entrenos, los
  recursos y **cómo va el grupo**: una tabla con días cerrados, racha, comidas
  fuera y peso, ordenada por días cerrados. Con veinte participantes no se
  puede abrir ficha por ficha cada mañana. Se ordena por constancia y nunca por
  medidas, por lo de siempre: un ranking de kilos premia a quien empieza más
  pesada y en público siempre hay alguien última.
- **En su app, «Tu reto» son sólo los entrenos.** Las recetas ya salen abajo,
  en su comida, que es donde se buscan cuando toca comer: repetirlas arriba
  ocupaba media pantalla y hacía dudar de si eran las mismas o unas aparte.
- **En un reto online la báscula la lleva ella.** Apunta peso, cintura y cadera
  desde «Resumen» y va a `RegistroDia.medidas` —lo único que sube el cliente—;
  la nutricionista lo ve en la ficha de la participante. Se enseña la **media
  de la semana**, no el peso de hoy: el de un día son dos kilos de agua y de lo
  que quedó de la cena. La tendencia (`utils/misMedidas.ts`) no se dice hasta
  tener dos semanas. Todo opcional y sin recordatorios: pesarse a diario le va
  bien a quien no le da importancia y le hace daño a quien se la da.
- **A la clienta no se le habla de fases.** «Fase 1» dice en qué punto del
  método está, que es vocabulario de la consulta; a quien come sólo le deja la
  duda de cuántas fases hay y por qué está en la primera.
- **Los entrenos se abren por días, como las recetas.** `EntrenoDeReto` lleva
  vídeo y lista de ejercicios con series: sin la lista hay que volver a mirar
  el vídeo entero para saber cuántas vueltas quedan, y eso en mitad de una
  serie no se hace.
- **Entre apuntarse y empezar hay un hueco, y ahí se pierde la gente.** La
  participante ve una preparación de tres pasos —medirse cintura y cadera, la
  foto del primer día, leerse la guía— con el anillo de «2 de 3». Sin ese punto
  de partida, el día 30 sólo queda el peso, que es lo que peor cuenta lo que ha
  pasado. **No se le pide el peso**: abrir la app por primera vez con una
  báscula delante marca el tono equivocado para treinta días. Vive en
  `RegistroDia.preparacion` porque el registro es lo único que sube el cliente,
  y se junta leyendo sus días (`utils/preparacion.ts`). **La foto es suya**:
  puede subirla —se encoge a 900 px antes de guardarla— o marcar el paso sin
  subir nada. La pantalla pública de la cuenta atrás enseña esos tres pasos sin
  casillas: marcarlos ahí no guardaría nada y sería pedirle el trabajo dos
  veces.
- **A una participante sólo se le calcula y se le reparte.** Las recetas del
  reto se le abren solas en la comida de su `slot` (`recetasAbiertasDe` en la
  vista del cliente) y se escalan a SUS porciones, así que en su ficha no hay
  que asignar recetas: se calcula el GET, se reparten los intercambios y se
  envía. Asignarlas una a una por participante es repetir veinte veces el mismo
  trabajo. Sus comidas salen de cuántas dijo que hace al apuntarse.
- **La edad se calcula, no se escribe.** `edadDe` manda en el cálculo y también
  en la casilla del GET: quien llega por el enlace da su fecha de nacimiento y
  no su edad, así que ahí ponía 0 y parecía que el GET estaba mal.
- **Se comparten las recetas y los recursos; las porciones no.** Cada una tiene
  su plan con sus intercambios y las mismas recetas se le escalan a sus
  números. Por eso veinte participantes cuestan casi lo mismo de montar que una.
- **El reto se va abriendo, y se piensa en semanas.** Cada receta y cada
  entreno llevan `desdeDia`, pero lo que se elige y se lee es la **semana**
  (`semanaDeDia`, `primerDiaDeSemana`): «la semana 1 tiene cuatro desayunos
  entre los que elegir» es como se monta un reto. Por dentro sigue siendo el
  día para no tocar lo ya montado ni el cálculo de qué está abierto. Lo que se
  abrió sigue abierto: suma, no rota.
- **Las participantes se trabajan desde el propio reto.** Se despliega una y
  salen su GET, su preparación, lo que ha subido y en qué estado está su plan;
  el editor de porciones sigue en su ficha, que es donde vive. Y hay un
  **«publicar a todas»**: los planes se montan según van llegando y se mandan
  todos el día que empieza el reto, porque entrar en veinte fichas la misma
  mañana es justo el trabajo que hace que un reto no salga rentable.
- **La preparación se completa desde la cuenta atrás, sin cuenta.** Se escribe
  sobre su propia solicitud (`Solicitud.preparacion`, con una política de
  `update` en `solicitudes`): el id es aleatorio y sólo lo tiene su navegador,
  así que hace de llave —no se pueden listar—. Al darla de alta, sus medidas
  pasan a ser su **primera medición**, que si no se perderían al borrar la
  solicitud. Quien ya tiene la app la completa desde ahí
  (`RegistroDia.preparacion`).
- **La comunidad es ver que las demás aparecen, no un muro de publicaciones.**
  Si cinco publican y quince miran, las quince se sienten *menos* del grupo. El
  muro (`utils/muro.ts` + tabla `muro`) enseña dos cosas: quién ha cerrado hoy
  —nombre de pila— y la **meta común** (días cerrados del grupo contra los
  posibles). Se gana en equipo, así que la que va floja queda arropada en vez
  de última. Por la tabla sólo viajan **quién, qué día y si lo cerró**: nada de
  lo que escribe en su registro sale de ahí. Sin publicaciones ni fotos a
  propósito: en un grupo de nutrición un muro abierto termina en cuerpos y en
  «yo he bajado tres kilos», que es lo mismo que se rechazó con el ranking.
  **La charla vive en WhatsApp** (`Reto.whatsapp`): competir con WhatsApp en
  charlar es una pelea perdida y un chat sin notificaciones se queda mudo.
- **La tira de días es lo que hace que un reto sea un reto.** En su app, «Cómo
  va tu reto» son los 30 días con un ✓ en los cerrados. Cuenta días cerrados
  —una comida fuera cierra igual— porque si salir a cenar apagara una casilla,
  la tira enseñaría que salir a cenar es un fallo.
- **Al subir, las columnas nuevas se van quitando de la más nueva a la más
  vieja** hasta que el envío entra (`subirTodo`). Si falta `retos` pero existe
  `recursos`, se guardan los recursos igual.
- **Se cobra primero y se pregunta después.** El enlace público
  (`/#/apuntarse/:retoId`) es la página de destino de Stripe tras el pago: al
  formulario sólo se llega pagando. Así no se acumulan fichas sin pagar ni se
  pierde quien pagó. Dos tablas con RLS propia: `retos_publicos` (sólo nombre,
  fecha y días; cualquiera la lee) y `solicitudes` (se puede **escribir** sin
  cuenta pero **no leer**: quien se apunta no ve quién más se ha apuntado).
- **El alta la da Tats a mano, y no es burocracia.** `avisosDeSolicitud` marca
  en rojo lo que hay que hablar antes —antecedente de TCA, embarazo, peso muy
  bajo— y en ámbar lo que sólo informa, como un IMC alto que hará calcular
  sobre peso ajustado. Ese vistazo es lo que justifica el paso manual.
- **Cuántas veces come al día decide las comidas de su plan**
  (`comidasDelPlan`). Al bajar de comidas se quitan los picoteos y se quedan
  las grandes: con dos, desayuno y comida — no desayuno y recena.

## Cosas que quedaron a medias

- **89 de los 262 alimentos tienen la medida casera repitiendo los gramos**
  («Pechuga de pollo cruda → 30 g»). Vienen así del Excel. Hace falta que
  Tats dé las equivalencias reales; no inventarlas.
- **Las fotos de recetas viven en Supabase Storage** (`utils/almacen.ts`, bucket
  `recetas`), y en los datos queda el enlace. Antes iban dentro del jsonb y la
  app de una clienta se descargaba el banco entero —con TODAS las fotos— antes
  de enseñarle su plan. Las que quedan en formato viejo se mueven solas, tres
  por guardado, y **si el bucket no existe se quedan como están**: lento, pero
  sin perder ninguna. Las **fotos de progreso de las clientas no van ahí**: son
  personales y siguen en su registro.
- **La copia de seguridad la descarga ella, porque el servidor no la hace.** El
  plan gratuito de Supabase no tiene copias, así que sin esto no había ninguna:
  si algo se corrompe o se borra, se van las fichas, los planes y el registro de
  todas. `utils/copiaDeSeguridad.ts` + el botón en «Mi cuenta → Acceso» arman un
  JSON con lo que la app ya tiene cargado y lo bajan por `Blob` —no por una URL
  con los datos dentro, que con las fotos se va a varios megas y deja de
  funcionar—. **Sin claves ni servicios nuevos**: si ella está dentro, es que
  tiene permiso para leer sus datos. Van también **las plantillas**, que viven
  en el navegador y no en el servidor: son justo las que más falta hacen. Se
  **dice qué lleva antes de bajarla** (clientas, planes, recetas, mediciones,
  días) porque una copia vacía pesa dos kilobytes y parece que ha funcionado
  igual. Y se dice **dónde guardarla**: lleva nombres, correos, medidas, fotos y
  patologías de personas reales. **No hay botón de restaurar a propósito**:
  restaurar es sobrescribir, y un botón que pisa todas las fichas de golpe hace
  más daño del que arregla el día que se pulsa sin querer — el día que de verdad
  hace falta se usa una vez en la vida y se hace con calma.
- **Pendiente de seguridad, decidido por ahora que no**: «Confirm email» sigue
  apagado en Supabase. Con él apagado, quien sepa el correo de una clienta puede
  crearse su cuenta y ver su peso, sus fotos y sus patologías. Está comprobado
  que encenderlo **no rompe nada** —el correo sale por Resend desde
  `hola@tatiana-villegas.com` y las 37 cuentas de ahora ya están confirmadas, así
  que sólo afectaría a los registros nuevos— pero Tats prefiere no añadirle un
  paso más a la clienta. Se vuelve a proponer, no se enciende por detrás.

## Cómo hablarle a Tats

Es nutricionista, no programadora. Explicar en castellano llano y con
ejemplos de comida de verdad, no de código. Decir cuándo algo no se puede
hacer y por qué. Si una decisión de diseño tiene consecuencias raras
(«entonces el yogur desaparece del plato»), avisarlo antes de que lo
descubra usándolo.
