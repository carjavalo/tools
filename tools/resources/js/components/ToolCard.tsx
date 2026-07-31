import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ToolCardProps {
    title: string;
    description?: string;
    icon?: React.ComponentType<{ className?: string }>;
    children: React.ReactNode;
    className?: string;
    [key: string]: any; // Allow any additional props like data-tour
}

export default function ToolCard({ title, description, icon: Icon, children, className = "", ...rest }: ToolCardProps) {
    return (
        <Card className={`bg-layer-2 border-0 shadow-layer-2 ${className}`} {...rest}>
            <CardHeader className="pb-3 sm:pb-4">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />}
                    <span className="truncate">{title}</span>
                </CardTitle>
                {description && (
                    <CardDescription className="text-xs sm:text-sm">
                        {description}
                    </CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
                {children}
            </CardContent>
        </Card>
    );
}