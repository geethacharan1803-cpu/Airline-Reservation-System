import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { sendChatMessage, getChatStatus } from '../api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your SkyVoyage travel assistant. I can help you find flights, understand our policies, or answer questions about your booking. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(true);
  const [providerInfo, setProviderInfo] = useState<string>('Online');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatStatus()
      .then(status => {
        setIsOnline(status.status === 'online');
        if (status.provider) {
          setProviderInfo(status.provider === 'ollama' ? 'Online (Ollama)' : 'Online');
        }
      })
      .catch(() => {
        // Fallback to online since in-memory domain expert is always available
        setIsOnline(true);
        setProviderInfo('Online');
      });
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await sendChatMessage(userMessage, messages);
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);
      setIsOnline(true);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'I apologize, but I encountered an error. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    'Search flights from New York to London',
    'What is the baggage allowance?',
    'How do I check in online?',
    'Explain the refund policy',
  ];

  if (!isOpen) {
    return (
      <button className="chat-toggle" onClick={() => setIsOpen(true)} aria-label="Open chat assistant">
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="chat-panel" role="dialog" aria-label="AI Travel Assistant">
      <div className="chat-panel__header">
        <div>
          <div className="chat-panel__title">
            <Bot size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Travel Assistant
          </div>
          <div className="chat-panel__status">
            <span className={`chat-panel__status-dot ${isOnline === false ? 'chat-panel__status-dot--offline' : ''}`} />
            {isOnline === null ? 'Checking...' : isOnline ? providerInfo : 'Connecting...'}
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} aria-label="Close chat" style={{ color: 'white' }}>
          <X size={20} />
        </button>
      </div>

      <div className="chat-panel__messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-message chat-message--${msg.role}`}>
            {msg.content}
          </div>
        ))}
        {isLoading && (
          <div className="chat-message chat-message--assistant" style={{ opacity: 0.6 }}>
            <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, display: 'inline-block', verticalAlign: 'middle', marginRight: 8 }} />
            Thinking...
          </div>
        )}
        {messages.length <= 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => { setInput(action); }}
                style={{
                  fontSize: '0.75rem',
                  padding: '6px 12px',
                  borderRadius: '20px',
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--surface-primary)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
                onMouseEnter={e => {
                  (e.target as HTMLElement).style.borderColor = 'var(--color-sky-400)';
                  (e.target as HTMLElement).style.color = 'var(--color-sky-600)';
                }}
                onMouseLeave={e => {
                  (e.target as HTMLElement).style.borderColor = 'var(--color-gray-200)';
                  (e.target as HTMLElement).style.color = 'var(--text-secondary)';
                }}
              >
                {action}
              </button>
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-panel__input-area">
        <input
          className="chat-panel__input"
          type="text"
          placeholder="Ask about flights, policies, bookings..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={isLoading}
        />
        <button
          className="chat-panel__send"
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
