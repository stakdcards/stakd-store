/**
 * Standalone gradient-map color transform — no Fabric filter inheritance.
 * Maps image luminance to a 4-stop gradient: black → shadow → highlight → white.
 */

const LUMINOSITY_R = 0.21;
const LUMINOSITY_G = 0.72;
const LUMINOSITY_B = 0.07;

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

/** Apply gradient-map recoloring to raw pixel data in-place. */
function applyGradientMap2D(data, shadowHex, highlightHex) {
  const [sR, sG, sB] = hexToRgb(shadowHex);
  const [hR, hG, hB] = hexToRgb(highlightHex);

  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.max(0, Math.min(1,
      (LUMINOSITY_R * data[i] + LUMINOSITY_G * data[i + 1] + LUMINOSITY_B * data[i + 2]) / 255
    ));

    let outR, outG, outB;
    if (lum < 0.33) {
      const t = lum / 0.33;
      outR = sR * t; outG = sG * t; outB = sB * t;
    } else if (lum < 0.66) {
      const t = (lum - 0.33) / 0.33;
      outR = sR * (1 - t) + hR * t;
      outG = sG * (1 - t) + hG * t;
      outB = sB * (1 - t) + hB * t;
    } else {
      const t = (lum - 0.66) / 0.34;
      outR = hR * (1 - t) + 255 * t;
      outG = hG * (1 - t) + 255 * t;
      outB = hB * (1 - t) + 255 * t;
    }
    data[i] = outR;
    data[i + 1] = outG;
    data[i + 2] = outB;
    // alpha unchanged
  }
}

/**
 * Apply a gradient-map color transform directly to a Fabric image object.
 * Bypasses Fabric's filter pipeline entirely (avoids prototype/WebGL issues).
 */
export function applyGradientMapToImage(imgObj, shadowColor, highlightColor) {
  if (!imgObj) return;
  const el = imgObj._element || imgObj.getElement?.();
  if (!el) return;

  const w = el.naturalWidth || el.width;
  const h = el.naturalHeight || el.height;
  if (!w || !h) return;

  const cvs = document.createElement('canvas');
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext('2d');
  ctx.drawImage(el, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  applyGradientMap2D(imgData.data, shadowColor, highlightColor);
  ctx.putImageData(imgData, 0, 0);

  // Replace the image element with the recolored canvas
  imgObj.setElement(cvs);
}

// Keep named export for backward compat (but it's just the function now)
export { applyGradientMap2D };
