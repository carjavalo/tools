<?php

namespace App\Services;

use PhpOffice\PhpWord\Writer\PDF\TCPDF as TcpdfRenderer;
use TCPDF;

/**
 * Escritor PDF de PHPWord sin la línea «Powered by TCPDF (www.tcpdf.org)» que
 * TCPDF agrega por defecto al final de cada documento.
 */
class WordPdfWriter extends TcpdfRenderer
{
    protected function createExternalWriterInstance($orientation, $unit, $paperSize)
    {
        $instance = new class($orientation, $unit, $paperSize) extends TCPDF
        {
            public function __construct($orientation, $unit, $format)
            {
                parent::__construct($orientation, $unit, $format);
                $this->tcpdflink = false;
            }
        };

        if ($this->getFont()) {
            $instance->setFont($this->getFont(), $instance->getFontStyle(), $instance->getFontSizePt());
        }

        return $instance;
    }
}
