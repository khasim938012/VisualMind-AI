import React, { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';

export const Sidebar: React.FC = () => {
  const { 
      history, 
      setHistory, 
      sessions, 
      setSessions, 
      currentSessionId, 
      setCurrentSessionId, 
      startNewChat 
  } = useStore();
  
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    // Fetch all sessions
    axios.get('http://localhost:3001/api/sessions')
      .then(res => setSessions(res.data))
      .catch(err => console.error("Error fetching sessions", err));
  }, [setSessions]);

  useEffect(() => {
    // Fetch history for current session
    axios.get(`http://localhost:3001/api/history?sessionId=${currentSessionId}`)
      .then(res => setHistory(res.data))
      .catch(err => console.error("Error fetching history", err));
  }, [currentSessionId, setHistory]);

  const handleNewChat = async () => {
      startNewChat(); // clears state and generates new ID
      const newId = useStore.getState().currentSessionId;
      const title = "New Chat " + new Date().toLocaleTimeString();
      try {
          await axios.post('http://localhost:3001/api/sessions', { id: newId, title });
          // refresh sessions
          const res = await axios.get('http://localhost:3001/api/sessions');
          setSessions(res.data);
      } catch(e) {
          console.error(e);
      }
  };

  const loadSession = (id: string) => {
      setCurrentSessionId(id);
  };

  if (isCollapsed) {
      return (
          <div className="sidebar collapsed">
              <button className="toggle-btn" onClick={() => setIsCollapsed(false)}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
              </button>
          </div>
      );
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
          <h2>Dashboard</h2>
          <button className="toggle-btn" onClick={() => setIsCollapsed(true)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          </button>
      </div>

      <button className="new-chat-btn" onClick={handleNewChat}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          New Chat
      </button>

      <div className="sidebar-section">
          <h3>Recent Chats</h3>
          <div className="sessions-list">
            {sessions.map((session) => (
                <div 
                    key={session.id} 
                    className={`session-item ${session.id === currentSessionId ? 'active' : ''}`}
                    onClick={() => loadSession(session.id)}
                >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>{session.title}</span>
                </div>
            ))}
          </div>
      </div>

      <div className="sidebar-section history-section">
          <h3>Current Chat</h3>
          <div className="history-list">
            {history.length === 0 && <div className="empty-state">No messages yet. Start speaking!</div>}
            {history.map((item) => (
              <div key={item.id} className={`history-item ${item.role}`}>
                <strong>{item.role === 'user' ? 'You' : 'AI'}</strong>
                <p>{item.content}</p>
              </div>
            ))}
          </div>
      </div>
    </div>
  );
};
