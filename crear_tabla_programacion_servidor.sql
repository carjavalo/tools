-- ============================================================================
--  Herramientas - Programación de cirugías (Estado QX = Programados)
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin cuando
--  no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_09_04_000001_create_programacion_caso_table
--
--  POR QUÉ: en el formulario "Aplicar Modificaciones al Caso" (Historial),
--  cuando el Estado QX se pone en "Programados" se activan tres campos —Fecha
--  de Programación, Especialista Médico y Observaciones Prg— que se guardan en
--  esta tabla, aparte del caso y del seguimiento, para llevar el control de las
--  radicaciones programadas para cirugía.
--
--  Es seguro ejecutarlo más de una vez: no borra ni modifica nada existente.
--  Seleccione primero la base de datos (uoxclxvl_tools) y pegue todo el
--  contenido en la pestaña SQL.
-- ============================================================================


-- PASO 1 -- Bitácora de programaciones. Una fila por cada vez que un caso pasa
-- a "Programados", con lo diligenciado (los tres campos son opcionales) más
-- quién y cuándo lo registró. Sin llave foránea a RadicarCaso, igual que
-- seguimiento_caso: se relaciona por `codrad`.

CREATE TABLE IF NOT EXISTS `programacion_caso` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `codrad` bigint(20) unsigned NOT NULL,
  `fecha_programacion` datetime DEFAULT NULL,
  `especialista_medico` varchar(200) DEFAULT NULL,
  `observaciones_prg` text DEFAULT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `programacion_caso_codrad_index` (`codrad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 2 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará crear la tabla otra vez
-- y fallará. El NOT EXISTS evita duplicar la fila si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_04_000001_create_programacion_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_04_000001_create_programacion_caso_table'
);


-- PASO 3 -- Verificación.
--
-- Es UNA sola consulta a propósito: phpMyAdmin vuelve a ejecutar la última
-- sentencia del script para paginarla, así que no se usa information_schema
-- (repetirla apuntaría ahí y fallaría). La existencia de la tabla se comprueba
-- leyéndola directamente.
--
-- Resultado esperado: la tabla con 0 registros y "1" en las migraciones.

SELECT 'programacion_caso' AS 'Tabla', COUNT(*) AS 'Registros' FROM `programacion_caso`
UNION ALL
SELECT 'migracion registrada (debe ser 1)', COUNT(*) FROM `migrations`
WHERE `migration` = '2026_09_04_000001_create_programacion_caso_table';
