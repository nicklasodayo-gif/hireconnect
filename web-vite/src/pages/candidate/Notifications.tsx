import { useEffect, useState } from "react";
import { notificationApi } from "@/api";
import type { Notification } from "@/types";
import { NotificationItem } from "@/components";
import { EmptyState, Spinner } from "@/components/ui";

export function Notifications() {
  const [items, setItems] = useState<Notification[] | null>(null);
  const load = () => notificationApi.list().then((r) => setItems(r.notifications));
  useEffect(() => { load(); }, []);
  if (!items) return <div className="page-shell"><Spinner /></div>;

  const markAll = () => notificationApi.markAllRead().then(load);
  const markOne = (id: number) => notificationApi.markRead(id).then(load);

  return (
    <div className="page-shell narrow">
      <div className="section-head">
        <h1>Notifications</h1>
        {items.some((n) => !n.read_at) && <button className="btn ghost sm" onClick={markAll}>Mark all as read</button>}
      </div>
      {items.length === 0 ? <EmptyState icon="🔔" title="You're all caught up" body="New updates will show up here." /> : (
        <div className="notif-list">
          {items.map((n) => <NotificationItem key={n.id} notification={n} onClick={() => !n.read_at && markOne(n.id)} />)}
        </div>
      )}
    </div>
  );
}
