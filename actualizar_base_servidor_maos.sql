-- ============================================================================
-- Pone la base del servidor al día con las migraciones de agosto.
--
-- POR QUÉ: el formulario "Aplicar Modificaciones" del Historial falla con
--     SQLSTATE[42S22]: Column not found: 1054 Unknown column 'maos' in 'SET'
-- porque el código ya guarda MAOS en la radicación pero la columna nunca se
-- creó en el servidor. Al fallar el UPDATE se pierde TODO el envío del
-- formulario (subespecialidad, estado, Fecha Recibido Serv, observaciones),
-- no solo MAOS.
--
-- Continúa donde quedó `actualizar_base_servidor.sql`, que dejó la base al día
-- hasta el 2026-07-31.
--
-- LA VÍA RECOMENDADA sigue siendo el terminal de cPanel, en la carpeta que
-- contiene el archivo artisan:
--     php artisan migrate --force
--     php artisan optimize:clear
-- Esa vía además resuelve la migración 2026_08_05_000001 (paso 5), que en SQL
-- a mano es incómoda porque el nombre de la restricción varía.
--
-- Este script es la alternativa cuando el terminal no está disponible.
--
-- OJO: si `php artisan migrate --force` ya funciona en el servidor, NO uses
-- este script. Usa `registrar_migraciones_ya_aplicadas.sql` y deja que artisan
-- haga el resto: es el camino corto y no duplica trabajo.
--
-- CÓMO APLICARLO:
--   1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--   2. phpMyAdmin > selecciona la base > pestaña SQL > pega y ejecuta.
--   3. Ejecuta los bloques UNO POR UNO. Si alguno dice que ya existe, esa parte
--      ya estaba aplicada: sigue con el siguiente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. MAOS en la radicación  <<< ESTE ES EL QUE CORRIGE EL ERROR 500
--    Si responde "Duplicate column name", la columna ya existía: continúa.
-- ----------------------------------------------------------------------------

ALTER TABLE `RadicarCaso`
    ADD COLUMN `maos` TINYINT(1) NOT NULL DEFAULT 0 AFTER `paquete`;


-- ----------------------------------------------------------------------------
-- 2. Estado QX de texto libre: se retiró en favor de `codestsecundario`, que
--    apunta al catálogo EstRadisecundario.
--    Si responde "Can't DROP 'estado_qx'", ya no existía: continúa.
-- ----------------------------------------------------------------------------

ALTER TABLE `RadicarCaso`      DROP COLUMN `estado_qx`;
ALTER TABLE `seguimiento_caso` DROP COLUMN `estado_qx`;


