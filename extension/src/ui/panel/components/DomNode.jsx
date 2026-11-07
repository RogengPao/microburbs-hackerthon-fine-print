import { useEffect, useRef } from 'react';

/**
 * Mounts a node built by one of the vanilla renderers (overview.js, blocks.js) inside
 * React. They're DOM + textContent only (no HTML from the model), already tested, and
 * shared with the dev preview — React owns where they sit, they own how they draw.
 */
export default function DomNode({ build, deps, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren();
    try {
      const node = build();
      if (node) el.append(node);
    } catch (e) {
      console.error('[fine-print] render failed', e);
      el.textContent = `Couldn't draw this: ${e.message}`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return <div ref={ref} className={`shrink-0 ${className}`} />;
}
