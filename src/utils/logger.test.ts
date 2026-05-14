import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The logger module reads process.env.NODE_ENV at module load time and uses
 * the captured `isDev` boolean to gate info/debug. So each test that exercises
 * a different mode has to:
 *   1. set process.env.NODE_ENV first
 *   2. vi.resetModules() to drop the cached copy
 *   3. dynamic import to get a fresh isDev capture
 *
 * Slightly verbose but it's the price of the module-load-time check, which
 * we keep so production builds dead-code-eliminate dev branches.
 */

describe('logger', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('forwards .error to console.error with the [droppoint] prefix', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.error('boom', { reason: 'test' });

    expect(errorSpy).toHaveBeenCalledWith('[droppoint]', 'boom', { reason: 'test' });
  });

  it('forwards .warn in any environment', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.warn('careful');

    expect(warnSpy).toHaveBeenCalledWith('[droppoint]', 'careful');
  });

  it('always emits .error, even in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.error('prod error');

    expect(errorSpy).toHaveBeenCalled();
  });

  it('emits .info only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.info('dev info');
    expect(infoSpy).toHaveBeenCalledWith('[droppoint]', 'dev info');
  });

  it('suppresses .info in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.info('prod info');
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('emits .debug only in development', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.debug('breadcrumb', 123);
    expect(debugSpy).toHaveBeenCalledWith('[droppoint]', 'breadcrumb', 123);
  });

  it('suppresses .debug in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { logger } = await import('./logger');

    logger.debug('prod breadcrumb');
    expect(debugSpy).not.toHaveBeenCalled();
  });
});
