import React, { useEffect, useState } from 'react';

interface InputAlertProps {
  open: boolean;
  title: string;
  message?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  inputType?: 'text' | 'email' | 'date';
  /** Return an error message to keep the alert open, or nothing to close it. */
  onConfirm: (value: string) => Promise<string | void> | string | void;
  onCancel: () => void;
}

/**
 * An iOS alert with one text field: a title, a line of context, the field,
 * and Cancel / confirm. Used for naming a view and inviting a person, the
 * same shape as the property sheet's "New Folder".
 */
export const InputAlert: React.FC<InputAlertProps> = ({
  open, title, message, placeholder, initialValue = '', confirmLabel = 'OK', inputType = 'text', onConfirm, onCancel,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // iOS doesn't shrink the layout viewport for the keyboard, so a centered
  // alert ends up behind it. Track the visual viewport while it's up.
  const [viewport, setViewport] = useState<{ top: number; height: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setValue(initialValue);
    setError(null);
    setBusy(false);
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setViewport({ top: vv.offsetTop, height: vv.height });
    const frame = requestAnimationFrame(update);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      setViewport(null);
    };
  }, [open]);

  if (!open) return null;

  const canConfirm = value.trim().length > 0 && !busy;

  const confirm = async () => {
    if (!canConfirm) return;
    setBusy(true);
    try {
      const problem = await onConfirm(value);
      if (problem) setError(problem);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-x-0 z-[100001] flex items-center justify-center bg-black/40 animate-fade-in"
      style={viewport ? { top: viewport.top, height: viewport.height } : { top: 0, bottom: 0 }}
      onClick={onCancel}
      onTouchEnd={e => { e.preventDefault(); onCancel(); }}
    >
      <div
        className="glass rounded-[24px] w-[280px] overflow-hidden animate-sheet-up"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={e => e.stopPropagation()}
        onTouchEnd={e => e.stopPropagation()}
      >
        <div className="px-4 pt-5 pb-3 text-center">
          <div className="text-headline font-semibold">{title}</div>
          {message && <div className="text-footnote text-ink-2 mt-1">{message}</div>}
          <input
            type={inputType}
            inputMode={inputType === 'email' ? 'email' : undefined}
            autoCapitalize={inputType === 'email' ? 'none' : undefined}
            autoComplete={inputType === 'email' ? 'email' : 'off'}
            min={inputType === 'date' ? new Date().toISOString().slice(0, 10) : undefined}
            className="mt-3 w-full h-8 rounded-md border border-hairline bg-surface px-2 text-subhead text-ink focus:outline-none focus:border-accent"
            placeholder={placeholder}
            value={value}
            onChange={e => { setValue(e.target.value); setError(null); }}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); void confirm(); }
              if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
            }}
            autoFocus
            disabled={busy}
            aria-invalid={Boolean(error)}
          />
          {error && <div className="text-caption text-danger mt-2" role="alert">{error}</div>}
        </div>
        <div className="grid grid-cols-2 border-t border-hairline/60 divide-x divide-hairline/60">
          <button type="button" className="h-11 text-body text-accent ios-press" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="h-11 text-body font-semibold text-accent ios-press disabled:opacity-40"
            onClick={() => void confirm()}
            disabled={!canConfirm}
          >
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
