import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Default to production-style logger behavior in tests so debug breadcrumbs
// (e.g. the SANITIZE traces in fileManagement) don't pollute test output.
// Tests that specifically exercise the dev-vs-prod logger branch override
// NODE_ENV via vi.stubEnv() per-test — this is just the baseline.
//
// vi.stubEnv is the supported way to mutate process.env under TypeScript's
// strict readonly NODE_ENV typing; direct assignment fails the type check.
vi.stubEnv('NODE_ENV', 'production');
