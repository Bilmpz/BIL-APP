(function(){
  "use strict";
  var PEOPLE = ["Patrick","Marcus","Oliver","Kathrine"];
  var COLORS = {Patrick:"var(--p-a)",Marcus:"var(--p-b)",Oliver:"var(--p-c)",Kathrine:"var(--p-d)"};
  var KEY = "faellesbil_v1";

  var state = { price:1, startKm:75502, trips:[], payments:[] };

  // ---------- storage ----------
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){/* session only */}
  }
  function load(){
    try{
      var raw = localStorage.getItem(KEY);
      if(raw){
        var d = JSON.parse(raw);
        if(d && typeof d==="object"){
          state.price = (typeof d.price==="number" && d.price>=0)? d.price : 1;
          state.startKm = (typeof d.startKm==="number" && d.startKm>=0)? d.startKm : 75502;
          state.trips = Array.isArray(d.trips)? d.trips : [];
          state.payments = Array.isArray(d.payments)? d.payments : [];
        }
      }
    }catch(e){/* start fresh */}
  }

  // ---------- helpers ----------
  var nf = new Intl.NumberFormat("da-DK",{maximumFractionDigits:2});
  function km(n){ return nf.format(Math.round(n))+" km"; }
  function kr(n){ return nf.format(Math.round(n*100)/100)+" kr"; }
  function today(){ var t=new Date(); return t.toISOString().slice(0,10); }
  function fmtDate(iso){
    if(!iso) return "";
    var p = iso.split("-"); return p.length===3 ? p[2]+"-"+p[1]+"-"+p[0] : iso;
  }
  function uid(){
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : Date.now().toString(36)+Math.random().toString(36).slice(2,8);
  }
  function currentKm(){ return state.trips.length ? Number(state.trips[state.trips.length-1].end) : state.startKm; }
  function personDot(name){
    var c = COLORS[name] || "var(--muted)";
    return '<span class="dot" style="background:'+c+'"></span>';
  }
  function esc(s){ return String(s).replace(/[&<>"]/g,function(m){
    return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[m]; }); }

  // ---------- odometer ----------
  var odoEl = document.getElementById("odo");
  var odoWidth = 0;
  function digitStrip(){
    var s = document.createElement("div"); s.className="strip";
    for(var i=0;i<10;i++){ var sp=document.createElement("span"); sp.textContent=i; s.appendChild(sp); }
    return s;
  }
  function renderOdo(value){
    var str = String(Math.max(0,Math.round(value)));
    var w = Math.max(6, str.length);
    str = str.padStart(w,"0");
    if(w !== odoWidth){
      odoEl.innerHTML="";
      for(var i=0;i<w;i++){
        var r=document.createElement("div"); r.className="reel";
        r.appendChild(digitStrip()); odoEl.appendChild(r);
      }
      var unit=document.createElement("span"); unit.className="odo-unit"; unit.textContent="km";
      odoEl.appendChild(unit);
      odoWidth=w;
    }
    var reels = odoEl.querySelectorAll(".reel .strip");
    for(var j=0;j<reels.length;j++){
      reels[j].style.setProperty("--d", str.charAt(j));
    }
  }

  // ---------- computed ----------
  function totals(){
    var rows = PEOPLE.map(function(name){
      var driven = state.trips.reduce(function(a,t){
        return a + (t.person===name ? (Number(t.end)-Number(t.start)) : 0); },0);
      var paid = state.payments.reduce(function(a,p){
        return a + (p.person===name ? Number(p.amount) : 0); },0);
      var owed = driven * state.price;
      return { name:name, km:driven, owed:owed, paid:paid, rest:owed-paid };
    });
    var t = rows.reduce(function(a,r){
      a.km+=r.km; a.owed+=r.owed; a.paid+=r.paid; a.rest+=r.rest; return a;
    },{km:0,owed:0,paid:0,rest:0});
    return { rows:rows, tot:t };
  }

  // ---------- render ----------
  function render(){
    var c = totals();
    renderOdo(currentKm());
    document.getElementById("totKm").textContent = km(c.tot.km);
    document.getElementById("totKr").textContent = kr(c.tot.owed);

    // settlement
    document.getElementById("sumBody").innerHTML = c.rows.map(function(r){
      var pill = r.rest > 0.005
        ? '<span class="pill owe">'+kr(r.rest)+'</span>'
        : '<span class="pill ok">'+kr(r.rest)+'</span>';
      return '<tr>'+
        '<td class="p-cell"><span class="person">'+personDot(r.name)+r.name+'</span></td>'+
        '<td class="num" data-label="Kørt">'+nf.format(Math.round(r.km))+'</td>'+
        '<td class="num" data-label="Beløb">'+kr(r.owed)+'</td>'+
        '<td class="num" data-label="Betalt til far">'+kr(r.paid)+'</td>'+
        '<td class="num" data-label="Rest">'+pill+'</td>'+
        '</tr>';
    }).join("");
    document.getElementById("fKm").textContent = nf.format(Math.round(c.tot.km));
    document.getElementById("fKr").textContent = kr(c.tot.owed);
    document.getElementById("fPaid").textContent = kr(c.tot.paid);
    document.getElementById("fRest").textContent = kr(c.tot.rest);

    // trips (newest first)
    var tb = document.getElementById("tripBody");
    if(!state.trips.length){
      tb.innerHTML = '<tr><td class="empty" colspan="7" data-label="">Ingen ture endnu. Tilføj den første ovenfor.</td></tr>';
    } else {
      tb.innerHTML = state.trips.slice().reverse().map(function(t){
        var dist = Number(t.end)-Number(t.start);
        return '<tr>'+
          '<td data-label="Dato">'+fmtDate(t.date)+'</td>'+
          '<td class="p-cell" data-label="Person"><span class="person">'+personDot(t.person)+esc(t.person)+'</span></td>'+
          '<td class="num" data-label="Start">'+nf.format(t.start)+'</td>'+
          '<td class="num" data-label="Slut">'+nf.format(t.end)+'</td>'+
          '<td class="num" data-label="Km">'+nf.format(dist)+'</td>'+
          '<td class="num" data-label="Beløb">'+kr(dist*state.price)+'</td>'+
          '<td class="act" data-label=""><button class="del" data-del-trip="'+t.id+'" title="Slet tur" aria-label="Slet tur">✕</button></td>'+
          '</tr>';
      }).join("");
    }

    // payments (newest first)
    var pb = document.getElementById("payBody");
    if(!state.payments.length){
      pb.innerHTML = '<tr><td class="empty" colspan="5" data-label="">Ingen betalinger endnu.</td></tr>';
    } else {
      pb.innerHTML = state.payments.slice().reverse().map(function(p){
        return '<tr>'+
          '<td data-label="Dato">'+fmtDate(p.date)+'</td>'+
          '<td class="p-cell" data-label="Person"><span class="person">'+personDot(p.person)+esc(p.person)+'</span></td>'+
          '<td class="num" data-label="Beløb">'+kr(p.amount)+'</td>'+
          '<td data-label="Note">'+(p.note?esc(p.note):'<span style="color:var(--muted)">—</span>')+'</td>'+
          '<td class="act" data-label=""><button class="del" data-del-pay="'+p.id+'" title="Slet betaling" aria-label="Slet betaling">✕</button></td>'+
          '</tr>';
      }).join("");
    }

    // prefill next start (= last end, or baseline startKm before first trip)
    var startInput = document.getElementById("tStart");
    if(document.activeElement !== startInput){
      startInput.value = currentKm();
    }
    var priceInput = document.getElementById("price");
    if(document.activeElement !== priceInput){ priceInput.value = state.price; }
    var startKmInput = document.getElementById("startKm");
    if(document.activeElement !== startKmInput){ startKmInput.value = state.startKm; }
  }

  // ---------- toast ----------
  var toastEl = document.getElementById("toast"), toastT;
  function toast(msg){
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(function(){ toastEl.classList.remove("show"); },1900);
  }

  // ---------- selects ----------
  function fillSelect(sel){
    sel.innerHTML = '<option value="" disabled selected>Vælg…</option>' +
      PEOPLE.map(function(p){ return '<option value="'+p+'">'+p+'</option>'; }).join("");
  }
  fillSelect(document.getElementById("tPerson"));
  fillSelect(document.getElementById("pPerson"));

  // ---------- events ----------
  document.getElementById("price").addEventListener("input", function(e){
    var v = parseFloat(e.target.value);
    state.price = (isFinite(v) && v>=0) ? v : 0;
    save(); render();
  });

  document.getElementById("startKm").addEventListener("input", function(e){
    var v = parseInt(e.target.value,10);
    state.startKm = (isFinite(v) && v>=0) ? v : 0;
    save(); render();
  });

  document.getElementById("tripForm").addEventListener("submit", function(e){
    e.preventDefault();
    var msg = document.getElementById("tMsg"); msg.textContent="";
    var person = document.getElementById("tPerson").value;
    var startV = document.getElementById("tStart").value;
    var endV   = document.getElementById("tEnd").value;
    var start = parseFloat(startV), end = parseFloat(endV);
    if(!person){ msg.textContent="Vælg en person."; return; }
    if(startV===""||!isFinite(start)){ msg.textContent="Skriv et gyldigt start-km."; return; }
    if(endV===""||!isFinite(end)){ msg.textContent="Skriv et gyldigt slut-km."; return; }
    if(end < start){ msg.textContent="Slut-km skal være større end eller lig start-km."; return; }
    state.trips.push({ id:uid(), date:document.getElementById("tDate").value||today(),
      person:person, start:start, end:end });
    save();
    document.getElementById("tEnd").value="";
    document.getElementById("tPerson").selectedIndex=0;
    document.getElementById("tDate").value=today();
    render();
    toast("Tur tilføjet");
  });

  document.getElementById("payForm").addEventListener("submit", function(e){
    e.preventDefault();
    var msg = document.getElementById("pMsg"); msg.textContent="";
    var person = document.getElementById("pPerson").value;
    var amt = parseFloat(document.getElementById("pAmount").value);
    if(!person){ msg.textContent="Vælg en person."; return; }
    if(!isFinite(amt)||amt<=0){ msg.textContent="Skriv et gyldigt beløb."; return; }
    state.payments.push({ id:uid(), date:document.getElementById("pDate").value||today(),
      person:person, amount:amt, note:document.getElementById("pNote").value.trim() });
    save();
    document.getElementById("pAmount").value="";
    document.getElementById("pNote").value="";
    document.getElementById("pPerson").selectedIndex=0;
    document.getElementById("pDate").value=today();
    render();
    toast("Betaling registreret");
  });

  document.addEventListener("click", function(e){
    var t = e.target.closest("[data-del-trip]");
    if(t){
      if(confirm("Slet denne tur?")){
        state.trips = state.trips.filter(function(x){ return x.id!==t.getAttribute("data-del-trip"); });
        save(); render(); toast("Tur slettet");
      }
      return;
    }
    var p = e.target.closest("[data-del-pay]");
    if(p){
      if(confirm("Slet denne betaling?")){
        state.payments = state.payments.filter(function(x){ return x.id!==p.getAttribute("data-del-pay"); });
        save(); render(); toast("Betaling slettet");
      }
    }
  });

  // export / import / reset
  document.getElementById("exportBtn").addEventListener("click", function(){
    var blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "faelles-bil-data.json";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); },1000);
    toast("Data eksporteret");
  });
  document.getElementById("importBtn").addEventListener("click", function(){
    document.getElementById("importFile").click();
  });
  document.getElementById("importFile").addEventListener("change", function(e){
    var f = e.target.files[0]; if(!f) return;
    var r = new FileReader();
    r.onload = function(){
      try{
        var d = JSON.parse(r.result);
        if(!d || typeof d!=="object" || !Array.isArray(d.trips)) throw new Error("format");
        state.price = (typeof d.price==="number" && d.price>=0)? d.price : 1;
        state.startKm = (typeof d.startKm==="number" && d.startKm>=0)? d.startKm : 75502;
        state.trips = d.trips;
        state.payments = Array.isArray(d.payments)? d.payments : [];
        save(); render(); toast("Data importeret");
      }catch(err){ alert("Kunne ikke læse filen. Vælg en JSON-fil eksporteret fra Kørebog."); }
    };
    r.readAsText(f);
    e.target.value="";
  });
  document.getElementById("resetBtn").addEventListener("click", function(){
    if(confirm("Nulstil alt? Alle ture og betalinger slettes. Eksportér først, hvis du vil gemme en kopi.")){
      state = { price:1, startKm:75502, trips:[], payments:[] };
      save(); render(); toast("Alt nulstillet");
    }
  });

  // ---------- init ----------
  load();
  document.getElementById("tDate").value = today();
  document.getElementById("pDate").value = today();
  render();
})();
