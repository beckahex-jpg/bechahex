import { ArrowRight, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Hero() {
  const navigate = useNavigate();

  return (
    <section className="bg-white py-3 sm:py-4">
      <div className="market-container">
        <div className="relative min-h-[285px] overflow-hidden rounded-3xl bg-[#E3EFA6] text-[#032F24] lg:min-h-[330px]">
          <img
            src="/hero-marketplace-donation-box.png"
            alt=""
            aria-hidden="true"
            width="1983"
            height="793"
            draggable="false"
            className="pointer-events-none absolute -right-4 top-1/2 hidden h-[390px] w-auto max-w-none -translate-y-1/2 select-none lg:block [mask-image:linear-gradient(to_right,transparent_0%,black_25%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_25%)]"
          />

          <div className="relative grid min-h-[285px] items-center px-6 py-8 sm:px-10 lg:min-h-[330px] lg:grid-cols-[1.08fr_.92fr] lg:px-14">
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

          </div>
        </div>
      </div>
    </section>
  );
}
