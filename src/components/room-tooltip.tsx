import * as React from 'react';
import { motion } from 'motion/react';

import { CursorFollow, CursorProvider } from '@/components/ui/cursor';

type Tip = { title: string; sub: string } | null;

// The room's labels as a tooltip that follows the cursor (desktop only; phones keep the labels in the scene). rack.js says what is under
// the pointer with a 'room-hover' event; over nothing the pill scales away, keeping its last text while it goes
export function RoomTooltip() {
  const [tip, setTip] = React.useState<Tip>(null);
  const last = React.useRef<Tip>(null);
  React.useEffect(() => {
    const on = (e: Event) => setTip((e as CustomEvent<Tip>).detail);
    addEventListener('room-hover', on);
    return () => removeEventListener('room-hover', on);
  }, []);
  if (tip) last.current = tip;
  const shown = last.current;

  return (
    <CursorProvider>
      <CursorFollow align="bottom-right">
        <motion.div
          className="origin-top-left max-w-72 rounded-lg bg-blue-500 px-2 py-1 text-sm text-white shadow-lg"
          initial={false}
          animate={{ scale: tip ? 1 : 0, opacity: tip ? 1 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        >
          {shown && (
            <>
              <span className="block font-semibold">{shown.title}</span>
              {shown.sub && <span className="block text-xs text-white/85">{shown.sub}</span>}
            </>
          )}
        </motion.div>
      </CursorFollow>
    </CursorProvider>
  );
}
