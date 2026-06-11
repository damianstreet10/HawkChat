import { sendMailViaSmtp, smtpConfig } from "./quirk-email-smtp";
import { QUIRK_CATEGORY_LABELS, type QuirkCategory } from "./quirk-category";

export type NewQuirkNotification = {
  reference_id: string;
  kit_name: string;
  asset_tag: string | null;
  quirk_details: string;
  reporter_name: string | null;
  reporter_email: string;
  category: QuirkCategory | null;
};

export function isQuirkNotifyConfigured(): boolean {
  return Boolean(
    process.env.HAWKCHAT_QUIRK_WEBHOOK_URL?.trim() ||
      process.env.HAWKCHAT_QUIRK_NOTIFY_EMAIL?.trim(),
  );
}

function formatNewQuirkMessage(report: NewQuirkNotification): string {
  const category = report.category
    ? QUIRK_CATEGORY_LABELS[report.category]
    : "Uncategorized";
  const lines = [
    `New Kit Quirk: ${report.reference_id}`,
    `Kit: ${report.kit_name}${report.asset_tag ? ` (${report.asset_tag})` : ""}`,
    `Type: ${category}`,
    `From: ${report.reporter_name ?? "—"} <${report.reporter_email}>`,
    "",
    report.quirk_details,
  ];
  return lines.join("\n");
}

export async function notifyNewQuirkReport(
  report: NewQuirkNotification,
): Promise<{ attempted: boolean; channels: string[]; errors: string[] }> {
  const channels: string[] = [];
  const errors: string[] = [];
  const message = formatNewQuirkMessage(report);

  const webhook = process.env.HAWKCHAT_QUIRK_WEBHOOK_URL?.trim();
  if (webhook) {
    channels.push("webhook");
    try {
      const res = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: message }),
      });
      if (!res.ok) {
        errors.push(`Webhook returned ${res.status}`);
      }
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Webhook request failed",
      );
    }
  }

  const notifyEmails = process.env.HAWKCHAT_QUIRK_NOTIFY_EMAIL?.trim();
  const smtp = smtpConfig();
  if (notifyEmails && smtp) {
    channels.push("email");
    const from =
      process.env.HAWKCHAT_QUIRK_NOTIFY_FROM?.trim() ||
      smtp.auth.user;
    try {
      await sendMailViaSmtp({
        from,
        to: notifyEmails.split(",").map((e) => e.trim()).filter(Boolean),
        subject: `New Kit Quirk ${report.reference_id}: ${report.kit_name}`,
        text: message,
      });
    } catch (err) {
      errors.push(
        err instanceof Error ? err.message : "Notify email failed",
      );
    }
  } else if (notifyEmails && !smtp) {
    errors.push(
      "HAWKCHAT_QUIRK_NOTIFY_EMAIL is set but SMTP is not configured",
    );
  }

  return {
    attempted: channels.length > 0,
    channels,
    errors,
  };
}
