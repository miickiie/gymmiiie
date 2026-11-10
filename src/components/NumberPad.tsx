import { Delete } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import './NumberPad.css';

export function NumberPad({ value, label, unit, onApply, onCancel }: {
  value: string | number;
  label: string;
  unit?: string;
  onApply: (value: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [replace, setReplace] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  const valid = draft === '' || (draft.trim() !== '' && Number.isFinite(Number(draft)));

  useEffect(() => {
    form.current?.focus({ preventScroll: true });
  }, []);

  const digit = (key: string) => {
    setDraft((current) => replace ? key : current === '0' ? key : current + key);
    setReplace(false);
  };
  const decimal = () => {
    setDraft((current) => replace || current === '' ? '0.' : current === '-' ? '-0.' : current.includes('.') ? current : current + '.');
    setReplace(false);
  };
  const erase = () => {
    setDraft((current) => current.slice(0, -1));
    setReplace(false);
  };
  const clear = () => {
    setDraft('');
    setReplace(false);
  };
  const sign = () => {
    setDraft((current) => current.startsWith('-') ? current.slice(1) : '-' + current);
    setReplace(false);
  };
  const apply = () => {
    if (valid) onApply(draft.endsWith('.') ? draft.slice(0, -1) : draft);
  };
  const keyboard = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' && event.target === form.current) {
      event.preventDefault();
      apply();
      return;
    }
    if (/^\d$/.test(event.key)) digit(event.key);
    else if (event.key === '.' || event.key === ',') decimal();
    else if (event.key === 'Backspace') erase();
    else if (event.key === 'Delete') clear();
    else if (event.key === '-') sign();
    else return;
    event.preventDefault();
  };

  return (
    <form
      ref={form}
      tabIndex={-1}
      className="number-pad"
      onKeyDown={keyboard}
      onSubmit={(event) => {
        event.preventDefault();
        apply();
      }}
    >
      <div className="number-pad-display">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-black text-dim">{label}</p>
          <output aria-label="Number to enter" aria-live="polite" className="number-pad-value">
            {draft || '—'} <span>{unit}</span>
          </output>
        </div>
        <button type="button" className="number-pad-tool" aria-label="Change sign" onClick={sign}>±</button>
        <button type="button" className="number-pad-tool" aria-label="Clear number" onClick={clear}>Clear</button>
      </div>
      <div className="number-pad-keys">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
          <button key={key} type="button" className="number-pad-key" onClick={() => digit(key)}>{key}</button>
        ))}
        <button type="button" className="number-pad-key" aria-label="Decimal point" onClick={decimal}>.</button>
        <button type="button" className="number-pad-key" onClick={() => digit('0')}>0</button>
        <button type="button" className="number-pad-key" aria-label="Delete digit" onClick={erase}><Delete size={22} aria-hidden="true" /></button>
      </div>
      <div className="number-pad-actions">
        <button type="button" className="btn btn-soft" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>Apply number</button>
      </div>
    </form>
  );
}
