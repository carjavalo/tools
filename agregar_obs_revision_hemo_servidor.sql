-- ============================================================================
--  Observaciones de Revisión Clínica Hemodinamia
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor (cPanel).
--
--  Migración que reemplaza:
--    2026_10_05_000002_add_obs_revision_hemo_to_radicar_caso_table
--
--  QUÉ HACE: agrega a `RadicarCaso` la columna `obs_revision_hemo`. La llena
--  el formulario Aplicar Modificaciones (Historial) Hemo cuando el Estado QX
--  es "Revisión Clínica Hemodinamia". Las observaciones se acumulan: cada una
--  se agrega al final, firmada con el nombre de quien la escribe y la fecha.
--
--  OJO: aplíquelo antes de subir el código, o junto: sin la columna, el
--  Historial falla al consultar un caso ("Unknown column").
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base.
--    2. phpMyAdmin > base (uoxclxvl_tools) > pestaña SQL > pegue y ejecute.
--    3. Si el PASO 1 responde "Duplicate column name 'obs_revision_hemo'", la
--       columna ya existía: ejecute el script desde el PASO 2.
-- ============================================================================


-- PASO 1 -- Columna del acumulado.

ALTER TABLE `RadicarCaso`
  ADD COLUMN `obs_revision_hemo` text NULL DEFAULT NULL;


-- PASO 2 -- Registrar la migración como ya aplicada.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_05_000002_add_obs_revision_hemo_to_radicar_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_10_05_000002_add_obs_revision_hemo_to_radicar_caso_table'
);


-- PASO 3 -- Verificación: debe aparecer la columna.

SHOW COLUMNS FROM `RadicarCaso` LIKE 'obs_revision_hemo';
