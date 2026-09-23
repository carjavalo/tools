-- ============================================================================
--  Nombres de rol largos: ampliar users.rol y auditoria.rol a 120 caracteres
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor.
--
--  Migración que reemplaza:
--    2026_09_23_000001_widen_rol_columns
--
--  POR QUÉ: el nombre del rol admite 120 caracteres en la tabla roles, pero el
--  usuario solo guardaba 30. Al asignar "Operador Cirugia CardioVascular" (31
--  caracteres) Gestión de Usuarios respondía error 500 ("Data too long for
--  column 'rol'"). La bitácora (auditoria) copia el rol de quien actúa y tenía
--  el mismo límite: con ese usuario habría fallado también.
--
--  No borra ni cambia ningún dato: solo agranda las columnas. Es seguro
--  ejecutarlo más de una vez.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base (cPanel > Asistente de copia de seguridad).
--    2. phpMyAdmin > seleccione la base (uoxclxvl_tools) > pestaña SQL > pegue
--       todo el contenido y ejecute.
-- ============================================================================


-- PASO 1 -- Rol del usuario.

ALTER TABLE `users`
  MODIFY `rol` varchar(120) NOT NULL DEFAULT 'paciente';


-- PASO 2 -- Rol copiado en la bitácora de actividad.

ALTER TABLE `auditoria`
  MODIFY `rol` varchar(120) NULL DEFAULT NULL;


-- PASO 3 -- Registrar la migración como ya aplicada.
-- Sin esto, un "php artisan migrate" futuro intentará aplicarla otra vez. El
-- NOT EXISTS evita duplicar la fila si el script se ejecuta dos veces.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_09_23_000001_widen_rol_columns', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_09_23_000001_widen_rol_columns'
);


-- PASO 4 -- Verificación: las dos columnas deben decir varchar(120).

SELECT `TABLE_NAME`, `COLUMN_NAME`, `COLUMN_TYPE`
FROM information_schema.`COLUMNS`
WHERE `TABLE_SCHEMA` = DATABASE()
  AND `COLUMN_NAME` = 'rol'
  AND `TABLE_NAME` IN ('users', 'auditoria');
