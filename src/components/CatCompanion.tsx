import { ChevronRight, Heart, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import './CatCompanion.css';

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
}

const ENCOURAGEMENTS = [
  'One rep at a time. Your effort counts, and this cat is cheering for you!',
  'Tiny steps, strong habits. Pick a pace that feels right today.',
  'Relax those shoulders, take a breath, and give yourself some credit.',
  'Rest is part of getting stronger. A little water break sounds purr-fect.',
  'No perfect workouts required. Showing up is already a win.',
];

function greeting(pathname: string): string {
  if (pathname === '/session')
    return 'Your little spotter is here! Take each set at your own pace. Tap for a pep talk.';
  if (pathname === '/train')
    return 'Ready when you are. Pick a workout and let’s get a little stronger together!';
  if (pathname.startsWith('/history'))
    return 'Look at all that effort! Every workout is a reason to be proud.';
  if (pathname === '/progress')
    return 'Progress has ups and downs. This cat is proud of every step you take.';
  if (pathname === '/nutrition')
    return 'A well-fed human is a happy human. Let’s fuel your next adventure!';
  if (pathname.startsWith('/routines') || pathname.startsWith('/library'))
    return 'A little planning, a little play. Let’s find moves you enjoy.';
  return 'Hey, workout buddy! Mochi’s here to cheer you on. Tap this cat whenever you need a little encouragement.';
}

function CatFace({ happy, worried }: { happy: boolean; worried: boolean }) {
  return (
    <svg
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
}: CatCompanionProps) {
  const { pathname } = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [petted, setPetted] = useState(false);
  const encouragementIndex = useRef(0);
  const catButton = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const visible = Boolean(message) || !dismissed;
  const tone = message?.tone ?? 'default';
  const happy = petted || tone === 'good';
  const paused = hovered || focused;

  useEffect(() => {
    setDismissed(false);
  }, [pathname]);

  useEffect(() => {
    if (message) setDismissed(true);
  }, [message]);

  useEffect(() => {
    setHovered(false);
    setFocused(false);
  }, [host]);

  useEffect(() => {
    if (paused || !visible || message?.persistent) return;
    const timeout = window.setTimeout(
      message ? onDismiss : () => setDismissed(true),
      message?.tone === 'bad' ? 9000 : 6500,
    );
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
    setDismissed(true);
    if (message) onDismiss();
  };

  const encourage = () => {
    const next = ENCOURAGEMENTS[encouragementIndex.current % ENCOURAGEMENTS.length];
    encouragementIndex.current += 1;
    setPetted(true);
    setDismissed(true);
    onEncourage(next);
  };

  if (host && !message) return null;

  const content = (
    <aside
      aria-label="Mochi, your workout cat"
      className={`gym-cat-companion${pathname === '/session' ? ' is-training' : ''}${host ? ' in-dialog' : ''}`}
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
          <div className="gym-cat-bubble-heading">
            <span><Sparkles size={12} aria-hidden="true" /> Mochi says</span>
            <button type="button" className="gym-cat-dismiss" aria-label="Dismiss Mochi’s message" onClick={dismiss} disabled={message?.action?.disabled}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          <p role={tone === 'bad' ? 'alert' : 'status'} aria-atomic="true">
            {message?.msg ?? greeting(pathname)}
          </p>
          {message?.action && (
            <div className="gym-cat-actions" aria-busy={message.action.disabled}>
              <button type="button" className="gym-cat-action" onClick={message.action.onClick} disabled={message.action.disabled}>
                {message.action.label}
              </button>
              <button type="button" className="gym-cat-later" onClick={dismiss} disabled={message.action.disabled}>
                Later
              </button>
            </div>
          )}
          {pending > 0 && (
            <button type="button" className="gym-cat-next" onClick={dismiss}>
              Next message <span>{pending}</span> <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
      <button
        ref={catButton}
        type="button"
        className={`gym-cat-button${happy ? ' is-happy' : ''}`}
        onClick={encourage}
        aria-label="Pet Mochi for workout encouragement"
        aria-expanded={visible}
      >
        <span className="gym-cat-heart" aria-hidden="true"><Heart size={17} fill="currentColor" /></span>
        <span className="gym-cat-sprite"><CatFace happy={happy} worried={tone === 'bad'} /></span>
        <span className="gym-cat-name">Mochi <span aria-hidden="true">♥</span></span>
      </button>
    </aside>
  );
  return host ? createPortal(content, host) : content;
}
