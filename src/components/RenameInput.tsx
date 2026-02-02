import React, { useTransition } from 'react';

interface RenameInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => Promise<void> | void;
  onCancel: () => void;
  onSave?: () => Promise<void> | void;
  placeholder?: string;
  extension?: string;
  variant?: 'simple' | 'full' | 'grid';
  autoFocus?: boolean;
  className?: string;
  showButtons?: boolean;
}

export const RenameInput: React.FC<RenameInputProps> = ({
  value,
  onChange,
  onBlur,
  onCancel,
  onSave,
  placeholder = 'Name',
  extension,
  variant = 'simple',
  autoFocus = true,
  className = '',
  showButtons = true,
}) => {
  const [, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (variant === 'simple' || variant === 'grid') {
      // Use startTransition for non-urgent state updates on simple and grid variants
      startTransition(() => {
        onChange(e.target.value);
      });
    } else {
      // Immediate update for full variant (mobile)
      onChange(e.target.value);
    }
  };

  const handleBlur = async () => {
    if (onBlur) {
      await onBlur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (variant === 'full' && onSave) {
        // Full variant: trigger save on Enter
        e.preventDefault();
        onSave();
      } else {
        // Simple variant: blur to trigger onBlur
        (e.target as HTMLInputElement).blur();
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const inputClassName = variant === 'full' 
    ? 'flex-1 font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
    : variant === 'grid'
    ? `w-full text-center bg-white border-2 border-blue-400 rounded-lg px-2 py-1 text-[16px] sm:text-xs font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`
    : `flex-1 font-semibold text-gray-900 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${className}`;

  if (variant === 'grid') {
    // Grid view - simple inline input without wrapper or buttons
    return (
      <input
        className={inputClassName}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={e => e.stopPropagation()}
        onFocus={e => {
          const input = e.target as HTMLInputElement;
          input.setSelectionRange(0, value.length);
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
    );
  }

  if (variant === 'full') {
    // Mobile version with Cancel/Save buttons
    return (
      <div className="w-full max-w-full bg-white border-2 border-blue-400 rounded-xl p-4 shadow-lg overflow-hidden">
        <div className="mb-4 w-full">
          <input
            className="w-full font-semibold text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={value}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={e => e.stopPropagation()}
            onFocus={e => {
              const input = e.target as HTMLInputElement;
              input.setSelectionRange(0, value.length);
            }}
            placeholder={placeholder}
            autoFocus={autoFocus}
            style={{ maxWidth: '100%' }}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors rounded-lg"
            onClick={e => {
              e.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </button>
          {onSave && (
            <button
              className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              onClick={async e => {
                e.stopPropagation();
                await onSave();
              }}
            >
              Save
            </button>
          )}
        </div>
      </div>
    );
  }

  // Simple version (desktop list) - inline with extension and optional buttons
  return (
    <div className="w-full bg-blue-50 border-2 border-blue-400 rounded-lg p-2">
      <div className="flex items-center gap-2 mb-2">
        <input
          className={inputClassName}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onClick={e => e.stopPropagation()}
          onFocus={e => {
            const input = e.target as HTMLInputElement;
            input.setSelectionRange(0, value.length);
          }}
          placeholder={placeholder}
          autoFocus={autoFocus}
        />
        {extension && (
          <span className="text-gray-500 text-sm font-medium">.{extension}</span>
        )}
      </div>
      {showButtons && (
        <div className="flex justify-end gap-1">
          <button
            className="px-2 py-1 text-xs text-gray-600 hover:text-gray-800 transition-colors"
            onClick={e => {
              e.stopPropagation();
              onCancel();
            }}
          >
            Cancel
          </button>
          {onSave && (
            <button
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
              onClick={async e => {
                e.stopPropagation();
                await onSave();
              }}
            >
              Save
            </button>
          )}
        </div>
      )}
    </div>
  );
};

