import { Clock, DollarSign, Gavel, Truck } from 'lucide-react';
import type { AuctionFormValues } from '../../types/auctionForm';

interface AuctionFieldsProps {
  value: AuctionFormValues;
  onChange: (value: AuctionFormValues) => void;
}

export default function AuctionFields({ value, onChange }: AuctionFieldsProps) {
  const set = (field: keyof AuctionFormValues, next: string) => onChange({ ...value, [field]: next });

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border-2 border-lime-300 bg-white shadow-sm">
      <div className="flex items-center gap-3 bg-[#062b1d] px-5 py-4 text-white">
        <Gavel className="h-6 w-6 text-lime-400" />
        <div><h3 className="font-black">Auction settings</h3><p className="text-xs text-emerald-100">These fields are shown only for auction listings.</p></div>
      </div>
      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label="Starting price (USD)" icon={<DollarSign className="h-4 w-4" />}>
          <input required type="number" min="0.01" step="0.01" value={value.startingPrice} onChange={(event) => set('startingPrice', event.target.value)} className="auction-input" placeholder="10.00" />
        </Field>
        <Field label="Minimum bid increment (USD)" icon={<Gavel className="h-4 w-4" />}>
          <input required type="number" min="0.01" step="0.01" value={value.minimumBidIncrement} onChange={(event) => set('minimumBidIncrement', event.target.value)} className="auction-input" placeholder="1.00" />
        </Field>
        <Field label="Auction starts" icon={<Clock className="h-4 w-4" />}>
          <input required type="datetime-local" value={value.startsAt} onChange={(event) => set('startsAt', event.target.value)} className="auction-input" />
        </Field>
        <Field label="Auction ends" icon={<Clock className="h-4 w-4" />}>
          <input required type="datetime-local" value={value.endsAt} onChange={(event) => set('endsAt', event.target.value)} className="auction-input" />
        </Field>
        <Field label="Shipping paid by buyer (USD)" icon={<Truck className="h-4 w-4" />}>
          <input required type="number" min="0" step="0.01" value={value.shippingCost} onChange={(event) => set('shippingCost', event.target.value)} className="auction-input" />
        </Field>
        <Field label="Winner payment deadline" icon={<Clock className="h-4 w-4" />}>
          <select value={value.winnerPaymentWindowHours} onChange={(event) => set('winnerPaymentWindowHours', event.target.value)} className="auction-input">
            <option value="6">6 hours</option><option value="12">12 hours</option><option value="24">24 hours</option><option value="48">48 hours</option><option value="72">72 hours</option>
          </select>
        </Field>
      </div>
      <style>{`.auction-input{width:100%;border:2px solid #d1d5db;border-radius:.75rem;padding:.75rem 1rem;outline:none;background:#fff}.auction-input:focus{border-color:#84cc16;box-shadow:0 0 0 3px rgba(132,204,22,.18)}`}</style>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <label><span className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-800">{icon}{label}</span>{children}</label>;
}
