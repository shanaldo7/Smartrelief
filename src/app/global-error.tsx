'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Global Error:', error);
  }, [error]);

  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full space-y-6 text-center">
            <div className="flex justify-center">
              <div className="p-4 bg-destructive/10 rounded-full">
                <AlertCircle className="h-12 w-12 text-destructive" />
              </div>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
              <p className="text-muted-foreground">
                An unexpected error occurred. We've been notified and are working on it.
              </p>
            </div>
            {error.message && (
              <div className="p-4 bg-muted rounded-lg text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-muted-foreground break-all whitespace-pre-wrap">
                  {error.message}
                </p>
              </div>
            )}
            <div className="flex gap-4 justify-center">
              <Button onClick={() => window.location.reload()} variant="outline" className="gap-2">
                <RefreshCcw className="h-4 w-4" />
                Reload Page
              </Button>
              <Button onClick={() => reset()} className="gap-2">
                Try Again
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
