 /* ==========================================================================
   GITHUB Event Registration Portal
   All data persists in the browser via localStorage (this is a static
   front-end demo with no server, so "permanent" storage = this browser/
   device's localStorage — see the note in the chat reply for how to wire
   up a real backend later).
   ========================================================================== */

/* ---------- CONFIG: fill these in with your own EmailJS account ---------- */
const EMAILJS_PUBLIC_KEY  = "YOUR_EMAILJS_PUBLIC_KEY";
const EMAILJS_SERVICE_ID  = "YOUR_EMAILJS_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_EMAILJS_TEMPLATE_ID";
const ORGANIZER_EMAIL     = "gteddi@student.gitam.edu";

const ADMIN_USER_PATTERN = /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/i;
const ADMIN_PASSWORD = "Gitam$$456";

if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_EMAILJS_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

/* ---------------------------- storage helpers ---------------------------- */
const store = {
  getEvents(){ return JSON.parse(localStorage.getItem("gep_events") || "[]"); },
  saveEvents(list){ localStorage.setItem("gep_events", JSON.stringify(list)); },
  getRegs(){ return JSON.parse(localStorage.getItem("gep_registrations") || "{}"); },
  saveRegs(obj){ localStorage.setItem("gep_registrations", JSON.stringify(obj)); }
};

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function fmtDate(d){
  if(!d) return "";
  const dt = new Date(d+"T00:00:00");
  return dt.toLocaleDateString(undefined,{ year:"numeric", month:"short", day:"numeric" });
}
function fileToDataURL(file){
  return new Promise((resolve,reject)=>{
    if(!file){ resolve(null); return; }
    const r = new FileReader();
    r.onload = ()=>resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/* ------------------------------- navigation ------------------------------ */
const pages = document.querySelectorAll(".page");
const navButtons = document.querySelectorAll(".nav-btn");

function showPage(id){
  pages.forEach(p=>p.classList.toggle("active", p.id === "page-"+id));
  navButtons.forEach(b=>b.classList.toggle("active", b.dataset.page === id));
  document.getElementById("navlinks").classList.remove("open");
  if(id === "admin-login" && sessionStorage.getItem("gep_admin") === "yes"){
    renderAdminPanel();
    pages.forEach(p=>p.classList.toggle("active", p.id === "page-admin-panel"));
  }
  if(id === "dashboard") renderDashboard();
  if(id === "events-info") renderEventsInfo();
  if(id === "registration") renderRegistrationSelect();
}

navButtons.forEach(btn=>{
  btn.addEventListener("click", ()=> showPage(btn.dataset.page));
});
document.getElementById("hamburger").addEventListener("click", ()=>{
  document.getElementById("navlinks").classList.toggle("open");
});

/* ------------------------------- dashboard -------------------------------- */
function renderDashboard(){
  const events = store.getEvents();
  const regs = store.getRegs();
  document.getElementById("statTotalEvents").textContent = events.length;
  document.getElementById("statLiveEvents").textContent = events.filter(e=>e.status==="live").length;
  document.getElementById("statClosedEvents").textContent = events.filter(e=>e.status==="closed").length;
  const totalRegs = Object.values(regs).reduce((sum,arr)=>sum+arr.length,0);
  document.getElementById("statTotalRegs").textContent = totalRegs;

  const list = document.getElementById("dashboardEventList");
  list.innerHTML = "";
  if(events.length === 0){
    list.innerHTML = `<p class="empty-note">No events yet — an admin needs to add one from the Admin Login panel.</p>`;
    return;
  }
  events.slice().sort((a,b)=> (a.date||"").localeCompare(b.date||"")).forEach(ev=>{
    const row = document.createElement("div");
    row.className = "commit-row " + (ev.status === "closed" ? "closed" : "");
    row.innerHTML = `
      <div class="commit-dot"></div>
      <div class="commit-title">${escapeHtml(ev.name)} <span class="badge ${ev.status}">${ev.status}</span></div>
      <div class="commit-meta">${fmtDate(ev.date)} · ${ev.startTime||""}–${ev.endTime||""} · ${escapeHtml(ev.location||"")}</div>
    `;
    list.appendChild(row);
  });
}

/* ----------------------------- events info -------------------------------- */
function renderEventsInfo(){
  const events = store.getEvents();
  const grid = document.getElementById("eventsInfoGrid");
  grid.innerHTML = "";
  if(events.length === 0){
    grid.innerHTML = `<p class="empty-note">No events published yet.</p>`;
    return;
  }
  events.forEach(ev=>{
    const card = document.createElement("div");
    card.className = "event-card";
    card.innerHTML = `
      ${ev.image ? `<img src="${ev.image}" alt="${escapeHtml(ev.name)}">` : ""}
      <div class="event-card-body">
        <h3>${escapeHtml(ev.name)} <span class="badge ${ev.status}">${ev.status}</span></h3>
        <span class="mono-small">${fmtDate(ev.date)} · ${ev.startTime||""}–${ev.endTime||""}</span>
        <span class="mono-small">📍 ${escapeHtml(ev.location||"")}</span>
        ${ev.docName ? `<a class="doc-link" href="${ev.doc}" download="${escapeHtml(ev.docName)}">📎 ${escapeHtml(ev.docName)}</a>` : ""}
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ---------------------------- registration page ---------------------------- */
function renderRegistrationSelect(){
  const events = store.getEvents().filter(e=>e.status==="live");
  const sel = document.getElementById("regEventSelect");
  sel.innerHTML = `<option value="">-- choose an event --</option>` +
    events.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${fmtDate(e.date)}</option>`).join("");
  document.getElementById("registrationForm").classList.add("hidden");
  document.getElementById("qrResult").classList.add("hidden");
}

document.getElementById("regEventSelect").addEventListener("change", (e)=>{
  const form = document.getElementById("registrationForm");
  form.classList.toggle("hidden", !e.target.value);
  document.getElementById("qrResult").classList.add("hidden");
});

document.getElementById("registrationForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const eventId = document.getElementById("regEventSelect").value;
  const events = store.getEvents();
  const ev = events.find(x=>x.id===eventId);
  if(!ev){ return; }

  const reg = {
    id: uid(),
    name: document.getElementById("regName").value.trim(),
    email: document.getElementById("regEmail").value.trim(),
    branch: document.getElementById("regBranch").value.trim(),
    year: document.getElementById("regYear").value,
    rollNo: document.getElementById("regRoll").value.trim(),
    checkedIn: false,
    registeredAt: new Date().toISOString()
  };

  const regs = store.getRegs();
  regs[eventId] = regs[eventId] || [];
  const dup = regs[eventId].find(r=>r.rollNo.toLowerCase() === reg.rollNo.toLowerCase());
  const msg = document.getElementById("regFormMsg");
  if(dup){
    msg.textContent = "This registration number has already registered for this event.";
    msg.className = "form-msg error";
    return;
  }
  regs[eventId].push(reg);
  store.saveRegs(regs);

  msg.textContent = "";
  document.getElementById("registrationForm").classList.add("hidden");
  document.getElementById("registrationForm").reset();

  const qrBox = document.getElementById("qrCodeBox");
  qrBox.innerHTML = "";
  const qrData = `${eventId}::${reg.rollNo}`;
  new QRCode(qrBox, { text: qrData, width: 180, height: 180 });

  document.getElementById("qrRegInfo").innerHTML =
    `${escapeHtml(reg.name)} · ${escapeHtml(reg.rollNo)}<br>${escapeHtml(ev.name)}`;
  document.getElementById("qrResult").classList.remove("hidden");
});

document.getElementById("registerAnotherBtn").addEventListener("click", renderRegistrationSelect);

/* ----------------------------- admin login -------------------------------- */
document.getElementById("adminLoginForm").addEventListener("submit", (e)=>{
  e.preventDefault();
  const user = document.getElementById("adminUser").value.trim();
  const pass = document.getElementById("adminPass").value;
  const msg = document.getElementById("adminLoginMsg");

  if(ADMIN_USER_PATTERN.test(user) && pass === ADMIN_PASSWORD){
    sessionStorage.setItem("gep_admin","yes");
    msg.textContent = "";
    document.getElementById("adminLoginForm").reset();
    renderAdminPanel();
    pages.forEach(p=>p.classList.toggle("active", p.id === "page-admin-panel"));
    navButtons.forEach(b=>b.classList.toggle("active", b.dataset.page === "admin-login"));
  } else {
    msg.textContent = "Invalid credentials. Use a @student.gitam.edu address and the correct password.";
    msg.className = "form-msg error";
  }
});

document.getElementById("logoutBtn").addEventListener("click", ()=>{
  sessionStorage.removeItem("gep_admin");
  showPage("dashboard");
});

/* ------------------------------ admin panel -------------------------------- */
function renderAdminPanel(){
  renderAdminEventList();
  renderCheckinEventSelect();
}

/* --- admin tabs --- */
document.querySelectorAll(".admin-tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.querySelectorAll(".admin-tab-btn").forEach(b=>b.classList.remove("active"));
    document.querySelectorAll(".admin-tab-panel").forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-"+btn.dataset.tab).classList.add("active");
  });
});

