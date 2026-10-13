import {
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { UserInfo } from '@/components/user-info';
import { useMobileNavigation } from '@/hooks/use-mobile-navigation';
import { logout } from '@/routes';
import { edit as editPassword } from '@/routes/password';
import { edit as editProfile } from '@/routes/profile';
import { type SharedData, type User } from '@/types';
import { Link, router, usePage } from '@inertiajs/react';
import { KeyRound, LogOut, UserCog } from 'lucide-react';

interface UserMenuContentProps {
    user: User;
}

export function UserMenuContent({ user }: UserMenuContentProps) {
    const cleanup = useMobileNavigation();
    // Opciones de la cuenta habilitadas al rol en el Gestor Menú de Usuario;
    // sin configurar, se permiten.
    const menuUsuario = usePage<SharedData>().props.auth.menuUsuario ?? {};
    const puedePerfil = menuUsuario.perfil !== false;
    const puedePassword = menuUsuario.password !== false;

    const handleLogout = () => {
        cleanup();
        router.flushAll();
    };

    return (
        <>
            <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                    <UserInfo user={user} showEmail={true} />
                </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(puedePerfil || puedePassword) && (
                <>
                    <DropdownMenuGroup>
                        {puedePerfil && (
                            <DropdownMenuItem asChild>
                                <Link
                                    className="block w-full"
                                    href={editProfile()}
                                    as="button"
                                    prefetch
                                    onClick={cleanup}
                                >
                                    <UserCog className="mr-2" />
                                    Cambiar cuenta
                                </Link>
                            </DropdownMenuItem>
                        )}
                        {puedePassword && (
                            <DropdownMenuItem asChild>
                                <Link
                                    className="block w-full"
                                    href={editPassword()}
                                    as="button"
                                    prefetch
                                    onClick={cleanup}
                                >
                                    <KeyRound className="mr-2" />
                                    Cambiar contraseña
                                </Link>
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                </>
            )}
            <DropdownMenuItem asChild>
                <Link
                    className="block w-full"
                    href={logout()}
                    as="button"
                    onClick={handleLogout}
                    data-test="logout-button"
                >
                    <LogOut className="mr-2" />
                    Cerrar sesión
                </Link>
            </DropdownMenuItem>
        </>
    );
}
