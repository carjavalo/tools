-- ============================================================================
--  Gestión Quirófanos QX: tabla `quirofanoQx`
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor (cPanel).
--
--  Migración que reemplaza:
--    2026_10_01_000001_create_quirofanoqx_table
--
--  QUÉ HACE: crea el catálogo de quirófanos que administra la opción
--  Herramientas > Gestión Quirófanos QX (debajo de Gestión Servicios).
--
--  OJO: el nombre de la tabla va SIN tilde (quirofanoQx). El código nuevo la
--  consulta con ese nombre exacto. Aplíquelo antes de subir el código, o
--  junto: sin la tabla, la opción responde "Table doesn't exist".
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
--    3. Si el PASO 1 responde "Table 'quirofanoQx' already exists", la tabla ya
--       estaba: ejecute el script desde el PASO 2.
--
--  PERMISOS: la opción nueva aparece en el Gestor de Permisos como
--  "Gestión Quirófanos QX". El Super Admin la ve siempre; a los demás roles
--  hay que asignársela allí.
-- ============================================================================


-- PASO 1 -- Tabla de quirófanos.

CREATE TABLE `quirofanoQx` (
  `id` int UNSIGNED NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `estado` tinyint(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 2 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará crear la tabla otra vez
-- y fallará. El NOT EXISTS evita duplicar la fila si el script se ejecuta dos
-- veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_01_000001_create_quirofanoqx_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_10_01_000001_create_quirofanoqx_table'
);


-- PASO 3 -- Verificación: debe mostrar las columnas id, nombre y estado.

DESCRIBE `quirofanoQx`;
