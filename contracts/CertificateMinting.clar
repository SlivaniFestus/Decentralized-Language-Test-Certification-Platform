;; CertificateMinting.clar

(define-constant ERR-NOT-ISSUER u400)
(define-constant ERR-INVALID-RECIPIENT u401)
(define-constant ERR-INVALID-TEST-TYPE u402)
(define-constant ERR-INVALID-SCORE u403)
(define-constant ERR-INVALID-DATA-HASH u404)
(define-constant ERR-INVALID-EXPIRY u405)
(define-constant ERR-INVALID-LEVEL u406)
(define-constant ERR-INVALID-ISSUER-NAME u407)
(define-constant ERR-INVALID-RECIPIENT-NAME u408)
(define-constant ERR-INVALID-LOCATION u409)
(define-constant ERR-INVALID-CURRENCY u410)
(define-constant ERR-INVALID-STATUS u411)
(define-constant ERR-NOT-AUTHORIZED u412)
(define-constant ERR-INVALID-MAX-CERTS u413)
(define-constant ERR-INVALID-MIN-SCORE u414)
(define-constant ERR-INVALID-MAX-SCORE u415)
(define-constant ERR-INVALID-UPDATE-PARAM u416)
(define-constant ERR-MAX-CERTS-EXCEEDED u417)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u418)
(define-constant ERR-INVALID-TIMESTAMP u419)
(define-constant ERR-CERT-ALREADY-EXISTS u420)
(define-constant ERR-CERT-NOT-FOUND u421)
(define-constant ERR-INVALID-LANGUAGE u422)
(define-constant ERR-INVALID-CATEGORY u423)
(define-constant ERR-INVALID-FEE u424)
(define-constant ERR-INVALID-GRACE-PERIOD u425)

(define-data-var next-id uint u1)
(define-data-var max-certs uint u10000)
(define-data-var mint-fee uint u500)
(define-data-var authority-contract (optional principal) none)

(define-map certificates
  uint
  {
    issuer: principal,
    recipient: principal,
    test-type: (string-ascii 20),
    score: uint,
    issue-date: uint,
    data-hash: (buff 32),
    expiry-date: uint,
    level: (string-ascii 10),
    issuer-name: (string-ascii 50),
    recipient-name: (string-ascii 100),
    location: (string-ascii 50),
    currency: (string-ascii 10),
    status: bool,
    min-score: uint,
    max-score: uint,
    language: (string-ascii 20),
    category: (string-ascii 30)
  }
)

(define-map certs-by-hash (buff 32) uint)

(define-map cert-updates
  uint
  {
    update-score: uint,
    update-expiry: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-certificate (id uint))
  (map-get? certificates id)
)

(define-read-only (get-cert-updates (id uint))
  (map-get? cert-updates id)
)

(define-read-only (is-cert-registered (hash (buff 32)))
  (is-some (map-get? certs-by-hash hash))
)

