import { useRef } from 'react';

/** PIN de 6 dígitos: um input numérico invisível sobre 6 casinhas. */
export function PinInput({
  value,
  onChange,
  label,
  autoFocus,
  onComplete,
  autoComplete = 'current-password'
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  autoFocus?: boolean;
  onComplete?: (v: string) => void;
  autoComplete?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="field">
      <span>{label}</span>
      <div className="pin" onClick={() => ref.current?.focus()}>
        <input
          ref={ref}
          aria-label={label}
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          autoComplete={autoComplete}
          maxLength={6}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '').slice(0, 6);
            onChange(v);
            if (v.length === 6) onComplete?.(v);
          }}
        />
        {Array.from({ length: 6 }, (_, i) => (
          <span key={i} className={`pin-box ${i === value.length ? 'cur' : ''} ${i < value.length ? 'on' : ''}`} aria-hidden="true">
            {i < value.length ? '•' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
