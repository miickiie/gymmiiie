import {
  Copy,
  CreditCard,
  Plus,
  ScanLine,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import {
  Btn,
  Card,
  Confirm,
  EmptyState,
  Field,
  PageHeader,
  Sheet,
  useToast,
} from '../components/ui';
import { useStore } from '../lib/store';
import type { GymPass } from '../types';

export default function PassPage() {
  const toast = useToast();
  const passes = useStore((s) => s.data.passes);
  const addPass = useStore((s) => s.addPass);
  const deletePass = useStore((s) => s.deletePass);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<GymPass | null>(null);
  const [showAtDesk, setShowAtDesk] = useState(false);
  const [confirm, setConfirm] = useState<GymPass | null>(null);
  const [name, setName] = useState('Gym');
  const [member, setMember] = useState('');
  const [code, setCode] = useState('');
  const [hue, setHue] = useState(24);
  const [error, setError] = useState('');

  const save = () => {
    if (!name.trim() || !code.trim()) {
      setError('Name and code are required.');
      return;
    }
    setError('');
    addPass({
      name: name.trim(),
      member: member.trim() || undefined,
      code: code.trim(),
      hue,
    });
    setOpen(false);
    setName('Gym');
    setMember('');
    setCode('');
    toast.push('Pass added', 'good');
  };

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.push('Code copied', 'good');
    } catch {
      toast.push('Could not copy', 'bad');
    }
  };

  return (
    <div className="page-enter">
      <PageHeader
        eyebrow="Gym pass"
        title="Never forget your card"
        subtitle="Keep membership numbers and entry codes with your account, available offline on this device."
        action={
          <Btn
            variant="primary"
            size="sm"
            onClick={() => setOpen(true)}
            icon={<Plus size={15} />}
          >
            Add pass
          </Btn>
        }
      />

      {passes.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {passes.map((p) => (
            <div key={p.id}>
              <PassCard
                pass={p}
                onClick={() => {
                  setShowAtDesk(false);
                  setDetail(p);
                }}
              />
              <div className="mt-2 flex justify-end gap-1">
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => copy(p.code)}
                  icon={<Copy size={13} />}
                >
                  Copy code
                </Btn>
                <Btn
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirm(p)}
                  icon={<Trash2 size={13} />}
                >
                  Delete
                </Btn>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<CreditCard size={26} />}
          title="No passes yet"
          body="Add your gym membership, pool card or door code so it’s always in your pocket."
          action={
            <Btn
              variant="primary"
              onClick={() => setOpen(true)}
              icon={<Plus size={15} />}
            >
              Add your first pass
            </Btn>
          }
        />
      )}

      <Card className="mt-6 flex items-start gap-3 p-4">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-[var(--accent)]" />
        <div>
          <p className="text-sm font-black">Local by default</p>
          <p className="mt-0.5 text-[11px] font-semibold leading-relaxed text-mute">
            Passes are stored in the same encrypted-on-upload snapshot as the
            rest of your log. Treat your sync code like a key to your gym bag.
          </p>
        </div>
      </Card>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add gym pass"
        footer={
          <Btn
            variant="primary"
            className="w-full"
            onClick={save}
            icon={<CreditCard size={15} />}
          >
            Save pass
          </Btn>
        }
      >
        <div className="space-y-3">
          {error && (
            <p role="alert" className="text-sm font-bold text-[var(--bad)]">
              {error}
            </p>
          )}
          <Field label="Pass name">
            <input
              className="input"
              placeholder="e.g. City Gym, Pool, Studio"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Member name (optional)">
            <input
              className="input"
              placeholder="Name on the card"
              value={member}
              onChange={(e) => setMember(e.target.value)}
            />
          </Field>
          <Field label="Code / number">
            <input
              className="input font-mono"
              placeholder="Scan code or membership number"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </Field>
          <div>
            <p className="label mb-1.5">Card colour</p>
            <input
              type="range"
              min={0}
              max={360}
              value={hue}
              onChange={(e) => setHue(Number(e.target.value))}
              className="w-full"
            />
            <div
              className="mt-2 h-12 rounded-xl"
              style={{
                background: `linear-gradient(135deg, hsl(${hue} 52% 38%), hsl(${hue + 28} 48% 20%))`,
              }}
            />
          </div>
        </div>
      </Sheet>

      <Sheet
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail?.name ?? 'Pass'}
      >
        {detail && (
          <div>
            <PassCard pass={detail} large />
            <div className="mt-4 flex gap-2">
              <Btn
                className="flex-1"
                onClick={() => copy(detail.code)}
                icon={<Copy size={15} />}
              >
                Copy code
              </Btn>
              <Btn
                className="flex-1"
                variant="soft"
                onClick={() => setShowAtDesk(true)}
                icon={<ScanLine size={15} />}
              >
                Show at desk
              </Btn>
            </div>
            {showAtDesk && (
              <div
                role="status"
                className="mt-4 rounded-2xl bg-white p-5 text-center text-black"
              >
                <p className="text-xs font-bold">Membership code</p>
                <p className="mt-2 break-all font-mono text-3xl font-black">
                  {detail.code}
                </p>
              </div>
            )}
            <p className="mt-3 text-center text-[10px] font-bold text-mute">
              Show the membership code to gym staff.
            </p>
          </div>
        )}
      </Sheet>

      <Confirm
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm) {
            deletePass(confirm.id);
            toast.push('Pass deleted');
          }
        }}
        title="Delete pass?"
        body={`“${confirm?.name ?? ''}” will be removed from this device and your synced snapshot.`}
        confirmLabel="Delete pass"
      />
    </div>
  );
}

function PassCard({
  pass,
  onClick,
  large,
}: {
  pass: GymPass;
  onClick?: () => void;
  large?: boolean;
}) {
  const Surface = onClick ? 'button' : 'div';
  return (
    <Surface
      aria-label={onClick ? `Show ${pass.name} pass` : undefined}
      onClick={onClick}
      className={`relative w-full overflow-hidden rounded-3xl border border-white/10 p-5 text-left text-white shadow-card transition ${onClick ? 'hover:brightness-110 active:scale-[.99]' : ''} ${large ? 'p-6' : ''}`}
      style={{
        background: `linear-gradient(135deg, hsl(${pass.hue} 52% 38%), hsl(${pass.hue + 28} 48% 20%))`,
      }}
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full border border-white/10" />
      <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full border border-white/10" />
      <div className="flex items-start justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
          <CreditCard size={19} />
        </div>
        <span className="text-[9px] font-black uppercase tracking-[0.22em] text-white/60">
          Member pass
        </span>
      </div>
      <p
        className={`mt-5 font-black tracking-tight ${large ? 'text-2xl' : 'text-lg'}`}
      >
        {pass.name}
      </p>
      <p className="text-[11px] font-bold text-white/65">
        {pass.member || 'Gymmiie member'}
      </p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-widest text-white/50">
            Code
          </p>
          <p className="break-all font-mono text-sm font-bold tracking-wider text-white/90">
            {pass.code}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-white/45">
        <span>Gymmiie</span>
        <span>Offline pass</span>
      </div>
    </Surface>
  );
}
