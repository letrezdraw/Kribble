import { useSocket } from '../contexts/SocketContext';
import Button from './Button';
import './ConnectionStatus.css';

export default function ConnectionStatus() {
  const { connected, reconnecting, connectionError, reconnect, clearError } = useSocket();

  if (connected && !connectionError) return null;

  return (
    <div className="connection-status">
      {reconnecting && (
        <div className="status-banner reconnecting">
          <div className="spinner"></div>
          <span>Reconnecting to server...</span>
        </div>
      )}
      
      {!reconnecting && connectionError && (
        <div className="status-banner error">
          <span className="error-icon">⚠️</span>
          <span>{connectionError}</span>
          <Button variant="primary" size="sm" onClick={reconnect}>
            Reconnect
          </Button>
          <button className="close-btn" onClick={clearError}>×</button>
        </div>
      )}
      
      {!connected && !reconnecting && !connectionError && (
        <div className="status-banner disconnected">
          <span className="error-icon">🔌</span>
          <span>Disconnected from server</span>
          <Button variant="primary" size="sm" onClick={reconnect}>
            Connect
          </Button>
        </div>
      )}
    </div>
  );
}
