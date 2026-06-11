const API = "https://sg-tippspiel.onrender.com";

let token = localStorage.getItem("token");

let isAdmin = false;

let currentUser = null;

function decodeUser(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    isAdmin = payload.username === "Admin";
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
    <input id="user" placeholder="Username"><br>
    <input id="pass" type="password" placeholder="Password"><br>
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
    tipMap[t.game_id] = t;
  });

  let html = `
    <h2>Spiele</h2>
    <p>👤 Eingeloggt als: <b>${currentUser}</b></p>
  `;

  if (isAdmin) {
    html += `
      <h3>➕ Spiel erstellen</h3>
      <input id="home" placeholder="Heimteam">
      <input id="away" placeholder="Auswärtsteam">
      <input id="kickoff" placeholder="Kickoff (YYYY-MM-DD)">
      <button onclick="createGame()">Erstellen</button>
      <hr>
    `;
  }

  html += games.map(g => {
    const myTip = tipMap[g.id];

    return `
      <div style="margin-bottom:12px; padding:10px; border:1px solid #ddd;">
        <b>${g.home_team} vs ${g.away_team}</b><br>

        ${isAdmin ? `
          <div>
            <input placeholder="Ergebnis Heim" id="rh${g.id}">
            <input placeholder="Ergebnis Auswärts" id="ra${g.id}">
            <button onclick="setResult('${g.id}')">Ergebnis speichern</button>
          </div>
        ` : `
          <div>
            <input placeholder="Tore Heim" id="t${g.id}_h" value="${myTip?.tip_home ?? ''}">
            <input placeholder="Tore Auswärts" id="t${g.id}_a" value="${myTip?.tip_away ?? ''}">
            <button onclick="tip('${g.id}', this)">Speichern</button>
          </div>
        `}

        ${myTip ? `
          <div style="margin-top:5px; color:green;">
            ✔ Dein Tipp: ${myTip.tip_home} : ${myTip.tip_away}
          </div>
        ` : `
          <div style="margin-top:5px; color:#999;">
            Noch kein Tipp abgegeben
          </div>
        `}
      </div>
    `;
  }).join("");

  document.getElementById("app").innerHTML = html;
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
    alert(data.error || "Fehler beim Speichern");
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
