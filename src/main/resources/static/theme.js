// Dark or light, for all pages, remembered on the device. Loaded before the styles, so a page never flashes
// in the other mode first.
const Theme = (() => {
    const KEY = 'games-theme';
    const BAR_COLORS = {dark: '#17161c', light: '#f4f3f7'};

    function apply(theme) {
        document.documentElement.dataset.theme = theme;
        document.querySelector('meta[name="theme-color"]').content = BAR_COLORS[theme];
    }

    function current() {
        return document.documentElement.dataset.theme;
    }

    function set(theme) {
        apply(theme);
        try {
            localStorage.setItem(KEY, theme);
        } catch (e) {
            // not remembered (private mode)
        }
    }

    let saved = null;
    try {
        saved = localStorage.getItem(KEY);
    } catch (e) {
        // the default then
    }
    apply(saved === 'light' ? 'light' : 'dark');

    return {current, set};
})();
