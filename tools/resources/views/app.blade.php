<!DOCTYPE html>
<html lang="es" translate="no" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        {{-- La app está en español; evita que la traducción automática del navegador (Google Translate) rompa el render de React. --}}
        <meta name="google" content="notranslate">
        <meta name="robots" content="notranslate">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Salvaguarda: los traductores del navegador (Google Translate) reparentan nodos de
             texto y provocan "Failed to execute 'insertBefore'/'removeChild'" que tumba a React.
             Estos parches hacen que esas operaciones no lancen excepción en ese caso. --}}
        <script>
            (function () {
                if (typeof Node !== 'function' || !Node.prototype) return;

                const originalInsertBefore = Node.prototype.insertBefore;
                Node.prototype.insertBefore = function (newNode, referenceNode) {
                    if (referenceNode && referenceNode.parentNode !== this) {
                        if (newNode) {
                            return this.appendChild(newNode);
                        }
                        return newNode;
                    }
                    return originalInsertBefore.call(this, newNode, referenceNode);
                };

                const originalRemoveChild = Node.prototype.removeChild;
                Node.prototype.removeChild = function (child) {
                    if (child && child.parentNode !== this) {
                        return child;
                    }
                    return originalRemoveChild.call(this, child);
                };
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: oklch(1 0 0);
            }

            html.dark {
                background-color: oklch(0.145 0 0);
            }
        </style>

        <title inertia>{{ config('app.name', 'Laravel') }}</title>

        <link rel="icon" href="/images/logo.png" sizes="any">
        <link rel="icon" href="/images/logo.png" type="image/png">
        <link rel="apple-touch-icon" href="/images/logo.png">

        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">

        @viteReactRefresh
        @vite(['resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
