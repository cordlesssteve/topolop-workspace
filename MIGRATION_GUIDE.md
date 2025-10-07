# Topolop Monorepo Migration Guide

**Date:** October 7, 2025  
**Migration:** Separate repos → Monorepo workspace  
**Purpose:** Simplify development across tightly coupled topolop packages

---

## ✅ What Changed

### **Before (Poly-repo + Submodules)**
```
~/projects/Utility/DEV-TOOLS/
├── topolop/                      # Standalone repo
├── topolop-analysis/             # Standalone repo
├── topolop-shared-types/         # Standalone repo
├── topolop-visualization/        # Standalone repo
├── CodebaseManager/              
│   └── components/               # Git submodules (4 references)
└── ImTheMap/
    └── components/               # Git submodule (1 reference)
```

**Problems:**
- Changes spanning multiple packages = 4 separate commits/PRs
- Submodule sync complexity
- Version coordination headaches
- Difficult to work across packages

### **After (Monorepo + npm Dependencies)**
```
~/projects/Utility/DEV-TOOLS/
├── topolop-monorepo/             # NEW: Monorepo workspace
│   ├── packages/
│   │   ├── core/                 # @topolop/core
│   │   ├── analysis/             # @topolop/analysis
│   │   ├── shared-types/         # @topolop/shared-types
│   │   └── visualization/        # @topolop/visualization
│   ├── package.json              # Workspace config
│   └── .npmrc                    # Local registry defaults
├── CodebaseManager/              # NO submodules
│   ├── package.json              # npm deps: @topolop/*
│   └── .npmrc                    # Points to local registry
└── ImTheMap/                     # NO submodules
    ├── package.json              # npm deps: @topolop/core
    └── .npmrc                    # Points to local registry
```

**Benefits:**
- One commit/PR for cross-package changes
- Standard npm workflow (no submodule gymnastics)
- npm workspaces handle linking automatically
- Clear dependency management

---

## 📦 Package Name Changes

All topolop packages now use `@topolop/*` scoped names:

| Old Name | New Name | Description |
|----------|----------|-------------|
| `topolop` | `@topolop/core` | Core analysis engine |
| `topolop-analysis` | `@topolop/analysis` | 29+ tool adapters |
| `topolop-shared-types` | `@topolop/shared-types` | TypeScript types |
| `topolop-visualization` | `@topolop/visualization` | 3D renderer |

---

## 🚀 Development Workflows

### **Working on Topolop Packages**

#### Option A: All-in-one (Recommended for topolop dev)
```bash
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo

# Install all dependencies
npm install

# Build all packages
npm run build

# Test all packages
npm run test

# Edit any package
vim packages/core/src/parser.ts
vim packages/analysis/src/analyzer.ts

# One commit for all changes
git commit -m "Add new feature across core and analysis"
```

#### Option B: Use npm link (Rapid iteration with other projects)
```bash
# Terminal 1: Link topolop packages
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo/packages/core
npm link

# Terminal 2: Use linked version
cd ~/projects/Utility/DEV-TOOLS/ImTheMap
npm link @topolop/core

# Now edit topolop/core and ImTheMap sees changes immediately
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo/packages/core
vim src/parser.ts
npm run build  # ImTheMap uses this build

# When done, unlink
cd ~/projects/Utility/DEV-TOOLS/ImTheMap
npm unlink @topolop/core
npm install  # Back to published version
```

#### Option C: Publish to local registry (Most "real")
```bash
# Terminal 1: Start verdaccio
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo
./start-verdaccio.sh  # Runs on localhost:4873

# Terminal 2: Make changes and publish
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo
vim packages/core/src/parser.ts
npm run build

# Publish to local registry
npm publish --workspace @topolop/core

# Other projects pick up the change
cd ~/projects/Utility/DEV-TOOLS/ImTheMap
npm update @topolop/core
```

---

### **Working on CodebaseManager or ImTheMap**

These projects now use normal npm dependencies instead of submodules.

```bash
# Start verdaccio (if not already running)
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo
./start-verdaccio.sh &

# Install dependencies (pulls from local verdaccio)
cd ~/projects/Utility/DEV-TOOLS/CodebaseManager
npm install  # Gets @topolop/* from localhost:4873

# Work normally
npm run dev
```

**For rapid topolop + project iteration:** Use `npm link` (Option B above)

---

## 🔐 Publishing Strategy

### **Current: Local Development Only**

All packages configured with:
```json
{
  "publishConfig": {
    "access": "restricted",
    "registry": "http://localhost:4873"
  }
}
```

