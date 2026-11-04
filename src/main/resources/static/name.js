const nameInput = document.getElementById('name');
const nameError = document.getElementById('name-error');

// Reflex Tap kept the name itself before there was this page
function nameFromBefore() {
    try {
        return JSON.parse(localStorage.getItem('reflex-settings')).name || '';
    } catch (e) {
        return '';
    }
}

function showError(text) {
    nameError.textContent = text;
    nameError.hidden = false;
}

nameInput.value = Player.name() || nameFromBefore();

document.getElementById('name-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!Player.clean(nameInput.value)) {
        showError('Please enter a name to play.');
    } else if (!Player.set(nameInput.value)) {
        showError('This browser can\'t remember your name. Please check that it allows websites to save data.');
    } else {
        location.href = '/';
    }
});
