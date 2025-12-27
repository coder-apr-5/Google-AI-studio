// ErrorBoundary.tsx - Firestore Error Boundary Component
// Uses React.Component to catch errors and show friendly fallback UI

import React, { Component, ReactNode, ErrorInfo } from 'react';

// Props interface
interface ErrorBoundaryProps {
    children: ReactNode;
    fallbackMessage?: string;
}

// State interface
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
    isIndexError: boolean;
}

/**
 * Error Boundary for catching Firebase/Firestore errors gracefully.
 * Shows a friendly "Syncing" message for index-related errors.
 */
export class FirestoreErrorBoundary extends Component<
    ErrorBoundaryProps,
    ErrorBoundaryState
> {
    state: ErrorBoundaryState = {
        hasError: false,
        error: null,
        isIndexError: false,
    };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        const msg = error?.message || '';
        const isIndexError =
            msg.includes('index') ||
            msg.includes('Index') ||
            msg.includes('requires an index') ||
            msg.includes('FAILED_PRECONDITION');

        return {
            hasError: true,
            error,
            isIndexError,
        };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
        console.error('[FirestoreErrorBoundary] Error caught:', error);
        console.error('[FirestoreErrorBoundary] Error info:', errorInfo);
        if (this.state.isIndexError) {
            console.error(
                '[FirestoreErrorBoundary] Missing Firestore index detected. Check Firebase Console → Firestore → Indexes.'
            );
        }
    }

    handleRetry = (): void => {
        this.setState({
            hasError: false,
            error: null,
            isIndexError: false,
        });
    };

    render(): ReactNode {
        const { hasError, isIndexError, error } = this.state;
        const { children, fallbackMessage } = this.props;

        if (!hasError) {
            return children;
        }

        // Index-related error - show friendly syncing message
        if (isIndexError) {
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-blue-100">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center animate-pulse">
                            <span className="material-symbols-outlined text-4xl text-blue-500">
                                sync
                            </span>
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-3">
                            Syncing with Market...
                        </h2>
                        <p className="text-gray-600 mb-6">
                            {fallbackMessage ||
                                'This usually takes 2-3 minutes during initial setup. The database is preparing your data.'}
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={this.handleRetry}
                                className="px-6 py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">refresh</span>
                                Try Again
                            </button>
                            <p className="text-xs text-gray-400">
                                If this persists, check Firebase Console → Firestore → Indexes
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        // General error - show error details
        return (
            <div className="min-h-[400px] flex items-center justify-center p-8">
                <div className="max-w-md text-center bg-white rounded-2xl shadow-lg p-8 border border-red-100">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-red-500">
                            error_outline
                        </span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-3">
                        Something went wrong
                    </h2>
                    <p className="text-gray-600 mb-4">
                        We encountered an unexpected error. Please try again.
                    </p>
                    <details className="text-left mb-6 bg-gray-50 rounded-lg p-3">
                        <summary className="text-sm text-gray-500 cursor-pointer font-medium">
                            Technical Details
                        </summary>
                        <pre className="mt-2 text-xs text-red-600 overflow-auto max-h-24">
                            {error?.message}
                        </pre>
                    </details>
                    <button
                        onClick={this.handleRetry}
                        className="px-6 py-3 bg-red-600 text-white rounded-full font-bold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <span className="material-symbols-outlined">refresh</span>
                        Try Again
                    </button>
                </div>
            </div>
        );
    }
}

export default FirestoreErrorBoundary;
