# home-menu
PWA instalable en Android y iPhone para crear una carta de platos caseros, planificar las comidas de la semana y generar una lista de la compra compartida por los miembros de cada casa. La aplicación se alojará en Cloudflare y usará Supabase para la base de datos, el almacenamiento de fotos y la autenticación.

## Carta de platos

Los usuarios podrán crear platos a mano y clasificarlos como **desayuno, comida o cena**. La carta mostrará los platos como tarjetas con nombre, foto y una descripción breve. Al pulsar una tarjeta, se abrirá la ficha del plato con la **foto, la descripción, los ingredientes y la receta**, en ese orden.

## Ingredientes y alternativas

Al crear una receta, el botón **+** debajo del título **Ingredientes** abrirá un desplegable con un buscador para reutilizar ingredientes ya registrados en la aplicación. La opción **Nuevo ingrediente** abrirá un formulario con el **nombre** como campo obligatorio y las **kilocalorías por cada 100 g** como campo opcional.

Algunos ingredientes de una receta podrán tener alternativas seleccionables manualmente. Por ejemplo, un plato con carne, pollo o pescado podrá ofrecer una versión vegetariana con **soja texturizada, seitán, tofu o garbanzos**, según la receta.

## Planificación semanal

Cada día tendrá un espacio para desayuno, comida y cena. Los usuarios podrán elegir platos de la carta y eliminar individualmente los que ya estén planificados. El botón **Sustituir** abrirá la carta para elegir otro plato y colocarlo en el mismo día y turno.

## Lista de la compra

La lista se generará a partir de los ingredientes de los platos planificados para la semana. Se actualizará automáticamente al añadir, eliminar o sustituir un plato y tendrá en cuenta las alternativas de ingredientes seleccionadas.

Cada ingrediente aparecerá una sola vez y se mostrará únicamente por su nombre. Al marcar su casilla, el ingrediente se tachará y pasará al desplegable **Comprados**, al final de la lista. Si se desmarca, volverá a la lista de pendientes.

## Casas y acceso

La aplicación admitirá varias casas. Cada casa podrá tener varios usuarios y cada usuario pertenecerá a una única casa. Los miembros compartirán la carta, la planificación semanal y la lista de la compra de su casa.

Tanto el registro como el inicio de sesión se harán con **Google** mediante Supabase Auth. En la primera versión, el registro quedará completado al entrar con Google, sin un correo de confirmación adicional.

## Navegación

Las vistas Carta, Semana, Compra y Casa se abren desde una barra inferior fija con cuatro iconos, sin texto visible: plato con cubiertos, calendario, carrito y casa. Conservan etiquetas para lectores de pantalla, foco de teclado y una marca de vista activa. La barra respeta el área segura del móvil y deja espacio para los controles al final de cada vista.

## Perfil y apariencia

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

La sección Carta permite crear y editar platos, filtrar por nombre y categoría, consultar la ficha y archivar/restaurar. El selector + reutiliza ingredientes del hogar y permite crearlos con kcal opcionales. Cada ingrediente admite alternativas del mismo catálogo. Las elecciones por día se incorporarán con la planificación semanal.

Las fotos son opcionales, privadas y de hasta 5 MB (JPEG, PNG o WebP). Se muestran mediante enlaces firmados de una hora; Actualizar renueva los enlaces. Editar una versión antigua de un plato falla conservando el borrador, para evitar sobrescribir cambios de otro miembro.

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

La pestaña Semana organiza de lunes a domingo los desayunos, comidas y cenas. Cada turno admite varios platos, incluso repetidos. Añadir y Sustituir abren la carta; el filtro empieza en el turno elegido y puede cambiarse a Todas. Quitar afecta solo a esa aparición.

En Ingredientes se eligen las alternativas de cada plato planificado sin cambiar la receta ni otras apariciones. Si una edición elimina una alternativa elegida, se vuelve al ingrediente original y se muestra un aviso para revisar la receta. Las recetas archivadas siguen visibles en menús existentes, pero no se ofrecen para añadir o sustituir.

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

La aplicación incorpora manifest, iconos normales/maskable y apple-touch-icon. En navegadores compatibles aparece **Instalar app**. En iPhone/iPad, ese botón muestra la ruta de Safari: Compartir → Añadir a pantalla de inicio. Se necesita HTTPS (localhost también permite probar el service worker). La actualización de una versión instalada ofrece **Actualizar app** y conserva las marcas pendientes.

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

`test:pwa` compila con configuración ficticia de pruebas y sirve el build en un puerto aislado. Comprueba service worker, recarga offline con sesión caducada, persistencia de marcas, limpieza al cerrar sesión y ausencia de respuestas privadas en Cache Storage. Genera de nuevo el build con tu configuración habitual si vas a desplegar después. Playwright usa Chromium con viewports móvil/escritorio y Auth/HTTP/WebSocket simulados; no acredita instalación real en Android/iPhone. Las pruebas SQL locales cubren también reintentos, permisos y pertenencias antiguas. Queda validar los servicios remotos y los dispositivos reales.
