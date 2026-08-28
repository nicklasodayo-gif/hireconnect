import type { Notification } from "@/types";
import { timeAgo } from "@/utils/format";

export function NotificationItem({ notification, onClick }: { notification: Notification; onClick?: () => void }) {
  return (
    <div className={`notif-item ${notification.read_at ? "" : "unread"}`} onClick={onClick}>
      <b>{notification.title}</b>
      {notification.body && <p>{notification.body}</p>}
      <small>{timeAgo(notification.created_at)}</small>
    </div>
  );
}
