import { EvarisdropDashboard } from './components/evarisdrop/EvarisdropDashboard';

export default function AppEvarisdrop() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
            Evarisdrop Preview
          </h1>
          <p className="text-slate-600 dark:text-slate-300">
            Sistema de transferencia de archivos entre dispositivos
          </p>
        </div>
        
        <EvarisdropDashboard
          appName="Evarisdrop"
          maxFileSize={52428800}
          networkName="Evaristools Network"
        />
      </div>
    </div>
  );
}