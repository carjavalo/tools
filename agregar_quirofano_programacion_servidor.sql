-- ============================================================================
--  Quirófano en la programación de cirugía
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor (cPanel).
--
--  Migración que reemplaza:
--    2026_10_01_000002_add_quirofano_id_to_programacion_caso_table
--
--  QUÉ HACE: agrega a `programacion_caso` la columna `quirofano_id`, con el
--  quirófano (tabla `quirofanoQx`) donde se atenderá la cirugía. Lo diligencia
--  el formulario Aplicar Modificaciones (Historial) al programar, y se ve y se
--  filtra en la grilla "Ver programados".
--
--  REQUISITO: antes debe existir la tabla `quirofanoQx`
--  (script crear_tabla_quirofanoqx_servidor.sql).
--
--  OJO: el código nuevo consulta esta columna. Aplíquelo antes de subir el
--  código, o junto: sin ella, "Ver programados" falla con "Unknown column".
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
--    3. Si el PASO 1 responde "Duplicate column name 'quirofano_id'", la
--       columna ya existía: ejecute el script desde el PASO 2.
-- ============================================================================


-- PASO 1 -- Quirófano de cada programación. Opcional: las programaciones
-- anteriores quedan sin quirófano.

ALTER TABLE `programacion_caso`
  ADD COLUMN `quirofano_id` int UNSIGNED NULL DEFAULT NULL AFTER `especialista_medico_id`,
  ADD KEY `programacion_caso_quirofano_id_index` (`quirofano_id`);


-- PASO 2 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarla otra vez y
-- fallará. El NOT EXISTS evita duplicar la fila si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_01_000002_add_quirofano_id_to_programacion_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_10_01_000002_add_quirofano_id_to_programacion_caso_table'
);


-- PASO 3 -- Verificación: debe aparecer la columna quirofano_id.

SHOW COLUMNS FROM `programacion_caso` LIKE 'quirofano_id';
