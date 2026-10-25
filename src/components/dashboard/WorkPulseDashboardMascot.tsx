'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BriefcaseBusiness } from 'lucide-react';

/**
 * Uses the half-body mascot generated for ESS.
 * Render a neutral fallback until that local asset is committed to GitHub.
 */
export function WorkPulseDashboardMascot() {
  const [imageAvailable, setImageAvailable] = useState(true);

  return (
    <div className="pointer-events-none relative mx-auto h-44 w-48 sm:h-60 sm:w-56 lg:h-full lg:w-full" aria-hidden="true">
      <div className="absolute bottom-1 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full bg-[var(--tenant-tint-strong)] blur-3xl" />
      {imageAvailable ? (
        <Image
          src="/branding/workpulse-mascot-half.png"
          alt=""
          fill
          sizes="(max-width: 640px) 192px, (max-width: 1024px) 224px, 300px"
          className="relative object-contain object-bottom"
          onError={() => setImageAvailable(false)}
          priority
        />
      ) : (
        <div className="absolute inset-x-10 bottom-7 grid aspect-square place-items-center rounded-full border border-[var(--tenant-border)] bg-[var(--tenant-tint)] text-[var(--tenant-primary)]">
          <BriefcaseBusiness className="h-14 w-14" strokeWidth={1.4} />
        </div>
      )}
    </div>
  );
}
