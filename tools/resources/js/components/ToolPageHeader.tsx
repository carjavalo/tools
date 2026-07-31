import { Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2 } from 'lucide-react';

interface ToolPageHeaderProps {
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    showPopularBadge?: boolean;
}

export default function ToolPageHeader({ title, description, icon: Icon, showPopularBadge = false }: ToolPageHeaderProps) {
    return (
        <div className="bg-layer-1 backdrop-blur-sm border-b border-border/50">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
                {/* Responsive layout: Stack on mobile, horizontal on desktop */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    {/* Left section */}
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                        {/* Back button */}
                        <Link href="/" className="flex-shrink-0">
                            <Button variant="outline" size="sm" className="h-9 sm:h-10">
                                <ArrowLeft className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">Volver</span>
                            </Button>
                        </Link>
                        
                        {/* Icon */}
                        <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 flex items-center justify-center rounded-lg bg-primary-layer-1 text-institutional">
                            <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        
                        {/* Title & Description */}
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">
                                    {title}
                                </h1>
                                {showPopularBadge && (
                                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                                        Popular
                                    </Badge>
                                )}
                            </div>
                            <p className="text-xs sm:text-sm lg:text-base text-slate-600 dark:text-slate-300 line-clamp-2 sm:line-clamp-1">
                                {description}
                            </p>
                        </div>
                    </div>
                    
                    {/* Right badge - Hidden on mobile, visible on tablet+ */}
                    <Badge variant="secondary" className="hidden sm:flex items-center gap-1 flex-shrink-0">
                        <Building2 className="h-3 w-3" />
                        <span>HUV</span>
                    </Badge>
                </div>
            </div>
        </div>
    );
}