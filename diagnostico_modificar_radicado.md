# No fue posible modificar el radicado — diagnóstico en el servidor

Ese mensaje aparece cuando el servidor responde algo distinto de un error de
validación. El código fue verificado localmente reproduciendo exactamente lo
que hace el navegador (POST multipart con `_method=PUT`, copago y PDF
adjunto) y funciona, así que la causa está en el entorno del servidor.

Ejecuta los pasos **en orden**, dentro de la carpeta que contiene `artisan`.

## 1. Migraciones pendientes (la causa más probable)

Se agregaron columnas y tablas nuevas después del despliegue: `copago`,
`valor_copago` y `paquete` en `RadicarCaso`, y la tabla `trazabilidad_caso`.
Si el código está subido pero las migraciones no se corrieron, el formulario
se ve completo pero el guardado revienta contra la base.

```bash
php artisan migrate:status
```

Si aparece alguna en estado *Pending*:

```bash
php artisan migrate --force
```

Comprobación directa, por si prefieres verlo en phpMyAdmin (pestaña SQL):

```sql
SHOW COLUMNS FROM `RadicarCaso` LIKE 'copago';
SHOW COLUMNS FROM `RadicarCaso` LIKE 'valor_copago';
SHOW COLUMNS FROM `RadicarCaso` LIKE 'paquete';
SHOW TABLES LIKE 'trazabilidad_caso';
```

Las cuatro consultas deben devolver una fila. Si alguna sale vacía, falta
correr las migraciones.

## 2. El error exacto en el log

```bash
tail -n 60 storage/logs/laravel.log
```

La primera línea del último bloque dice la causa real. Las típicas:

- `Column not found: 1054 Unknown column 'copago'` → es el paso 1.
- `Base table or view not found: ... trazabilidad_caso` → es el paso 1.
- `Permission denied` sobre `storage/` → paso 4.

## 3. Límites de subida de PHP

El paquete admite PDF de hasta 30 MB, pero si PHP acepta menos, descarta el
envío completo antes de que Laravel lo vea y la sesión se pierde.

```bash
php -r "echo 'upload_max_filesize='.ini_get('upload_max_filesize').PHP_EOL.'post_max_size='.ini_get('post_max_size').PHP_EOL;"
```

Ambos deben ser **32M o más**. Se cambian en cPanel → *Seleccionar versión de
PHP* → *Options*. Ojo: el valor del terminal puede diferir del que usa la web;
lo que manda es el de la web.

## 4. Permisos y enlace de almacenamiento

```bash
php artisan storage:link
chmod -R 775 storage bootstrap/cache
```

## 5. Caché de configuración y rutas

La ruta para ver el PDF es nueva; con las rutas cacheadas no existe.

```bash
php artisan optimize:clear
```

## Después de cualquier cambio

Recarga la vista con **Ctrl+F5**. El modal ahora muestra el motivo concreto
del fallo (sesión expirada, archivo muy grande, error 500 con su mensaje) en
lugar del texto genérico, así que si vuelve a fallar, ese texto dice qué pasó.
