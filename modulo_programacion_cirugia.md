# Módulo de Programación de Cirugía

Documento explicativo del módulo tal como está implementado hoy en la aplicación.

---

## 1. Dos cosas con el mismo nombre

Conviene separarlas desde el principio, porque en la aplicación conviven:

1. **La opción de menú "Programación de Cirugía"** (`/tools/programacion-cirugia`).
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

- **Opción de menú** `programacion-cirugia` — "Programación de Cirugía", acción `ver`.
  Operador y Super Admin pasan por defecto; los demás roles requieren permiso explícito.
  A qué **sede** entra cada rol no se decide aquí, sino en la sección **Sedes** del
  mismo Gestor (ver sección 8).
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

## 8. Sedes: Cali y Cartago

Las radicaciones se crean y se trabajan **por sede**. En el inicio hay dos opciones:
**"Programación de Cirugía Sede Cali"** y **"Programación de Cirugía Sede Cartago"**.
La opción por la que se entra define la **sede activa** de la sesión:

- **Lo que se radica queda en esa sede** (columna `RadicarCaso.sede`). La sede no viaja
  en la petición: la pone el modelo con la sede activa, así que nadie puede radicar en
  una sede a la que su rol no entra.
- **Solo se ven y se operan las radicaciones de esa sede**: grilla del Historial,
  búsqueda por caso o cédula, Informes, "Ver programados", sus botones, y los PDF del
  paquete y de las cotizaciones. Una radicación de la otra sede responde 404 aunque se
  pida por su URL.
- El seguimiento, la bitácora, las cotizaciones y las programaciones **no llevan sede
  propia**: la heredan de su radicación por el `codrad`.
- Los catálogos (especialidades, CUPS, EPS, convenios, estados), los pacientes y los
  médicos **son comunes a las dos sedes**. Si a un paciente le cambian la cédula, se
  repuntan sus radicaciones de ambas sedes.

**Cómo se entra:**

| Opción | Sin sesión | Con sesión abierta |
|---|---|---|
| Sede Cali (`/tools/programacion-cirugia-cali`) | Lleva al login general (`/login`), que es el de Cali | Pasa a trabajar en Cali si el rol la tiene |
| Sede Cartago (`/tools/programacion-cirugia-cartago`) | Muestra el login propio de Cartago | Pasa a trabajar en Cartago si el rol la tiene |

Si el rol no tiene la sede de la opción, el login se rechaza con un mensaje que indica
por qué opción sí puede entrar; con sesión abierta, sigue en su sede y se le avisa en el
Inicio. La sede activa se ve en el menú lateral (bajo "Programación de Cirugía"), en el
banner del Inicio y en la barra de pestañas de Radicar Solicitud.

**Qué sedes tiene cada rol** (Gestor de Permisos → sección **Sedes**, tabla `role_sedes`):

- Se marca Sede Cali, Sede Cartago o ambas. Al menos una es obligatoria.
- **Sin configurar, el rol solo entra a Cali**, que es donde operaban todos antes de
  existir Cartago.
- **Super Admin** entra siempre a las dos, con todas las opciones.
- **Paciente y Médico** no se configuran: son el banco de personas común a las dos
  sedes y no se restringen por sede.

Una sesión sin sede (abierta antes de este cambio o restaurada por "Recordarme") toma la
primera sede que el rol tenga. La lógica vive en `App\Support\Sede`, y el filtro es un
alcance global (`sede`) de los modelos `RadicarCaso`, `ProgramacionCaso` y
`CotizacionCaso`; lo que deba cruzar sedes lo quita con `withoutGlobalScope('sede')`.

Todo lo radicado antes de este cambio quedó en **Sede Cali**. Para servidores donde no se
puede ejecutar `php artisan migrate`, existe `crear_sedes_servidor.sql`, equivalente a las
migraciones `2026_09_10_000001_add_sede_to_radicar_caso_table` y
`2026_09_10_000002_create_role_sedes_table`. Debe aplicarse antes de subir el código (o
junto): sin la columna `sede`, Radicar Solicitud falla.

---

## 9. Estado actual y pendientes

**Funcionando hoy:**

- Registro de la programación desde el Estado QX "Programados".
- Grilla "Ver programados" con filtro, exportación a Excel y enlaces a PDFs.
- Edición y borrado de programaciones con trazabilidad completa.
- Control de acceso por rol vía Gestor de Permisos.
- Radicaciones por sede (Cali y Cartago), con las sedes de cada rol configurables.
- Pruebas automatizadas en `tests/Feature/ProgramacionCasoTest.php` y
  `tests/Feature/SedeTest.php`.

**Pendiente:**

- La pantalla propia `/tools/programacion-cirugia` sigue "en construcción": el contenido
  y las funcionalidades se irán incorporando.
- Herramientas - Seguimiento (bitácora general) todavía muestra la actividad de las dos
  sedes juntas.

---

## 10. Referencia rápida de rutas

| Método | Ruta | Propósito |
|---|---|---|
| `GET` | `/tools/programacion-cirugia` | Pantalla del módulo (en construcción) |
| `GET` | `/tools/programacion-cirugia-cali` | Entrada Sede Cali: login general o cambio de sede |
| `GET` / `POST` | `/tools/programacion-cirugia-cartago` | Login Sede Cartago o cambio de sede |
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
- Sedes: `tools/app/Support/Sede.php`, `tools/app/Http/Controllers/Auth/AuthenticatedSessionController.php`
  (entradas y login por sede), `tools/database/migrations/2026_09_10_00000{1,2}_*.php`,
  `crear_sedes_servidor.sql`
