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
| 0-15 | 2 | 2 s |
| 16-24 | 2 | 1.825 s |
| 25-45 | 3 | 1.825 s |
| 46-59 | 3 | 1.65 s |
| 60-85 | 4 | 1.65 s |
| 86-99 | 4 | 1.475 s |
| 100-115 | 5 | 1.475 s |
| 116-135 | 5 | 1.3 s |
| 136 and up | 6 | 1.3 s |

During a game the mission color stays in the top bar, beside the score.

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
and arcs fill it up. A warning comes when it runs low; with none left she walks and jumps until she has collected a full bar. Touching spikes or a laser costs a heart; the third ends the game. Raised floor, as in the user's picture, can be flown or walked on, some of it with a kitten or an obstacle on top; running into its side costs a heart too, and spikes in front of it warn of that. Security drones fly above the road, more during alerts. Now and then a drone looks her way and shoots laser bolts along its height until it has left the screen. Kittens also wait on high raised floor and on floating platforms, and there are sections of lasers and platforms to weave through. Flying platforms come with spikes on top, under them or both, some with a laser from the platform to the floor or ceiling. The pace stays the same.

The lab changes every 200 m, with light and obstacles of its own, while the basic spikes and lasers stay: first the lab itself, with spiked slabs and moving platforms; then the machine hall (saws, swinging maces, spinning crosses, crushers, fans), the power plant (lightning, coils, electrified floor), the furnace (flames, acid) and the freezer (icicles, ice spikes, energy walls), and then round again.

She frees a kitten by touching its glass tube. Kittens in a row bring rewards: every 5 a big star, worth much more energy; every 10 a boost in a bubble, faster and safe, that blinks before it goes; every 25 a heart back.

A kitten missed breaks the streak and sets off a security alert of 10 seconds. The first shows a warning cat screen and breaks her wings, so she has to go on foot; the second flashes an alert banner and brings more lasers, obstacles and security drones; the third is maximum security with all of that, to survive until it is over. The music gets more tense with each level. Misses stay counted until she has saved 5 kittens in a row.

