import { ArrowRight, Gavel, Heart, Package, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="bg-white py-3 sm:py-4">
      <div className="market-container">
        <div className="relative min-h-[285px] overflow-hidden rounded-3xl bg-[#DDF7B2] text-[#032F24] sm:min-h-[255px]">
          <div aria-hidden="true" className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-[#9BEC2D]/70" />
          <div aria-hidden="true" className="absolute -bottom-36 right-48 h-72 w-72 rounded-full border-[44px] border-white/50" />

          <div className="relative grid min-h-[285px] items-center px-6 py-8 sm:min-h-[255px] sm:px-10 lg:grid-cols-[1.08fr_.92fr] lg:px-14">
            <div className="max-w-2xl">
              <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-emerald-800">
                <Sparkles className="h-4 w-4" /> The Beckah marketplace
              </p>
              <h1 className="text-balance text-3xl font-black leading-[1.04] tracking-tight sm:text-4xl lg:text-5xl">
                Find something worth keeping.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-950/80 sm:text-base">
                Shop pre-owned, donated, and auction items while supporting the community.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button type="button" onClick={() => navigate('/products')} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#032F24] px-6 text-sm font-bold text-white transition hover:bg-[#07513B]">
                  Shop now <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => navigate('/submit-product')} className="text-sm font-bold underline decoration-2 underline-offset-4 hover:text-emerald-800">Sell an item</button>
              </div>
            </div>

            <div className="pointer-events-none absolute -right-6 bottom-4 hidden h-[220px] w-[44%] lg:block">
              <VisualTile className="absolute bottom-4 left-3 h-32 w-32 -rotate-6 bg-white" icon={Package} label="Buy it now" />
              <VisualTile className="absolute left-36 top-0 h-40 w-40 rotate-3 bg-[#032F24] text-white" icon={Gavel} label="Live auctions" dark />
              <VisualTile className="absolute bottom-0 right-4 h-28 w-28 rotate-6 bg-white" icon={Heart} label="Community" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

interface VisualTileProps {
  className: string;
  icon: typeof Package;
  label: string;
  dark?: boolean;
}

function VisualTile({ className, icon: Icon, label, dark = false }: VisualTileProps) {
  return (
    <div className={`${className} flex flex-col items-center justify-center rounded-3xl shadow-xl`}>
      <span className={`flex h-12 w-12 items-center justify-center rounded-full ${dark ? 'bg-[#9BEC2D] text-[#032F24]' : 'bg-emerald-100 text-emerald-800'}`}><Icon className="h-6 w-6" /></span>
      <span className="mt-3 text-xs font-black">{label}</span>
    </div>
  );
}
