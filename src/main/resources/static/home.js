// Also when swiping back brings this page back as it was, after the name was changed
function showPlayer() {
    document.getElementById('player-name').textContent = Player.name();
}

showPlayer();
window.addEventListener('pageshow', showPlayer);

document.getElementById('theme-button').addEventListener('click', () => {
    Theme.set(Theme.current() === 'dark' ? 'light' : 'dark');
});
