package games;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class LeaderboardTest {
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

    @Autowired
    MockMvc mvc;

    @BeforeEach
    void emptyList() {
        jdbc.sql("DELETE FROM scores").update();
    }

    private List<String> names() {
        return leaderboard.top("reflex").stream().map(ScoreEntry::name).toList();
    }

    private void fillList() {
        for (int i = 1; i <= Leaderboard.MAX_ENTRIES; i++) {
            leaderboard.submit("reflex", "Player " + i, 100 + i);
        }
    }

    @Test
    void bestScoreFirstWithRanks() {
        leaderboard.submit("reflex", "Ben", 10);
        leaderboard.submit("reflex", "Anna", 30);
        assertEquals(List.of(new ScoreEntry(1, "Anna", 30), new ScoreEntry(2, "Ben", 10)), leaderboard.top("reflex"));
    }

    @Test
    void aNameIsOnTheListOnceWithItsBestScore() {
        leaderboard.submit("reflex", "Anna", 30);
        leaderboard.submit("reflex", "anna", 50);
        leaderboard.submit("reflex", "ANNA", 20);
        assertEquals(List.of(new ScoreEntry(1, "anna", 50)), leaderboard.top("reflex"));
    }

    @Test
    void ofTwoEqualScoresTheEarlierRanksHigher() throws Exception {
        leaderboard.submit("reflex", "First", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex", "Second", 30);
        assertEquals(List.of("First", "Second"), names());
    }

    @Test
    void reachingYourOwnScoreAgainKeepsYourPlace() throws Exception {
        leaderboard.submit("reflex", "First", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex", "Second", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex", "First", 30);
        assertEquals(List.of("First", "Second"), names());
    }

    @Test
    void aFullListTakesOnlyMoreThanTheLastPlace() {
        fillList();
        leaderboard.submit("reflex", "Too low", 100);
        leaderboard.submit("reflex", "Tie", 101);
        assertEquals(Leaderboard.MAX_ENTRIES, names().size());
        assertEquals("Player 1", names().get(19), "a tie with the last place doesn't get on the list");

        leaderboard.submit("reflex", "Higher", 102);
        assertEquals(Leaderboard.MAX_ENTRIES, names().size());
        assertEquals("Player 2", names().get(18));
        assertEquals("Higher", names().get(19), "same score as Player 2, but later");
    }

    @Test
    void theApiChecksNameAndScore() throws Exception {
        submit("  Anna   Lena ", 5).andExpect(status().isOk()).andExpect(jsonPath("$[0].name").value("Anna Lena"));
        submit("   ", 5).andExpect(status().isBadRequest());
        submit("12345678901234567", 5).andExpect(status().isBadRequest());
        submit("Anna", 0).andExpect(status().isBadRequest());
        submit("Anna", -3).andExpect(status().isBadRequest());
        mvc.perform(get("/api/leaderboard/other")).andExpect(status().isNotFound());
        mvc.perform(get("/api/leaderboard/reflex")).andExpect(jsonPath("$.length()").value(1));
    }

    private org.springframework.test.web.servlet.ResultActions submit(String name, int score) throws Exception {
        return mvc.perform(post("/api/leaderboard/reflex").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"score\":" + score + "}"));
    }
}
