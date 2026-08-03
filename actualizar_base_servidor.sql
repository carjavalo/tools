-- ============================================================================
-- Pone la base del servidor al día con el código ya desplegado.
--
-- POR QUÉ: se subió el código nuevo (copago, paquete, trazabilidad) pero no se
-- corrieron las migraciones, así que la aplicación pide columnas que no
-- existen y falla con:
--     SQLSTATE[42S22]: Column not found: 1054 Unknown column 'copago'
--
-- LA VÍA RECOMENDADA sigue siendo el terminal de cPanel, en la carpeta que
-- contiene el archivo artisan:
--     php artisan migrate --force
--     php artisan optimize:clear
--
-- Este script es la alternativa cuando el terminal no está disponible. Hace lo
-- mismo que las migraciones pendientes y además las registra en la tabla
-- `migrations`, para que un `php artisan migrate` posterior no intente
-- repetirlas y falle.
--
-- CÓMO APLICARLO:
--   1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--   2. phpMyAdmin > selecciona la base > pestaña SQL > pega y ejecuta.
--   3. Ejecuta los bloques UNO POR UNO. Si alguno dice que ya existe, esa parte
--      ya estaba aplicada: sigue con el siguiente.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Copago y paquete en la radicación
--    Si responde "Duplicate column name", esa columna ya existía: continúa.
-- ----------------------------------------------------------------------------

ALTER TABLE `RadicarCaso`
    ADD COLUMN `copago` TINYINT(1) NOT NULL DEFAULT 0 AFTER `convenio`;

ALTER TABLE `RadicarCaso`
    ADD COLUMN `valor_copago` DECIMAL(14,2) NULL DEFAULT NULL AFTER `copago`;

ALTER TABLE `RadicarCaso`
    ADD COLUMN `paquete` VARCHAR(255) NULL DEFAULT NULL AFTER `valor_copago`;


-- ----------------------------------------------------------------------------
-- 2. Bitácora de trazabilidad (informe de cambios)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `trazabilidad_caso` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `codrad` BIGINT(20) UNSIGNED NOT NULL,
    `user_id` BIGINT(20) UNSIGNED NULL DEFAULT NULL,
    `evento` VARCHAR(20) NOT NULL,
    `campo` VARCHAR(40) NULL DEFAULT NULL,
    `etiqueta` VARCHAR(80) NULL DEFAULT NULL,
    `anterior` VARCHAR(500) NULL DEFAULT NULL,
    `nuevo` VARCHAR(500) NULL DEFAULT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    KEY `trazabilidad_caso_codrad_created_at_index` (`codrad`, `created_at`),
    KEY `trazabilidad_caso_codrad_index` (`codrad`),
    KEY `trazabilidad_caso_evento_index` (`evento`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 3. Estados secundarios visibles por rol (Gestor de Permisos)
--    Las claves foráneas apuntan a EstRadisecundario: si esa tabla quedó en
--    minúscula en el servidor, corrige primero los nombres (paso 5).
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `role_estados_sec_grilla` (
    `id` BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `role_id` BIGINT(20) UNSIGNED NOT NULL,
    `est_radisecundario_id` BIGINT(20) UNSIGNED NOT NULL,
    `created_at` TIMESTAMP NULL DEFAULT NULL,
    `updated_at` TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `role_estado_sec_grilla_unique` (`role_id`, `est_radisecundario_id`),
    KEY `role_estados_sec_grilla_est_radisecundario_id_foreign` (`est_radisecundario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ----------------------------------------------------------------------------
-- 4. Correo y contraseña opcionales (médicos y pacientes no inician sesión)
-- ----------------------------------------------------------------------------

ALTER TABLE `users` MODIFY `email` VARCHAR(255) NULL DEFAULT NULL;
ALTER TABLE `users` MODIFY `password` VARCHAR(255) NULL DEFAULT NULL;


-- ----------------------------------------------------------------------------
-- 5. Nombres de tabla con mayúsculas (solo si aún están en minúscula)
--    En Linux los nombres distinguen mayúsculas. Si alguna línea dice que la
--    tabla no existe, es que ya tenía el nombre correcto: continúa.
-- ----------------------------------------------------------------------------

-- RENAME TABLE `estradicado`       TO `EstRadicado`;
-- RENAME TABLE `estradisecundario` TO `EstRadisecundario`;
-- RENAME TABLE `radicarcaso`       TO `RadicarCaso`;
-- RENAME TABLE `cuvsanezados`      TO `cuvsAnezados`;


-- ----------------------------------------------------------------------------
-- 6. Registrar las migraciones para que artisan no intente repetirlas
--    Usa el número de lote más alto que ya exista + 1.
-- ----------------------------------------------------------------------------

INSERT IGNORE INTO `migrations` (`migration`, `batch`) VALUES
    ('2026_07_30_000001_create_role_estados_sec_grilla_table',      (SELECT * FROM (SELECT COALESCE(MAX(batch),0)+1 FROM `migrations`) AS m)),
    ('2026_07_30_000002_make_email_password_nullable_in_users_table',(SELECT * FROM (SELECT COALESCE(MAX(batch),0)   FROM `migrations`) AS m)),
    ('2026_07_30_000003_create_trazabilidad_caso_table',             (SELECT * FROM (SELECT COALESCE(MAX(batch),0)   FROM `migrations`) AS m)),
    ('2026_07_31_000001_fix_table_name_case_for_linux',              (SELECT * FROM (SELECT COALESCE(MAX(batch),0)   FROM `migrations`) AS m)),
    ('2026_07_31_000002_add_copago_to_radicar_caso_table',           (SELECT * FROM (SELECT COALESCE(MAX(batch),0)   FROM `migrations`) AS m)),
    ('2026_07_31_000003_add_paquete_to_radicar_caso_table',          (SELECT * FROM (SELECT COALESCE(MAX(batch),0)   FROM `migrations`) AS m));


-- ----------------------------------------------------------------------------
-- 7. Verificación: las cuatro consultas deben devolver una fila cada una.
-- ----------------------------------------------------------------------------

SHOW COLUMNS FROM `RadicarCaso` LIKE 'copago';
SHOW COLUMNS FROM `RadicarCaso` LIKE 'valor_copago';
SHOW COLUMNS FROM `RadicarCaso` LIKE 'paquete';
SHOW TABLES LIKE 'trazabilidad_caso';
