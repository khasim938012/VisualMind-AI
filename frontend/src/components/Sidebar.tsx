import React, { useEffect } from 'react';
import { useStore } from '../store/useStore';
import axios from 'axios';

export const Sidebar: React.FC = () => {
  const { history, setHistory } = useStore();

  useEffect(() => {
    // Fetch initial history
    axios.get('http://localhost:3001/api/history')
      .then(res => setHistory(res.data))
      .catch(err => console.error("Error fetching history", err));
  }, [setHistory]);

  return (
    <div className="sidebar">
      <h2>History</h2>
      <div className="history-list">
        {history.map((item) => (
          <div key={item.id} className={`history-item ${item.role}`}>
            <strong>{item.role === 'user' ? 'You' : 'AI'}: </strong>
            <span>{item.content.length > 50 ? item.content.substring(0, 50) + '...' : item.content}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
