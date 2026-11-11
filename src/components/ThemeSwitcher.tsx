import React from "react";
import { Palette, Check, Sparkles } from "lucide-react";
import { useTheme, THEMES, ThemeId } from "@/components/ThemeProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export default function ThemeSwitcher({ variant = "header" }: { variant?: "header" | "sidebar" | "compact" }) {
  const { theme, setTheme, currentTheme } = useTheme();

  if (variant === "sidebar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-white hover:bg-white/15 transition-all font-bold text-sm group">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 shrink-0 text-white group-hover:rotate-12 transition-transform" />
              <span>Theme: {currentTheme.name}</span>
            </div>
            <div className="flex items-center gap-1">
              {currentTheme.colors.map((c, i) => (
                <span
                  key={i}
                  className="w-2.5 h-2.5 rounded-full border border-white/40"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side="top"
          className="w-72 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-1 z-[100]"
        >
          <DropdownMenuLabel className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
            <Palette className="w-3.5 h-3.5 text-primary" /> Choose App Theme
          </DropdownMenuLabel>
          <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
          {(Object.keys(THEMES) as ThemeId[]).map((id) => {
            const t = THEMES[id];
            const isSelected = theme === id;
            return (
              <DropdownMenuItem
                key={id}
                onClick={() => setTheme(id)}
                className={cn(
                  "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                  isSelected
                    ? "bg-primary/10 text-primary font-bold shadow-xs border border-primary/20"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-1 shrink-0">
                    {t.colors.map((col, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-white dark:border-slate-900 shadow-xs"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold truncate">{t.name}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t.tagline}</span>
                  </div>
                </div>
                {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2 stroke-[2.5]" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Header variant
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 text-slate-700 dark:text-slate-200 hover:border-primary/50 transition-all shadow-xs text-xs font-bold group"
          title="Change Theme"
        >
          <Palette className="w-3.5 h-3.5 text-primary group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">{currentTheme.name}</span>
          <div className="flex items-center -space-x-1 shrink-0 ml-0.5">
            {currentTheme.colors.map((c, i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full border border-white dark:border-slate-900"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-72 p-2 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl space-y-1 z-[100]"
      >
        <div className="p-2 flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Theme Selection
            </p>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Choose your preferred visual style</p>
          </div>
        </div>
        <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
        {(Object.keys(THEMES) as ThemeId[]).map((id) => {
          const t = THEMES[id];
          const isSelected = theme === id;
          return (
            <DropdownMenuItem
              key={id}
              onClick={() => setTheme(id)}
              className={cn(
                "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all",
                isSelected
                  ? "bg-primary/10 text-primary font-bold shadow-xs border border-primary/20"
                  : "hover:bg-slate-100 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200"
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex -space-x-1 shrink-0">
                  {t.colors.map((col, idx) => (
                    <span
                      key={idx}
                      className="w-4 h-4 rounded-full border border-white dark:border-slate-900 shadow-xs"
                      style={{ backgroundColor: col }}
                    />
                  ))}
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold truncate">{t.name}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{t.tagline}</span>
                </div>
              </div>
              {isSelected && <Check className="w-4 h-4 text-primary shrink-0 ml-2 stroke-[2.5]" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
