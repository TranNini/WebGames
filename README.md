# Games

Small games for phones and tablets, played in the browser. Runs on the NAS at https://games.kulose.de, with an
access code that each device enters once. Works on iPhone, iPad and Android; on the iPhone, tap Share →
"Add to Home Screen" to play it like an app.

## Reflex Tap

Pick a mode: **easy** has 4 colors, **medium** 6 and **hard** all 8. You get a mission: a color not to tap, a new one each
game. Then the 8 fields light up at random times in random colors, and each color drains away.

| What happens | Result |
|---|---|
| Tap a normal color | +1 point |
| A normal color runs out | One X turns red; the third ends the game |
| The mission color runs out | Nothing |
| Tap the mission color | Instant game over |

The longer you last, the faster fields fade and the more often they appear, and a field can light up while the last
one is still lit. Hard speeds up a little earlier and has that overlap from the start (`MODES` in `reflex.js`). Settings (top right) pause the game: dark mode, vibration, sound volume, music volume, back to games.
The phone vibrates at game over.

Turned sideways, the game goes full screen with the first tap (Android, iPad). Safari on the iPhone doesn't allow
that for web pages; there, Add to Home Screen gives the full screen.

### Leaderboard

Each mode has its own top 20. A name is on it once, with its best score. Of two equal scores the one reached first ranks higher, and on a
full list a new name needs more than last place. The game over screen shows the top 3 and your own place.

## Run locally

    mvn spring-boot:run

or run `games.GamesApp` in IntelliJ, then open http://localhost:8083. This Mac needs no access code; the code
for other devices is printed at the start. To try it on a phone at home over plain http:

    mvn spring-boot:run -Dspring-boot.run.arguments=--games.cookie-secure=false

and open `http://<the Mac's address>:8083`.

## Project structure

| File | What it does |
|---|---|
| `src/main/resources/static/index.html` | the start page, lists the games |
| `src/main/resources/static/style.css` | what all pages share |
| `src/main/resources/static/reflex/reflex.js` | Reflex Tap: the game, menu and game over screen |
| `src/main/resources/static/reflex/sound.js` | its sounds and music, made in the browser |
| `src/main/java/games/Leaderboard.java` | the rules of the list, in SQLite (`games.db`) |
| `src/main/java/games/LeaderboardController.java` | `GET`/`POST /api/leaderboard/{game}` |
| `src/main/java/games/AccessCode.java`, `AccessFilter.java`, `LoginController.java` | the access code |
| `Dockerfile` | the image for the NAS |

Font: Fredoka (SIL Open Font License), in `static/fredoka.woff2`.
