# Especificación de Home Menu

## Estado y objetivo

Documento para implementar una PWA móvil en español que permita a varios hogares independientes compartir platos, planificar la semana y comprar sus ingredientes. Actualmente existe una base React con portada, acceso Google, sesión y pruebas de cliente. Casas, invitaciones y demás funciones están pendientes; la fase 1 aún no está completa.

El README actualizado desde `main` es la referencia funcional más reciente. Sustituye estas decisiones de la conversación inicial: el menú incluye desayuno, la compra muestra nombres sin cantidades y la primera versión incorpora alternativas, kilocalorías opcionales y personalización visual. No se debe implementar la suma de cantidades del plan anterior.

## Experiencia de usuario

Interfaz cálida, sencilla, accesible y pensada para móviles. Navegación principal entre carta, semana y compra. Mostrar estados de carga, vacío, error y conexión sin ocultar fallos de sincronización. Controles cómodos al cocinar y comprar, etiquetas accesibles y foco visible; no comunicar estados solo mediante color.

### Acceso y casas

- Registro e inicio de sesión exclusivamente con Google mediante Supabase Auth, sin confirmación adicional por correo.
- Cada usuario pertenece como máximo a una casa. Tras acceder, puede crear una o aceptar una invitación.
- Cada casa tiene un propietario. Todos los miembros pueden editar platos, menú y compra; solo el propietario administra miembros e invitaciones.
- Invitaciones mediante enlaces revocables con caducidad de siete días. Su aceptación requiere autenticación y confirmación. No incluir tokens en registros de diagnóstico.
- Un usuario que ya pertenece a otra casa debe abandonarla antes de aceptar. La aceptación debe ser atómica para impedir pertenencias simultáneas.
- El propietario puede expulsar miembros y transferir la propiedad. Los miembros pueden salir; el propietario debe transferir antes de salir o eliminar la casa con confirmación explícita.
- Perder la pertenencia elimina el acceso a datos, fotos, suscripciones y cachés locales de esa casa.

### Carta de platos

- Alta manual de platos con nombre, descripción breve, foto opcional, ingredientes y receta. Clasificación en desayuno, comida o cena; permitir varias categorías para un plato reutilizable.
- Tarjetas con nombre, foto y descripción. La ficha presenta foto, descripción, ingredientes y receta, en ese orden; omitir la foto cuando no exista.
- Buscar platos por nombre y filtrar por categoría. No es obligatorio introducir etiquetas, tiempos ni raciones para esta primera versión.
- Archivar platos los retira de nuevas selecciones, conservando referencias desde menús existentes.
- Las fotos son privadas de la casa; validar formato y tamaño tanto en la interfaz como en almacenamiento. Para v1: JPEG, PNG o WebP y máximo 5 MB.

### Ingredientes y alternativas

- El botón + bajo Ingredientes abre un desplegable con buscador para reutilizar ingredientes de la casa.
- Nuevo ingrediente solicita nombre obligatorio y kilocalorías por 100 g opcionales, numéricas y no negativas. No calcular nutrición de platos en v1.
- Catálogo privado de cada casa: reutilizar identidades de ingredientes y evitar duplicados por nombre normalizado (espacios exteriores y mayúsculas). No fusionar automáticamente sinónimos.
- Cada ingrediente de una receta puede ofrecer alternativas manuales que referencian el mismo catálogo. Ejemplos: soja texturizada, seitán, tofu o garbanzos.
- Por defecto se usa el ingrediente original. Elegir una alternativa para un plato planificado afecta solo a esa aparición; no modifica la receta ni otros días.
- Los ingredientes siguen siendo necesarios aunque no tengan cantidades. No introducir conversiones de unidades, cálculos de raciones ni cantidades compradas en v1.

### Semana

- Semana de lunes a domingo, identificada por su fecha de lunes, sin convertir fechas de calendario a instantes UTC.
- Cada día tiene desayuno, comida y cena, con varios platos por turno. Se permiten apariciones repetidas de un mismo plato.
- Añadir, eliminar individualmente y sustituir platos. Sustituir abre la carta y conserva día y turno; reinicia alternativas a las de la nueva receta.
- Navegar entre semanas y copiar otra semana. Confirmar antes de sobrescribir una semana con platos.
- La copia replica platos y alternativas válidas; no copia estados de compra ni productos manuales.
- Las ediciones de ingredientes de una receta afectan a sus apariciones planificadas y recalculan las semanas afectadas. Si desaparece una alternativa elegida, volver al ingrediente original y comunicar el cambio.

### Compra

- Una lista compartida por casa y semana, derivada de los platos y sus alternativas seleccionadas.
- Cada ingrediente aparece una sola vez, identificado por su entrada del catálogo, y muestra únicamente el nombre. La interfaz no muestra cantidades ni kilocalorías.
- Añadir, eliminar, sustituir o modificar ingredientes de platos planificados actualiza la lista automáticamente.
- Marcar tacha el nombre y mueve el producto a Comprados, un desplegable al final. Desmarcar lo devuelve a pendientes.
- Conservar el estado comprado mientras el ingrediente siga siendo necesario, aunque aumenten sus apariciones: al no registrar cantidades, no aplicar la antigua regla de desmarcar por aumento de cantidad.
- Si un ingrediente deja de ser necesario, retirarlo de la lista; si se añade de nuevo, empieza pendiente. No resucitar marcas antiguas.
- Permitir productos manuales semanales reutilizando el catálogo; si coinciden con un ingrediente del menú se muestran una sola vez. Quitar su aportación manual no elimina una necesidad del menú.
- Los productos manuales no se arrastran automáticamente a otra semana.

