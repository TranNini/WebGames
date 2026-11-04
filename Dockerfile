FROM eclipse-temurin:21-jre

WORKDIR /app

COPY target/Games-1.0-SNAPSHOT.jar app.jar

# The database and the access code, in one volume
ENV SPRING_DATASOURCE_URL=jdbc:sqlite:/app/data/games.db \
    GAMES_ACCESS_CODE_FILE=/app/data/access-code.txt
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 8083

ENTRYPOINT ["java", "-jar", "app.jar"]
