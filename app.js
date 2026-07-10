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
  const username = document.getElementById("user").value.trim();
  const password = document.getElementById("pass").value.trim();

  // Clientseitige Prüfung (schnelles Feedback ohne Server-Roundtrip)
  if (!username) {
    alert("Bitte einen Benutzernamen eingeben");
    return;
  }

  if (!password) {
    alert("Bitte ein Passwort eingeben");
    return;
  }

  const res = await fetch(API + "/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Registrierung fehlgeschlagen");
    return;
  }

  alert("✅ Registriert! Jetzt einloggen.");
}

function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div class="login-box">
      <h2>Login</h2>
      <input id="user" placeholder="Username" autocomplete="username">
      <input id="pass" type="password" placeholder="Passwort" autocomplete="current-password">
      <button onclick="login()">Login</button>
      <button onclick="register()" style="background:#4caf50; margin-top:4px;">Registrieren</button>
    </div>
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
  <div class="top-bar">
    <div>
      <h2>Spiele</h2>
      <p style="font-size:13px; color:#555;">👤 ${currentUser}</p>
    </div>
    <button onclick="logout()">🚪 Logout</button>
  </div>
`;

if (isAdmin) {
  html += `
    <div class="create-game-box">
      <h3>➕ Spiel erstellen</h3>
      <input id="home" placeholder="Heimteam">
      <input id="away" placeholder="Auswärtsteam">
      <input id="kickoff" placeholder="Kickoff (YYYY-MM-DD)">
      <button onclick="createGame()">Erstellen</button>
    </div>

    <div class="create-game-box">
      <h3>⚙️ Einstellungen – Passwortverwaltung</h3>
      <div id="user-list">
        <p style="color:#999; font-size:14px;">Wird geladen...</p>
      </div>
    </div>
  `;
}

html += games.map(g => {
  const myTips = tipMap[g.id] || [];

  const resultBadge = g.result_home !== null && g.result_away !== null
    ? `<span class="game-result">✅ ${g.result_home} : ${g.result_away}</span>`
    : `<span class="game-no-result">Kein Ergebnis eingetragen</span>`;

  const adminBlock = isAdmin ? `
    <div class="admin-inputs">
      <input placeholder="Ergebnis Heim" id="rh${g.id}">
      <input placeholder="Ergebnis Auswärts" id="ra${g.id}">
    </div>
    <div class="admin-actions">
      <button onclick="setResult('${g.id}')">💾 Ergebnis speichern</button>
      <button onclick="toggleLock('${g.id}', ${g.locked})"
        style="background:${g.locked ? '#4caf50' : '#f44336'};">
        ${g.locked ? '🔓 Entsperren' : '🔒 Sperren'}
      </button>
      <button onclick="evaluateGame('${g.id}')"
        style="background:#ff9800;">
        🏆 Auswerten
      </button>
      <button onclick="showTipsOverview('${g.id}')"
        style="background:#1a73e8;">
        📋 Tippübersicht
      </button>
      <button onclick="deleteGame('${g.id}')"
        style="background:#9e9e9e;">
        🗑️ Spiel löschen
      </button>
    </div>
    ${g.locked ? '<span class="badge-locked">⛔ Tipps gesperrt</span>' : ''}
    ${g.evaluated ? '<span class="badge-evaluated">✅ Bereits ausgewertet</span>' : ''}
  ` : '';

  const userBlock = !isAdmin ? `
    <div class="tip-area">
      ${g.evaluated ? `
        <div class="winners-box">
          <b>🏆 Gewinner:</b><br>
          ${g.winners && g.winners.length > 0
            ? g.winners.map(w => `<span style="color:#ff9800;">🥇 ${w}</span>`).join("<br>")
            : '<span style="color:#999;">Keine richtigen Tipps</span>'
          }
        </div>
      ` : `
        <div class="tip-inputs">
          <input type="number" placeholder="Heim" id="t${g.id}_h"
            value="${myTips.length ? myTips[0].tip_home : ''}"
            ${g.locked ? 'disabled' : ''}>
          <span>:</span>
          <input type="number" placeholder="Auswärts" id="t${g.id}_a"
            value="${myTips.length ? myTips[0].tip_away : ''}"
            ${g.locked ? 'disabled' : ''}>
        </div>
        ${g.locked
          ? '<p class="tip-locked">⛔ Tippabgabe gesperrt</p>'
          : `<button class="tip-save-btn" onclick="tip('${g.id}', this)">💾 Speichern</button>`
        }
        ${myTips.length ? `
          <div class="tips-list">
            ✔ Deine Tipps:<br>
              ${myTips.map(t => `
                <div>
                  - ${t.tip_home} : ${t.tip_away}
                  ${!g.locked && !g.evaluated
                    ? `<button onclick="deleteTip('${t.id}')">🗑️</button>`
                    : ''
                  }
                </div>
              `).join("")}
          </div>
        ` : '<div style="color:#999; font-size:14px; margin-top:8px;">Noch kein Tipp abgegeben</div>'}
      `}
    </div>
  ` : '';

  return `
    <div class="game-card">
      <div class="game-title">
        ${g.home_team} vs ${g.away_team}
        ${resultBadge}
      </div>
      ${adminBlock}
      ${userBlock}
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
    <div class="user-row">
      <span>👤 ${u.username}</span>
      <input type="password" id="pw-${u.id}" placeholder="Neues Passwort">
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

async function showTipsOverview(gameId) {
  const res = await fetch(API + "/api/games/" + gameId + "/tips-overview", {
    headers: { Authorization: "Bearer " + token }
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Fehler beim Laden der Tippübersicht");
    return;
  }

  const { game, grouped, maxTips } = data;

  // Spaltenheader für Tipps
  const tipHeaders = Array.from({ length: maxTips }, (_, i) =>
    `<th>Tipp ${i + 1}</th>`
  ).join("");

  const users = Object.keys(grouped);

  const rows = users.length > 0 ? users.map(username => {
    const userTips = grouped[username];
    const tipCells = Array.from({ length: maxTips }, (_, i) => {
      const t = userTips[i];
      return t
        ? `<td>${t.tip_home} : ${t.tip_away}</td>`
        : `<td style="color:#ccc;">–</td>`;
    }).join("");

    return `
      <tr>
        <td><b>${username}</b></td>
        <td>${game.home_team} vs ${game.away_team}</td>
        ${tipCells}
      </tr>
    `;
  }).join("") : `
    <tr>
      <td colspan="${maxTips + 2}" style="text-align:center; color:#999; padding:16px;">
        Noch keine Tipps abgegeben
      </td>
    </tr>
  `;

  const resultBadge = game.result_home !== null && game.result_away !== null
    ? `<span class="game-result">✅ ${game.result_home} : ${game.result_away}</span>`
    : `<span class="game-no-result">Kein Ergebnis eingetragen</span>`;

  document.getElementById("app").innerHTML = `
    <div class="top-bar">
      <div>
        <h2>Tippübersicht</h2>
        <p style="font-size:13px; color:#555;">👤 ${currentUser}</p>
      </div>
      <button onclick="loadGames()">⬅️ Zurück</button>
    </div>

    <div class="create-game-box">
      <div class="game-title">
        ${game.home_team} vs ${game.away_team}
        ${resultBadge}
      </div>
      <p style="font-size:13px; color:#555; margin-top:4px;">
        ${game.kickoff ? '📅 ' + game.kickoff : ''}
      </p>
    </div>

    <div style="overflow-x: auto; margin-top:8px;">
      <table class="tips-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Spiel</th>
            ${tipHeaders}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `;
}
