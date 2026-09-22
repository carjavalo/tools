-- ============================================================================
--  Herramientas - Estado Actual "Programado" pasa a "Programado x Programacion"
--  Script para aplicar en phpMyAdmin (pestaña SQL) sobre la base uoxclxvl_tools.
--
--  POR QUÉ: los 16 radicados de la grilla "Ver programados" ya tienen cirugía
--  programada, pero su Estado Actual no lo refleja. Al filtrar por estado en la
--  pestaña INFORMES de /tools/radicar-solicitud no aparecían. El filtro compara
--  RadicarCaso.estRad, así que el cambio se hace SOLO en ese campo.
--
--  QUÉ HACE:
--    1. Renombra el estado del catálogo "Programado" a "Programado x Programacion"
--       (mismo id: las asignaciones de estados por rol se conservan).
--    2. Deja en la bitácora del caso (trazabilidad_caso) el cambio de Estado
--       Actual de cada radicado, igual que cuando se cambia desde la aplicación.
--    3. Pone ese estado a los radicados de la lista, solo si de verdad tienen
--       una programación de cirugía registrada (tabla programacion_caso).
--    4. Verificación.
--
--  No toca el Estado QX ("Programados"), ni la programación, ni ningún otro
--  campo del caso. Es seguro ejecutarlo más de una vez: la segunda vez no
--  cambia nada ni duplica la bitácora.
--
--  ANTES: haga una copia de seguridad de la base (cPanel > Copia de seguridad).
--  Seleccione la base uoxclxvl_tools y pegue TODO el contenido en la pestaña SQL.
-- ============================================================================


-- Radicados a actualizar (N° Caso de la grilla "Ver programados").
-- Hora actual de Colombia (UTC-5, sin horario de verano): la aplicación guarda
-- las fechas en America/Bogota y el reloj de MySQL del servidor puede estar en
-- otra zona.
SET @casos := '127,200,132,36,214,202,34,30,146,215,157,22,121,17,27,195';
SET @ahora := CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '-05:00');


-- PASO 1 -- Renombrar el estado en el catálogo. Se busca por nombre y no por
-- id, porque los ids cambian entre la base local y la del servidor. Si ya se
-- renombró antes, no encuentra "Programado" y no hace nada.

UPDATE `EstRadicado`
SET `Nombre` = 'Programado x Programacion',
    `updated_at` = @ahora
WHERE TRIM(`Nombre`) = 'Programado';

SET @estado := (
  SELECT `id` FROM `EstRadicado`
  WHERE `Nombre` = 'Programado x Programacion'
  ORDER BY `id`
  LIMIT 1
);


-- PASO 2 -- Bitácora del caso: una fila "Estado Actual: <anterior> ->
-- Programado x Programacion" por radicado. Va ANTES del cambio para poder
-- leer el estado anterior. Solo entran los que aún no tienen el estado nuevo,
-- así una segunda ejecución no duplica filas.

INSERT INTO `trazabilidad_caso`
  (`codrad`, `user_id`, `evento`, `campo`, `etiqueta`, `anterior`, `nuevo`, `created_at`, `updated_at`)
SELECT
  rc.`codrad`,
  NULL,
  'modificacion',
  'estRad',
  'Estado Actual',
  COALESCE(ea.`Nombre`, '—'),
  'Programado x Programacion',
  @ahora,
  @ahora
FROM `RadicarCaso` rc
LEFT JOIN `EstRadicado` ea ON ea.`id` = rc.`estRad`
WHERE @estado IS NOT NULL
  AND FIND_IN_SET(rc.`codrad`, @casos) > 0
  AND (rc.`estRad` IS NULL OR rc.`estRad` <> @estado)
  AND EXISTS (SELECT 1 FROM `programacion_caso` pc WHERE pc.`codrad` = rc.`codrad`);


-- PASO 3 -- Cambiar el Estado Actual de los radicados. Mismas condiciones que
-- el paso 2. Si el estado no existiera (@estado vacío) no se toca nada: así
-- nunca se deja un caso sin estado.

UPDATE `RadicarCaso` rc
SET rc.`estRad` = @estado,
    rc.`updated_at` = @ahora
WHERE @estado IS NOT NULL
  AND FIND_IN_SET(rc.`codrad`, @casos) > 0
  AND (rc.`estRad` IS NULL OR rc.`estRad` <> @estado)
  AND EXISTS (SELECT 1 FROM `programacion_caso` pc WHERE pc.`codrad` = rc.`codrad`);


-- PASO 4 -- Verificación.
--
-- Es UNA sola consulta a propósito: phpMyAdmin vuelve a ejecutar la última
-- sentencia para paginarla.
--
-- Resultado esperado: 16 filas, todas con "Programado x Programacion" en
-- Estado Actual y "Sí" en Tiene programación. Si algún radicado no aparece,
-- ese N° Caso no existe en la base. Si aparece con otro estado y "NO" en
-- Tiene programación, no se cambió porque no tiene cirugía programada.

SELECT
  rc.`codrad` AS 'N° Caso',
  rc.`Ndocumento` AS 'Identificación',
  COALESCE(ea.`Nombre`, '—') AS 'Estado Actual',
  IF(EXISTS (SELECT 1 FROM `programacion_caso` pc WHERE pc.`codrad` = rc.`codrad`), 'Sí', 'NO') AS 'Tiene programación',
  rc.`updated_at` AS 'Actualizado'
FROM `RadicarCaso` rc
LEFT JOIN `EstRadicado` ea ON ea.`id` = rc.`estRad`
WHERE rc.`codrad` IN (127,200,132,36,214,202,34,30,146,215,157,22,121,17,27,195)
ORDER BY rc.`codrad`;
