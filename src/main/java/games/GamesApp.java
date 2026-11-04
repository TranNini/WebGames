package games;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// Starts the app on http://localhost:8083
@SpringBootApplication
public class GamesApp {
    public static void main(String[] args) {
        SpringApplication.run(GamesApp.class, args);
    }
}
