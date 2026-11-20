(() => {
  const panel = document.querySelector('[data-view="account"]');
  const message = panel.querySelector('[role="status"]');
  const google = panel.querySelector('[data-google]');
  let auth;
  let supabase;
  const supabaseConfig = window.ESHVEH_SUPABASE_CONFIG;
  if (supabaseConfig?.url && supabaseConfig?.publishableKey && window.supabase) {
    supabase = window.supabase.createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: {flowType:'pkce'},
    });
    const returning = new URLSearchParams(location.search).has('code');
    supabase.auth.onAuthStateChange((event, session) => {
      const data = session?.user?.user_metadata;
      updateProfile({photoURL:data?.avatar_url || data?.picture});
      if (session && (returning || event === 'SIGNED_IN') && document.querySelector('[data-view="welcome"].on')) go('discover');
      if (returning && session) {
        const url = new URL(location.href);
        url.searchParams.delete('code');
        history.replaceState(null,'',url);
      }
    });
  }

  function updateProfile(user) {
    document.querySelectorAll('[data-google-avatar]').forEach(image => {
      const fallback = image.parentElement.querySelector('[data-avatar-fallback]');
      image.hidden = true;
      fallback.hidden = false;
      image.onload = () => {
        image.hidden = false;
        fallback.hidden = true;
      };
      image.onerror = () => {
        image.hidden = true;
        fallback.hidden = false;
      };
      if (user?.photoURL) image.src = user.photoURL;
      else image.removeAttribute('src');
    });
  }

  function getAuth(config) {
    if (!auth) {
      auth = firebase.initializeApp(config).auth();
      auth.onAuthStateChanged(updateProfile);
    }
    return auth;
  }

  const config = window.ESHVEH_FIREBASE_CONFIG;
  if (config?.apiKey && window.firebase) getAuth(config);

  document.querySelectorAll('[data-account]').forEach(button => {
    button.onclick = () => {
      panel.querySelector('h2').textContent = button.dataset.account === 'new' ? 'Create your account' : 'Welcome back';
      message.textContent = '';
      go('account');
    };
  });

  google.onclick = async () => {
    if (supabase) {
      google.disabled = true;
      message.textContent = '';
      try {
        const settingsResponse = await fetch(new URL('/auth/v1/settings', supabaseConfig.url), {
          headers: {apikey: supabaseConfig.publishableKey},
        });
        if (!settingsResponse.ok) throw Error('Could not load Supabase authentication settings.');
        const settings = await settingsResponse.json();
        if (!settings.external?.google) {
          message.textContent = 'Google sign-in is awaiting activation. Select Explore demo to try Eshveh.';
          google.disabled = false;
          return;
        }
        const redirectTo = new URL('.', location.href).href;
        const {error} = await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
        if (error) throw error;
      } catch {
        message.textContent = 'Google sign-in could not start. Please try again.';
        google.disabled = false;
      }
      return;
    }
    if (!config?.apiKey) {
      message.textContent = 'Google sign-in isn’t set up yet. Select Explore demo to browse the sample profiles.';
      return;
    }
    if (!window.firebase) {
      message.textContent = 'Could not load Google sign-in. Check your connection and try again.';
      return;
    }
    google.disabled = true;
    message.textContent = '';
    try {
      const result = await getAuth(config).signInWithPopup(new firebase.auth.GoogleAuthProvider());
      updateProfile(result.user);
      go('discover');
    } catch (error) {
      const messages = {
        'auth/unauthorized-domain': 'This website must be added to the Firebase authorized domains.',
        'auth/operation-not-allowed': 'Google sign-in must be enabled in Firebase.',
        'auth/popup-closed-by-user': 'Google sign-in was closed. You can try again.',
        'auth/popup-blocked': 'Allow pop-ups for this website and try again.',
      };
      message.textContent = messages[error.code] || 'Google sign-in failed. Please try again.';
    } finally {
      google.disabled = false;
    }
  };
})();
