# Deploy estable

Checklist gratis para dejar la web lista para un restaurante sin cambiar la arquitectura.

## Backend

- Configurar estas variables en Render:
  - `MONGO_URI`
  - `ADMIN_PASSWORD`
  - `ADMIN_TOKEN_SECRET`
  - `FRONTEND_ORIGIN`
- Usar `/health` como URL de monitoreo.
- Crear un monitor gratis en UptimeRobot o Better Stack apuntando a:
  - `https://tu-api.onrender.com/health`
- Si el backend esta en plan gratis, puede dormir. El monitor ayuda a detectar caidas, pero no elimina por completo el primer arranque lento.

## Frontend

- Configurar dominio propio en Vercel cuando el restaurante lo tenga.
- Revisar que el admin use la API correcta antes de entregar.
- Probar un pedido completo desde celular despues de cada deploy.

## Base de datos

- No subir `.env` al repositorio.
- Activar backups si el plan de MongoDB Atlas lo permite.
- Antes de entregar a un cliente, exportar productos y configuracion como respaldo inicial.

## Seguridad

- Rotar `MONGO_URI`, `ADMIN_PASSWORD` y `ADMIN_TOKEN_SECRET` si alguna vez estuvieron en GitHub.
- Usar una contrasena de admin distinta para cada restaurante.
- Guardar las credenciales finales en Render/Vercel, no en archivos del proyecto.

## Prueba rapida antes de vender

1. Abrir `/health` y confirmar `ok: true`.
2. Entrar al admin.
3. Cambiar estado abierto/cerrado y verificar la web.
4. Crear un producto de prueba y ocultarlo.
5. Hacer un pedido desde celular.
6. Confirmar que aparece en admin y descuenta stock.
