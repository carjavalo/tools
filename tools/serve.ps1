<#
.SYNOPSIS
    Inicia el servidor de desarrollo de Laravel en el puerto que se indique.

.DESCRIPTION
    Localiza automaticamente la carpeta del proyecto Laravel (donde esta 'artisan')
    y ejecuta 'php artisan serve' en entorno local. Permite cualquier puerto.

.EXAMPLE
    .\serve.ps1                 # Puerto 8000 (por defecto), host 0.0.0.0
    .\serve.ps1 -Port 8003      # Puerto 8003
    .\serve.ps1 -Port 9000 -ServerHost 127.0.0.1
#>
param(
    [int]$Port = 8000,
    [string]$ServerHost = "0.0.0.0"
)

# Busca el directorio que contiene 'artisan': este mismo o una subcarpeta 'tools'.
$projectPath = @($PSScriptRoot, (Join-Path $PSScriptRoot 'tools')) |
    Where-Object { Test-Path (Join-Path $_ 'artisan') } |
    Select-Object -First 1

if (-not $projectPath) {
    Write-Error "No se encontro el archivo 'artisan'. Ejecuta el script desde la carpeta del proyecto Laravel."
    exit 1
}

Set-Location $projectPath
Write-Host ("Iniciando Laravel en http://{0}:{1}  (proyecto: {2})" -f $ServerHost, $Port, $projectPath) -ForegroundColor Green
php artisan serve --port=$Port --host=$ServerHost
