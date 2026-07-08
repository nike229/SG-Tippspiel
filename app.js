const API = "https://sg-tippspiel.onrender.com";

let token = localStorage.getItem("token");

let isAdmin = false;

let currentUser = null;

function decodeUser(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    isAdmin = payload.role === "admin";
    currentUser = payload.username;
  } catch (e) {
    isAdmin = false;
    currentUser = null;
  }
}

async function login() {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;

  const res = await fetch(API + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (data.token) {
    token = data.token;
    localStorage.setItem("token", token);
    decodeUser(token);
    loadGames();
  } else {
    alert("Login fehlgeschlagen");
  }
}

async function register() {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;

  await fetch(API + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  alert("Registriert! Jetzt einloggen.");
}

function renderLogin() {
  document.getElementById("app").innerHTML = `
    <h2>Login</h2>
    <input id="user" placeholder="Username" autocomplete="username"><br>
    <input id="pass" type="password" placeholder="Password" autocomplete="current-password"><br>
    <button onclick="login()">Login</button>
    <button onclick="register()">Registrieren</button>
  `;
}

async function loadGames() {
  const [gamesRes, tipsRes] = await Promise.all([
    fetch(API + "/api/games", {
      headers: { Authorization: "Bearer " + token }
    }),
    fetch(API + "/api/my-tips", {
      headers: { Authorization: "Bearer " + token }
    })
  ]);

  const games = await gamesRes.json();
  const tips = await tipsRes.json();

const tipMap = {};

tips.forEach(t => {
  if (!tipMap[t.game_id]) {
    tipMap[t.game_id] = [];
  }
  tipMap[t.game_id].push(t);
});

  let html = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
      <div>
        <h2 style="margin:0">Spiele</h2>
        <p style="margin:4px 0 0 0">👤 Eingeloggt als: <b>${currentUser}</b></p>
      </div>
      <button 
        onclick="logout()" 
        style="background:#f44336; color:white; border:none; padding:8px 14px; border-radius:4px; cursor:pointer; font-size:14px;">
        🚪 Logout
      </button>
    </div>
  `;

if (isAdmin) {
  html += `
    <h3>➕ Spiel erstellen</h3>
    <input id="home" placeholder="Heimteam">
    <input id="away" placeholder="Auswärtsteam">
    <input id="kickoff" placeholder="Kickoff (YYYY-MM-DD)">
    <button onclick="createGame()">Erstellen</button>
    <hr>

    <h3>⚙️ Einstellungen – Passwortverwaltung</h3>
    <div id="user-list">
      <p style="color:#999">Wird geladen...</p>
    </div>
    <hr>
  `;
}

  html += games.map(g => {
    const myTips = tipMap[g.id] || [];

    return `
      <div style="margin-bottom:12px; padding:10px; border:1px solid #ddd;">
        <b>${g.home_team} vs ${g.away_team}</b>
        ${g.result_home !== null && g.result_away !== null
        ? `<span style="margin-left:10px; background:#e8f5e9; color:#2e7d32; padding:2px 8px; border-radius:4px; font-size:14px;">
            ✅ Ergebnis: ${g.result_home} : ${g.result_away}
            </span>`
            : `<span style="margin-left:10px; color:#999; font-size:13px;">Kein Ergebnis eingetragen</span>`
        }
        <br>

    ${isAdmin ? `
      <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px;">
        <input placeholder="Ergebnis Heim" id="rh${g.id}" style="width:120px;">
        <input placeholder="Ergebnis Auswärts" id="ra${g.id}" style="width:120px;">
        <button onclick="setResult('${g.id}')">💾 Ergebnis speichern</button>
        <button 
          onclick="toggleLock('${g.id}', ${g.locked})"
          style="background:${g.locked ? '#4caf50' : '#f44336'}; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
          ${g.locked ? '🔓 Entsperren' : '🔒 Sperren'}
        </button>
        <button
          onclick="evaluateGame('${g.id}')"
          style="background:#ff9800; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
          🏆 Auswerten
        </button>
        <button
          onclick="deleteGame('${g.id}')"
          style="background:#9e9e9e; color:white; border:none; padding:6px 12px; border-radius:4px; cursor:pointer;">
          🗑️ Spiel löschen
        </button>
      </div>
      ${g.locked ? '<span style="color:#f44336; font-size:12px;">⛔ Tipps gesperrt</span>' : ''}
      ${g.evaluated ? '<span style="color:#ff9800; font-size:12px; margin-left:8px;">✅ Bereits ausgewertet</span>' : ''}
    ` : `
          <div>
            <input 
              placeholder="Tore Heim" 
              id="t${g.id}_h" 
              value="${myTips.length ? myTips[0].tip_home : ''}"
              ${g.locked ? 'disabled style="background:#f0f0f0; color:#999;"' : ''}
            >
            <input 
              placeholder="Tore Auswärts" 
              id="t${g.id}_a" 
              value="${myTips.length ? myTips[0].tip_away : ''}"
              ${g.locked ? 'disabled style="background:#f0f0f0; color:#999;"' : ''}
            >
            ${g.locked 
              ? '<p style="color:#f44336; font-size:13px;">⛔ Tippabgabe gesperrt</p>' 
              : `<button onclick="tip('${g.id}', this)">Speichern</button>`
            }
          </div>
        `}

        ${g.evaluated ? `
          <div style="margin-top:10px; padding:10px; background:#fff8e1; border-radius:4px; border-left:4px solid #ff9800;">
            <b>🏆 Gewinner:</b><br>
            ${g.winners && g.winners.length > 0
              ? g.winners.map(w => `<span style="color:#ff9800;">🥇 ${w}</span>`).join("<br>")
              : '<span style="color:#999;">Keine richtigen Tipps</span>'
            }
          </div>
        ` : myTips.length ? `
          <div style="color:green;">
            ✔ Deine Tipps:<br>
            ${myTips.map(t => `
              <div>
                - ${t.tip_home} : ${t.tip_away}
                <button onclick="deleteTip('${t.id}')" style="margin-left:10px;">🗑️</button>
              </div>
            `).join("")}
          </div>
        ` : `
          <div style="color:#999;">Noch kein Tipp abgegeben</div>
        `}
      </div>
    `;
  }).join("");

  document.getElementById("app").innerHTML = html;

  if (isAdmin) {
  loadUserList();
}
}

async function tip(gameId, btn) {
  const home = document.getElementById(`t${gameId}_h`).value;
  const away = document.getElementById(`t${gameId}_a`).value;

  if (home === "" || away === "") {
    alert("Bitte beide Ergebnisse eingeben");
    return;
  }

  const res = await fetch(API + "/api/tips/" + gameId, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      tip_home: Number(home),
      tip_away: Number(away)
    })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || JSON.stringify(data));
    console.log("TIP ERROR DETAIL:", data);
    return;
  }

  loadGames();
}

async function createGame() {
  await fetch(API + "/api/games", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({
      home_team: document.getElementById("home").value,
      away_team: document.getElementById("away").value,
      kickoff: document.getElementById("kickoff").value,
      matchday: 1
    })
  });

  loadGames();
}

async function setResult(id) {
  const result_home = document.getElementById("rh" + id).value;
  const result_away = document.getElementById("ra" + id).value;

  await fetch(API + "/api/games/" + id + "/result", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ result_home, result_away })
  });

  loadGames();
}


async function showEvaluation(gameId, container) {
  const res = await fetch(API + "/api/games/" + gameId + "/evaluate");
  const data = await res.json();

  const winners = data.winners || [];

  const html = `
    <div style="margin-top:10px; padding:10px; background:#e8f5e9;">
      <b>🏁 Ergebnis:</b> ${data.game.result_home} : ${data.game.result_away}<br><br>
      <b>✔ Richtige Tipps:</b><br>
      ${winners.length > 0
        ? winners.map(w => `- ${w.username || "Spieler"}`).join("<br>")
        : "Keine Treffer"}
    </div>
  `;

  container.innerHTML += html;
}

async function loadMyTips() {
  const res = await fetch(API + "/api/my-tips", {
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const tips = await res.json();

  let html = `<h2>📊 Meine Tipps</h2>`;

  if (!tips.length) {
    html += `<p>Noch keine Tipps abgegeben.</p>`;
  } else {
    html += tips.map(t => `
      <div style="margin-bottom:10px; padding:8px; border:1px solid #ccc;">
        Spiel: ${t.game_id}<br>
        Tipp: ${t.tip_home} : ${t.tip_away}
      </div>
    `).join("");
  }

  document.getElementById("app").innerHTML += html;
}

window.onload = () => {
  const token = localStorage.getItem("token");

  if (token) {
    decodeUser(token);
    loadGames();
  } else {
    renderLogin();
  }
};

async function deleteTip(tipId) {
  const res = await fetch(API + "/api/tips/" + tipId, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler beim Löschen");
    return;
  }

  loadGames();
}

async function loadUserList() {
  const res = await fetch(API + "/api/users", {
    headers: { Authorization: "Bearer " + token }
  });

  const users = await res.json();

  const html = users.map(u => `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:8px; border:1px solid #ddd;">
      <span style="min-width:120px"><b>${u.username}</b></span>
      <input 
        type="password" 
        id="pw-${u.id}" 
        placeholder="Neues Passwort" 
        style="width:150px"
      >
      <button onclick="resetPassword('${u.id}')">🔑 Zurücksetzen</button>
    </div>
  `).join("");

  document.getElementById("user-list").innerHTML = html;
}

async function resetPassword(userId) {
  const newPassword = document.getElementById("pw-" + userId).value;

  if (!newPassword) {
    alert("Bitte ein neues Passwort eingeben");
    return;
  }

  const res = await fetch(API + "/api/users/" + userId + "/reset-password", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ newPassword })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler beim Zurücksetzen");
    return;
  }

  alert("✅ Passwort wurde zurückgesetzt");
  document.getElementById("pw-" + userId).value = "";
}

async function toggleLock(gameId, currentlyLocked) {
  const res = await fetch(API + "/api/games/" + gameId + "/lock", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ locked: !currentlyLocked })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler beim Sperren");
    return;
  }

  loadGames();
}

function logout() {
  localStorage.removeItem("token");
  token = null;
  isAdmin = false;
  currentUser = null;
  renderLogin();
}

async function evaluateGame(gameId) {
  const res = await fetch(API + "/api/games/" + gameId + "/evaluate", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler bei der Auswertung");
    return;
  }

  loadGames();
}

async function deleteGame(gameId) {
  if (!confirm("Spiel wirklich löschen? Alle Tipps werden ebenfalls gelöscht.")) return;

  const res = await fetch(API + "/api/games/" + gameId, {
    method: "DELETE",
    headers: {
      Authorization: "Bearer " + token
    }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler beim Löschen");
    return;
  }

  loadGames();
}