/* --- image previews --- */
document.getElementById("eventImage").addEventListener("change", async (e)=>{
  const url = await fileToDataURL(e.target.files[0]);
  const img = document.getElementById("eventImagePreview");
  if(url){ img.src = url; img.classList.remove("hidden"); }
});
document.getElementById("eventDoc").addEventListener("change", (e)=>{
  document.getElementById("eventDocName").textContent = e.target.files[0] ? e.target.files[0].name : "";
});

/* --- add / edit event form --- */
const eventForm = document.getElementById("eventForm");
eventForm.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const id = document.getElementById("eventId").value || uid();
  const events = store.getEvents();
  const existing = events.find(x=>x.id===id);

  const imageFile = document.getElementById("eventImage").files[0];
  const docFile = document.getElementById("eventDoc").files[0];
  const imageData = imageFile ? await fileToDataURL(imageFile) : (existing ? existing.image : null);
  const docData = docFile ? await fileToDataURL(docFile) : (existing ? existing.doc : null);
  const docName = docFile ? docFile.name : (existing ? existing.docName : null);

  const eventObj = {
    id,
    name: document.getElementById("eventName").value.trim(),
    image: imageData,
    date: document.getElementById("eventDate").value,
    startTime: document.getElementById("eventStart").value,
    endTime: document.getElementById("eventEnd").value,
    location: document.getElementById("eventLocation").value.trim(),
    doc: docData,
    docName: docName,
    status: document.getElementById("eventStatus").value
  };

  if(existing){
    Object.assign(existing, eventObj);
  } else {
    events.push(eventObj);
  }
  store.saveEvents(events);

  const msg = document.getElementById("eventFormMsg");
  msg.textContent = existing ? "Event updated." : "Event added.";
  msg.className = "form-msg success";
  resetEventForm();
  renderAdminEventList();
  renderCheckinEventSelect();
  setTimeout(()=>{ msg.textContent=""; }, 2500);
});

