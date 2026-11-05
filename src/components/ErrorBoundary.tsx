// Not in react-prosemirror: catches a render error for ReactDocTile to throw from the update. React
// 18 rethrows it from flushSync, React 19 reports it and commits nothing. A class: React has no
// hook for this.
import { Component, type ReactNode } from "react";

type Props = { onError: (error: unknown) => void; children?: ReactNode };

export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError = () => ({ failed: true });

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