For trying it out, the settings have **Unlimited hearts** (such a run doesn't go on the leaderboard) and **Show touch areas**.

She comes from the user's sprite sheet (`frames.js`), the kittens and first obstacles from their picture, the drones, cat screen and banner from their warning sheet, and the obstacles of the areas from their obstacle sheet (`ob-*`): `mission/art` holds the pieces, upscaled, and `mission/scene.js` puts them together with the lab it draws behind them.

## Survive: Lost Island

A 3D survival game in the browser. After a plane crash (a film you can skip) you wake up alone on the beach of a tropical island, and have to stay alive for 30 days. From the morning of day 31 a rescue helicopter searches at 9 o'clock each day, and it only sees you if a big SOS of 34 stones lies on open sand. Without one it flies on and comes back the next day.

A day takes 8 minutes, so 30 days are about 4 hours, less when you sleep through the nights. The game saves itself on the device, so you can leave at any time and go on later; a new device starts a new island life. Dying ends that life.

- **Your body:** health, hunger, thirst, energy, rest and body temperature. Nights are cold, rain makes you wet, and a fire, clothes or a roof help. Raw food and river water can make you sick, snakes poison you, and underwater you run out of air.
- **The island:** beaches, open jungle, meadows, rivers, a swamp, a lagoon, caves, reefs and three small islands. The same island in every game; what you take grows back after some days.
- **Crafting and building:** axes, pickaxes, a shovel, knives, spears, a bow, a fishing rod, torches and clothes, in stone and in iron. Campfire, workbench, furnace, chests, beds, garden plots, rain collectors, a ready hut or large house, or your own from floors, walls, doors, windows and roofs that snap together; fences, bridges and a boat.
- **Animals:** parrots, monkeys, turtles, crabs, fish, wild boars, snakes, crocodiles and jaguars. An animal you hit shows a life bar. Some can be tamed with the right food and then stay with you: a monkey (bananas), a parrot (berries), a boar (coconuts) or a jaguar (grilled meat).
- **The night:** a tall dark figure with a white, faceless head walks at night. When it sees you there is a sound; it follows you, and when it reaches you, you are dead. It stays out of the light of a fire and out of deep water, and it is gone at sunrise.
- **Weather:** sunshine, clouds, rain, thunderstorms, fog and storms, and day and night.
- **Secrets:** the airplane wreckage, abandoned huts, hidden camps, an old weather station, caves, two shipwrecks, the islets and a buried treasure, with pages that tell the island's past.

On a phone or tablet: left thumb to walk, right thumb to look, the running figure switches running on and off (walking costs no energy, running does), and the yellow button does what it says. On a computer: WASD and the mouse, E or left click for the yellow button, F or right click for the other one; the journal lists all keys. The settings also have **Graphics** (auto, low, medium, high). The score is 100 points per day survived, plus places found, pages read and gold coins, and 2000 for being rescued; it goes on the leaderboard when the game ends.

Plants, bark, rock, wood and ground come from CC0 photos and scans by Poly Haven and ambientCG (`survive/art/LICENSE.txt`); rain and crickets are CC0 recordings from Freesound; shapes and the other sounds are made in code. 3D by [three.js](https://threejs.org) (MIT license, `survive/lib/`).

## Solitaire

Klondike, with no timer and made for one thumb. Build each suit from ace to king on the foundations; in the columns, cards go
down in alternating colors, and only a king goes into an empty column. Tap a card to move it, with the cards on it, to the
best place it fits: the foundation first, then a column with cards, then an empty one. Tapping it again moves it on to the
next column that fits, so there is nothing to drag. The deck and Undo are at the bottom, near the thumb; tap the deck to draw,
and once it is empty, to turn the cards over again (as often as you like). A covered card turns over by itself, Undo has no
limit, and when all cards are face up and none are left to draw, they go up on their own. It has its own unhurried music (`TUNES` in `sound.js`).

**Draw 1** turns over one card at a time, **Draw 3** three. Each has its own leaderboard of the fewest moves to win a game:
every card moved counts, and the deck too, while Undo takes its move back. The games played and won, and the fewest moves,
are counted on the device (so Safari and a home screen app count apart). The game is kept on the device: leave whenever you like and Continue later.
Restart in the settings gives the deal up. A computer works too: Space draws, Z or Backspace undoes, Esc pauses.

## Mahjong

Mahjong solitaire against the clock, made for one thumb: clear the board by taking away pairs of matching tiles. A tile can
be taken when nothing lies on it and its left or right side is open. Tap one, then its partner. Any two flowers match, and
any two seasons. Every deal can be cleared: the faces are given out by taking the tiles away in pairs first (`board.js`).
When no pair is left, Shuffle mixes the tiles still there so that they can again all be cleared; when that can't be done any
more (say, the last pair lies one on the other), Undo goes back. Hint shows a pair, and Undo has no limit, shuffles included.

Three levels: **Easy** has 72 tiles, **Medium** 108 and **Hard** all 144, each in eight layouts of its own (Easy:
Garden, Butterfly, Pyramid, Bridge, Heart, Cross, Hills, Wreath; Medium: Lotus, Twin Towers, Courtyard, Hourglass,
Diamond, Crown, Bowl, Arrow; Hard: Temple, Mountains, Castle, Terraces, Pagoda, Lattice, Gate, Stadium). The first screen shows them with their outlines: pick one, or Random (one of the level's layouts, never the
same twice in a row). The pick is kept per level. The layout's name is in the top bar and on the end screen. With **No hints** on, there is no Hint button and every tile looks the same (also on Easy and Medium);
those games have their own leaderboards. Otherwise, on Easy and Medium, tiles that can't be taken yet
have a slightly darker face; on Hard they look like the rest. The score is the time: the clock in the top bar starts with the
deal and stops while the game is paused (menu, phone locked, app left), a hint adds 15 seconds and a shuffle 30. Each level
has its own leaderboard of the fastest times (`Leaderboard.LOWEST_FIRST`: lowest first, and a name keeps its fastest).

A phone held sideways gets a wide layout, upright a tall one; a game keeps its layout when the phone turns. The game, with
its time so far, is kept on the device like Solitaire's. The tiles are our own drawings of the usual faces (`faces.js`);
characters and winds carry a small number or letter in the corner. It has its own music. On a computer: H for a hint, Z or
Backspace undoes, Esc pauses.

## Moto Race

A race on motorcycles against friends, each on their own phone, each seeing the road from behind their own bike: a trip
together from a start to a goal. One taps **New race**; the others see it under Races waiting and tap **Join** (up to 6
riders). The one who opened it picks the course, adds computer riders if they like (**Computer riders**, − and +: from none
up to as many as fit next to the people) and starts; alone, it is **Ride alone**. A countdown, then from the START
banner to the GOAL, about one and a half minutes; the bar shows how far it still is, and a line under it where everyone
is. The bike speeds up by itself: hold the left or right half of the screen to steer, both to brake (on a computer: the
arrow keys, Down or Space to brake). **Turbo** (the round button at the bottom; Up or W) pulls the bike hard up to 290 km/h
for 50 m, a little flame out of each exhaust; then its ring fills up again over 10 seconds before it can be used again. A
crash ends it; braking still brakes. The computer riders don't use it. Two bikes that touch ease apart steadily, side by side, the one behind held at the other's speed after a first knock;
bends push the bike outwards, the more the faster it goes; off the road it is
slower, and riding into a tree or a rock beside it is a crash: the bike is carried back onto the road and then rides
through everything for a moment, blinking. A ramp across the road throws the bike into the air, the further the faster it
comes (about 80 m at full speed): it keeps its speed, can turn only a little and flies over what is on the road; every phone
works out the others' flights from where they are and how fast they go (`Track.airOf`), so nothing more is sent. Riding
right behind another bike gives up to 10% more speed; running into one
slows you down.

Computer riders (Aiko, Kenji, Mika, Ren, Sora) are ridden by the phone that opened the race (`Track.computer`: they keep a
line, cut to the inside of bends, slow for the sharpest ones and ride round slower bikes, on one side, kept until they are past) and sent on with its own bike, so
everyone sees them. Each has its own top speed, and they ease off when far ahead of the people and push when far behind,
so a race stays close. Their times aren't on the leaderboard; when the people are all in, a computer rider still on the way
gets its time at the speed it has. A person joining a full race takes a computer rider's place. If the one who opened it
leaves during the race, the next person's phone rides the computer riders on.

Levels: the one who opened the race picks **Easy**, **Medium** or **Hard** for the course and for the computer riders.
- The course: Easy is a clear road; Medium has something standing on it every 360 to 540 m (not in sharp bends); Hard every
  140 to 220 m, also in bends, often two on both sides of the road with the way through between them. A standing car with
  its hazard lights on, rocks, crabs, a tree stump, traffic cones, a truck, a moped or a rockslide, by course (`Track.TRACKS[...].obstacles`), the same on every
  phone. Riding into one from behind stops the bike short, and it slides round to the side with room; along one, it is held
  off it. Each course level has its own leaderboard (`moto-canyon`, `moto-canyon-medium`, `moto-canyon-hard`).
- The computer riders (`Track.COMPUTER_LEVELS`): Easy ease off a lot when ahead and see what is on the road late; Medium
  ride faster and ease off less; Hard are faster still, with a little more top speed than a bike has, hardly ease off and see
  far ahead.

The courses: **Seaside** (long bends along the sea and some sharp ones, two ramps a lap, palms, rocks, huts
and sun umbrellas with a swim ring and a sun chair; crabs crossing the road), **Canyon** (sharp
turns and steep hills, cacti, boulders and mesas; its medium has as much on the road as hard elsewhere, and its hard is
that on a wilder road with higher crests, deeper drops and bends to brake for), and **Forest** (winding through pines and birches at dusk), all drawn in code. **Heaven's Gate** (Tianmen to Chongqing; named as in the test page, 2026-11-20) is ridden once from start to goal and is exactly the user's test page
(`tianmen-to-chongqing-course.html`, "real game version", the final one of 2026-11-18, which runs the game's own `track.js` and
`scene.js`): 5.8 km in three stretches. First the mountain: 1.95 km down ten hairpins and about 310 m of drop, the last
part steep through the third tunnel. A forest slope is on the left, a stone wall over the valley on the right, guardrails
on both sides, and a river with 16 junks and sampans runs along the valley floor (seen between the tunnel pillars too).
The tunnels are concrete galleries with orange lamps, open sides and a red neon line. Green peaks far off rise as the
road goes down, day turns to dusk, the peaks fade, and Chongqing's towers come up. The last tunnel comes out in Chongqing
at night. First comes the old town: 600 m of hillside houses on the left (stilted tiers with warm windows, balconies,
red paper lanterns and tiled eaves on a lavender retaining wall). Then, 300 m on, a long straight cable-stayed bridge
over the river far below, with two pale A-frame pylons, red stay cables, a blinking light on top, amber lights in the
barriers and a yellow line on the left. Then the riverside, and 700 m after the last red cable the city: dark skyscrapers with lit windows on both sides of the road, taller and denser the further in, and 18 lamp posts on each side, level across the road (no lights in the barriers there). Far off, all drawn: violet hills, the city's towers, clouds,
and stars as the night deepens; river boats with lit decks, reflections, lamp posts and their glow on the wet road. Its bends push a bike out a third as hard as they look (a fifth on
easy), and in the hairpins a bike goes up to 40% slower by itself. The bike can't leave the road (rubbing along a rail
slows it down). On medium and hard, stone sledges (a wooden sledge hauling a cut stone block) stand on the road
among the trucks, mopeds and rockslides, inside the lit tunnels too (not at their mouths).
**Mountain Passage** (key `countryside`, added 2026-11-20) is ridden once too and is exactly the user's test page
`mountain-passage.html` (it runs the game's own `track.js` and `scene.js`): 5.1 km on a bright day. Rice fields with
farmers on the left, a village with houses, hens, baskets and lamps, an elevated railway wall with cherry trees on the
right and a bullet train coming up from behind and overtaking (one, 50 m into the race); then the road climbs away from
the railway, through dips and sharp bends, into a mountain valley with a river and pines, under layered blue mountains.
The road ends at a viewpoint 92 m after the goal, where the bikes roll to a stop. On medium and hard, cars and cones
stand on the road. With it, every course took Heaven's Gate's camera (6.5 m behind the bike, horizon lower, 920 m drawn).
The others are each a loop of bends and hills ridden three times over, one after the other, from the start to the goal. (From 2026-11-11 to
2026-11-13 the courses were Sakura River, Neon City and Mountain Pass, made from the user's pictures; the user took them
out again; on 2026-11-19 the looped Chongqing course, up and down the mountain city at night, went too. Their times stay
in the database, unlisted.)

The phones talk to the server over a WebSocket (`/api/race`, checked by the access code like everything else). Each phone
rides its own bike (`track.js`) and sends where it is 15 times a second; the server passes that on to the others with how
old it is, and each phone draws the others where they should be now. The server counts the start down, keeps the order
at the goal by its own clock, gives the others a minute after the winner, and puts each finish on the course's
leaderboard of fastest times (`moto-seaside`, `moto-canyon`, `moto-forest`, `moto-tianmen`, `moto-countryside`; only the server adds to them). The menu
doesn't stop the race. Afterwards the one who opened the race can start another with the same riders. It has its own
music and a soft engine hum that follows the speed.

## Leaderboards

Each mode of Reflex Tap has its own top 20, and Lane Dodge, Scribble Math, Mission: Meow and Survive: Lost Island have one each. A name is on it once, with its best score. Of two equal scores the one reached first ranks higher, and on a
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
| `src/main/resources/static/survive/` | Survive: Lost Island |
| `src/main/resources/static/solitaire/` | Solitaire |
| `src/main/resources/static/mahjong/` | Mahjong (`board.js` the rules, `faces.js` the tiles) |
| `src/main/resources/static/moto/` | Moto Race (`track.js` the courses and riding, `scene.js` the drawing, `moto.js` the game) |
| `src/main/java/games/Races.java`, `RaceSocket.java` | Moto Race's races, over the WebSocket `/api/race` |
| `src/main/java/games/Leaderboard.java` | the rules of the list, in SQLite (`games.db`) |
| `src/main/java/games/LeaderboardController.java` | `GET`/`POST /api/leaderboard/{game}` |
| `src/main/java/games/AccessCode.java`, `AccessFilter.java`, `LoginController.java` | the access code |
| `Dockerfile` | the image for the NAS |

Font: Fredoka (SIL Open Font License), in `static/fredoka.woff2`.
