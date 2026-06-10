const API = "https://sg-tippspiel.onrender.com";

let token = localStorage.getItem("token");

let isAdmin = false;

function decodeUser(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    isAdmin = payload.username === "Admin";
  } catch (e) {
    isAdmin = false;
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

async function loadGames() {
  const res = await fetch(API + "/api/games", {
    headers: { Authorization: "Bearer " + token }
  });

  const games = await res.json();

  let html = `<h2>Spiele</h2>`;

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

  html += games.map(g => `
    <div style="margin-bottom:10px;">
      <b>${g.home_team} vs ${g.away_team}</b><br>

      ${isAdmin ? `
        <input placeholder="Ergebnis Heim" id="rh${g.id}">
        <input placeholder="Ergebnis Auswärts" id="ra${g.id}">
        <button onclick="setResult('${g.id}')">Ergebnis speichern</button>
      ` : `
        <input placeholder="Tore Heim">
        <input placeholder="Tore Auswärts">
        <button onclick="tip('${g.id}', this)">Tippen</button>
      `}
    </div>
  `).join("");

  document.getElementById("app").innerHTML = html;
}

async function tip(gameId, btn) {
  const parent = btn.parentElement;
  const inputs = parent.querySelectorAll("input");

  const tip_home = inputs[0].value;
  const tip_away = inputs[1].value;

  await fetch(API + "/api/tips/" + gameId, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + token
    },
    body: JSON.stringify({ tip_home, tip_away })
  });

  alert("Tipp gespeichert");
}

document.getElementById("app").innerHTML = `
  <h2>Login</h2>
  <input id="user" placeholder="Username"><br>
  <input id="pass" type="password" placeholder="Password"><br>
  <button onclick="login()">Login</button>
  <button onclick="register()">Registrieren</button>
`;

if (token) {
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
