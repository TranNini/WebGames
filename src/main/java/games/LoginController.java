package games;

import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;

import java.time.Duration;

@Controller
public class LoginController {
    private final AccessCode accessCode;
    private final boolean cookieSecure;

    public LoginController(AccessCode accessCode, @Value("${games.cookie-secure}") boolean cookieSecure) {
        this.accessCode = accessCode;
        this.cookieSecure = cookieSecure;
    }

    @PostMapping("/login")
    public String login(@RequestParam(defaultValue = "") String code, HttpServletResponse response) {
        if (!accessCode.tryLogin(code)) {
            return "redirect:/login.html?wrong";
        }
        ResponseCookie cookie = ResponseCookie.from(AccessFilter.COOKIE, accessCode.getCookieKey())
                .httpOnly(true)
                .secure(cookieSecure) // only sent over HTTPS (https://games.kulose.de); localhost counts as secure too
                .sameSite("Lax")
                .path("/")
                .maxAge(Duration.ofDays(365))
                .build();
        response.addHeader("Set-Cookie", cookie.toString());
        return "redirect:/";
    }
}