This means:
- ✅ Accidental `npm publish` goes to local registry (safe)
- ✅ Can't accidentally publish to public npm
- ✅ Completely private during development

### **Future: When Ready for External Use**

**Option 1: Public npm (Open Source)**
```bash
npm publish --workspace @topolop/core --access public --registry https://registry.npmjs.org
```

**Option 2: GitHub Packages (Free for your repos)**
```bash
# Add to package.json:
{
  "publishConfig": {
    "registry": "https://npm.pkg.github.com"
  }
}

# Then publish
npm publish --workspace @topolop/core
```

**Option 3: Private npm ($7/month)**
```bash
npm publish --workspace @topolop/core --access restricted
```

---

## 🗂️ Old Repos (What to Do)

The original standalone repos are still in their locations:

```bash
~/projects/Utility/DEV-TOOLS/
├── topolop/                    # Original (can archive)
├── topolop-analysis/           # Original (can archive)
├── topolop-shared-types/       # Original (can archive)
└── topolop-visualization/      # Original (can archive)
```

**Recommendation:**
1. **Keep for 1-2 weeks** - In case you need to reference something
2. **Then rename to backups:**
   ```bash
   mv topolop topolop-backup
   mv topolop-analysis topolop-analysis-backup
   # etc.
   ```
3. **Eventually delete** - Once confident monorepo is stable

**Monorepo is the source of truth now!**

---

## 🎯 Quick Reference

### Key Commands

```bash
# Monorepo development
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo
npm install                          # Install all workspace packages
npm run build                        # Build all packages
npm run test                         # Test all packages
npm publish --workspace @topolop/core  # Publish one package

# Local registry
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo
./start-verdaccio.sh                 # Start local npm registry

# Using in other projects
cd ~/projects/Utility/DEV-TOOLS/ImTheMap
npm install                          # Gets @topolop/* from local registry
npm update @topolop/core             # Update to latest local version

# Rapid development with npm link
cd ~/projects/Utility/DEV-TOOLS/topolop-monorepo/packages/core
npm link                             # Make globally available
cd ~/projects/Utility/DEV-TOOLS/ImTheMap
npm link @topolop/core               # Use local dev version
```

### Important Locations

| What | Path |
|------|------|
| **Monorepo** | `~/projects/Utility/DEV-TOOLS/topolop-monorepo/` |
| **Verdaccio script** | `~/projects/Utility/DEV-TOOLS/topolop-monorepo/start-verdaccio.sh` |
| **Core package** | `~/projects/Utility/DEV-TOOLS/topolop-monorepo/packages/core/` |
| **Analysis package** | `~/projects/Utility/DEV-TOOLS/topolop-monorepo/packages/analysis/` |
| **CodebaseManager** | `~/projects/Utility/DEV-TOOLS/CodebaseManager/` |
| **ImTheMap** | `~/projects/Utility/DEV-TOOLS/ImTheMap/` |

---

## ❓ FAQ

**Q: What happened to git submodules?**  
A: Removed! CodebaseManager and ImTheMap now use normal npm dependencies instead.

**Q: Can I still publish individual packages separately?**  
A: Yes! Each package in the monorepo can be published independently to npm.

**Q: How do I work on topolop and CodebaseManager at the same time?**  
A: Use `npm link` for instant feedback, or publish to verdaccio for a more "real" workflow.

**Q: Is this monorepo public?**  
A: No, it's configured to default to your local registry. You control when/if to publish publicly.

**Q: Can other people use my topolop packages?**  
A: Not yet (local only). When ready, publish to npm (public or private) or GitHub Packages.

**Q: What if I need to go back?**  
A: Original repos are still there (for now). But this structure is better for your use case (40% topolop work, frequent cross-package changes).

---

## ✅ Migration Checklist

- [x] Created topolop-monorepo with 4 packages
- [x] All packages renamed to @topolop/* scope
- [x] Added safety configs (local registry defaults)
- [x] Set up verdaccio local npm registry
- [x] Removed submodules from CodebaseManager
- [x] Removed submodules from ImTheMap
- [x] Updated CodebaseManager to use @topolop/* dependencies
- [x] Created ImTheMap package.json with @topolop/core dependency
- [x] Tested npm workspace linking (✅ working)
- [x] Created migration documentation

---

**Next Steps:**
1. Test building something in the monorepo
2. Publish packages to verdaccio
3. Test installing in CodebaseManager/ImTheMap
4. Verify cross-package development workflow
5. Archive old standalone repos (after 1-2 weeks)

**Questions?** Reference this guide or check the monorepo README.
