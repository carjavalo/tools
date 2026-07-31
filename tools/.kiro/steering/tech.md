# Tech Stack

## Backend
- **Framework**: Laravel 12 (PHP 8.2+)
- **Authentication**: Laravel Fortify
- **PDF Libraries**: 
  - TCPDF, FPDI-TCPDF, DomPDF
  - PDF Parser (smalot/pdfparser)
- **Document Processing**:
  - PHPWord (Word documents)
  - PHPPresentation (PowerPoint)
- **OCR**: Laravel OCR Space integration
- **Testing**: Pest PHP

## Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite 7
- **Routing**: Inertia.js (React adapter)
- **UI Components**: 
  - Radix UI primitives
  - Headless UI
  - Tailwind CSS 4
  - shadcn/ui patterns (class-variance-authority, clsx, tailwind-merge)
- **Icons**: Lucide React
- **Client-side Libraries**:
  - PDF.js (PDF rendering)
  - pdf-lib (PDF manipulation)
  - Tesseract.js (OCR)
  - Mammoth (Word processing)
  - XLSX (Excel processing)
  - html2pdf.js, docx, file-saver, jszip
  - QRCode generation
  - SweetAlert2 (alerts)
  - Driver.js (guided tours)

## Development Tools
- **Linting**: ESLint 9 with TypeScript ESLint, React plugins
- **Formatting**: Prettier with Tailwind and organize-imports plugins
- **Type Checking**: TypeScript 5.7 (strict mode)
- **PHP Linting**: Laravel Pint

## Common Commands

### Development
```bash
# Start full dev environment (Laravel server + queue + Vite)
composer dev

# Start with SSR support
composer dev:ssr

# Frontend only
npm run dev

# Backend only
php artisan serve
```

### Building
```bash
# Build frontend assets
npm run build

# Build with SSR
npm run build:ssr
```

### Code Quality
```bash
# Format code
npm run format

# Check formatting
npm run format:check

# Lint and fix
npm run lint

# Type check
npm run types

# PHP linting
./vendor/bin/pint
```

### Testing
```bash
# Run PHP tests
composer test
# or
php artisan test
```

### Database
```bash
# Run migrations
php artisan migrate

# Fresh migration with seeding
php artisan migrate:fresh --seed
```