### Perfil y apariencia

- Nombre y avatar en la esquina superior derecha; pulsar abre el perfil.
- Nombre inicial obtenido de Google y opción para elegir un emoji como avatar personal.
- Modo claro u oscuro y tema blanco, azul, rojo, rosa, verde o amarillo, cada uno con ambas variantes.
- Persistir preferencias por usuario, aplicarlas entre sesiones y mantener contraste legible en todas las combinaciones. Predeterminado: tema blanco y modo del sistema hasta que el usuario elija claro u oscuro.

### Instalación y desconexión

- PWA instalable en Android y iPhone, con manifest e iconos adecuados.
- Sin conexión: consultar los últimos datos disponibles y marcar o desmarcar compras. Crear o editar platos, menú, perfil y hogar requiere conexión.
- Guardar marcas pendientes localmente e indicar su estado. Sincronizarlas al reconectar con operaciones idempotentes.
- Asociar cada marca a la generación vigente del producto semanal: rechazar marcas de un producto eliminado y añadido de nuevo. Ante escrituras concurrentes válidas, prevalece la última aceptada por el servidor.
- Verificar pertenencia antes de enviar pendientes; nunca restaurar datos de una casa abandonada. Limpiar datos privados locales y colas al cerrar sesión.

## Arquitectura e interfaces

- Cliente: React, TypeScript estricto, Vite y Tailwind CSS; alojamiento estático en Cloudflare Pages con rutas de SPA.
- Supabase: Google Auth, PostgreSQL, Storage privado y Realtime. No se requiere un servidor general de aplicación ni Cloudflare Workers inicialmente.
- Service worker para recursos de la aplicación; IndexedDB para datos privados consultables y operaciones pendientes. No cachear indiscriminadamente respuestas autenticadas mediante el service worker.
- Dominios del modelo: perfiles y preferencias, casas y miembros, invitaciones, catálogo de ingredientes, platos y sus ingredientes/alternativas, apariciones semanales y elecciones, aportaciones manuales y estados de compra.
- Todas las entidades de casa deben llevar o derivar una pertenencia verificable. Restricciones de base de datos garantizan una sola casa por usuario y un propietario válido.
- Políticas RLS y políticas Storage impiden acceso entre casas, incluso con peticiones directas. Realtime respeta esos permisos.
- Funciones transaccionales para aceptar invitaciones, transferir propiedad, eliminar casas y reconciliar lista y marcas. No confiar en una secuencia de escrituras del navegador para mantener invariantes.
- Reconciliar compra en el servidor dentro de las operaciones que afectan a menú, alternativas e ingredientes; Realtime notifica a los clientes para recargar las consultas afectadas.
- Migraciones versionadas y pruebas de autorización desde el inicio; nombres exactos de tablas y funciones se fijarán en esas migraciones, respetando este contrato.
- Variables públicas previstas: VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. La clave pública requiere RLS; ninguna clave administrativa, secreto OAuth ni credencial real entra en el cliente o repositorio.
- Documentar la configuración de Google OAuth, URLs de retorno autorizadas, dominios y despliegues al introducir los servicios reales. Separar desarrollo y producción; no permitir redirecciones arbitrarias de invitaciones.

## Entregas y aceptación

1. **Base y acceso:** crear el proyecto, herramientas, migraciones, Google Auth, casas e invitaciones. Comprobar acceso real, aceptación concurrente y aislamiento entre dos casas.
2. **Carta:** CRUD, catálogo, alternativas, fotos y archivo. Comprobar búsqueda, orden de ficha, permisos de fotos y acceso a platos archivados desde menús.
3. **Semana:** tres turnos, varios platos, sustitución, alternativas por aparición y copia. Comprobar semanas que cruzan mes/año y confirmación al sobrescribir.
4. **Compra:** derivación transaccional, productos manuales, Comprados y Realtime. Comprobar deduplicación, alternativa elegida, retirar/reintroducir ingredientes y colaboración entre dos miembros.
5. **Perfil y PWA:** emoji, doce combinaciones de tema/modo, instalación y caché/cola offline. Comprobar reconexión, invalidación de pendientes antiguos y limpieza al cerrar sesión o perder pertenencia.

En cada entrega: análisis de tipos, build y pruebas pertinentes. Usar Vitest para lógica, Testing Library para interfaz y Playwright para flujos completos. Probar RLS y funciones contra una instancia Supabase de desarrollo con migraciones aplicadas, incluyendo peticiones no autorizadas directas.

El recorrido integral de aceptación es: acceder con Google, crear una casa, invitar a otro miembro, crear un plato con alternativa, planificarlo, sustituirlo, comprobar compra compartida, marcar offline y reconectar. Distinguir pruebas automatizadas de instalación y uso verificados en dispositivos reales Android/iPhone. Una prueba omitida o pendiente de credenciales no cuenta como aprobada.

## Límites y supuestos

Registro abierto con Google y contenido privado por casa. Sin panel global, IA, importación web, nutrición calculada, despensa, pagos, notificaciones push ni recetario público. Las kilocalorías opcionales son metadatos del ingrediente, no una función de nutrición.

No mezclar datos de ejemplo con datos reales. La eliminación de una casa incluye sus datos y fotos; no elimina automáticamente las cuentas Google/Supabase de sus miembros. La gestión de borrado de cuenta y las políticas legales deberán definirse antes de un lanzamiento público; no confundir la validación de desarrollo con aprobación de ese lanzamiento.

Los comandos de instalación, desarrollo y comprobación de la base están documentados en README. El acceso real necesita configuración de Supabase; las pruebas de cliente no sustituyen esa validación.
