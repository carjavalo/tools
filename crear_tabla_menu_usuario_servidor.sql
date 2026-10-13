-- ============================================================================
--  Gestor de Permisos (menú de usuario) (opciones de la cuenta por rol)
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_10_13_000001_create_role_menu_usuario_table
--
--  POR QUÉ: el Super Admin decide por rol si sus usuarios pueden usar
--  Cambiar cuenta, Cambiar contraseña, la autenticación en dos pasos y
--  Eliminar cuenta. Un rol sin filas aquí conserva todas las opciones.
--
--  OJO: el código nuevo consulta esta tabla en cada página. Si se sube el
--  código sin aplicar esto, el sistema falla con "Table ... doesn't exist".
--  Aplíquelo antes de subir el código, o junto.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `role_menu_usuario` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `role_id` bigint unsigned NOT NULL,
  `opcion` varchar(40) NOT NULL,
  `permitido` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `role_menu_usuario_unique` (`role_id`, `opcion`),
  CONSTRAINT `role_menu_usuario_role_id_foreign` FOREIGN KEY (`role_id`)
    REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registrar la migración como aplicada para que "php artisan migrate" no la
-- intente crear de nuevo.
INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_13_000001_create_role_menu_usuario_table', COALESCE(MAX(`batch`), 0) + 1
FROM `migrations`
WHERE NOT EXISTS (
  SELECT 1 FROM `migrations` WHERE `migration` = '2026_10_13_000001_create_role_menu_usuario_table'
);
