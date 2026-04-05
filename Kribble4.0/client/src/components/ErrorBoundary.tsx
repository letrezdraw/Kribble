import { Component, ErrorInfo, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });
    
    // Log to error tracking service in production
    if (import.meta.env.PROD) {
      // TODO: Send to Sentry or similar service
      // Example: Sentry.captureException(error, { extra: errorInfo });
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="error-boundary"
        >
          <div className="error-container">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="error-icon-wrapper"
            >
              <AlertTriangle size={64} className="error-icon" />
            </motion.div>

            <h1 className="error-title">Oops! Something went wrong</h1>
            
            <p className="error-message">
              We're sorry, but an unexpected error occurred. 
              Don't worry - your game progress is saved!
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="error-details">
                <details>
                  <summary>Error Details (Development Only)</summary>
                  <pre className="error-stack">
                    {this.state.error.toString()}
                    {'\n'}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              </div>
            )}

            <div className="error-actions">
              <Button
                variant="primary"
                onClick={this.handleReload}
                className="error-btn"
              >
                <RefreshCw size={18} />
                Reload Page
              </Button>

              <Link to="/">
                <Button
                  variant="secondary"
                  onClick={this.handleReset}
                  className="error-btn"
                >
                  <Home size={18} />
                  Go Home
                </Button>
              </Link>
            </div>

            <p className="error-support">
              If this keeps happening, please contact support with error code:{' '}
              <code className="error-code">
                {Math.random().toString(36).substring(2, 10).toUpperCase()}
              </code>
            </p>
          </div>
        </motion.div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
