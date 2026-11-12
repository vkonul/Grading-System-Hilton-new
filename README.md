# Grading System — Vəzifə Dərəcələndirmə Sistemi

Otellər üçün vəzifə profili və dərəcələndirmə (G1–G10) veb tətbiqi. Spesifikasiya: [`Spec`](Spec).

- **Texnologiya:** sadə HTML + CSS + JavaScript (ES modul), build yoxdur — `index.html`, `style.css`, `app.js`.
- **Verilənlər:** Firebase Firestore (layihə `grade-system-new`), giriş — Google (Firebase Auth).
- **Excel:** SheetJS (CDN) — A. Dərəcələndirmə xülasəsi, B. Tam vəzifə profilləri, C. Tək vəzifə.
- **Dil:** AZ (standart) / EN, işıqlı / qaranlıq rejim, mobil uyğun.

## Quraşdırma (10 addım)

1. Firebase Console → `grade-system-new` layihəsini açın (və ya `firebase projects:create grade-system-new`).
2. **Build → Firestore Database → Create database** (və ya `firebase firestore:databases:create "(default)" --location=eur3`).
3. **Build → Authentication → Get started → Sign-in method → Google → Enable → Save.**
4. Veb tətbiq konfiqurasiyası: `firebase apps:sdkconfig WEB` — dəyərlər `app.js` faylının yuxarısındakı `firebaseConfig` obyektindədir.
5. Qaydaları dərc edin: `firebase deploy --only firestore:rules` (fayl: `firestore.rules`).
6. Saytı yayımlayın: `firebase deploy --only hosting` → `https://grade-system-new.web.app` (və ya Vercel-ə statik sayt kimi; build əmri yoxdur).
7. Vercel/başqa domen istifadə edirsinizsə: **Authentication → Settings → Authorized domains** bölməsinə domeni əlavə edin.
8. Sayta Google ilə bir dəfə daxil olun — hesabınız `pending` rolu ilə yaradılır.
9. **İlk Admin:** Firebase Console → Firestore → `users/{sizin uid}` sənədində `role` sahəsini `"admin"` edin, sonra saytda **Yenilə** düyməsini basın.
10. Admin → İstifadəçilər səhifəsində digər istifadəçilərə rol/departament verin və **Nümunə məlumatları yüklə** ilə 5 nümunə qeyd əlavə edin (təkrar basmaq dublikat yaratmır).

Lokal işə salmaq: istənilən statik server, məsələn `npx serve .` və ya VS Code Live Server (`localhost` avtomatik icazəlidir).

## Rollar
| Rol | İmkanlar |
|---|---|
| Admin | Hər şey: rollar, nümunə məlumat, silmə, bütün hesabatlar |
| HR qiymətləndirici | Bütün vəzifələr, 12-ci bölmə (qiymətləndirmə), təsdiq/qaytarma |
| Departament meneceri | Yalnız öz departamenti, 1–11-ci bölmələr, göndərmə |
| Gözləmədə | "Rol gözlənilir" ekranı |

## Proses (status axını)
```
Qaralama → (Menecer göndərir) Göndərilib → (HR ballayır) Qiymətləndirilir
   → (HR "Menecerin təsdiqinə göndər") Menecer təsdiqində → (Departament meneceri təsdiqləyir) Təsdiqlənib
                                                       ↘ (Menecer şərhlə HR-a qaytarır) Qiymətləndirilir
HR profili natamam görsə → Qaytarılıb → Menecer düzəldib yenidən göndərir
```
- Təsdiq avtomatik olaraq vəzifənin departamentinin menecerinə düşür (həmin departamentə təyin olunmuş `manager` rolu).
- Menecer yalnız öz departamentinin işçilərini görür. HR yekun təsdiq verə bilmir; Admin ehtiyat olaraq birbaşa təsdiqləyə bilər.
- Kitabxana (departamentlər, vəzifə adları, səviyyələr) Admin tərəfindən redaktə olunur və Firestore-da `departments` kolleksiyasında saxlanılır.

UI düymələri rola görə gizlədilir, əsl qoruma isə `firestore.rules` qaydalarıdır.

## Fayllar
```
index.html            səhifə qabığı (Firebase SDK və SheetJS CDN-dən)
style.css             dizayn tokenləri, işıqlı/qaranlıq rejim, mobil, çap
app.js                router, ekranlar, i18n, qiymətləndirmə qaydaları, iş adları kitabxanası, nümunə məlumatlar, Excel ixracı
firestore.rules       Firestore təhlükəsizlik qaydaları
firebase.json         Firebase CLI (rules + hosting)
```
