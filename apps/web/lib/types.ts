export type TradeState =
  | 'DRAFT'
  | 'PENDING_AUTH'
  | 'AUTH_PASSED'
  | 'AUTH_FAILED'
  | 'ESCROW_FUNDED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'DISPUTED'
  | 'RELEASED'
  | 'REFUNDED_PRE_SHIP'
  | 'REFUNDED_POST_DELIVERY'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'LOST_IN_TRANSIT';

export type WatchStatus = 'UNLISTED' | 'LISTED' | 'IN_TRADE' | 'SOLD';

export interface WatchCard {
  id: string;
  brand: string;
  model: string;
  referenceNumber: string;
  serialFingerprint: string;
  askingPrice: string;
  condition: string;
  listingPhotos: string[];
  status: WatchStatus;
  activeTradeId?: string | null;
  activeTradeState?: TradeState | null;
}

export interface Catalogue {
  items: WatchCard[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface LedgerEntry {
  sequenceNo: number;
  type: string;
  payload: Record<string, unknown>;
  prevHash: string | null;
  thisHash: string;
  signer: string;
  signature: string;
  createdAt: string;
}

export interface PassportView {
  serial: string;
  verified: boolean;
  entries: LedgerEntry[];
}

export interface WatchDetail extends WatchCard {
  sellerId: string;
  sellerEmail: string;
  activeTradeId?: string | null;
  activeTradeState?: TradeState | null;
  passport: PassportView | null;
}

export interface TradeView {
  tradeId: string;
  state: TradeState;
  viewer: 'BUYER' | 'SELLER' | 'ADMIN' | 'AUTHENTICATOR';
  watch: {
    id: string;
    brand: string;
    model: string;
    referenceNumber: string;
    serialFingerprint: string;
    condition: string;
    listingPhotos: string[];
  };
  grossAmount: string;
  trackingNumber: string | null;
  nextActions: string[];
  passportHistory: PassportView | null;
  walletBalance?: string;
  fundedAmount?: string | null;
  disputeDeadline?: string | null;
  escrowDueAt?: string | null;
  commissionAmount?: string;
  sellerNetAmount?: string;
  shipmentSla?: string | null;
  authFailedReason?: string | null;
  buyerId?: string;
  sellerId?: string;
}