(define-private (validate-recipient (recipient principal))
  (if (not (is-eq recipient 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-INVALID-RECIPIENT))
)

(define-private (validate-test-type (type (string-ascii 20)))
  (if (and (> (len type) u0) (<= (len type) u20))
    (ok true)
    (err ERR-INVALID-TEST-TYPE))
)

(define-private (validate-score (score uint))
  (if (and (>= score u0) (<= score u100))
    (ok true)
    (err ERR-INVALID-SCORE))
)

(define-private (validate-data-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
    (ok true)
    (err ERR-INVALID-DATA-HASH))
)

(define-private (validate-expiry (expiry uint))
  (if (> expiry block-height)
    (ok true)
    (err ERR-INVALID-EXPIRY))
)

(define-private (validate-level (level (string-ascii 10)))
  (if (or (is-eq level "beginner") (is-eq level "intermediate") (is-eq level "advanced"))
    (ok true)
    (err ERR-INVALID-LEVEL))
)

(define-private (validate-issuer-name (name (string-ascii 50)))
  (if (and (> (len name) u0) (<= (len name) u50))
    (ok true)
    (err ERR-INVALID-ISSUER-NAME))
)

(define-private (validate-recipient-name (name (string-ascii 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
    (ok true)
    (err ERR-INVALID-RECIPIENT-NAME))
)

(define-private (validate-location (loc (string-ascii 50)))
  (if (and (> (len loc) u0) (<= (len loc) u50))
    (ok true)
    (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
    (ok true)
    (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-score (min uint))
  (if (and (>= min u0) (<= min u100))
    (ok true)
    (err ERR-INVALID-MIN-SCORE))
)

(define-private (validate-max-score (max uint))
  (if (and (>= max u0) (<= max u100))
    (ok true)
    (err ERR-INVALID-MAX-SCORE))
)

(define-private (validate-language (lang (string-ascii 20)))
  (if (and (> (len lang) u0) (<= (len lang) u20))
    (ok true)
    (err ERR-INVALID-LANGUAGE))
)

(define-private (validate-category (cat (string-ascii 30)))
  (if (and (> (len cat) u0) (<= (len cat) u30))
    (ok true)
    (err ERR-INVALID-CATEGORY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-certs (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX-CERTS))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-certs new-max)
    (ok true)
  )
)

(define-public (set-mint-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-FEE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set mint-fee new-fee)
    (ok true)
  )
)

(define-public (mint-certificate
  (recipient principal)
  (test-type (string-ascii 20))
  (score uint)
  (data-hash (buff 32))
  (expiry-date uint)
  (level (string-ascii 10))
  (issuer-name (string-ascii 50))
  (recipient-name (string-ascii 100))
  (location (string-ascii 50))
  (currency (string-ascii 10))
  (min-score uint)
  (max-score uint)
  (language (string-ascii 20))
  (category (string-ascii 30))
)
  (let (
    (id (var-get next-id))
    (current-max (var-get max-certs))
    (authority (var-get authority-contract))
  )
    (asserts! (< id current-max) (err ERR-MAX-CERTS-EXCEEDED))
    (try! (validate-recipient recipient))
    (try! (validate-test-type test-type))
    (try! (validate-score score))
    (try! (validate-data-hash data-hash))
    (try! (validate-expiry expiry-date))
    (try! (validate-level level))
    (try! (validate-issuer-name issuer-name))
    (try! (validate-recipient-name recipient-name))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-score min-score))
    (try! (validate-max-score max-score))
    (try! (validate-language language))
    (try! (validate-category category))
    (asserts! (is-none (map-get? certs-by-hash data-hash)) (err ERR-CERT-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get mint-fee) tx-sender authority-recipient))
    )
    (map-set certificates id
      {
        issuer: tx-sender,
        recipient: recipient,
        test-type: test-type,
        score: score,
        issue-date: block-height,
        data-hash: data-hash,
        expiry-date: expiry-date,
        level: level,
        issuer-name: issuer-name,
        recipient-name: recipient-name,
        location: location,
        currency: currency,
        status: true,
        min-score: min-score,
        max-score: max-score,
        language: language,
        category: category
      }
    )
    (map-set certs-by-hash data-hash id)
    (var-set next-id (+ id u1))
    (print { event: "cert-minted", id: id })
    (ok id)
  )
)

(define-public (update-certificate
  (cert-id uint)
  (update-score uint)
  (update-expiry uint)
)
  (let ((cert (map-get? certificates cert-id)))
    (match cert
      c
        (begin
          (asserts! (is-eq (get issuer c) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-score update-score))
          (try! (validate-expiry update-expiry))
          (map-set certificates cert-id
            (merge c
              {
                score: update-score,
                expiry-date: update-expiry,
                issue-date: (get issue-date c),
                data-hash: (get data-hash c),
                status: (get status c)
              }
            )
          )
          (map-set cert-updates cert-id
            {
              update-score: update-score,
              update-expiry: update-expiry,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "cert-updated", id: cert-id })
          (ok true)
        )
      (err ERR-CERT-NOT-FOUND)
    )
  )
)

(define-public (get-cert-count)
  (ok (var-get next-id))
)

(define-public (check-cert-existence (hash (buff 32)))
  (ok (is-cert-registered hash))
)