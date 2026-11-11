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
// opens a race, the others see it in the list and join; the one who opened it starts it.
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

    enum Phase { LOBBY, COUNTDOWN, RACING, RESULTS }

    static final class Rider {
        final int id;
        private final Consumer<String> out;
        String name = "Rider";
        Room room;
        int color;
        double z;
        double x;
        double speed;
        long finishedAfter = -1; // ms after the start, -1 while still riding
        long seenAt; // when the phone last said where it is

        Rider(int id, Consumer<String> out) {
            this.id = id;
            this.out = out;
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
            case "create" -> create(rider, message.path("track").asText());
            case "join" -> join(rider, message.path("code").asText());
            case "leave" -> leave(rider, true);
            case "track" -> chooseTrack(rider, message.path("track").asText());
            case "start" -> start(rider);
            case "pos" -> position(rider, message);
            case "finish" -> finish(rider);
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

    private void create(Rider rider, String track) {
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
        if (room.riders.size() >= MAX_RIDERS) {
            send(rider, Map.of("t", "error", "text", "That race is full."));
            sendRooms(rider);
            return;
        }
        leave(rider, false);
        addToRoom(rider, room);
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
            if (room.riders.isEmpty()) {
                rooms.remove(room.code);
            } else {
                if (room.host == rider) {
                    room.host = room.riders.get(0);
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
        rider.finishedAfter = after;
        if (room.firstFinishAt < 0) {
            room.firstFinishAt = now;
        }
        long place = room.riders.stream().filter(Rider::finished).count();
        leaderboard.submit("moto-" + room.track, rider.name, (int) Math.round(after / 100.0));
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
            list.add(Map.of("id", rider.id, "name", rider.name, "color", rider.color));
        }
        sendToRoom(room, Map.of("t", "room", "code", room.code, "track", room.track, "host", room.host.id,
                "phase", room.phase.name().toLowerCase(), "riders", list));
    }

    // The races that can be joined, newest first
    private void sendRooms(Rider rider) {
        List<Map<String, Object>> open = new ArrayList<>();
        for (Room room : rooms.values()) {
            if (room.phase == Phase.LOBBY && room.riders.size() < MAX_RIDERS) {
                open.add(0, Map.of("code", room.code, "host", room.host.name, "track", room.track, "riders", room.riders.size()));
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
