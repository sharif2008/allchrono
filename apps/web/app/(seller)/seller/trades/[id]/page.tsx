import { TradeDetail } from '@/components/trade-detail';

export default function SellerTradePage({ params }: { params: { id: string } }) {
  return <TradeDetail tradeId={params.id} />;
}
