import { useEffect, useState, type FormEvent } from "react";
import { messageApi } from "@/api";
import type { Conversation, Message } from "@/types";
import { Avatar, EmptyState, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { timeAgo } from "@/utils/format";

export function Messages() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const { user } = useAuth();
  const toast = useToast();

  useEffect(() => { messageApi.conversations().then((r) => setConversations(r.conversations)); }, []);
  useEffect(() => { if (activeId) messageApi.messages(activeId).then((r) => setMessages(r.messages)); }, [activeId]);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || activeId == null) return;
    try {
      await messageApi.send(activeId, text);
      setText("");
      const r = await messageApi.messages(activeId);
      setMessages(r.messages);
    } catch (err) { toast.show(err instanceof Error ? err.message : "Couldn't send message.", "error"); }
  };

  if (!conversations) return <div className="page-shell"><Spinner /></div>;

  return (
    <div className="page-shell">
      <h1>Messages</h1>
      {conversations.length === 0 ? (
        <EmptyState icon="💬" title="No conversations yet" body="Conversations open automatically once you're in touch about an application." />
      ) : (
        <div className="messages-layout">
          <div className="conv-list">
            {conversations.map((c) => (
              <button key={c.id} className={`conv-item ${activeId === c.id ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
                <Avatar src={c.other_party_photo} name={c.other_party_name || "Conversation"} size={28} />
                <span>{c.other_party_name || `Conversation #${c.id}`}</span>
              </button>
            ))}
          </div>
          <div className="conv-thread">
            {activeId == null ? <EmptyState icon="💬" title="Select a conversation" /> : (
              <>
                <div className="thread-messages">
                  {messages.map((m) => (
                    <div key={m.id} className={`msg ${m.sender_id === user?.id ? "mine" : ""}`}>
                      {m.body}<small>{timeAgo(m.created_at)}</small>
                    </div>
                  ))}
                </div>
                <form className="thread-input" onSubmit={send}>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
                  <button className="btn primary">Send</button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
