// The player's name, for all games and leaderboards, remembered on the device. Without a name a page that
// loads this goes to the page that asks for one. Loaded in the head, so the page itself isn't shown first.
const Player = (() => {
    const KEY = 'games-player';

    function name() {
        try {
            return localStorage.getItem(KEY) || '';
        } catch (e) {
            return '';
        }
    }

    // Same cleaning as the server (LeaderboardController). False when the device can't remember it.
    function set(newName) {
        try {
            localStorage.setItem(KEY, clean(newName));
            return true;
        } catch (e) {
            return false;
        }
    }

    function clean(text) {
        return text.trim().replace(/\s+/g, ' ');
    }

    return {name, set, clean};
})();

if (!Player.name() && location.pathname !== '/name.html') {
    location.replace('/name.html');
}
