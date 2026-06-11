import {
  QUIRK_CATEGORIES,
  QUIRK_CATEGORY_LABELS,
  type QuirkCategory,
} from "./quirk-category";

export type QuirkTextInput = {
  kitName: string;
  assetTag?: string | null;
  quirkDetails: string;
  extraNotes?: string | null;
};

/** Strong phrase matches — checked before keyword scoring. */
const STRONG_PHRASES: Array<{ category: QuirkCategory; phrases: string[] }> = [
  {
    category: "network",
    phrases: [
      "no network",
      "network down",
      "network issue",
      "network problem",
      "no internet",
      "can't connect",
      "cannot connect",
      "wifi not",
      "wi-fi not",
      "no wifi",
      "no wi-fi",
      "ethernet not",
      "lost connection",
      "disconnected from",
    ],
  },
  {
    category: "camera",
    phrases: [
      "camera not",
      "no video from camera",
      "no picture",
      "black screen on camera",
      "ccu error",
      "ccu not",
      "no tally",
      "focus issue",
      "zoom not",
    ],
  },
  {
    category: "pc",
    phrases: [
      "blue screen",
      "bsod",
      "pc won't boot",
      "pc wont boot",
      "computer won't start",
      "laptop won't start",
      "windows update",
      "login issue",
      "can't log in",
      "cannot log in",
    ],
  },
  {
    category: "hardware",
    phrases: [
      "power supply",
      "won't power on",
      "wont power on",
      "no power",
      "broken cable",
      "faulty cable",
      "hdmi no",
      "sdi no",
    ],
  },
];

const KEYWORDS: Record<Exclude<QuirkCategory, "other">, string[]> = {
  network: [
    "network",
    "wifi",
    "wi-fi",
    "wireless",
    "ethernet",
    "lan",
    "vlan",
    "dns",
    "dhcp",
    "ip address",
    "ip ",
    "connectivity",
    "ping",
    "vpn",
    "switch",
    "router",
    "firewall",
    "proxy",
    "gateway",
    "subnet",
    "bandwidth",
    "latency",
    "offline",
    "disconnect",
    "unreachable",
    "socket",
    "tcp",
    "udp",
  ],
  hardware: [
    "hardware",
    "power",
    "psu",
    "usb",
    "hdmi",
    "sdi",
    "rig",
    "mount",
    "bracket",
    "fan",
    "overheat",
    "broken",
    "faulty",
    "damaged",
    "connector",
    "port",
    "battery",
    "charger",
    "cable",
    "loose",
    "rack",
  ],
  pc: [
    "pc",
    "computer",
    "laptop",
    "workstation",
    "desktop",
    "windows",
    "macos",
    "linux",
    "driver",
    "reboot",
    "restart",
    "crash",
    "frozen",
    "freeze",
    "hang",
    "keyboard",
    "mouse",
    "monitor",
    "display",
    "disk",
    "storage",
    "cpu",
    "memory",
    "ram",
    "software",
    "application",
    "app ",
    "update",
    "install",
    "login",
    "password",
  ],
  camera: [
    "camera",
    "cam ",
    "lens",
    "zoom",
    "focus",
    "tally",
    "ccu",
    "viewfinder",
    "genlock",
    "triax",
    "fiber",
    "shading",
    "iris",
    "exposure",
    "video feed",
    "picture",
    "broadcast chain",
    "rccp",
    "paint",
  ],
};

function combineText(input: QuirkTextInput): string {
  return [input.kitName, input.assetTag, input.quirkDetails, input.extraNotes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function scoreKeywords(text: string, keywords: string[]): number {
  let score = 0;
  for (const keyword of keywords) {
    if (text.includes(keyword)) {
      score += keyword.includes(" ") ? 3 : 1;
    }
  }
  return score;
}

/** Guess problem type from kit name and description text. */
export function inferQuirkCategory(input: QuirkTextInput): QuirkCategory {
  const text = combineText(input);

  for (const { category, phrases } of STRONG_PHRASES) {
    if (phrases.some((phrase) => text.includes(phrase))) {
      return category;
    }
  }

  let best: QuirkCategory = "other";
  let bestScore = 0;

  for (const category of QUIRK_CATEGORIES) {
    if (category === "other") continue;
    const score = scoreKeywords(text, KEYWORDS[category]);
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }

  return bestScore > 0 ? best : "other";
}

export function quirkCategoryLabel(category: QuirkCategory): string {
  return QUIRK_CATEGORY_LABELS[category];
}
