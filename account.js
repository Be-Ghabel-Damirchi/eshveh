(() => {
  const panel = document.querySelector('[data-view="account"]');
  const message = panel.querySelector('[role="status"]');
  const sync = document.getElementById('sync-status');
  const form = panel.querySelector('form');
  const logout = document.getElementById('sign-out');
  const config = window.ESHVEH_SUPABASE_CONFIG;
  const client = window.supabase?.createClient(config.url, config.publishableKey, {
    auth: {flowType:'pkce'},
  });
  const redirectTo = new URL('.', location.href).href;
  let mode = 'returning';
  let loadedUser = null;
  let loading = false;
  let queue = Promise.resolve();

  document.querySelectorAll('[data-account]').forEach(button => {
    button.onclick = () => {
      mode = button.dataset.account;
      panel.querySelector('h2').textContent = mode === 'new' ? 'Create your account' : 'Welcome back';
      form.querySelector('[type="submit"]').textContent = mode === 'new' ? 'Create account' : 'Sign in';
      form.elements.password.autocomplete = mode === 'new' ? 'new-password' : 'current-password';
      panel.querySelector('[data-age-check]').hidden = mode !== 'new';
      form.elements.adult.required = mode === 'new';
      form.elements.email.pattern = mode === 'new' ? '[^@]+@[gG][mM][aA][iI][lL][.][cC][oO][mM]' : '';
      if (mode !== 'new') form.elements.email.removeAttribute('pattern');
      panel.querySelector('[data-email-label]').textContent = mode === 'new' ? 'Gmail address' : 'Email';
      message.textContent = '';
      go('account');
    };
  });

  async function loadAccount(user) {
    if (loading || loadedUser === user.id) return;
    loading = true;
    try {
      const {data,error} = await client.from('eshveh_preview_state').select('state').eq('user_id',user.id).maybeSingle();
      if (error) throw error;
      const state = data?.state ?? {};
      if (!data && user.user_metadata?.full_name) {
        state.profile = {name:user.user_metadata.full_name};
      }
      window.loadEshvehPreview(state, user.id);
      loadedUser = user.id;
      logout.hidden = false;
      sync.textContent = 'Signed in. Changes sync to your account.';
      go('discover');
    } catch {
      message.textContent = 'Your account data could not load. Please try signing in again.';
      go('account');
    } finally {
      loading = false;
    }
  }

  window.saveEshvehPreview = (userId, state) => {
    if (!client || userId !== loadedUser) return;
    const snapshot = structuredClone(state);
    sync.textContent = 'Saving changes…';
    queue = queue.catch(() => {}).then(async () => {
      if (userId !== loadedUser) return;
      try {
        const {error} = await client.from('eshveh_preview_state').upsert({user_id:userId,state:snapshot});
        if (error) throw error;
        sync.textContent = 'Changes saved to your account.';
      } catch {
        sync.textContent = 'Cloud save failed. Your changes are saved on this device if space is available.';
      }
    });
  };

  client?.auth.onAuthStateChange((event, session) => {
    if (session && ['INITIAL_SESSION','SIGNED_IN'].includes(event)) {
      setTimeout(() => loadAccount(session.user),0);
    }
  });

  form.onsubmit = async event => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message.textContent = '';
    try {
      if (!client) throw Error('Sign-in is temporarily unavailable.');
      const credentials = {email:form.elements.email.value.trim(),password:form.elements.password.value};
      const {data,error} = mode === 'new'
        ? await client.auth.signUp({...credentials,options:{emailRedirectTo:redirectTo}})
        : await client.auth.signInWithPassword(credentials);
      if (error) throw error;
      form.reset();
      if (data.session) await loadAccount(data.user);
      else message.textContent = 'Check your email for a confirmation link, then return here to sign in.';
    } catch (error) {
      message.textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };

  panel.querySelector('[data-google]').onclick = async () => {
    try {
      if (!client) throw Error('Sign-in is temporarily unavailable.');
      const response = await fetch(new URL('/auth/v1/settings', config.url), {
        headers:{apikey:config.publishableKey},
      });
      if (!response.ok) throw Error('Could not check Google sign-in.');
      const settings = await response.json();
      if (!settings.external?.google) throw Error('Google sign-in is awaiting activation. You can use email.');
      const {error} = await client.auth.signInWithOAuth({provider:'google',options:{redirectTo}});
      if (error) throw error;
    } catch (error) {
      message.textContent = error.message;
    }
  };

  logout.onclick = async () => {
    logout.disabled = true;
    try {
      await queue;
      const {error} = await client.auth.signOut();
      if (error) throw error;
      loadedUser = null;
      logout.hidden = true;
      sync.textContent = '';
      window.loadEshvehPreview(null,null);
      go('welcome');
    } catch {
      sync.textContent = 'Could not sign out. Please try again.';
    } finally {
      logout.disabled = false;
    }
  };
})();