-- ----------------------------------------------------------------------------
-- 3. Módulo de Auditoría
--    Solo hace falta si la vista de Auditoría todavía no funciona en el
--    servidor. Con IF NOT EXISTS es inofensivo ejecutarlo de todos modos.
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `auditoria` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
    `usuario` VARCHAR(200) NULL DEFAULT NULL,
    `cuenta` VARCHAR(255) NULL DEFAULT NULL,
    `rol` VARCHAR(30) NULL DEFAULT NULL,
    `evento` VARCHAR(20) NOT NULL,
    `modulo` VARCHAR(60) NULL DEFAULT NULL,
    `descripcion` TEXT NOT NULL,
    `registro_tipo` VARCHAR(60) NULL DEFAULT NULL,
    `registro_id` VARCHAR(40) NULL DEFAULT NULL,
    `cambios` LONGTEXT NULL DEFAULT NULL,
    `ip` VARCHAR(45) NULL DEFAULT NULL,
    `navegador` VARCHAR(255) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `auditoria_user_id_index` (`user_id`),
    KEY `auditoria_rol_index` (`rol`),
    KEY `auditoria_evento_index` (`evento`),
    KEY `auditoria_modulo_index` (`modulo`),
    KEY `auditoria_created_at_id_index` (`created_at`, `id`),
    KEY `auditoria_registro_tipo_registro_id_index` (`registro_tipo`, `registro_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_auditoria_roles` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT(20) UNSIGNED NOT NULL,
    `rol_visible_id` BIGINT(20) UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `role_auditoria_rol_unique` (`role_id`, `rol_visible_id`),
    KEY `role_auditoria_roles_rol_visible_id_foreign` (`rol_visible_id`),
    CONSTRAINT `role_auditoria_roles_role_id_foreign`
        FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE,
    CONSTRAINT `role_auditoria_roles_rol_visible_id_foreign`
        FOREIGN KEY (`rol_visible_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `role_auditoria_modulos` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT(20) UNSIGNED NOT NULL,
    `modulo` VARCHAR(60) NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `role_auditoria_modulo_unique` (`role_id`, `modulo`),
    CONSTRAINT `role_auditoria_modulos_role_id_foreign`
        FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 4. Registrar las migraciones para que artisan no intente repetirlas.
--
--    Cada una se registra SOLO SI su efecto está de verdad en la base. Si el
--    bloque correspondiente de arriba no se ejecutó o falló, no se registra, y
--    así `php artisan migrate` podrá aplicarla más adelante. Registrar a ciegas
--    haría que artisan la diera por hecha y nunca llegara a correr.
-- ----------------------------------------------------------------------------

SET @batch := (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_06_000001_add_maos_to_radicar_caso_table', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'RadicarCaso'
                  AND COLUMN_NAME  = 'maos')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_06_000001_add_maos_to_radicar_caso_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_06_000002_drop_estado_qx_column', @batch
  FROM DUAL
 WHERE NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS
                    WHERE TABLE_SCHEMA = DATABASE()
                      AND TABLE_NAME   = 'RadicarCaso'
                      AND COLUMN_NAME  = 'estado_qx')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_06_000002_drop_estado_qx_column');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000001_create_auditoria_table', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'auditoria')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_07_000001_create_auditoria_table');

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000002_create_role_auditoria_tables', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'role_auditoria_roles')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_07_000002_create_role_auditoria_tables');


-- ----------------------------------------------------------------------------
-- 5. PENDIENTE APARTE: 2026_08_05_000001, que quita la llave foránea de
--    `subespecialidad` sobre `codespcodser`.
--
--    NO se registra arriba a propósito: registrarla sin aplicarla haría que un
--    `php artisan migrate` posterior la diera por hecha y la restricción se
--    quedaría puesta para siempre.
--
--    Lo más limpio es correr `php artisan migrate --force`. Si no hay terminal,
--    busca el nombre real de la restricción y bórrala a mano:
--
--        SELECT CONSTRAINT_NAME
--          FROM information_schema.KEY_COLUMN_USAGE
--         WHERE TABLE_SCHEMA = DATABASE()
--           AND TABLE_NAME = 'subespecialidad'
--           AND COLUMN_NAME = 'codespcodser'
--           AND REFERENCED_TABLE_NAME IS NOT NULL;
--
--        ALTER TABLE `subespecialidad` DROP FOREIGN KEY `<nombre_que_salga>`;
--
--    y solo entonces registra la migración:
--
--        INSERT IGNORE INTO `migrations` (`migration`, `batch`) VALUES
--            ('2026_08_05_000001_drop_especialidad_relation_from_subespecialidad',
--             (SELECT * FROM (SELECT COALESCE(MAX(batch),0) FROM `migrations`) AS m));
-- ----------------------------------------------------------------------------


-- ----------------------------------------------------------------------------
-- 6. Verificación: la primera consulta DEBE devolver una fila (es la que
--    corrige el error 500). Las dos siguientes, ninguna.
-- ----------------------------------------------------------------------------

SHOW COLUMNS FROM `RadicarCaso` LIKE 'maos';
SHOW COLUMNS FROM `RadicarCaso` LIKE 'estado_qx';
SHOW COLUMNS FROM `seguimiento_caso` LIKE 'estado_qx';
SHOW TABLES LIKE 'auditoria';
