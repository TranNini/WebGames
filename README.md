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

The score sets the pace (`LEVELS` in `reflex.js`). A field to tap is always lit: as soon as one goes, the next comes.
The mission color comes on top of those, on at most two fields at a time.

| Score | Fields to tap, always lit | A field runs out in |
|-------|---------------------------|---------------------|
| 0 | 1 | 2 s |
| 10 | 2 | 2 s |
| 20 | 3 | 2 s |
| 30 | 4 | 2 s |
| 40 | 4 | 1.75 s |
| 60 | 5 | 1.75 s |
| 70 | 5 | 1.5 s |
| 80 | 5 | 1.3 s |

The modes differ in how many colors they use. Settings (top right) pause the game: dark mode, vibration, sound volume, music volume, back to games.
The phone vibrates at game over.

Turned sideways, the game goes full screen with the first tap on Android. On the iPhone and iPad, Add to Home Screen gives
the full screen: the iPhone's Safari doesn't allow it for web pages, and the iPad's keeps warning about a fake keyboard when tapping quickly.

### Leaderboard

Each mode has its own top 20. A name is on it once, with its best score. Of two equal scores the one reached first ranks higher, and on a
full list a new name needs more than last place. The game over screen shows the top 3 and your own place.

Everyone enters a name once on their device, after the access code. It applies to all games and leaderboards, and scores are saved under it automatically. The start page has a link to change it; scores already on a list stay under the old name.

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
| `src/main/resources/static/name.html`, `name.js`, `player.js` | asks for the player's name, keeps it on the device |
| `src/main/resources/static/style.css` | what all pages share |
| `src/main/resources/static/reflex/reflex.js` | Reflex Tap: the game, menu and game over screen |
| `src/main/resources/static/reflex/sound.js` | its sounds and music, made in the browser |
| `src/main/java/games/Leaderboard.java` | the rules of the list, in SQLite (`games.db`) |
| `src/main/java/games/LeaderboardController.java` | `GET`/`POST /api/leaderboard/{game}` |
| `src/main/java/games/AccessCode.java`, `AccessFilter.java`, `LoginController.java` | the access code |
| `Dockerfile` | the image for the NAS |

Font: Fredoka (SIL Open Font License), in `static/fredoka.woff2`.
