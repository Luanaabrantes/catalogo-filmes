# A distribuição comunitária do MinIO passou a ser source-only.
# Compilação do código oficial em uma versão fixa, sem espelhos de terceiros.
FROM golang:1.24.8-alpine AS build
RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z

FROM alpine:3.22
RUN apk add --no-cache ca-certificates curl
COPY --from=build /go/bin/minio /usr/local/bin/minio
EXPOSE 9000
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
