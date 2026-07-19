type CryptoUuidSource = {
  randomUUID?: (() => string) | undefined;
};

export function createLocalId(
  source: CryptoUuidSource | undefined = globalThis.crypto,
  now: () => number = Date.now,
  random: () => number = Math.random
): string {
  if (typeof source?.randomUUID === "function") return source.randomUUID();
  const randomPart = Math.floor(random() * 36 ** 7)
    .toString(36)
    .padStart(7, "0");
  return `local-${now()}-${randomPart}`;
}
