(function(){
  "use strict";

  /* ============== STATE (persisted via window.storage, shared across visitors) ============== */
  const DEFAULT_EVENTS = [
    {
      id: "EVT-1001",
      name: "Open Source Induction Meet",
      date: "2026-08-22",
      time: "16:30",
      location: "GITAM Convention Centre, Block C",
      image: "",
      docName: "",
      docData: ""
    },
    {
      id: "EVT-1002",
      name: "Hack Circuit — 24Hr Build Sprint",
      date: "2026-09-05",
      time: "09:00",
      location: "CSE Seminar Hall, Block D",
      image: "",
      docName: "",
      docData: ""
    }
  ];
  let events = [];
  let registrations = [];
  let adminUser = "";
  let editingEventId = null;
  let scanStream = null;
  let scanLoopId = null;

  const domains = [
    { tag:"Technical", name:"Web Engineering", desc:"Building and shipping real web products — frontend, backend, and everything that connects them." },
    { tag:"Technical", name:"Agentic Development", desc:"Working with AI agents and LLM tooling — the domain closest to AI/ML on campus." },
    { tag:"Technical", name:"Digital Defence", desc:"Security-minded engineering: safe defaults, responsible disclosure, and thinking like an attacker to build better defenders." },
    { tag:"Technical", name:"Open Source / DevEx", desc:"Contributing to real repositories and improving the tools developers use every day." },
    { tag:"Non-technical", name:"Creative Studio", desc:"Design, branding and visual storytelling for every event and release the community ships." },
    { tag:"Non-technical", name:"Community Relations", desc:"Outreach, partnerships and keeping the community connected across campus." }
  ];

  /* ============== HELPERS ============== */
  const $ = (sel, root) => (root||document).querySelector(sel);
  const $all = (sel, root) => Array.from((root||document).querySelectorAll(sel));

  function toast(msg, kind){
    const wrap = $("#toast-wrap");
    const el = document.createElement("div");
    el.className = "toast " + (kind === "bad" ? "bad" : "ok");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }

  function fmtDate(d){
    if(!d) return "";
    const parts = d.split("-");
    if(parts.length !== 3) return d;
    const dt = new Date(+parts[0], +parts[1]-1, +parts[2]);
    return dt.toLocaleDateString(undefined, { day:"numeric", month:"short", year:"numeric" });
  }
  function fmtTime(t){
    if(!t) return "";
    const [h,m] = t.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = ((h+11)%12)+1;
    return h12 + ":" + String(m).padStart(2,"0") + " " + period;
  }
  function genId(prefix){
    return prefix + "-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase();
  }
  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  /* ============== PERSISTENT STORAGE ==============
     Events & registrations are saved as shared data so the portal looks
     the same for every visitor and survives a page refresh. Only the
     "Remove" button in the admin dashboard deletes an event. */
  async function loadState(){
    try{
      const res = await window.storage.get("events", true);
      events = (res && res.value) ? JSON.parse(res.value) : DEFAULT_EVENTS.slice();
    }catch(e){
      events = DEFAULT_EVENTS.slice();
    }
    try{
      const res = await window.storage.get("registrations", true);
      registrations = (res && res.value) ? JSON.parse(res.value) : [];
    }catch(e){
      registrations = [];
    }
  }
  async function saveEvents(){
    try{
      const ok = await window.storage.set("events", JSON.stringify(events), true);
      if(!ok) toast("Couldn't save that change — it may not survive a refresh.", "bad");
    }catch(e){
      toast("Couldn't save that change — it may not survive a refresh.", "bad");
    }
  }
  async function saveRegistrations(){
    try{
      const ok = await window.storage.set("registrations", JSON.stringify(registrations), true);
      if(!ok) toast("Couldn't save that change — it may not survive a refresh.", "bad");
    }catch(e){
      toast("Couldn't save that change — it may not survive a refresh.", "bad");
    }
  }

  /* ============== TAB NAVIGATION ============== */
  $all(".tab").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $all(".page").forEach(p => p.classList.remove("active"));
      $("#tab-" + btn.dataset.tab).classList.add("active");
    });
  });

  /* ============== RENDER: EVENTS INFO (public) ============== */
  function renderPublicEvents(){
    const grid = $("#events-grid-public");
    if(events.length === 0){
      grid.innerHTML = "";
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML = "<strong>No events yet</strong>Check back soon — organisers haven't published anything.";
      grid.parentElement.appendChild(empty);
      return;
    }
    grid.innerHTML = events.map(ev => `
      <div class="card event-card">
        ${ev.image ? `<img class="thumb" src="${ev.image}" alt="${escapeHtml(ev.name)}">`
                    : `<div class="thumb placeholder">NO IMAGE PROVIDED</div>`}
        <div class="body">
          <h3 class="ev-name">${escapeHtml(ev.name)}</h3>
          <div class="event-meta">
            <span><i></i>${fmtDate(ev.date)}</span>
            <span><i></i>${fmtTime(ev.time)}</span>
            <span><i></i>${escapeHtml(ev.location)}</span>
          </div>
          ${ev.docName ? `<a class="doc-link" href="${ev.docData}" download="${escapeHtml(ev.docName)}">📄 ${escapeHtml(ev.docName)}</a>` : `<span class="hint">No attachment</span>`}
        </div>
      </div>
    `).join("");
  }

  function escapeHtml(str){
    const d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  /* ============== RENDER: ABOUT ============== */
  function renderDomains(){
    $("#domain-grid").innerHTML = domains.map((d,i) => `
      <div class="card domain-card">
        <div class="num">${String(i+1).padStart(2,"0")} / ${d.tag.toUpperCase()}</div>
        <h3>${d.name}</h3>
        <p>${d.desc}</p>
      </div>
    `).join("");
  }

  /* ============== REGISTRATION ============== */
  function renderRegEventOptions(){
    const sel = $("#reg-event");
    if(events.length === 0){
      sel.innerHTML = `<option value="">No events available</option>`;
      $("#reg-submit-btn").disabled = true;
      return;
    }
    sel.innerHTML = events.map(ev => `<option value="${ev.id}">${escapeHtml(ev.name)} — ${fmtDate(ev.date)}</option>`).join("");
    $("#reg-submit-btn").disabled = false;
  }

  function isGitamEmail(v){
    return /^[a-zA-Z0-9._%+-]+@(student\.gitam\.edu|gitam\.in|gitam\.edu)$/i.test(v.trim());
  }

  $("#reg-submit-btn").addEventListener("click", async () => {
    const eventId = $("#reg-event").value;
    const name = $("#reg-name").value.trim();
    const email = $("#reg-email").value.trim();
    const branch = $("#reg-branch").value.trim();
    const year = $("#reg-year").value;
    const errEl = $("#reg-error");

    if(!eventId || !name || !branch || !year || !isGitamEmail(email)){
      errEl.textContent = !isGitamEmail(email) && email
        ? "Please use a valid GITAM email address (e.g. name@student.gitam.edu)."
        : "Please fill every field with a valid GITAM email before submitting.";
      errEl.classList.add("show");
      return;
    }
    errEl.classList.remove("show");

    const ev = events.find(e => e.id === eventId);
    const reg = {
      id: genId("REG"),
      eventId, eventName: ev ? ev.name : "",
      name, email, branch, year,
      attended: false, attendedAt: "",
      timestamp: new Date().toISOString()
    };
    registrations.push(reg);
    await saveRegistrations();

    // Fire-and-forget submission to the Formspree endpoint (does not block local flow)
    try{
      const fd = new FormData();
      fd.append("name", name);
      fd.append("email", email);
      fd.append("branch", branch);
      fd.append("year", year);
      fd.append("event", reg.eventName);
      fetch("https://formspree.io/f/mwlekoga", {
        method: "POST",
        headers: { "Accept": "application/json" },
        body: fd
      }).catch(() => {});
    }catch(e){ /* non-fatal */ }

    showRegSuccess(reg);
    toast("Registration saved for " + name, "ok");
  });

  function showRegSuccess(reg){
    $("#tab-register .reg-form").style.display = "none";
    const panel = $("#reg-success");
    panel.style.display = "block";
    $("#qr-box").innerHTML = "";
    const qrPayload = JSON.stringify({ id: reg.id, name: reg.name, email: reg.email, branch: reg.branch, year: reg.year, event: reg.eventName });
    new QRCode($("#qr-box"), { text: qrPayload, width: 168, height: 168, colorDark:"#0a0e1c", colorLight:"#ffffff" });
    $("#reg-id-out").textContent = reg.name + "  ·  " + reg.eventName;
  }

  $("#reg-again-btn").addEventListener("click", () => {
    $("#tab-register .reg-form").style.display = "block";
    $("#reg-success").style.display = "none";
    ["reg-name","reg-email","reg-branch"].forEach(id => $("#"+id).value = "");
    $("#reg-year").value = "";
    $("#reg-error").classList.remove("show");
    renderRegEventOptions();
  });

  /* ============== ADMIN: LOGIN ============== */
  const ADMIN_PASSWORD = "Gitam$$456";
  function isAdminUsername(v){
    return /^[a-zA-Z0-9._%+-]+@student\.gitam\.edu$/i.test(v.trim());
  }

  $("#admin-login-btn").addEventListener("click", () => {
    const user = $("#admin-user").value.trim();
    const pass = $("#admin-pass").value;
    const err = $("#admin-error");
    if(!isAdminUsername(user) || pass !== ADMIN_PASSWORD){
      err.classList.add("show");
      return;
    }
    err.classList.remove("show");
    adminUser = user;
    $("#admin-user-out").textContent = user;
    $("#admin-login-view").hidden = true;
    $("#admin-dashboard-view").hidden = false;
    renderAdminEvents();
    renderRegsTable();
  });

  $("#admin-logout-btn").addEventListener("click", () => {
    adminUser = "";
    $("#admin-dashboard-view").hidden = true;
    $("#admin-login-view").hidden = false;
    $("#admin-user").value = "";
    $("#admin-pass").value = "";
    stopScanner();
  });

  ["admin-user","admin-pass"].forEach(id => {
    $("#"+id).addEventListener("keydown", e => { if(e.key === "Enter") $("#admin-login-btn").click(); });
  });

  /* ============== ADMIN: SUBTABS ============== */
  $all(".subtab").forEach(btn => {
    btn.addEventListener("click", () => {
      $all(".subtab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $all(".admin-pane").forEach(p => p.classList.remove("active"));
      $("#admin-pane-" + btn.dataset.sub).classList.add("active");
      if(btn.dataset.sub !== "scan") stopScanner();
    });
  });

  /* ============== ADMIN: MANAGE EVENTS ============== */
  $("#ev-image").addEventListener("change", e => {
    $("#ev-image-name").textContent = e.target.files[0] ? e.target.files[0].name : "";
  });
  $("#ev-doc").addEventListener("change", e => {
    $("#ev-doc-name").textContent = e.target.files[0] ? e.target.files[0].name : "";
  });

  $("#event-save-btn").addEventListener("click", async () => {
    const name = $("#ev-name").value.trim();
    const date = $("#ev-date").value;
    const time = $("#ev-time").value;
    const location = $("#ev-location").value.trim();
    const err = $("#event-error");

    if(!name || !date || !time || !location){
      err.classList.add("show");
      return;
    }
    err.classList.remove("show");

    const imageFile = $("#ev-image").files[0];
    const docFile = $("#ev-doc").files[0];
    const image = imageFile ? await readFileAsDataURL(imageFile) : "";
    const docData = docFile ? await readFileAsDataURL(docFile) : "";
    const docName = docFile ? docFile.name : "";

    const newEvent = {
      id: genId("EVT"), name, date, time, location,
      image, docName, docData
    };
    events.push(newEvent);
    await saveEvents();

    clearEventForm();
    renderAdminEvents();
    renderPublicEvents();
    renderRegEventOptions();
    toast("Event added: " + name, "ok");
  });

  function clearEventForm(){
    ["ev-name","ev-date","ev-time","ev-location"].forEach(id => $("#"+id).value = "");
    $("#ev-image").value = "";
    $("#ev-doc").value = "";
    $("#ev-image-name").textContent = "";
    $("#ev-doc-name").textContent = "";
  }

  function renderAdminEvents(){
    const list = $("#admin-events-list");
    $("#admin-event-count").textContent = events.length;
    if(events.length === 0){
      list.innerHTML = `<div class="empty-state"><strong>No events yet</strong>Add your first event using the form above.</div>`;
      return;
    }
    list.innerHTML = events.map(ev => `
      <div class="card admin-event-row">
        ${ev.image ? `<img src="${ev.image}" alt="">` : `<div class="ph">NO IMG</div>`}
        <div class="info">
          <div class="t">${escapeHtml(ev.name)}</div>
          <div class="m">${fmtDate(ev.date)} · ${fmtTime(ev.time)} · ${escapeHtml(ev.location)}${ev.docName ? " · 📄 "+escapeHtml(ev.docName) : ""}</div>
        </div>
        <div class="acts">
          <button class="btn btn-ghost btn-sm" data-edit="${ev.id}">Edit</button>
          <button class="btn btn-danger btn-sm" data-remove="${ev.id}">Remove</button>
        </div>
      </div>
    `).join("");

    $all("[data-edit]", list).forEach(b => b.addEventListener("click", () => openEditModal(b.dataset.edit)));
    $all("[data-remove]", list).forEach(b => b.addEventListener("click", async () => {
      const ev = events.find(e => e.id === b.dataset.remove);
      events = events.filter(e => e.id !== b.dataset.remove);
      await saveEvents();
      renderAdminEvents();
      renderPublicEvents();
      renderRegEventOptions();
      toast((ev ? ev.name : "Event") + " removed", "bad");
    }));
  }

  /* ============== ADMIN: EDIT EVENT MODAL ============== */
  function openEditModal(id){
    const ev = events.find(e => e.id === id);
    if(!ev) return;
    editingEventId = id;
    $("#em-name").value = ev.name;
    $("#em-date").value = ev.date;
    $("#em-time").value = ev.time;
    $("#em-location").value = ev.location;
    $("#em-image").value = "";
    $("#em-doc").value = "";
    $("#edit-overlay").classList.add("show");
  }
  function closeEditModal(){
    $("#edit-overlay").classList.remove("show");
    editingEventId = null;
  }
  $("#edit-close-x").addEventListener("click", closeEditModal);
  $("#edit-close-btn").addEventListener("click", closeEditModal);
  $("#edit-overlay").addEventListener("click", e => { if(e.target.id === "edit-overlay") closeEditModal(); });

  $("#em-save-btn").addEventListener("click", async () => {
    const ev = events.find(e => e.id === editingEventId);
    if(!ev) return;
    ev.name = $("#em-name").value.trim() || ev.name;
    ev.date = $("#em-date").value || ev.date;
    ev.time = $("#em-time").value || ev.time;
    ev.location = $("#em-location").value.trim() || ev.location;

    const imgFile = $("#em-image").files[0];
    const docFile = $("#em-doc").files[0];
    if(imgFile) ev.image = await readFileAsDataURL(imgFile);
    if(docFile){ ev.docData = await readFileAsDataURL(docFile); ev.docName = docFile.name; }

    await saveEvents();
    renderAdminEvents();
    renderPublicEvents();
    renderRegEventOptions();
    closeEditModal();
    toast("Event profile updated", "ok");
  });

  /* ============== ADMIN: REGISTRATIONS TABLE ============== */
  function renderRegsTable(){
    $("#reg-count").textContent = registrations.length;
    const tbody = $("#regs-tbody");
    if(registrations.length === 0){
      tbody.innerHTML = `<tr><td colspan="7" style="color:var(--muted); text-align:center; padding:26px;">No registrations yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = registrations.slice().reverse().map(r => `
      <tr>
        <td>${escapeHtml(r.name)}</td>
        <td>${escapeHtml(r.email)}</td>
        <td>${escapeHtml(r.branch)}</td>
        <td>${escapeHtml(r.year)}</td>
        <td>${escapeHtml(r.eventName)}</td>
        <td>
          <div class="attend-edit">
            <select class="attend-select" data-id="${r.id}">
              <option value="P" ${r.attended ? "selected" : ""}>P — Present</option>
              <option value="A" ${!r.attended ? "selected" : ""}>A — Absent</option>
            </select>
            <button class="btn btn-ghost btn-sm attend-save-btn" data-id="${r.id}">Save</button>
          </div>
        </td>
        <td style="font-family:var(--mono); font-size:11px; color:var(--muted-2);">${r.id}</td>
      </tr>
    `).join("");

    $all(".attend-save-btn", tbody).forEach(btn => btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const select = tbody.querySelector(`.attend-select[data-id="${id}"]`);
      const reg = registrations.find(r => r.id === id);
      if(!reg || !select) return;

      const shouldAttend = select.value === "P";
      if(reg.attended === shouldAttend){
        toast(reg.name + " is already marked " + (shouldAttend ? "Present" : "Absent"), "ok");
        return;
      }
      reg.attended = shouldAttend;
      reg.attendedAt = shouldAttend ? new Date().toISOString() : "";
      await saveRegistrations();
      toast(reg.name + " marked " + (shouldAttend ? "Present" : "Absent"), shouldAttend ? "ok" : "bad");
    }));
  }

  /* ============== ADMIN: SCAN / CHECK-IN ============== */
  async function checkInById(rawText){
    let regId = rawText.trim();
    let parsed = null;
    try{ parsed = JSON.parse(rawText); if(parsed && parsed.id) regId = parsed.id; }catch(e){ /* not JSON, treat as raw id */ }

    const resultBox = $("#scan-result");
    resultBox.classList.remove("dup","bad");
    resultBox.classList.add("show");

    // First try an exact ID match (QR codes / typed REG-xxxxxxx ids)
    let reg = registrations.find(r => r.id === regId);

    // Fall back to matching by attendee name if no ID matched (case-insensitive).
    // Try an exact name match first, then a partial/substring match so a
    // partial name (e.g. "ram") can still find "Ram Kumar".
    let nameMatches = [];
    if(!reg){
      const needle = regId.toLowerCase();
      nameMatches = registrations.filter(r => r.name.toLowerCase() === needle);
      if(nameMatches.length === 0 && needle.length >= 2){
        nameMatches = registrations.filter(r => r.name.toLowerCase().includes(needle));
      }
      if(nameMatches.length === 1){
        reg = nameMatches[0];
      } else if(nameMatches.length > 1){
        // Ambiguous name — prefer an attendee who hasn't checked in yet;
        // if several are still unchecked, ask the organiser to be more specific.
        const unattended = nameMatches.filter(r => !r.attended);
        if(unattended.length === 1){
          reg = unattended[0];
        } else {
          const names = nameMatches.map(r => r.name + " (" + r.eventName + ")").join(", ");
          resultBox.classList.add("bad");
          $("#scan-result-title").textContent = "Multiple matches for that name";
          $("#scan-result-body").textContent = nameMatches.length + " registrations match \"" + regId.trim() + "\": " + names + ". Type more of the name, or use their Registration ID from the Registrations tab.";
          toast("Multiple people match \"" + regId.trim() + "\" — be more specific", "bad");
          return;
        }
      }
    }

    if(!reg){
      resultBox.classList.add("bad");
      $("#scan-result-title").textContent = "Registration not found";
      $("#scan-result-body").textContent = "No registration matches ID or name: " + regId;
      toast("No match for that QR / ID / name", "bad");
      return;
    }
    if(reg.attended){
      resultBox.classList.add("dup");
      $("#scan-result-title").textContent = "Already checked in";
      $("#scan-result-body").textContent = reg.name + " was marked attended earlier for " + reg.eventName + ".";
      toast(reg.name + " already checked in", "bad");
      return;
    }
    reg.attended = true;
    reg.attendedAt = new Date().toISOString();
    await saveRegistrations();
    $("#scan-result-title").textContent = "Checked in ✓";
    $("#scan-result-body").textContent = reg.name + " (" + reg.branch + ", " + reg.year + ") marked as attended for " + reg.eventName + ".";
    toast(reg.name + " marked as attended", "ok");
    renderRegsTable();
  }

  $("#manual-scan-btn").addEventListener("click", async () => {
    const v = $("#manual-scan-input").value.trim();
    if(!v) return;
    await checkInById(v);
    $("#manual-scan-input").value = "";
  });

  $("#scan-start-btn").addEventListener("click", startScanner);
  $("#scan-stop-btn").addEventListener("click", stopScanner);

  async function startScanner(){
    const statusEl = $("#scan-status");
    statusEl.textContent = "Requesting camera access…";

    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
      statusEl.textContent = "Camera isn't available on this connection. Open this page over https:// (or localhost) — camera access is blocked on file:// or plain http:// pages. Use manual check-in instead.";
      toast("Camera blocked — page isn't served over https/localhost", "bad");
      return;
    }

    try{
      // Prefer the rear camera, but don't hard-fail if the device doesn't
      // expose one (laptops, some tablets) — fall back to any camera.
      try{
        scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } } });
      }catch(innerErr){
        scanStream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      const video = $("#scan-video");
      video.srcObject = scanStream;
      await video.play();
      $("#scan-start-btn").style.display = "none";
      $("#scan-stop-btn").style.display = "inline-flex";
      statusEl.textContent = "Camera live — scanning for QR codes…";
      scanFrameLoop();
    }catch(err){
      let msg = "Couldn't access camera. Use manual check-in instead.";
      if(err && err.name === "NotAllowedError"){
        msg = "Camera permission was denied. Allow camera access for this site in your browser settings, or use manual check-in.";
      } else if(err && err.name === "NotFoundError"){
        msg = "No camera was found on this device. Use manual check-in instead.";
      } else if(err && (err.name === "NotReadableError" || err.name === "TrackStartError")){
        msg = "Camera is already in use by another app. Close it and try again, or use manual check-in.";
      } else if(location.protocol === "file:"){
        msg = "Camera access needs this page served over https:// (or localhost) — it won't work opened directly from a file. Use manual check-in instead.";
      }
      statusEl.textContent = msg;
      toast(msg, "bad");
    }
  }

  function stopScanner(){
    if(scanLoopId) cancelAnimationFrame(scanLoopId);
    scanLoopId = null;
    if(scanStream){
      scanStream.getTracks().forEach(t => t.stop());
      scanStream = null;
    }
    $("#scan-start-btn").style.display = "inline-flex";
    $("#scan-stop-btn").style.display = "none";
    $("#scan-status").textContent = "Camera is off.";
  }

  let lastScanTime = 0;
  function scanFrameLoop(){
    const video = $("#scan-video");
    const canvas = $("#scan-canvas");
    if(video.readyState === video.HAVE_ENOUGH_DATA){
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if(code && code.data && (Date.now() - lastScanTime > 2000)){
        lastScanTime = Date.now();
        checkInById(code.data);
      }
    }
    scanLoopId = requestAnimationFrame(scanFrameLoop);
  }

  /* ============== INIT ============== */
  (async function init(){
    renderDomains();
    await loadState();
    renderPublicEvents();
    renderRegEventOptions();
  })();
})();