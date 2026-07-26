# syntax=docker/dockerfile:1

# ---- builder ---------------------------------------------------------
FROM golang:1.25-alpine AS builder
WORKDIR /src

# Cache dependency downloads separately from source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api

# goose is a separate CLI (not a go.mod dependency of this module — see
# how migrations/ is applied locally) but is bundled into the image so
# migrations can be run against production the same way as in dev,
# without needing Go installed on the VPS. Version pinned to match the
# maintainer's local toolchain.
RUN go install github.com/pressly/goose/v3/cmd/goose@v3.27.1

# ---- runtime -----------------------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /out/api ./api
COPY --from=builder /go/bin/goose ./goose
COPY migrations ./migrations

EXPOSE 8080
ENTRYPOINT ["./api"]
