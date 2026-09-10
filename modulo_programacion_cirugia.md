# Módulo de Programación de Cirugía

Documento explicativo del módulo tal como está implementado hoy en la aplicación.

---

## 1. Dos cosas con el mismo nombre

Conviene separarlas desde el principio, porque en la aplicación conviven:

1. **La opción de menú "Programación de Cirugía"** (`/tools/programacion-cirugia`, Sede Cali).
   Es la pantalla propia del módulo. Hoy es un **marcador de posición**: muestra el
   encabezado, el ícono y una tarjeta que dice "Módulo en construcción". No tiene todavía
   consultas ni formularios.

2. **La programación de cirugía que sí opera**, que vive **dentro de "Radicar Solicitud"**.
   Es donde realmente se programa una cirugía, se consulta lo programado y se corrige.
   Funciona como una extensión del ciclo de vida de la radicación: cuando un caso llega al
   Estado QX "Programados", se captura la cita quirúrgica.

Todo lo que sigue describe el punto 2, que es el que está en producción.

---

## 2. Para qué sirve

Llevar el **control de las radicaciones que quedaron programadas para cirugía**: cuándo se
opera, quién la va a realizar y qué observaciones dejó el servicio, sin perder la relación
con el caso radicado (paciente, especialidad, médico tratante, paquete y cotizaciones).

La pieza central es una **bitácora**: cada vez que un caso pasa a "Programados" queda una
fila nueva. No se sobrescribe la anterior. Así, si un caso se reprograma varias veces,
queda constancia de cada programación con quién la registró y cuándo.

---

## 3. Cómo se programa una cirugía (flujo del usuario)

1. Entrar a **Radicar Solicitud → pestaña Historial** y buscar el caso.
2. Abrir el formulario **"Aplicar Modificaciones al Caso"**.
3. En el campo **Estado QX** escoger **"Programados"** (del catálogo `EstRadisecundario`).
4. Al escogerlo se **activan tres campos** que hasta ese momento no estaban visibles:

   | Campo | Tipo | Notas |
   |---|---|---|
   | **Fecha y Hora de Programación** | `datetime-local` | Lleva hora, no solo fecha |
   | **Especialista Médico** | Lista desplegable | Se escoge del banco de médicos (usuarios con rol `Medico`). El botón **+** permite crear uno nuevo sin salir del formulario |
   | **Observaciones Prg** | Texto largo | Observaciones de la programación (máx. 10.000 caracteres) |

   Los tres son **opcionales**: se puede marcar el caso como programado y completar los
   datos después.

5. Guardar. Si más adelante el Estado QX deja de ser "Programados", los tres campos se
   limpian solos en el formulario y no se envían.

### Detección del estado "Programados"

El sistema **no depende de un id fijo** del catálogo (que cambia entre la base local y la
del servidor). Compara el **nombre** del Estado QX sin tildes, sin mayúsculas y por
prefijo `programad`, de modo que sirven "Programado", "Programados" o "PROGRAMADA".
La misma regla está implementada en el backend y en el frontend para que ambos coincidan.

### Qué ocurre al guardar

Todo se ejecuta dentro de **una sola transacción**:

- Se crea la **foto del seguimiento** (`seguimiento_caso`).
- Se aplican al **caso** solo los campos diligenciados (no se vacía nada con blancos) y se
  registra el detalle campo a campo en la **bitácora de trazabilidad**.
- **Si —y solo si— el Estado QX es "Programados"**, se crea la fila en `programacion_caso`
  con los tres campos, el `codrad` del caso y el usuario que la registró.

Los campos de programación viajan aparte en la petición: se retiran antes de escribir el
caso y el seguimiento, porque **no son columnas de ninguna de esas dos tablas**.

---

## 4. Consulta: "Ver programados"

Desde el mismo formulario del Historial hay un botón **"Ver programados"** que abre el
modal **"Radicaciones programadas para cirugía"**.

- **Contenido**: una fila por programación, ordenadas por fecha y hora de programación de
  la más reciente a la más antigua (tope de 5.000 filas).
- **Columnas**: N° Caso, Paciente, Identificación, Especialidad, Médico (tratante),
  Especialista Médico, Fecha y Hora Prog., Paquete, Cotización, Observaciones Prg y
  Acciones.
- **Paquete y cotizaciones** se entregan como enlaces a rutas con permisos, no como URLs
  del disco (en S3 el bucket es privado).
- **Filtro de texto**: busca por N° de caso, documento, paciente, especialidad o médico.
- **Exportar a Excel**: descarga exactamente lo que muestra la grilla, ya filtrado, como
  `radicaciones-programadas-AAAA-MM-DD.xlsx`. La librería se carga solo al pulsar el
  botón, para no engordar la vista.

La consulta cruza programación, radicación, paciente, especialidad, especialista y
adjuntos **por lotes** —una consulta por relación, no una por fila— para no multiplicar el
acceso a la base.

### Acciones por fila

| Acción | Qué hace |
|---|---|
| **Ver radicado** | Cierra el modal y deja el caso abierto en el Historial, que es donde se consulta y se modifica |
| **Editar** | Corrige los tres campos de la programación: fecha, especialista y observaciones. La radicación en sí **no** se modifica desde aquí. A diferencia del formulario de seguimiento, aquí se **reemplaza**: un campo que se deja vacío se guarda vacío |
| **Borrar** | Elimina la fila de la bitácora de programaciones. **El caso y su Estado QX quedan como están**, porque lo que se corrige es el registro de la cirugía programada, no el estado de la radicación |

---

## 5. Trazabilidad

Toda corrección y todo borrado quedan en la **bitácora del caso**, igual que los cambios
del formulario de seguimiento:

