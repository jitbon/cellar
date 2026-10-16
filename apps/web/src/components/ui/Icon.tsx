import type { ComponentType } from 'react';
import type { LucideProps } from 'lucide-react';

export {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudSnow,
  CloudSun,
  CircleAlert,
  Info,
  TriangleAlert,
  Flag,
  GripVertical,
  ImageOff,
  MapPin,
  Moon,
  MoreHorizontal,
  PanelRight,
  PlaneLanding,
  PlaneTakeoff,
  Plus,
  Redo2,
  Search,
  Star,
  Sun,
  Undo2,
  Utensils,
  X,
} from 'lucide-react';

interface Props extends Omit<LucideProps, 'size'> {
  as: ComponentType<LucideProps>;
  size?: 'small' | 'default';
}

/** A lucide icon at the app's icon size; decorative unless given an aria-label. */
export function Icon({ as: Glyph, size = 'default', ...rest }: Props) {
  const labelled = rest['aria-label'] !== undefined;
  return (
    <Glyph
      size={size === 'small' ? 12 : 14}
      strokeWidth={1.75}
      aria-hidden={labelled ? undefined : true}
      {...rest}
    />
  );
}
