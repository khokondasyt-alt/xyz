/* Simple frontend-only app using localStorage to simulate:
   - register/login
   - admin approval for models
   - model profile (photo, charge, timeslots, online toggle)
   - user sees online models and can "pay" mock to start call/chat/gift
   - admin panel to approve models
*/

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const LS_KEY = 'ofs_users_v1'; // stores users array
const ADMIN_CREDENTIALS = {user:'admin', pass:'admin123'}; // change as needed

function loadUsers(){
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)||'[]');
  } catch(e) { return []; }
}
function saveUsers(users){ localStorage.setItem(LS_KEY, JSON.stringify(users)); }

function findUserByMobile(mobile){ return loadUsers().find(u=>u.mobile===mobile); }
function updateUser(u){
  const users = loadUsers();
  const idx = users.findIndex(x=>x.mobile===u.mobile);
  if(idx>=0) users[idx]=u; else users.push(u);
  saveUsers(users);
}

// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', ()=> {
  // Forms
  $('#registerForm').addEventListener('submit', onRegister);
  $('#loginForm').addEventListener('submit', onLogin);
  $('#adminLoginForm').addEventListener('submit', onAdminLogin);
  $('#logoutBtn').addEventListener('click', logout);
  $('#saveProfile').addEventListener('click', onSaveProfile);
  $('#modelPhoto').addEventListener('change', onPhotoChange);
  $('#closeModal').addEventListener('click', closeModal);

  renderInitial();
});

// ---------- Auth Handlers ----------
function onRegister(e){
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const mobile = form.mobile.value.trim();
  const password = form.password.value;
  const gender = form.gender.value;

  if(findUserByMobile(mobile)){
    alert('এই নম্বরে আগে থেকে রেজিস্ট্রেশন আছে।');
    return;
  }

  const user = {
    name, mobile, password, gender,
    role: gender === 'female' ? 'model_pending' : 'user',
    modelData: null, // for model profile: {photoDataURL, charge, timeslots, online}
    gifts: 0
  };

  const users = loadUsers();
  users.push(user);
  saveUsers(users);
  alert('রেজিস্ট্রেশন সম্পন্ন। মডেল হলে অ্যাডমিন অনুমোদনের অপেক্ষা করুন।');
  form.reset();
}

function onLogin(e){
  e.preventDefault();
  const mobile = e.target.mobile.value.trim();
  const pass = e.target.password.value;
  const u = findUserByMobile(mobile);
  if(!u || u.password !== pass){
    alert('লগইন ব্যর্থ — ভুল নম্বর/পাসওয়ার্ড।');
    return;
  }
  // save session
  sessionSetUser(u.mobile);
  showAppFor(u);
}

function onAdminLogin(e){
  e.preventDefault();
  const u = e.target.adminUser.value.trim();
  const p = e.target.adminPass.value;
  if(u===ADMIN_CREDENTIALS.user && p===ADMIN_CREDENTIALS.pass){
    sessionSetAdmin();
    showAdminPanel();
  } else alert('Admin credentials ভুল।');
}

function logout(){
  sessionClear();
  location.reload();
}

// ---------- Session helpers ----------
function sessionSetUser(mobile){ sessionStorage.setItem('ofs_session', JSON.stringify({type:'user', mobile})); }
function sessionSetAdmin(){ sessionStorage.setItem('ofs_session', JSON.stringify({type:'admin'})); }
function sessionGet(){ return JSON.parse(sessionStorage.getItem('ofs_session')||'null'); }
function sessionClear(){ sessionStorage.removeItem('ofs_session'); }

// ---------- Render initial -->
function renderInitial(){
  // If session exists, show app accordingly
  const s = sessionGet();
  if(!s) return;
  if(s.type==='user'){ const u = findUserByMobile(s.mobile); if(u) showAppFor(u); }
  if(s.type==='admin') showAdminPanel();
}

