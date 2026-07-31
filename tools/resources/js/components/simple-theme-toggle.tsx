import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { Moon, Sun } from 'lucide-react';
import { type HTMLAttributes } from 'react';

interface SimpleThemeToggleProps extends HTMLAttributes<HTMLDivElement> {
    showLabel?: boolean;
}

export default function SimpleThemeToggle({ 
    className = '', 
    showLabel = false,
    ...props 
}: SimpleThemeToggleProps) {
    const { appearance, updateAppearance } = useAppearance();
    
    const toggleTheme = () => {
        // Simple toggle between light and dark (skip system for simplicity)
        if (appearance === 'dark') {
            updateAppearance('light');
        } else {
            updateAppearance('dark');
        }
    };

    const isDark = appearance === 'dark';

    return (
        <div className={className} {...props}>
            <Button
                variant="outline"
                size={showLabel ? "default" : "icon"}
                onClick={toggleTheme}
                className="h-9 border-2 border-primary/20 hover:border-primary/40 transition-all duration-200"
                title={`Cambiar a modo ${isDark ? 'claro' : 'oscuro'}`}
            >
                {isDark ? (
                    <Sun className="h-5 w-5 text-yellow-500" />
                ) : (
                    <Moon className="h-5 w-5 text-blue-500" />
                )}
                {showLabel && (
                    <span className="ml-2">
                        {isDark ? 'Modo Claro' : 'Modo Oscuro'}
                    </span>
                )}
                <span className="sr-only">
                    Cambiar tema a {isDark ? 'claro' : 'oscuro'}
                </span>
            </Button>
        </div>
    );
}