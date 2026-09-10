-- ============================================================================
--  Programación de Cirugía por sedes (Sede Cali / Sede Cartago)
--  Equivalente exacto de las migraciones nuevas, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migraciones que reemplaza:
--    2026_09_10_000001_add_sede_to_radicar_caso_table
--    2026_09_10_000002_create_role_sedes_table
--
--  POR QUÉ: cada radicación queda en la sede de la opción por la que entró
--  quien la creó (Programación de Cirugía Sede Cali o Sede Cartago), y cada
--  usuario solo ve las radicaciones de esa sede. A qué sedes entra cada rol se
--  configura en el Gestor de Permisos.
--
--  OJO: el código nuevo consulta la columna `sede` en TODA búsqueda de
--  radicaciones. Si se sube el código sin aplicar esto, Radicar Solicitud falla
--  con "Unknown column 'sede'". Aplíquelo antes de subir el código, o junto.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
--    3. Si el PASO 1 responde "Duplicate column name 'sede'", la columna ya
--       existía: ejecute el script desde el PASO 2.
-- ============================================================================


-- PASO 1 -- Sede de cada radicación. Hasta hoy solo operaba Cali, así que todo
-- lo radicado antes queda en Cali por el valor por defecto. El seguimiento, la
-- bitácora, las cotizaciones y las programaciones no llevan sede propia: la
-- heredan de su radicación por el consecutivo (`codrad`).

ALTER TABLE `RadicarCaso`
  ADD COLUMN `sede` varchar(20) NOT NULL DEFAULT 'cali' AFTER `codrad`,
  ADD KEY `radicarcaso_sede_index` (`sede`);


-- PASO 2 -- Sedes por las que puede ingresar cada rol (Gestor de Permisos).
-- Un rol sin filas aquí entra solo a la Sede Cali, que es donde operaban todos
-- antes de existir Cartago. El Super Admin, los pacientes y los médicos no se
-- guardan aquí: siempre tienen las dos sedes.

CREATE TABLE IF NOT EXISTS `role_sedes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `sede` varchar(20) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_sede_unique` (`role_id`, `sede`),
  CONSTRAINT `role_sedes_role_id_foreign` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 3 -- Registrar las migraciones como ya aplicadas.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarlas otra vez y
-- fallará. El NOT EXISTS evita duplicar las filas si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_10_000001_add_sede_to_radicar_caso_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_10_000001_add_sede_to_radicar_caso_table'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_10_000002_create_role_sedes_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_10_000002_create_role_sedes_table'
);


-- PASO 4 -- Verificación.
--
-- Es UNA sola consulta a propósito: phpMyAdmin vuelve a ejecutar la última
-- sentencia del script para paginarla, así que no se usa information_schema.
--
-- Resultado esperado: todas las radicaciones en Cali, 0 sin sede, la tabla de
-- sedes por rol vacía y "2" en las migraciones.

SELECT 'Radicaciones en Sede Cali' AS 'Comprobación', COUNT(*) AS 'Valor' FROM `RadicarCaso` WHERE `sede` = 'cali'
UNION ALL
SELECT 'Radicaciones sin sede (debe ser 0)', COUNT(*) FROM `RadicarCaso` WHERE `sede` IS NULL OR `sede` = ''
UNION ALL
SELECT 'role_sedes (registros)', COUNT(*) FROM `role_sedes`
UNION ALL
SELECT 'migraciones registradas (debe ser 2)', COUNT(*) FROM `migrations`
WHERE `migration` IN (
  '2026_09_10_000001_add_sede_to_radicar_caso_table',
  '2026_09_10_000002_create_role_sedes_table'
);
