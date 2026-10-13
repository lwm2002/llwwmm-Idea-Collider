import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { StoreProvider } from './components/StoreProvider';
import './styles.css';
import './studio.css';
import './notebook.css';
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Workspace rendering error', error.message, info.componentStack);
  }
  render() {
    if (this.state.failed)
      return (
        <div className="empty">
          <h1>实验室遇到了意外错误</h1>
          <p>已保存的实验记录仍在此浏览器中。请刷新页面重试。</p>
          <button className="button primary" onClick={() => location.reload()}>
            重新打开
          </button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <BrowserRouter>
      <StoreProvider>
        <App />
      </StoreProvider>
    </BrowserRouter>
  </ErrorBoundary>,
);
