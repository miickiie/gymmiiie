import { Delete } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useI18n } from '../lib/i18n';
import './NumberPad.css';

const TH: Record<string, string> = {
  'Number pad': 'แป้นตัวเลข',
  'Number to enter': 'ค่าที่ต้องการกรอก',
  'Clear number': 'ล้างตัวเลข',
  Clear: 'ล้างค่า',
  'Decimal point': 'จุดทศนิยม',
  'Delete digit': 'ลบหลักสุดท้าย',
  Cancel: 'ยกเลิก',
  'Use value': 'ใช้ค่านี้',
};

export function NumberPad({
  value,
  unit,
  onApply,
  onCancel,
}: {
  value: string | number;
  unit?: string;
  onApply: (value: string, edited: boolean) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n(TH);
  const [draft, setDraft] = useState(String(value));
  const [replace, setReplace] = useState(true);
  const field = useRef<HTMLInputElement>(null);
  const valid = draft === '' || (/^\d*\.?\d+$/.test(draft.replace(/\.$/, '')) && Number.isFinite(Number(draft)) && Number(draft) >= 0);

  useEffect(() => {
    field.current?.focus({ preventScroll: true });
    field.current?.select();
  }, []);

  const digit = (key: string) => {
    setDraft((current) => replace || current === '0' ? key : current + key);
    setReplace(false);
  };
  const decimal = () => {
    setDraft((current) => replace || current === '' ? '0.' : current.includes('.') ? current : current + '.');
    setReplace(false);
  };
  const erase = () => {
    setDraft((current) => replace ? '' : current.slice(0, -1));
    setReplace(false);
  };
  const clear = () => {
    setDraft('');
    setReplace(false);
  };
  const apply = () => {
    if (valid) onApply(draft.endsWith('.') ? draft.slice(0, -1) : draft, !replace);
  };
  const keyboard = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Enter' && event.target === field.current) {
      event.preventDefault();
      apply();
      return;
    }
    if (/^\d$/.test(event.key)) digit(event.key);
    else if (event.key === '.' || event.key === ',') decimal();
    else if (event.key === 'Backspace') erase();
    else if (event.key === 'Delete') clear();
    else if (event.key !== '-' && event.key !== '+') return;
    event.preventDefault();
  };

  return (
    <form
      className="number-pad"
      onKeyDown={keyboard}
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        apply();
      }}
    >
      <div className="number-pad-display">
        <div className="relative min-w-0 flex-1">
          <input
            ref={field}
            type="text"
            inputMode="none"
            readOnly
            aria-label={t('Number to enter')}
            className="input number-pad-value"
            value={draft}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData('text').trim().replace(',', '.');
              if (/^\d*\.?\d*$/.test(pasted)) {
                setDraft(pasted);
                setReplace(false);
              }
            }}
          />
          {unit && <span className="number-pad-unit">{unit}</span>}
        </div>
        <button type="button" className="number-pad-tool" aria-label={t('Clear number')} onClick={clear}>
          {t('Clear')}
        </button>
      </div>
      <div className="number-pad-keys" role="group" aria-label={t('Number pad')}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((key) => (
          <button key={key} type="button" className="number-pad-key" onClick={() => digit(key)}>{key}</button>
        ))}
        <button type="button" className="number-pad-key" aria-label={t('Decimal point')} onClick={decimal}>.</button>
        <button type="button" className="number-pad-key" onClick={() => digit('0')}>0</button>
        <button type="button" className="number-pad-key" aria-label={t('Delete digit')} onClick={erase}>
          <Delete size={22} aria-hidden="true" />
        </button>
      </div>
      <div className="number-pad-actions">
        <button type="button" className="btn btn-soft" onClick={onCancel}>{t('Cancel')}</button>
        <button type="submit" className="btn btn-primary" disabled={!valid}>{t('Use value')}</button>
      </div>
    </form>
  );
}
