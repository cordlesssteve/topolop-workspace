# Topolop Monorepo

Multi-Metaphor Codebase Visualization System - Monorepo workspace containing all topolop packages.

## Structure

```
topolop-monorepo/
├── packages/
│   ├── core/           # @topolop/core - Core analysis engine
│   ├── analysis/       # @topolop/analysis - 29+ tool adapters
│   ├── shared-types/   # @topolop/shared-types - TypeScript types
│   └── visualization/  # @topolop/visualization - 3D city renderer
├── package.json        # Workspace configuration
└── .npmrc             # Local registry configuration
```

## Development

### Install Dependencies
```bash
npm install
```

### Build All Packages
```bash
npm run build
```

### Test All Packages
```bash
npm run test
```

### Publishing (Local Development)

1. Start verdaccio local registry:
```bash
./start-verdaccio.sh
```

2. Publish packages:
```bash
npm publish --workspace @topolop/core
npm publish --workspace @topolop/analysis
npm publish --workspace @topolop/shared-types
npm publish --workspace @topolop/visualization
```

### Using in Other Projects

With verdaccio running, install in other projects:
```bash
npm install @topolop/core --registry http://localhost:4873
```

Or use npm link for rapid iteration:
```bash
# In topolop-monorepo/packages/core
npm link

# In your other project
npm link @topolop/core
```

## Package Descriptions

### @topolop/core
Core analysis engine with git, AST, and visualization foundations.

### @topolop/analysis  
Integrates 29+ static analysis tools with cross-tool correlation.

### @topolop/shared-types
Shared TypeScript type definitions across all packages.

### @topolop/visualization
3D city metaphor visualization using Three.js.

## Safety Configs

All packages configured with:
- `publishConfig.access: "restricted"` - Prevents accidental public publishing
- `publishConfig.registry: "http://localhost:4873"` - Defaults to local registry
- To publish publicly (future): `npm publish --access public --registry https://registry.npmjs.org`

## Migration Notes

This monorepo consolidates:
- `topolop` → `@topolop/core`
- `topolop-analysis` → `@topolop/analysis`
- `topolop-shared-types` → `@topolop/shared-types`
- `topolop-visualization` → `@topolop/visualization`

Previous standalone repos archived in separate directories.
