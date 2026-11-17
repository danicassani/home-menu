# Instrucciones para agentes

## Referencias y alcance

Lee README.md y docs/ESPECIFICACION.md antes de modificar comportamiento. La planificación incluye solo comida y cena. Las recetas tienen etiquetas libres opcionales, independientes del turno; no recuperes categorías fijas ni desayunos. La compra muestra nombres sin cantidades y admite alternativas.

Existen acceso Google, casas, invitaciones y carta de platos con ingredientes, alternativas, fotos y archivo. Existe menú semanal con alternativas por aparición y copia entre semanas. Existe compra automática por semana con productos manuales, Comprados y sincronización Realtime por casa. Hay gestión de miembros, transferencia, salida y eliminación reanudable de casas. Existe perfil personal con avatar emoji, seis temas y modo claro/oscuro/sistema persistidos bajo RLS. Existe shell PWA instalable y consulta offline de carta, semanas y compra visitadas. Las marcas de compra se guardan en IndexedDB y se sincronizan con recibos idempotentes. Queda validar instalación y uso en dispositivos reales y Supabase remoto. Comprueba los scripts de package.json y mantén la documentación sincronizada con cada entrega.

## Forma de trabajar

- Usa el checkout existente: cada tarea cloud ya está aislada. No crees worktrees salvo petición explícita.
- Inspecciona instrucciones, archivos y estado Git antes de editar. Preserva cambios del usuario; evita resets, limpiezas y reescrituras destructivas.
- Resuelve detalles técnicos con autonomía dentro de lo documentado. Consulta nuevas decisiones de producto o ampliaciones de alcance; no solicites aprobación para cada paso rutinario.
- Entrega bloques pequeños y completos con sus comprobaciones. Sigue las fases de la especificación cuando la tarea no determine otra prioridad.
- No despliegues, publiques ni modifiques producción sin petición explícita. Crear una migración local no autoriza aplicarla en producción.

## Diseño

- Interfaz estética y contenida: tipografía cuidada, tarjetas, color y espaciado; sin textos promocionales ni relleno. Único eslogan permitido: «Olvida el 'qué comemos'». Usa etiquetas y mensajes breves.

- Presenta el contenido sobre el fondo, sin panel exterior ni separador bajo la cabecera. Conserva las tarjetas de platos y días. Las actualizaciones se avisan mediante diálogo con Actualizar app y Más tarde, esperando si otro diálogo está abierto; nunca recargues sin aceptar.

- Navegación entre Carta, Semana, Compra y Casa en una barra inferior fija de cuatro iconos sin texto visible. Mantén etiquetas accesibles, foco, selección y espacio para que la barra no tape controles ni áreas seguras del móvil.

- El cierre de sesión solo aparece dentro del perfil; la X del diálogo no cierra sesión. Conserva el acceso al perfil incluso cuando cargan o fallan sus preferencias.
- Fotos: selector con icono de cámara y encuadre ajustable antes de subir. Cancelar conserva la foto anterior; nunca subas el original al confirmar el encuadre. Ingredientes: alternativa y borrador para quitar en la misma fila.

- El saludo «Hola, nombre» se muestra pequeño junto al avatar del perfil, también en móvil. El estado de sincronización aparece bajo Home Menu: «Online» al estar suscrito, manteniendo los estados de conexión, reconexión y sin conexión. No hay separador entre cabecera y contenido.

- Carta: sin botón Actualizar; conservar actualización automática y reintentos ante errores. Ver archivados al pie abre un diálogo con Desarchivar. En las tarjetas, título y descripción sobre una transparencia negra al pie de la foto. Los filtros de etiquetas son una fila deslizable con selección múltiple (exigir todas), resaltado del tema y Limpiar filtros; compartirlos con el selector del menú.

## Implementación

- Semana muestra tarjetas con foto panorámica de menor altura y título sobre una transparencia negra al pie. Sustituir (flechas circulares) y Quitar (papelera) son iconos en la esquina superior derecha. Los ingredientes no aparecen en la tarjeta: pulsar la foto o el título abre un diálogo con las alternativas de esa aparición; mantiene los bloqueos offline y los avisos si la receta cambia.

- Carta ofrece dos iconos del color del tema para elegir lista (un plato por fila) o cuadrícula (dos por fila, también en móvil). La selección se conserva en este navegador, sin datos personales. La cabecera y el espacio superior del contenido son compactos.

