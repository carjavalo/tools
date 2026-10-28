<?php

namespace App\Services;

use RuntimeException;

/**
 * Fallo de una conversión a PDF con un mensaje apto para mostrarle al
 * usuario y el código HTTP con que debe responderse.
 */
class OfficeConversionException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 502)
    {
        parent::__construct($message);
    }
}
