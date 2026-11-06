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

The score sets the pace (`LEVELS` in `reflex.js`). As soon as a field goes, the next one comes. The mission color counts as
a lit field, on at most half of them. Several fingers can tap at once: each tap counts, and if one is on the mission color
the game is over.

| Score | Fields always lit | A field runs out in |
|-------|-------------------|---------------------|
| 0-10 | 1 | 2 s |
| 11-30 | 2 | 2 s |
| 31-40 | 3 | 2 s |
| 41-50 | 3 | 1.75 s |
| 51-70 | 4 | 1.75 s |
| 71-80 | 5 | 1.5 s |
| 81-90 | 5 | 1.3 s |
| 91-110 | 6 | 1.3 s |
| 111 and up | 7 | 1.3 s |

The modes differ in how many colors they use. Settings (top right, in all games) pause the game: dark mode, sound volume, music volume, restart, back to games. Restarting or
leaving during a game doesn't save its score.

Turned sideways, the game goes full screen with the first tap on Android. On the iPhone and iPad, Add to Home Screen gives
the full screen: the iPhone's Safari doesn't allow it for web pages, and the iPad's keeps warning about a fake keyboard when tapping quickly.

## Lane Dodge

A cat runs up a three-lane road while cars and kids on bikes, roller skates and skateboards come towards her. Tap the left or right side, or swipe, to
change lanes (arrow keys without a touch screen). A row you pass without a hit is a point, and a hit turns an X red; the third ends the game. As the
score rises everything comes faster, the free road between rows gets shorter and more rows block two lanes (`LEVELS` in `dodge.js`). There is always a
free lane. It has its own music (`TUNES` in `sound.js`) and its own look, all drawn in code (`scene.js`).

## Scribble Math

Sums on the left, and you write the answer on the right with a finger or pen. A laptop or PC without a touch screen has no pad: you type the answer, and Enter starts a game and Esc pauses it. A right answer brings the next sum
right away and is a point. A wrong one turns red and clears, so you can try again while the time runs, because it could be a misread digit. If the time
for a sum runs out an X turns red; the third ends the game. As the score rises there is less time, and + and - grow into x and / and bigger numbers (`LEVELS` in
`math.js`). All answers are whole numbers from 1 to 99. It has its own music (`TUNES` in `sound.js`).

The digits are read on the device (`digits.js`) by a small network (`digit-model.js`), trained on the [Pen-Based Recognition of Handwritten
Digits](https://archive.ics.uci.edu/dataset/81) data by E. Alpaydin and F. Alimoglu (CC BY 4.0). It read 98.3% of the digits of 14 writers it wasn't trained on.

## Mission: Meow

Kittens have been abducted, and a girl with small wings flies through the lab to save them; the score is how far she gets. Hold to rise, let go to sink (Space or the up arrow on a computer). Flying uses energy, and stars in lines, waves
and arcs fill it up. A warning comes when it runs low; with none left she walks and jumps until she has collected a full bar. Touching spikes or a laser costs a heart; the third ends the game. The pace stays the same.

Each glass tube she reaches frees a kitten. Every 5 kittens a big star comes, worth much more energy; every 10 give a boost in a bubble, faster and safe, that blinks before it goes; every 20 give a heart back.

The look is the user's picture: `mission/art` holds its pieces, cut out and upscaled, and `mission/scene.js` puts them together with the lab it draws behind them.

## Leaderboards

Each mode of Reflex Tap has its own top 20, and Lane Dodge, Scribble Math and Mission: Meow have one each. A name is on it once, with its best score. Of two equal scores the one reached first ranks higher, and on a
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
| `src/main/resources/static/game.js`, `game.css` | what the games share: top bar, settings menu, leaderboard, game over screen |
| `src/main/resources/static/sound.js` | the sounds and music, made in the browser |
| `src/main/resources/static/reflex/` | Reflex Tap |
| `src/main/resources/static/dodge/` | Lane Dodge |
| `src/main/resources/static/math/` | Scribble Math |
| `src/main/resources/static/mission/` | Mission: Meow |
| `src/main/java/games/Leaderboard.java` | the rules of the list, in SQLite (`games.db`) |
| `src/main/java/games/LeaderboardController.java` | `GET`/`POST /api/leaderboard/{game}` |
| `src/main/java/games/AccessCode.java`, `AccessFilter.java`, `LoginController.java` | the access code |
| `Dockerfile` | the image for the NAS |

Font: Fredoka (SIL Open Font License), in `static/fredoka.woff2`.
