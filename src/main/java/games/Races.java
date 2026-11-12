package games;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.LongSupplier;

// The races of Moto Race. Each phone rides its own bike and says where it is; the server passes that on to the others in
// the race, counts the start down, keeps the finishing order and puts the times on the track's leaderboard. One rider
// opens a race, the others see it in the list and join; the one who opened it starts it. It can also add computer riders:
// the host's phone rides them and sends where they are with its own bike, and their times aren't on the leaderboard.
// All messages are small JSON objects with a type in "t" (see moto.js for the other side).
@Component
public class Races {
    public static final int MAX_RIDERS = 6;
    // The courses, from a start to a goal (track.js has their roads)
    public static final Set<String> TRACKS = Set.of("sakura", "city", "mountain");
    static final long COUNTDOWN_MS = 4000;
    // The others have this long to finish after the winner
    static final long AFTER_THE_WINNER_MS = 60_000;
    // Faster than any bike can ride a course: such a finish isn't taken
    static final long SHORTEST_RACE_MS = 30_000;
    private static final int MAX_NAME_LENGTH = 16;
    private static final String CODE_LETTERS = "BCDFGHJKLMNPQRSTVWXZ";
    private static final List<String> COMPUTER_NAMES = List.of("Aiko", "Kenji", "Mika", "Ren", "Sora", "Yuki");
    // A computer rider still on the way when all the people are in is given its time at the speed it had: no further than this
    private static final long LONGEST_GUESS_MS = 120_000;

    enum Phase { LOBBY, COUNTDOWN, RACING, RESULTS }

    static final class Rider {
        final int id;
        private final Consumer<String> out;
        final boolean computer; // ridden by the host's phone
        String name = "Rider";
        Room room;
        int color;
        double z;
        double x;
        double speed;
        long finishedAfter = -1; // ms after the start, -1 while still riding
        long seenAt; // when the phone last said where it is

        Rider(int id, Consumer<String> out) {
            this(id, out, false);
        }

        Rider(int id, Consumer<String> out, boolean computer) {
            this.id = id;
            this.out = out;
            this.computer = computer;
        }

        boolean finished() {
            return finishedAfter >= 0;
        }
    }

    static final class Room {
        final String code;
        String track;
        Rider host;
        Phase phase = Phase.LOBBY;
        long startAt;
        long firstFinishAt = -1;
        final List<Rider> riders = new ArrayList<>();

        Room(String code, String track, Rider host) {
            this.code = code;
            this.track = track;
            this.host = host;
        }

        List<Rider> people() {
            return riders.stream().filter(rider -> !rider.computer).toList();
        }

        List<Rider> computers() {
            return riders.stream().filter(rider -> rider.computer).toList();
        }
    }

    private final Leaderboard leaderboard;
    private final ObjectMapper json;
    private final LongSupplier clock;
    private final Random random = new SecureRandom();
    private final Map<String, Room> rooms = new LinkedHashMap<>();
    private final Set<Rider> riders = new LinkedHashSet<>(); // everyone connected, also those in no race
    private int nextId = 1;

    @Autowired
    public Races(Leaderboard leaderboard, ObjectMapper json) {
        this(leaderboard, json, System::currentTimeMillis);
    }

    Races(Leaderboard leaderboard, ObjectMapper json, LongSupplier clock) {
        this.leaderboard = leaderboard;
        this.json = json;
        this.clock = clock;
    }

    public synchronized Rider connect(Consumer<String> out) {
        Rider rider = new Rider(nextId++, out);
        riders.add(rider);
        send(rider, Map.of("t", "welcome", "you", rider.id));
        return rider;
    }

    public synchronized void disconnect(Rider rider) {
        if (riders.remove(rider)) {
            leave(rider, false);
        }
    }