function resetEventForm(){
  eventForm.reset();
  document.getElementById("eventId").value = "";
  document.getElementById("eventImagePreview").classList.add("hidden");
  document.getElementById("eventDocName").textContent = "";
  document.getElementById("eventFormSubmitBtn").textContent = "Add event";
  document.getElementById("cancelEditBtn").classList.add("hidden");
}
document.getElementById("cancelEditBtn").addEventListener("click", resetEventForm);

function renderAdminEventList(){
  const events = store.getEvents();
  const wrap = document.getElementById("adminEventList");
  wrap.innerHTML = "";
  if(events.length === 0){
    wrap.innerHTML = `<p class="empty-note">No events added yet.</p>`;
    return;
  }
  events.forEach(ev=>{
    const row = document.createElement("div");
    row.className = "admin-event-row";
    row.innerHTML = `
      ${ev.image ? `<img src="${ev.image}">` : `<div style="width:56px;height:44px;"></div>`}
      <div class="aer-info">
        <h4>${escapeHtml(ev.name)} <span class="badge ${ev.status}">${ev.status}</span></h4>
        <span>${fmtDate(ev.date)} · ${ev.startTime||""}–${ev.endTime||""} · ${escapeHtml(ev.location||"")}</span>
      </div>
      <div class="aer-actions">
        <button data-action="edit" data-id="${ev.id}">Edit</button>
        <button data-action="toggle" data-id="${ev.id}">${ev.status==="live"?"Close":"Reopen"}</button>
        <button data-action="delete" data-id="${ev.id}" class="danger">Delete</button>
      </div>
    `;
    wrap.appendChild(row);
  });

  wrap.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.dataset.id;
      const events = store.getEvents();
      const ev = events.find(x=>x.id===id);
      if(!ev) return;

      if(btn.dataset.action === "edit"){
        document.getElementById("eventId").value = ev.id;
        document.getElementById("eventName").value = ev.name;
        document.getElementById("eventDate").value = ev.date;
        document.getElementById("eventStart").value = ev.startTime;
        document.getElementById("eventEnd").value = ev.endTime;
        document.getElementById("eventLocation").value = ev.location;
        document.getElementById("eventStatus").value = ev.status;
        document.getElementById("eventDocName").textContent = ev.docName || "";
        const img = document.getElementById("eventImagePreview");
        if(ev.image){ img.src = ev.image; img.classList.remove("hidden"); } else img.classList.add("hidden");
        document.getElementById("eventFormSubmitBtn").textContent = "Save changes";
        document.getElementById("cancelEditBtn").classList.remove("hidden");
        window.scrollTo({top: eventForm.offsetTop - 100, behavior:"smooth"});
      }

      if(btn.dataset.action === "toggle"){
        ev.status = ev.status === "live" ? "closed" : "live";
        store.saveEvents(events);
        renderAdminEventList();
      }

      if(btn.dataset.action === "delete"){
        if(!confirm(`Delete "${ev.name}"? This also removes its registrations.`)) return;
        const remaining = events.filter(x=>x.id!==id);
        store.saveEvents(remaining);
        const regs = store.getRegs();
        delete regs[id];
        store.saveRegs(regs);
        renderAdminEventList();
        renderCheckinEventSelect();
      }
    });
  });
}

