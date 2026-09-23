-- ============================================================================
--  Gestión Servicios: tabla `serasignado`
--  Equivalente exacto de las migraciones nuevas, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migraciones que reemplaza:
--    2026_09_23_000002_create_serasignado_table
--    2026_09_23_000003_add_estado_to_serasignado_table
--
--  QUÉ HACE: deja el catálogo de servicios que administra la opción "Gestión
--  Servicios" (menú Herramientas, después de Gestión de Usuarios):
--    codigo       int, autoincremental, llave primaria
--    nombre       varchar(120), obligatorio
--    descripcion  varchar(120), opcional
--    estado       activo (1) / inactivo (0); por defecto activo
--
--  Sirve tanto si la tabla no existe como si ya se creó con la versión
--  anterior de este script (sin `estado`): en ese caso solo agrega la columna
--  y deja activos los servicios que ya había. Es seguro ejecutarlo más de una
--  vez.
--
--  OJO: si se sube el código sin aplicar esto, Gestión Servicios falla con
--  "Table 'serasignado' doesn't exist" o "Unknown column 'estado'".
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base > pestaña SQL > pegue todo el
--       contenido y ejecute.
-- ============================================================================


-- PASO 1 -- Tabla de servicios (si no existe, ya con el estado).

CREATE TABLE IF NOT EXISTS `serasignado` (
  `codigo` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  `descripcion` varchar(120) NULL DEFAULT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`codigo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 2 -- Si la tabla ya existía sin `estado`, agregarlo. Se consulta antes
-- para que no falle con "Duplicate column" si ya está.

SET @falta_estado := (
  SELECT COUNT(*) = 0
  FROM information_schema.`COLUMNS`
  WHERE `TABLE_SCHEMA` = DATABASE()
    AND `TABLE_NAME` = 'serasignado'
    AND `COLUMN_NAME` = 'estado'
);

SET @sql := IF(@falta_estado,
  'ALTER TABLE `serasignado` ADD COLUMN `estado` tinyint(1) NOT NULL DEFAULT 1 AFTER `descripcion`',
  'SELECT 1'
);

PREPARE agregar_estado FROM @sql;
EXECUTE agregar_estado;
DEALLOCATE PREPARE agregar_estado;


-- PASO 3 -- Registrar las migraciones como ya aplicadas.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarlas otra vez y
-- fallará. El NOT EXISTS evita duplicar las filas si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_23_000002_create_serasignado_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_23_000002_create_serasignado_table'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_23_000003_add_estado_to_serasignado_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_23_000003_add_estado_to_serasignado_table'
);


-- PASO 4 -- Verificación: debe listar codigo, nombre, descripcion y estado.

SELECT `COLUMN_NAME`, `COLUMN_TYPE`, `IS_NULLABLE`, `COLUMN_DEFAULT`, `EXTRA`, `COLUMN_KEY`
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE()
  AND `TABLE_NAME` = 'serasignado'
ORDER BY `ORDINAL_POSITION`;
