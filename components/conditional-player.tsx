'use client';

import { usePathname } from 'next/navigation';
import { PersistentAudioPlayer } from './persistent-audio-player';

export function ConditionalPlayer() {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth');

  if (isAuthPage) {
    return null;
  }

  return <PersistentAudioPlayer />;
}
