import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tryWithToast } from './tryWithToast';

describe('tryWithToast', () => {
  beforeEach(() => {
    // Silence the helper's logger.error during the throwing-fn tests.
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the resolved value on success', async () => {
    const showToast = vi.fn();
    const result = await tryWithToast(
      async () => 42,
      { showToast, errorMessage: 'should not show' },
    );

    expect(result).toBe(42);
    expect(showToast).not.toHaveBeenCalled();
  });

  it('returns undefined and surfaces a toast on failure', async () => {
    const showToast = vi.fn();
    const result = await tryWithToast(
      async () => { throw new Error('nope'); },
      { showToast, errorMessage: 'Something broke' },
    );

    expect(result).toBeUndefined();
    expect(showToast).toHaveBeenCalledWith('Something broke', 'error');
  });

  it('defaults the toast type to "error"', async () => {
    const showToast = vi.fn();
    await tryWithToast(
      async () => { throw new Error('nope'); },
      { showToast, errorMessage: 'msg' },
    );

    expect(showToast).toHaveBeenCalledWith('msg', 'error');
  });

  it('respects an explicit toastType override', async () => {
    const showToast = vi.fn();
    await tryWithToast(
      async () => { throw new Error('nope'); },
      { showToast, errorMessage: 'heads up', toastType: 'warning' },
    );

    expect(showToast).toHaveBeenCalledWith('heads up', 'warning');
  });

  it('does not call showToast more than once per failure', async () => {
    const showToast = vi.fn();
    await tryWithToast(
      async () => { throw new Error('once please'); },
      { showToast, errorMessage: 'msg' },
    );

    expect(showToast).toHaveBeenCalledTimes(1);
  });

  it('logs through logger.error with the tag (or fallback)', async () => {
    const errorSpy = vi.spyOn(console, 'error');
    const showToast = vi.fn();

    await tryWithToast(
      async () => { throw new Error('tagged'); },
      { showToast, errorMessage: 'msg', tag: 'CustomTag' },
    );

    // logger.error prepends [droppoint], then we pass `[CustomTag]`, then the
    // error itself. We only check the bracket-tag chunk because the error
    // serialization differs across Node versions.
    expect(errorSpy).toHaveBeenCalledWith(
      '[droppoint]',
      '[CustomTag]',
      expect.any(Error),
    );
  });
});
