import { useEffect, useState } from 'react';

/**
 * Works out how big (in screen pixels) to draw the square framing guide.
 *
 * The model only sees the centre square of the photo: side = min(width, height)
 * of the ORIGINAL image (see preprocess() in fecalvision.js). The picture on
 * screen is scaled to fit its box ("object-fit: contain"), so the guide must be
 * scaled by the same factor to line up with what the model will actually see.
 *
 * containerRef : the box holding the video or image
 * srcW, srcH   : the video/image's own pixel size (0 until known)
 */
export function useCropGuide(containerRef, srcW, srcH) {
  const [side, setSide] = useState(0);

  useEffect(() => {
    const box = containerRef.current;
    if (!box || !srcW || !srcH) return undefined;

    const update = () => {
      // "contain" scaling: the whole picture fits inside the box.
      const scale = Math.min(box.clientWidth / srcW, box.clientHeight / srcH);
      setSide(Math.min(srcW, srcH) * scale);
    };
    update();

    // Recompute if the box changes size (rotation, address bar hiding, ...).
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [containerRef, srcW, srcH]);

  return side;
}
