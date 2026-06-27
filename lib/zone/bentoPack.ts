import type { GroovyGridCell } from '@/lib/zone/gridOrder'
import type { BentoPersona } from '@/lib/zone/bentoPersona'

export type BentoFootprint = '1x1' | '2x1' | '1x2'

export type BentoPackPlacement = {
  gridColumn: string
  gridRow: string
  footprint: BentoFootprint
}

export function bentoColsForViewportWidth(width: number): number {
  if (width >= 1024) return 3
  if (width >= 768) return 2
  return 1
}

export function groovyGridCellKey(cell: GroovyGridCell): string {
  if (cell.type === 'hero') return 'hero'
  if (cell.type === 'tip') return cell.tip.id
  return cell.item.id
}

function footprintForCell(
  cell: GroovyGridCell,
  cols: number
): { w: number; h: number; footprint: BentoFootprint } {
  if (cols <= 1) return { w: 1, h: 1, footprint: '1x1' }
  if (cell.type === 'hero') {
    return { w: cols, h: 1, footprint: cols >= 2 ? '2x1' : '1x1' }
  }
  if (cell.type === 'tip') return { w: 1, h: 1, footprint: '1x1' }
  const persona: BentoPersona = cell.persona
  if (persona === 'wide' && cols >= 2) {
    return { w: Math.min(2, cols), h: 1, footprint: '2x1' }
  }
  if (persona === 'tall') {
    return { w: 1, h: 2, footprint: '1x2' }
  }
  return { w: 1, h: 1, footprint: '1x1' }
}

function slotKey(row: number, col: number): string {
  return `${row},${col}`
}

function canPlace(
  occupied: Set<string>,
  row: number,
  col: number,
  w: number,
  h: number,
  cols: number
): boolean {
  if (col + w > cols) return false
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      if (occupied.has(slotKey(r, c))) return false
    }
  }
  return true
}

function markPlace(
  occupied: Set<string>,
  row: number,
  col: number,
  w: number,
  h: number
): void {
  for (let r = row; r < row + h; r++) {
    for (let c = col; c < col + w; c++) {
      occupied.add(slotKey(r, c))
    }
  }
}

/** First-fit bento pack — no holes; preserves cell order. */
export function packBentoGridCells(
  cells: GroovyGridCell[],
  cols: number
): Map<string, BentoPackPlacement> {
  const out = new Map<string, BentoPackPlacement>()
  if (cols <= 0) return out

  const occupied = new Set<string>()

  for (const cell of cells) {
    const key = groovyGridCellKey(cell)
    const { w, h, footprint } = footprintForCell(cell, cols)

    let placed = false
    for (let row = 0; !placed; row++) {
      for (let col = 0; col < cols; col++) {
        if (!canPlace(occupied, row, col, w, h, cols)) continue
        markPlace(occupied, row, col, w, h)
        out.set(key, {
          gridColumn: `${col + 1} / span ${w}`,
          gridRow: `${row + 1} / span ${h}`,
          footprint,
        })
        placed = true
        break
      }
    }
  }

  return out
}

export function bentoFootprintClass(footprint: BentoFootprint | undefined): string {
  if (footprint === '2x1') return 'bento-footprint-wide'
  if (footprint === '1x2') return 'bento-footprint-tall'
  return 'bento-footprint-square'
}
