import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-[#F7F6F2] text-center p-8">
          <h2 className="text-xl font-bold text-[#1A2332] mb-2">Something went wrong</h2>
          <p className="text-[#6B7280] text-sm mb-6 max-w-sm">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/dashboard'; }}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
