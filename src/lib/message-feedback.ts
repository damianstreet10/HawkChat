/**
 * Thumbs-up/down values stored on assistant messages.
 * Look here when feedback API rejects a value or UI labels don't match DB.
 */
export const MESSAGE_FEEDBACK_VALUES = ["helpful", "not_helpful"] as const;

export type MessageFeedback = (typeof MESSAGE_FEEDBACK_VALUES)[number];

export function isMessageFeedback(value: unknown): value is MessageFeedback {
  return (
    typeof value === "string" &&
    MESSAGE_FEEDBACK_VALUES.includes(value as MessageFeedback)
  );
}

export const MESSAGE_FEEDBACK_LABELS: Record<MessageFeedback, string> = {
  helpful: "Helpful",
  not_helpful: "Didn't help",
};
