import { Verdict } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  isTerminal,
  TradeState,
} from './trade-state.enum';
import { InvalidTransitionException } from './invalid-transition.exception';

export interface TradeProps {
  id: string;
  watchId: string;
  sellerId: string;
  buyerId: string;
  state: TradeState;
  grossAmount: number;
  commissionAmount: number;
  sellerNetAmount: number;
  authReportId?: string | null;
  shipmentId?: string | null;
  authPassedAt?: Date | null;
  escrowDueAt?: Date | null;
  disputeDeadline?: Date | null;
  releasedAt?: Date | null;
  cancelledAt?: Date | null;
}

export interface TransitionRecord {
  fromState: TradeState;
  toState: TradeState;
  action: string;
  actorId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Dispute window length once a watch is delivered. */
const DISPUTE_WINDOW_MS = 72 * 60 * 60 * 1000; // 72h

/**
 * Trade aggregate — the transactional spine of the pipeline.
 *
 * ALL lifecycle rules live here, never in controllers. Each method validates
 * the current state before mutating and records a {@link TransitionRecord} that
 * the application service persists to trade_state_history inside one DB tx.
 */
export class Trade {
  private readonly props: TradeProps;
  private readonly _transitions: TransitionRecord[] = [];

  constructor(props: TradeProps) {
    this.props = { ...props };
  }

  // --- read accessors ---------------------------------------------------
  get id(): string {
    return this.props.id;
  }
  get state(): TradeState {
    return this.props.state;
  }
  get watchId(): string {
    return this.props.watchId;
  }
  get sellerId(): string {
    return this.props.sellerId;
  }
  get buyerId(): string {
    return this.props.buyerId;
  }
  get grossAmount(): number {
    return this.props.grossAmount;
  }
  get sellerNetAmount(): number {
    return this.props.sellerNetAmount;
  }
  get snapshot(): Readonly<TradeProps> {
    return { ...this.props };
  }
  get pendingTransitions(): ReadonlyArray<TransitionRecord> {
    return this._transitions;
  }

  isTerminal(): boolean {
    return isTerminal(this.props.state);
  }

  // --- transition primitive --------------------------------------------
  private transition(
    to: TradeState,
    action: string,
    actorId?: string | null,
    metadata?: Record<string, unknown>,
  ): void {
    const from = this.props.state;
    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new InvalidTransitionException(from, action);
    }
    this.props.state = to;
    this._transitions.push({ fromState: from, toState: to, action, actorId, metadata });
  }

  // --- lifecycle methods -----------------------------------------------

  submitForAuth(actorId: string): void {
    this.transition(TradeState.PENDING_AUTH, 'submitForAuth', actorId);
  }

  recordAuthentication(
    verdict: Verdict,
    reportId: string,
    now: Date,
    escrowDueHours: number,
  ): void {
    if (this.props.state !== TradeState.PENDING_AUTH) {
      throw new InvalidTransitionException(this.props.state, 'recordAuthentication');
    }
    this.props.authReportId = reportId;
    if (verdict === Verdict.PASS) {
      this.props.authPassedAt = now;
      this.props.escrowDueAt = new Date(now.getTime() + escrowDueHours * 3600 * 1000);
      this.transition(TradeState.AUTH_PASSED, 'recordAuthentication', null, {
        verdict,
        reportId,
      });
    } else {
      // FAIL and INCONCLUSIVE both stop the pipeline at AUTH_FAILED (terminal).
      this.transition(TradeState.AUTH_FAILED, 'recordAuthentication', null, {
        verdict,
        reportId,
      });
    }
  }

  /** Lazy expiration: called whenever an AUTH_PASSED trade is loaded/funded. */
  expireIfOverdue(now: Date): boolean {
    if (
      this.props.state === TradeState.AUTH_PASSED &&
      this.props.escrowDueAt &&
      now.getTime() > this.props.escrowDueAt.getTime()
    ) {
      this.transition(TradeState.EXPIRED, 'expire', null, { reason: 'escrow_due_passed' });
      return true;
    }
    return false;
  }

  expire(now: Date): void {
    void now;
    this.transition(TradeState.EXPIRED, 'expire', null, { reason: 'manual' });
  }

  fundEscrow(now: Date): void {
    if (this.props.state === TradeState.AUTH_PASSED && this.props.escrowDueAt && now.getTime() > this.props.escrowDueAt.getTime()) {
      throw new InvalidTransitionException(
        this.props.state,
        'fundEscrow',
        'Escrow funding deadline has passed; trade is expired.',
      );
    }
    this.transition(TradeState.ESCROW_FUNDED, 'fundEscrow');
  }

  markShipped(trackingNumber: string, shipmentId: string, now: Date): void {
    void now;
    this.props.shipmentId = shipmentId;
    this.transition(TradeState.SHIPPED, 'markShipped', null, { trackingNumber });
  }

  markDelivered(now: Date): void {
    this.props.disputeDeadline = new Date(now.getTime() + DISPUTE_WINDOW_MS);
    this.transition(TradeState.DELIVERED, 'markDelivered', null, {
      disputeDeadline: this.props.disputeDeadline.toISOString(),
    });
  }

  markLostInTransit(now: Date): void {
    void now;
    this.transition(TradeState.LOST_IN_TRANSIT, 'markLostInTransit');
  }

  dispute(reason: string, now: Date): void {
    if (
      this.props.state === TradeState.DELIVERED &&
      this.props.disputeDeadline &&
      now.getTime() > this.props.disputeDeadline.getTime()
    ) {
      throw new InvalidTransitionException(
        this.props.state,
        'dispute',
        'Dispute window has closed.',
      );
    }
    this.transition(TradeState.DISPUTED, 'dispute', null, { reason });
  }

  releaseFunds(actorId: string | null, now: Date): void {
    this.props.releasedAt = now;
    this.transition(TradeState.RELEASED, 'releaseFunds', actorId, {
      releasedAt: now.toISOString(),
    });
  }

  refundPreShip(now: Date): void {
    void now;
    this.transition(TradeState.REFUNDED_PRE_SHIP, 'refundPreShip');
  }

  refundPostDelivery(now: Date): void {
    void now;
    this.transition(TradeState.REFUNDED_POST_DELIVERY, 'refundPostDelivery');
  }

  cancel(actorId: string, now: Date): void {
    this.props.cancelledAt = now;
    this.transition(TradeState.CANCELLED, 'cancel', actorId);
  }
}
