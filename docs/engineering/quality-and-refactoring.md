## Engineering Quality and Refactoring

This document consolidates code quality findings and a safe refactoring approach. It is intentionally scoped to guidance only, with no required code changes.

### Highest impact issues

- Large monolithic components (`src/pages/map.tsx` and `src/components/PropertyDetailsModal.tsx`) are difficult to test and maintain.
- Direct data access in components increases coupling and reduces testability.
- Debug logging is present in production code paths.
- Duplicated logic and magic numbers increase maintenance cost.

### Refactoring principles

1. One change at a time.
2. Keep behavior identical while refactoring.
3. Replace one usage before replacing all.
4. Test after each change.
5. Make changes reversible.

### Recommended order of operations

1. Remove or gate debug logging.
2. Consolidate shared UI pieces (menus, inputs) into reusable components.
3. Centralize constants and repeated logic in `constants/` and `utils/`.
4. Extract business logic into hooks and services.
5. Split large components into smaller, focused parts.

### Safe refactoring checklist

- Identify all current usages before changes.
- Extract one new component or utility at a time.
- Replace a single instance, test, then proceed.
- Remove old code only after all references are migrated.

### Manual test checklist

- Open property details modal.
- Upload, rename, move, and delete files.
- Create and navigate folders using breadcrumbs.
- Switch between list and grid views.
- Verify mobile and desktop behaviors.
