# Zero Zero Intro — Export for Another Project

Single component: **animated logo** (2s glitch) then **rapid word cycle** (save → money → cut → carbon → feel → good → use → less → more).

## File to copy

- **`ZeroZeroIntro.tsx`** — paste into your other Cursor project (e.g. `components/ZeroZeroIntro.tsx`).

## Assets (optional)

If you want the same logo, copy these from this repo’s `public/assets/` into your project’s `public/assets/` (or another folder):

- `00 brand mark.svg`
- `00 brand mark pink.svg`
- `00 brand mark lime.svg`

Then use:

```tsx
<ZeroZeroIntro onComplete={() => router.push('/home')} />
```

If your assets live elsewhere:

```tsx
<ZeroZeroIntro logoBaseUrl="/images" onComplete={...} />
```

## Dependencies

- React (useState, useEffect). No router or other app code.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onComplete` | `() => void` | — | Called after the full sequence (logo + both word sets). |
| `logoBaseUrl` | `string` | `'/assets'` | Base URL for the three logo SVGs. |
| `textColor` | `string` | `'#000AFF'` | Color of the cycling words. |
