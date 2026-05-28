import os from "os";

const IPV4_HOST =
  /^(\d{1,3}\.){3}\d{1,3}$/;

export function isValidLanUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return IPV4_HOST.test(u.hostname);
  } catch {
    return false;
  }
}

/** Best-effort LAN IPv4 for sharing (e.g. 192.168.x.x). */
export function detectLanIpv4(): string | null {
  const nets = os.networkInterfaces();
  const candidates: string[] = [];

  for (const iface of Object.values(nets)) {
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      candidates.push(addr.address);
    }
  }

  const prefer = (prefix: string) =>
    candidates.find((ip) => ip.startsWith(prefix));

  return (
    prefer("192.168.") ??
    prefer("10.") ??
    prefer("172.") ??
    candidates[0] ??
    null
  );
}

export function buildLanUrl(port = 3000): string | null {
  const ip = detectLanIpv4();
  return ip ? `http://${ip}:${port}` : null;
}
