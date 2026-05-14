import { logger } from './logger';

/**
 * Type-compatible with the showToast function from useToast(). Keeping this
 * local instead of importing the context type avoids a circular dep between
 * utils/ and contexts/.
 *
 * Matches ToastType in ../contexts/ToastContext exactly — keep them in sync.
 */
type ToastType = 'error' | 'success' | 'warning';
type ShowToastFn = (message: string, type?: ToastType) => void;

interface TryOptions {
  /** The toast function from useToast(). */
  showToast: ShowToastFn;
  /** Message shown to the user on failure. */
  errorMessage: string;
  /** Short tag prepended to the logger output so call sites are
   *  distinguishable in dev consoles. */
  tag?: string;
  /** Toast severity. Defaults to "error". */
  toastType?: ToastType;
}

/**
 * Runs `fn` and, if it throws, logs the error via the centralized logger
 * AND surfaces a user-facing toast. Returns the function's resolved value
 * on success, or `undefined` on failure (which lets the caller short-circuit
 * with `if (result === undefined) return;`).
 *
 * Replacement for the `.catch(logger.error)` shorthand that silently
 * swallowed failures with no user signal — the upload-failed and
 * image-preview-load-failed cases looked identical to "everything worked"
 * from the user's POV.
 *
 * Example:
 *
 *   const file = await tryWithToast(
 *     () => fileService.uploadFile(file, propertyId, name),
 *     { showToast, errorMessage: 'Failed to upload file.', tag: 'Upload' }
 *   );
 *   if (!file) return; // toast already shown
 */
export async function tryWithToast<T>(
  fn: () => Promise<T>,
  opts: TryOptions,
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    logger.error(`[${opts.tag ?? 'tryWithToast'}]`, error);
    opts.showToast(opts.errorMessage, opts.toastType ?? 'error');
    return undefined;
  }
}
