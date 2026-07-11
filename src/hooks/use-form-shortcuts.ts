import * as React from "react";

/**
 * useFormShortcuts — attaches keyboard shortcuts scoped to a form element.
 *
 * Default bindings:
 *   • Ctrl/Cmd + Enter → submit (works from inside textareas)
 *   • Ctrl/Cmd + S     → submit (prevents browser save dialog)
 *   • Escape            → onCancel (if provided) and blurs the active field
 *
 * Attach the returned ref to your <form>:
 *   const ref = useFormShortcuts({ onCancel: () => close() });
 *   <form ref={ref} onSubmit={...}>...</form>
 */
export function useFormShortcuts<T extends HTMLFormElement = HTMLFormElement>(opts?: {
  onCancel?: () => void;
  disabled?: boolean;
}) {
  const ref = React.useRef<T | null>(null);
  const { onCancel, disabled } = opts ?? {};

  React.useEffect(() => {
    const form = ref.current;
    if (!form || disabled) return;

    const handler = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      // Ctrl/Cmd+Enter or Ctrl/Cmd+S → submit
      if (isMod && (e.key === "Enter" || e.key.toLowerCase() === "s")) {
        e.preventDefault();
        if (typeof form.requestSubmit === "function") form.requestSubmit();
        else form.submit();
        return;
      }
      if (e.key === "Escape") {
        const active = document.activeElement as HTMLElement | null;
        if (active && form.contains(active)) active.blur();
        onCancel?.();
      }
    };

    form.addEventListener("keydown", handler);
    return () => form.removeEventListener("keydown", handler);
  }, [onCancel, disabled]);

  return ref;
}
