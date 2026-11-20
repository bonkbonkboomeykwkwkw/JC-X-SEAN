import { useEffect, useState } from 'react';
import './auth.css';

const titles = {
  register: 'Create your account',
  login: 'Welcome back',
  admin: 'Admin sign in',
};

function AuthPages({ type }) {
  const isRegister = type === 'register';
  const isAdmin = type === 'admin';
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [feedback, setFeedback] = useState(null);
  const [resetNote, setResetNote] = useState(false);

  useEffect(() => {
    document.title = `${titles[type]} — Sean and JC.co`;
  }, [type]);

  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = data.get('password');
    if (isRegister && password !== data.get('confirmPassword')) {
      setFeedback({ kind: 'error', text: 'Passwords do not match. Check both password fields.' });
      return;
    }
    setFeedback({
      kind: 'notice',
      text: isRegister
        ? 'Account creation is not connected yet. Your information was not submitted.'
        : 'Sign-in is not connected yet. Your credentials were not submitted.',
    });
  }

  const passwordField = (name, label, autocomplete) => <label className="auth-field">
    <span>{label}</span>
    <span className="auth-password-wrap">
      <input name={name} type={visiblePasswords[name] ? 'text' : 'password'} required minLength={8} autoComplete={autocomplete} />
      <button className="auth-password-toggle" type="button" onClick={() => setVisiblePasswords(previous => ({ ...previous, [name]: !previous[name] }))} aria-label={`${visiblePasswords[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={!!visiblePasswords[name]}>{visiblePasswords[name] ? 'Hide' : 'Show'}</button>
    </span>
  </label>;

  return <div className={`auth-page ${isAdmin ? 'admin-auth' : ''}`}>
    <div className="auth-announce">{isAdmin ? 'SEAN AND JC.CO · STAFF ACCESS' : 'Find what fits your everyday.'}<span>{isAdmin ? 'Private area' : 'Free shipping on orders over ₱100'}</span></div>
    <header className="auth-header">
      <a className="brand" href="/">Sean&JC.co</a>
      <nav aria-label="Account navigation">
        <a href="/">Back to shop</a>
        {!isAdmin && <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create account'}</a>}
        {isAdmin && <a href="/login">Customer sign in</a>}
      </nav>
    </header>
    <main className="auth-main">
      <section className={`auth-panel ${isAdmin ? 'admin-panel' : ''}`} aria-labelledby="auth-title">
        {isAdmin && <div className="admin-intro"><span className="eyebrow">PRIVATE AREA</span><h2>Store administration</h2><p>Authorized team members only.</p></div>}
        <div className="auth-form-area">
          <div className="eyebrow">{isAdmin ? 'STAFF ACCOUNT' : isRegister ? 'JOIN US' : 'YOUR ACCOUNT'}</div>
          <h1 id="auth-title">{titles[type]}</h1>
          <p className="auth-lead">{isRegister ? 'Save your details for a smoother checkout.' : isAdmin ? 'Use your assigned administrator credentials.' : 'Sign in to continue to Sean and JC.co.'}</p>
          <form className="auth-form" onSubmit={submit} onChange={() => setFeedback(null)}>
            {isRegister && <label className="auth-field"><span>Full name</span><input name="name" type="text" required maxLength={100} autoComplete="name" /></label>}
            <label className="auth-field"><span>{isAdmin ? 'Email or username' : 'Email address'}</span><input name={isAdmin ? 'identity' : 'email'} type={isAdmin ? 'text' : 'email'} required maxLength={254} autoComplete={isAdmin ? 'username' : 'email'} /></label>
            {passwordField('password', 'Password', isRegister ? 'new-password' : 'current-password')}
            {isRegister && passwordField('confirmPassword', 'Confirm password', 'new-password')}
            {!isRegister && !isAdmin && <div className="auth-options"><label className="remember-option"><input name="remember" type="checkbox" /> <span>Remember me</span></label><button className="auth-text-button" type="button" onClick={() => setResetNote(true)}>Forgot password?</button></div>}
            {resetNote && <p className="auth-note" role="status">Password reset is not available yet.</p>}
            {feedback && <p className={`auth-feedback ${feedback.kind}`} role={feedback.kind === 'error' ? 'alert' : 'status'}>{feedback.text}</p>}
            <button className="dark-button auth-submit" type="submit">{isRegister ? 'Create account' : isAdmin ? 'Admin sign in' : 'Sign in'} <span>↗</span></button>
            {isAdmin && <p className="auth-note">Admin accounts are managed privately. There is no public admin registration.</p>}
          </form>
          {!isAdmin && <p className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Sean and JC.co?'} <a href={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</a></p>}
        </div>
      </section>
    </main>
    <footer className="auth-footer"><a href="/">Sean&JC.co</a><span>Something for every day.</span><a href="/admin/login">Admin sign in</a></footer>
  </div>;
}

export default AuthPages;
