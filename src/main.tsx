// The React layer: small overlays on top of the plain-JS 3D scene (src/scene)
import './styles/globals.css';

// the room's hover tooltip, only where there is a mouse to follow (phones never download React). Portalled straight into the 3D stage: CursorProvider
// follows the mouse over its parent element, so that parent must be the stage itself
const stage = document.querySelector('.stage');
if (stage && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const [{ createPortal }, { createRoot }, { RoomTooltip }] = await Promise.all([import('react-dom'), import('react-dom/client'), import('@/components/room-tooltip')]);
  createRoot(document.createElement('div')).render(createPortal(<RoomTooltip />, stage));
}
