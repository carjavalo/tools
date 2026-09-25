-- ============================================================================
--  Radicaciones: ÁMBITO (Ambulatorio / Hospitalario)
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_09_25_000001_add_ambito_to_radicar_caso_table
--
--  QUÉ HACE: agrega a `RadicarCaso` la columna `ambito`:
--    'ambulatorio'  → radicaciones de la pestaña Nueva Radicación
--    'hospitalario' → radicaciones de la pestaña Radicado Hospitalario
--                     (extrema prioridad: se ven en rojo en las grillas)
--  Todas las radicaciones que ya existen se hicieron desde Nueva Radicación,
--  así que quedan como 'ambulatorio'. Los consecutivos no cambian.
--
--  OJO: si se sube el código sin aplicar esto, Radicar Solicitud falla con
--  "Unknown column 'ambito'". Aplíquelo antes de subir el código, o junto.
--  Es seguro ejecutarlo más de una vez. No borra datos.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base de tools.huv.gov.co > pestaña SQL >
--       pegue todo el contenido y ejecute.
--    3. La verificación del final debe decir OK en las dos filas.
-- ============================================================================


-- PASO 1 -- Columna del ámbito. Se consulta antes para que no falle con
-- "Duplicate column" si ya existe.

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'RadicarCaso'
    AND `COLUMN_NAME` = 'ambito');
SET @sql := IF(@falta,
  'ALTER TABLE `RadicarCaso` ADD COLUMN `ambito` varchar(20) NOT NULL DEFAULT ''ambulatorio'' AFTER `sede`, ADD KEY `radicarcaso_ambito_index` (`ambito`)',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- PASO 2 -- Registrar la migración como ya aplicada, para que un futuro
-- "php artisan migrate" no intente repetirla. No duplica la fila.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_25_000001_add_ambito_to_radicar_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_25_000001_add_ambito_to_radicar_caso_table'
);


-- PASO 3 -- Verificación (una sola consulta: phpMyAdmin muestra la última).

SELECT 'RadicarCaso.ambito' AS `cambio`, IF(COUNT(*) = 1, 'OK', 'FALTA') AS `resultado`
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'RadicarCaso' AND `COLUMN_NAME` = 'ambito'
UNION ALL
SELECT 'migración registrada', IF(COUNT(*) = 1, 'OK', 'FALTA')
FROM `migrations`
WHERE `migration` = '2026_09_25_000001_add_ambito_to_radicar_caso_table';
