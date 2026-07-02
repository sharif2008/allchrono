import { PassportView, TradeState } from '@/lib/types';

export interface PipelineStep {
  id: string;
  label: string;
  shortLabel: string;
  actor: string;
  ledgerType?: string;
}

/** Happy-path steps from trade open through release and close. */
export const PIPELINE_STEPS: PipelineStep[] = [
  { id: 'DRAFT', label: 'Trade created', shortLabel: 'Trade', actor: 'Buyer' },
  {
    id: 'PENDING_AUTH',
    label: 'Submitted for authentication',
    shortLabel: 'Submit',
    actor: 'Seller',
  },
  {
    id: 'AUTH_PASSED',
    label: 'Authentication passed',
    shortLabel: 'Auth',
    actor: 'Authenticator',
    ledgerType: 'AUTHENTICATED',
  },
  { id: 'ESCROW_FUNDED', label: 'Escrow funded', shortLabel: 'Fund', actor: 'Buyer' },
  { id: 'SHIPPED', label: 'Watch shipped', shortLabel: 'Ship', actor: 'Seller' },
  { id: 'DELIVERED', label: 'Delivery confirmed', shortLabel: 'Deliver', actor: 'Admin' },
  {
    id: 'RELEASED',
    label: 'Funds released — trade closed',
    shortLabel: 'Close',
    actor: 'Buyer',
    ledgerType: 'TRANSFERRED',
  },
];

const STATE_INDEX: Record<string, number> = {
  DRAFT: 0,
  PENDING_AUTH: 1,
  AUTH_PASSED: 2,
  ESCROW_FUNDED: 3,
  SHIPPED: 4,
  DELIVERED: 5,
  DISPUTED: 5,
  RELEASED: 6,
};

const FAILED_AT: Partial<Record<string, number>> = {
  AUTH_FAILED: 2,
  EXPIRED: 2,
  REFUNDED_PRE_SHIP: 3,
  REFUNDED_POST_DELIVERY: 5,
  CANCELLED: 0,
  LOST_IN_TRANSIT: 4,
};

function stepStatus(
  stepIndex: number,
  state: TradeState,
): 'done' | 'current' | 'pending' | 'failed' {
  const failAt = FAILED_AT[state];
  if (failAt !== undefined) {
    if (stepIndex < failAt) return 'done';
    if (stepIndex === failAt) return 'failed';
    return 'pending';
  }
  const current = STATE_INDEX[state] ?? 0;
  if (stepIndex < current) return 'done';
  if (stepIndex === current) return 'current';
  return 'pending';
}

function inferStateFromPassport(passport: PassportView | null): TradeState | undefined {
  if (!passport?.entries.length) return undefined;
  const types = new Set(passport.entries.map((e) => e.type));
  if (types.has('TRANSFERRED')) return 'RELEASED';
  if (types.has('AUTHENTICATED')) return 'AUTH_PASSED';
  return undefined;
}

function connectorColor(leftStatus: ReturnType<typeof stepStatus>): string {
  if (leftStatus === 'done') return 'bg-emerald-400';
  if (leftStatus === 'failed') return 'bg-red-300';
  if (leftStatus === 'current') return 'bg-blue-300';
  return 'bg-slate-200';
}

interface Props {
  state?: TradeState;
  passport?: PassportView | null;
}

export function TradePipelineSteps({ state, passport }: Props) {
  const resolvedState = state ?? inferStateFromPassport(passport ?? null);
  if (!resolvedState) {
    return (
      <p className="text-sm text-slate-500">
        Pipeline progress appears once a trade has started.
      </p>
    );
  }

  const ledgerTypes = new Set(passport?.entries.map((e) => e.type) ?? []);
  const statuses = PIPELINE_STEPS.map((_, i) => stepStatus(i, resolvedState));

  return (
    <div className="overflow-x-auto pb-1">
      <ol
        className="flex min-w-[640px] items-start justify-between gap-0 px-1"
        aria-label="Verified trade pipeline"
      >
        {PIPELINE_STEPS.map((step, index) => {
          const status = statuses[index];
          const onLedger = step.ledgerType ? ledgerTypes.has(step.ledgerType) : false;
          const isLast = index === PIPELINE_STEPS.length - 1;

          return (
            <li
              key={step.id}
              className="flex flex-1 flex-col items-center"
              title={`${step.label} (${step.actor})`}
            >
              <div className="flex w-full items-center">
                {index > 0 && (
                  <div
                    className={`h-0.5 flex-1 ${connectorColor(statuses[index - 1])}`}
                    aria-hidden
                  />
                )}
                <StepNode status={status} index={index + 1} onLedger={onLedger} />
                {!isLast && (
                  <div
                    className={`h-0.5 flex-1 ${connectorColor(status)}`}
                    aria-hidden
                  />
                )}
              </div>

              <div className="mt-2 w-full max-w-[5.5rem] text-center">
                <p
                  className={`text-xs font-semibold leading-tight ${
                    status === 'current'
                      ? 'text-blue-700'
                      : status === 'done'
                        ? 'text-emerald-700'
                        : status === 'failed'
                          ? 'text-red-700'
                          : 'text-slate-500'
                  }`}
                >
                  {step.shortLabel}
                </p>
                <p className="mt-0.5 text-[10px] leading-tight text-slate-400">{step.actor}</p>
                {onLedger && (
                  <span className="mt-1 inline-block rounded bg-brass/15 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-brass">
                    passport
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function StepNode({
  status,
  index,
  onLedger,
}: {
  status: 'done' | 'current' | 'pending' | 'failed';
  index: number;
  onLedger: boolean;
}) {
  const base =
    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ring-4 ring-white';

  if (status === 'done') {
    return (
      <span className={`${base} bg-emerald-500 text-white`} aria-current={undefined}>
        ✓
        {onLedger && <LedgerDot />}
      </span>
    );
  }
  if (status === 'current') {
    return (
      <span
        className={`${base} bg-blue-500 text-white shadow-md shadow-blue-200`}
        aria-current="step"
      >
        {index}
        {onLedger && <LedgerDot />}
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className={`${base} bg-red-500 text-white`} aria-current="step">
        ✕
      </span>
    );
  }
  return (
    <span className={`${base} border-2 border-slate-300 bg-white text-slate-400`}>
      {index}
    </span>
  );
}

function LedgerDot() {
  return (
    <span
      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brass"
      title="Recorded on passport"
    />
  );
}
