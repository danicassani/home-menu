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

## Perfil y apariencia

El nombre del usuario y su avatar aparecerán en la esquina superior derecha. Al pulsar el avatar se abrirá el perfil, donde cada usuario podrá elegir un **emoji como avatar**, cambiar entre **modo claro y oscuro** y seleccionar un tema de color. Los temas disponibles serán **blanco, azul, rojo, rosa, verde y amarillo**, cada uno con su variante clara y oscura.

## Documentación y desarrollo

- [Especificación funcional, arquitectura y fases](docs/ESPECIFICACION.md).
- [Instrucciones para agentes](AGENTS.md).

La base técnica prevista es React con TypeScript, Vite y Tailwind CSS en Cloudflare Pages, con Supabase para autenticación, datos, fotos privadas y sincronización. La interfaz será móvil y estará en español.

El repositorio contiene una base ejecutable de acceso; la gestión de hogares y las funciones de planificación siguen pendientes. Consulta los comandos y limitaciones más abajo.

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

**Estado de esta entrega:** portada móvil, restauración de sesión, entrada con Google y cierre de sesión. Todavía no incluye casas, invitaciones, carta, menú, compra ni instalación PWA. No requiere migraciones SQL. Las pruebas de acceso usan un cliente simulado; la validación real de Google requiere configurar Supabase.
