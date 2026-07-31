import { useAppearance } from '@/hooks/use-appearance';

export default function BasicThemeToggle() {
    const { appearance, updateAppearance } = useAppearance();
    
    const toggleTheme = () => {
        if (appearance === 'dark') {
            updateAppearance('light');
        } else {
            updateAppearance('dark');
        }
    };

    const isDark = appearance === 'dark';

    return (
        <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center w-10 h-10 rounded-md border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm hover:shadow-md"
            title={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
            type="button"
        >
            {isDark ? (
                // Sun icon for light mode
                <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="text-yellow-500"
                >
                    <circle cx="12" cy="12" r="5"/>
                    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
            ) : (
                // Moon icon for dark mode
                <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    className="text-blue-600"
                >
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            )}
            <span className="sr-only">
                Cambiar tema a {isDark ? 'claro' : 'oscuro'}
            </span>
        </button>
    );
}