import { Component, type ReactNode } from 'react';

const KEYS = ['openmathtutor.frontend.v1', 'openmathtutor.mastery.v1', 'openmathtutor.profile.v1', 'openmathtutor.sources.v1'];

/** A damaged saved state must never leave a white screen that survives every reload. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  reset = () => {
    for (const key of KEYS) { try { localStorage.removeItem(key); } catch { /* storage may be unavailable */ } }
    location.reload();
  };
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="onboarding" role="alert"><div className="onboarding-card">
      <h1>Něco se pokazilo / Something went wrong</h1>
      <p className="muted">Uložená data v tomto prohlížeči jsou pravděpodobně poškozená. / The data saved in this browser may be damaged.</p>
      <div className="row"><button onClick={() => location.reload()}>Zkusit znovu / Try again</button>
        <button className="primary" onClick={this.reset}>Smazat uložená data / Reset saved data</button></div>
    </div></div>;
  }
}
