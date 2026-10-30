import { parseHostPairingLink } from "@cocurdex/shared";

export function pairingDeepLink(pairingLink: string) {
  const parsed = parseHostPairingLink(pairingLink);
  if (!parsed) throw new Error(`Unexpected pairing link: ${pairingLink}`);
  const query = new URLSearchParams({
    host: parsed.baseUrl,
    code: parsed.code,
  });
  return `cocurdex://pair?${query}`;
}
