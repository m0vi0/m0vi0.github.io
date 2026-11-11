// The React layer: small overlays on top of the plain-JS 3D scene (src/scene)
import './styles/globals.css';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';

import { RoomTooltip } from '@/components/room-tooltip';

// the room's hover tooltip, only where there is a mouse to follow. Portalled straight into the 3D stage: CursorProvider follows the mouse
// over its parent element, so that parent must be the stage itself
const stage = document.querySelector('.stage');
if (stage && matchMedia('(hover: hover) and (pointer: fine)').matches)
  createRoot(document.createElement('div')).render(createPortal(<RoomTooltip />, stage));
