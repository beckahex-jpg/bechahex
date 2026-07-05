import { Gavel, Tag } from 'lucide-react';
import type { ListingType } from '../../types/auctionForm';

interface ListingTypeSelectorProps {
  value: ListingType;
  onChange: (value: ListingType) => void;
}

export default function ListingTypeSelector({ value, onChange }: ListingTypeSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onChange('fixed_price')}
        className={`rounded-2xl border-2 p-5 text-left transition ${value === 'fixed_price' ? 'border-lime-400 bg-[#062b1d] text-white shadow-lg' : 'border-gray-200 bg-white text-gray-900 hover:border-lime-300'}`}
      >
        <Tag className={`mb-3 h-7 w-7 ${value === 'fixed_price' ? 'text-lime-400' : 'text-emerald-700'}`} />
        <p className="text-lg font-black">Fixed price</p>
        <p className={`mt-1 text-sm ${value === 'fixed_price' ? 'text-emerald-100' : 'text-gray-500'}`}>The buyer purchases immediately at the listed price.</p>
      </button>
      <button
        type="button"
        onClick={() => onChange('auction')}
        className={`rounded-2xl border-2 p-5 text-left transition ${value === 'auction' ? 'border-lime-400 bg-[#062b1d] text-white shadow-lg' : 'border-gray-200 bg-white text-gray-900 hover:border-lime-300'}`}
      >
        <Gavel className={`mb-3 h-7 w-7 ${value === 'auction' ? 'text-lime-400' : 'text-emerald-700'}`} />
        <p className="text-lg font-black">Auction</p>
        <p className={`mt-1 text-sm ${value === 'auction' ? 'text-emerald-100' : 'text-gray-500'}`}>Buyers compete until the auction closing time.</p>
      </button>
    </div>
  );
}
