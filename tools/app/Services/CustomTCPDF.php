<?php

namespace App\Services;

use TCPDF;

class CustomTCPDF extends TCPDF
{
    /**
     * Override the default constructor to set proper margins
     */
    public function __construct($orientation = 'P', $unit = 'mm', $format = 'A4', $unicode = true, $encoding = 'UTF-8', $diskcache = false)
    {
        parent::__construct($orientation, $unit, $format, $unicode, $encoding, $diskcache);
        
        // Set margins (left, top, right) in mm
        $this->SetMargins(20, 20, 20);
        
        // Set auto page breaks
        $this->SetAutoPageBreak(true, 20);
        
        // Set image scale factor
        $this->setImageScale(PDF_IMAGE_SCALE_RATIO);
        
        // Set default font
        $this->SetFont('helvetica', '', 11);
    }
    
    /**
     * Override header to prevent default header
     */
    public function Header()
    {
        // Intentionally left empty to avoid default header
    }
    
    /**
     * Override footer to prevent default footer
     */
    public function Footer()
    {
        // Intentionally left empty to avoid default footer
    }
}
