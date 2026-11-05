import OpenGraphImage from './opengraph-image'

export const alt = 'Zero Zero: stop overpaying for your home'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** X (Twitter) card image: the same artwork as the Open Graph image. */
export default function TwitterImage() {
  return OpenGraphImage()
}
