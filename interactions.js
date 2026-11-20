(() => {
  const el = id => document.getElementById(id);
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  function button(label, action, className = 'chip') {
    const node = make('button', label, className);
    node.type = 'button';
    node.onclick = action;
    return node;
  }
  const categories = ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Extras'];
  const categoryByIcon = {
    coat:'Outerwear', blazer:'Outerwear', shirt:'Tops', sweater:'Tops', tee:'Tops',
    trousers:'Bottoms', jeans:'Bottoms', loafers:'Shoes', sneakers:'Shoes', watch:'Extras',
  };
  const defaults = {
    decisions:{}, matches:['ava'], received:['ava','maya'], blocked:[], reports:[],
    messages:{ava:[{text:'Your farmers market answer won me over.', mine:true},{text:'Want to get dinner this week?'}]},
    filters:{min:18,max:99,distance:50},
    profile:{name:'Sam', age:32, work:'Architect', city:'Chicago', intent:'Long-term relationship', prompt:'A coffee walk is always a yes.', photos:[]},
    wardrobe:CLOSET.map((item, index) => ({id:String(index), name:item.t, icon:item.i, category:categoryByIcon[item.i]})),
    savedPlaces:[], plans:{},
  };
  const storageKey = 'eshveh.preview.v1';
  let state;
  try { state = {...defaults, ...JSON.parse(localStorage.getItem(storageKey) || '{}')}; }
  catch { state = structuredClone(defaults); }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); return true; }
    catch { return false; }
  }
  const person = key => PEOPLE.find(entry => entry.k === key);
  const dialog = el('editor');
  let edit;
  function field(name, label, value = '', options = {}) {
    const control = make(options.choices ? 'select' : options.multiline ? 'textarea' : 'input');
    control.name = name;
    if (options.choices) {
      options.choices.forEach(choice => control.append(make('option', choice)));
    } else if (!options.multiline) {
      control.type = options.type || 'text';
    }
    control.required = options.required ?? true;
    if (options.type === 'number') {
      control.min = options.min;
      control.max = options.max;
    } else if (options.type === 'file') {
      control.accept = 'image/jpeg,image/png,image/webp';
      control.multiple = options.multiple ?? false;
    } else if (!options.choices) control.maxLength = options.max || 240;
    if (options.type !== 'file') control.value = value;
    const row = make('label', label);
    row.append(control);
    return row;
  }
  function openEditor(title, fields, submit, label = 'Save') {
    el('editor-title').textContent = title;
    el('editor-fields').replaceChildren(...fields);
    el('editor-error').textContent = '';
    el('editor-save').textContent = label;
    edit = submit;
    dialog.showModal();
  }
  el('editor-cancel').onclick = () => dialog.close();
  el('editor-form').onsubmit = async event => {
    event.preventDefault();
    const submitButton = el('editor-save');
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    try {
      await edit(new FormData(event.currentTarget));
      dialog.close();
    } catch (error) { el('editor-error').textContent = error.message; }
    finally { submitButton.disabled = false; }
  };

  const status = el('discover-status');
  function showDiscover(preferred, message = '') {
    const {min,max,distance} = state.filters;
    const candidate = preferred || PEOPLE.find(p =>
      !state.decisions[p.k] && !state.blocked.includes(p.k) && p.age >= min && p.age <= max && p.mi <= distance
    );
    status.hidden = Boolean(candidate) && !message;
    status.textContent = message || (candidate ? '' : 'You’re caught up. Change your filters or reset the demo deck to see more profiles.');
    for (const id of ['like','pass','comment-like']) el(id).disabled = !candidate;
    if (!candidate) { cardWrap.replaceChildren(); return; }
    idx = PEOPLE.indexOf(candidate);
    photo = 0;
    renderCard();
  }
  el('discover-filters').onclick = () => {
    if (document.querySelector('.swipe-out')) return;
    const {min,max,distance} = state.filters;
    openEditor('Discover filters', [
      field('min','Minimum age',min,{type:'number',min:18,max:99}),
      field('max','Maximum age',max,{type:'number',min:18,max:99}),
      field('distance','Maximum distance (miles)',distance,{type:'number',min:1,max:250}),
      button('Reset demo deck', () => {
        state.decisions = {};
        state.filters = structuredClone(defaults.filters);
        save(); showDiscover(); renderProfile(); dialog.close();
      }),
    ], data => {
      const filters = Object.fromEntries(['min','max','distance'].map(key => [key, Number(data.get(key))]));
      if (filters.min > filters.max) throw Error('Minimum age must be at most the maximum age.');
      state.filters = filters;
      save(); showDiscover(); renderProfile();
    }, 'Apply filters');
  };
  let activeMatch = 'ava';
  function decide(p, liked, note = '', target = '') {
    state.decisions[p.k] = {liked,note,target};
    const incoming = state.received.includes(p.k);
    state.received = state.received.filter(key => key !== p.k);
    if (liked && incoming && !state.matches.includes(p.k)) state.matches.push(p.k);
    if (liked && incoming && note) messages(p.k).push({text:note,mine:true});
    save();
    showDiscover(undefined, liked ? (incoming ? `You matched with ${p.name}.` : `Like saved for ${p.name} in this demo.`) : '');
    renderLikes(); renderMatches();
    if (liked && incoming) {
      selectMatch(p.k);
      el('av-them').replaceChildren(profileImage(p));
      document.querySelector('[data-view="match"] p').textContent = `You and ${p.name} can message or pick a place.`;
      go('match');
    }
  }
  window.eshvehDecide = decide;
  el('comment-like').onclick = () => {
    const p = PEOPLE[idx % PEOPLE.length];
    const targets = [`Photo ${photo + 1}`, ...p.prompts.map(([prompt]) => prompt)];
    openEditor(`Like ${p.name}'s profile`, [
      field('target','Photo or prompt',targets[0],{choices:targets}),
      field('note','Your comment','',{multiline:true,required:false}),
    ], data => decide(p,true,String(data.get('note')).trim(),String(data.get('target'))), 'Send like');
  };
  function profileImage(p) {
    const img = make('img');
    img.src = `photos/${p.k}-1.jpg`;
    img.alt = '';
    return img;
  }
  function renderLikes() {
    const list = el('received-likes');
    list.replaceChildren();
    for (const key of state.received) {
      const p = person(key);
      const item = make('div', '', 'liked-profile');
      const view = button(`${p.name}, ${p.age} · ${p.city}`, () => { showDiscover(p); go('discover'); });
      item.append(profileImage(p),view,button('Like back',() => decide(p,true),'chip solid'),button('Pass',() => decide(p,false)));
      list.append(item);
    }
    if (!list.children.length) list.append(make('p','You’re caught up on sample likes.','muted'));
  }
  function messages(key = activeMatch) { return state.messages[key] ??= []; }
  function renderMatches() {
    const list = el('match-list');
    list.replaceChildren();
    for (const key of state.matches) {
      const p = person(key);
      const row = button('', () => { selectMatch(key); go('chat'); }, 'row');
      const avatar = make('span','','av-s');
      avatar.append(profileImage(p));
      const details = make('span');
      const last = messages(key).at(-1);
      details.append(make('b',p.name),make('p',last ? (last.mine ? 'You: ' : '') + last.text : 'Start the conversation'));
      row.append(avatar,details);
      list.append(row);
    }
    if (!list.children.length) list.append(make('p','New matches will appear here.','pad'));
  }
  function renderChat() {
    const p = person(activeMatch);
    const available = !!p && state.matches.includes(p.k);
    el('chat-name').textContent = available ? p.name : 'Messages';
    el('chat-details').textContent = available ? `${p.age} · ${p.mi} mi away` : '';
    el('chat-avatar').replaceChildren(...(available ? [profileImage(p)] : []));
    el('chat-form').hidden = el('match-options').hidden = !available;
    const bubbles = el('bubbles');
    bubbles.replaceChildren();
    if (available) {
      for (const {text,mine} of messages()) bubbles.append(make('div',text,`b ${mine ? 'me' : 'them'}`));
    }
    if (!bubbles.children.length) bubbles.append(make('p',available ? 'Say hello to start the conversation.' : 'Open a match to start chatting.','stamp'));
  }
  function selectMatch(key) {
    activeMatch = key;
    renderChat(); refreshPlan();
  }
  const normalize = value => String(value || '').trim();
  el('chat-form').onsubmit = event => {
    event.preventDefault();
    const text = normalize(el('msg').value);
    if (!text || !state.matches.includes(activeMatch)) return;
    messages().push({text,mine:true});
    save();
    el('msg').value = '';
    renderChat(); renderMatches();
    el('bubbles').lastElementChild.scrollIntoView({block:'nearest'});
  };
  el('match-options').onclick = () => {
    if (!state.matches.includes(activeMatch)) return;
    const p = person(activeMatch);
    openEditor(`Options for ${p.name}`,[
      field('action','Action','Unmatch',{choices:['Unmatch','Block','Report']}),
      field('reason','Details for a demo report','',{multiline:true,required:false}),
    ], data => {
      const action = data.get('action');
      if (action === 'Report') {
        const reason = normalize(data.get('reason'));
        if (!reason) throw Error('Add a reason for the report.');
        state.reports.push({key:p.k,reason});
        el('bubbles').append(make('p','Demo report saved on this device.','stamp'));
      } else {
        state.matches = state.matches.filter(key => key !== p.k);
        if (action === 'Block') {
          state.blocked.push(p.k);
          state.received = state.received.filter(key => key !== p.k);
        }
        activeMatch = state.matches[0] || '';
        renderMatches(); renderLikes(); showDiscover(); renderChat(); refreshPlan(); go('matches');
      }
      save();
    },'Confirm');
  };

  function refreshPlan() {
    const p = person(activeMatch);
    el('plan-person').textContent = p?.name || 'a match';
    el('send-plan').disabled = !p || !state.matches.includes(p.k);
    el('send-plan').textContent = p ? `Send ${SPOTS[chosen].name} to ${p.name}` : 'Choose a match to send a plan';
    el('save-place').textContent = state.savedPlaces.includes(chosen) ? 'Remove saved place' : 'Save place';
    el('saved-places').replaceChildren(...state.savedPlaces.map(idx => button(SPOTS[idx].name, () => {
      chosen = idx;
      renderSpots();
      refreshPlan();
    })));
    document.querySelectorAll('.spot .bar .them').forEach(bar => { bar.previousElementSibling.textContent = p?.name || 'Match'; });
    const map = document.querySelector('.mapbox svg');
    map.setAttribute('aria-label',`Sample map showing you, ${p?.name || 'your match'}, and three spots`);
    map.querySelectorAll('text').forEach(label => {
      if (label.getAttribute('x') === '276') label.textContent = p?.name || 'Match';
    });
    const legend = document.querySelector('.legend span');
    legend.textContent = `● You  ○ ${p?.name || 'Match'}`;
  }
  el('spots').addEventListener('click', refreshPlan);
  el('save-place').onclick = () => {
    const wasSaved = state.savedPlaces.includes(chosen);
    state.savedPlaces = wasSaved ? state.savedPlaces.filter(id => id !== chosen) : [...state.savedPlaces, chosen];
    save(); refreshPlan();
    el('place-status').textContent = wasSaved ? 'Removed from saved places.' : `Saved ${SPOTS[chosen].name}.`;
  };
  el('send-plan').onclick = () => {
    if (!state.matches.includes(activeMatch)) return;
    const custom = el('custom-date').value;
    const time = custom ? new Date(custom).toLocaleString() : when.querySelector('.solid').textContent;
    const spot = SPOTS[chosen].name;
    messages().push({mine:true,text:`Date proposal: ${spot} · ${time}`});
    state.plans[activeMatch] = {spot,time};
    save(); renderChat(); renderMatches(); go('chat');
  };

  async function photoData(file) {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 12_000_000) {
      throw Error('Choose a JPEG, PNG, or WebP image under 12 MB.');
    }
    const image = await createImageBitmap(file);
    try {
      const ratio = Math.min(1, 520 / Math.max(image.width,image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1,Math.round(image.width * ratio));
      canvas.height = Math.max(1,Math.round(image.height * ratio));
      const context = canvas.getContext('2d');
      context.drawImage(image,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/jpeg',0.76);
    } finally { image.close(); }
  }
  let category = 'All';
  const segment = document.querySelector('[data-view="closet"] .seg');
  function renderCloset() {
    segment.replaceChildren(...['All',...categories].map(value => button(value,() => {
      category = value;
      renderCloset();
    },value === category ? 'chip solid' : 'chip')));
    grid.querySelectorAll('.wardrobe-item').forEach(item => item.remove());
    for (const item of state.wardrobe.filter(item => category === 'All' || category === item.category)) {
      const tile = button('', () => editItem(item),'tile wardrobe-item');
      tile.setAttribute('aria-label',`Edit ${item.name}`);
      if (item.photo) {
        const img = make('img');
        img.src = item.photo;
        img.alt = '';
        tile.append(img);
      } else {
        tile.innerHTML = `<svg viewBox="0 0 24 24">${ICON[item.icon] || ICON.shirt}</svg>`;
      }
      tile.append(make('span',item.name,'tag'));
      grid.append(tile);
    }
    el('count').textContent = `${state.wardrobe.length} pieces`;
  }
  function editItem(item, newPhoto) {
    const existing = !!item;
    const fields = [
      field('name','Item name',item?.name || ''),
      field('category','Category',item?.category || 'Tops',{choices:categories}),
      field('photo','Replace photo','',{type:'file',required:false}),
    ];
    if (existing) fields.push(button('Remove item', () => {
      if (!confirm(`Remove ${item.name} from the demo closet?`)) return;
      state.wardrobe = state.wardrobe.filter(entry => entry.id !== item.id);
      save(); renderCloset(); dialog.close();
    }));
    openEditor(existing ? 'Edit closet item' : 'Add a closet item',fields,async data => {
      const name = normalize(data.get('name'));
      if (!name) throw Error('Enter an item name.');
      const file = data.get('photo');
      const photo = file?.size ? await photoData(file) : newPhoto || item?.photo;
      const updated = {id:item?.id || crypto.randomUUID(),name,category:data.get('category'),photo,icon:item?.icon};
      const previous = state.wardrobe;
      state.wardrobe = existing ? previous.map(entry => entry.id === item.id ? updated : entry) : [...previous,updated];
      if (!save()) { state.wardrobe = previous; throw Error('Device storage is full. Remove an uploaded photo and try again.'); }
      category = 'All';
      renderCloset();
    });
  }
  el('upload').onchange = async event => {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try { editItem(null,await photoData(file)); }
    catch (error) { alert(error.message); }
  };
  const baseRenderLook = renderLook;
  renderLook = function () {
    baseRenderLook();
    const look = el('look');
    const pieces = look.querySelector('.pieces');
    pieces.replaceChildren();
    for (const category of categories) {
      const options = state.wardrobe.filter(item => item.category === category);
      if (!options.length) continue;
      const item = options[lk % options.length];
      const node = make('span',item.name,'chip');
      pieces.append(node);
    }
    if (!pieces.children.length) pieces.append(make('p','Add clothes to your closet to build an outfit.'));
    look.querySelector('p').textContent = 'Demo outfit assembled from your saved closet.';
  };
  document.querySelector('[data-view="closet"] [data-go="looks"]').addEventListener('click', () => {
    renderLook();
  });

  function renderProfile() {
    const user = state.profile;
    el('account-name').textContent = `${user.name}, ${user.age}`;
    el('profile-details').textContent = [user.work,user.city].filter(Boolean).join(' · ');
    const info = el('profile-info');
    info.replaceChildren();
    for (const [title,value] of [['Looking for',user.intent],['My prompt',user.prompt],['Discover radius',`${state.filters.distance} mi`]]) {
      const row = make('div');
      row.append(make('span',title),make('span',value));
      info.append(row);
    }
    const gallery = el('profile-photos');
    gallery.replaceChildren();
    user.photos.forEach((src,index) => {
      const tile = make('div');
      const photo = make('img');
      photo.src = src;
      photo.alt = `Profile photo ${index + 1}`;
      tile.append(photo,button('Remove',() => {
        state.profile.photos.splice(index,1);
        save(); renderProfile();
      }));
      gallery.append(tile);
    });
  }
  el('edit-profile').onclick = () => {
    const user = state.profile;
    openEditor('Edit profile',[
      field('name','Display name',user.name),
      field('age','Age',user.age,{type:'number',min:18,max:99}),
      field('work','Work',user.work,{required:false}),
      field('city','City',user.city,{required:false}),
      field('intent','Relationship goal',user.intent),
      field('prompt','Profile prompt answer',user.prompt,{multiline:true}),
      field('photos','Add photos (up to six total)','',{type:'file',required:false,multiple:true}),
    ],async data => {
      const photos = data.getAll('photos').filter(file => file.size);
      if (user.photos.length + photos.length > 6) throw Error('A profile can have up to six photos.');
      const name = normalize(data.get('name'));
      if (!name) throw Error('Enter a display name.');
      const uploaded = await Promise.all(photos.map(photoData));
      const updated = {...user,name,age:Number(data.get('age')),photos:[...user.photos,...uploaded]};
      for (const key of ['work','city','intent','prompt']) updated[key] = normalize(data.get(key));
      state.profile = updated;
      if (!save()) { state.profile = user; throw Error('Device storage is full. Remove a photo and try again.'); }
      renderProfile();
    });
  };

  activeMatch = state.matches[0] || '';
  showDiscover(); renderLikes(); renderMatches(); renderChat(); refreshPlan(); renderCloset(); renderProfile();
})();
