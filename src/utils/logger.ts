/**
 * Centralized logger so we can flip dev-vs-production behavior in one place
 * instead of grepping the codebase for `console.*` calls.
 *
 * Why this exists:
 *  - Production-shipped console.log/.error calls clutter end-user devtools,
 *    can leak data in error messages, and never reach any error-tracking
 *    backend. Hiding the noise also makes real prod errors easier to spot.
 *  - In development we still want everything visible so debugging stays easy.
 *
 * Levels:
 *  - error: always emitted. In production this is the natural hook for an
 *    error-tracking integration (Sentry/LogRocket); for now it forwards
 *    to console.error so the trail is preserved.
 *  - warn:  always emitted.
 *  - info:  dev-only. Use for low-volume, user-relevant events.
 *  - debug: dev-only. Use for high-volume breadcrumbs that would be noise
 *           in production. Most former `console.log` calls map here.
 *
 * The check below uses NEXT_PUBLIC_NODE_ENV-equivalent: process.env.NODE_ENV
 * is statically replaced by the bundler at build time, so the dev-only
 * branches are dead-code-eliminated in production builds.
 */

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

const PREFIX = '[droppoint]';

export const logger = {
  /** Always emitted. Production hook point for an error-tracking SDK. */
  error: (...args: unknown[]): void => {
    console.error(PREFIX, ...args);
  },

  /** Always emitted. */
  warn: (...args: unknown[]): void => {
    console.warn(PREFIX, ...args);
  },

  /** Dev-only. Low-volume signal events. */
  info: (...args: unknown[]): void => {
    if (isDev) console.info(PREFIX, ...args);
  },

  /** Dev-only. High-volume breadcrumb logging — formerly `console.log`. */
  debug: (...args: unknown[]): void => {
    if (isDev) console.debug(PREFIX, ...args);
  },
};
