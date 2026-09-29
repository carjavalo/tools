-- Limpieza de usuarios duplicados en la tabla users (base de datos tools).
--
-- Son 10 personas registradas dos o tres veces con el mismo número de documento
-- (6 pacientes y 4 médicos). Por cada persona se conserva el registro más antiguo
-- (el id menor) y se eliminan los demás.
--
-- Si algún registro duplicado estuviera usado en otra tabla (programaciones,
-- seguimientos, cotizaciones, trazabilidad, auditoría o sesiones), esa referencia
-- se pasa primero al registro que se conserva, para no perder historial.
--
-- Solo se unen registros con el mismo documento Y el mismo rol. Se puede ejecutar
-- varias veces: la segunda vez no hace nada.

SET NAMES utf8mb4;

DROP TEMPORARY TABLE IF EXISTS `dup_conservar`;
DROP TEMPORARY TABLE IF EXISTS `dup_map`;

CREATE TEMPORARY TABLE `dup_conservar` AS
SELECT `Numero_D`, `rol`, MIN(`id`) AS `keep_id`
FROM `users`
WHERE `Numero_D` IN ('1062288195', '14959941', '25365374', '53100795', '6316369', '6442402',
                     '16835449', '16941166', '6104990', '94472140')
GROUP BY `Numero_D`, `rol`
HAVING COUNT(*) > 1;

CREATE TEMPORARY TABLE `dup_map` AS
SELECT u.`id` AS `dup_id`, c.`keep_id`
FROM `users` u
JOIN `dup_conservar` c ON c.`Numero_D` = u.`Numero_D` AND c.`rol` = u.`rol`
WHERE u.`id` <> c.`keep_id`;

-- Registros que se van a eliminar (y cuál se conserva de cada persona).
SELECT m.`dup_id` AS id_eliminar, m.`keep_id` AS id_conservar, u.`Numero_D`, u.`rol`,
       CONCAT_WS(' ', u.`Apellido1`, u.`apellido2`, u.`name`) AS nombre
FROM `dup_map` m JOIN `users` u ON u.`id` = m.`dup_id`
ORDER BY u.`Numero_D`, m.`dup_id`;

START TRANSACTION;

UPDATE `programacion_caso` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id` SET t.`user_id` = m.`keep_id`;
UPDATE `programacion_caso` t JOIN `dup_map` m ON t.`especialista_medico_id` = m.`dup_id` SET t.`especialista_medico_id` = m.`keep_id`;
UPDATE `seguimiento_caso` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id` SET t.`user_id` = m.`keep_id`;
UPDATE `cotizacion_caso` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id` SET t.`user_id` = m.`keep_id`;
UPDATE `trazabilidad_caso` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id` SET t.`user_id` = m.`keep_id`;
UPDATE `auditoria` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id` SET t.`user_id` = m.`keep_id`;
DELETE t FROM `sessions` t JOIN `dup_map` m ON t.`user_id` = m.`dup_id`;

DELETE u FROM `users` u JOIN `dup_map` m ON u.`id` = m.`dup_id`;

-- El registro que queda del Dr. Roldán Meyer tenía el apellido repetido en el nombre.
UPDATE `users` SET `name` = 'GUILLERMO'
WHERE `Numero_D` = '94472140' AND `Apellido1` = 'ROLDAN' AND `name` = 'GUILLERMO ROLDAN';

COMMIT;

-- Verificación: debe quedar en 0.
SELECT COUNT(*) AS documentos_aun_repetidos
FROM (
  SELECT `Numero_D` FROM `users`
  WHERE `Numero_D` IN ('1062288195', '14959941', '25365374', '53100795', '6316369', '6442402',
                       '16835449', '16941166', '6104990', '94472140')
  GROUP BY `Numero_D`, `rol` HAVING COUNT(*) > 1
) x;

DROP TEMPORARY TABLE IF EXISTS `dup_conservar`;
DROP TEMPORARY TABLE IF EXISTS `dup_map`;
