'use client';

import { usePathname } from 'next/navigation';
import { PersistentAudioPlayer } from './persistent-audio-player';

export function ConditionalPlayer() {
  const pathname = usePathname();

  // Hide player on auth pages and chat pages (they have their own interface)
  const isAuthPage = pathname?.startsWith('/auth');
  const isChatPage = pathname?.startsWith('/chat');

  if (isAuthPage || isChatPage) {
    return null;
  }

  return <PersistentAudioPlayer />;
}