// ---------- Show app for user/model ----------
function showAppFor(u){
  $('#appArea').classList.remove('hidden');
  $('#welcomeText').innerText = `Hello, ${u.name} (${u.role})`;

  // hide all dashboards first
  hideAllDashboards();

  if(u.role === 'user' || u.role === 'model' || u.role === 'model_pending'){
    // If model_pending, show message and normal user can't be model
    if(u.role === 'user'){
      $('#userDashboard').classList.remove('hidden');
      renderModelsList();
    } else if(u.role === 'model_pending'){
      // model awaiting approval -> show basic user dashboard but not in model list
      $('#userDashboard').classList.remove('hidden');
      renderModelsList();
      alert('আপনি মডেল হিসেবে রেজিস্ট্রেশন করেছেন; অ্যাডমিন অনুমোদনের অপেক্ষা করুন।');
    } else if(u.role === 'model'){
      // show model dashboard
      $('#modelDashboard').classList.remove('hidden');
      renderModelProfile(u);
    }
  }
}

// hide dashboard sections
function hideAllDashboards(){
  $('#userDashboard').classList.add('hidden');
  $('#modelDashboard').classList.add('hidden');
  $('#adminDashboard').classList.add('hidden');
}

// ---------- Admin panel ----------
function showAdminPanel(){
  $('#appArea').classList.remove('hidden');
  hideAllDashboards();
  $('#adminDashboard').classList.remove('hidden');
  $('#welcomeText').innerText = `Admin Panel`;
  renderPendingModels();
  renderAllModels();
}

function renderPendingModels(){
  const users = loadUsers();
  const pending = users.filter(u=>u.role==='model_pending');
  const el = $('#pendingList');
  el.innerHTML = '';
  if(pending.length===0) el.innerHTML = '<i>কোনো মডেল অনিরীক্ষিত নেই</i>';
  pending.forEach(u=>{
    const div = document.createElement('div'); div.className='model-card';
    div.innerHTML = `
      <div style="flex:1">
        <strong>${u.name}</strong><br/><small>${u.mobile}</small><br/>
        <small>Model awaiting approval</small>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn" data-act="approve" data-mobile="${u.mobile}">Approve</button>
        <button class="btn alt" data-act="reject" data-mobile="${u.mobile}">Reject</button>
      </div>
    `;
    el.appendChild(div);
  });

  el.querySelectorAll('button').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const act = ev.target.dataset.act;
      const mobile = ev.target.dataset.mobile;
      if(act==='approve'){
        const users = loadUsers();
        const x = users.find(it=>it.mobile===mobile);
        if(x){ x.role='model'; saveUsers(users); alert('Model approved'); renderPendingModels(); renderAllModels(); }
      } else {
        if(confirm('Reject & delete this registration?')){
          let users = loadUsers();
          users = users.filter(it=>it.mobile!==mobile);
          saveUsers(users);
          alert('Deleted.');
          renderPendingModels(); renderAllModels();
        }
      }
    });
  });
}

function renderAllModels(){
  const users = loadUsers().filter(u=>u.gender==='female');
  const el = $('#allModelsList'); el.innerHTML='';
  if(users.length===0) el.innerHTML='<i>No models yet</i>';
  users.forEach(u=>{
    const v = document.createElement('div'); v.className='model-card';
    const photo = u.modelData && u.modelData.photoDataURL ? `<img src="${u.modelData.photoDataURL}" />` : `<div style="width:64px;height:64px;background:rgba(255,255,255,0.03);border-radius:8px;display:flex;align-items:center;justify-content:center">No</div>`;
    v.innerHTML = `${photo}
      <div class="model-info">
        <strong>${u.name}</strong><br/><small>${u.mobile}</small><br/>
        <small>Role: ${u.role}</small>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn" data-mobile="${u.mobile}" data-act="view">View</button>
      </div>
    `;
    el.appendChild(v);
  });

  el.querySelectorAll('button[data-act="view"]').forEach(b=>{
    b.addEventListener('click', (ev)=>{
      const mobile = ev.target.dataset.mobile;
      const u = findUserByMobile(mobile);
      showAdminViewModel(u);
    });
  });
}

