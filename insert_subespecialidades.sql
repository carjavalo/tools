-- ============================================================================
-- Carga de subespecialidades en la tabla `subespecialidad`.
--
-- Origen: ESPECIALIDADES TRATANTES HUV DEPURADAS subir.xlsx
--         hoja «Hoja2 (2)», columna A (encabezado "Nombre") -> 58 nombres.
--
-- Qué se guarda en cada columna:
--   Nombre               <- el nombre tal cual viene del archivo
--   cod_SubEspecialidad  <- sb1, sb2, sb3 ... consecutivo desde 1
--   codespcodser         <- serv1, serv2, serv3 ... consecutivo desde 1
--   codminsal            <- Min1, Min2, Min3 ... consecutivo desde 1
--   Estado               <- 1 en todos
--   Observacion          <- NULL (en blanco)
--   especialidad_id      <- NULL (en blanco)
--   id                   <- lo asigna la secuencia AUTO_INCREMENT de la tabla
--
-- Comprobado antes de generar el script:
--   * 58 nombres, ninguno vacío. El más largo tiene 26 caracteres (límite 120).
--   * Los códigos generados caben en sus columnas (máximo 6 de 10 caracteres).
--   * Ningún registro existente usa los prefijos sb, serv ni Min, así que los
--     consecutivos no chocan con lo ya cargado.
--   * El archivo trae nombres repetidos a propósito (ONCOLOGICA, GENERAL,
--     INFANTIL, MAMA): cada uno entra como fila propia con sus propios
--     códigos, porque el nombre no identifica de forma única.
--
-- Es repetible: cada fila entra solo si su cod_SubEspecialidad todavía no
-- existe, así que ejecutarlo dos veces no duplica nada.
--
-- CÓMO APLICARLO:
--   1. Copia de seguridad de la base.
--   2. phpMyAdmin > selecciona la base > pestaña SQL > pega y ejecuta.
-- ============================================================================

INSERT INTO `subespecialidad`
    (`cod_SubEspecialidad`, `codespcodser`, `codminsal`, `Nombre`, `Estado`,
     `Observacion`, `especialidad_id`, `created_at`, `updated_at`)
SELECT
    n.`cod_SubEspecialidad`, n.`codespcodser`, n.`codminsal`, n.`Nombre`, 1,
    NULL, NULL, NOW(), NOW()
