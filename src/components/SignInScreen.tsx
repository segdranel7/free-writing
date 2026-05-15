import { useState } from 'react';
import { MessageCirclePlus } from 'lucide-react';
import { hasFirebaseConfig } from '../firebase';
import { signInWithGoogle } from '../services/auth';
import { getErrorMessage } from '../utils/errors';

export function SignInScreen() {
  const [authError, setAuthError] = useState('');

  async function handleSignIn() {
    setAuthError('');
    try {
      await signInWithGoogle();
    } catch (error) {
      setAuthError(getErrorMessage(error));
    }
  }

  return (
    <main className="signin">
      <section className="signin-panel">
        <div className="brand-mark">
          <MessageCirclePlus size={34} />
        </div>
        <h1>Free Writing</h1>
        <p>Private conversations for your own notes and text blocks.</p>
        {!hasFirebaseConfig && (
          <div className="notice">
            Add Firebase values to <code>.env</code>, then restart the dev server.
          </div>
        )}
        {authError && <div className="notice error">{authError}</div>}
        <button className="primary-button" onClick={() => void handleSignIn()} disabled={!hasFirebaseConfig}>
          Continue with Google
        </button>
      </section>
    </main>
  );
}
