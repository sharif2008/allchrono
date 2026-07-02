import { TradeDetail } from '@/components/trade-detail';

export default function AdminTradePage({ params }: { params: { id: string } }) {
  return <TradeDetail tradeId={params.id} />;
}
