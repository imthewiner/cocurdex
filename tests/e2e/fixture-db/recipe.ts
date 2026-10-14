import type { StubTurn } from "../helpers/llm-stub";

export const FIXTURE_WORKSPACE_ID = "fixture-acme-shop";
export const FIXTURE_WORKSPACE_NAME = "acme-shop";
export const FIXTURE_MULTI_FOLDER_WORKSPACE_ID = "fixture-acme-suite";

export interface FixtureWorkspace {
  id: string;
  name: string;
  folders: string[];
}

export const FIXTURE_WORKSPACES: FixtureWorkspace[] = [
  {
    id: FIXTURE_WORKSPACE_ID,
    name: FIXTURE_WORKSPACE_NAME,
    folders: ["acme-shop"],
  },
  {
    id: FIXTURE_MULTI_FOLDER_WORKSPACE_ID,
    name: "acme-suite",
    folders: ["acme-web", "acme-docs"],
  },
];

export interface FixtureTurn {
  messageId: string;
  prompt: string;
  replies: StubTurn[];
}

export interface FixtureInterruptedTurn {
  messageId: string;
  prompt: string;
  queued: { messageId: string; prompt: string };
}

export interface FixtureSession {
  id: string;
  title: string;
  kind: "main" | "chat";
  turns: FixtureTurn[];
  pinned?: boolean;
  archived?: boolean;
  interruptedTurn?: FixtureInterruptedTurn;
}

export interface FixtureNote {
  key: string;
  title: string;
  bodyMarkdown: string;
  parentKey?: string;
  inWorkspace?: boolean;
}

export interface FixtureIssue {
  title: string;
  description: string;
  status: "backlog" | "doing" | "review" | "done";
  priority: "urgent" | "high" | "medium" | "low" | "none";
  labels: string[];
  comment?: string;
  linkedSessionId?: string;
}

export const FIXTURE_LABELS = [
  { name: "bug", color: "#d14343" },
  { name: "feature", color: "#2f7de1" },
  { name: "checkout", color: "#8a5cf5" },
];

const DISCOUNT_FILE = `export interface DiscountCode {
  code: string;
  amountOff?: number;
  percentOff?: number;
}

export function applyDiscount(subtotal: number, discount: DiscountCode): number {
  const percent = discount.percentOff ? subtotal * (discount.percentOff / 100) : 0;
  return Math.max(0, subtotal - (discount.amountOff ?? 0) - percent);
}
`;

const RELEASE_NOTES = `## Acme Shop 0.4.0

### Added
- Percentage discount codes at checkout.
- Cart subtotal now rounds to cents.

### Fixed
- Empty carts no longer show a negative total.

| Area | Change | Risk |
| --- | --- | --- |
| Cart | Rounding | Low |
| Checkout | Discounts | Medium |

\`\`\`ts
applyDiscount(100, { code: "SPRING10", percentOff: 10 }); // 90
\`\`\`

\`\`\`mermaid
flowchart LR
  Cart --> Discount --> Checkout
\`\`\`
`;

