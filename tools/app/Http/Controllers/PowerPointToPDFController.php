<?php

namespace App\Http\Controllers;

class PowerPointToPDFController extends OfficeToPdfController
{
    protected const EXTENSIONS = ['ppt', 'pptx'];

    protected const LABEL = 'una presentación de PowerPoint';

    protected const INVALID_MESSAGE = 'Archivo inválido. Solo se permiten archivos PowerPoint (.ppt o .pptx) de máximo 25MB.';
}
