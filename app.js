const API = "https://sg-tippspiel.onrender.com";

let token = localStorage.getItem("token");

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

  document.getElementById("app").innerHTML = `
    <h2>Spiele</h2>
    ${games.map(g => `
      <div>
        <b>${g.home_team} vs ${g.away_team}</b><br>
        <input placeholder="Tore Heim">
        <input placeholder="Tore Auswärts">
        <button onclick="tip('${g.id}', this)">Tippen</button>
      </div>
    `).join("")}
  `;
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
