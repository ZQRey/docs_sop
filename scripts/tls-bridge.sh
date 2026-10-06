#!/bin/sh
# Restricted SSH entry point used by the CA renewal task. Private TLS keys stay here.
set -eu
umask 077
cd /home/zqrey/docs_sop
mkdir -p tls/releases
exec 9>tls/.renew.lock
flock -w 180 9
compose() { docker compose -f docker-compose.yml -f docker-compose.https.yml "$@"; }
case "${SSH_ORIGINAL_COMMAND:-${1:-}}" in
  status)
    if [ -f tls/current/cert.pem ]; then cat tls/current/cert.pem; else printf 'MISSING\n'; fi
    ;;
  csr)
    mkdir -p tls/pending
    if [ ! -f tls/pending/key.pem ]; then
      openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out tls/pending/key.pem 2>/dev/null
    fi
    openssl req -new -sha256 -key tls/pending/key.pem -subj '/CN=docs.gp1.loc' \
      -addext 'subjectAltName=DNS:docs.gp1.loc' -addext 'extendedKeyUsage=serverAuth' \
      -out tls/pending/request.pem
    cat tls/pending/request.pem
    ;;
  install)
    test -f tls/pending/key.pem
    test -f tls/ca.pem
    cat >tls/pending/cert.pem
    openssl x509 -in tls/pending/cert.pem -noout -checkhost docs.gp1.loc >&2
    openssl x509 -in tls/pending/cert.pem -noout -checkend 2592000 >&2
    openssl verify -CAfile tls/ca.pem -purpose sslserver tls/pending/cert.pem >&2
    cert_key=$(openssl x509 -in tls/pending/cert.pem -pubkey -noout | openssl sha256)
    private_key=$(openssl pkey -in tls/pending/key.pem -pubout | openssl sha256)
    test "$cert_key" = "$private_key"
    cat tls/pending/cert.pem tls/ca.pem >tls/pending/fullchain.pem
    chmod 600 tls/pending/key.pem
    chmod 644 tls/pending/cert.pem tls/pending/fullchain.pem
    release="releases/$(date -u +%Y%m%dT%H%M%SZ)-$$"
    mv tls/pending "tls/$release"
    chmod 755 "tls/$release"
    previous=$(readlink tls/current || true)
    ln -s "$release" tls/current.next
    mv -Tf tls/current.next tls/current
    if docker inspect docs_sop-nginx-1 --format '{{.State.Running}}' 2>/dev/null | grep -qx true; then
      if ! compose exec -T nginx nginx -t >&2 || ! compose exec -T nginx nginx -s reload >&2; then
        if [ -n "$previous" ]; then ln -s "$previous" tls/current.rollback; mv -Tf tls/current.rollback tls/current; fi
        echo 'Certificate activation failed; previous certificate restored' >&2
        exit 1
      fi
    fi
    printf 'INSTALLED\n'
    ;;
  *) echo 'Allowed operations: status, csr, install' >&2; exit 64 ;;
esac
