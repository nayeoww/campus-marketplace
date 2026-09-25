import { AppShell } from "@/components/campus/AppShell";
import { Breadcrumbs, EmptyState, Initials, Loading, Notice } from "@/components/campus/Bits";
import { api } from "@/convex/_generated/api";
import {
  CAMPUS_NAME,
  MESSAGE_STARTERS,
  formatPrice,
  relativeTime,
  type ListingKind,
} from "@/lib/campus";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

function ThreadView({ conversationId }: { conversationId: string }) {
  const navigate = useNavigate();
  const thread = useQuery(api.messaging.thread, {
    conversationId: conversationId as never,
  });
  const send = useMutation(api.messaging.send);
  const markRead = useMutation(api.messaging.markRead);

  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const markedFor = useRef<string | null>(null);
  const messageCount = thread?.messages.length ?? 0;

  useEffect(() => {
    if (!thread || thread.unread === 0) return;
    if (markedFor.current === thread._id) return;
    markedFor.current = thread._id;
    void markRead({ conversationId: thread._id });
  }, [thread, markRead]);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messageCount, conversationId]);

  if (thread === undefined) {
    return <Loading label="Opening the conversation" />;
  }

  if (thread === null) {
    return (
      <EmptyState
        eyebrow="Unavailable"
        title="This conversation is not open to you"
        body="It may have been between two other students, or the post it belongs to was removed."
      >
        <Link to="/messages" className="cm-btn cm-btn--quiet">
          Back to messages
        </Link>
      </EmptyState>
    );
  }

  const kind: ListingKind = thread.listing?.kind ?? "item";

  const handleSend = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await send({ conversationId: thread._id, body });
      setBody("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message.replace(/^\[.*?\]\s*/, "")
          : "That message did not send.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="cm-thread">
      <div className="cm-thread__head">
        <button
          type="button"
          className="cm-textlink cm-only-narrow"
          onClick={() => navigate("/messages")}
        >
          Back
        </button>
        <Initials name={thread.other.name} small />
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="cm-seller__name">{thread.other.name}</p>
          <p className="cm-seller__meta">
            {[thread.other.year, thread.other.branch].filter(Boolean).join(" · ") ||
              "SSIPMT student"}
          </p>
        </div>
        <Link to={`/students/${thread.other._id}`} className="cm-textlink">
          Profile
        </Link>
      </div>

      {thread.listing && (
        <div className="cm-thread__head" style={{ background: "var(--cm-bg-tint)" }}>
          <span className="cm-meta">About</span>
          <Link
            to={`/listing/${thread.listing._id}`}
            className="cm-card__title"
            style={{ flex: 1 }}
          >
            {thread.listing.title}
          </Link>
          <span className="cm-meta">{formatPrice(thread.listing.price)}</span>
        </div>
      )}

      <div className="cm-thread__body" ref={bodyRef}>
        {thread.messages.length === 0 ? (
          <p className="cm-note">
            No messages yet. Ask what you need to know before you agree on a
            price.
          </p>
        ) : (
          thread.messages.map((message) => (
            <div
              key={message._id}
              className={`cm-msg${message.mine ? " cm-msg--mine" : ""}`}
            >
              <span className="cm-msg__meta">
                {message.mine ? "You" : thread.other.name.split(" ")[0]} ·{" "}
                {relativeTime(message.createdAt)}
              </span>
              <span className="cm-msg__bubble">{message.body}</span>
            </div>
          ))
        )}
      </div>

      <div className="cm-thread__composer">
        {thread.messages.length === 0 && (
          <div className="cm-msg-starters">
            {MESSAGE_STARTERS[kind].map((starter) => (
              <button
                key={starter}
                type="button"
                className="cm-msg-starter"
                onClick={() => setBody(starter)}
              >
                {starter}
              </button>
            ))}
          </div>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        <textarea
          className="cm-textarea"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void handleSend();
            }
          }}
          placeholder="Write a message. Press Ctrl+Enter to send."
          maxLength={2000}
        />

        <div className="cm-actions" style={{ justifyContent: "space-between" }}>
          <span className="cm-note">
            Keep the handover on campus and never send money in advance.
          </span>
          <button
            type="button"
            className="cm-btn cm-btn--accent"
            onClick={handleSend}
            disabled={sending || !body.trim()}
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Messages() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const conversations = useQuery(api.messaging.list);
  const navigate = useNavigate();

  const hasThread = Boolean(conversationId);

  return (
    <AppShell>
      <div className="cm-shell">
        <Breadcrumbs
          items={[{ label: CAMPUS_NAME, to: "/" }, { label: "Messages" }]}
        />

        <header className="cm-page-head">
          <div>
            <p className="cm-eyebrow">
              Messages
              <span className="cm-eyebrow__rule" />
              {conversations?.length ?? 0} conversation
              {(conversations?.length ?? 0) === 1 ? "" : "s"}
            </p>
            <h1 className="cm-display cm-h2 cm-page-head__title">
              Talk it through before you trade
            </h1>
            <p className="cm-lede" style={{ marginTop: 16 }}>
              Ask about condition, agree a price and pick a spot on campus.
              Email addresses and phone numbers stay out of these threads.
            </p>
          </div>
          <div className="cm-stack" style={{ gap: 12 }}>
            <p className="cm-note">
              Conversations start from a listing or a student profile.
            </p>
            <Link to="/market" className="cm-btn cm-btn--quiet">
              Find something to ask about
            </Link>
          </div>
        </header>

        {conversations === undefined ? (
          <Loading label="Loading your conversations" />
        ) : conversations.length === 0 ? (
          <EmptyState
            eyebrow="Inbox empty"
            title="No conversations yet"
            body="When you message a seller about a listing, the thread shows up here. Everything stays inside CampusMart until you both agree to share more."
          >
            <div className="cm-actions">
              <Link to="/market" className="cm-btn">
                Browse the marketplace
              </Link>
              <Link to="/services" className="cm-btn cm-btn--quiet">
                Look for a service
              </Link>
            </div>
          </EmptyState>
        ) : (
          <div className="cm-inbox" data-thread={hasThread}>
            <div className="cm-inbox__list">
              {conversations.map((conversation) => (
                <button
                  key={conversation._id}
                  type="button"
                  className="cm-thread-item"
                  data-active={conversation._id === conversationId}
                  onClick={() => navigate(`/messages/${conversation._id}`)}
                >
                  <Initials name={conversation.other.name} small />
                  <span className="cm-thread-item__body">
                    <span className="cm-thread-item__top">
                      <span className="cm-thread-item__name">
                        {conversation.other.name}
                      </span>
                      <span className="cm-thread-item__time">
                        {relativeTime(conversation.lastMessageAt)}
                      </span>
                    </span>
                    {conversation.listing && (
                      <span className="cm-thread-item__ref">
                        {conversation.listing.title}
                      </span>
                    )}
                    <span className="cm-thread-item__preview">
                      {conversation.lastSenderIsMe ? "You: " : ""}
                      {conversation.lastMessagePreview}
                    </span>
                  </span>
                  {conversation.unread > 0 && <i className="cm-thread-item__unread" />}
                </button>
              ))}
            </div>

            {conversationId ? (
              <ThreadView conversationId={conversationId} />
            ) : (
              <div className="cm-thread">
                <div className="cm-thread__body" style={{ justifyContent: "center" }}>
                  <p className="cm-note">
                    Pick a conversation on the left to read the thread.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
