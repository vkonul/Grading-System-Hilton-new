# Grading System — Vəzifə Dərəcələndirmə Sistemi

Otellər üçün vəzifə profili və dərəcələndirmə (G1–G10) veb tətbiqi. Spesifikasiya: [`Spec`](Spec).

- **Texnologiya:** sadə HTML + CSS + JavaScript (ES modul), build yoxdur — `index.html`, `style.css`, `app.js`.
- **Verilənlər:** Firebase Firestore (layihə `grade-system-new`), giriş — Google (Firebase Auth).
- **Excel:** SheetJS (CDN) — A. Dərəcələndirmə xülasəsi, B. Tam vəzifə profilləri, C. Tək vəzifə.
- **Dil:** AZ (standart) / EN, işıqlı / qaranlıq rejim, mobil uyğun.

## Video-tur və demo
- 4 dəqiqəlik video (ingiliscə səsləndirmə): https://grade-system-new.web.app/media/grading-system-tour.mp4
- Girişsiz demo: https://grade-system-new.web.app/#/demo

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
| Admin | Hər şey: rollar, nümunə məlumat, silmə, bütün hesabatlar; ehtiyat təsdiqləyici |
| HR direktoru / HR meneceri | Yekun təsdiq (öz qiymətləndirdiyi və öz vəzifəsi xaric), statistika |
| HR qiymətləndirici | Bütün vəzifələr, müstəqil HR qiymətləndirməsi, HR direktoruna göndərmə / menecerə qaytarma |
| Departament meneceri | Yalnız öz departamenti, 1–11-ci bölmələr + menecer qiymətləndirməsi (12A), HR-a göndərmə |
| Gözləmədə | "Rol gözlənilir" ekranı |

## Proses (status axını)
```
Qaralama ──(Menecer profili doldurur + 9 faktoru ballayır, göndərir)──► Göndərilib
   ──(HR müstəqil ballayır, menecerin ballarını sonra görür, kalibrasiya)──► HR direktorunun təsdiqində
   ──(HR direktoru / HR meneceri təsdiqləyir)──► Təsdiqlənib
HR profili natamam görsə ─► Qaytarılıb ─► Menecer düzəldib yenidən göndərir
HR direktoru şərhlə qaytarsa ─► Qiymətləndirilir (HR yenidən baxır)
```
**Qərəzsizlik tədbirləri:** müstəqil və “kor” qiymətləndirmə; menecer və HR arasında böyük fərq olduqda kalibrasiya qeydi; hər balın konkret tərifi (bal şkalası);
profildən avtomatik tövsiyə olunan bal (2+ fərq olduqda əsaslandırma mütləqdir); qiymətləndirmə ekranında işçinin adı gizlədilir; maraqlar toqquşması
(öz vəzifəsini qiymətləndirmək / təsdiqləmək olmaz — “İşçinin e-poçtu” sahəsi ilə yoxlanılır); 4 göz prinsipi (qiymətləndirən təsdiqləyə bilməz);
oxşar vəzifələrlə müqayisə; qiymətləndirici statistikası (Hesabatlar); tam tarixçə.

## E-poçt bildirişləri (Outlook / Microsoft 365)
Hər addımda növbəti şəxsin Outlook ünvanına məktub `mail` kolleksiyasına növbəyə yazılır. Göndərmək üçün bir dəfə:
1. Firebase layihəsini **Blaze** planına keçirin (Console → ⚙ → Usage and billing).
2. Microsoft 365-də göndərici poçt qutusu seçin (məs. `grading@sizinotel.az`) və IT-dən onun üçün **SMTP AUTH**-u aktiv etməsini xahiş edin.
3. Firebase Console → **Extensions → “Trigger Email from Firestore”** → Install:
   - Authentication type: *Username & Password*
   - SMTP connection URI: `smtp://grading%40sizinotel.az@smtp.office365.com:587`
   - SMTP password: həmin poçt qutusunun şifrəsi (Secret Manager-də saxlanılır)
   - Email documents collection: `mail` · Templates collection: `mailTemplates` · Default FROM: `Dərəcələndirmə Sistemi <grading@sizinotel.az>`
   - Firestore location: `nam5`
4. Tətbiqdə Admin → İstifadəçilər → **“E-poçt şablonlarını quraşdır”**, və hər istifadəçinin **Outlook e-poçtu** sahəsini doldurun.
Göndərilmə vəziyyəti Admin səhifəsindəki cədvəldə görünür.

UI düymələri rola görə gizlədilir, əsl qoruma isə `firestore.rules` qaydalarıdır.

## Fayllar
```
index.html            səhifə qabığı (Firebase SDK və SheetJS CDN-dən)
style.css             dizayn tokenləri, işıqlı/qaranlıq rejim, mobil, çap
app.js                router, ekranlar, i18n, qiymətləndirmə qaydaları, iş adları kitabxanası, nümunə məlumatlar, Excel ixracı
firestore.rules       Firestore təhlükəsizlik qaydaları
firebase.json         Firebase CLI (rules + hosting)
```