function showAdminViewModel(u){
  openModal(`<h3>${u.name} (${u.mobile})</h3>
    <div style="display:flex;gap:12px;align-items:center">
      ${u.modelData && u.modelData.photoDataURL ? `<img src="${u.modelData.photoDataURL}" style="width:140px;height:140px;object-fit:cover;border-radius:8px"/>` : '<div style="width:140px;height:140px;background:#222;border-radius:8px;display:flex;align-items:center;justify-content:center">No Photo</div>'}
      <div>
        <p>Charge: ${u.modelData? u.modelData.charge : 'N/A' } per min</p>
        <p>Timeslots: ${u.modelData? (u.modelData.timeslots||'N/A') : 'N/A'}</p>
        <p>Online: ${u.modelData && u.modelData.online ? 'Yes' : 'No'}</p>
      </div>
    </div>
    <div style="margin-top:12px">
      <button class="btn" id="forceToggle">${u.modelData && u.modelData.online ? 'Force Offline' : 'Force Online'}</button>
      <button class="btn alt" id="deleteUser">Delete</button>
    </div>
  `);

  $('#forceToggle').addEventListener('click', ()=>{
    u.modelData = u.modelData||{};
    u.modelData.online = !u.modelData.online;
    updateUser(u);
    alert('Toggled online state');
    renderAllModels();
    renderPendingModels();
    closeModal();
  });

  $('#deleteUser').addEventListener('click', ()=>{
    if(confirm('Delete this user?')){
      let users = loadUsers();
      users = users.filter(x=>x.mobile!==u.mobile);
      saveUsers(users);
      alert('Deleted');
      closeModal();
      renderAllModels();
      renderPendingModels();
    }
  });
}

// ---------- Models list for users ----------
function renderModelsList(){
  const list = $('#modelsList');
  list.innerHTML = '';
  const users = loadUsers().filter(u=>u.role==='model' && u.modelData && u.modelData.online);
  if(users.length===0){ list.innerHTML = '<i>No models online right now</i>'; return; }
  users.forEach(m=>{
    const div = document.createElement('div'); div.className='model-card';
    const img = m.modelData.photoDataURL ? `<img src="${m.modelData.photoDataURL}" />` : `<div style="width:64px;height:64px;background:rgba(255,255,255,0.03);border-radius:8px;display:flex;align-items:center;justify-content:center">No</div>`;
    div.innerHTML = `
      ${img}
      <div class="model-info">
        <strong>${m.name}</strong><br/>
        <small>Charge: ${m.modelData.charge} / min</small>
      </div>
      <div class="model-actions">
        <button class="btn" data-act="paycall" data-mobile="${m.mobile}">Pay & Call</button>
        <button class="btn alt" data-act="chat" data-mobile="${m.mobile}">Chat</button>
        <button class="btn alt" data-act="gift" data-mobile="${m.mobile}">Send Gift</button>
      </div>
    `;
    list.appendChild(div);
  });

  // attach events
  list.querySelectorAll('button').forEach(b=>{
    const act = b.dataset.act, mobile=b.dataset.mobile;
    b.addEventListener('click', ()=> {
      const u = findUserByMobile(mobile);
      if(act==='paycall') simulatePaymentAndCall(u);
      if(act==='chat') openChatWith(u);
      if(act==='gift') sendGiftTo(u);
    });
  });
}

// ---------- Model profile editing ----------
function renderModelProfile(u){
  // populate fields
  if(u.modelData){
    if(u.modelData.charge) $('#callCharge').value = u.modelData.charge;
    if(u.modelData.timeslots) $('#timeSlots').value = u.modelData.timeslots;
    $('#onlineToggle').checked = !!(u.modelData && u.modelData.online);
    if(u.modelData.photoDataURL){
      $('#modelPreview').innerHTML = `<img src="${u.modelData.photoDataURL}" alt="preview"/>`;
    } else {
      $('#modelPreview').innerHTML = '<div style="color:#ddd">No photo yet</div>';
    }
  } else {
    $('#modelPreview').innerHTML = '<div style="color:#ddd">No profile yet</div>';
  }
}

