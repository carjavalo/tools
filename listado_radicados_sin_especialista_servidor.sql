-- ============================================================================
--  LISTADO: radicados sin especialista (médico) asignado, o cuyo especialista
--  fue borrado de la base de usuarios.
--
--  El especialista de la radicación es el campo "Médico *" de Nueva
--  Radicación / Modificar Radicado (RadicarCaso.codMed → users.id).
--
--  Solo consulta: no modifica ni borra nada.
--
--  CÓMO SACARLO EN EXCEL:
--    1. phpMyAdmin > seleccione la base de tools.huv.gov.co > pestaña SQL >
--       pegue esta consulta y ejecute.
--    2. Debajo del resultado: "Exportar" > Formato "CSV para MS Excel"
--       (o "Hoja de cálculo OpenDocument") > Continuar.
--       Si aparecen más de 25 filas por página, active antes
--       "Mostrar todo" para que el archivo salga completo.
-- ============================================================================

SELECT
    r.codrad AS `N° Radicado`,
    COALESCE(
        (SELECT e.Nombre FROM especialidad e WHERE e.espcodser = r.Codesp LIMIT 1),
        NULLIF(r.Codesp, ''),
        'Sin especialidad'
    ) AS `Especialidad`,
    CASE
        WHEN r.codMed IS NULL OR r.codMed = '' THEN 'Sin especialista asignado'
        ELSE 'Especialista borrado'
    END AS `Situación`,
    NULLIF(r.codMed, '') AS `Id especialista registrado`,
    r.sede AS `Sede`,
    r.ambito AS `Ámbito`,
    DATE(r.created_at) AS `Fecha radicación`
FROM RadicarCaso r
LEFT JOIN users u ON u.id = r.codMed
WHERE r.codMed IS NULL
   OR r.codMed = ''
   OR u.id IS NULL
ORDER BY r.codrad;
