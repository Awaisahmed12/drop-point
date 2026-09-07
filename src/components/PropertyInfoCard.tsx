import type { Property } from '../../types';

interface PropertyInfoCardProps {
  address: string;
  addressLoading: boolean;
  property: Property;
  onSelect: () => void;
  onClose: () => void;
  /** Fires on pointerdown of the close button, before the click, so the map
   *  can ignore the click that Google Maps will receive under the card. */
  onCloseStart?: () => void;
}

const parseAddress = (fullAddress: string) => {
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length < 2) return { street: fullAddress.trim(), rest: '' };
  return { street: parts[0], rest: parts.slice(1).join(', ') };
};

/**
 * The card that rises when a pin is chosen: what it is, where it is, and one
 * button. Renaming and everything else live inside the property sheet.
 */
export const PropertyInfoCard = ({ address, addressLoading, property, onSelect, onClose, onCloseStart }: PropertyInfoCardProps) => {
  const { street, rest } = parseAddress(address);
  const title = property.label || street || address;
  const subtitle = property.label ? [street, rest].filter(Boolean).join(', ') : rest;
  const isNew = !property.id;

  return (
    <div
      className="absolute left-1/2 -translate-x-1/2 z-40 w-full max-w-md px-3 sm:px-0"
      style={{ bottom: 'calc(var(--tabbar-total) + 12px)' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      onTouchEnd={e => e.stopPropagation()}
    >
      <div className="glass rounded-[26px] p-4 pt-3 flex flex-col gap-3 animate-sheet-up sm:mb-3">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0 pt-1">
            {addressLoading ? (
              <div className="flex items-center gap-2 text-body text-ink-2">
                <div className="w-4 h-4 border-2 border-surface-2 border-t-accent rounded-full animate-spin" />
                Finding address…
              </div>
            ) : (
              <>
                <h3 className="text-headline font-semibold text-ink break-words">{title}</h3>
                {subtitle && <p className="text-subhead text-ink-2 mt-0.5">{subtitle}</p>}
              </>
            )}
          </div>
          <button
            type="button"
            aria-label="Dismiss"
            className="ios-close flex-shrink-0"
            onPointerDown={e => { e.stopPropagation(); onCloseStart?.(); }}
            onClick={e => { e.stopPropagation(); onClose(); }}
            onTouchEnd={e => { e.stopPropagation(); e.preventDefault(); onClose(); }}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="ios-button ios-button-primary"
          disabled={addressLoading || !address}
          onClick={onSelect}
        >
          {isNew ? 'Add property' : 'Open'}
        </button>
      </div>
    </div>
  );
};
