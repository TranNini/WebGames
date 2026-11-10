package games;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

// The best players of each game. A name is on the list once, with its best score.
// With a full list, a new name needs more than the last place to get on it.
@Repository
public class Leaderboard {
    public static final int MAX_ENTRIES = 20;
    // Lists of times in seconds, where the fastest is best. On all others the highest score is best.
    public static final Set<String> TIMES = Set.of("mahjong-easy", "mahjong-medium", "mahjong-hard",
            "mahjong-easy-nohints", "mahjong-medium-nohints", "mahjong-hard-nohints");

    private final JdbcClient jdbc;

    public Leaderboard(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ScoreEntry> top(String game) {
        List<Row> rows = jdbc.sql("""
                        SELECT name, score FROM scores WHERE game = :game
                        ORDER BY %s, achieved_at ASC, rowid ASC LIMIT :limit""".formatted(best(game)))
                .param("game", game)
                .param("limit", MAX_ENTRIES)
                .query(Row.class)
                .list();
        List<ScoreEntry> entries = new ArrayList<>();
        for (Row row : rows) {
            entries.add(new ScoreEntry(entries.size() + 1, row.name(), row.score()));
        }
        return entries;
    }

    // Keeps the name's earlier score if that was as good, so the older one of two equal scores stays ahead
    @Transactional
    public synchronized void submit(String game, String name, int score) {
        String key = name.toLowerCase(Locale.ROOT);
        List<Integer> saved = jdbc.sql("SELECT score FROM scores WHERE game = :game AND name_key = :key")
                .param("game", game)
                .param("key", key)
                .query(Integer.class)
                .list();
        if (!saved.isEmpty() && !isBetter(game, score, saved.get(0))) {
            return;
        }
        jdbc.sql("""
                        INSERT INTO scores (game, name_key, name, score, achieved_at)
                        VALUES (:game, :key, :name, :score, :now)
                        ON CONFLICT (game, name_key)
                        DO UPDATE SET name = :name, score = :score, achieved_at = :now""")
                .param("game", game)
                .param("key", key)
                .param("name", name)
                .param("score", score)
                .param("now", System.currentTimeMillis())
                .update();
        // A new entry that ties the last place sorts behind it (it is newer), so it goes straight away
        jdbc.sql("""
                        DELETE FROM scores WHERE game = :game AND name_key NOT IN (
                            SELECT name_key FROM scores WHERE game = :game
                            ORDER BY %s, achieved_at ASC, rowid ASC LIMIT :limit)""".formatted(best(game)))
                .param("game", game)
                .param("limit", MAX_ENTRIES)
                .update();
    }

    // The best first; a fixed text, never from the request
    private static String best(String game) {
        return TIMES.contains(game) ? "score ASC" : "score DESC";
    }

    private static boolean isBetter(String game, int score, int than) {
        return TIMES.contains(game) ? score < than : score > than;
    }

    private record Row(String name, int score) {
    }
}
