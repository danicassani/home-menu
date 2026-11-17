# home-menu
PWA instalable en Android y iPhone para crear una carta de platos caseros, planificar las comidas de la semana y generar una lista de la compra compartida por los miembros de cada casa. La aplicación se alojará en Cloudflare y usará Supabase para la base de datos, el almacenamiento de fotos y la autenticación.

## Carta de platos

Carta ofrece dos iconos del color del tema para elegir lista (un plato por fila) o cuadrícula (dos por fila, también en móvil). La selección se conserva en este navegador, sin datos personales. La cabecera y el espacio superior del contenido son compactos.

Los usuarios podrán crear platos a mano y organizarlos con **etiquetas libres y opcionales**. La carta mostrará los platos como tarjetas con nombre, foto y una descripción breve. Al pulsar una tarjeta, se abrirá la ficha del plato con la **foto, la descripción, los ingredientes y la receta**, en ese orden.

## Ingredientes y alternativas

En cada ingrediente, Añadir alternativa y el icono de borrador para quitarlo comparten una fila de acciones.

Al crear una receta, el botón **+** debajo del título **Ingredientes** abrirá un desplegable con un buscador para reutilizar ingredientes ya registrados en la aplicación. La opción **Nuevo ingrediente** abrirá un formulario con el **nombre** como campo obligatorio y las **kilocalorías por cada 100 g** como campo opcional.

Algunos ingredientes de una receta podrán tener alternativas seleccionables manualmente. Por ejemplo, un plato con carne, pollo o pescado podrá ofrecer una versión vegetariana con **soja texturizada, seitán, tofu o garbanzos**, según la receta.

## Planificación semanal

Cada día tendrá un espacio para comida y cena. Los usuarios podrán elegir platos de la carta y eliminar individualmente los que ya estén planificados. El botón **Sustituir** abrirá la carta para elegir otro plato y colocarlo en el mismo día y turno.

## Lista de la compra

La lista se generará a partir de los ingredientes de los platos planificados para la semana. Se actualizará automáticamente al añadir, eliminar o sustituir un plato y tendrá en cuenta las alternativas de ingredientes seleccionadas.

Cada ingrediente aparecerá una sola vez y se mostrará únicamente por su nombre. Al marcar su casilla, el ingrediente se tachará y pasará al desplegable **Comprados**, al final de la lista. Si se desmarca, volverá a la lista de pendientes.

## Casas y acceso

La aplicación admitirá varias casas. Cada casa podrá tener varios usuarios y cada usuario pertenecerá a una única casa. Los miembros compartirán la carta, la planificación semanal y la lista de la compra de su casa.

Tanto el registro como el inicio de sesión se harán con **Google** mediante Supabase Auth. En la primera versión, el registro quedará completado al entrar con Google, sin un correo de confirmación adicional.

## Navegación

Las vistas Carta, Semana, Compra y Casa se abren desde una barra inferior fija con cuatro iconos, sin texto visible: plato con cubiertos, calendario, carrito y casa. Conservan etiquetas para lectores de pantalla, foco de teclado y una marca de vista activa. La barra respeta el área segura del móvil y deja espacio para los controles al final de cada vista.

El contenido se presenta directamente sobre el fondo, sin panel exterior ni separador bajo la cabecera. Se mantienen las tarjetas de platos y días, los colores y el espaciado.

El saludo «Hola, nombre» se muestra pequeño junto al avatar del perfil, también en móvil. El estado de sincronización aparece bajo Home Menu: «Online» al estar suscrito, manteniendo los estados de conexión, reconexión y sin conexión. No hay separador entre cabecera y contenido.

## Perfil y apariencia

Cerrar sesión está únicamente dentro del perfil y sigue disponible sin conexión o si falla la carga de preferencias. La X cierra la ventana sin salir de la cuenta.

El nombre del usuario y su avatar aparecerán en la esquina superior derecha. Al pulsar el avatar se abrirá el perfil, donde cada usuario podrá elegir un **emoji como avatar**, cambiar entre **modo claro y oscuro** y seleccionar un tema de color. Los temas disponibles serán **blanco, azul, rojo, rosa, verde y amarillo**, cada uno con su variante clara y oscura.

