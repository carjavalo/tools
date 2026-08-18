# Almacenamiento en Amazon S3

Toda la información que la aplicación conserva más allá de la petición que la
creó vive en el disco configurado en `FILESYSTEM_DISK`. Con `s3` eso es un
bucket de Amazon; con `local` vuelve al disco del servidor sin tocar código.

## 1. Variables del `.env`

```env
FILESYSTEM_DISK=s3

AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=nombre-del-bucket
AWS_USE_PATH_STYLE_ENDPOINT=false

# Carpeta del proyecto dentro del bucket. El bucket es compartido con otros
# proyectos, así que todo lo de esta aplicación cuelga de aquí.
AWS_ROOT=tools.huv

# Solo para almacenamientos compatibles con S3 que no son AWS (MinIO, Wasabi,
# DigitalOcean Spaces). Con AWS se dejan vacíos.
AWS_ENDPOINT=
AWS_URL=
```

Después de editar el `.env`:

```bash
php artisan config:clear
```

## 2. Qué se guarda en el bucket

Todo cuelga de la carpeta del proyecto (`AWS_ROOT`), no de la raíz del bucket:

```
almacenamientohuv/
├── tools.huv/          ← esta aplicación
│   ├── paquetes/
│   ├── cotizaciones/
│   ├── transfers/
│   └── downloads/
└── proyecto1/          ← otros proyectos, intactos
```

| Carpeta         | Contenido                                            | Referenciado desde     |
| --------------- | ---------------------------------------------------- | ---------------------- |
| `paquetes/`     | PDF del paquete de cada radicación                   | `radicar_caso.paquete` |
| `cotizaciones/` | PDF adjunto a cada cotización                        | `cotizacion_caso.adjunto` |
| `transfers/`    | Archivos en tránsito de Evarisdrop (caducan a la hora) | caché                |
| `downloads/`    | Paquetes ZIP/TAR de CUPS ya procesados               | respuesta del proceso  |

En base de datos se guarda la **ruta relativa** (`paquetes/abc.pdf`), sin el
prefijo, el bucket ni el dominio. Flysystem agrega y quita `tools.huv/` solo, así
que cambiar `AWS_ROOT` —o el bucket entero— no obliga a tocar ninguna fila:
basta mover los objetos.

## 3. Qué NO se sube, y por qué

Los conversores (Word/Excel/PowerPoint a PDF, firmar PDF, proteger PDF, OCR,
resumen de documentos) y el árbol de trabajo de CUPS siguen usando
`storage/app/temp`. Son archivos que abren librerías nativas —TCPDF, PhpWord,
ZipArchive, PharData— que exigen una ruta real del sistema de ficheros, y que
se borran dentro de la misma petición. Subirlos a S3 solo agregaría latencia y
un objeto que habría que borrar enseguida.

## 4. Acceso a los archivos

El bucket debe ser **privado**. Ningún archivo se entrega por su URL de S3:

- El paquete se abre en `GET /tools/radicar-solicitud/{caso}/paquete`.
- El adjunto de una cotización, en
  `GET /tools/radicar-solicitud/cotizacion/{cotizacion}/adjunto`.

Ambas rutas pasan por los permisos del Gestor de Permisos y transmiten el
archivo desde el bucket. Así un PDF de historia clínica no queda accesible a
quien conserve un enlace.

Si en algún caso se necesita una URL directa, `Almacenamiento::url()` devuelve
una URL firmada con vigencia de 15 minutos.

## 5. Permisos mínimos del usuario IAM

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:ListBucket"],
      "Resource": "arn:aws:s3:::NOMBRE-DEL-BUCKET"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::NOMBRE-DEL-BUCKET/*"
    }
  ]
}
```

No se necesita `s3:PutObjectAcl`: la aplicación no envía ACL en las subidas, a
propósito, para funcionar en buckets con *Object Ownership: Bucket owner
enforced* (el valor por omisión de AWS).

## 6. Migrar los archivos que ya están en el servidor

Con las credenciales puestas y `FILESYSTEM_DISK=s3`:

```bash
php artisan archivos:migrar-nube --simular
```

Eso muestra qué subiría sin escribir nada. Cuando el listado se vea bien:

```bash
php artisan archivos:migrar-nube
```

El comando copia `storage/app/public/paquetes` y
`storage/app/public/cotizaciones` al bucket conservando la misma ruta, así que
las filas de base de datos no hay que tocarlas. Omite lo que ya exista en el
destino (`--forzar` lo vuelve a subir).

Una vez verificado que los PDF se abren desde la aplicación, se puede liberar
el disco del servidor:

```bash
php artisan archivos:migrar-nube --eliminar-origen
```

El original solo se borra después de comprobar que el objeto quedó en el
bucket.

> **El comando sube lo que hay en el disco de la máquina donde se ejecuta.**
> Los PDF viejos viven en el servidor, no en el equipo de desarrollo, así que
> hay que correrlo también allá. Para saber qué falta:
>
> ```bash
> php artisan tinker --execute="foreach (App\Models\RadicarCaso::whereNotNull('paquete')->get(['codrad','paquete']) as \$c) { echo \$c->codrad.' '.\$c->paquete.' '.(App\Support\Almacenamiento::existe(\$c->paquete) ? 'OK' : 'FALTA').PHP_EOL; }"
> ```

## 7. Dónde tocar el código

Todo pasa por `App\Support\Almacenamiento` (`tools/app/Support/Almacenamiento.php`).
Los controladores no nombran el disco: si mañana hay que cambiar de proveedor,
se cambia ahí y en `config/filesystems.php`, no en cada controlador.