/* ------------------------- check-in & mail tab ------------------------- */
function renderCheckinEventSelect(){
  const events = store.getEvents();
  const sel = document.getElementById("checkinEventSelect");
  sel.innerHTML = `<option value="">-- choose an event --</option>` +
    events.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${fmtDate(e.date)}</option>`).join("");
  document.getElementById("checkinArea").classList.add("hidden");
}

document.getElementById("checkinEventSelect").addEventListener("change", (e)=>{
  document.getElementById("checkinArea").classList.toggle("hidden", !e.target.value);
  renderRegTable();
});

function currentCheckinEventId(){
  return document.getElementById("checkinEventSelect").value;
}

function renderRegTable(){
  const eventId = currentCheckinEventId();
  const regs = store.getRegs()[eventId] || [];
  const tbody = document.getElementById("regTableBody");
  tbody.innerHTML = "";
  if(regs.length === 0){
    tbody.innerHTML = `<tr><td colspan="6" class="empty-note">No registrations yet for this event.</td></tr>`;
    return;
  }
  regs.forEach(r=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(r.name)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.branch)}</td>
      <td>${escapeHtml(r.year)}</td>
      <td>${escapeHtml(r.rollNo)}</td>
      <td class="${r.checkedIn?'checked-yes':'checked-no'}">${r.checkedIn?'✔ Checked in':'—'}</td>
    `;
    tbody.appendChild(tr);
  });
}

