package games;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.nio.file.Path;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Moto Race over a real connection, as the phones use it
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class RaceSocketTest {
    @TempDir
    static Path dataDir;

    @DynamicPropertySource
    static void dataInTempDir(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + dataDir.resolve("test.db"));
        registry.add("games.access-code-file", () -> dataDir.resolve("access-code.txt").toString());
    }

    @LocalServerPort
    int port;

    @Autowired
    MockMvc mvc;

    final ObjectMapper json = new ObjectMapper();

    final class Phone extends TextWebSocketHandler {
        final BlockingQueue<JsonNode> got = new LinkedBlockingQueue<>();
        final WebSocketSession session;

        Phone() throws Exception {
            session = new StandardWebSocketClient().execute(this, "ws://localhost:" + port + "/api/race").get(5, TimeUnit.SECONDS);
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
            got.add(json.readTree(message.getPayload()));
        }

        void say(String message) throws Exception {
            session.sendMessage(new TextMessage(message));
        }

        // The next message of this type; the ones before it are passed over
        JsonNode next(String type) throws InterruptedException {
            while (true) {
                JsonNode message = got.poll(5, TimeUnit.SECONDS);
                assertNotNull(message, "no " + type + " came");
                if (message.path("t").asText().equals(type)) {
                    return message;
                }
            }
        }
    }

    @Test
    void twoPhonesMeetInARace() throws Exception {
        Phone anna = new Phone();
        Phone ben = new Phone();
        anna.next("welcome");
        ben.next("welcome");
        anna.say("{\"t\":\"hello\",\"name\":\"Anna\"}");
        ben.say("{\"t\":\"hello\",\"name\":\"Ben\"}");
        ben.next("rooms");
        anna.say("{\"t\":\"create\",\"track\":\"seaside\"}");
        String code = anna.next("room").path("code").asText();
        JsonNode open = ben.next("rooms").path("rooms");
        assertEquals(code, open.get(0).path("code").asText());

        ben.say("{\"t\":\"join\",\"code\":\"" + code + "\"}");
        assertEquals(2, ben.next("room").path("riders").size());
        anna.say("{\"t\":\"start\"}");
        assertEquals("seaside", ben.next("start").path("track").asText());
        ben.say("{\"t\":\"pos\",\"z\":12,\"x\":1,\"v\":30}");
        // The bikes come 15 times a second, also during the countdown
        JsonNode bikes;
        do {
            bikes = anna.next("bikes").path("b");
        } while (bikes.get(1).get(1).asDouble() != 12);
        assertEquals(30, bikes.get(1).get(3).asDouble());

        ben.session.close();
        assertEquals(1, anna.next("room").path("riders").size(), "a phone that goes is taken out");
        anna.session.close();
    }

    @Test
    void otherDevicesNeedTheCodeForARace() throws Exception {
        mvc.perform(get("/api/race").with(request -> {
            request.setRemoteAddr("192.168.178.50");
            return request;
        })).andExpect(status().isUnauthorized());
    }

    @Test
    void eachTrackHasALeaderboardThatOnlyTheRaceFills() throws Exception {
        for (String track : Races.TRACKS) {
            mvc.perform(get("/api/leaderboard/moto-" + track)).andExpect(status().isOk());
        }
        mvc.perform(post("/api/leaderboard/moto-canyon").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Fake\",\"score\":1}")).andExpect(status().isMethodNotAllowed());
    }
}
