FROM golang:1.22-alpine AS build

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/home-usage-sidecar ./main.go

FROM alpine:3.22

RUN adduser -D -u 65532 appuser

COPY --from=build /out/home-usage-sidecar /usr/local/bin/home-usage-sidecar

USER appuser
EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/home-usage-sidecar"]
