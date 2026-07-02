import { PassportView, TradeState } from '@/lib/types';
import { TradePipelineSteps } from './trade-pipeline-steps';

interface Props {
  passport: PassportView | null;
  /** Required to render the pipeline stepper (trade workspace only). */
  tradeState?: TradeState;
  /** When true, show the verified trade pipeline (buyer/seller trade view). */
  showPipeline?: boolean;
  /** When true, show the full hash-chain ledger (trade workspace only). */
  showLedger?: boolean;
}

/** Public catalogue: verification badge only — no pipeline or ledger details. */
export function PublicPassportSummary({ passport }: { passport: PassportView | null }) {
  if (!passport) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        No passport on record for this watch.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
      <div
        className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${
          passport.verified ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            passport.verified ? 'bg-emerald-500' : 'bg-red-500'
          }`}
        />
        {passport.verified
          ? 'Passport verified on file'
          : 'Passport verification failed'}
        <span className="ml-auto font-mono text-xs text-slate-500">{passport.serial}</span>
      </div>
      <p className="text-sm text-slate-500">
        The verified trade pipeline and full ledger are visible only to the buyer and seller in
        their trade workspace after a purchase is started.
      </p>
    </div>
  );
}

export function PassportHistory({
  passport,
  tradeState,
  showPipeline = false,
  showLedger = false,
}: Props) {
  const canShowPipeline = showPipeline && !!tradeState;

  return (
    <div className="space-y-6">
      {canShowPipeline ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Verified trade pipeline
          </h3>
          <TradePipelineSteps state={tradeState} passport={passport} />
        </div>
      ) : null}

      {!showLedger ? null : !passport ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">
          No passport on record for this watch.
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Passport ledger (hash chain)
          </h3>
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold ${
              passport.verified ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'
            }`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                passport.verified ? 'bg-emerald-500' : 'bg-red-500'
              }`}
            />
            {passport.verified
              ? 'Passport chain verified — hash chain intact'
              : 'Passport chain FAILED verification — data may be tampered'}
            <span className="ml-auto font-mono text-xs text-slate-500">{passport.serial}</span>
          </div>

          {passport.entries.length === 0 ? (
            <p className="text-sm text-slate-500">No ledger entries yet.</p>
          ) : (
            <ol className="relative space-y-4 border-l border-slate-200 pl-6">
              {passport.entries.map((e) => (
                <li key={e.sequenceNo} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-brass" />
                  <div className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-ink">
                        #{e.sequenceNo} · {e.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(e.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {e.type === 'TRANSFERRED' && (
                      <p className="mt-1 text-xs text-slate-600">
                        Ownership transfer recorded — trade closed on passport.
                      </p>
                    )}
                    {e.type === 'AUTHENTICATED' && (
                      <p className="mt-1 text-xs text-slate-600">
                        Watch authenticated — ready for escrow funding.
                      </p>
                    )}
                    <p className="mt-1 break-all font-mono text-[11px] text-slate-400">
                      hash: {e.thisHash.slice(0, 24)}…
                    </p>
                    <p className="break-all font-mono text-[11px] text-slate-400">
                      prev: {e.prevHash ? `${e.prevHash.slice(0, 24)}…` : '∅ (genesis)'}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
