import { useEffect, useMemo, useState } from 'react'
import { apiGet, apiPost } from '../lib/api.js'
import { Button, Empty, ErrorCard, Skeletons } from '../components/ui.jsx'
import {
  Mail,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Users,
} from 'lucide-react'

function roleLabel(contact) {
  const platform =
    contact.mandates?.find((m) => m.type === 'platform')?.role || contact.role
  if (platform === 'focal_point') return 'Focal Point'
  if (platform === 'wg_contact') return 'WG Contact Point'
  if (platform === 'ngo_admin') return 'NGO mandate holder'
  if (platform === 'admin') return 'Admin'
  const wg = contact.mandates?.find((m) => m.type === 'wg')
  if (wg) return `${wg.wgSlug} ${wg.role}`
  return 'Mandate holder'
}

function ContactButton({ contact, onStart }) {
  return (
    <button
      className="messagePerson"
      onClick={() => onStart(contact)}
      type="button"
    >
      <span className="messageAvatar">{contact.name?.slice(0, 1) || '?'}</span>
      <span>
        <strong>{contact.name}</strong>
        <span className="meta">{roleLabel(contact)}</span>
      </span>
    </button>
  )
}

export function Messages() {
  const [contacts, setContacts] = useState([])
  const [conversations, setConversations] = useState([])
  const [selected, setSelected] = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const selectedConversation = conversations.find(
    (item) => item.id === selected,
  )
  const filteredContacts = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return contacts
    return contacts.filter((item) =>
      `${item.name} ${item.email || ''} ${roleLabel(item)}`
        .toLowerCase()
        .includes(needle),
    )
  }, [contacts, search])

  const load = async () => {
    setError(null)
    setLoading(true)
    try {
      const [contactData, conversationData] = await Promise.all([
        apiGet('/member/messages/contacts'),
        apiGet('/member/messages/conversations'),
      ])
      setContacts(contactData.items || [])
      setConversations(conversationData.items || [])
      const first = selected || conversationData.items?.[0]?.id || null
      setSelected(first)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    let alive = true
    if (!selected) {
      setMessages([])
      return () => {
        alive = false
      }
    }
    apiGet(`/member/messages/conversations/${selected}/messages`)
      .then((data) => {
        if (!alive) return
        setMessages(data.items || [])
      })
      .catch((err) => alive && setError(err.message))
    return () => {
      alive = false
    }
  }, [selected])

  const startConversation = async (contact) => {
    setBusy(true)
    setError(null)
    try {
      const result = await apiPost('/member/messages/conversations', {
        recipientId: contact.id,
      })
      const data = await apiGet('/member/messages/conversations')
      setConversations(data.items || [])
      setSelected(result.conversation.id)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const send = async (event) => {
    event.preventDefault()
    const text = body.trim()
    if (!selected || !text) return
    setBusy(true)
    setError(null)
    try {
      await apiPost(`/member/messages/conversations/${selected}/messages`, {
        body: text,
      })
      setBody('')
      const [messageData, conversationData] = await Promise.all([
        apiGet(`/member/messages/conversations/${selected}/messages`),
        apiGet('/member/messages/conversations'),
      ])
      setMessages(messageData.items || [])
      setConversations(conversationData.items || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (error && loading) return <ErrorCard message={error} onRetry={load} />
  if (loading) return <Skeletons n={5} />

  return (
    <div>
      <p className="eyebrow">Coordination</p>
      <h1>Messages</h1>
      <p className="meta pageIntro">
        Message Contact Points and mandate holders. Ordinary member-to-member
        DMs stay closed.
      </p>

      {error && <ErrorCard message={error} onRetry={load} />}

      <div className="messageLayout">
        <aside className="messageRail" aria-label="Conversations and contacts">
          <div className="queueToolbar">
            <strong>Inbox</strong>
            <Button
              sm
              variant="ghost"
              onClick={load}
              aria-label="Refresh messages"
            >
              <RefreshCw size={16} aria-hidden />
            </Button>
          </div>
          <div className="stackSm">
            {conversations.map((item) => (
              <button
                key={item.id}
                className={`conversationItem ${selected === item.id ? 'active' : ''}`}
                onClick={() => setSelected(item.id)}
                type="button"
              >
                <span className="messageAvatar">
                  {item.otherParticipant?.name?.slice(0, 1) || '?'}
                </span>
                <span>
                  <strong>
                    {item.otherParticipant?.name || 'Conversation'}
                  </strong>
                  <span className="meta">
                    {item.lastMessagePreview || 'No messages yet'}
                  </span>
                </span>
              </button>
            ))}
            {!conversations.length && (
              <Empty
                icon={Mail}
                title="No conversations yet"
                body="Start with a mandate holder below."
              />
            )}
          </div>

          <div className="messageContactsHeader">
            <strong>Start a conversation</strong>
            <label className="queueSearch">
              <Search size={16} aria-hidden />
              <span className="srOnly">Search contacts</span>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search contacts"
              />
            </label>
          </div>
          <div className="stackSm">
            {filteredContacts.map((contact) => (
              <ContactButton
                key={contact.id}
                contact={contact}
                onStart={startConversation}
              />
            ))}
            {!filteredContacts.length && (
              <Empty icon={Users} title="No mandate contacts found" />
            )}
          </div>
        </aside>

        <section className="messageThread" aria-label="Selected conversation">
          {!selectedConversation ? (
            <Empty
              icon={MessageSquare}
              title="Select a conversation"
              body="Choose an existing thread or start a new one with a mandate holder."
            />
          ) : (
            <>
              <header className="messageThreadHeader">
                <div>
                  <p className="metaMuted">Conversation with</p>
                  <h2>
                    {selectedConversation.otherParticipant?.name ||
                      'Mandate holder'}
                  </h2>
                </div>
              </header>
              <div className="messageStream">
                {!messages.length && (
                  <Empty
                    icon={MessageSquare}
                    title="No messages yet"
                    body="Send the first note when you are ready."
                  />
                )}
                {messages.map((item) => (
                  <div
                    key={item.id}
                    className={`messageBubble ${item.senderAccountId === selectedConversation.otherParticipant?.id ? '' : 'mine'}`}
                  >
                    <p>{item.body}</p>
                    <span className="metaMuted">
                      {item.sender?.name || 'You'} ·{' '}
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
              <form className="messageComposer" onSubmit={send}>
                <textarea
                  className="textarea"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="Write a message"
                  rows={3}
                  maxLength={4000}
                />
                <Button variant="primary" disabled={busy || !body.trim()}>
                  <Send size={16} aria-hidden />
                  Send
                </Button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
