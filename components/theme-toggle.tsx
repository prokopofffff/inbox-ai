"use client";

import * as React from "react";
import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

/**
 * Dark / light theme toggle.
 *
 * Renders a stable placeholder until mounted to avoid a hydration mismatch
 * (the resolved theme is unknown on the server). Toggles between the two
 * explicit themes based on the currently resolved theme.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // Canonical next-themes SSR mount guard: theme is only known on the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      disabled={!mounted}
      className="text-text-secondary"
    >
      {mounted && isDark ? (
        <MoonIcon className="size-4" />
      ) : (
        <SunIcon className="size-4" />
      )}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
