(function () {
  var form = document.getElementById('login-form');
  var err = document.getElementById('login-error');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    err.textContent = '';
    var btn = form.querySelector('button');
    btn.disabled = true;
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: form.username.value, password: form.password.value })
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        if (res.ok) location.href = '/admin';
        else { err.textContent = res.j.error || 'No se pudo ingresar.'; btn.disabled = false; }
      })
      .catch(function () { err.textContent = 'Error de conexión.'; btn.disabled = false; });
  });
})();
