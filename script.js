/* ==========================================================================
   GITHUB Event Registration Portal
   Data now persists in Supabase (Postgres) instead of localStorage, so it
   survives across browsers/devices. See supabaseClient.js for connection
   config and supabase-schema.sql for the table/RLS setup this expects.
   ========================================================================== */

/* ---------- CONFIG: fill these in with your own EmailJS account ---------- */
const EMAILJS_PUBLIC_KEY  = "C7_WFUoZtMtziOT90";
const EMAILJS_SERVICE_ID  = "service_5wa4ftp";
const EMAILJS_TEMPLATE_ID = "template_0e7pwu9";
const ORGANIZER_EMAIL     = "gteddi@student.gitam.edu";

const ADMIN_USER_PATTERN = /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/i;
const ADMIN_PASSWORD = "Gitam$$456";

if (window.emailjs && EMAILJS_PUBLIC_KEY !== "YOUR_EMAILJS_PUBLIC_KEY") {
  emailjs.init(EMAILJS_PUBLIC_KEY);
}

/* ---------------------------- storage helpers ---------------------------- */
/* Maps between the camelCase shape the UI code uses and the snake_case
   columns in Supabase. */
function rowToEvent(row){
  return {
    id: row.id,
    name: row.name,
    image: row.image,
    date: row.date,
    startTime: row.start_time,
    endTime: row.end_time,
    location: row.location,
    doc: row.doc,
    docName: row.doc_name,
    status: row.status
  };
}
function eventToRow(ev){
  return {
    id: ev.id,
    name: ev.name,
    image: ev.image,
    date: ev.date || null,
    start_time: ev.startTime,
    end_time: ev.endTime,
    location: ev.location,
    doc: ev.doc,
    doc_name: ev.docName,
    status: ev.status
  };
}
function rowToReg(row){
  return {
    id: row.id,
    eventId: row.event_id,
    name: row.name,
    email: row.email,
    branch: row.branch,
    year: row.year,
    rollNo: row.roll_no,
    checkedIn: row.checked_in,
    registeredAt: row.registered_at
  };
}
function regToRow(reg, eventId){
  return {
    id: reg.id,
    event_id: eventId,
    name: reg.name,
    email: reg.email,
    branch: reg.branch,
    year: reg.year,
    roll_no: reg.rollNo,
    checked_in: reg.checkedIn,
    registered_at: reg.registeredAt
  };
}

function showSupabaseError(err, context){
  console.error(context, err);
  alert(`${context}: ${err.message || err}`);
}

const store = {
  async getEvents(){
    const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });
    if(error){ showSupabaseError(error, "Couldn't load events"); return []; }
    return (data || []).map(rowToEvent);
  },
  async upsertEvent(eventObj){
    const { error } = await supabase.from("events").upsert(eventToRow(eventObj));
    if(error){ showSupabaseError(error, "Couldn't save event"); return false; }
    return true;
  },
  async deleteEvent(id){
    // registrations for this event cascade-delete via the FK in supabase-schema.sql,
    // but we also clear them explicitly in case that constraint isn't set up.
    await supabase.from("registrations").delete().eq("event_id", id);
    const { error } = await supabase.from("events").delete().eq("id", id);
    if(error){ showSupabaseError(error, "Couldn't delete event"); return false; }
    return true;
  },
  /** Pass an eventId to get just that event's registrations, or omit it for all. */
  async getRegs(eventId){
    let query = supabase.from("registrations").select("*");
    if(eventId) query = query.eq("event_id", eventId);
    const { data, error } = await query;
    if(error){ showSupabaseError(error, "Couldn't load registrations"); return []; }
    return (data || []).map(rowToReg);
  },
  async addReg(reg, eventId){
    const { error } = await supabase.from("registrations").insert(regToRow(reg, eventId));
    if(error){ showSupabaseError(error, "Couldn't save registration"); return false; }
    return true;
  },
  async setCheckedIn(regId, checkedIn){
    const { error } = await supabase.from("registrations").update({ checked_in: checkedIn }).eq("id", regId);
    if(error){ showSupabaseError(error, "Couldn't update check-in"); return false; }
    return true;
  }
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

async function showPage(id){
  pages.forEach(p=>p.classList.toggle("active", p.id === "page-"+id));
  navButtons.forEach(b=>b.classList.toggle("active", b.dataset.page === id));
  document.getElementById("navlinks").classList.remove("open");
  if(id === "admin-login" && sessionStorage.getItem("gep_admin") === "yes"){
    await renderAdminPanel();
    pages.forEach(p=>p.classList.toggle("active", p.id === "page-admin-panel"));
  }
  if(id === "dashboard") await renderDashboard();
  if(id === "events-info") await renderEventsInfo();
  if(id === "registration") await renderRegistrationSelect();
}

navButtons.forEach(btn=>{
  btn.addEventListener("click", ()=> showPage(btn.dataset.page));
});
document.getElementById("hamburger").addEventListener("click", ()=>{
  document.getElementById("navlinks").classList.toggle("open");
});

