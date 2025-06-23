(function checkLoginStatus() {
  const loggedIn = localStorage.getItem('loggedIn');
  if (!loggedIn) {
    // Not logged in, redirect to login page
    window.location.href = 'login.html';
  }
})();