import React from 'react';
import { useTagViews } from '../hooks/useTagViews';
import { UNTAGGED_VIEW_ID } from '../../constants';

interface ViewChipsProps {
  /** Open the Views sheet (manage, share, create). */
  onManage: () => void;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * The phone's view switches: a row of glass chips that scrolls sideways,
 * one per view, like the category chips under a maps search field. A chip
 * is on when its dot is filled; tapping flips it. The first chip opens the
 * Views sheet, where views are made and shared.
 */
export const ViewChips: React.FC<ViewChipsProps> = ({ onManage, className = '', style }) => {
  const { tags, hidden, loaded, toggleView } = useTagViews();
  // A lone "Views" button over the map is noise; the row appears with the first view.
  if (!loaded || tags.length === 0) return null;

  const chip = (props: {
    key: string; label: string; on: boolean; color: string; onClick: () => void; ariaLabel?: string;
  }) => (
    <button
      key={props.key}
      type="button"
      role="switch"
      aria-checked={props.on}
      aria-label={props.ariaLabel ?? `Show ${props.label}`}
      onClick={props.onClick}
      className={`ios-float flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-full text-footnote font-semibold whitespace-nowrap ios-press flex-shrink-0 ${
        props.on ? 'text-ink' : 'text-ink-2'
      }`}
    >
      <span
        aria-hidden="true"
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: props.on ? props.color : 'transparent', boxShadow: `inset 0 0 0 2px ${props.color}` }}
      />
      {props.label}
    </button>
  );

  return (
    <div
      className={`flex items-center gap-2 overflow-x-auto px-3 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      style={{ WebkitOverflowScrolling: 'touch', ...style }}
      role="group"
      aria-label="Views"
    >
      <button
        type="button"
        onClick={onManage}
        className="ios-float flex items-center gap-1.5 h-8 px-3 rounded-full text-footnote font-semibold text-accent whitespace-nowrap ios-press flex-shrink-0"
        aria-label="Views"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 6h16M7 12h10M10 18h4" />
        </svg>
        Views
      </button>
      {tags.map(t => chip({ key: t.id, label: t.name, on: !hidden.has(t.id), color: t.color, onClick: () => toggleView(t.id) }))}
      {tags.length > 0 && chip({
        key: UNTAGGED_VIEW_ID,
        label: 'No view',
        ariaLabel: 'Show properties with no view',
        on: !hidden.has(UNTAGGED_VIEW_ID),
        color: '#8e8e93',
        onClick: () => toggleView(UNTAGGED_VIEW_ID),
      })}
    </div>
  );
};
