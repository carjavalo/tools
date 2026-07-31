# UI Color Layering System

## Principio de Profundidad Visual

Este proyecto implementa un sistema de capas de color que crea profundidad visual **sin necesidad de bordes**. El contraste de color por sí solo separa los elementos.

## Regla de Jerarquía

- **Modo Claro**: Más oscuro = más profundo/fondo, Más claro = elevado/importante
- **Modo Oscuro**: Más oscuro = más profundo/fondo, Más claro = elevado/importante

## Capas Disponibles

### Capas de Fondo Neutras
```tsx
// Fondo de página (más profundo)
<div className="bg-layer-base">

// Primera elevación
<div className="bg-layer-1">

// Tarjetas y contenedores
<div className="bg-layer-2">

// Elementos más elevados
<div className="bg-layer-3">
```

### Capas de Color Primary (Azul Institucional)
```tsx
// Fondo primary más profundo
<div className="bg-primary-layer-base">

// Elevación 1
<div className="bg-primary-layer-1">

// Elevación 2
<div className="bg-primary-layer-2">

// Más elevado (más claro)
<div className="bg-primary-layer-3">
```

### Otras Capas de Color
- `bg-secondary-layer-1`, `bg-secondary-layer-2`, `bg-secondary-layer-3`
- `bg-muted-layer-1`, `bg-muted-layer-2`
- `bg-accent-layer-1`, `bg-accent-layer-2`, `bg-accent-layer-3`
- `bg-sidebar-layer-1`, `bg-sidebar-layer-2`

### Tarjetas Elevadas
```tsx
// Tarjeta normal
<div className="bg-card">

// Tarjeta elevada (sin border)
<div className="bg-card-elevated">
```

## Sombras Sutiles (Opcional)

Para reforzar la profundidad, puedes agregar sombras muy sutiles:

```tsx
<div className="bg-layer-2 shadow-layer-1">  // Sombra mínima
<div className="bg-layer-2 shadow-layer-2">  // Sombra media
<div className="bg-layer-3 shadow-layer-3">  // Sombra más pronunciada
```

## Ejemplos de Uso

### Dashboard con Capas
```tsx
<div className="bg-layer-base min-h-screen">
  <div className="bg-layer-1 p-6">
    <div className="bg-layer-2 rounded-lg p-4">
      <h2>Tarjeta Principal</h2>
      <div className="bg-layer-3 rounded p-3 mt-4">
        <p>Contenido elevado</p>
      </div>
    </div>
  </div>
</div>
```

### Sección con Color Primary
```tsx
<section className="bg-primary-layer-base p-8">
  <div className="bg-primary-layer-1 rounded-lg p-6">
    <h2 className="text-white">Título</h2>
    <div className="bg-primary-layer-2 rounded p-4 mt-4">
      <p className="text-white">Contenido</p>
      <button className="bg-primary-layer-3 px-4 py-2 rounded">
        Acción
      </button>
    </div>
  </div>
</section>
```

### Sidebar con Capas
```tsx
<aside className="bg-sidebar">
  <nav className="bg-sidebar-layer-1 p-4">
    <button className="bg-sidebar-layer-2 w-full p-2 rounded">
      Item de Menú
    </button>
  </nav>
</aside>
```

## Reglas de Diseño

1. **No uses borders** - El contraste de color es suficiente
2. **Apila capas progresivamente** - layer-1 sobre base, layer-2 sobre layer-1, etc.
3. **Mantén consistencia** - Usa el mismo sistema en toda la app
4. **Sombras opcionales** - Solo si necesitas reforzar la elevación
5. **Respeta la jerarquía** - Elementos importantes = capas más claras

## Incrementos de Luminosidad

- **Modo Claro**: Incrementos de ~0.01-0.02 en lightness (OKLCH)
- **Modo Oscuro**: Incrementos de ~0.035 en lightness (OKLCH)

Estos incrementos crean suficiente contraste para separar elementos sin necesidad de bordes.
