package games;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class AccessFilterTest {
    @TempDir
    static Path dataDir;

    @DynamicPropertySource
    static void dataInTempDir(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> "jdbc:sqlite:" + dataDir.resolve("test.db"));
        registry.add("games.access-code-file", () -> dataDir.resolve("access-code.txt").toString());
    }

    @Autowired
    MockMvc mvc;

    @Autowired
    AccessCode accessCode;

    // A phone in the home network instead of this Mac
    private static final RequestPostProcessor PHONE = request -> {
        request.setRemoteAddr("192.168.178.50");
        return request;
    };

    @Test
    void otherDevicesNeedTheCode() throws Exception {
        mvc.perform(get("/api/leaderboard/reflex-easy").with(PHONE)).andExpect(status().isUnauthorized());
        mvc.perform(get("/reflex/index.html").with(PHONE)).andExpect(redirectedUrl("/login.html"));
        mvc.perform(get("/").with(PHONE)).andExpect(redirectedUrl("/login.html"));
        for (String page : new String[]{"/login.html", "/style.css", "/theme.js", "/fredoka.woff2", "/apple-touch-icon.png"}) {
            mvc.perform(get(page).with(PHONE)).andExpect(status().isOk());
        }
    }

    @Test
    void theRightCodeGivesACookie() throws Exception {
        mvc.perform(post("/login").with(PHONE).param("code", "wrong-code"))
                .andExpect(redirectedUrl("/login.html?wrong"));

        mvc.perform(post("/login").with(PHONE).param("code", accessCode.getCode().toUpperCase()))
                .andExpect(redirectedUrl("/"))
                .andExpect(cookie().value(AccessFilter.COOKIE, accessCode.getCookieKey()))
                .andExpect(cookie().secure(AccessFilter.COOKIE, true));

        Cookie cookie = new Cookie(AccessFilter.COOKIE, accessCode.getCookieKey());
        mvc.perform(get("/api/leaderboard/reflex-easy").with(PHONE).cookie(cookie)).andExpect(status().isOk());
        mvc.perform(get("/reflex/index.html").with(PHONE).cookie(cookie)).andExpect(status().isOk());
    }

    @Test
    void theCodeItselfIsNoCookie() throws Exception {
        mvc.perform(get("/api/leaderboard/reflex-easy").with(PHONE).cookie(new Cookie(AccessFilter.COOKIE, accessCode.getCode())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tooManyWrongCodesLockTheLogin() {
        AccessCode code = new AccessCode(dataDir.resolve("lock-test.txt").toString());
        for (int i = 0; i < 10; i++) {
            assertFalse(code.tryLogin("wrong"));
        }
        assertFalse(code.tryLogin(code.getCode()), "locked for 10 minutes, even with the right code");
    }

    @Test
    void thisMacNeedsNoCode() throws Exception {
        mvc.perform(get("/api/leaderboard/reflex-easy")).andExpect(status().isOk());
    }

    @Test
    void laneDodgeHasALeaderboard() throws Exception {
        mvc.perform(get("/api/leaderboard/dodge")).andExpect(status().isOk());
        mvc.perform(get("/api/leaderboard/no-such-game")).andExpect(status().isNotFound());
    }

    @Test
    void scribbleMathHasALeaderboard() throws Exception {
        mvc.perform(get("/api/leaderboard/math")).andExpect(status().isOk());
    }

    @Test
    void solitaireHasALeaderboardForEachMode() throws Exception {
        mvc.perform(get("/api/leaderboard/solitaire-1")).andExpect(status().isOk());
        mvc.perform(get("/api/leaderboard/solitaire-3")).andExpect(status().isOk());
    }

    @Test
    void missionMeowHasALeaderboard() throws Exception {
        mvc.perform(get("/api/leaderboard/mission")).andExpect(status().isOk());
    }
}
