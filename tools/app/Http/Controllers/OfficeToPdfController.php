<?php

namespace App\Http\Controllers;

use App\Services\OfficeConversionException;
use App\Services\OfficeToPdfConverter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Base de los conversores a PDF que usan servicios externos (Excel y
 * PowerPoint). Cada uno solo declara qué extensiones acepta y cómo nombrarlo.
 */
abstract class OfficeToPdfController extends Controller
{
    /** @var string[] */
    protected const EXTENSIONS = [];

    // Cómo nombrar el archivo en los mensajes: «un archivo de Excel».
    protected const LABEL = '';

    protected const INVALID_MESSAGE = '';

    public function convert(Request $request, OfficeToPdfConverter $converter): JsonResponse|StreamedResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => ['required', 'file', 'max:25600', 'extensions:'.implode(',', static::EXTENSIONS)],
        ]);

        if ($validator->fails()) {
            return response()->json(['error' => static::INVALID_MESSAGE], 422);
        }

        // Los servicios externos pueden tardar más que el límite de PHP.
        set_time_limit(180);

        $file = $request->file('file');

        try {
            $pdf = $converter->convert($file, static::LABEL);
        } catch (OfficeConversionException $e) {
            return response()->json(['error' => $e->getMessage()], $e->status);
        }

        $name = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME).'_converted.pdf';

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf;
        }, $name, ['Content-Type' => 'application/pdf']);
    }
}