function onPhotoChange(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    // store temporarily in session for saveProfile step
    sessionStorage.setItem('ofs_tmp_photo', reader.result);
    $('#modelPreview').innerHTML = `<img src="${reader.result}" alt="preview"/>`;
  };
  reader.readAsDataURL(f);
}

function onSaveProfile(e){
  e.preventDefault();
  const s = sessionGet();
  if(!s || !s.mobile) return alert('Not logged in');
  const u = findUserByMobile(s.mobile);
  if(!u) return alert('User not found');
  const charge = Number($('#callCharge').value) || 10;
  const timeslots = $('#timeSlots').value.trim();
  const photo = sessionStorage.getItem('ofs_tmp_photo') || (u.modelData && u.modelData.photoDataURL) || null;
  u.modelData = {
    photoDataURL: photo,
    charge,
    timeslots,
    online: !!$('#onlineToggle').checked
  };
  updateUser(u);
  alert('Profile saved');
  renderModelProfile(u);
  renderModelsList();
  sessionStorage.removeItem('ofs_tmp_photo');
}

// ---------- Payment / Call simulation ----------
function simulatePaymentAndCall(modelUser){
  // In this mock, payment is a simple confirm; we enforce "call limit" by asking minutes and checking >0
  const minutes = Number(prompt(`Call ${modelUser.name} - Enter minutes to pay for (max 120):`, '5'));
  if(!minutes || minutes<=0) return;
  if(minutes>120) return alert('Max 120 minutes allowed (mock).');

  // show call modal with countdown
  openModal(`<h3>Calling ${modelUser.name}</h3>
    <p>Duration: ${minutes} min (mock). Charge: ${modelUser.modelData.charge * minutes} units</p>
    <div id="callTimer">Call active: ${minutes}:00</div>
    <div style="margin-top:12px"><button class="btn" id="endCallBtn">End Call</button></div>
  `);

  let secs = minutes*60;
  const timerEl = $('#callTimer');
  const tInt = setInterval(()=>{
    secs--;
    const mm = Math.floor(secs/60).toString().padStart(2,'0');
    const ss = (secs%60).toString().padStart(2,'0');
    timerEl.innerText = `Call active: ${mm}:${ss}`;
    if(secs<=0){ clearInterval(tInt); timerEl.innerText = 'Call ended.'; }
  },1000);

  $('#endCallBtn').addEventListener('click', ()=>{
    clearInterval(tInt); closeModal();
    alert('Call ended (mock).');
  });
}

function openChatWith(modelUser){
  openModal(`
    <h3>Chat with ${modelUser.name}</h3>
    <div id="chatBox" style="height:220px;overflow:auto;padding:8px;border:1px solid rgba(255,255,255,0.04);background:rgba(0,0,0,0.15)"></div>
    <div style="display:flex;gap:8px;margin-top:8px">
      <input id="chatMsg" placeholder="Type message..." style="flex:1;padding:8px;border-radius:8px;border:none;background:rgba(255,255,255,0.06);color:#fff"/>
      <button class="btn" id="sendChat">Send</button>
    </div>
  `);
  $('#sendChat').addEventListener('click', ()=>{
    const txt = $('#chatMsg').value.trim(); if(!txt) return;
    const cb = $('#chatBox');
    const me = document.createElement('div'); me.style.margin='6px'; me.innerHTML = `<div style="background:rgba(255,255,255,0.06);padding:8px;border-radius:8px;max-width:80%">${txt}</div>`;
    cb.appendChild(me); cb.scrollTop = cb.scrollHeight; $('#chatMsg').value='';
  });
}

function sendGiftTo(modelUser){
  const amt = Number(prompt('Enter gift amount (units):', '10'));
  if(!amt || amt<=0) return;
  // increment model's gifts counter
  modelUser.gifts = (modelUser.gifts||0) + amt;
  updateUser(modelUser);
  alert(`Gift sent (${amt}). Model total gifts: ${modelUser.gifts}`);
  renderModelsList();
}

// ---------- modal ----------
function openModal(html){
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
}
function closeModal(){ $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }

// ---------- utility to view admin actions etc on session startup ----------
