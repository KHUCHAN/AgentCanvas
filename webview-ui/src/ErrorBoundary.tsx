import type { ReactNode } from "react";
import { Component } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  section?: string;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message?: string;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message
    };
  }

  public override componentDidCatch(error: Error): void {
    console.error("Webview render error", error);
  }

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 16 }}>
          <h2>AgentCanvas UI Error</h2>
          {this.props.section && <p>Section: {this.props.section}</p>}
          <p>{this.state.message ?? "Unexpected rendering error"}</p>
          <p>Reload the webview and try again.</p>
        </div>
      );
    }
    return this.props.children;
  }
}
