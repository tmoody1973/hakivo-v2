import { FC } from "react";
import { Card } from "./card";
import { Button } from "./button";
import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";

export interface ErrorStateProps {
  title?: string;
  message: string;
  type?: "network" | "server" | "generic";
  retry?: () => void;
  className?: string;
}

/**
 * ErrorState Component
 *
 * Displays error messages with contextual icons and retry functionality.
 * Handles network errors, server errors, and generic errors with appropriate messaging.
 */
export const ErrorState: FC<ErrorStateProps> = ({
  title,
  message,
  type = "generic",
  retry,
  className = "",
}) => {
  const getIcon = () => {
    switch (type) {
      case "network":
        return <WifiOff className="h-12 w-12" />;
      case "server":
      case "generic":
      default:
        return <AlertCircle className="h-12 w-12" />;
    }
  };

  const getDefaultTitle = () => {
    switch (type) {
      case "network":
        return "Connection Error";
      case "server":
        return "Server Error";
      default:
        return "Something Went Wrong";
    }
  };

  return (
    <Card className={`flex flex-col items-center justify-center p-12 text-center border-destructive/50 ${className}`}>
      <div className="mb-4 text-destructive opacity-75">
        {getIcon()}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title || getDefaultTitle()}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {message}
      </p>
      {retry && (
        <Button onClick={retry} variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
      )}
    </Card>
  );
};
