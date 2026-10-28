<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'resend' => [
        'key' => env('RESEND_KEY'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // Conversión de Excel y PowerPoint a PDF: se prueban en este orden y se
    // salta el que no tenga clave. Los nombres de las variables se conservan
    // de la versión anterior para no tocar el .env de producción.
    'cloudconvert' => [
        'key' => env('CLOUDCONVERT_API_KEY'),
    ],

    'convertapi' => [
        'token' => env('CONVERTAPI_SECRET'),
    ],

    'pdfco' => [
        'key' => env('PDFCO_API_KEY'),
    ],

    // Resumir Documento. El plan gratuito de Groq admite unos 8.000 tokens por
    // minuto (entrada + respuesta): ~16.000 caracteres por resumen. Con un plan
    // de pago puede subirse GROQ_SUMMARY_MAX_CHARS (el modelo admite ~400.000).
    'groq' => [
        'key' => env('GROQ_API_KEY'),
        'model' => env('GROQ_MODEL', 'openai/gpt-oss-120b'),
        'summary_max_chars' => (int) env('GROQ_SUMMARY_MAX_CHARS', 16000),
    ],

];
