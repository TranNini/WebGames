package games;

import jakarta.annotation.PreDestroy;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

// Moto Race's connection: /api/race, a WebSocket. AccessFilter checks the access code on the request that opens it,
// like on every other request. The cookie is SameSite=Lax, so another site's page can't open one with it; any origin is
// therefore allowed (behind caddy the app sees http while the page is https, which the usual origin check would refuse).
@Configuration
@EnableWebSocket
public class RaceSocket extends TextWebSocketHandler implements WebSocketConfigurer {
    private static final String RIDER = "rider";
    private static final long TICK_MS = 66; // 15 times a second

    private final Races races;
    private final ScheduledExecutorService ticker = Executors.newSingleThreadScheduledExecutor(task -> {
        Thread thread = new Thread(task, "races");
        thread.setDaemon(true);
        return thread;
    });

    public RaceSocket(Races races) {
        this.races = races;
        ticker.scheduleAtFixedRate(this::tick, TICK_MS, TICK_MS, TimeUnit.MILLISECONDS);
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(this, "/api/race").setAllowedOriginPatterns("*");
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // Several threads send (the ticker, other riders' messages); this one queues them
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, 2000, 256 * 1024);
        Races.Rider rider = races.connect(text -> {
            try {
                safe.sendMessage(new TextMessage(text));
            } catch (Exception e) {
                // closed or too slow: the closing handler takes the rider out
            }
        });
        session.getAttributes().put(RIDER, rider);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        Races.Rider rider = (Races.Rider) session.getAttributes().get(RIDER);
        if (rider != null) {
            races.handle(rider, message.getPayload());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Races.Rider rider = (Races.Rider) session.getAttributes().get(RIDER);
        if (rider != null) {
            races.disconnect(rider);
        }
    }

    private void tick() {
        try {
            races.tick();
        } catch (RuntimeException e) {
            // the next tick tries again; a stopped ticker would stop every race
        }
    }

    @PreDestroy
    void stop() {
        ticker.shutdownNow();
    }
}
