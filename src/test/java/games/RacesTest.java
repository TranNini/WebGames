package games;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

// The races without sockets: each phone is a list of the messages it got, and the clock is turned by hand
@SpringBootTest
class RacesTest {
    @TempDir
    static Path dataDir;

    @DynamicPropertySource
    static void dataInTempDir(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + dataDir.resolve("test.db"));
        registry.add("games.access-code-file", () -> dataDir.resolve("access-code.txt").toString());
    }

    @Autowired
    Leaderboard leaderboard;

    @Autowired
    JdbcClient jdbc;

    final ObjectMapper json = new ObjectMapper();
    final AtomicLong now = new AtomicLong(1_000_000);
    Races races;

    final class Phone {
        final List<JsonNode> got = new ArrayList<>();
        final Races.Rider rider;

        Phone(String name) {
            rider = races.connect(text -> {
                try {
                    got.add(json.readTree(text));
                } catch (Exception e) {
                    throw new IllegalStateException(e);
                }
            });
            say("{\"t\":\"hello\",\"name\":\"" + name + "\"}");
        }

        void say(String message) {
            races.handle(rider, message);
        }

        JsonNode last(String type) {
            for (int i = got.size() - 1; i >= 0; i--) {
                if (got.get(i).path("t").asText().equals(type)) {
                    return got.get(i);
                }
            }
            return null;
        }
    }

    @BeforeEach
    void freshRaces() {
        jdbc.sql("DELETE FROM scores").update();
        races = new Races(leaderboard, json, now::get);
    }

    private void later(long ms) {
        now.addAndGet(ms);
        races.tick();
    }

    @Test
    void aNewRaceIsInTheListOfTheOthers() {
        Phone anna = new Phone("Anna");
        Phone ben = new Phone("Ben");
        assertEquals(0, ben.last("rooms").path("rooms").size());
        anna.say("{\"t\":\"create\",\"track\":\"city\"}");
        JsonNode open = ben.last("rooms").path("rooms");
        assertEquals(1, open.size());
        assertEquals("Anna", open.get(0).path("host").asText());
        assertEquals("city", open.get(0).path("track").asText());
        assertEquals(anna.rider.id, anna.last("room").path("host").asInt());
    }

    @Test
    void ridersRaceAndTheFirstHomeWins() {
        Phone anna = new Phone("Anna");
        Phone ben = new Phone("Ben");
        anna.say("{\"t\":\"create\",\"track\":\"sakura\"}");
        ben.say("{\"t\":\"join\",\"code\":\"" + anna.last("room").path("code").asText() + "\"}");
        JsonNode room = ben.last("room");
        assertEquals(2, room.path("riders").size());
        assertFalse(room.path("riders").get(0).path("color").asInt() == room.path("riders").get(1).path("color").asInt(), "each its own color");

        ben.say("{\"t\":\"start\"}");
        assertEquals(null, ben.last("start"), "only the one who opened it starts it");
        anna.say("{\"t\":\"start\"}");
        assertEquals(Races.COUNTDOWN_MS, ben.last("start").path("in").asLong());
        assertEquals(0, new Phone("Cleo").last("rooms").path("rooms").size(), "a race that started can't be joined");

        later(Races.COUNTDOWN_MS);
        ben.say("{\"t\":\"pos\",\"z\":120.5,\"x\":-1.25,\"v\":40}");
        later(70);
        JsonNode bikes = anna.last("bikes").path("b");
        assertEquals(2, bikes.size());
        assertEquals(120.5, bikes.get(1).get(1).asDouble());

        later(Races.SHORTEST_RACE_MS + 70_000);
        ben.say("{\"t\":\"finish\"}");
        assertEquals(1, anna.last("finished").path("place").asInt());
        later(10_000);
        anna.say("{\"t\":\"finish\"}");
        JsonNode results = ben.last("results").path("results");
        assertEquals("Ben", results.get(0).path("name").asText());
        assertEquals(Races.SHORTEST_RACE_MS + 70_070, results.get(0).path("time").asLong());
        assertEquals("Anna", results.get(1).path("name").asText());
        assertEquals("results", anna.last("room").path("phase").asText());

        List<ScoreEntry> fastest = leaderboard.top("moto-sakura");
        assertEquals("Ben", fastest.get(0).name());
        assertEquals(1001, fastest.get(0).score(), "in tenths of a second");

        anna.say("{\"t\":\"again\"}");
        assertEquals("lobby", ben.last("room").path("phase").asText());
    }

    @Test
    void aFinishTooEarlyIsntTaken() {
        Phone anna = new Phone("Anna");
        anna.say("{\"t\":\"create\",\"track\":\"mountain\"}");
        anna.say("{\"t\":\"start\"}");
        later(Races.COUNTDOWN_MS + 5000);
        anna.say("{\"t\":\"finish\"}");
        assertEquals(null, anna.last("finished"));
    }

    @Test
    void theOthersGetAMinuteAfterTheWinner() {
        Phone anna = new Phone("Anna");
        Phone ben = new Phone("Ben");
        anna.say("{\"t\":\"create\",\"track\":\"mountain\"}");
        ben.say("{\"t\":\"join\",\"code\":\"" + anna.last("room").path("code").asText() + "\"}");
        anna.say("{\"t\":\"start\"}");
        later(Races.COUNTDOWN_MS + Races.SHORTEST_RACE_MS);
        anna.say("{\"t\":\"finish\"}");
        later(Races.AFTER_THE_WINNER_MS - 100);
        assertEquals(null, ben.last("results"));
        later(200);
        JsonNode results = ben.last("results").path("results");
        assertTrue(results.get(1).path("time").isNull(), "Ben didn't finish");
    }

    @Test
    void whenTheHostLeavesTheNextOneStarts() {
        Phone anna = new Phone("Anna");
        Phone ben = new Phone("Ben");
        anna.say("{\"t\":\"create\",\"track\":\"city\"}");
        String code = anna.last("room").path("code").asText();
        ben.say("{\"t\":\"join\",\"code\":\"" + code + "\"}");
        races.disconnect(anna.rider);
        assertEquals(ben.rider.id, ben.last("room").path("host").asInt());
        ben.say("{\"t\":\"leave\"}");
        assertEquals(0, ben.last("rooms").path("rooms").size(), "an empty race is gone");
    }

    @Test
    void aFullRaceTakesNoMore() {
        Phone host = new Phone("Host");
        host.say("{\"t\":\"create\",\"track\":\"city\"}");
        String code = host.last("room").path("code").asText();
        for (int i = 1; i < Races.MAX_RIDERS; i++) {
            new Phone("Rider " + i).say("{\"t\":\"join\",\"code\":\"" + code + "\"}");
        }
        Phone late = new Phone("Late");
        late.say("{\"t\":\"join\",\"code\":\"" + code + "\"}");
        assertEquals("That race is full.", late.last("error").path("text").asText());
        assertEquals(Races.MAX_RIDERS, host.last("room").path("riders").size());
    }

    @Test
    void nonsenseIsIgnored() {
        Phone anna = new Phone("Anna");
        anna.say("not json");
        anna.say("[1,2]");
        anna.say("{\"t\":\"create\",\"track\":\"moon\"}");
        anna.say("{\"t\":\"pos\",\"z\":\"far\"}");
        assertEquals(null, anna.last("room"));
    }
}
