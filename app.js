const API = "https://sg-tippspiel.onrender.com";

async function login() {
  const username = document.getElementById("user").value;
  const password = document.getElementById("pass").value;

  const res = await fetch(API + "/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  alert(JSON.stringify(data));
}

document.getElementById("app").innerHTML = `
  <h2>Login</h2>
  <input id="user" placeholder="Username"><br>
  <input id="pass" type="password" placeholder="Password"><br>
  <button onclick="login()">Login</button>
`;
