# Instrucciones para agentes

## Referencias y alcance

Lee README.md y docs/ESPECIFICACION.md antes de modificar comportamiento. El README obtenido de main incorpora requisitos posteriores al plan inicial: desayuno, alternativas, compra por nombres y perfil/temas. La especificación integra esos cambios; no recuperes reglas antiguas de cantidades o de solo comida/cena.

Existen acceso Google, casas, invitaciones y carta de platos con ingredientes, alternativas, fotos y archivo. Existe menú semanal con alternativas por aparición y copia entre semanas. Existe compra automática por semana con productos manuales, Comprados y sincronización Realtime por casa. La gestión avanzada de miembros, perfil y funcionamiento offline siguen pendientes. Comprueba los scripts de package.json y mantén la documentación sincronizada con cada entrega.

## Forma de trabajar

- Usa el checkout existente: cada tarea cloud ya está aislada. No crees worktrees salvo petición explícita.
- Inspecciona instrucciones, archivos y estado Git antes de editar. Preserva cambios del usuario; evita resets, limpiezas y reescrituras destructivas.
- Resuelve detalles técnicos con autonomía dentro de lo documentado. Consulta nuevas decisiones de producto o ampliaciones de alcance; no solicites aprobación para cada paso rutinario.
- Entrega bloques pequeños y completos con sus comprobaciones. Sigue las fases de la especificación cuando la tarea no determine otra prioridad.
- No despliegues, publiques ni modifiques producción sin petición explícita. Crear una migración local no autoriza aplicarla en producción.

## Diseño

- Interfaz estética y contenida: tipografía cuidada, tarjetas, color y espaciado; sin textos promocionales ni relleno. Único eslogan permitido: «Olvida el 'qué comemos'». Usa etiquetas y mensajes breves.

## Implementación

- React, TypeScript estricto, Vite y Tailwind; Cloudflare Pages y Supabase. Prefiere herramientas y scripts ya presentes; utiliza el lockfile y no mezcles gestores.
- Diseña primero para móvil, en español, con HTML semántico, etiquetas, foco visible, navegación por teclado y contraste en todos los temas.
- Mantén identidad de ingredientes y deduplicación por catálogo. La compra muestra nombres, sin sumar cantidades; las alternativas pertenecen a cada aparición planificada.
- Mantén fechas semanales como fechas de calendario y contempla cambios de mes/año.
- Versiona migraciones y comprueba RLS, políticas de fotos e invariantes de casa junto a cada cambio de datos. Las operaciones críticas son transaccionales e idempotentes cuando proceda.
- No uses permisos de la interfaz como sustituto de autorización en el servidor.
- No incluyas secretos ni datos privados en código, fixtures o registros. Usa ejemplos sin valores reales; nunca expongas claves administrativas en el cliente.
- La compra se reconcilia en el servidor dentro de la transacción del menú/receta. Conserva las marcas mientras el producto siga siendo necesario; eliminarlo y reintroducirlo crea otra identidad y rechaza marcas antiguas.
- Realtime publica únicamente el contador household_changes bajo RLS. Aplaza las recargas durante la edición y conserva la revisión original del borrador.
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
