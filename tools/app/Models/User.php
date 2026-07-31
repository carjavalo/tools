<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Fortify\TwoFactorAuthenticatable;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /**
     * Nombre del rol de máximo privilegio. Los usuarios y todo lo relacionado
     * con este rol solo son visibles para otros Super Admin.
     */
    public const SUPER_ADMIN = 'Super Admin';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'rol',
        'tipo_Docu',
        'Numero_D',
        'Apellido1',
        'apellido2',
        'Telefono1',
        'telefono2',
        'Direccion',
        'Eps',
        'codesp',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Indica si el usuario tiene el rol de máximo privilegio (Super Admin).
     */
    public function isSuperAdmin(): bool
    {
        return $this->rol === self::SUPER_ADMIN;
    }
}
