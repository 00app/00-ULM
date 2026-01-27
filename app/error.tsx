'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  console.error(error)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--color-ice)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        textAlign: 'center',
      }}
    >
      <div>
        <h3>something broke.</h3>
        <button
          className="zz-button"
          style={{ marginTop: 20 }}
          onClick={() => reset()}
        >
          retry
        </button>
      </div>
    </div>
  )
}
