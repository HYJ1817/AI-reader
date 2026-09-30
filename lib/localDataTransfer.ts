let active: { token: symbol; label: string } | null = null;

export function tryAcquireDataTransfer(label: string): (() => void) | undefined {
  if (active) return undefined;
  const token = Symbol(label);
  active = { token, label };
  return () => { if (active?.token === token) active = null; };
}

export function currentDataTransfer() { return active?.label ?? null; }
