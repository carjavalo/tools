<?php

namespace App\Http\Controllers;

class ExcelToPDFController extends OfficeToPdfController
{
    protected const EXTENSIONS = ['xls', 'xlsx'];

    protected const LABEL = 'un archivo de Excel';

    protected const INVALID_MESSAGE = 'Archivo inválido. Solo se permiten archivos Excel (.xls o .xlsx) de máximo 25MB.';
}
