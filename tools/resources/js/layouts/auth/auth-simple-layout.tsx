import { home } from '@/routes';
import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';

interface AuthLayoutProps {
    name?: string;
    title?: string;
    description?: string;
}

export default function AuthSimpleLayout({
    children,
    title,
    description,
}: PropsWithChildren<AuthLayoutProps>) {
    return (
        <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden p-6 md:p-10">
            {/* Background Image */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/images/nuevologo.jpg')" }}
            />
            {/* Overlay for opacity / readability */}
            <div className="absolute inset-0 z-0 bg-white/60 dark:bg-black/60 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-sm rounded-xl bg-card/95 p-8 shadow-2xl ring-1 ring-border backdrop-blur transition-all">
                <div className="flex flex-col gap-8">
                    <div className="flex flex-col items-center gap-4">
                        <Link
                            href={home()}
                            className="flex flex-col items-center gap-2 font-medium"
                        >
                            {/* En modo oscuro el azul institucional se pierde sobre la tarjeta: se pinta en blanco. */}
                            <img
                                src="/images/logo.png"
                                alt="Hospital Universitario del Valle"
                                className="h-28 w-auto object-contain dark:brightness-0 dark:invert"
                            />
                            <span className="sr-only">{title}</span>
                        </Link>

                        <div className="space-y-2 text-center">
                            <h1 className="text-xl font-medium">{title}</h1>
                            <p className="text-center text-sm text-muted-foreground">
                                {description}
                            </p>
                        </div>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