    // A message from a rider's phone. Anything that doesn't fit is ignored: the phone only sends what its buttons allow.
    public synchronized void handle(Rider rider, String text) {
        if (!riders.contains(rider)) {
            return;
        }
        JsonNode message;
        try {
            message = json.readTree(text);
        } catch (Exception e) {
            return;
        }
        if (message == null || !message.isObject()) {
            return;
        }
        switch (message.path("t").asText()) {
            case "hello" -> hello(rider, message.path("name").asText());
            case "create" -> create(rider, message.path("track").asText(), message.path("computers").asInt(0));
            case "computers" -> chooseComputers(rider, message.path("count").asInt(-1));
            case "join" -> join(rider, message.path("code").asText());
            case "leave" -> leave(rider, true);
            case "track" -> chooseTrack(rider, message.path("track").asText());
            case "start" -> start(rider);
            case "pos" -> position(rider, message);
            case "finish" -> {
                if (message.has("id")) {
                    finishComputer(rider, message.path("id").asInt(), message.path("rest").asLong(0));
                } else {
                    finish(rider);
                }
            }
            case "again" -> again(rider);
            default -> {
            }
        }
    }

    // Called a few times a second: starts the race after the countdown, passes the bikes on, ends a race that waited long enough
    public synchronized void tick() {
        long now = clock.getAsLong();
        for (Room room : List.copyOf(rooms.values())) {
            if (room.phase == Phase.COUNTDOWN && now >= room.startAt) {
                room.phase = Phase.RACING;
            }
            if (room.phase == Phase.COUNTDOWN || room.phase == Phase.RACING) {
                List<List<Number>> bikes = new ArrayList<>();
                // With how old each place is in ms, so the phones can ride it on to now
                for (Rider rider : room.riders) {
                    long age = Math.max(0, Math.min(1000, now - rider.seenAt));
                    bikes.add(List.of(rider.id, round(rider.z), round(rider.x), round(rider.speed), age));
                }
                sendToRoom(room, Map.of("t", "bikes", "b", bikes));
            }
            if (room.phase == Phase.RACING && room.firstFinishAt >= 0 && now - room.firstFinishAt >= AFTER_THE_WINNER_MS) {
                endRace(room);
            }
        }
    }

    private void hello(Rider rider, String name) {
        String trimmed = name.trim().replaceAll("\\s+", " ");
        if (!trimmed.isEmpty() && trimmed.codePointCount(0, trimmed.length()) <= MAX_NAME_LENGTH) {
            rider.name = trimmed;
        }
        if (rider.room == null) {
            sendRooms(rider);
        } else {
            sendRoom(rider.room);
        }
    }

    private void create(Rider rider, String track, int computers) {
        if (!TRACKS.contains(track)) {
            return;
        }
        leave(rider, false);
        String code;
        do {
            code = newCode();
        } while (rooms.containsKey(code));
        Room room = new Room(code, track, rider);
        rooms.put(code, room);
        addToRoom(rider, room);
        if (computers > 0) {
            setComputers(room, computers);
            sendRoom(room);
            sendRoomsToLobby();
        }
    }

    private void join(Rider rider, String code) {
        Room room = rooms.get(code);
        if (room == null || room == rider.room) {
            if (room == null) {
                send(rider, Map.of("t", "error", "text", "That race isn't there any more."));
                sendRooms(rider);
            }
            return;
        }
        if (room.phase != Phase.LOBBY) {
            send(rider, Map.of("t", "error", "text", "That race has already started."));
            sendRooms(rider);
            return;
        }
        if (room.people().size() >= MAX_RIDERS) {
            send(rider, Map.of("t", "error", "text", "That race is full."));
            sendRooms(rider);
            return;
        }
        leave(rider, false);
        if (room.riders.size() >= MAX_RIDERS) {
            // A person takes the place of a computer rider
            room.riders.remove(room.computers().get(room.computers().size() - 1));
        }
        addToRoom(rider, room);
    }

    private void chooseComputers(Rider rider, int count) {
        Room room = rider.room;
        if (room != null && room.host == rider && room.phase == Phase.LOBBY && count >= 0) {
            setComputers(room, count);
            sendRoom(room);
            sendRoomsToLobby();
        }
    }

    // As many computer riders as wanted, as far as there's room next to the people
    private void setComputers(Room room, int wanted) {
        int count = Math.max(0, Math.min(wanted, MAX_RIDERS - room.people().size()));
        while (room.computers().size() > count) {
            room.riders.remove(room.computers().get(room.computers().size() - 1));
        }
        while (room.computers().size() < count) {
            Rider computer = new Rider(nextId++, text -> {
            }, true);
            computer.room = room;
            computer.color = firstFreeColor(room);
            computer.name = COMPUTER_NAMES.stream()
                    .filter(name -> room.riders.stream().noneMatch(other -> other.name.equalsIgnoreCase(name)))
                    .findFirst().orElse("Computer");
            room.riders.add(computer);
        }
    }

