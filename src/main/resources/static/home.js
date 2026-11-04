document.getElementById('theme-button').addEventListener('click', () => {
    Theme.set(Theme.current() === 'dark' ? 'light' : 'dark');
});
