import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to console for debugging
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    
    // Update state with error details
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-6xl mb-4">😵</div>
            <h2 className="text-xl font-bold text-red-600 mb-2">
              שגיאה בלתי צפויה
            </h2>
            <p className="text-gray-600 mb-4">
              משהו השתבש באפליקציה. אנא רענן את הדף ונסה שוב.
            </p>
            
            <div className="space-y-2">
              <button
                className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
                onClick={() => window.location.reload()}
              >
                רענן דף
              </button>
              
              <button
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded hover:bg-gray-400"
                onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              >
                נסה שוב
              </button>
            </div>

            {/* Show error details in development */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">
                  פרטי שגיאה (למפתחים)
                </summary>
                <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono text-red-600 overflow-auto max-h-40">
                  <div className="font-bold">Error:</div>
                  <div className="mb-2">{this.state.error.toString()}</div>
                  <div className="font-bold">Stack Trace:</div>
                  <div>{this.state.errorInfo.componentStack}</div>
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;