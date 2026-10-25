import webpush from "web-push";
import { getDb } from "@/lib/db";

type PushSubscriptionRecord = { id: string; endpoint: string; subscription_json: string };

function configurePush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:soporte@efasfreelancer.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function notifyAdminsPush(payload: { title: string; body: string; url?: string }) {
  if (!configurePush()) return { sent: 0, skipped: true };
  const db = getDb();
  const result = await db.execute("SELECT id,endpoint,subscription_json FROM admin_push_subscriptions");
  let sent = 0;
  await Promise.all(result.rows.map(async (row) => {
    const subscription = row as unknown as PushSubscriptionRecord;
    try {
      await webpush.sendNotification(JSON.parse(subscription.subscription_json), JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url || "/comercializacion"
      }), { TTL: 60 * 60 * 24 });
      sent += 1;
    } catch (error) {
      const statusCode = typeof error === "object" && error !== null && "statusCode" in error
        ? Number((error as { statusCode?: unknown }).statusCode) : 0;
      if (statusCode === 404 || statusCode === 410) {
        await db.execute({ sql: "DELETE FROM admin_push_subscriptions WHERE id=?", args: [subscription.id] }).catch(() => undefined);
      }
    }
  }));
  return { sent, skipped: false };
}