## Documentación y desarrollo

- [Especificación funcional, arquitectura y fases](docs/ESPECIFICACION.md).
- [Instrucciones para agentes](AGENTS.md).

La base técnica prevista es React con TypeScript, Vite y Tailwind CSS en Cloudflare Pages, con Supabase para autenticación, datos, fotos privadas y sincronización. La interfaz será móvil y estará en español.

El repositorio incluye acceso, casas, invitaciones y carta de platos. También están implementados el menú semanal, la compra automática y la sincronización entre miembros. Consulta los comandos y limitaciones más abajo.

## Ejecutar la base de la aplicación

Requiere Node.js 22 o posterior y npm. Desde la raíz:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Completa `.env.local` con la URL y la clave pública de tu proyecto Supabase (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`). No uses una clave `service_role`. Sin configuración se puede consultar la portada, pero el acceso está deshabilitado.

En Supabase, activa Google en Authentication → Sign In / Providers y configura sus credenciales de OAuth. En Google, autoriza el callback de Supabase que muestra el proveedor. En Authentication → URL Configuration añade el origen de desarrollo (`http://localhost:5173/`) y el origen de producción autorizado. El retorno de la aplicación siempre usa su propio origen. No autorices comodines generales para producción.

```sh
npm run typecheck
npm test
npm run build
npm run preview
```

Cloudflare Pages: comando de build `npm run build`, directorio de salida `dist`, Node.js 22 o posterior y las dos variables públicas configuradas antes de compilar. `public/_redirects` permite rutas de SPA. Esta entrega no despliega automáticamente.

**Estado:** acceso Google, creación de casas e invitaciones compartibles, revocables y válidas durante siete días. También hay gestión de miembros, transferencia, salida y eliminación de casas. También hay perfil personal, avatar emoji y temas claro/oscuro. También hay instalación PWA y compra sin conexión; falta validación en dispositivos reales. Interfaz cuidada y contenida, con tarjetas y tonos suaves; único eslogan: «Olvida el 'qué comemos'».

Antes de desplegar esta entrega, aplica `supabase/migrations/202611140001_households.sql` una sola vez en el SQL Editor de Supabase. No contiene datos de ejemplo. Activa RLS y limita las escrituras a funciones transaccionales. No se ha aplicado automáticamente. Las pruebas SQL se ejecutan contra PostgreSQL local embebido (PGlite) con roles Auth simulados, sin conectarse a producción. Las pruebas de interfaz simulan el cliente Supabase.


## Carta de platos

La sección Carta permite crear y editar platos, buscar por nombre y etiquetas y filtrar por etiqueta, consultar la ficha y archivar/restaurar. El selector + reutiliza ingredientes del hogar y permite crearlos con kcal opcionales. Cada ingrediente admite alternativas del mismo catálogo. Las elecciones por día se incorporarán con la planificación semanal.

Las fotos son opcionales, privadas y de hasta 5 MB (JPEG, PNG o WebP). El icono de cámara abre el selector; antes de adjuntar se ajusta el encuadre 4:3 con arrastre, gesto de pinza, flechas del teclado y zoom. Se genera un JPEG de hasta 1600 × 1200, sin ampliar imágenes pequeñas, y solo se sube al guardar el plato. Cancelar conserva la foto anterior; el icono de recorte permite reajustarla. Se muestran mediante enlaces firmados de una hora; Actualizar renueva los enlaces. Editar una versión antigua de un plato falla conservando el borrador, para evitar sobrescribir cambios de otro miembro.

**Migraciones:** aplicar una sola vez, en este orden:

1. `supabase/migrations/202611140001_households.sql`, si todavía no se aplicó.
2. `supabase/migrations/202611150001_recipes.sql`, antes de desplegar la carta.

La segunda migración crea el catálogo, las recetas, alternativas y el bucket privado `recipe-photos` con políticas por casa. No requiere nuevas variables ni cambios en Google OAuth. No borra recetas al archivarlas. Las fotos reemplazadas, retiradas o subidas durante un guardado fallido se conservan en Storage; su limpieza automática queda pendiente. No se eliminan al fallar un guardado porque la respuesta podría haberse perdido después de confirmarse la transacción.

**Pruebas de navegador:**

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright inicia un servidor aislado con respuestas HTTP simuladas, sin credenciales reales. Comprueba creación, edición, alternativas, catálogo, archivo y fotos en tamaños móvil y escritorio. Para usar Chromium ya instalado, define `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` con su ruta. Vitest comprueba componentes y las migraciones en PostgreSQL embebido (PGlite); las pruebas de Storage modelan sus tablas y políticas, sin ejecutar el servicio remoto. La aplicación de migraciones y la validación de Storage en el proyecto real son pasos separados.


## Menú semanal

El día actual se resalta con el color del tema y `aria-current="date"`, según la fecha local; se actualiza al cambiar de día y no se marca en otras semanas. En Semana, el botón + aparece solo en turnos vacíos; los ocupados muestran «Comida: nombre del plato» o «Cena: nombre del plato» sobre la foto, sin cabecera de turno duplicada. Al quitar el último plato reaparece el +. Se conservan las apariciones múltiples ya existentes. Semana muestra tarjetas con foto panorámica de menor altura y título sobre una transparencia negra al pie. Sustituir (flechas circulares) y Quitar (papelera) son iconos en la esquina superior derecha. Los ingredientes no aparecen en la tarjeta: pulsar la foto o el título abre un diálogo con las alternativas de esa aparición; mantiene los bloqueos offline y los avisos si la receta cambia.

La pestaña Semana organiza de lunes a domingo las comidas y cenas. El + permite añadir un plato a un turno vacío; las apariciones múltiples guardadas previamente se conservan. Añadir y Sustituir abren la carta con búsqueda y filtro por etiquetas. Cualquier receta puede usarse en comida o cena. Quitar afecta solo a esa aparición.

Al abrir la foto o el título del plato planificado se eligen sus alternativas de ingredientes sin cambiar la receta ni otras apariciones. Si una edición elimina una alternativa elegida, se vuelve al ingrediente original y se muestra un aviso para revisar la receta. Las recetas archivadas siguen visibles en menús existentes, pero no se ofrecen para añadir o sustituir.

Las flechas y el selector de fecha cambian de semana. Copiar desde replica platos y alternativas en la semana visible; requiere confirmación si ya contiene platos. Las copias son independientes y no incluyen datos de compra. Las fechas son días de calendario, sin conversión a UTC.

**Nueva migración:** ejecutar una sola vez `supabase/migrations/202611150002_weekly_menu.sql`, después de las dos anteriores, antes de desplegar este bloque. No volver a ejecutar las migraciones ya aplicadas. Añade las semanas, apariciones, alternativas y políticas RLS, y amplía `save_recipe` manteniendo su contrato. Su implementación auxiliar queda privada. Los cambios de recetas y menús se serializan por casa y las revisiones impiden sobrescribir cambios recientes; en caso de conflicto, usar Actualizar semana.

La semana se recarga con los avisos Realtime, al volver a la pestaña del navegador o al pulsar Actualizar semana. La consulta de semanas visitadas está disponible sin conexión (véase PWA y desconexión). Las migraciones de esta entrega no se han aplicado ni probado en el proyecto Supabase remoto. Las pruebas locales cubren aislamiento, validación de alternativas, revisiones, archivo, copia, cambios de mes/año y fechas cercanas a cambios de hora; los recorridos de navegador usan HTTP simulado.


## Compra automática y colaboración

La pestaña Compra comparte la semana seleccionada con Semana. Genera una sola fila por ingrediente del catálogo, usando las alternativas elegidas para cada aparición del plato. No calcula ni muestra cantidades. Los cambios de menú y recetas reconcilian la compra dentro de la misma transacción.

Marcar una casilla tacha el producto y lo mueve a Comprados; desmarcar lo devuelve a Pendientes. Añadir producto reutiliza el catálogo o permite crear uno. Si el producto ya viene del menú aparece una sola vez. Quitar su aportación manual no elimina una necesidad del menú. Los productos manuales no pasan a otras semanas ni se copian con el menú.

Las marcas se conservan mientras el ingrediente siga siendo necesario. Si desaparece y se añade después, recibe una identidad nueva y empieza pendiente. Las marcas sobre una identidad eliminada se rechazan. Entre miembros, prevalece la última marca aceptada por el servidor. La copia de menús conserva los productos manuales del destino y no copia marcas del origen.

**Migración nueva:** aplicar una sola vez `supabase/migrations/202611160001_shopping_realtime.sql`, después de las tres anteriores, antes de fusionar/desplegar. No repetir las anteriores si ya están aplicadas. Crea la compra, sus funciones y un contador privado `household_changes` por casa; incorpora ese contador a la publicación `supabase_realtime`. Inicializa la compra de los menús ya existentes. No necesita variables nuevas ni cambios OAuth.

Realtime avisa de cambios en carta, menú, compra e invitaciones; cada cliente recarga los datos autorizados de su casa. No se envían recetas ni productos en el aviso. Los eventos se agrupan y las recargas se aplazan mientras se edita o guarda, sin sustituir el borrador ni su revisión. Se recupera el estado al suscribirse/reconectar. Si falla el canal, se actualiza cada 15 segundos; cada minuto se revalida el estado incluso con el canal activo. Al salir o cambiar de casa se retira la suscripción.

Las pruebas SQL comprueban derivación, permisos, conservación de marcas, identidades nuevas, copias y publicación. Playwright usa el cliente Supabase real con HTTP y WebSocket simulados, incluyendo dos sesiones en contextos independientes. Esto no sustituye la comprobación del proyecto Supabase desplegado tras aplicar la migración. Sin conexión se pueden guardar marcas de compra; las demás escrituras requieren conexión (véase PWA y desconexión).


## Gestión de casa

Casa muestra los miembros y el propietario. El propietario puede quitar miembros y transferir la propiedad a otro miembro existente. Los miembros pueden salir; el propietario debe transferir primero o eliminar la casa. Quitar un miembro y transferir la propiedad revocan los enlaces de invitación activos. Todas estas acciones requieren confirmación y autorización en PostgreSQL.

Eliminar casa exige escribir su nombre. La eliminación tiene dos fases: se bloquea la casa y se libera la pertenencia de los demás miembros; el propietario limpia sus fotos mediante Storage API y después se eliminan los datos de la casa en una transacción. No se borran cuentas de Google/Supabase. Si falla o se cierra el navegador, el propietario ve Completar eliminación al volver. Una eliminación iniciada se puede reanudar, pero no cancelar porque parte de las fotos puede haberse borrado. Los demás miembros pueden crear o unirse a otra casa mientras termina.

**Nueva migración:** aplicar una sola vez `supabase/migrations/202611160002_household_management.sql` después de las cuatro anteriores, antes de fusionar/desplegar. No repetir migraciones aplicadas. Añade estado de eliminación, funciones de administración y avisos personales `user_household_changes` bajo RLS, publicados en `supabase_realtime`. Ajusta el orden de bloqueo de escrituras e invitaciones. No necesita nuevas variables, secretos ni funciones Edge.

Los avisos personales contienen solo el identificador propio y un contador. Siguen llegando cuando una expulsión o eliminación ya impide leer el contador de la casa, para retirar las vistas privadas sin recargar. Se cancelan las lecturas anteriores al cambiar el estado de acceso; cerrar sesión elimina todas las suscripciones. Las fotos se limpian por lotes y subcarpetas, con detección de fallos o falta de progreso. La finalización rechaza una casa si todavía tiene fotos registradas.

Las pruebas locales validan permisos, transferencias, salida, revocación de enlaces, aislamiento, eliminación de datos y conservación de cuentas/otras casas. El servicio de limpieza se prueba con más de 100 archivos, subcarpetas y errores. Playwright comprueba dos sesiones, retirada de acceso en directo y reanudación tras un fallo de Storage. Auth/Storage y WebSocket están simulados; la migración no se ha aplicado ni validado en el proyecto remoto.


### Perfil y apariencia

El nombre y avatar de la cabecera abren el perfil. Permite elegir la inicial o uno de 16 emojis, seis temas (blanco, azul, rojo, rosa, verde y amarillo) mediante botones circulares de color sin texto y un interruptor «Modo oscuro» junto a un sol. Activado usa modo oscuro; desactivado usa claro. Por defecto usa blanco y el modo del dispositivo. La selección se previsualiza; Cancelar o Escape restaura lo guardado. Un error al guardar conserva el borrador para reintentar.

Las preferencias se guardan por cuenta en `user_preferences`, con políticas RLS de lectura y escritura exclusivas del usuario. Son independientes de la casa. Se recuperan al iniciar sesión y al volver a la pestaña; el aspecto personal se retira al cerrar sesión. Cambiar el perfil requiere conexión; no existe caché local de preferencias.

**Nueva migración:** aplicar una sola vez `supabase/migrations/202611160003_profile_preferences.sql` después de las cinco anteriores, antes de fusionar/desplegar. No repetir migraciones ya aplicadas. No necesita nuevas variables, secretos ni funciones Edge. Esta migración no se ha ejecutado en el proyecto remoto.

Las pruebas locales verifican aislamiento entre cuentas, permisos anónimos, valores admitidos y borrado en cascada con la cuenta. También cubren contraste del texto en las doce combinaciones, previsualización, cancelación, errores y desconexión. Playwright comprueba persistencia tras recarga, modo del sistema, navegación por teclado, cierre de sesión y cuentas independientes en tamaños móvil y escritorio con Supabase simulado; no sustituye la validación en dispositivos reales.


## PWA y desconexión

La aplicación incorpora manifest, iconos normales/maskable y apple-touch-icon. En navegadores compatibles aparece **Instalar app**. En iPhone/iPad, ese botón muestra la ruta de Safari: Compartir → Añadir a pantalla de inicio. Se necesita HTTPS (localhost también permite probar el service worker). Cuando hay una versión nueva, aparece un diálogo con **Actualizar app** y **Más tarde**; Escape también lo pospone. Solo aceptar provoca la recarga. Si hay otro diálogo abierto, el aviso espera a que se cierre. Posponer conserva la edición y evita repetir el aviso de esa versión durante la sesión; las marcas pendientes se conservan al actualizar. No hay botón de actualización al pie.

Tras una visita online, el shell permite recargar sin conexión. IndexedDB guarda la carta, el catálogo y las semanas de menú/compra que se hayan consultado. No descarga otras semanas automáticamente. Las fotos y sus URLs firmadas no se guardan para uso offline; los textos e ingredientes siguen disponibles. Las preferencias del perfil siguen requiriendo conexión.

Se pueden marcar y desmarcar productos de una compra guardada. La interfaz muestra las marcas pendientes y los fallos; guardarlas localmente no significa que se hayan sincronizado. Al reconectar, volver a la pestaña o reintentar, se verifica la pertenencia y se envían las marcas. Sin conexión no se pueden crear/editar platos, menú, productos manuales, perfil o casas. Una semana no visitada muestra que no hay datos guardados.

Cada marca conserva su UUID de operación al reintentarse: si se pierde la respuesta después de confirmar el servidor, no vuelve a aplicar una marca antigua sobre otra posterior. Los recibos permanecen hasta borrar la casa o la cuenta. Las marcas de una identidad de producto eliminada se descartan, aunque se reintroduzca el mismo ingrediente. Entre marcas nuevas válidas prevalece la última aceptada por el servidor.

La caché y la cola se separan por cuenta, casa y generación de pertenencia (`membership_id`). Salir de la casa, perder acceso, iniciar su eliminación, cerrar sesión o cambiar de cuenta retira los datos privados; se comprueba también la pertenencia tras arrancar online. Reingresar en la misma casa no recupera pendientes de la pertenencia anterior. BroadcastChannel avisa a otras pestañas y Web Locks serializa los envíos. Sin Web Locks no se envían marcas y se muestra un error.

Cerrar sesión offline elimina la sesión de este dispositivo y sus datos locales. La identidad mínima guardada (identificador y nombre, sin credenciales nuevas) permite consultar la caché offline aunque el token de Auth necesite renovarse. Para enviar cambios se requiere una sesión de Supabase válida y pertenencia actual. Si IndexedDB no está disponible o se agota su espacio, se informa y no se da una marca por guardada.

**Nueva migración:** ejecutar una sola vez `supabase/migrations/202611160004_offline_shopping.sql`, después de las seis anteriores y antes de fusionar/desplegar. Añade la generación de pertenencia y `apply_shopping_mark`, con recibos privados y autorización transaccional. No repetir migraciones ya aplicadas. No necesita nuevas variables, secretos ni Edge Functions. No se ha ejecutado en el proyecto Supabase remoto.

```sh
npm test
npm run build
npm run test:e2e
npm run test:pwa
```

`test:pwa` compila con configuración ficticia de pruebas y sirve el build en un puerto aislado. Comprueba service worker, recarga offline con sesión caducada, persistencia de marcas, limpieza al cerrar sesión y ausencia de respuestas privadas en Cache Storage. También prueba una actualización real del service worker: aviso aplazado detrás del perfil, cancelación sin perder un borrador y recarga al aceptar. La suite se ejecuta en serie porque cambia temporalmente el worker del build. CI ejecuta ambas suites de navegador y guarda sus trazas si hay fallos. Genera de nuevo el build con tu configuración habitual si vas a desplegar después. Playwright usa Chromium con viewports móvil/escritorio y Auth/HTTP/WebSocket simulados; no acredita instalación real en Android/iPhone. Las pruebas SQL locales cubren también reintentos, permisos y pertenencias antiguas. Queda validar los servicios remotos y los dispositivos reales.


## Carta

La carta se actualiza automáticamente con Realtime, al recuperar la conexión y al volver a la pestaña; no hay botón Actualizar. Los errores de carga o de fotos conservan una opción específica para reintentar. El título y la descripción de cada tarjeta se superponen sobre una transparencia negra pegada al pie de la foto; los platos sin foto conservan un fondo ilustrado.

«Ver archivados» está al final de la carta y abre un diálogo independiente de los filtros activos. Cada plato tiene una opción Desarchivar; la operación requiere conexión y conserva la receta y sus referencias. Escape o la X cierran el diálogo y devuelven el foco al botón. Los archivados siguen disponibles en los menús existentes.

## Etiquetas y retirada de desayunos

Las recetas admiten etiquetas libres opcionales, sin categorías fijas de comida o cena. Escríbelas en Nueva etiqueta y confirma con Enter o +; Guardar plato también recoge el texto pendiente. Se sugieren etiquetas de la casa y se pueden quitar individualmente. Se normalizan los espacios y Unicode, se deduplican sin distinguir mayúsculas y se admiten hasta 20 etiquetas de 40 caracteres por receta. Las recetas sin etiquetas siguen siendo válidas.

La carta y el selector de platos del menú buscan por nombre y etiquetas, sin distinguir mayúsculas ni acentos; también permiten seleccionar varias etiquetas en una fila de texto deslizable. Los resultados deben tener todas las etiquetas seleccionadas. La selección se ilumina con el color del tema y «Limpiar filtros» la desactiva sin borrar la búsqueda. Las etiquetas no restringen los turnos de planificación: cualquier receta puede colocarse en comida o cena. No hay opción de añadir desayunos, ni en la interfaz ni en PostgreSQL.

**Nueva migración:** aplicar una vez `supabase/migrations/202611160005_recipe_tags.sql`, después de las siete anteriores y antes de desplegar. Conserva todas las recetas y sustituye las categorías antiguas por listas vacías de etiquetas. Elimina los desayunos ya planificados y sus alternativas, aumenta la revisión de las semanas afectadas y recalcula la compra. Mantiene los productos manuales y las marcas de los productos que sigan siendo necesarios. No borra platos, ingredientes ni fotos.

La migración sustituye la función de guardado para aceptar `p_tags`; mantiene permisos, revisiones, reparación de alternativas y recálculo transaccional de la compra. Los editores antiguos no pueden sobrescribir recetas con revisiones previas. No requiere nuevas variables ni secretos y no se ha aplicado en el proyecto remoto.

Al actualizar la app, IndexedDB pasa a versión 2 y retira los snapshots antiguos de carta, menú y compra. Conserva identidad, pertenencia y marcas pendientes. Abre la versión nueva online antes de volver a usarla offline; las marcas pendientes de productos retirados se descartarán al sincronizar y las demás se conservarán.


## Carta pública e ingredientes

En la ficha privada, **Publicar** comparte receta, foto, etiquetas, ingredientes y alternativas con usuarios que hayan iniciado sesión. Carta pública está al final de Carta; permite buscar, filtrar y cambiar entre lista/cuadrícula. Las recetas incorporadas aparecen atenuadas con «Ya la tienes» y siguen siendo consultables. Añadir es idempotente; Quitar de la carta archiva únicamente la incorporación de la casa, conservando sus menús. Restaurar recupera la misma incorporación actualizada.

Guardar una receta publicada en su casa autora actualiza la publicación, las incorporaciones activas y la compra en una transacción. Las receptoras no pueden editar ese contenido; sí elegir alternativas por aparición. Dejar de publicar, o iniciar la eliminación de la casa autora, conserva copias privadas editables y fotos en las casas receptoras, sin nuevas actualizaciones. Archivar la receta propia no la despublica. La casa autora puede gestionarla desde su ficha pública.

Perfil → **Ingredientes** permite buscar y editar nombre/kilocalorías de los ingredientes de la casa. Solo administradores pueden abrir el catálogo Público y corregirlo. Al incorporar se reutilizan los ingredientes privados coincidentes sin sobrescribir sus datos. Los ingredientes nuevos siguen las correcciones públicas mientras no se editen localmente ni se retire su última incorporación vinculada. No hay borrado ni fusión de ingredientes. Conflictos de revisión o nombres duplicados conservan el borrador.

**Preparación de esta entrega, antes de fusionar/desplegar:**

1. Aplicar una vez `supabase/migrations/202611170001_public_catalog.sql`, después de las ocho migraciones existentes. No repetir las anteriores. Mantiene recetas, menús y marcas; añade catálogo, permisos y el bucket privado `catalog-photos`.
2. Desplegar la Edge Function desde la raíz: `supabase functions deploy catalog-publication --project-ref hccniqsjbfzpjhywpcuz`. Su configuración verifica explícitamente cada JWT con Auth.getUser; la clave administrativa solo se usa dentro de Supabase. `SUPABASE_URL`, `SUPABASE_ANON_KEY` y `SUPABASE_SERVICE_ROLE_KEY` son variables del servidor suministradas por la plataforma; no añadir claves administrativas a Cloudflare/Vite.
3. Ejecutar manualmente `supabase/admin/grant_catalog_admin.sql` sustituyendo el marcador por el UUID de tu cuenta de Authentication → Users. El catálogo empieza sin administradores; los clientes no pueden asignarse el rol. Solo tu cuenta debe recibirlo inicialmente.

Las fotos se copian a un bucket **privado** antes de confirmar una publicación. Cada versión es inmutable; las recetas incorporadas conservan referencias autorizadas a esa versión. Al retirar la publicación, las fotos solo siguen accesibles a las casas que conservan una copia. Las URLs firmadas caducan a los 15 minutos. No se cachean fotos ni respuestas públicas autenticadas en Cache Storage; Carta pública requiere conexión y las incorporadas usan la caché privada existente.

La acción `cleanup` de la misma Edge Function elimina archivos huérfanos con más de 24 horas mediante Storage API y por lotes. Puede invocarla un administrador autenticado o un trabajo de servidor con la credencial administrativa; programa su ejecución diaria en tu infraestructura de Supabase si quieres limpieza automática. Los archivos se reclaman bajo bloqueo antes de borrarse y no se pueden publicar mientras se limpian. Los fallos permiten reintentar; nunca se borran filas de `storage.objects` por SQL. Las fotos referenciadas por publicaciones o copias privadas se conservan.

Comprobaciones: `npm test`, `npm run build`, `npm run test:e2e` y `npm run test:pwa`. La Edge Function también se verifica con `deno check --no-lock --config supabase/functions/catalog-publication/deno.json supabase/functions/catalog-publication/index.ts`. Las pruebas de PostgreSQL son locales (PGlite), las de Storage/Edge y navegador usan servicios simulados. Queda validar el despliegue real, permisos de Storage y dispositivos físicos. No se ha aplicado la migración, asignado administradores ni desplegado la función automáticamente.
