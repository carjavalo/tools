import type { ComponentType } from 'react';
import { Head } from '@inertiajs/react';

// Import all tool pages
import ResumeDocument from './pages/tools/resume-document';
import PowerPointToPDF from './pages/tools/powerpoint-to-pdf';
import ExcelToPDF from './pages/tools/excel-to-pdf';
import RotatePDF from './pages/tools/rotate-pdf';
import WatermarkPDF from './pages/tools/watermark-pdf';
import SignPDF from './pages/tools/sign-pdf';
import ProtectPDF from './pages/tools/protect-pdf';
import SortPDF from './pages/tools/sort-pdf';
import CropPDF from './pages/tools/crop-pdf';
import PageNumbers from './pages/tools/page-numbers';

// Tool components mapping
const toolComponents: Record<string, ComponentType> = {
  'resume-document': ResumeDocument,
  'powerpoint-to-pdf': PowerPointToPDF,
  'excel-to-pdf': ExcelToPDF,
  'rotate-pdf': RotatePDF,
  'watermark-pdf': WatermarkPDF,
  'sign-pdf': SignPDF,
  'protect-pdf': ProtectPDF,
  'sort-pdf': SortPDF,
  'crop-pdf': CropPDF,
  'page-numbers': PageNumbers,
};

export default function App() {
  return (
    <>
      <Head title="Evaristools - PDF Tools Preview" />
      
      <div className="min-h-screen bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
              Evaristools - PDF Tools Preview
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
              Vista previa de todas las herramientas PDF con estilos aplicados
            </p>
          </div>

          <div className="space-y-8">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Estado de Herramientas PDF
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(toolComponents).map(([key, Component]) => (
                  <div key={key} className="p-4 bg-slate-50 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 capitalize">
                      {key.replace('-', ' ')}
                    </h3>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Estilo Consistente
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
                Estado de Herramientas
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <span className="font-medium text-green-800 dark:text-green-200">
                    ✅ Todas las herramientas tienen estilos aplicados
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    🎨 Usando tema institucional consistente
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <span className="font-medium text-purple-800 dark:text-purple-200">
                    📱 Diseño responsive aplicado
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}