- React, TypeScript estricto, Vite y Tailwind; Cloudflare Pages y Supabase. Prefiere herramientas y scripts ya presentes; utiliza el lockfile y no mezcles gestores.
- Diseña primero para móvil, en español, con HTML semántico, etiquetas, foco visible, navegación por teclado y contraste en todos los temas.
- Normaliza etiquetas (NFC y espacios), deduplica sin distinguir mayúsculas y valida un máximo de 20 etiquetas de 40 caracteres Unicode por receta, también en PostgreSQL. Las categorías antiguas no se convierten en etiquetas.
- Mantén identidad de ingredientes y deduplicación por catálogo. La compra muestra nombres, sin sumar cantidades; las alternativas pertenecen a cada aparición planificada.
- Mantén fechas semanales como fechas de calendario y contempla cambios de mes/año.
- Versiona migraciones y comprueba RLS, políticas de fotos e invariantes de casa junto a cada cambio de datos. Las operaciones críticas son transaccionales e idempotentes cuando proceda.
- No uses permisos de la interfaz como sustituto de autorización en el servidor.
- No incluyas secretos ni datos privados en código, fixtures o registros. Usa ejemplos sin valores reales; nunca expongas claves administrativas en el cliente.
- La compra se reconcilia en el servidor dentro de la transacción del menú/receta. Conserva las marcas mientras el producto siga siendo necesario; eliminarlo y reintroducirlo crea otra identidad y rechaza marcas antiguas.
- Realtime publica contadores household_changes y user_household_changes bajo RLS; los avisos personales permiten retirar vistas cuando se pierde pertenencia. Aplaza las recargas durante la edición y conserva la revisión original del borrador.
- Eliminar una casa exige confirmar su nombre. Bloquea el acceso antes de limpiar fotos por Storage API y elimina los datos solo al terminar; permite reanudar. Nunca borres archivos modificando storage.objects mediante SQL.
- Vincula la caché y las marcas a usuario, casa y `membership_id`; una nueva pertenencia a la misma casa no recupera datos ni pendientes antiguos. Usa Web Locks para serializar envíos entre pestañas y conserva el UUID de operación al reintentar. Los recibos de compra no se eliminan al retirar productos.
- El service worker solo precachea recursos públicos del build; las respuestas autenticadas, fotos y URLs firmadas nunca entran en Cache Storage.
- Separa cachés privadas por usuario/casa; limpia cachés y pendientes al cerrar sesión o perder acceso. No des por sincronizada una operación solo por haberla guardado localmente.

## Comprobaciones y comunicación

- Al crear la base ejecutable, registra en README comandos reales de instalación, desarrollo, tipos, build y pruebas. Ejecuta los comandos desde su directorio documentado.
- Comprueba tipos y build cuando afecte al cliente, pruebas de comportamiento para cambios funcionales y pruebas de políticas para cambios de acceso/datos.
- Herramientas previstas: Vitest, Testing Library y Playwright; pruebas de base de datos contra Supabase de desarrollo. No ejecutes pruebas destructivas contra producción.
- Incluye casos negativos: otra casa, usuario sin sesión, invitación caducada, pérdida de conexión y marcas offline obsoletas.
- No añadas pruebas triviales para cambios de documentación. Verifica enlaces, coherencia y git diff --check.
- Conserva los fallos visibles: no desactives aserciones ni verificación TLS para conseguir resultados verdes.
- Informa de qué cambió, qué se verificó y qué quedó pendiente. Distingue pruebas ejecutadas, omitidas y fallidas; no afirmes compatibilidad móvil real solo por usar un viewport de navegador.

## Entrega mediante Pull Request

- Tras cada implementación completada, crea una rama, guarda los cambios en commits y abre un Pull Request contra main. Si la entrega ya tiene un PR abierto, actualízalo en lugar de duplicarlo. Incluye el enlace al PR en la respuesta final; no lo fusiones automáticamente.
- Describe el resultado, las comprobaciones y las limitaciones. Si no puedes abrir el PR por un problema de acceso, informa del bloqueo sin afirmar que se ha creado.
- Cuando haya migraciones de Supabase, incluye en el PR y en la respuesta final un enlace de GitHub a cada archivo de migración y un enlace al SQL Editor del proyecto: https://supabase.com/dashboard/project/<project-ref>/sql/new.
- Obtén el identificador del proyecto de la configuración disponible sin mostrar secretos. Si no está configurado, no inventes el enlace: indica que falta e incluye https://supabase.com/dashboard como punto de acceso.
- Abrir el PR o enlazar una migración no autoriza ejecutarla en producción.
