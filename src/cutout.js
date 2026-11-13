// Knock a white studio background out of an RGBA image (packshots stored without alpha).
// Returns true when it changed anything. Mutates `data` in place.
// Flood-fills from every edge pixel through 4-connected near-white pixels (R, G and B all
// >= threshold) and sets their alpha to 0. White enclosed by the product (handles, labels) stays.
// Already-cut-out images (any pixel alpha < 250) are left alone.
export function knockOutWhite(data, width, height, threshold = 250) {
  const n = width * height
  if (n === 0) return false
  for (let i = 3; i < n * 4; i += 4) if (data[i] < 250) return false

  const white = i => data[i * 4] >= threshold && data[i * 4 + 1] >= threshold && data[i * 4 + 2] >= threshold
  const seen = new Uint8Array(n)       // marked when pushed, so each pixel enters the stack once
  const stack = new Int32Array(n)      // each pixel is pushed at most once, so n slots suffice
  let sp = 0
  const push = i => { if (!seen[i] && white(i)) { seen[i] = 1; stack[sp++] = i } }

  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x) }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1) }

  let changed = false
  while (sp > 0) {
    const i = stack[--sp]
    data[i * 4 + 3] = 0
    changed = true
    const x = i % width
    if (x > 0) push(i - 1)
    if (x < width - 1) push(i + 1)
    if (i >= width) push(i - width)
    if (i < n - width) push(i + width)
  }
  return changed
}
