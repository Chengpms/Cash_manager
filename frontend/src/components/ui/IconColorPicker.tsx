import clsx from "clsx";
import { getIcon } from "../../utils/constants";

interface IconColorPickerProps {
  icons: string[];
  colors: string[];
  icon: string;
  color: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
}

export function IconColorPicker({
  icons,
  colors,
  icon,
  color,
  onIconChange,
  onColorChange,
}: IconColorPickerProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {icons.map((name) => {
          const Icon = getIcon(name);
          const active = name === icon;
          return (
            <button
              type="button"
              key={name}
              onClick={() => onIconChange(name)}
              className={clsx(
                "w-9 h-9 rounded-xl flex items-center justify-center border transition-colors",
                active ? "border-accent bg-accent/10 text-accent" : "border-border bg-white text-ink-soft hover:bg-cream-dark"
              )}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => {
          const active = c === color;
          return (
            <button
              type="button"
              key={c}
              onClick={() => onColorChange(c)}
              className={clsx(
                "w-7 h-7 rounded-full border-2 transition-transform",
                active ? "scale-110 border-ink" : "border-white"
              )}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          );
        })}
      </div>
    </div>
  );
}
