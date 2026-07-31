import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { register } from '@/routes';
import { request } from '@/routes/password';
import { Form, Head, router } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

interface CartagoLoginProps {
    canResetPassword: boolean;
}

/**
 * Pantalla de inicio de sesión de Programación de Cirugía Sede Cartago.
 *
 * Es idéntica a la de Sede Cali, pero el módulo todavía no está habilitado:
 * el formulario apunta a una ruta que siempre rechaza el intento, así que
 * nadie puede ingresar por ahora.
 */
export default function ProgramacionCirugiaCartagoLogin({
    canResetPassword,
}: CartagoLoginProps) {
    return (
        <AuthLayout
            title="Inicia sesión en tu cuenta"
            description="Ingresa tu correo electrónico y contraseña para acceder"
        >
            <Head title="Programación de Cirugía Sede Cartago" />

            <Form
                method="post"
                action="/tools/programacion-cirugia-cartago"
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email">Correo electrónico</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="correo@ejemplo.com"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password">Contraseña</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm"
                                            tabIndex={5}
                                        >
                                            ¿Olvidó su contraseña?
                                        </TextLink>
                                    )}
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Contraseña"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember">Recordarme</Label>
                            </div>

                            <div className="mt-4 flex gap-4">
                                <Button
                                    type="submit"
                                    className="flex-1"
                                    tabIndex={4}
                                    disabled={processing}
                                >
                                    {processing && (
                                        <LoaderCircle className="h-4 w-4 animate-spin" />
                                    )}
                                    Iniciar sesión
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1"
                                    onClick={() => router.visit('/')}
                                >
                                    Atrás
                                </Button>
                            </div>
                        </div>

                        <div className="text-center text-sm text-muted-foreground">
                            ¿No tienes una cuenta?{' '}
                            <TextLink href={register()} tabIndex={5}>
                                Regístrate
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </AuthLayout>
    );
}
