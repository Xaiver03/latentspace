import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, Bug, Home, Mail } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  eventId?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  private retryCount = 0;
  private maxRetries = 3;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to monitoring service
    this.logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
      eventId: this.generateEventId(),
    });

    // Call optional error handler
    this.props.onError?.(error, errorInfo);
  }

  private logErrorToService(error: Error, errorInfo: ErrorInfo) {
    // In production, send to error monitoring service (e.g., Sentry)
    const errorData = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: this.getUserId(),
    };

    if (process.env.NODE_ENV === "production") {
      // Send to monitoring service
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
        credentials: "include",
      }).catch(() => {
        // Silently fail if error reporting fails
        console.error("Failed to report error to monitoring service");
      });
    } else {
      console.error("Error Boundary caught an error:", error, errorInfo);
    }
  }

  private generateEventId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getUserId(): string | undefined {
    // Get user ID from context or localStorage
    try {
      const userStr = localStorage.getItem("user");
      return userStr ? JSON.parse(userStr).id : undefined;
    } catch {
      return undefined;
    }
  }

  private handleRetry = () => {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }
  };

  private handleGoHome = () => {
    window.location.href = "/platform";
  };

  private handleReportBug = () => {
    const subject = encodeURIComponent(`Bug Report - Event ID: ${this.state.eventId}`);
    const body = encodeURIComponent(`
Error Details:
- Event ID: ${this.state.eventId}
- Error: ${this.state.error?.message}
- URL: ${window.location.href}
- Timestamp: ${new Date().toISOString()}

Please describe what you were doing when this error occurred:


Additional Information:
- Browser: ${navigator.userAgent}
- Stack Trace: ${this.state.error?.stack}
    `);
    
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isNetworkError = this.state.error?.message?.includes("fetch") || 
                            this.state.error?.message?.includes("network");
      
      const isChunkError = this.state.error?.message?.includes("Loading chunk") ||
                          this.state.error?.message?.includes("Loading CSS chunk");

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-2xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <Bug className="w-8 h-8 text-red-600" />
              </div>
              <CardTitle className="text-2xl text-gray-900">
                {isChunkError ? "Update Required" : "Something went wrong"}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {isChunkError ? (
                <Alert>
                  <AlertDescription>
                    The application has been updated. Please refresh the page to load the latest version.
                  </AlertDescription>
                </Alert>
              ) : isNetworkError ? (
                <Alert>
                  <AlertDescription>
                    It looks like there's a network issue. Please check your internet connection and try again.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertDescription>
                    An unexpected error occurred while loading this page. Our team has been notified.
                  </AlertDescription>
                </Alert>
              )}

              {process.env.NODE_ENV === "development" && (
                <details className="bg-gray-100 p-4 rounded-lg">
                  <summary className="cursor-pointer font-medium text-gray-700">
                    Error Details (Development Only)
                  </summary>
                  <div className="mt-2 text-sm">
                    <p className="font-medium text-red-600">{this.state.error?.message}</p>
                    {this.state.error?.stack && (
                      <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                        {this.state.error.stack}
                      </pre>
                    )}
                  </div>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                {this.retryCount < this.maxRetries && (
                  <Button onClick={this.handleRetry} className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Try Again ({this.maxRetries - this.retryCount} attempts left)
                  </Button>
                )}
                
                <Button variant="outline" onClick={this.handleGoHome} className="flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  Go Home
                </Button>
                
                <Button variant="outline" onClick={this.handleReportBug} className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Report Bug
                </Button>
              </div>

              {this.state.eventId && (
                <p className="text-xs text-gray-500 text-center">
                  Error ID: {this.state.eventId}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorFallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={errorFallback}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

// Hook for manual error reporting
export function useErrorReporting() {
  const reportError = (error: Error, context?: string) => {
    // Manual error reporting
    const errorData = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    if (process.env.NODE_ENV === "production") {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(errorData),
        credentials: "include",
      }).catch(() => {
        console.error("Failed to report error to monitoring service");
      });
    } else {
      console.error("Manual error report:", error, context);
    }
  };

  return { reportError };
}