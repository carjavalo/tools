# Project Structure

## Backend (Laravel)

### Core Directories
- `app/` - Application code
  - `Http/Controllers/` - HTTP request handlers
  - `Http/Middleware/` - Custom middleware (HandleAppearance, HandleInertiaRequests)
  - `Http/Requests/` - Form request validation
  - `Models/` - Eloquent models (User, ToolClick, etc.)
  - `Providers/` - Service providers (AppServiceProvider, FortifyServiceProvider)
  - `Services/` - Business logic services (CustomTCPDF, etc.)

- `routes/` - Route definitions
  - `web.php` - Web routes
  - `api.php` - API routes
  - `auth.php` - Authentication routes
  - `settings.php` - Settings routes
  - `console.php` - Artisan commands

- `database/` - Database files
  - `migrations/` - Database migrations
  - `seeders/` - Database seeders
  - `factories/` - Model factories
  - `database.sqlite` - SQLite database file

- `config/` - Configuration files
- `bootstrap/` - Framework bootstrap files
- `storage/` - File storage (logs, cache, uploads)
- `public/` - Public assets and entry point

## Frontend (React + TypeScript)

### Resources Directory (`resources/`)
- `js/` - TypeScript/React code
  - `pages/` - Inertia.js page components
    - `auth/` - Authentication pages
    - `settings/` - Settings pages
    - `tools/` - Document processing tool pages
    - `dashboard.tsx`, `welcome.tsx`, etc.
  - `components/` - Reusable React components
  - `layouts/` - Page layout components
  - `hooks/` - Custom React hooks
  - `lib/` - Utility libraries
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions
  - `actions/` - Server actions/API calls
  - `services/` - Frontend services
  - `routes/` - Route definitions
  - `wayfinder/` - Laravel Wayfinder integration
  - `app.tsx` - Main app entry point
  - `ssr.tsx` - SSR entry point

- `css/` - Stylesheets
  - `app.css` - Main Tailwind CSS file

- `views/` - Blade templates (minimal, mostly for Inertia root)

## Configuration Files

### Root Level
- `composer.json` - PHP dependencies
- `package.json` - Node dependencies
- `vite.config.ts` - Vite build configuration
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - ESLint configuration
- `.prettierrc` - Prettier configuration
- `phpunit.xml` - PHPUnit configuration
- `.env` - Environment variables
- `artisan` - Laravel CLI tool

## Conventions

### File Naming
- **PHP**: PascalCase for classes (`UserController.php`, `User.php`)
- **React Components**: PascalCase for files (`Dashboard.tsx`, `Button.tsx`)
- **TypeScript**: kebab-case for pages matching routes (`crop-pdf.tsx`)
- **Utilities**: kebab-case (`use-appearance.ts`)

### Import Aliases
- `@/*` maps to `resources/js/*` for cleaner imports

### Code Style
- **PHP**: PSR-12 standard (enforced by Laravel Pint)
- **TypeScript/React**: 
  - 4 spaces indentation
  - Single quotes
  - Semicolons required
  - Prettier + ESLint for consistency
  - Automatic import organization
  - Tailwind class sorting

### Middleware
- Custom middleware for appearance/theme handling
- Inertia.js request handling
- Cookie encryption (except appearance and sidebar_state)

### Page Resolution
- Inertia pages resolved from `resources/js/pages/` directory
- Automatic page component discovery via glob pattern
