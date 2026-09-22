-- ============================================================================
--  Grilla "Ver programados" separada para Hemodinamia
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_09_22_000001_add_codestsecundario_to_programacion_caso_table
--
--  POR QUÉ: el formulario "Aplicar Modificaciones (Historial) Hemo" programa
--  con el Estado QX "Programado x Hemodinamia" y tiene su propio botón "Ver
--  programados", que debe mostrar solo esas programaciones. Para separarlas,
--  cada programación guarda ahora el Estado QX con el que se registró.
--
--  OJO: el código nuevo consulta la columna `codestsecundario` de
--  `programacion_caso`. Si se sube el código sin aplicar esto, "Ver
--  programados" y "Aplicar Modificaciones" fallan con "Unknown column".
--  Aplíquelo antes de subir el código, o junto.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
--    3. Si el PASO 1 responde "Duplicate column name 'codestsecundario'", la
--       columna ya existía: ejecute el script desde el PASO 2.
-- ============================================================================


-- PASO 1 -- Estado QX de cada programación.

ALTER TABLE `programacion_caso`
  ADD COLUMN `codestsecundario` varchar(5) NULL DEFAULT NULL AFTER `codrad`,
  ADD KEY `programacion_caso_codestsecundario_index` (`codestsecundario`);


-- PASO 2 -- Rellenar las programaciones que ya existen con el Estado QX del
-- seguimiento que las creó: los dos se guardan en la misma operación, con el
-- mismo caso y la misma hora. Las que no encuentren pareja quedan vacías y se
-- muestran en la grilla de cirugía, que era la única que existía.

UPDATE `programacion_caso` p
JOIN (
  SELECT s.`codrad`, s.`created_at`, MAX(s.`id`) AS `id`
  FROM `seguimiento_caso` s
  WHERE s.`codestsecundario` IS NOT NULL
  GROUP BY s.`codrad`, s.`created_at`
) ult ON ult.`codrad` = p.`codrad` AND ult.`created_at` = p.`created_at`
JOIN `seguimiento_caso` s ON s.`id` = ult.`id`
SET p.`codestsecundario` = s.`codestsecundario`
WHERE p.`codestsecundario` IS NULL;


-- PASO 3 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarla otra vez y
-- fallará. El NOT EXISTS evita duplicar la fila si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_22_000001_add_codestsecundario_to_programacion_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_22_000001_add_codestsecundario_to_programacion_caso_table'
);


-- PASO 4 -- Verificación: cuántas programaciones quedaron con cada Estado QX.
-- "(sin estado)" son las que se ven en la grilla de cirugía por no tener
-- pareja en el seguimiento.

SELECT IFNULL(e.`Nombre`, '(sin estado)') AS `estado_qx`, COUNT(*) AS `programaciones`
FROM `programacion_caso` p
LEFT JOIN `EstRadisecundario` e ON e.`id` = p.`codestsecundario`
GROUP BY `estado_qx`
ORDER BY `programaciones` DESC;
