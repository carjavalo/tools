-- ============================================================================
-- Corrige los nombres de tabla en el servidor (Linux / cPanel).
--
-- POR QUÉ: MySQL en Windows (XAMPP) usa lower_case_table_names = 1 y guarda
-- TODOS los nombres de tabla en minúscula, además de ignorar mayúsculas al
-- consultar. Linux usa lower_case_table_names = 0 y SÍ distingue. Por eso el
-- respaldo llega con 'estradicado' y la aplicación, que pide 'EstRadicado',
-- responde: Base table or view not found: 1146.
--
-- Solo cuatro tablas del proyecto llevan mayúsculas; el resto ya coincide.
--
-- CÓMO APLICARLO en cPanel:
--   1. Haz primero una copia de seguridad de la base de datos
--      (cPanel > Asistente de copia de seguridad > Copia parcial > Bases de datos).
--   2. Entra a phpMyAdmin y selecciona la base uoxclxvl_tools en el panel izquierdo.
--   3. Abre la pestaña SQL, pega este contenido y ejecuta.
--   4. Verifica con la última consulta que queden los cuatro nombres correctos.
--
-- Si al ejecutar dice "Table 'EstRadicado' already exists", esa tabla ya estaba
-- bien: borra esa línea y vuelve a ejecutar el resto.
-- Si dice "Table 'estradicado' doesn't exist", entonces la tabla no llegó en el
-- respaldo: ahí el problema no es el nombre sino que falta importar los datos.
-- ============================================================================

-- Ejecuta las líneas UNA POR UNA. Si alguna falla, las demás igual sirven.
-- No se usa information_schema: muchos hosts compartidos lo tienen bloqueado
-- y devuelven "#1044 Acceso denegado ... a la base de datos information_schema".

RENAME TABLE `estradicado`       TO `EstRadicado`;
RENAME TABLE `estradisecundario` TO `EstRadisecundario`;
RENAME TABLE `radicarcaso`       TO `RadicarCaso`;
RENAME TABLE `cuvsanezados`      TO `cuvsAnezados`;

-- Verificación (SHOW no requiere permisos especiales): en el listado deben
-- verse EstRadicado, EstRadisecundario, RadicarCaso y cuvsAnezados con sus
-- mayúsculas tal cual.
SHOW TABLES;
