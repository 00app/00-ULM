import { ImageResponse } from 'next/og'

export const alt = 'Zero Zero: stop overpaying for your home'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const NAVY = '#141268'
const BLUE = '#000AFF'
const WHITE = '#FCFCFF'

/** Brand mark (app/icon.svg) as inline paths, so the image needs no network fetch. */
function Mark({ size: h }: { size: number }) {
  return (
    <svg width={(h * 126) / 200} height={h} viewBox="0 0 126 200" fill="none">
      <path d="M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z" fill={NAVY} />
      <path
        d="M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z"
        fill={NAVY}
      />
      <path
        d="M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411"
        fill={NAVY}
      />
    </svg>
  )
}

/** Link preview for every page (Open Graph and X). Same promise as the front door hero. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: WHITE,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <Mark size={72} />
          <div style={{ fontSize: 40, fontWeight: 700, color: NAVY, letterSpacing: -1 }}>Zero Zero</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 800, color: NAVY, letterSpacing: -3, lineHeight: 1 }}>
            Stop overpaying
          </div>
          <div style={{ fontSize: 96, fontWeight: 800, color: BLUE, letterSpacing: -3, lineHeight: 1.05 }}>
            for your home.
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div style={{ fontSize: 30, color: NAVY, maxWidth: 760, lineHeight: 1.3 }}>
            Bills, subscriptions and contracts in one place. Every figure sourced.
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 26,
              fontWeight: 700,
              color: WHITE,
              background: BLUE,
              borderRadius: 999,
              padding: '14px 30px',
            }}
          >
            00-00.online
          </div>
        </div>
      </div>
    ),
    size
  )
}
