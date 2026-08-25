-- ============================================================================
-- Sincroniza la tabla `migrations` con lo que la base YA tiene.
--
-- POR QUÉ: en su día varias migraciones se aplicaron a mano por SQL, pero no
-- se registraron en la tabla `migrations`. Artisan las sigue viendo pendientes
-- e intenta repetirlas, y falla con:
--     SQLSTATE[42S21]: Column already exists: 1060 Duplicate column name 'copago'
--
-- QUÉ HACE: registra una migración SOLO SI su efecto ya está presente en la
-- base (la columna o la tabla existen de verdad). Si no está presente, NO la
-- registra, para que `php artisan migrate` la aplique de verdad. Así es
-- imposible saltarse una migración que nunca corrió.
--
-- Solo se tratan las 4 que fallarían al repetirse. Las otras 3 pendientes se
-- dejan para artisan a propósito:
--   - 2026_08_05_000001  no hace nada si la llave foránea ya no está.
--   - 2026_08_06_000001  es la que crea `maos`: ESTA SÍ debe correr.
--   - 2026_08_06_000002  está protegida con hasColumn().
--
-- CÓMO APLICARLO, en el terminal de cPanel:
--     mysql -u USUARIO -p NOMBRE_BASE < registrar_migraciones_ya_aplicadas.sql
--     php artisan migrate --force
--     php artisan optimize:clear
--
-- O pegando el contenido en phpMyAdmin > pestaña SQL, y luego corriendo
-- `php artisan migrate --force` en el terminal.
--
-- Haz copia de seguridad de la base antes (cPanel > Asistente de copia).
-- ============================================================================


-- Número de lote: el más alto que ya exista, + 1.
SET @batch := (SELECT COALESCE(MAX(`batch`), 0) + 1 FROM `migrations`);


-- ----------------------------------------------------------------------------
-- 1. copago / valor_copago en la radicación
-- ----------------------------------------------------------------------------

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_31_000002_add_copago_to_radicar_caso_table', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'RadicarCaso'
                  AND COLUMN_NAME  = 'copago')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_07_31_000002_add_copago_to_radicar_caso_table');


-- ----------------------------------------------------------------------------
-- 2. paquete (PDF) en la radicación
-- ----------------------------------------------------------------------------

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_07_31_000003_add_paquete_to_radicar_caso_table', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'RadicarCaso'
                  AND COLUMN_NAME  = 'paquete')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_07_31_000003_add_paquete_to_radicar_caso_table');


-- ----------------------------------------------------------------------------
-- 3. Tabla de Auditoría
-- ----------------------------------------------------------------------------

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000001_create_auditoria_table', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'auditoria')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_07_000001_create_auditoria_table');


-- ----------------------------------------------------------------------------
-- 4. Auditoría visible por rol
-- ----------------------------------------------------------------------------

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_08_07_000002_create_role_auditoria_tables', @batch
  FROM DUAL
 WHERE EXISTS (SELECT 1 FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME   = 'role_auditoria_roles')
   AND NOT EXISTS (SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS ya
                    WHERE ya.`migration` = '2026_08_07_000002_create_role_auditoria_tables');


-- ----------------------------------------------------------------------------
-- 5. Verificación: qué quedó registrado en este lote.
--    Puede salir vacío si esas tablas/columnas no existían: entonces artisan
--    las creará él mismo, que es justo lo que debe pasar.
-- ----------------------------------------------------------------------------

SELECT `migration`, `batch` FROM `migrations` WHERE `batch` = @batch ORDER BY `id`;
