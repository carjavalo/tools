-- ============================================================================
--  Botones "Ver programados": acciones Editar y Borrar
--  Equivalente exacto de la migración nueva, para aplicar en phpMyAdmin
--  cuando no se pueda ejecutar "php artisan migrate" en el servidor (cPanel).
--
--  Migración que reemplaza:
--    2026_10_05_000001_reset_acciones_botones_ver_programados
--
--  POR QUÉ: los botones "Ver programados", "Ver programados Hemo" y "Ver prog
--  Cvascular" ahora tienen Editar y Borrar en el Gestor de Permisos (dejan
--  editar y borrar las programaciones de su grilla). La tabla `permisos` crea
--  esas columnas en 1 por defecto, así que una fila ya guardada podría dar
--  esas acciones sin que nadie las asignara. Este script las apaga; después el
--  Super Admin las activa en el Gestor a los roles que corresponda.
--
--  Aplíquelo ANTES de subir el código, o junto.
--
--  CÓMO APLICARLO:
--    1. Copia de seguridad de la base.
--    2. phpMyAdmin > base (uoxclxvl_tools) > pestaña SQL > pegue y ejecute.
-- ============================================================================


-- PASO 1 -- Apagar Editar y Borrar de los tres botones.

UPDATE `permisos`
SET `editar` = 0, `borrar` = 0
WHERE `vista` IN (
  'radicar-solicitud-ver-programados',
  'radicar-solicitud-ver-programados-hemo',
  'radicar-solicitud-ver-programados-cvascular'
);


-- PASO 2 -- Registrar la migración como ya aplicada.

SET @lote := (SELECT IFNULL(MAX(`batch`), 0) + 1 FROM `migrations`);

INSERT INTO `migrations` (`migration`, `batch`)
SELECT '2026_10_05_000001_reset_acciones_botones_ver_programados', @lote
WHERE NOT EXISTS (
  SELECT 1 FROM (SELECT `migration` FROM `migrations`) AS m
  WHERE m.`migration` = '2026_10_05_000001_reset_acciones_botones_ver_programados'
);


-- PASO 3 -- Verificación: todos deben quedar con editar = 0 y borrar = 0.

SELECT r.`Nombre` AS rol, p.`vista`, p.`ver`, p.`editar`, p.`borrar`
FROM `permisos` p
JOIN `roles` r ON r.`id` = p.`role_id`
WHERE p.`vista` LIKE 'radicar-solicitud-ver-programados%'
ORDER BY r.`Nombre`, p.`vista`;
