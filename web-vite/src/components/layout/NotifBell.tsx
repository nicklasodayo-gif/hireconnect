import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { notificationApi } from "@/api";

export function NotifBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    notificationApi.list()
      .then((r) => { if (!cancelled) setCount(r.notifications.filter((n) => !n.read_at).length); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!user) return null;
  return (
    <a className="notif-bell" href="#/notifications">
      🔔{count > 0 && <span className="notif-dot">{count}</span>}
    </a>
  );
}