/* ------------------------------- dashboard -------------------------------- */
async function renderDashboard(){
  const events = await store.getEvents();
  const allRegs = await store.getRegs();
  document.getElementById("statTotalEvents").textContent = events.length;
  document.getElementById("statLiveEvents").textContent = events.filter(e=>e.status==="live").length;
  document.getElementById("statClosedEvents").textContent = events.filter(e=>e.status==="closed").length;
  document.getElementById("statTotalRegs").textContent = allRegs.length;

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
async function renderEventsInfo(){
  const events = await store.getEvents();
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
async function renderRegistrationSelect(){
  const events = (await store.getEvents()).filter(e=>e.status==="live");
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

document.getElementById("registrationForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const eventId = document.getElementById("regEventSelect").value;
  const events = await store.getEvents();
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

  const msg = document.getElementById("regFormMsg");
  const existingRegs = await store.getRegs(eventId);
  const dup = existingRegs.find(r=>r.rollNo.toLowerCase() === reg.rollNo.toLowerCase());
  if(dup){
    msg.textContent = "This registration number has already registered for this event.";
    msg.className = "form-msg error";
    return;
  }

  const ok = await store.addReg(reg, eventId);
  if(!ok) return;

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
document.getElementById("adminLoginForm").addEventListener("submit", async (e)=>{
  e.preventDefault();
  const user = document.getElementById("adminUser").value.trim();
  const pass = document.getElementById("adminPass").value;
  const msg = document.getElementById("adminLoginMsg");

  if(ADMIN_USER_PATTERN.test(user) && pass === ADMIN_PASSWORD){
    sessionStorage.setItem("gep_admin","yes");
    msg.textContent = "";
    document.getElementById("adminLoginForm").reset();
    await renderAdminPanel();
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
async function renderAdminPanel(){
  await renderAdminEventList();
  await renderCheckinEventSelect();
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
  const events = await store.getEvents();
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

  const ok = await store.upsertEvent(eventObj);
  if(!ok) return;

  const msg = document.getElementById("eventFormMsg");
  msg.textContent = existing ? "Event updated." : "Event added.";
  msg.className = "form-msg success";
  resetEventForm();
  await renderAdminEventList();
  await renderCheckinEventSelect();
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

async function renderAdminEventList(){
  const events = await store.getEvents();
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
    btn.addEventListener("click", async ()=>{
      const id = btn.dataset.id;
      const events = await store.getEvents();
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
        await store.upsertEvent(ev);
        await renderAdminEventList();
      }

      if(btn.dataset.action === "delete"){
        if(!confirm(`Delete "${ev.name}"? This also removes its registrations.`)) return;
        const ok = await store.deleteEvent(id);
        if(!ok) return;
        await renderAdminEventList();
        await renderCheckinEventSelect();
      }
    });
  });
}

/* ------------------------- check-in & mail tab ------------------------- */
async function renderCheckinEventSelect(){
  const events = await store.getEvents();
  const sel = document.getElementById("checkinEventSelect");
  sel.innerHTML = `<option value="">-- choose an event --</option>` +
    events.map(e=>`<option value="${e.id}">${escapeHtml(e.name)} — ${fmtDate(e.date)}</option>`).join("");
  document.getElementById("checkinArea").classList.add("hidden");
}

document.getElementById("checkinEventSelect").addEventListener("change", async (e)=>{
  document.getElementById("checkinArea").classList.toggle("hidden", !e.target.value);
  await renderRegTable();
});

function currentCheckinEventId(){
  return document.getElementById("checkinEventSelect").value;
}

async function renderRegTable(){
  const eventId = currentCheckinEventId();
  const regs = eventId ? await store.getRegs(eventId) : [];
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

async function checkInByRoll(rollNo){
  const eventId = currentCheckinEventId();
  if(!eventId) return { ok:false, message:"Select an event first." };
  const list = await store.getRegs(eventId);
  const match = list.find(r=>r.rollNo.toLowerCase() === rollNo.trim().toLowerCase());
  if(!match) return { ok:false, message:"No registration found with that number for this event." };
  if(match.checkedIn) return { ok:false, message:`${match.name} is already checked in.` };
  const ok = await store.setCheckedIn(match.id, true);
  if(!ok) return { ok:false, message:"Couldn't save check-in — try again." };
  await renderRegTable();
  return { ok:true, message:`Checked in: ${match.name} (${match.rollNo}).` };
}

document.getElementById("checkinRollBtn").addEventListener("click", async ()=>{
  const input = document.getElementById("checkinRollInput");
  const res = await checkInByRoll(input.value);
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
      async (decodedText)=>{
        const [scannedEventId, rollNo] = decodedText.split("::");
        if(scannedEventId !== eventId){
          return; // ignore QR codes from other events, keep scanning
        }
        const res = await checkInByRoll(rollNo);
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
  const events = await store.getEvents();
  const ev = events.find(x=>x.id===eventId);
  const regs = eventId ? await store.getRegs(eventId) : [];
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
