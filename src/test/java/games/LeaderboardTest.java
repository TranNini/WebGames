package games;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.MediaType;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import javax.sql.DataSource;
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

    @Autowired
    DataSource dataSource;

    @BeforeEach
    void emptyList() {
        jdbc.sql("DELETE FROM scores").update();
    }

    private List<String> names() {
        return leaderboard.top("reflex-hard").stream().map(ScoreEntry::name).toList();
    }

    private void fillList() {
        for (int i = 1; i <= Leaderboard.MAX_ENTRIES; i++) {
            leaderboard.submit("reflex-hard", "Player " + i, 100 + i);
        }
    }

    @Test
    void bestScoreFirstWithRanks() {
        leaderboard.submit("reflex-hard", "Ben", 10);
        leaderboard.submit("reflex-hard", "Anna", 30);
        assertEquals(List.of(new ScoreEntry(1, "Anna", 30), new ScoreEntry(2, "Ben", 10)), leaderboard.top("reflex-hard"));
    }

    @Test
    void aNameIsOnTheListOnceWithItsBestScore() {
        leaderboard.submit("reflex-hard", "Anna", 30);
        leaderboard.submit("reflex-hard", "anna", 50);
        leaderboard.submit("reflex-hard", "ANNA", 20);
        assertEquals(List.of(new ScoreEntry(1, "anna", 50)), leaderboard.top("reflex-hard"));
    }

    @Test
    void ofTwoEqualScoresTheEarlierRanksHigher() throws Exception {
        leaderboard.submit("reflex-hard", "First", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex-hard", "Second", 30);
        assertEquals(List.of("First", "Second"), names());
    }

    @Test
    void reachingYourOwnScoreAgainKeepsYourPlace() throws Exception {
        leaderboard.submit("reflex-hard", "First", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex-hard", "Second", 30);
        Thread.sleep(5);
        leaderboard.submit("reflex-hard", "First", 30);
        assertEquals(List.of("First", "Second"), names());
    }

    @Test
    void aFullListTakesOnlyMoreThanTheLastPlace() {
        fillList();
        leaderboard.submit("reflex-hard", "Too low", 100);
        leaderboard.submit("reflex-hard", "Tie", 101);
        assertEquals(Leaderboard.MAX_ENTRIES, names().size());
        assertEquals("Player 1", names().get(19), "a tie with the last place doesn't get on the list");

        leaderboard.submit("reflex-hard", "Higher", 102);
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
        mvc.perform(get("/api/leaderboard/reflex")).andExpect(status().isNotFound());
        mvc.perform(get("/api/leaderboard/reflex-hard")).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void eachModeHasItsOwnList() {
        leaderboard.submit("reflex-easy", "Anna", 50);
        leaderboard.submit("reflex-hard", "Anna", 7);
        assertEquals(List.of(new ScoreEntry(1, "Anna", 50)), leaderboard.top("reflex-easy"));
        assertEquals(List.of(new ScoreEntry(1, "Anna", 7)), leaderboard.top("reflex-hard"));
        assertEquals(List.of(), leaderboard.top("reflex-medium"));
    }

    @Test
    void scoresFromBeforeTheModesCountForHard() {
        jdbc.sql("INSERT INTO scores VALUES ('reflex', 'nini', 'Nini', 74, 1)").update();
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(dataSource);
        new ResourceDatabasePopulator(new ClassPathResource("schema.sql")).execute(dataSource);
        assertEquals(List.of(new ScoreEntry(1, "Nini", 74)), leaderboard.top("reflex-hard"));
    }

    private org.springframework.test.web.servlet.ResultActions submit(String name, int score) throws Exception {
        return mvc.perform(post("/api/leaderboard/reflex-hard").contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"score\":" + score + "}"));
    }
}