- **Al editar**: por cada campo que efectivamente cambió se registra un evento de tipo
  `programacion` con la etiqueta legible ("Fecha y Hora de Programación", "Especialista
  Médico", "Observaciones Prg") y el valor **anterior y nuevo** en texto legible —el
  nombre del especialista en lugar de su id, la fecha con hora, y un guion cuando el campo
  quedó vacío—. El "antes" se congela antes de escribir, porque después del `update` ya no
  hay forma de reconstruirlo.
- **Al borrar**: queda un evento con el resumen de lo eliminado (`Fecha: … — Especialista:
  …`). Sin él, el caso no conservaría ninguna huella de que estuvo programado.

La razón de fondo: una programación reescrita sin rastro dejaría el historial contando
algo distinto de lo que ve la grilla.

---

## 6. Permisos

El acceso lo gobierna el **Gestor de Permisos** (middleware `permiso.auto`):

- **Opción de menú** `programacion-cirugia` — "Programación de Cirugía Sede Cali", acción
  `ver`. Operador y Super Admin pasan por defecto; los demás roles requieren permiso
  explícito.
- **Sub-vista** `radicar-solicitud-programados` — "Grilla ver programados", con acciones
  `ver`, `editar` y `borrar`. Rige los botones de cada fila del modal.
  - `ver` habilita el botón "Ver radicado" y es la **llave** de los otros dos: sin `ver`,
    ni `editar` ni `borrar` surten efecto.
  - **Hay que asignarla expresamente al rol.** Sin ella, solo el Super Admin ve los
    botones: son acciones sobre lo ya programado y no se reparten solas.

Las rutas de edición y borrado cuelgan de `/programacion/{id}` y no de `/{caso}`
precisamente para que el middleware pueda distinguirlas y regirlas por esa sub-vista.

Las peticiones sin sesión responden **401** (no una página de login), para que la vista
pueda distinguir "sesión caducada" de "no hay datos" y no muestre mensajes engañosos como
"no se encontró el caso" o grillas vacías.

---

## 7. Modelo de datos

**Tabla `programacion_caso`** (modelo `App\Models\ProgramacionCaso`):

| Columna | Tipo | Descripción |
|---|---|---|
| `id` | bigint | Llave primaria |
| `codrad` | bigint | Radicación a la que pertenece (indexado) |
| `fecha_programacion` | datetime | Fecha **y hora** de la cirugía |
| `especialista_medico_id` | bigint | Usuario con rol `Medico` que realizará la cirugía |
| `observaciones_prg` | text | Observaciones de la programación |
| `user_id` | bigint | Quién registró la programación |
| `created_at` / `updated_at` | timestamp | Cuándo |

Decisiones de diseño relevantes:

- **Sin llave foránea a `RadicarCaso`**: se relaciona por `codrad`, igual que
  `seguimiento_caso`.
- **El especialista apunta al banco de médicos**, no es un texto suelto; la validación
  exige que el usuario exista y tenga rol `Medico`.
- **Vive aparte del caso y del seguimiento** porque es una bitácora con vida propia.

Se crea con la migración `2026_09_04_000001_create_programacion_caso_table`. Para
servidores donde no se puede ejecutar `php artisan migrate`, existe el script equivalente
`crear_tabla_programacion_servidor.sql`, pensado para pegarse en phpMyAdmin: crea la tabla,
registra la migración como aplicada y verifica el resultado. Es seguro ejecutarlo más de
una vez.

---

## 8. Sede Cartago

Existe la entrada **"Programación de Cirugía Sede Cartago"** con su propia pantalla de
inicio de sesión, visualmente idéntica a la de Cali. **El módulo aún no está habilitado**:
el formulario apunta a una ruta que siempre rechaza el intento con el mensaje "El módulo de
Programación de Cirugía Sede Cartago aún no está habilitado", de modo que por ahora nadie
puede ingresar por ahí.

---

## 9. Estado actual y pendientes

**Funcionando hoy:**

- Registro de la programación desde el Estado QX "Programados".
- Grilla "Ver programados" con filtro, exportación a Excel y enlaces a PDFs.
- Edición y borrado de programaciones con trazabilidad completa.
- Control de acceso por rol vía Gestor de Permisos.
- Pruebas automatizadas en `tests/Feature/ProgramacionCasoTest.php`.

**Pendiente:**

- La pantalla propia `/tools/programacion-cirugia` (Sede Cali) sigue "en construcción": el
  contenido y las funcionalidades se irán incorporando.
- Sede Cartago no está habilitada.

---

## 10. Referencia rápida de rutas

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/tools/programacion-cirugia` | Pantalla del módulo (en construcción) |
| `GET` / `POST` | `/tools/programacion-cirugia-cartago` | Login Sede Cartago (siempre rechaza) |
| `POST` | `/tools/radicar-solicitud/{caso}/seguimiento` | Aplica modificaciones; crea la programación si el Estado QX es "Programados" |
| `GET` | `/tools/radicar-solicitud/programados` | Datos de la grilla "Ver programados" |
| `PUT` | `/tools/radicar-solicitud/programacion/{id}` | Editar una programación |
| `DELETE` | `/tools/radicar-solicitud/programacion/{id}` | Borrar una programación |

### Archivos principales

- `tools/app/Models/ProgramacionCaso.php`
- `tools/app/Http/Controllers/RadicarCasoController.php` (`aplicarModificacion`,
  `programados`, `actualizarProgramacion`, `destroyProgramacion`, `esEstadoProgramado`,
  `valorProgramacion`)
- `tools/resources/js/pages/tools/radicar-solicitud.tsx` (formulario y modal)
- `tools/resources/js/pages/tools/programacion-cirugia.tsx` (pantalla en construcción)
- `tools/database/migrations/2026_09_04_000001_create_programacion_caso_table.php`
- `crear_tabla_programacion_servidor.sql`
