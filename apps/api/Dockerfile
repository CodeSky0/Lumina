# syntax=docker/dockerfile:1.7
FROM golang:1.23.6-alpine3.21 AS build
WORKDIR /src
ENV CGO_ENABLED=0 \
    GOTOOLCHAIN=local

COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
COPY migrations ./migrations
RUN mkdir -p /out && \
    go build -trimpath -ldflags="-s -w" -o /out/lumina-api ./cmd/api && \
    go build -trimpath -ldflags="-s -w" -o /out/lumina-migrate ./cmd/migrate && \
    go build -trimpath -ldflags="-s -w" -o /out/lumina-seed ./cmd/seed

FROM alpine:3.21.3 AS runtime
RUN apk add --no-cache ca-certificates=20241121-r1 && \
    addgroup -g 10001 -S lumina && \
    adduser -u 10001 -S -D -H -G lumina lumina && \
    mkdir -p /data/uploads && \
    chown -R lumina:lumina /data/uploads
WORKDIR /app
COPY --from=build --chown=lumina:lumina /out/lumina-api /out/lumina-migrate /out/lumina-seed /usr/local/bin/
COPY --from=build --chown=lumina:lumina /src/migrations ./migrations
ENV API_ADDRESS=:8080 \
    UPLOAD_DIR=/data/uploads
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD wget -q -O /dev/null http://127.0.0.1:8080/health/ready || exit 1
ENTRYPOINT ["/usr/local/bin/lumina-api"]
