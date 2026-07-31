import InputError from '@/components/input-error';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/layouts/auth-layout';
import { Head, useForm } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';
import { login } from '@/routes';
import { FormEventHandler } from 'react';

interface CatalogOption {
    id: number;
    Nombre: string;
}

interface RegisterProps {
    epsList?: CatalogOption[];
    tiposDocumento?: CatalogOption[];
}

export default function Register({
    epsList = [],
    tiposDocumento = [],
}: RegisterProps) {
    const { data, setData, post, processing, errors } = useForm({
        name: '',
        email: '',
        password: '',
        password_confirmation: '',
        tipo_Docu: '',
        Numero_D: '',
        Apellido1: '',
        apellido2: '',
        Telefono1: '',
        telefono2: '',
        Direccion: '',
        Eps: '',
    });

    const submit: FormEventHandler = (e) => {
        e.preventDefault();
        post('/register', {
            onFinish: () => {
                setData('password', '');
                setData('password_confirmation', '');
            },
        });
    };

    return (
        <AuthLayout
            title="Crear una cuenta"
            description="Ingresa tus datos a continuación para registrarte en el sistema"
        >
            <Head title="Registrarse" />
            <form onSubmit={submit} className="flex flex-col gap-6">
                {/* Identificación */}
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identificación</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="tipo_Docu">Tipo de Documento</Label>
                            <select
                                id="tipo_Docu"
                                name="tipo_Docu"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={data.tipo_Docu}
                                onChange={(e) => setData('tipo_Docu', e.target.value)}
                                tabIndex={1}
                            >
                                <option value="">Seleccione...</option>
                                {tiposDocumento.map((t) => (
                                    <option key={t.id} value={t.Nombre}>
                                        {t.Nombre}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.tipo_Docu} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="Numero_D">Número de Documento</Label>
                            <Input
                                id="Numero_D"
                                type="text"
                                tabIndex={2}
                                name="Numero_D"
                                value={data.Numero_D}
                                onChange={(e) => setData('Numero_D', e.target.value)}
                                placeholder="Ej: 123456789"
                            />
                            <InputError message={errors.Numero_D} />
                        </div>
                    </div>
                </div>

                {/* Datos Personales */}
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Datos Personales</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Primer Nombre</Label>
                            <Input
                                id="name"
                                type="text"
                                required
                                autoFocus
                                tabIndex={3}
                                autoComplete="given-name"
                                name="name"
                                value={data.name}
                                onChange={(e) => setData('name', e.target.value)}
                                placeholder="Primer nombre"
                            />
                            <InputError message={errors.name} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="Apellido1">Primer Apellido</Label>
                            <Input
                                id="Apellido1"
                                type="text"
                                required
                                tabIndex={4}
                                name="Apellido1"
                                value={data.Apellido1}
                                onChange={(e) => setData('Apellido1', e.target.value)}
                                placeholder="Primer apellido"
                            />
                            <InputError message={errors.Apellido1} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="apellido2">Segundo Apellido</Label>
                            <Input
                                id="apellido2"
                                type="text"
                                tabIndex={5}
                                name="apellido2"
                                value={data.apellido2}
                                onChange={(e) => setData('apellido2', e.target.value)}
                                placeholder="Segundo apellido"
                            />
                            <InputError message={errors.apellido2} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                required
                                tabIndex={6}
                                autoComplete="email"
                                name="email"
                                value={data.email}
                                onChange={(e) => setData('email', e.target.value)}
                                placeholder="correo@ejemplo.com"
                            />
                            <InputError message={errors.email} />
                        </div>
                    </div>
                </div>

                {/* Contacto y EPS */}
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contacto y EPS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="Telefono1">Teléfono 1</Label>
                            <Input
                                id="Telefono1"
                                type="text"
                                tabIndex={7}
                                name="Telefono1"
                                value={data.Telefono1}
                                onChange={(e) => setData('Telefono1', e.target.value)}
                                placeholder="Teléfono principal"
                            />
                            <InputError message={errors.Telefono1} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="telefono2">Teléfono 2</Label>
                            <Input
                                id="telefono2"
                                type="text"
                                tabIndex={8}
                                name="telefono2"
                                value={data.telefono2}
                                onChange={(e) => setData('telefono2', e.target.value)}
                                placeholder="Teléfono alternativo"
                            />
                            <InputError message={errors.telefono2} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="Direccion">Dirección</Label>
                            <Input
                                id="Direccion"
                                type="text"
                                tabIndex={9}
                                name="Direccion"
                                value={data.Direccion}
                                onChange={(e) => setData('Direccion', e.target.value)}
                                placeholder="Dirección de residencia"
                            />
                            <InputError message={errors.Direccion} />
                        </div>
                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="Eps">EPS</Label>
                            <select
                                id="Eps"
                                name="Eps"
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={data.Eps}
                                onChange={(e) => setData('Eps', e.target.value)}
                                tabIndex={10}
                            >
                                <option value="">Seleccione...</option>
                                {epsList.map((eps) => (
                                    <option key={eps.id} value={eps.Nombre}>
                                        {eps.Nombre}
                                    </option>
                                ))}
                            </select>
                            <InputError message={errors.Eps} />
                        </div>
                    </div>
                </div>

                {/* Seguridad */}
                <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Seguridad</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input
                                id="password"
                                type="password"
                                required
                                tabIndex={11}
                                autoComplete="new-password"
                                name="password"
                                value={data.password}
                                onChange={(e) => setData('password', e.target.value)}
                                placeholder="Contraseña"
                            />
                            <InputError message={errors.password} />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="password_confirmation">Confirmar Contraseña</Label>
                            <Input
                                id="password_confirmation"
                                type="password"
                                required
                                tabIndex={12}
                                autoComplete="new-password"
                                name="password_confirmation"
                                value={data.password_confirmation}
                                onChange={(e) => setData('password_confirmation', e.target.value)}
                                placeholder="Confirmar contraseña"
                            />
                            <InputError message={errors.password_confirmation} />
                        </div>
                    </div>
                </div>

                <Button type="submit" className="w-full" tabIndex={13} disabled={processing}>
                    {processing && <LoaderCircle className="h-4 w-4 animate-spin mr-2" />}
                    Crear cuenta
                </Button>

                <div className="text-center text-sm text-muted-foreground">
                    ¿Ya tienes una cuenta?{' '}
                    <TextLink href={login()} tabIndex={14}>
                        Iniciar sesión
                    </TextLink>
                </div>
            </form>
        </AuthLayout>
    );
}