    private void addToRoom(Rider rider, Room room) {
        rider.room = room;
        rider.color = firstFreeColor(room);
        rider.finishedAfter = -1;
        room.riders.add(rider);
        sendRoom(room);
        sendRoomsToLobby();
    }

    private static int firstFreeColor(Room room) {
        for (int color = 0; ; color++) {
            int c = color;
            if (room.riders.stream().noneMatch(other -> other.color == c)) {
                return color;
            }
        }
    }

    // tellRider: the rider stays connected and wants the list of races again
    private void leave(Rider rider, boolean tellRider) {
        Room room = rider.room;
        if (room != null) {
            rider.room = null;
            room.riders.remove(rider);
            if (room.people().isEmpty()) {
                rooms.remove(room.code);
            } else {
                if (room.host == rider) {
                    // The next person; their phone rides the computer riders from now on
                    room.host = room.people().get(0);
                }
                sendRoom(room);
                sendToRoom(room, Map.of("t", "left", "id", rider.id));
                if (room.phase == Phase.RACING && room.riders.stream().allMatch(Rider::finished)) {
                    endRace(room);
                }
            }
            sendRoomsToLobby();
        }
        if (tellRider) {
            sendRooms(rider);
        }
    }

    private void chooseTrack(Rider rider, String track) {
        Room room = rider.room;
        if (room != null && room.host == rider && room.phase == Phase.LOBBY && TRACKS.contains(track)) {
            room.track = track;
            sendRoom(room);
            sendRoomsToLobby();
        }
    }

    private void start(Rider rider) {
        Room room = rider.room;
        if (room == null || room.host != rider || room.phase != Phase.LOBBY) {
            return;
        }
        room.phase = Phase.COUNTDOWN;
        room.startAt = clock.getAsLong() + COUNTDOWN_MS;
        room.firstFinishAt = -1;
        List<Integer> grid = new ArrayList<>();
        for (Rider each : room.riders) {
            each.finishedAfter = -1;
            each.z = 0;
            each.x = 0;
            each.speed = 0;
            grid.add(each.id);
        }
        sendToRoom(room, Map.of("t", "start", "in", COUNTDOWN_MS, "track", room.track, "grid", grid));
        sendRoomsToLobby();
    }

    private void position(Rider rider, JsonNode message) {
        Room room = rider.room;
        if (room == null || (room.phase != Phase.RACING && room.phase != Phase.COUNTDOWN)) {
            return;
        }
        double z = message.path("z").asDouble(Double.NaN);
        double x = message.path("x").asDouble(Double.NaN);
        double speed = message.path("v").asDouble(Double.NaN);
        if (Double.isFinite(z) && Double.isFinite(x) && Double.isFinite(speed)) {
            rider.z = z;
            rider.x = x;
            rider.speed = speed;
            rider.seenAt = clock.getAsLong();
        }
        // The computer riders, from the host's phone: [id, z, x, speed] each
        if (room.host == rider) {
            for (JsonNode place : message.path("computers")) {
                Rider computer = computerIn(room, place.path(0).asInt());
                double cz = place.path(1).asDouble(Double.NaN);
                double cx = place.path(2).asDouble(Double.NaN);
                double cv = place.path(3).asDouble(Double.NaN);
                if (computer != null && Double.isFinite(cz) && Double.isFinite(cx) && Double.isFinite(cv)) {
                    computer.z = cz;
                    computer.x = cx;
                    computer.speed = cv;
                    computer.seenAt = rider.seenAt;
                }
            }
        }
    }

    private static Rider computerIn(Room room, int id) {
        return room.computers().stream().filter(computer -> computer.id == id).findFirst().orElse(null);
    }

    private void finish(Rider rider) {
        Room room = rider.room;
        if (room == null || room.phase != Phase.RACING || rider.finished()) {
            return;
        }
        long now = clock.getAsLong();
        long after = now - room.startAt;
        if (after < SHORTEST_RACE_MS) {
            return;
        }
        // The others get a minute after the first person home; a computer rider winning doesn't hurry anyone
        if (room.firstFinishAt < 0) {
            room.firstFinishAt = now;
        }
        leaderboard.submit("moto-" + room.track, rider.name, (int) Math.round(after / 100.0));
        finished(room, rider, after);
    }

