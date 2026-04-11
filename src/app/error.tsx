'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('App Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center space-y-6">
      <div className="p-4 bg-amber-50 rounded-full">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-headline">Application Error</h2>
        <p className="text-muted-foreground max-w-md">
          There was a problem processing your request. This might be temporary.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 justify-center">
        <Button onClick={() => reset()} variant="default" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
        <Button variant="outline" asChild className="gap-2">
          <Link href="/">
            <Home className="h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-8 p-4 bg-muted rounded-xl text-left text-xs font-mono max-w-full overflow-auto">
          {error.stack}
        </pre>
      )}
    </div>
  );
}
