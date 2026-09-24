-- ============================================================================
--  Nueva Radicación: campo "Servicio Asignado"
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_09_24_000002_add_codservicio_to_radicar_caso_table
--
--  QUÉ HACE: agrega a `RadicarCaso` la columna `codservicio`, con el código
--  del servicio (tabla `serasignado`, Gestión Servicios) al que se asigna la
--  radicación. Las radicaciones que ya existen quedan sin servicio (NULL);
--  las nuevas lo exigen desde el formulario.
--
--  ANTES: la tabla `serasignado` debe existir con sus columnas `sede` y
--  `estado` (script crear_tabla_serasignado_servidor.sql).
--
--  OJO: si se sube el código sin aplicar esto, Nueva Radicación falla al
--  radicar con "Unknown column 'codservicio'". Aplíquelo antes de subir el
--  código, o junto. Es seguro ejecutarlo más de una vez.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base > pestaña SQL > pegue todo el
--       contenido y ejecute.
-- ============================================================================


-- PASO 1 -- Columna del servicio asignado. Se consulta antes para que no
-- falle con "Duplicate column" si ya existe.

SET @falta := (
  SELECT COUNT(*) = 0
  FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'RadicarCaso'
    AND `COLUMN_NAME` = 'codservicio'
);

SET @sql := IF(@falta,
  'ALTER TABLE `RadicarCaso` ADD COLUMN `codservicio` int(10) unsigned NULL DEFAULT NULL AFTER `sede`, ADD KEY `radicarcaso_codservicio_index` (`codservicio`)',
  'SELECT 1'
);

PREPARE agregar_codservicio FROM @sql;
EXECUTE agregar_codservicio;
DEALLOCATE PREPARE agregar_codservicio;


-- PASO 2 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarla otra vez y
-- fallará. El NOT EXISTS evita duplicar la fila si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_24_000002_add_codservicio_to_radicar_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_24_000002_add_codservicio_to_radicar_caso_table'
);


-- PASO 3 -- Verificación: debe aparecer codservicio, int(10) unsigned.

SELECT `COLUMN_NAME`, `COLUMN_TYPE`, `IS_NULLABLE`
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE()
  AND `TABLE_NAME` = 'RadicarCaso'
  AND `COLUMN_NAME` = 'codservicio';