    // A computer rider at the goal, from the host's phone. rest: when the people are all in, a computer rider still on the
    // way is given its time with how long it would still need (ms).
    private void finishComputer(Rider host, int id, long rest) {
        Room room = host.room;
        if (room == null || room.host != host || room.phase != Phase.RACING) {
            return;
        }
        Rider computer = computerIn(room, id);
        if (computer == null || computer.finished() || rest < 0 || rest > LONGEST_GUESS_MS) {
            return;
        }
        long after = clock.getAsLong() - room.startAt + rest;
        if (after < SHORTEST_RACE_MS) {
            return;
        }
        finished(room, computer, after);
    }

    private void finished(Room room, Rider rider, long after) {
        rider.finishedAfter = after;
        long place = room.riders.stream().filter(other -> other.finished() && other.finishedAfter <= after).count();
        sendToRoom(room, Map.of("t", "finished", "id", rider.id, "place", place, "time", after));
        if (room.riders.stream().allMatch(Rider::finished)) {
            endRace(room);
        }
    }

    // The finished in their order, then the others by how far they got
    private void endRace(Room room) {
        room.phase = Phase.RESULTS;
        List<Rider> order = new ArrayList<>(room.riders);
        order.sort(Comparator.comparing((Rider r) -> !r.finished())
                .thenComparingLong(r -> r.finished() ? r.finishedAfter : 0)
                .thenComparingDouble(r -> -r.z));
        List<Map<String, Object>> results = new ArrayList<>();
        for (Rider rider : order) {
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("id", rider.id);
            result.put("name", rider.name);
            result.put("color", rider.color);
            result.put("computer", rider.computer);
            result.put("place", results.size() + 1);
            result.put("time", rider.finished() ? rider.finishedAfter : null);
            results.add(result);
        }
        sendToRoom(room, Map.of("t", "results", "track", room.track, "results", results));
        sendRoom(room);
    }

    private void again(Rider rider) {
        Room room = rider.room;
        if (room != null && room.host == rider && room.phase == Phase.RESULTS) {
            room.phase = Phase.LOBBY;
            sendRoom(room);
            sendRoomsToLobby();
        }
    }

    private String newCode() {
        StringBuilder code = new StringBuilder();
        for (int i = 0; i < 4; i++) {
            code.append(CODE_LETTERS.charAt(random.nextInt(CODE_LETTERS.length())));
        }
        return code.toString();
    }

    private void sendRoom(Room room) {
        List<Map<String, Object>> list = new ArrayList<>();
        for (Rider rider : room.riders) {
            list.add(Map.of("id", rider.id, "name", rider.name, "color", rider.color, "computer", rider.computer));
        }
        sendToRoom(room, Map.of("t", "room", "code", room.code, "track", room.track, "host", room.host.id,
                "phase", room.phase.name().toLowerCase(), "riders", list));
    }

    // The races that can be joined, newest first
    private void sendRooms(Rider rider) {
        List<Map<String, Object>> open = new ArrayList<>();
        for (Room room : rooms.values()) {
            int people = room.people().size();
            if (room.phase == Phase.LOBBY && people < MAX_RIDERS) {
                open.add(0, Map.of("code", room.code, "host", room.host.name, "track", room.track, "riders", people,
                        "computers", room.computers().size()));
            }
        }
        send(rider, Map.of("t", "rooms", "rooms", open));
    }

    private void sendRoomsToLobby() {
        for (Rider rider : List.copyOf(riders)) {
            if (rider.room == null) {
                sendRooms(rider);
            }
        }
    }

    private void sendToRoom(Room room, Map<String, ?> message) {
        String text = write(message);
        for (Rider rider : List.copyOf(room.riders)) {
            rider.out.accept(text);
        }
    }

    private void send(Rider rider, Map<String, ?> message) {
        rider.out.accept(write(message));
    }

    private String write(Map<String, ?> message) {
        try {
            return json.writeValueAsString(message);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static double round(double value) {
        return Math.round(value * 100) / 100.0;
    }
}
