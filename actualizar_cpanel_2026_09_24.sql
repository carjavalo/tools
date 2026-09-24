-- ============================================================================
--  ACTUALIZACIÓN CONSOLIDADA DEL CPANEL — cambios del 22 al 24 de sept. 2026
--
--  Un solo script con TODOS los cambios de base de datos de estos días. Revisa
--  qué le falta a la base y agrega solo eso: se puede ejecutar aunque ya se
--  haya corrido alguno de los scripts sueltos, y más de una vez.
--
--  Reemplaza a (no hace falta correrlos por separado):
--    agregar_estado_qx_programacion_servidor.sql
--    ampliar_columna_rol_servidor.sql
--    crear_tabla_serasignado_servidor.sql
--    agregar_servicio_asignado_radicacion_servidor.sql
--
--  Migraciones que deja registradas:
--    2026_09_22_000001_add_codestsecundario_to_programacion_caso_table
--    2026_09_23_000001_widen_rol_columns
--    2026_09_23_000002_create_serasignado_table
--    2026_09_23_000003_add_estado_to_serasignado_table
--    2026_09_24_000001_add_sede_to_serasignado_table
--    2026_09_24_000002_add_codservicio_to_radicar_caso_table
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base de tools.huv.gov.co > pestaña SQL >
--       pegue TODO el contenido y ejecute.
--    3. Revise la verificación del final: todas las filas deben decir "OK".
--
--  Ningún paso borra datos.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Programaciones de cirugía: Estado QX con que se programó cada una.
--    Separa la grilla "Ver programados" de cirugía de la de Hemodinamia.
-- ---------------------------------------------------------------------------

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'programacion_caso'
    AND `COLUMN_NAME` = 'codestsecundario');
SET @sql := IF(@falta,
  'ALTER TABLE `programacion_caso` ADD COLUMN `codestsecundario` varchar(5) NULL DEFAULT NULL AFTER `codrad`, ADD KEY `programacion_caso_codestsecundario_index` (`codestsecundario`)',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Las programaciones ya existentes toman el Estado QX del seguimiento que las
-- creó (mismo caso y misma hora). Solo toca las que siguen vacías.
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


-- ---------------------------------------------------------------------------
-- 2) Nombres de rol largos: users.rol y auditoria.rol pasan de 30 a 120.
--    Evita el error "Data too long for column 'rol'" en Gestión de Usuarios.
-- ---------------------------------------------------------------------------

ALTER TABLE `users` MODIFY `rol` varchar(120) NOT NULL DEFAULT 'paciente';
ALTER TABLE `auditoria` MODIFY `rol` varchar(120) NULL DEFAULT NULL;


-- ---------------------------------------------------------------------------
-- 3) Gestión Servicios: tabla serasignado con sede y estado.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `serasignado` (
  `codigo` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `sede` varchar(20) NOT NULL DEFAULT 'cali',
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(120) NULL DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`codigo`),
  KEY `serasignado_sede_index` (`sede`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Si la tabla ya existía sin `estado`: agregarlo (los servicios quedan activos).
SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'serasignado'
    AND `COLUMN_NAME` = 'estado');
SET @sql := IF(@falta,
  'ALTER TABLE `serasignado` ADD COLUMN `estado` tinyint(1) NOT NULL DEFAULT 1 AFTER `descripcion`',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;

-- Si la tabla ya existía sin `sede`: agregarla (los servicios quedan en Cali).
SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'serasignado'
    AND `COLUMN_NAME` = 'sede');
SET @sql := IF(@falta,
  'ALTER TABLE `serasignado` ADD COLUMN `sede` varchar(20) NOT NULL DEFAULT ''cali'' AFTER `codigo`, ADD KEY `serasignado_sede_index` (`sede`)',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------------
-- 4) Radicaciones: Servicio Asignado (Nueva Radicación y Modificar Radicado).
--    Las radicaciones existentes quedan sin servicio hasta que se les asigne.
-- ---------------------------------------------------------------------------

SET @falta := (SELECT COUNT(*) = 0 FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'RadicarCaso'
    AND `COLUMN_NAME` = 'codservicio');
SET @sql := IF(@falta,
  'ALTER TABLE `RadicarCaso` ADD COLUMN `codservicio` int(10) unsigned NULL DEFAULT NULL AFTER `sede`, ADD KEY `radicarcaso_codservicio_index` (`codservicio`)',
  'SELECT 1');
PREPARE paso FROM @sql; EXECUTE paso; DEALLOCATE PREPARE paso;


-- ---------------------------------------------------------------------------
-- 5) Registrar las migraciones como aplicadas, para que un futuro
--    "php artisan migrate" no intente repetirlas. No duplica filas.
-- ---------------------------------------------------------------------------

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT n.`migration`, @lote
FROM (
  SELECT '2026_09_22_000001_add_codestsecundario_to_programacion_caso_table' AS `migration`
  UNION ALL SELECT '2026_09_23_000001_widen_rol_columns'
  UNION ALL SELECT '2026_09_23_000002_create_serasignado_table'
  UNION ALL SELECT '2026_09_23_000003_add_estado_to_serasignado_table'
  UNION ALL SELECT '2026_09_24_000001_add_sede_to_serasignado_table'
  UNION ALL SELECT '2026_09_24_000002_add_codservicio_to_radicar_caso_table'
) n
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = n.`migration`
);


-- ---------------------------------------------------------------------------
-- 6) Verificación: una sola consulta (phpMyAdmin muestra solo la última).
--    Todas las filas deben decir OK.
-- ---------------------------------------------------------------------------

SELECT 'programacion_caso.codestsecundario' AS `cambio`,
  IF(COUNT(*) = 1, 'OK', 'FALTA') AS `resultado`
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'programacion_caso' AND `COLUMN_NAME` = 'codestsecundario'
UNION ALL
SELECT 'users.rol = varchar(120)', IF(MAX(`COLUMN_TYPE`) = 'varchar(120)', 'OK', 'FALTA')
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'users' AND `COLUMN_NAME` = 'rol'
UNION ALL
SELECT 'auditoria.rol = varchar(120)', IF(MAX(`COLUMN_TYPE`) = 'varchar(120)', 'OK', 'FALTA')
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'auditoria' AND `COLUMN_NAME` = 'rol'
UNION ALL
SELECT 'serasignado: codigo, sede, nombre, descripcion, estado', IF(COUNT(*) = 5, 'OK', 'FALTA')
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'serasignado'
  AND `COLUMN_NAME` IN ('codigo', 'sede', 'nombre', 'descripcion', 'estado')
UNION ALL
SELECT 'RadicarCaso.codservicio', IF(COUNT(*) = 1, 'OK', 'FALTA')
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'RadicarCaso' AND `COLUMN_NAME` = 'codservicio'
UNION ALL
SELECT 'migraciones registradas (6)', IF(COUNT(*) = 6, 'OK', 'FALTA')
FROM `migrations`
WHERE `migration` IN (
  '2026_09_22_000001_add_codestsecundario_to_programacion_caso_table',
  '2026_09_23_000001_widen_rol_columns',
  '2026_09_23_000002_create_serasignado_table',
  '2026_09_23_000003_add_estado_to_serasignado_table',
  '2026_09_24_000001_add_sede_to_serasignado_table',
  '2026_09_24_000002_add_codservicio_to_radicar_caso_table'
);
