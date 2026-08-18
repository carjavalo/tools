-- ============================================================================
--  Herramientas - Seguimiento (bitácora de actividad)
--  Equivalente exacto de las 2 migraciones nuevas, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migraciones que reemplaza:
--    2026_08_07_000001_create_auditoria_table
--    2026_08_07_000002_create_role_auditoria_tables
--
--  Es seguro ejecutarlo más de una vez: no borra ni modifica nada existente.
--  Seleccione primero la base de datos (uoxclxvl_tools) y pegue todo el
--  contenido en la pestaña SQL.
-- ============================================================================


-- PASO 1 -- Bitácora: una fila por cada acción de un usuario.
-- Los datos del usuario se copian en la fila (no se resuelven por relación)
-- para que el registro siga diciendo quién actuó aunque la cuenta se
-- renombre o se elimine después.

CREATE TABLE IF NOT EXISTS `auditoria` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `usuario` varchar(200) DEFAULT NULL,
  `cuenta` varchar(255) DEFAULT NULL,
  `rol` varchar(30) DEFAULT NULL,
  `evento` varchar(20) NOT NULL,
  `modulo` varchar(60) DEFAULT NULL,
  `descripcion` text NOT NULL,
  `registro_tipo` varchar(60) DEFAULT NULL,
  `registro_id` varchar(40) DEFAULT NULL,
  `cambios` longtext DEFAULT NULL,
  `ip` varchar(45) DEFAULT NULL,
  `navegador` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `auditoria_created_at_id_index` (`created_at`,`id`),
  KEY `auditoria_registro_tipo_registro_id_index` (`registro_tipo`,`registro_id`),
  KEY `auditoria_user_id_index` (`user_id`),
  KEY `auditoria_rol_index` (`rol`),
  KEY `auditoria_evento_index` (`evento`),
  KEY `auditoria_modulo_index` (`modulo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 2 -- De qué roles puede ver actividad cada rol.
-- Sin filas para un rol, ve la actividad de todos: la configuración
-- restringe, no habilita.

CREATE TABLE IF NOT EXISTS `role_auditoria_roles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `rol_visible_id` bigint(20) unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_auditoria_rol_unique` (`role_id`,`rol_visible_id`),
  KEY `role_auditoria_roles_rol_visible_id_foreign` (`rol_visible_id`),
  CONSTRAINT `role_auditoria_roles_rol_visible_id_foreign` FOREIGN KEY (`rol_visible_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
  CONSTRAINT `role_auditoria_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 3 -- Qué módulos puede ver cada rol (Sesión, Radicaciones, Usuarios,
-- Roles y permisos, Catálogos). Mismo criterio: sin filas, ve todos.

CREATE TABLE IF NOT EXISTS `role_auditoria_modulos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint(20) unsigned NOT NULL,
  `modulo` varchar(60) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_auditoria_modulo_unique` (`role_id`,`modulo`),
  CONSTRAINT `role_auditoria_modulos_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- PASO 4 -- Registrar las 2 migraciones como ya aplicadas.
-- Sin esto, un "php artisan migrate" futuro intentará crear las tablas otra
-- vez y fallará. El NOT EXISTS evita duplicar las filas si el script se
-- ejecuta dos veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000001_create_auditoria_table', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_08_07_000001_create_auditoria_table'
);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000002_create_role_auditoria_tables', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_08_07_000002_create_role_auditoria_tables'
);


-- PASO 5 -- Verificación.
--
-- Es UNA sola consulta a propósito: phpMyAdmin vuelve a ejecutar la última
-- sentencia del script para paginarla (le agrega "LIMIT 0, 25"), y si esa
-- sentencia consulta information_schema, la repetición queda apuntando a
-- information_schema y falla con "Tabla desconocida 'migrations'". Por eso
-- aquí no se usa information_schema: la existencia de cada tabla se comprueba
-- leyéndola directamente.
--
-- Resultado esperado: las 3 tablas con 0 registros y "2" en las migraciones.
-- Si alguna tabla no existiera, la consulta falla nombrándola.

SELECT 'auditoria' AS 'Tabla', COUNT(*) AS 'Registros' FROM `auditoria`
UNION ALL
SELECT 'role_auditoria_roles', COUNT(*) FROM `role_auditoria_roles`
UNION ALL
SELECT 'role_auditoria_modulos', COUNT(*) FROM `role_auditoria_modulos`
UNION ALL
SELECT 'migraciones registradas (deben ser 2)', COUNT(*) FROM `migrations`
WHERE `migration` LIKE '2026_08_07%';
