import { ChevronRight, Heart, X } from 'lucide-react';
import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useI18n } from '../lib/i18n';
import './CatCompanion.css';

const TH: Record<string, string> = {
  'One rep at a time. Your effort counts, and this cat is cheering for you!':
    'ทีละครั้ง ความพยายามของคุณมีความหมาย เจ้าแมวน้อยเชียร์อยู่!',
  'Tiny steps, strong habits. Pick a pace that feels right today.':
    'เริ่มทีละนิด ฝึกจนเป็นนิสัย เลือกจังหวะที่เหมาะกับตัวเองในวันนี้',
  'Relax those shoulders, take a breath, and give yourself some credit.':
    'ผ่อนไหล่ หายใจลึก ๆ แล้วให้เครดิตตัวเองหน่อย',
  'Rest is part of getting stronger. A little water break sounds purr-fect.':
    'พักคือส่วนหนึ่งของการแข็งแรงขึ้น ดื่มน้ำหน่อยไหมเมี้ยว',
  'No perfect workouts required. Showing up is already a win.':
    'ไม่ต้องฝึกสมบูรณ์แบบ แค่มาก็ชนะแล้ว',
  'Mochi, your workout cat': 'Mochi แมวคู่ฝึกของคุณ',
  'Dismiss Mochi’s message': 'ปิดข้อความจาก Mochi',
  'Pet Mochi for workout encouragement': 'ลูบ Mochi เพื่อรับกำลังใจ',
  Later: 'ไว้ทีหลัง',
  'Next message': 'ข้อความถัดไป',
};

interface CatMessage {
  id: number;
  msg: string;
  tone: 'default' | 'good' | 'bad';
  persistent?: boolean;
  action?: { label: string; onClick: () => void; disabled: boolean };
}

interface CatCompanionProps {
  message?: CatMessage;
  pending: number;
  onDismiss: () => void;
  onEncourage: (message: string) => void;
  host?: HTMLElement;
  dock?: HTMLElement;
}

const ENCOURAGEMENTS = [
  'One rep at a time. Your effort counts, and this cat is cheering for you!',
  'Tiny steps, strong habits. Pick a pace that feels right today.',
  'Relax those shoulders, take a breath, and give yourself some credit.',
  'Rest is part of getting stronger. A little water break sounds purr-fect.',
  'No perfect workouts required. Showing up is already a win.',
];

function CatFace({ happy, worried, faceRef, eyesRef }: {
  happy: boolean;
  worried: boolean;
  faceRef: RefObject<SVGSVGElement>;
  eyesRef: RefObject<SVGGElement>;
}) {
  return (
    <svg
      ref={faceRef}
      viewBox="0 0 16 12"
      shapeRendering="crispEdges"
      className="gym-cat-face"
      aria-hidden="true"
    >
      <path d="M2 0H4V1H5V2H11V1H12V0H14V1H15V4H16V9H15V10H14V11H13V12H3V11H2V10H1V9H0V4H1V1H2Z" fill="#5d6570" />
      <path d="M2 1H3V3H13V1H14V4H15V9H14V10H13V11H3V10H2V9H1V4H2Z" fill="#f6f3eb" />
      <path d="M3 1H4V2H5V3H3Z M12 1H13V3H11V2H12Z" fill="#f0bcc6" />
      <path d="M2 3H14V4H2Z" fill="#df7f4a" />
      <path d="M7 3H9V4H7Z" fill="#f9d7a5" />
      <g ref={eyesRef} className="gym-cat-gaze">
        <g className={happy ? 'gym-cat-eyes is-happy' : 'gym-cat-eyes'} fill="#383e48">
        {happy ? (
          <path d="M3 5H5V6H3Z M2 6H3V7H2Z M5 6H6V7H5Z M11 5H13V6H11Z M10 6H11V7H10Z M13 6H14V7H13Z" />
        ) : (
          <>
            <path d="M3 5H5V7H3Z M11 5H13V7H11Z" />
            {worried && <path d="M3 4H4V5H3Z M12 4H13V5H12Z" />}
          </>
        )}
        </g>
      </g>
      <path d="M7 7H9V8H7Z" fill="#e59ca8" />
      <path d="M1 8H3V9H1Z M13 8H15V9H13Z" fill="#f2bac3" />
      {happy && <path d="M7 8H9V9H7Z" fill="#e27488" />}
    </svg>
  );
}

