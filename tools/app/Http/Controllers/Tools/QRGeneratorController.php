<?php

namespace App\Http\Controllers\Tools;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Validator;
use SimpleSoftwareIO\QrCode\Facades\QrCode;
use Intervention\Image\Facades\Image;

class QRGeneratorController extends Controller
{
    /**
     * Generate QR Code
     */
    public function generate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'text' => 'required|string|max:2000',
            'size' => 'integer|min:64|max:2048',
            'errorCorrectionLevel' => 'in:L,M,Q,H',
            'includeInstitutionalLogo' => 'boolean',
            'format' => 'in:png,svg,jpeg',
            'backgroundColor' => 'string|max:7',
            'foregroundColor' => 'string|max:7'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'error' => 'Datos inválidos',
                'details' => $validator->errors()
            ], 422);
        }

        try {
            $text = $request->input('text');
            $size = $request->input('size', 256);
            $errorCorrectionLevel = $request->input('errorCorrectionLevel', 'M');
            $includeInstitutionalLogo = $request->input('includeInstitutionalLogo', false);
            $format = $request->input('format', 'png');
            $backgroundColor = $request->input('backgroundColor', '#ffffff');
            $foregroundColor = $request->input('foregroundColor', '#000000');

            // Create QR Code
            $qrCode = QrCode::size($size)
                ->errorCorrection($errorCorrectionLevel)
                ->color(
                    hexdec(substr($foregroundColor, 1, 2)),
                    hexdec(substr($foregroundColor, 3, 2)),
                    hexdec(substr($foregroundColor, 5, 2))
                )
                ->backgroundColor(
                    hexdec(substr($backgroundColor, 1, 2)),
                    hexdec(substr($backgroundColor, 3, 2)),
                    hexdec(substr($backgroundColor, 5, 2))
                );

            // Handle different formats
            if ($format === 'svg') {
                $qrContent = $qrCode->format('svg')->generate($text);
                
                if ($includeInstitutionalLogo) {
                    // For SVG with logo, we need to embed the logo into the SVG
                    $qrContent = $this->addLogoToSvg($qrContent);
                }

                return response($qrContent)
                    ->header('Content-Type', 'image/svg+xml')
                    ->header('Content-Disposition', 'inline; filename="qr-code-evaristools.svg"');
            } else {
                // Generate PNG/JPEG
                $qrContent = $qrCode->format('png')->generate($text);
                
                if ($includeInstitutionalLogo) {
                    $qrContent = $this->addLogoToQrCode($qrContent, $size);
                }

                // Convert to JPEG if needed
                if ($format === 'jpeg') {
                    $image = Image::make($qrContent)->encode('jpg', 90);
                    $contentType = 'image/jpeg';
                    $filename = 'qr-code-evaristools.jpg';
                } else {
                    $image = $qrContent;
                    $contentType = 'image/png';
                    $filename = 'qr-code-evaristools.png';
                }

                return response($image)
                    ->header('Content-Type', $contentType)
                    ->header('Content-Disposition', 'inline; filename="' . $filename . '"');
            }

        } catch (\Exception $e) {
            \Log::error('QR Code generation error: ' . $e->getMessage());
            
            return response()->json([
                'error' => 'Error generando el código QR',
                'message' => 'Por favor intenta de nuevo más tarde.'
            ], 500);
        }
    }

    /**
     * Add institutional logo to QR Code
     */
    private function addLogoToQrCode($qrContent, $size)
    {
        try {
            // Create image from QR code
            $qrImage = Image::make($qrContent);
            
            // Path to institutional logo
            $logoPath = public_path('images/huv-logo.png');
            
            // Check if logo exists, if not create a placeholder
            if (!file_exists($logoPath)) {
                // Create a simple placeholder logo
                $logo = Image::canvas(60, 60, '#1e40af');
                $logo->text('HUV', 30, 30, function($font) {
                    $font->file(public_path('fonts/arial.ttf'));
                    $font->size(12);
                    $font->color('#ffffff');
                    $font->align('center');
                    $font->valign('center');
                });
            } else {
                $logo = Image::make($logoPath);
            }
            
            // Calculate logo size (about 15% of QR code)
            $logoSize = intval($size * 0.15);
            $logo->resize($logoSize, $logoSize, function ($constraint) {
                $constraint->aspectRatio();
                $constraint->upsize();
            });
            
            // Add white background circle behind logo for better visibility
            $logoWithBackground = Image::canvas($logoSize + 10, $logoSize + 10, '#ffffff');
            $logoWithBackground->insert($logo, 'center');
            
            // Insert logo in the center of QR code
            $qrImage->insert($logoWithBackground, 'center');
            
            return $qrImage->encode('png');
            
        } catch (\Exception $e) {
            \Log::error('Logo addition error: ' . $e->getMessage());
            // Return original QR code if logo addition fails
            return $qrContent;
        }
    }

    /**
     * Add institutional logo to SVG QR Code
     */
    private function addLogoToSvg($svgContent)
    {
        try {
            // Simple SVG logo insertion (basic implementation)
            $logoSvg = '<circle cx="50%" cy="50%" r="25" fill="#ffffff" stroke="#1e40af" stroke-width="2"/>
                       <text x="50%" y="50%" text-anchor="middle" dy=".3em" font-family="Arial" font-size="10" fill="#1e40af">HUV</text>';
            
            // Insert logo before closing </svg> tag
            $svgWithLogo = str_replace('</svg>', $logoSvg . '</svg>', $svgContent);
            
            return $svgWithLogo;
            
        } catch (\Exception $e) {
            \Log::error('SVG logo addition error: ' . $e->getMessage());
            return $svgContent;
        }
    }

    /**
     * Show QR Generator page
     */
    public function index()
    {
        return inertia('tools/qr-generator');
    }
}
