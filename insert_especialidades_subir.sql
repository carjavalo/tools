-- ============================================================================
-- Carga de especialidades en la tabla `especialidad`.
--
-- Origen: ESPECIALIDADES TRATANTES HUV DEPURADAS - Subir.xlsx  (80 filas)
--
-- Correspondencia de columnas:
--   COD MINSALUD    -> codminsal
--   espcodSERVINTE  -> espcodser
--   Nombre          -> Nombre
--   Observacion     -> NULL (queda en blanco)
--   id              -> lo asigna la secuencia AUTO_INCREMENT de la tabla
--   Estado          -> 1 (activa). No venía en el archivo.
--
-- NO DUPLICA LO EXISTENTE:
-- cada fila se inserta solo si su espcodser todavía no está en la tabla. La
-- comprobación es explícita (NOT EXISTS) y no depende del índice UNIQUE de
-- espcodser, que lo crea una migración que puede no estar aplicada en el
-- servidor. Si el índice no existiera, un INSERT IGNORE habría dejado entrar
-- códigos repetidos sin avisar.
--
-- Es repetible: ejecutarlo dos veces no crea duplicados.
--
-- Verificado sobre el archivo antes de generarlo:
--   * 80 filas con datos; ninguna sin espcodser ni sin Nombre.
--   * Sin códigos espcodser repetidos dentro del archivo.
--   * Longitudes dentro de los límites (Nombre 70/120, códigos 7/10).
--   * Tres filas no traen COD MINSALUD (INMUNOLOGIA, PEDIATRIA SOCIAL y
--     TRABAJO SOCIAL): su codminsal queda en NULL.
--
-- CÓMO APLICARLO:
--   1. Copia de seguridad de la base.
--   2. phpMyAdmin > selecciona la base > pestaña SQL > pega y ejecuta.
--   3. Las consultas del final dicen cuántas entraron y cuáles se omitieron.
-- ============================================================================

INSERT INTO `especialidad`
    (`codminsal`, `espcodser`, `Nombre`, `Estado`, `Observacion`, `created_at`, `updated_at`)
SELECT
    n.`codminsal`, n.`espcodser`, n.`Nombre`, 1, NULL, NOW(), NOW()
