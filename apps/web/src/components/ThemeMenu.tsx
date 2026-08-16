import { Laptop, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ThemePreference, useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const options: Array<{ value: ThemePreference; label: string; description: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", description: "Bright canvas", icon: Sun },
  { value: "dark", label: "Dark", description: "Low-light canvas", icon: Moon },
  { value: "system", label: "Device", description: "Follow device", icon: Laptop },
];

export function ThemeMenu({ className }: { className?: string }) {
  const { preference, resolvedTheme, setPreference } = useTheme();
  const ActiveIcon = preference === "system" ? Laptop : resolvedTheme === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={cn("shrink-0", className)} aria-label={`Theme: ${preference}`} title="Change appearance">
          <ActiveIcon className="size-[18px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 shadow-[0_16px_45px_hsl(248_20%_12%/.14)]">
        <DropdownMenuLabel className="px-2.5 py-2 text-xs text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
          {options.map(({ value, label, description, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="rounded-lg py-2.5 pl-8 pr-2.5">
              <Icon className="mr-2 size-4 text-primary" />
              <span><span className="block text-sm font-medium">{label}</span><span className="block text-[11px] text-muted-foreground">{description}</span></span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
