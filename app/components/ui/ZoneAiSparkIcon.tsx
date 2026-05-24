import { ZaiSparkIcon } from '@/app/components/ui/MonoStrokeIcons'
import { ZONE_CARD_COMPUTING_ICON_PX } from '@/app/components/ui/ZoneCategoryIcon'

/** Zone “computing / AI” glyph — same spark family as Floating Nav Zai. */
export function ZoneAiSparkIcon({
  size = ZONE_CARD_COMPUTING_ICON_PX,
  className,
  style,
}: {
  size?: number
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <ZaiSparkIcon
      size={size}
      className={`zone-ai-spark-icon${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size, ...style }}
    />
  )
}
