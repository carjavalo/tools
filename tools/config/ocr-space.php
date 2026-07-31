<?php

return [
    /**
     * ---------------------------------------------------------------
     * OCR Space API Key
     * ---------------------------------------------------------------
     */
    'api_key' => env('OCR_SPACE_API_KEY'),

    /**
     * ---------------------------------------------------------------
     * OCR Space API URL
     * ---------------------------------------------------------------
     */
    'api_url' => env('OCR_SPACE_API_URL', 'https://api.ocr.space/parse/image'),

    /**
     * ---------------------------------------------------------------
     * OCR Space Request Timeout (in seconds)
     * ---------------------------------------------------------------
     * Increased to 120 seconds (2 minutes) to handle large/complex images
     */
    'timeout' => env('OCR_SPACE_TIMEOUT', 120),
];
