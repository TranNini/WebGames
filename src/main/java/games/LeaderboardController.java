package games;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/leaderboard/{game}")
public class LeaderboardController {
    private static final Set<String> GAMES = Set.of("reflex-easy", "reflex-medium", "reflex-hard", "dodge");
    private static final int MAX_NAME_LENGTH = 16;
    private static final int MAX_SCORE = 1_000_000;

    private final Leaderboard leaderboard;

    public LeaderboardController(Leaderboard leaderboard) {
        this.leaderboard = leaderboard;
    }

    public record Submission(String name, int score) {
    }

    @GetMapping
    public List<ScoreEntry> top(@PathVariable String game) {
        checkGame(game);
        return leaderboard.top(game);
    }

    // Answers with the new list, so the page doesn't need a second request
    @PostMapping
    public List<ScoreEntry> submit(@PathVariable String game, @RequestBody Submission submission) {
        checkGame(game);
        String name = submission.name() == null ? "" : submission.name().trim().replaceAll("\\s+", " ");
        if (name.isEmpty() || name.codePointCount(0, name.length()) > MAX_NAME_LENGTH) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "The name needs 1 to 16 characters.");
        }
        if (submission.score() < 1 || submission.score() > MAX_SCORE) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "That is not a possible score.");
        }
        leaderboard.submit(game, name, submission.score());
        return leaderboard.top(game);
    }

    private static void checkGame(String game) {
        if (!GAMES.contains(game)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No such game.");
        }
    }
}