export function CatCompanion({
  message,
  pending,
  onDismiss,
  onEncourage,
  host,
  dock,
}: CatCompanionProps) {
  const { t } = useI18n(TH);
  const { pathname } = useLocation();
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [petted, setPetted] = useState(false);
  const encouragementIndex = useRef(0);
  const catButton = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const face = useRef<SVGSVGElement>(null);
  const eyes = useRef<SVGGElement>(null);
  const gazeTarget = useRef<{ x: number; y: number }>();
  const visible = Boolean(message);
  const tone = message?.tone ?? 'default';
  const happy = petted || tone === 'good';
  const paused = hovered || focused;

  useEffect(() => {
    let frame: number | undefined;
    const updateEyes = () => {
      frame = undefined;
      if (!face.current || !eyes.current) return;
      const target = gazeTarget.current;
      const box = face.current.getBoundingClientRect();
      const x = target ? Math.max(-1, Math.min(1, (target.x - box.left - box.width / 2) / Math.max(1, box.width))) * 0.7 : 0;
      const y = target ? Math.max(-1, Math.min(1, (target.y - box.top - box.height / 2) / Math.max(1, box.height))) * 0.5 : 0;
      eyes.current.setAttribute('transform', `translate(${x} ${y})`);
    };
    const schedule = () => {
      if (frame === undefined) frame = window.requestAnimationFrame(updateEyes);
    };
    const point = (event: PointerEvent) => {
      if (event.type === 'pointermove' && event.pointerType !== 'mouse') return;
      gazeTarget.current = { x: event.clientX, y: event.clientY };
      schedule();
    };
    const focus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const box = event.target.getBoundingClientRect();
      gazeTarget.current = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
      schedule();
    };
    const reset = () => {
      gazeTarget.current = undefined;
      schedule();
    };
    document.addEventListener('pointermove', point, { passive: true });
    document.addEventListener('pointerdown', point, { passive: true, capture: true });
    document.addEventListener('focusin', focus);
    window.addEventListener('blur', reset);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      document.removeEventListener('pointermove', point);
      document.removeEventListener('pointerdown', point, true);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('blur', reset);
      window.removeEventListener('resize', schedule);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [host, dock, visible]);

  useEffect(() => {
    setHovered(false);
    setFocused(false);
  }, [host, dock]);

  useEffect(() => {
    if (!visible) setHovered(false);
  }, [visible]);

  useEffect(() => {
    if (paused || !message || message.persistent) return;
    const timeout = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss, paused, visible]);

  useEffect(() => {
    if (!petted) return;
    const timeout = window.setTimeout(() => setPetted(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [petted]);

  const dismiss = () => {
    if (bubble.current?.contains(document.activeElement)) {
      const target = host && pending === 0
        ? host.closest<HTMLElement>('[role="dialog"]')
        : catButton.current;
      target?.focus();
    }
    if (message) onDismiss();
  };

  const encourage = () => {
    const next = ENCOURAGEMENTS[encouragementIndex.current % ENCOURAGEMENTS.length];
    encouragementIndex.current += 1;
    setPetted(true);
    onEncourage(t(next));
  };

  if (host && !message) return null;

  const content = (
    <aside
      aria-label={t('Mochi, your workout cat')}
      className={`gym-cat-companion${pathname === '/session' ? ' is-training' : ''}${host ? ' in-dialog' : dock ? ' in-dock' : ''}`}
      data-tone={tone}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
    >
      {visible && (
        <div
          ref={bubble}
          className="gym-cat-bubble"
          onPointerEnter={(event) => {
            if (event.pointerType === 'mouse') setHovered(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType === 'mouse') setHovered(false);
          }}
        >
            <button type="button" className="gym-cat-dismiss" aria-label={t('Dismiss Mochi’s message')} onClick={dismiss} disabled={message?.action?.disabled}>
              <X size={15} aria-hidden="true" />
            </button>
          <p role={tone === 'bad' ? 'alert' : 'status'} aria-atomic="true">
            {message?.msg}
          </p>
          {message?.action && (
            <div className="gym-cat-actions" aria-busy={message.action.disabled}>
              <button type="button" className="gym-cat-action" onClick={message.action.onClick} disabled={message.action.disabled}>
                {message.action.label}
              </button>
              <button type="button" className="gym-cat-later" onClick={dismiss} disabled={message.action.disabled}>
                {t('Later')}
              </button>
            </div>
          )}
          {pending > 0 && (
            <button type="button" className="gym-cat-next" onClick={dismiss}>
              {t('Next message')} <span>{pending}</span> <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <button
        ref={catButton}
        type="button"
        className={`gym-cat-button${happy ? ' is-happy' : ''}`}
        onClick={encourage}
        aria-label={t('Pet Mochi for workout encouragement')}
        aria-expanded={visible}
      >
        <span className="gym-cat-heart" aria-hidden="true"><Heart size={17} fill="currentColor" /></span>
        <span className="gym-cat-sprite"><CatFace happy={happy} worried={tone === 'bad'} faceRef={face} eyesRef={eyes} /></span>
      </button>
    </aside>
  );
  const portalHost = host ?? dock;
  return portalHost ? createPortal(content, portalHost) : content;
}
