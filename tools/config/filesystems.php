<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Default Filesystem Disk
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default filesystem disk that should be used
    | by the framework. The "local" disk, as well as a variety of cloud
    | based disks are available to your application for file storage.
    |
    */

    'default' => env('FILESYSTEM_DISK', 'local'),

    /*
    |--------------------------------------------------------------------------
    | Filesystem Disks
    |--------------------------------------------------------------------------
    |
    | Below you may configure as many filesystem disks as necessary, and you
    | may even configure multiple disks for the same driver. Examples for
    | most supported storage drivers are configured here for reference.
    |
    | Supported drivers: "local", "ftp", "sftp", "s3"
    |
    */

    'disks' => [

        'local' => [
            'driver' => 'local',
            'root' => storage_path('app/private'),
            'serve' => true,
            'throw' => false,
            'report' => false,
        ],

        'public' => [
            'driver' => 'local',
            'root' => storage_path('app/public'),
            'url' => env('APP_URL').'/storage',
            'visibility' => 'public',
            'throw' => false,
            'report' => false,
        ],

        // Disco de producción de la aplicación. Todo lo que se conserva más
        // allá de la petición (paquetes, cotizaciones, transferencias y
        // paquetes de CUPS) vive aquí; se accede siempre a través de
        // App\Support\Almacenamiento, nunca nombrando el disco a mano.
        //
        // No se declara 'visibility' a propósito: sin ese valor Flysystem no
        // envía cabecera ACL al subir, que es lo único que funciona en buckets
        // con "Object Ownership: Bucket owner enforced" (el valor por omisión
        // de AWS). El acceso a los archivos se controla en las rutas del
        // controlador, no con ACL de S3.
        's3' => [
            'driver' => 's3',
            'key' => env('AWS_ACCESS_KEY_ID'),
            'secret' => env('AWS_SECRET_ACCESS_KEY'),
            'region' => env('AWS_DEFAULT_REGION'),
            'bucket' => env('AWS_BUCKET'),
            // Prefijo del proyecto dentro del bucket. El bucket es compartido con
            // otros proyectos, así que todo lo de esta aplicación cuelga de aquí y
            // no de la raíz. Flysystem lo agrega y lo quita solo: las rutas que se
            // guardan en base de datos siguen siendo relativas ('paquetes/x.pdf'),
            // de modo que cambiar este valor no obliga a tocar ninguna fila.
            'root' => env('AWS_ROOT', ''),
            // S3 separa con '/' siempre. Sin esto, Laravel arma el prefijo con
            // DIRECTORY_SEPARATOR y en Windows sale 'tools.huv\paquetes/...', que
            // produce URL firmadas apuntando a una clave que no existe.
            'directory_separator' => '/',
            'url' => env('AWS_URL'),
            'endpoint' => env('AWS_ENDPOINT'),
            'use_path_style_endpoint' => env('AWS_USE_PATH_STYLE_ENDPOINT', false),
            // A diferencia del disco local, un fallo aquí suele ser de
            // credenciales, región o permisos del bucket. Con 'throw' en false
            // esos errores se vuelven un put() que devuelve false sin decir por
            // qué, y archivos que desaparecen en silencio.
            'throw' => env('AWS_THROW', true),
            'report' => false,
        ],

    ],

    /*
    |--------------------------------------------------------------------------
    | Symbolic Links
    |--------------------------------------------------------------------------
    |
    | Here you may configure the symbolic links that will be created when the
    | `storage:link` Artisan command is executed. The array keys should be
    | the locations of the links and the values should be their targets.
    |
    */

    'links' => [
        public_path('storage') => storage_path('app/public'),
    ],

];
