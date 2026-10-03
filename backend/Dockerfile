FROM maven:3-eclipse-temurin-26 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:26-jre
RUN useradd --system --uid 10001 app
WORKDIR /app
COPY --from=build /app/target/notepilot-1.0.0.jar app.jar
USER app
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java","-jar","app.jar"]
