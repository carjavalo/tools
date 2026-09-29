# Genera insertar_pacientes_censo.sql a partir de CensoHospitalario_or.xlsx.
#
# Columnas del Excel (todas las hojas, desde la fila 2):
#   A → Apellido1   B → apellido2   C → name   E → tipo_Docu   F → Numero_D   M → Eps
# Fijos: rol = 'paciente', password = 'notieneclave',
#        email = paciente1@noaplica.com, paciente2@..., en orden de aparición.
# El resto de columnas queda NULL.
#
# Un mismo paciente (mismo número de documento) aparece en varias hojas
# o varias veces en Egresados: se inserta una sola vez (primera aparición).
#
# Uso: python generar_sql_pacientes_censo.py
import openpyxl

ORIGEN = r"E:\documentacion proyectos\tools\documentos\CensoHospitalario_or.xlsx"
DESTINO = r"C:\xampp\htdocs\tools\insertar_pacientes_censo.sql"
LOTE = 500

# Largo máximo de cada columna en la tabla users.
LARGOS = {"Apellido1": 50, "apellido2": 50, "name": 255, "tipo_Docu": 120, "Numero_D": 20, "Eps": 120}


def texto(v):
    if v is None:
        return None
    s = " ".join(str(v).split())
    return s or None


def sql(v):
    if v is None:
        return "NULL"
    return "'" + v.replace("\\", "\\\\").replace("'", "''") + "'"


wb = openpyxl.load_workbook(ORIGEN, data_only=True)
filas, vistos = [], set()
por_hoja, repetidos, sin_documento, recortes = {}, 0, 0, []

for ws in wb.worksheets:
    n = 0
    for r in ws.iter_rows(min_row=2, max_col=13, values_only=True):
        ap1, ap2, nombre, tipo, numero, eps = (texto(r[i]) for i in (0, 1, 2, 4, 5, 12))
        if not (ap1 or nombre):
            continue
        clave = numero  # mismo criterio que el SQL: el número de documento
        if numero:
            if clave in vistos:
                repetidos += 1
                continue
            vistos.add(clave)
        else:
            sin_documento += 1
        valores = {"Apellido1": ap1, "apellido2": ap2, "name": nombre or "", "tipo_Docu": tipo, "Numero_D": numero, "Eps": eps}
        for col, largo in LARGOS.items():
            if valores[col] and len(valores[col]) > largo:
                recortes.append((ws.title, col, valores[col]))
                valores[col] = valores[col][:largo]
        filas.append(valores)
        n += 1
    por_hoja[ws.title] = n

COLS = "(`Apellido1`, `apellido2`, `name`, `tipo_Docu`, `Numero_D`, `Eps`)"
TABLA_TMP = """CREATE TEMPORARY TABLE `{nombre}` (
  `orden` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `Apellido1` VARCHAR(50) NULL, `apellido2` VARCHAR(50) NULL, `name` VARCHAR(255) NOT NULL,
  `tipo_Docu` VARCHAR(120) NULL, `Numero_D` VARCHAR(20) NULL, `Eps` VARCHAR(120) NULL,
  KEY (`Numero_D`)
) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
"""
with open(DESTINO, "w", encoding="utf-8", newline="\n") as f:
    f.write("-- Inserción de pacientes del Censo Hospitalario en la tabla users (base de datos tools).\n")
    f.write("-- Origen: CensoHospitalario_or.xlsx, hojas: " + ", ".join(f"{k} ({v})" for k, v in por_hoja.items()) + "\n")
    f.write(f"-- Pacientes en el censo: {len(filas)} (un paciente repetido en varias hojas se cuenta una sola vez).\n")
    f.write("-- Columnas: A→Apellido1, B→apellido2, C→name, E→tipo_Docu, F→Numero_D, M→Eps; rol='paciente',\n")
    f.write("-- email=pacienteN@noaplica.com, password='notieneclave'; el resto de campos queda NULL.\n")
    f.write("--\n")
    f.write("-- Se IGNORAN los pacientes cuyo Numero_D ya existe en users. Se puede ejecutar varias\n")
    f.write("-- veces: la segunda vez no inserta nada. Los correos siguen la numeración a partir del\n")
    f.write("-- último pacienteN@noaplica.com que ya exista, así nunca se repiten.\n\n")
    f.write("SET NAMES utf8mb4;\n\n")
    f.write("DROP TEMPORARY TABLE IF EXISTS `censo_pacientes`;\n")
    f.write("DROP TEMPORARY TABLE IF EXISTS `censo_nuevos`;\n")
    f.write(TABLA_TMP.format(nombre="censo_pacientes"))
    for i in range(0, len(filas), LOTE):
        f.write(f"\nINSERT INTO `censo_pacientes` {COLS} VALUES\n")
        lineas = []
        for v in filas[i:i + LOTE]:
            lineas.append("(" + ", ".join([
                sql(v["Apellido1"]), sql(v["apellido2"]), sql(v["name"]), sql(v["tipo_Docu"]),
                sql(v["Numero_D"]), sql(v["Eps"]),
            ]) + ")")
        f.write(",\n".join(lineas) + ";\n")
    f.write("\n-- Solo los que no están en users, numerados de nuevo en el orden del Excel.\n")
    f.write(TABLA_TMP.format(nombre="censo_nuevos"))
    f.write(f"""INSERT INTO `censo_nuevos` {COLS}
SELECT c.`Apellido1`, c.`apellido2`, c.`name`, c.`tipo_Docu`, c.`Numero_D`, c.`Eps`
FROM `censo_pacientes` c
WHERE NOT EXISTS (SELECT 1 FROM `users` u WHERE u.`Numero_D` = c.`Numero_D`)
ORDER BY c.`orden`;

SET @base := (
  SELECT COALESCE(MAX(CAST(SUBSTRING_INDEX(SUBSTRING(`email`, 9), '@', 1) AS UNSIGNED)), 0)
  FROM `users` WHERE `email` REGEXP '^paciente[0-9]+@noaplica\\\\.com$'
);

START TRANSACTION;
INSERT INTO `users` (`Apellido1`, `apellido2`, `name`, `tipo_Docu`, `Numero_D`, `Eps`, `rol`, `email`, `password`)
SELECT n.`Apellido1`, n.`apellido2`, n.`name`, n.`tipo_Docu`, n.`Numero_D`, n.`Eps`,
       'paciente', CONCAT('paciente', CAST(n.`orden` + @base AS UNSIGNED), '@noaplica.com'), 'notieneclave'
FROM `censo_nuevos` n
ORDER BY n.`orden`;
COMMIT;

-- Resumen
SELECT (SELECT COUNT(*) FROM `censo_pacientes`) AS pacientes_en_censo,
       (SELECT COUNT(*) FROM `censo_nuevos`) AS insertados,
       (SELECT COUNT(*) FROM `censo_pacientes`) - (SELECT COUNT(*) FROM `censo_nuevos`) AS ya_existian;

DROP TEMPORARY TABLE IF EXISTS `censo_pacientes`;
DROP TEMPORARY TABLE IF EXISTS `censo_nuevos`;
""")

print("Por hoja:", por_hoja)
print("Total a insertar:", len(filas), "| repetidos omitidos:", repetidos, "| sin documento:", sin_documento)
print("Recortados por largo:", recortes[:10], len(recortes))
print("SQL:", DESTINO)
