import BasicThemeToggle from '@/components/basic-theme-toggle';
import { useAppearance } from '@/hooks/use-appearance';

export default function ThemeTogglePreview() {
    const { appearance } = useAppearance();

    return (
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
            {/* Simple Header */}
            <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold text-sm">E</span>
                            </div>
                            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                Evaristools
                            </h1>
                        </div>
                        
                        {/* Theme Toggle Button - VERY VISIBLE */}
                        <div className="flex items-center space-x-4">
                            <span className="text-sm text-gray-600 dark:text-gray-300 hidden sm:block">
                                Tema:
                            </span>
                            <BasicThemeToggle />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="space-y-8">
                    {/* Status Card */}
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6">
                        <div className="text-center space-y-4">
                            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                                🌓 Control de Tema Activo
                            </h2>
                            <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                                <span className="font-semibold">
                                    Modo actual: {appearance === 'dark' ? '🌙 Oscuro' : appearance === 'light' ? '☀️ Claro' : '🖥️ Sistema'}
                                </span>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-lg">
                                El botón de tema está en la esquina superior derecha ↗️
                            </p>
                        </div>
                    </div>

                    {/* Demo Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Light Mode Demo */}
                        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">☀</span>
                                </div>
                                <h3 className="font-semibold text-gray-900">Modo Claro</h3>
                            </div>
                            <p className="text-gray-600 text-sm mb-4">
                                Interfaz brillante con fondo blanco y texto oscuro
                            </p>
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-100 rounded"></div>
                                <div className="h-3 bg-gray-200 rounded"></div>
                                <div className="h-3 bg-gray-300 rounded"></div>
                            </div>
                        </div>

                        {/* Dark Mode Demo */}
                        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-sm">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">🌙</span>
                                </div>
                                <h3 className="font-semibold text-white">Modo Oscuro</h3>
                            </div>
                            <p className="text-gray-300 text-sm mb-4">
                                Interfaz oscura con fondo negro y texto claro
                            </p>
                            <div className="space-y-2">
                                <div className="h-3 bg-gray-700 rounded"></div>
                                <div className="h-3 bg-gray-600 rounded"></div>
                                <div className="h-3 bg-gray-500 rounded"></div>
                            </div>
                        </div>

                        {/* Toggle Demo */}
                        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-900 border border-blue-200 dark:border-gray-700 rounded-lg p-6 shadow-sm">
                            <div className="flex items-center space-x-2 mb-4">
                                <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center">
                                    <span className="text-white text-xs">⚡</span>
                                </div>
                                <h3 className="font-semibold text-gray-900 dark:text-white">Toggle Activo</h3>
                            </div>
                            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
                                Haz clic en el botón de arriba para cambiar
                            </p>
                            <div className="flex justify-center">
                                <BasicThemeToggle />
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                        <h3 className="font-bold text-blue-900 dark:text-blue-100 text-lg mb-3">
                            📍 Instrucciones
                        </h3>
                        <div className="space-y-2 text-blue-800 dark:text-blue-200">
                            <p>• El botón de tema está en la esquina superior derecha</p>
                            <p>• Haz clic para alternar entre modo claro y oscuro</p>
                            <p>• Tu preferencia se guarda automáticamente</p>
                            <p>• El cambio es inmediato en toda la aplicación</p>
                        </div>
                    </div>

                    {/* Test Buttons */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                            Botón Azul
                        </button>
                        <button className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg transition-colors">
                            Botón Gris
                        </button>
                        <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                            Botón Verde
                        </button>
                        <button className="border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white px-4 py-2 rounded-lg transition-colors">
                            Botón Outline
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}