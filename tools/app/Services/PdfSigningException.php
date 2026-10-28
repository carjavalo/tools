<?php

namespace App\Services;

use RuntimeException;

/**
 * Fallo al firmar un PDF con un mensaje apto para mostrarle al usuario y el
 * código HTTP con que debe responderse.
 */
class PdfSigningException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
