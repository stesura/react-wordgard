// Not in react-prosemirror: catches an error thrown while React renders the
// document, for ReactDocTile to throw it from the update. React 18 rethrows it
// from flushSync, React 19 reports it as uncaught and commits nothing, and the
// tiles can't be built over what didn't commit. A class: React has no hook for
// this.
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
