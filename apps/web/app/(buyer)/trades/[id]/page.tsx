import { TradeDetail } from '@/components/trade-detail';

export default function BuyerTradePage({ params }: { params: { id: string } }) {
  return <TradeDetail tradeId={params.id} />;
}
