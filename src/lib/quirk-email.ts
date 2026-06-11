import type { AuthUser } from "./auth";
import { sendMailViaSmtp, isQuirkEmailConfigured, smtpConfig } from "./quirk-email-smtp";

export { isQuirkEmailConfigured, smtpConfig };

export type QuirkReportForEmail = {
  reference_id: string | null;
  kit_name: string;
  asset_tag: string | null;
  quirk_details: string;
  extra_notes: string | null;
  resolution_notes: string | null;
  reporter_name: string | null;
  reporter_email: string;
  created_at: string;
};

export async function sendQuirkResolvedEmail(
  admin: AuthUser,
  report: QuirkReportForEmail,
): Promise<{ sent: boolean; error?: string }> {
  const config = smtpConfig();
  if (!config) {
    return {
      sent: false,
      error:
        "SMTP is not configured (set HAWKCHAT_SMTP_HOST, HAWKCHAT_SMTP_USER, HAWKCHAT_SMTP_PASS in .env)",
    };
  }

  const fromName = admin.name?.trim() || admin.email.split("@")[0];
  const fromAddress = admin.email;
  const subject = `Resolved: ${report.kit_name}${report.asset_tag ? ` (${report.asset_tag})` : ""}`;

  const lines = [
    `Hi${report.reporter_name ? ` ${report.reporter_name}` : ""},`,
    "",
    "Your Kit Quirks report has been marked as resolved.",
  ];
  if (report.reference_id) {
    lines.push("", `Reference: ${report.reference_id}`);
  }
  lines.push("", `Kit / equipment: ${report.kit_name}`);
  if (report.asset_tag) lines.push(`Asset tag: ${report.asset_tag}`);
  lines.push("", "Issue:", report.quirk_details);
  if (report.extra_notes) {
    lines.push("", "Extra notes:", report.extra_notes);
  }
  if (report.resolution_notes?.trim()) {
    lines.push("", "How we resolved it:", report.resolution_notes.trim());
  }
  lines.push(
    "",
    "If anything is still wrong, reply to this email.",
    "",
    `— ${fromName}`,
    fromAddress,
  );

  try {
    await sendMailViaSmtp({
      from: `"${fromName}" <${fromAddress}>`,
      replyTo: fromAddress,
      to: report.reporter_email,
      subject,
      text: lines.join("\n"),
    });
    return { sent: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not send email";
    return { sent: false, error: message };
  }
}
