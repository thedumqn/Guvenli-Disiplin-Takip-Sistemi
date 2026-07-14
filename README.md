# Güvenli Disiplin İşleri Takip Sistemi

Üniversitelerdeki disiplin süreçlerini yönetmek için yazdığım, güvenliği ilk
günden tasarımın merkezine koyduğum bir web uygulaması. Amacım CRUD ekranları
olan bir sistem yapmak değil, OWASP Top 10 (2021) maddelerinin her birine
somut karşılık gelen bir mimari kurmaktı. Hassas öğrenci verisi (telefon,
adres) veritabanında alan bazında şifreli durur, her kritik işlem audit log'a
düşer, yetkilendirme hem rol hem izin seviyesinde yapılır.

## Mimari

- `backend/` — Node.js + Express + MongoDB (Mongoose). REST API, `/api/v1/*`.
- `frontend/` — React + Vite + Tailwind. SPA, cookie tabanlı oturum.

Kimlik doğrulama akışı: login sonrası kısa ömürlü (15 dk) access token ve
7 günlük refresh token httpOnly + SameSite=Strict cookie'lere yazılır.
Access token ayrıca yanıt gövdesinde döner ve frontend'de yalnızca bellekte
tutulur — localStorage kullanılmaz, XSS ile token çalınması zorlaştırılır.
Sayfa yenilendiğinde oturum, refresh cookie üzerinden sessizce yenilenir.

## OWASP Top 10 (2021) karşılıkları

| Risk | Alınan önlem | Kod |
|------|-------------|-----|
| A01 Broken Access Control | Rol (RBAC) + izin bazlı yetkilendirme, kaynak sahipliği kontrolü, yetkisiz denemelerin audit'e HIGH severity ile yazılması | `backend/src/middlewares/auth.js` |
| A02 Cryptographic Failures | Şifreler bcrypt (cost 12), hassas alanlar AES-256-GCM ile alan bazında şifreli, şifre geçmişi de hash olarak tutulur | `backend/src/models/User.js`, `backend/src/models/Student.js` |
| A03 Injection | Mongoose şema validasyonu, express-validator ile girdi doğrulama, express-mongo-sanitize ile NoSQL injection filtresi (denemeler loglanır) | `backend/src/middlewares/validator.js`, `backend/src/server.js` |
| A04 Insecure Design | Hesap kilitleme (5 deneme / 30 dk), kullanıcı bulunamasa da dummy bcrypt çalıştırarak timing attack'ı dengeleme, max 5 aktif oturum | `backend/src/controllers/auth.controller.js` |
| A05 Security Misconfiguration | Helmet ile sıkı CSP ve güvenlik başlıkları, CORS allowlist, HPP, 10kb body limiti, hata yanıtlarında stack trace'in yalnızca development'ta dönmesi | `backend/src/server.js`, `backend/src/middlewares/errorHandler.js` |
| A06 Vulnerable Components | Bağımlılıklar minimal tutuldu; `npm audit` CI adımı yol haritasında | `backend/package.json` |
| A07 Auth Failures | Login'e IP+email bazlı rate limit, güçlü parola politikası (12+ karakter, karma), son 5 şifrenin tekrar kullanımının engellenmesi, şifre değişince tüm oturumların düşmesi | `backend/src/controllers/auth.controller.js`, `backend/src/models/User.js` |
| A08 Integrity Failures | Audit log koleksiyonu yalnızca ekleme mantığıyla kullanılır; kayıtlar kim/ne zaman/nereden bilgisiyle yazılır | `backend/src/models/AuditLog.js` |
| A09 Logging & Monitoring | Winston ile yapılandırılmış loglama, her isteğe X-Request-ID, güvenlik olayları (CSRF ihlali, geçersiz token, yetkisiz erişim) ayrıca işaretlenir | `backend/src/utils/logger.js` |
| A10 SSRF | Sunucu, kullanıcıdan gelen URL'lere istek atmaz; dış istek yüzeyi yok | — |

CSRF için double-submit cookie deseni kullanılır: token SameSite=Strict
cookie'de durur, state değiştiren her istekte `X-CSRF-Token` header'ı ile
eşleşmesi beklenir (`backend/src/middlewares/csrf.js`).

## Kurulum

Gereksinimler: Node 18+, yerel MongoDB (veya bir Atlas bağlantısı).

```bash
# Backend
cd backend
cp .env.example .env    # icindeki uretim komutlariyla anahtarlari doldur
npm install
npm run seed            # ornek kullanicilari olusturur
npm run dev             # http://localhost:5000

# Frontend (ayri terminal)
cd frontend
npm install
npm run dev             # http://localhost:5173
```

`.env` içindeki `DB_ENCRYPTION_KEY`, `JWT_SECRET`, `JWT_REFRESH_SECRET` ve
`COOKIE_SECRET` alanlarını dosyadaki komutlarla üretip doldurmadan backend
ayağa kalkmaz; bu bilinçli bir tercih, zayıf default'la çalışmayı istemedim.

Seed üç kullanıcı oluşturur (admin, kurul üyesi, öğrenci işleri) — şifreleri
`backend/src/seed.js` içinde görebilirsin, ilk girişten sonra değiştir.

## Roller

- **admin** — tüm yetkiler, kullanıcı yönetimi, audit log erişimi
- **kurul_uyesi** — disiplin kaydı oluşturma/güncelleme, karar ve itiraz süreçleri
- **ogrenci_isleri** — öğrenci kayıtları yönetimi, disiplin kayıtlarını görüntüleme
- **izleyici** — salt okunur erişim

## Bilinen sınırlamalar / yol haritası

- Refresh token rotasyonunda yeniden kullanım tespiti (reuse detection) yok;
  oturum takibi sessionId üzerinden yapılıyor ama çalınan refresh token
  süresi dolana kadar aynı oturumda geçerli kalıyor.
- MFA için model alanları hazır (`mfaEnabled`, `mfaSecret`) ancak TOTP akışı
  henüz bağlanmadı.
- E-posta doğrulama alanları mevcut, SMTP entegrasyonu yok.
- Test ve `npm audit`/dependency scanning içeren bir CI hattı eklenecek.

## Geliştirici

Sadettin Duman