export const FIXTURE_SESSIONS: FixtureSession[] = [
  {
    id: "fixture-session-discounts",
    title: "Add percentage discount codes",
    kind: "main",
    pinned: true,
    turns: [
      {
        messageId: "fixture-message-discounts-1",
        prompt:
          "Add support for percentage discount codes in the cart total. Keep fixed amount codes working.",
        replies: [
          {
            text: ["I'll look at the cart and discount modules first."],
            toolCalls: [
              { name: "read", arguments: { path: "src/cart.ts" } },
              { name: "read", arguments: { path: "src/discount.ts" } },
            ],
          },
          {
            text: [
              "Discounts only support a fixed `amountOff`. ",
              "I'll add an optional `percentOff`.",
            ],
            toolCalls: [
              {
                name: "write",
                arguments: { path: "src/discount.ts", content: DISCOUNT_FILE },
              },
            ],
          },
          {
            text: [
              "Done. `applyDiscount` now accepts `percentOff` alongside ",
              "`amountOff`, and never returns a negative total.",
            ],
          },
        ],
      },
      {
        messageId: "fixture-message-discounts-2",
        prompt: "Does the README mention discounts?",
        replies: [
          {
            toolCalls: [{ name: "read", arguments: { path: "README.md" } }],
          },
          {
            text: [
              "Yes. The README lists `src/discount.ts` as the module that ",
              "applies discount codes.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fixture-session-checkout-bug",
    title: "Investigate failing checkout",
    kind: "main",
    turns: [
      {
        messageId: "fixture-message-checkout-1",
        prompt: "Checkout fails for some carts. Check the checkout module.",
        replies: [
          {
            text: ["Opening the checkout module."],
            toolCalls: [
              { name: "read", arguments: { path: "src/checkout.ts" } },
            ],
          },
          {
            text: [
              "There is no `src/checkout.ts` in this project. ",
              "Checkout totals come from `cartSubtotal` in `src/cart.ts`.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fixture-session-release-notes",
    title: "Draft release notes",
    kind: "main",
    turns: [
      {
        messageId: "fixture-message-release-1",
        prompt: "Draft release notes for 0.4.0.",
        replies: [{ text: [RELEASE_NOTES] }],
      },
    ],
  },
  {
    id: "fixture-session-old-spike",
    title: "Spike: gift cards",
    kind: "main",
    archived: true,
    turns: [
      {
        messageId: "fixture-message-spike-1",
        prompt: "Sketch how gift cards could reuse discount codes.",
        replies: [
          {
            text: [
              "Gift cards could be discount codes with a balance that ",
              "decreases on each use.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fixture-session-chat",
    title: "Debounce vs throttle",
    kind: "chat",
    turns: [
      {
        messageId: "fixture-message-chat-1",
        prompt: "What is the difference between debounce and throttle?",
        replies: [
          {
            text: [
              "**Debounce** waits until calls stop for a quiet period. ",
              "**Throttle** runs at most once per interval while calls continue.",
            ],
          },
        ],
      },
    ],
  },
  {
    id: "fixture-session-cents",
    title: "Store cart totals in cents",
    kind: "main",
    turns: [],
    interruptedTurn: {
      messageId: "fixture-message-cents-1",
      prompt: "Store cart totals as integer cents.",
      queued: {
        messageId: "fixture-message-cents-2",
        prompt: "Then update the release notes.",
      },
    },
  },
];

export const FIXTURE_NOTES: FixtureNote[] = [
  {
    key: "roadmap",
    title: "Acme Shop roadmap",
    inWorkspace: true,
    bodyMarkdown: `# Acme Shop roadmap

## Now
- Percentage discount codes
- Checkout error messages

## Next
- Gift cards
- Saved carts

> Dates are placeholders for the fixture.
`,
  },
  {
    key: "checkout-spec",
    parentKey: "roadmap",
    title: "Checkout spec",
    inWorkspace: true,
    bodyMarkdown: `# Checkout spec

1. Show the subtotal from \`cartSubtotal\`.
2. Apply at most one discount code.
3. Never charge less than zero.

- [x] Fixed amount codes
- [ ] Percentage codes
`,
  },
  {
    key: "scratch",
    title: "Scratchpad",
    bodyMarkdown: "Ideas that are not tied to a workspace.\n",
  },
];

export const FIXTURE_ISSUES: FixtureIssue[] = [
  {
    title: "Support percentage discount codes",
    description: "Codes like SPRING10 should take 10% off the subtotal.",
    status: "review",
    priority: "high",
    labels: ["feature", "checkout"],
    comment: "Implementation is ready for review in the discounts session.",
    linkedSessionId: "fixture-session-discounts",
  },
  {
    title: "Checkout fails for some carts",
    description: "Reported from the storefront demo. Steps are unclear.",
    status: "doing",
    priority: "urgent",
    labels: ["bug", "checkout"],
    linkedSessionId: "fixture-session-checkout-bug",
  },
  {
    title: "Gift cards",
    description: "Explore gift cards as discount codes with a balance.",
    status: "backlog",
    priority: "low",
    labels: ["feature"],
  },
  {
    title: "Round cart subtotal to cents",
    description: "Floating point sums show long decimals.",
    status: "done",
    priority: "medium",
    labels: ["bug"],
  },
  {
    title: "Write 0.4.0 release notes",
    description: "",
    status: "backlog",
    priority: "none",
    labels: [],
  },
];
