import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Expand } from 'lucide-react';

interface AuctionProductGalleryProps {
  images: string[];
  title: string;
}

const fallbackImage = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=1000';

export default function AuctionProductGallery({ images, title }: AuctionProductGalleryProps) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const galleryImages = images.length > 0 ? images : [fallbackImage];
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [images]);

  const previousImage = () => {
    setActiveIndex((index) => (index - 1 + galleryImages.length) % galleryImages.length);
  };

  const nextImage = () => {
    setActiveIndex((index) => (index + 1) % galleryImages.length);
  };

  const openFullscreen = async () => {
    try {
      await galleryRef.current?.requestFullscreen();
    } catch {
      // Some embedded browsers do not expose the fullscreen API.
    }
  };

  return (
    <section aria-label="Product gallery" className="space-y-3">
      <div ref={galleryRef} className="group relative aspect-[4/3] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <img
          src={galleryImages[activeIndex]}
          alt={`${title} - image ${activeIndex + 1}`}
          className="h-full w-full object-contain p-5 sm:p-8"
          onError={(event) => {
            event.currentTarget.src = fallbackImage;
          }}
        />

        <span className="absolute left-4 top-4 rounded-full bg-gray-900/75 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
          {activeIndex + 1} / {galleryImages.length}
        </span>

        {galleryImages.length > 1 && (
          <>
            <button type="button" onClick={previousImage} aria-label="Previous image" className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/95 p-2 text-gray-700 shadow-md transition hover:border-emerald-600 hover:text-emerald-700">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={nextImage} aria-label="Next image" className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white/95 p-2 text-gray-700 shadow-md transition hover:border-emerald-600 hover:text-emerald-700">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        <button type="button" onClick={openFullscreen} aria-label="View image fullscreen" className="absolute bottom-4 right-4 rounded-full border border-gray-200 bg-white/95 p-2 text-gray-700 shadow-md transition hover:border-emerald-600 hover:text-emerald-700">
          <Expand className="h-4 w-4" />
        </button>
      </div>

      {galleryImages.length > 1 && (
        <div className="grid grid-cols-6 gap-2 sm:gap-3">
          {galleryImages.slice(0, 6).map((image, index) => (
            <button
              key={`${image}-${index}`}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`View image ${index + 1}`}
              aria-current={activeIndex === index ? 'true' : undefined}
              className={`aspect-square overflow-hidden rounded-xl border-2 bg-white p-1 transition ${activeIndex === index ? 'border-emerald-600 shadow-sm' : 'border-gray-200 hover:border-emerald-300'}`}
            >
              <img src={image} alt="" className="h-full w-full rounded-lg object-cover" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
