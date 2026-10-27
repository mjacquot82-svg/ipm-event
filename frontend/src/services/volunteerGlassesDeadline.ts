// Follow the server's offset-qualified cutoff, including on an already-open page.
export function scheduleVolunteerGlassesClose(closesAt: string, onClose: () => void) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const checkDeadline = () => {
    const remaining = Date.parse(closesAt) - Date.now();
    if (!Number.isFinite(remaining)) return;
    if (remaining <= 0) onClose();
    else timer = setTimeout(checkDeadline, Math.min(remaining, 60_000));
  };
  checkDeadline();
  return () => clearTimeout(timer);
}