FROM (
              SELECT 'sb1'    AS `cod_SubEspecialidad`, 'serv1'    AS `codespcodser`, 'Min1'    AS `codminsal`, 'ORTOPEDIA INFANTIL'             AS `Nombre`
    UNION ALL SELECT 'sb2'   , 'serv2'   , 'Min2'   , 'ORTOPEDIA ONCOLÓGICA'         
    UNION ALL SELECT 'sb3'   , 'serv3'   , 'Min3'   , 'ORTOPEDIA Y TRAUMATOLOGÍA'    
    UNION ALL SELECT 'sb4'   , 'serv4'   , 'Min4'   , 'ORTOPEDIA REEMPLAZO'           
    UNION ALL SELECT 'sb5'   , 'serv5'   , 'Min5'   , 'ORTOPEDIA PIE'                 
    UNION ALL SELECT 'sb6'   , 'serv6'   , 'Min6'   , 'ORTOPEDIA COLUMNA'             
    UNION ALL SELECT 'sb7'   , 'serv7'   , 'Min7'   , 'ORTOPEDIA MIEMBRO SUPERIOR'    
    UNION ALL SELECT 'sb8'   , 'serv8'   , 'Min8'   , 'ORTOPEDIA RECONSTRUCTIVA'      
    UNION ALL SELECT 'sb9'   , 'serv9'   , 'Min9'   , 'ORTOPEDIA RODILLA'             
    UNION ALL SELECT 'sb10'  , 'serv10'  , 'Min10'  , 'CIRUGIA URETRA'                
    UNION ALL SELECT 'sb11'  , 'serv11'  , 'Min11'  , 'INFANTIL'                      
    UNION ALL SELECT 'sb12'  , 'serv12'  , 'Min12'  , 'ONCOLOGICA'                    
    UNION ALL SELECT 'sb13'  , 'serv13'  , 'Min13'  , 'LASER'                         
    UNION ALL SELECT 'sb14'  , 'serv14'  , 'Min14'  , 'CIRUGIA RENAL'                 
    UNION ALL SELECT 'sb15'  , 'serv15'  , 'Min15'  , 'PROSTATA BENIGNA'              
    UNION ALL SELECT 'sb16'  , 'serv16'  , 'Min16'  , 'INCONTINENCIA URINARIA'        
    UNION ALL SELECT 'sb17'  , 'serv17'  , 'Min17'  , 'MISCELANEOS'                   
    UNION ALL SELECT 'sb18'  , 'serv18'  , 'Min18'  , 'NEFROLITOTOMIA PERCUTANEA'     
    UNION ALL SELECT 'sb19'  , 'serv19'  , 'Min19'  , 'HIPERPLASIA PROSTATICA'        
    UNION ALL SELECT 'sb20'  , 'serv20'  , 'Min20'  , 'CABEZA Y CUELLO'               
    UNION ALL SELECT 'sb21'  , 'serv21'  , 'Min21'  , 'ONCOLOGICA'                    
    UNION ALL SELECT 'sb22'  , 'serv22'  , 'Min22'  , 'MAMA'                          
    UNION ALL SELECT 'sb23'  , 'serv23'  , 'Min23'  , 'VASCULAR'                      
    UNION ALL SELECT 'sb24'  , 'serv24'  , 'Min24'  , 'BLOQUEO'                       
    UNION ALL SELECT 'sb25'  , 'serv25'  , 'Min25'  , 'MAXILOFACIAL'                  
    UNION ALL SELECT 'sb26'  , 'serv26'  , 'Min26'  , 'BARIATRICA'                    
    UNION ALL SELECT 'sb27'  , 'serv27'  , 'Min27'  , 'LAPAROSCOPICA'                 
    UNION ALL SELECT 'sb28'  , 'serv28'  , 'Min28'  , 'PISO PELVICO'                  
    UNION ALL SELECT 'sb29'  , 'serv29'  , 'Min29'  , 'GENERAL'                       
    UNION ALL SELECT 'sb30'  , 'serv30'  , 'Min30'  , 'ONCOLOGICA'                    
    UNION ALL SELECT 'sb31'  , 'serv31'  , 'Min31'  , 'CEPER'                         
    UNION ALL SELECT 'sb32'  , 'serv32'  , 'Min32'  , 'HEPATOBILIAR'                  
    UNION ALL SELECT 'sb33'  , 'serv33'  , 'Min33'  , 'CIRUGIA DE TORAX'              
    UNION ALL SELECT 'sb34'  , 'serv34'  , 'Min34'  , 'GENERAL'                       
    UNION ALL SELECT 'sb35'  , 'serv35'  , 'Min35'  , 'OIDO'                          
    UNION ALL SELECT 'sb36'  , 'serv36'  , 'Min36'  , 'SENOS PARANASALES'             
    UNION ALL SELECT 'sb37'  , 'serv37'  , 'Min37'  , 'LARINGE'                       
    UNION ALL SELECT 'sb38'  , 'serv38'  , 'Min38'  , 'MAMA'                          
    UNION ALL SELECT 'sb39'  , 'serv39'  , 'Min39'  , 'LABIO Y PALADAR'               
    UNION ALL SELECT 'sb40'  , 'serv40'  , 'Min40'  , 'ABDOMINOPLASTIA'               
    UNION ALL SELECT 'sb41'  , 'serv41'  , 'Min41'  , 'BIOPOLIMEROS'                  
    UNION ALL SELECT 'sb42'  , 'serv42'  , 'Min42'  , 'GENERAL'                       
    UNION ALL SELECT 'sb43'  , 'serv43'  , 'Min43'  , 'ODONTOLOGIA'                   
    UNION ALL SELECT 'sb44'  , 'serv44'  , 'Min44'  , 'LAPAROSCOPIA'                  
    UNION ALL SELECT 'sb45'  , 'serv45'  , 'Min45'  , 'PARED ABDOMINAL'               
    UNION ALL SELECT 'sb46'  , 'serv46'  , 'Min46'  , 'ANTIRREFLUJO'                  
    UNION ALL SELECT 'sb47'  , 'serv47'  , 'Min47'  , 'COLON Y RECTO'                 
    UNION ALL SELECT 'sb48'  , 'serv48'  , 'Min48'  , 'LIMPOMAS'                      
    UNION ALL SELECT 'sb49'  , 'serv49'  , 'Min49'  , 'ABIERTAS'                      
    UNION ALL SELECT 'sb50'  , 'serv50'  , 'Min50'  , 'COLOPROCTOLOGIA'               
    UNION ALL SELECT 'sb51'  , 'serv51'  , 'Min51'  , 'CIRUGIA PEDIATRICA'            
    UNION ALL SELECT 'sb52'  , 'serv52'  , 'Min52'  , 'COLUMNA'                       
    UNION ALL SELECT 'sb53'  , 'serv53'  , 'Min53'  , 'TRAUMA'                        
    UNION ALL SELECT 'sb54'  , 'serv54'  , 'Min54'  , 'INFANTIL'                      
    UNION ALL SELECT 'sb55'  , 'serv55'  , 'Min55'  , 'FUNCIONAL'                     
    UNION ALL SELECT 'sb56'  , 'serv56'  , 'Min56'  , 'TUMORES'                       
    UNION ALL SELECT 'sb57'  , 'serv57'  , 'Min57'  , 'OFTALMOLOGIA'                  
    UNION ALL SELECT 'sb58'  , 'serv58'  , 'Min58'  , 'OCULOPLASTICA'                 
) AS n
WHERE NOT EXISTS (
    SELECT 1 FROM `subespecialidad` s
    WHERE s.`cod_SubEspecialidad` = n.`cod_SubEspecialidad`
);


-- ----------------------------------------------------------------------------
-- Verificación.
-- ----------------------------------------------------------------------------

-- Ejecuta estas dos por separado si phpMyAdmin se queja: al mostrar el
-- resultado les añade su propio LIMIT y a veces estorba.

SELECT COUNT(*) AS subespecialidades_totales FROM `subespecialidad`;

SELECT COUNT(*) AS cargadas_por_este_script FROM `subespecialidad` WHERE `cod_SubEspecialidad` LIKE 'sb%';