function checkInByRoll(rollNo){
  const eventId = currentCheckinEventId();
  if(!eventId) return { ok:false, message:"Select an event first." };
  const regs = store.getRegs();
  const list = regs[eventId] || [];
  const match = list.find(r=>r.rollNo.toLowerCase() === rollNo.trim().toLowerCase());
  if(!match) return { ok:false, message:"No registration found with that number for this event." };
  if(match.checkedIn) return { ok:false, message:`${match.name} is already checked in.` };
  match.checkedIn = true;
  store.saveRegs(regs);
  renderRegTable();
  return { ok:true, message:`Checked in: ${match.name} (${match.rollNo}).` };
}

document.getElementById("checkinRollBtn").addEventListener("click", ()=>{
  const input = document.getElementById("checkinRollInput");
  const res = checkInByRoll(input.value);
  alert(res.message);
  if(res.ok) input.value = "";
});

/* --- QR scanner check-in --- */
let scannerInstance = null;
document.getElementById("toggleScannerBtn").addEventListener("click", ()=>{
  const box = document.getElementById("qrScannerBox");
  const eventId = currentCheckinEventId();
  if(!eventId){ alert("Select an event first."); return; }

  if(box.classList.contains("hidden")){
    box.classList.remove("hidden");
    box.innerHTML = `<div id="qrReader" style="width:100%;"></div>`;
    scannerInstance = new Html5Qrcode("qrReader");
    scannerInstance.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 220 },
      (decodedText)=>{
        const [scannedEventId, rollNo] = decodedText.split("::");
        if(scannedEventId !== eventId){
          return; // ignore QR codes from other events, keep scanning
        }
        const res = checkInByRoll(rollNo);
        if(res.ok){
          scannerInstance.pause();
          alert(res.message);
          scannerInstance.resume();
        }
      },
      ()=>{ /* ignore per-frame scan errors */ }
    ).catch(err=>{
      box.innerHTML = `<p class="empty-note">Camera unavailable: ${err}. Use the manual entry field instead.</p>`;
    });
  } else {
    if(scannerInstance){ scannerInstance.stop().catch(()=>{}); }
    box.classList.add("hidden");
    box.innerHTML = "";
  }
});

/* --- send mail to all registered --- */
document.getElementById("sendMailBtn").addEventListener("click", async ()=>{
  const eventId = currentCheckinEventId();
  const events = store.getEvents();
  const ev = events.find(x=>x.id===eventId);
  const regs = (store.getRegs()[eventId] || []);
  const status = document.getElementById("mailStatus");

  if(!ev || regs.length === 0){
    status.textContent = "No registrations to email.";
    return;
  }
  if(!window.emailjs || EMAILJS_PUBLIC_KEY === "YOUR_EMAILJS_PUBLIC_KEY"){
    status.textContent = "EmailJS isn't configured yet — set your keys in script.js.";
    return;
  }

  status.textContent = `Sending to ${regs.length} attendee(s)...`;
  let sent = 0;
  for(const r of regs){
    try{
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
        to_name: r.name,
        to_email: r.email,
        event_name: ev.name,
        event_date: fmtDate(ev.date),
        event_time: `${ev.startTime||""}–${ev.endTime||""}`,
        event_location: ev.location,
        reply_to: ORGANIZER_EMAIL
      });
      sent++;
    }catch(err){
      console.error("Email failed for", r.email, err);
    }
  }
  status.textContent = `Sent ${sent}/${regs.length} emails.`;
});

/* --------------------------------- utils --------------------------------- */
function escapeHtml(str){
  if(str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

/* ------------------------------- bootstrap -------------------------------- */
window.addEventListener("DOMContentLoaded", ()=>{
  showPage("dashboard");
});