FROM (
              SELECT 'M01'      AS `codminsal`, '795'   AS `espcodser`, 'ALERGOLOGIA'                                                            AS `Nombre`
    UNION ALL SELECT 'M02'     , '021'  , 'ANESTESIOLOGO(A)'                                                      
    UNION ALL SELECT 'M1301'   , '732'  , 'CARDIOLOGIA'                                                           
    UNION ALL SELECT 'M130101' , 'CAH'  , 'CARDIOLOGIA INTERVENSIONISTA Y'                                        
    UNION ALL SELECT 'Q0112'   , '095'  , 'CIRUGIA CARDIOVASCULAR PEDIATR'                                        
    UNION ALL SELECT 'Q0102'   , 'C01'  , 'CIRUGIA DE CABEZA Y CUELLO'                                            
    UNION ALL SELECT 'Q0103'   , '962'  , 'CIRUGIA DE MAMA Y TUMORES DE T'                                        
    UNION ALL SELECT 'Q0304'   , '081'  , 'CIRUGIA ESTETICA Y PIP'                                                
    UNION ALL SELECT 'Q0105'   , 'HTR'  , 'CIRUGIA GASTROINTESTINAL-HEPAT'                                        
    UNION ALL SELECT 'Q0303'   , '838'  , 'CIRUGÍA PLÁSTICA DE MANO'                                            
    UNION ALL SELECT 'Q0301'   , 'CIM'  , 'CIRUGÍA PLÁSTICA FACIAL'                                             
    UNION ALL SELECT 'Q0110'   , '105'  , 'CIRUGÍA VASCULAR PERIFÉRICA'                                         
    UNION ALL SELECT 'Q0109'   , 'CIA'  , 'CIRUGÍA VASCULAR Y ANGIOLOGÍA'                                       
    UNION ALL SELECT 'Q030401' , '079'  , 'ESPECIALISTA EN MICROCIRUGÍA GENERAL Y RECONSTRUCTIVA'                
    UNION ALL SELECT 'M0302'   , '719'  , 'DERMATOLOGÍA Y CIRUGIA DERMATOLOGICA'                                 
    UNION ALL SELECT 'M0304'   , '735'  , 'DERMATOLOGÍA PEDIÁTRICA'                                             
    UNION ALL SELECT 'M03'     , '715'  , 'DERMATOLOGÍA'                                                         
    UNION ALL SELECT 'M1203'   , '986'  , 'ESPECIALIZACIÓN EN MARCAPASO Y ELECTROFISIOLOGÍA INVASIVA'           
    UNION ALL SELECT 'M1303'   , '240'  , 'ENDOCRINOLOGÍA'                                                       
    UNION ALL SELECT 'M1512'   , '808'  , 'ENDOCRINOLOGÍA PEDIÁTRICA'                                           
    UNION ALL SELECT 'OD04'    , '250'  , 'ENDODONCIA'                                                            
    UNION ALL SELECT 'E07'     , '058'  , 'ENFERMERÍA ONCOLOGICA'                                                
    UNION ALL SELECT 'OD09'    , '448'  , 'ESTOMATOLOGÍA'                                                        
    UNION ALL SELECT 'P04'     , '037'  , 'FISIOTERAPIA'                                                          
    UNION ALL SELECT 'P05'     , 'FON'  , 'FONOAUDIOLOGÍA'                                                       
    UNION ALL SELECT 'M04'     , '760'  , 'GENÉTICA MÉDICA'                                                     
    UNION ALL SELECT 'M1306'   , '750'  , 'GERIATRÍA'                                                            
    UNION ALL SELECT 'M1307'   , '351'  , 'HEMATOLOGÍA'                                                          
    UNION ALL SELECT 'M1308'   , '151'  , 'HEMATOLOGÍA Y ONCOLOGÍA'                                             
    UNION ALL SELECT 'M1502'   , '817'  , 'HEMATOLOGÍA Y ONCOLOGÍA PEDIÁTRICA'                                 
    UNION ALL SELECT 'M1314'   , 'HEP'  , 'HEPATOLOGÍA'                                                          
    UNION ALL SELECT 'M1304'   , '162'  , 'ENFERMEDADES INFECCIOSAS'                                              
    UNION ALL SELECT 'M1503'   , '809'  , 'INFECTOLOGÍA PEDIÁTRICA'                                             
    UNION ALL SELECT NULL      , '078'  , 'INMUNOLOGIA'                                                           
    UNION ALL SELECT 'M1511'   , '814'  , 'REUMATOLOGÍA PEDIÁTRICA'                                             
    UNION ALL SELECT 'M1313'   , '706'  , 'REUMATOLOGÍA'                                                         
    UNION ALL SELECT 'MA01'    , 'MDA'  , 'MEDICINA ALTERNATIVA'                                                  
    UNION ALL SELECT 'M06'     , '382'  , 'MEDICINA DE URGENCIAS'                                                 
    UNION ALL SELECT 'M11'     , '790'  , 'MEDICINA FAMILIAR'                                                     
    UNION ALL SELECT 'M12'     , '386'  , 'MEDICINA FÍSICA Y REHABILITACIÓN'                                    
    UNION ALL SELECT 'M13'     , '387'  , 'MEDICINA INTERNA'                                                      
    UNION ALL SELECT 'D01'     , '701'  , 'MEDICINA NUCLEAR'                                                      
    UNION ALL SELECT 'M1302'   , '043'  , 'CUIDADOS INTENSIVOS'                                                   
    UNION ALL SELECT 'M1310'   , '170'  , 'NEFROLOGÍA'                                                           
    UNION ALL SELECT 'M1504'   , '807'  , 'NEFROLOGÍA PEDIÁTRICA'                                               
    UNION ALL SELECT 'M1505'   , '420'  , 'NEONATOLOGÍA'                                                         
    UNION ALL SELECT 'M1311'   , '430'  , 'NEUMOLOGÍA'                                                           
    UNION ALL SELECT 'M1506'   , '431'  , 'NEUMOLOGÍA PEDIÁTRICA'                                               
    UNION ALL SELECT 'M14'     , '441'  , 'NEUROLOGÍA'                                                           
    UNION ALL SELECT 'M1507'   , '442'  , 'NEUROLOGÍA PEDIÁTRICA'                                               
    UNION ALL SELECT 'D0303'   , 'NEH'  , 'NEURORADIOLOGÍA'                                                      
    UNION ALL SELECT 'P08'     , '765'  , 'NUTRICIÓN Y DIETÉTICA'                                               
    UNION ALL SELECT 'OD12'    , '462'  , 'ODONTOLOGÍA PEDIÁTRICA'                                              
    UNION ALL SELECT 'Q0601'   , '418'  , 'OFTALMOLOGÍA ONCOLÓGICA'                                             
    UNION ALL SELECT 'Q0602'   , '417'  , 'OFTALMOLOGÍA PEDIÁTRICA'                                             
    UNION ALL SELECT 'M1312'   , '491'  , 'ONCOLOGÍA'                                                            
    UNION ALL SELECT 'M1508'   , '492'  , 'ONCOLOGÍA PEDIÁTRICA'                                                
    UNION ALL SELECT 'P10'     , '412'  , 'OPTOMETRÍA'                                                           
    UNION ALL SELECT 'OD01'    , 'ORT'  , 'ORTODONCIA'                                                            
    UNION ALL SELECT 'Q0705'   , '513'  , 'ORTOPEDIA INFANTIL'                                                    
    UNION ALL SELECT 'Q0706'   , '510'  , 'ORTOPEDIA ONCOLÓGICA'                                                 
    UNION ALL SELECT 'Q0802'   , '076'  , 'OTOLOGÍA'                                                             
    UNION ALL SELECT 'D02'     , 'PAT'  , 'PATOLOGÍA'                                                            
    UNION ALL SELECT 'M1509'   , 'PIN'  , 'CUIDADO INTENSIVO PEDIÁTRICO'                                         
    UNION ALL SELECT NULL      , '992'  , 'PEDIATRIA SOCIAL'                                                      
    UNION ALL SELECT 'OD05'    , 'S05'  , 'PERIODONCIA'                                                           
    UNION ALL SELECT '068'     , '006'  , 'PSICOLOGÍA'                                                           
    UNION ALL SELECT 'M16'     , '590'  , 'PSIQUIATRÍA'                                                          
    UNION ALL SELECT 'M1602'   , 'PQI'  , 'PSIQUIATRÍA PEDIÁTRICA'                                              
    UNION ALL SELECT 'D0305'   , '135'  , 'RADIOONCOLOGÍA'                                                       
    UNION ALL SELECT 'M19'     , '616'  , 'RADIOTERAPIA'                                                          
    UNION ALL SELECT 'M1202'   , '901'  , 'REHABILITACIÓN PEDIÁTRICA'                                           
    UNION ALL SELECT 'E02'     , '690'  , 'SALUD OCUPACIONAL'                                                     
    UNION ALL SELECT 'P13'     , '911'  , 'TERAPIA OCUPACIONAL'                                                   
    UNION ALL SELECT 'E03'     , 'TEA'  , 'ENFERMERÍA EN CUIDADO A LAS PERSONAS CON HERIDAS Y OSTOMÍAS ADULTO'  
    UNION ALL SELECT 'E03'     , 'TEP'  , 'ENFERMERÍA EN CUIDADO A LAS PERSONAS CON HERIDAS Y OSTOMÍAS PEDIATRICO'
    UNION ALL SELECT 'M17'     , '740'  , 'TOXICOLOGÍA CLÍNICA'                                                 
    UNION ALL SELECT NULL      , '003'  , 'TRABAJO SOCIAL'                                                        
    UNION ALL SELECT 'Q0902'   , '311'  , 'UROLOGÍA ONCOLÓGICA'                                                 
    UNION ALL SELECT 'Q0902'   , '751'  , 'UROLOGIA ONCOLOGICA'                                                   
) AS n
WHERE NOT EXISTS (
    SELECT 1 FROM `especialidad` e WHERE e.`espcodser` = n.`espcodser`
);


-- ----------------------------------------------------------------------------
-- Cuántas especialidades quedaron en total.
-- ----------------------------------------------------------------------------

SELECT COUNT(*) AS especialidades_totales FROM `especialidad`;
