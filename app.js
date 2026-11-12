// Grading System — Vəzifə Dərəcələndirmə Sistemi
// Plain ES module, no build step. Firebase v10 modular SDK from the CDN, SheetJS as global XLSX.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection as fsCollection, doc as fsDoc, getDoc as fsGetDoc, getDocs as fsGetDocs, setDoc as fsSetDoc, addDoc as fsAddDoc, updateDoc as fsUpdateDoc, deleteDoc as fsDeleteDoc, query as fsQuery, where as fsWhere, serverTimestamp as fsServerTimestamp, writeBatch as fsWriteBatch, arrayUnion as fsArrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================================
   1) Firebase config (project: grade-system-new)
   ===================================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyD_vCK_LMIf0_LCA5vnQY8tnSxKK7tQiSs",
  authDomain: "grade-system-new.firebaseapp.com",
  projectId: "grade-system-new",
  storageBucket: "grade-system-new.firebasestorage.app",
  messagingSenderId: "568060782484",
  appId: "1:568060782484:web:102132a61b4dc151cb9181"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ---------------------------------------------------------------------
   Demo / open view: no sign-in, data lives only in this browser tab
   (sessionStorage). Same functions as Firestore, so every screen works.
   --------------------------------------------------------------------- */
const DEMO = { on:false, db:null, uid:"demo-admin", tick:0 };
class DTS { constructor(ms) { this.ms = ms; } toMillis() { return this.ms; } }
const dclone = v => v instanceof DTS ? new DTS(v.ms) : Array.isArray(v) ? v.map(dclone) : (v && typeof v === "object") ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dclone(x)])) : v;
const demoNow = () => new DTS(Date.now() + (DEMO.tick++));
function demoSave() {
  try { sessionStorage.setItem("gs.demo", JSON.stringify({ db:DEMO.db, uid:DEMO.uid }, (k, v) => v instanceof DTS ? { __ts:v.ms } : v)); } catch {}
}
function demoLoad() {
  try { const raw = sessionStorage.getItem("gs.demo"); if (!raw) return false;
    const o = JSON.parse(raw, (k, v) => v && typeof v === "object" && "__ts" in v ? new DTS(v.__ts) : v);
    DEMO.db = o.db; DEMO.uid = o.uid || "demo-admin"; return true; } catch { return false; }
}
function demoDenied() { const e = new Error("demo"); e.code = "permission-denied"; return e; }
const collection = (d, name) => DEMO.on ? { name } : fsCollection(d, name);
const doc = (d, col, id) => DEMO.on ? { col, id } : fsDoc(d, col, id);
const where = (f, op, v) => DEMO.on ? { f, v } : fsWhere(f, op, v);
const query = (c, ...w) => DEMO.on ? { name:c.name, w } : fsQuery(c, ...w);
const serverTimestamp = () => DEMO.on ? demoNow() : fsServerTimestamp();
const arrayUnion = (...items) => DEMO.on ? { __union:items } : fsArrayUnion(...items);
async function getDocs(q) {
  if (!DEMO.on) return fsGetDocs(q);
  let rows = Object.entries(DEMO.db[q.name] || {});
  (q.w || []).forEach(w => { rows = rows.filter(([, v]) => v[w.f] === w.v); });
  return { docs:rows.map(([id, v]) => ({ id, data:() => dclone(v) })) };
}
async function getDoc(r) {
  if (!DEMO.on) return fsGetDoc(r);
  const v = DEMO.db[r.col]?.[r.id];
  return { id:r.id, exists:() => !!v, data:() => dclone(v) };
}
async function setDoc(r, data) { if (!DEMO.on) return fsSetDoc(r, data); (DEMO.db[r.col] ??= {})[r.id] = dclone(data); demoSave(); }
async function addDoc(c, data) { if (!DEMO.on) return fsAddDoc(c, data); const id = "demo" + Math.random().toString(36).slice(2, 10); await setDoc({ col:c.name, id }, data); return { id }; }
async function updateDoc(r, data) {
  if (!DEMO.on) return fsUpdateDoc(r, data);
  const o = DEMO.db[r.col]?.[r.id]; if (!o) throw demoDenied();
  for (const [k, v] of Object.entries(data)) { const ks = k.split("."); let a = o; ks.slice(0, -1).forEach(x => { a = (a[x] ??= {}); }); const last = ks[ks.length - 1];
    a[last] = v && v.__union ? [...(Array.isArray(a[last]) ? a[last] : []), ...dclone(v.__union)] : dclone(v); }
  demoSave();
}
async function deleteDoc(r) { if (!DEMO.on) return fsDeleteDoc(r); delete DEMO.db[r.col]?.[r.id]; demoSave(); }
function writeBatch(d) {
  if (!DEMO.on) return fsWriteBatch(d);
  const ops = [];
  return { set:(r, x) => ops.push(() => setDoc(r, x)), delete:r => ops.push(() => deleteDoc(r)), commit:async () => { for (const o of ops) await o(); } };
}

/* =====================================================================
   2) Static data: departments & job titles (spec 5E)
   ===================================================================== */
const DEPARTMENTS = [
 { code:"EXE", en:"Executive Management", az:"İcraçı rəhbərlik",
   descEn:"Sets hotel strategy, leads all divisions and is accountable for overall financial, guest and team results.",
   descAz:"Otelin strategiyasını müəyyən edir, bütün bölmələrə rəhbərlik edir və ümumi maliyyə, qonaq və komanda nəticələrinə görə məsuliyyət daşıyır.",
   titles:["General Manager","Hotel Manager","Director of Operations","Director of Finance","Director of Human Resources","Director of Sales & Marketing","Director of Food & Beverage","Director of Rooms","Director of Engineering","Director of Revenue Management","Director of Security"] },
 { code:"HR", en:"Human Resources", az:"İnsan resursları",
   descEn:"Attracts, develops and retains talent; manages employee relations, pay and labour-law compliance.",
   descAz:"İstedadları cəlb edir, inkişaf etdirir və saxlayır; işçi münasibətlərini, əmək haqqını və əmək qanunvericiliyinə uyğunluğu idarə edir.",
   titles:["Human Resources Director","Human Resources Manager","Assistant Human Resources Manager","Human Resources Coordinator","Human Resources Officer","Human Resources Administrator","Learning & Development Manager","Learning & Development Coordinator","Training Officer","Recruitment Manager","Recruitment Specialist","Employee Relations Manager","Compensation & Benefits Manager","HR Assistant"] },
 { code:"FO", en:"Front Office", az:"Qəbul şöbəsi (Front Office)",
   descEn:"Welcomes guests, manages check-in and check-out, room assignment, guest requests and front-of-house service.",
   descAz:"Qonaqları qarşılayır, qeydiyyat və çıxış proseslərini, otaqların bölüşdürülməsini, qonaq müraciətlərini və ön xidməti idarə edir.",
   titles:["Front Office Manager","Assistant Front Office Manager","Front Desk Manager","Front Desk Supervisor","Front Desk Agent","Receptionist","Guest Relations Manager","Guest Relations Officer","Guest Experience Executive","Concierge Manager","Concierge","Bell Captain","Bell Attendant","Door Attendant","Night Manager","Night Auditor","Executive Lounge Manager","Executive Lounge Supervisor","Executive Lounge Agent"] },
 { code:"HK", en:"Housekeeping", az:"Otaq xidməti (Housekeeping)",
   descEn:"Keeps guest rooms, public areas, linen and uniforms clean, safe and to brand standard.",
   descAz:"Qonaq otaqlarının, ictimai sahələrin, yataq dəstlərinin və uniformaların təmiz, təhlükəsiz və brend standartlarına uyğun olmasını təmin edir.",
   titles:["Executive Housekeeper","Assistant Executive Housekeeper","Housekeeping Manager","Housekeeping Supervisor","Floor Supervisor","Housekeeping Coordinator","Room Attendant","Public Area Attendant","Houseperson","Laundry Manager","Laundry Supervisor","Laundry Attendant","Linen Room Attendant","Uniform Room Attendant","Tailor"] },
 { code:"FB", en:"Food & Beverage Service", az:"Qida və içki xidməti",
   descEn:"Delivers restaurant, bar, room service and banquet service that drives guest satisfaction and revenue.",
   descAz:"Qonaq məmnuniyyətini və gəliri artıran restoran, bar, otağa xidmət və banket xidmətlərini göstərir.",
   titles:["Director of Food & Beverage","Food & Beverage Manager","Assistant Food & Beverage Manager","Restaurant Manager","Assistant Restaurant Manager","Outlet Manager","Bar Manager","Banquet Manager","Banquet Operations Manager","Banquet Supervisor","Restaurant Supervisor","Bar Supervisor","Host / Hostess","Waiter / Waitress","Food & Beverage Attendant","Bartender","Barista","Room Service Manager","Room Service Supervisor","Room Service Attendant","Mini Bar Attendant"] },
 { code:"KIT", en:"Kitchen / Culinary", az:"Mətbəx",
   descEn:"Plans menus and prepares food safely, consistently and within cost targets.",
   descAz:"Menyuları planlaşdırır, yeməkləri təhlükəsiz, ardıcıl və xərc hədəfləri çərçivəsində hazırlayır.",
   titles:["Executive Chef","Executive Sous Chef","Sous Chef","Junior Sous Chef","Chef de Partie","Demi Chef de Partie","Commis Chef","Apprentice Chef","Pastry Chef","Pastry Sous Chef","Pastry Chef de Partie","Pastry Commis","Baker","Butcher","Kitchen Supervisor","Kitchen Stewarding Manager","Chief Steward","Stewarding Supervisor","Kitchen Steward","Dishwasher"] },
 { code:"FIN", en:"Finance & Accounting", az:"Maliyyə və mühasibat",
   descEn:"Manages accounting, auditing, cost control, payroll, purchasing and financial reporting.",
   descAz:"Mühasibat uçotunu, auditi, xərclərə nəzarəti, əmək haqqını, satınalmanı və maliyyə hesabatlarını idarə edir.",
   titles:["Director of Finance","Financial Controller","Assistant Financial Controller","Finance Manager","Chief Accountant","Assistant Chief Accountant","General Accountant","Income Auditor","Night Auditor","Accounts Payable Supervisor","Accounts Payable Officer","Accounts Receivable Officer","Cost Controller","Cost Control Supervisor","Purchasing Manager","Purchasing Supervisor","Purchasing Officer","Storekeeper","Receiving Clerk","Payroll Officer","Cashier"] },
 { code:"SM", en:"Sales & Marketing", az:"Satış və marketinq",
   descEn:"Generates room, event and F&B business and builds the hotel's brand and reputation.",
   descAz:"Otaq, tədbir və qida-içki satışlarını təmin edir, otelin brendini və nüfuzunu formalaşdırır.",
   titles:["Director of Sales & Marketing","Director of Sales","Sales Manager","Assistant Sales Manager","Senior Sales Manager","Sales Executive","Sales Coordinator","Business Development Manager","Marketing Manager","Marketing Executive","Marketing Coordinator","Digital Marketing Specialist","Social Media Specialist","Public Relations Manager","Communications Manager","E-commerce Manager","Wedding Sales Manager","Events Sales Manager","Corporate Sales Manager","MICE Sales Manager"] },
 { code:"REV", en:"Revenue Management & Reservations", az:"Gəlirlərin idarə edilməsi və rezervasiya",
   descEn:"Sets prices and manages room inventory, sales channels and reservations to maximise revenue.",
   descAz:"Gəliri maksimuma çatdırmaq üçün qiymətləri müəyyən edir, otaq inventarını, satış kanallarını və rezervasiyaları idarə edir.",
   titles:["Director of Revenue Management","Revenue Manager","Assistant Revenue Manager","Revenue Analyst","Revenue Coordinator","Reservations Manager","Assistant Reservations Manager","Reservations Supervisor","Reservations Agent","Reservations Coordinator","Revenue Optimization Specialist"] },
 { code:"ENG", en:"Engineering & Maintenance", az:"Mühəndislik və texniki xidmət",
   descEn:"Maintains building systems, equipment and energy use; ensures safe, comfortable facilities.",
   descAz:"Bina sistemlərinə, avadanlıqlara və enerji istifadəsinə texniki xidmət göstərir; təhlükəsiz və rahat şəraiti təmin edir.",
   titles:["Director of Engineering","Chief Engineer","Assistant Chief Engineer","Engineering Manager","Engineering Supervisor","Maintenance Supervisor","Electrician","Plumber","HVAC Technician","Carpenter","Painter","General Maintenance Technician","Refrigeration Technician","Swimming Pool Technician","Engineering Coordinator"] },
 { code:"SEC", en:"Security", az:"Təhlükəsizlik",
   descEn:"Protects guests, staff and assets; manages fire and life safety and loss prevention.",
   descAz:"Qonaqları, işçiləri və aktivləri qoruyur; yanğın və həyat təhlükəsizliyini, itkilərin qarşısının alınmasını idarə edir.",
   titles:["Director of Security","Security Manager","Assistant Security Manager","Security Supervisor","Security Officer","CCTV Operator","Loss Prevention Officer","Fire & Life Safety Officer","Security Coordinator"] },
 { code:"SPA", en:"Spa & Recreation", az:"Spa və istirahət",
   descEn:"Delivers spa treatments, fitness and pool services to brand and hygiene standards.",
   descAz:"Spa prosedurlarını, fitnes və hovuz xidmətlərini brend və gigiyena standartlarına uyğun göstərir.",
   titles:["Spa Manager","Assistant Spa Manager","Spa Supervisor","Spa Receptionist","Spa Therapist","Massage Therapist","Beauty Therapist","Fitness Manager","Fitness Instructor","Personal Trainer","Lifeguard","Pool Attendant"] },
 { code:"IT", en:"Information Technology", az:"İnformasiya texnologiyaları",
   descEn:"Runs and secures hotel systems, networks and devices and supports users.",
   descAz:"Otel sistemlərini, şəbəkələri və cihazları idarə edir, onların təhlükəsizliyini təmin edir və istifadəçilərə dəstək göstərir.",
   titles:["IT Director","IT Manager","IT Supervisor","IT Coordinator","IT Support Specialist","IT Technician","Systems Administrator","Network Administrator","IT Security Specialist"] },
 { code:"EVT", en:"Events & Banqueting", az:"Tədbirlər və banketlər",
   descEn:"Plans and delivers conferences, weddings and banquets from contract to event day.",
   descAz:"Konfransları, toyları və banketləri müqavilədən tədbir gününədək planlaşdırır və həyata keçirir.",
   titles:["Director of Events","Events Manager","Assistant Events Manager","Event Planning Manager","Event Coordinator","Conference & Events Manager","Banquet Operations Manager","Banquet Supervisor","Banquet Captain","Banquet Server","AV Technician","Event Setup Attendant"] },
 { code:"PRC", en:"Procurement & Logistics", az:"Satınalma və logistika",
   descEn:"Buys, receives, stores and issues goods at the right quality, price and time.",
   descAz:"Malları lazımi keyfiyyətdə, qiymətdə və vaxtda alır, qəbul edir, saxlayır və təhvil verir.",
   titles:["Procurement Manager","Purchasing Manager","Procurement Officer","Purchasing Officer","Purchasing Coordinator","Logistics Coordinator","Receiving Supervisor","Receiving Clerk","Storekeeper","Inventory Controller"] }
];
const DEPT = Object.fromEntries(DEPARTMENTS.map(d => [d.code, d]));
// Built-in library = default. Admin edits are stored in Firestore `departments/{code}` and replace it at sign-in.
const DEFAULT_DEPARTMENTS = JSON.parse(JSON.stringify(DEPARTMENTS));
function applyLibrary(list) {
  DEPARTMENTS.splice(0, DEPARTMENTS.length, ...list);
  Object.keys(DEPT).forEach(k => delete DEPT[k]);
  DEPARTMENTS.forEach(d => { d.titles = d.titles || []; d.levels = d.levels || {}; DEPT[d.code] = d; });
}

/* =====================================================================
   3) Grading rules (spec 5D)
   ===================================================================== */
const GRADES = ["G1","G2","G3","G4","G5","G6","G7","G8","G9","G10"];
const LEVELS = {
  L1:{ en:"Executive", az:"İcraçı rəhbər", range:["G9","G10"] },
  L2:{ en:"Department Head", az:"Departament rəhbəri", range:["G8","G9"] },
  L3:{ en:"Manager", az:"Menecer", range:["G6","G8"] },
  L4:{ en:"Assistant Manager / Supervisor", az:"Köməkçi menecer / Supervayzer", range:["G4","G6"] },
  L5:{ en:"Professional / Officer", az:"Mütəxəssis / Əməkdaş", range:["G3","G5"] },
  L6:{ en:"Operational / Entry", az:"Əməliyyat / Başlanğıc səviyyə", range:["G1","G3"] }
};
const FACTORS = [
  { key:"knowledge", en:"Knowledge & Expertise", az:"Bilik və ekspertiza", dEn:"Education and specialist knowledge needed", dAz:"Tələb olunan təhsil və ixtisas bilikləri" },
  { key:"experience", en:"Experience", az:"Təcrübə", dEn:"Years and type of experience needed", dAz:"Tələb olunan təcrübənin müddəti və növü" },
  { key:"problemSolving", en:"Problem-Solving", az:"Problemlərin həlli", dEn:"How complex and new the problems are", dAz:"Problemlərin mürəkkəbliyi və yeniliyi" },
  { key:"decisionMaking", en:"Decision-Making", az:"Qərarvermə", dEn:"Freedom to decide without approval", dAz:"Təsdiqsiz qərar qəbul etmə sərbəstliyi" },
  { key:"accountability", en:"Accountability", az:"Hesabatlılıq", dEn:"Responsibility for results and mistakes", dAz:"Nəticələrə və səhvlərə görə məsuliyyət" },
  { key:"businessImpact", en:"Business Impact", az:"Biznesə təsir", dEn:"Effect on guests, revenue and costs", dAz:"Qonaqlara, gəlirə və xərclərə təsir" },
  { key:"leadership", en:"Leadership", az:"Liderlik", dEn:"Leading, developing and managing people", dAz:"İnsanlara rəhbərlik, onların inkişafı və idarə edilməsi" },
  { key:"communication", en:"Communication", az:"Kommunikasiya", dEn:"Level and importance of contacts", dAz:"Əlaqələrin səviyyəsi və əhəmiyyəti" },
  { key:"workingConditions", en:"Working Conditions", az:"İş şəraiti", dEn:"Physical, mental and schedule demands", dAz:"Fiziki, psixoloji yük və iş qrafiki tələbləri" }
];
const SCALE = [["Very low","Çox aşağı"],["Low","Aşağı"],["Moderate","Orta"],["High","Yüksək"],["Very high","Çox yüksək"]];

function recommendGrade(total) {
  const bands = [[12,"G1"],[16,"G2"],[20,"G3"],[24,"G4"],[28,"G5"],[32,"G6"],[36,"G7"],[39,"G8"],[42,"G9"],[45,"G10"]];
  if (total == null || total < 9) return null;
  return (bands.find(([max]) => total <= max) || [null, null])[1];
}
function scoreTotal(scores) {
  const vals = FACTORS.map(f => Number(scores?.[f.key]) || 0);
  const count = vals.filter(v => v >= 1).length;
  return { total: vals.reduce((a, b) => a + b, 0), count, complete: count === 9 };
}
// Returns null until all 9 scores are present.
function recommendFromScores(scores) { const s = scoreTotal(scores); return s.complete ? recommendGrade(s.total) : null; }

const LEVEL_OVERRIDES = { "Executive Chef":"L2","Executive Housekeeper":"L2","Financial Controller":"L2","Chief Engineer":"L2",
  "Executive Sous Chef":"L3","Chief Accountant":"L3","Chief Steward":"L3","Pastry Chef":"L3","Demi Chef de Partie":"L5" };
const L6_WORDS = ["Agent","Attendant","Clerk","Commis","Apprentice","Waiter","Host","Bartender","Barista","Steward","Dishwasher","Receptionist","Concierge","Houseperson","Cashier","Storekeeper","Baker","Butcher","Tailor","Lifeguard","Carpenter","Painter","Operator","Server"];
function suggestLevel(title) {
  const t = String(title || "").trim();
  if (!t) return "";
  if (LEVEL_OVERRIDES[t]) return LEVEL_OVERRIDES[t];
  if (/Director|General Manager|Hotel Manager/.test(t)) return "L1";
  if (t.startsWith("Assistant ")) return "L4";
  if (t.includes("Manager")) return "L3";
  if (/Supervisor|Captain|Sous Chef|Chef de Partie/.test(t)) return "L4";
  if (L6_WORDS.some(w => t.includes(w)) || /Assistant$/.test(t)) return "L6";
  return "L5";
}
// Level for a title: admin's per-department override first, otherwise the automatic rule.
function levelFor(title, deptCode) { return DEPT[deptCode]?.levels?.[title] || suggestLevel(title); }
const gradeIdx = g => GRADES.indexOf(g);
const inRange = (g, lvl) => { const r = LEVELS[lvl]?.range; if (!r || !g) return true; const i = gradeIdx(g); return i >= gradeIdx(r[0]) && i <= gradeIdx(r[1]); };
const rangeText = lvl => LEVELS[lvl] ? `${LEVELS[lvl].range[0]}–${LEVELS[lvl].range[1]}` : "—";

const LEVEL_TEMPLATES = {
  L1:{ en:"Leads the {dept} function at hotel level, sets strategy and is accountable for its financial, guest and people results.",
       az:"Otel səviyyəsində {dept} funksiyasına rəhbərlik edir, strategiyanı müəyyən edir və onun maliyyə, qonaq və kadr nəticələrinə görə məsuliyyət daşıyır.",
       resp:[["Set annual strategy, goals and budget","İllik strategiya, hədəflər və büdcəni müəyyən etmək","monthly","lead"],
             ["Lead and develop department heads","Departament rəhbərlərinə rəhbərlik etmək və onları inkişaf etdirmək","weekly","lead"],
             ["Review results and report to owners and management","Nəticələri təhlil etmək və sahibkarlara və rəhbərliyə hesabat vermək","monthly","lead"]] },
  L2:{ en:"Manages the whole {dept} department, its team, budget and standards, and delivers department targets.",
       az:"Bütün {dept} departamentini, onun komandasını, büdcəsini və standartlarını idarə edir, departament hədəflərinə nail olur.",
       resp:[["Plan and control department budget and costs","Departament büdcəsini və xərclərini planlaşdırmaq və nəzarət etmək","monthly","manage"],
             ["Hire, train and evaluate the team","Komandanı işə qəbul etmək, öyrətmək və qiymətləndirmək","weekly","manage"],
             ["Set and audit service and quality standards","Xidmət və keyfiyyət standartlarını müəyyən etmək və yoxlamaq","weekly","manage"]] },
  L3:{ en:"Manages a unit within {dept}, plans daily operations and leads the team to meet service and financial targets.",
       az:"{dept} daxilində bölməni idarə edir, gündəlik əməliyyatları planlaşdırır və komandanı xidmət və maliyyə hədəflərinə çatmağa yönəldir.",
       resp:[["Plan schedules and staffing","İş qrafikini və kadr təminatını planlaşdırmaq","weekly","manage"],
             ["Track KPIs and guest feedback and act on them","KPI-ları və qonaq rəylərini izləmək və tədbir görmək","daily","manage"],
             ["Coach the team and handle escalations","Komandaya kouçinq etmək və mürəkkəb müraciətləri həll etmək","daily","manage"]] },
  L4:{ en:"Supervises daily {dept} operations on the shift and makes sure the team follows procedures and brand standards.",
       az:"Növbə ərzində {dept} üzrə gündəlik əməliyyatlara nəzarət edir və komandanın prosedurlara və brend standartlarına əməl etməsini təmin edir.",
       resp:[["Brief the shift team and assign tasks","Növbə komandasına brifinq keçmək və tapşırıqları bölüşdürmək","daily","supervise"],
             ["Check quality and fix issues","Keyfiyyəti yoxlamaq və çatışmazlıqları aradan qaldırmaq","daily","supervise"],
             ["Train new staff on the job","Yeni işçiləri iş yerində öyrətmək","weekly","supervise"]] },
  L5:{ en:"Performs specialised {dept} work, such as analysis, coordination or technical tasks, to support the department's goals.",
       az:"Departamentin hədəflərini dəstəkləmək üçün {dept} üzrə ixtisaslaşmış işləri — təhlil, koordinasiya və ya texniki tapşırıqları — yerinə yetirir.",
       resp:[["Complete assigned specialist tasks accurately","Tapşırılan ixtisas işlərini dəqiq yerinə yetirmək","daily","execute"],
             ["Prepare reports and records","Hesabat və qeydləri hazırlamaq","weekly","execute"],
             ["Coordinate with other departments","Digər departamentlərlə əlaqələndirmə aparmaq","daily","execute"]] },
  L6:{ en:"Delivers day-to-day {dept} service to guests or colleagues, following standard procedures, safety rules and brand standards.",
       az:"Standart prosedurlara, təhlükəsizlik qaydalarına və brend standartlarına əməl edərək qonaqlara və ya həmkarlara gündəlik {dept} xidmətini göstərir.",
       resp:[["Carry out daily duties to standard","Gündəlik vəzifələri standarta uyğun yerinə yetirmək","daily","execute"],
             ["Respond to guest and colleague requests","Qonaq və həmkarların müraciətlərinə cavab vermək","daily","support"],
             ["Keep the work area clean, safe and stocked","İş sahəsini təmiz, təhlükəsiz və təchiz olunmuş saxlamaq","daily","execute"]] }
};

/* =====================================================================
   4) Option lists & field definitions (spec 5C)
   ===================================================================== */
const OPTS = {
  freq:{ daily:["Daily","Gündəlik"], weekly:["Weekly","Həftəlik"], monthly:["Monthly","Aylıq"], occasionally:["Occasionally","Arabir"] },
  lmh:{ low:["Low","Aşağı"], medium:["Medium","Orta"], high:["High","Yüksək"] },
  respLevel:{ support:["Support","Dəstək"], execute:["Execute","İcra"], supervise:["Supervise","Nəzarət"], manage:["Manage","İdarəetmə"], lead:["Lead","Rəhbərlik"] },
  commLevel:{ inform:["Inform","Məlumatlandırma"], coordinate:["Coordinate","Koordinasiya"], negotiate:["Negotiate","Danışıqlar"], influence:["Influence","Təsir"] },
  employmentType:{ full_time:["Full-time","Tam ştat"], part_time:["Part-time","Natamam ştat"], casual:["Casual","Müvəqqəti"] },
  education:{ secondary:["Secondary","Orta"], vocational:["Vocational","Peşə"], bachelor:["Bachelor","Bakalavr"], master:["Master","Magistr"], doctorate:["Doctorate","Doktorantura"] },
  supervision:{ close:["Close","Sıx"], general:["General","Ümumi"], minimal:["Minimal","Minimal"] },
  travel:{ none:["None","Yoxdur"], occasional:["Occasional","Arabir"], frequent:["Frequent","Tez-tez"] }
};
const STATUSES = { draft:["Draft","Qaralama"], submitted:["Submitted","Göndərilib"], under_evaluation:["Under evaluation","Qiymətləndirilir"], director_approval:["Awaiting HR Director approval","HR direktorunun təsdiqində"], returned:["Returned","Qaytarılıb"], approved:["Approved","Təsdiqlənib"] };
const ROLES = { admin:["Admin","Administrator"], hr_director:["HR Director / HR Manager","HR direktoru / HR meneceri"], hr:["HR Evaluator","HR qiymətləndirici"], manager:["Department Manager","Departament meneceri"], pending:["Pending","Gözləmədə"] };

// [key, EN, AZ, type, required?]  types: text | textarea | number | date | grade | jobLevel | dept | jobTitle | opt:<list> | yesno
const TOP_FIELDS = [
  ["employeeCode","Employee Code","İşçi kodu","text",1],
  ["fullName","Full Name","Ad, soyad","text",1],
  ["hireDate","Hire Date","İşə qəbul tarixi","date"],
  ["employeeEmail","Employee e-mail (conflict-of-interest check)","İşçinin e-poçtu (maraqlar toqquşması yoxlaması)","text"]
];
const SECTIONS = [
  { n:1, key:"position", en:"Position Information", az:"Vəzifə haqqında məlumat", fields:[
    ["department","Department","Departament","dept",1],
    ["jobTitle","Job Title","Vəzifənin adı","jobTitle",1],
    ["division","Division / Business Unit","Bölmə / Biznes vahidi","text"],
    ["currentGrade","Current Job Grade","Hazırkı vəzifə dərəcəsi","grade"],
    ["jobLevel","Job Level","Vəzifə səviyyəsi","jobLevel"],
    ["positionId","Position ID","Vəzifə ID-si","text"],
    ["employmentType","Employment Type","Məşğulluq növü","opt:employmentType"],
    ["location","Location","İş yeri","text"],
    ["reportsTo","Reporting To (Manager / Position)","Kimə tabedir (rəhbər / vəzifə)","text"],
    ["directReports","Number of Direct Reports","Birbaşa tabeliyində olanların sayı","number"],
    ["indirectReports","Number of Indirect Reports","Dolayı tabeliyində olanların sayı","number"],
    ["lastEvaluationDate","Date of Last Job Evaluation","Son qiymətləndirmə tarixi","date"] ]},
  { n:2, key:"purpose", en:"Job Purpose", az:"Vəzifənin məqsədi", fields:[
    ["primaryPurpose","Primary purpose of this position","Vəzifənin əsas məqsədi","textarea",1],
    ["mainObjectives","Main objectives of the role","Rolun əsas hədəfləri","textarea"],
    ["departmentContribution","Contribution to department objectives","Departamentin hədəflərinə töhfəsi","textarea"],
    ["strategyContribution","Contribution to overall business strategy","Ümumi biznes strategiyasına töhfəsi","textarea"] ]},
  { n:3, key:"responsibilities", en:"Key Responsibilities & Accountabilities", az:"Əsas öhdəliklər və məsuliyyətlər", array:true, fields:[
    ["task","Key Responsibility / Task","Əsas öhdəlik / Tapşırıq","text",1],
    ["description","Detailed Description","Ətraflı təsvir","textarea"],
    ["frequency","Frequency","Tezlik","opt:freq",1],
    ["level","Level of Responsibility","Məsuliyyət səviyyəsi","opt:respLevel",1],
    ["outcomes","Expected Outcomes / Deliverables","Gözlənilən nəticələr","textarea"],
    ["kpis","Key Performance Indicators (KPIs)","Əsas fəaliyyət göstəriciləri (KPI)","textarea"],
    ["accountability","Level of Accountability","Hesabatlılıq səviyyəsi","opt:lmh"] ]},
  { n:4, key:"knowledge", en:"Knowledge, Skills & Experience", az:"Bilik, bacarıq və təcrübə", fields:[
    ["minEducation","Minimum Educational Qualification","Minimum təhsil tələbi","opt:education"],
    ["preferredEducation","Preferred Educational Background","Üstünlük verilən təhsil sahəsi","text"],
    ["experienceYears","Required Professional Experience (Years)","Tələb olunan iş təcrübəsi (il)","number"],
    ["industryExperience","Required Industry Experience","Sahə üzrə tələb olunan təcrübə","text"],
    ["technicalKnowledge","Technical / Professional Knowledge","Texniki / peşə bilikləri","textarea"],
    ["technicalSkills","Required Technical Skills","Tələb olunan texniki bacarıqlar","textarea"],
    ["softwareSystems","Required Software / Systems Knowledge","Proqram təminatı / sistem bilikləri","text"],
    ["languages","Language Requirements","Dil tələbləri","text"],
    ["certifications","Required Certifications / Licenses","Tələb olunan sertifikatlar / lisenziyalar","text"],
    ["leadershipSkills","Leadership and Management Skills (if applicable)","Liderlik və idarəetmə bacarıqları (tətbiq olunarsa)","textarea"] ]},
  { n:5, key:"decisions", en:"Decision-Making & Autonomy", az:"Qərarvermə və müstəqillik", fields:[
    ["independentDecisions","Decisions made independently","Müstəqil qəbul edilən qərarlar","textarea"],
    ["approvalDecisions","Decisions requiring management approval","Rəhbərliyin təsdiqini tələb edən qərarlar","textarea"],
    ["authorityLevel","Level of Decision-Making Authority","Qərarvermə səlahiyyətinin səviyyəsi","opt:lmh"],
    ["budgetaryAuthority","Budgetary Authority","Büdcə səlahiyyəti","text"],
    ["expenditureApproval","Authority to approve expenditures","Xərcləri təsdiqləmə səlahiyyəti","text"],
    ["operationalChanges","Authority to implement operational changes","Əməliyyat dəyişiklikləri etmək səlahiyyəti","opt:lmh"],
    ["supervisionReceived","Level of Supervision Received","Alınan nəzarətin səviyyəsi","opt:supervision"],
    ["guidanceFrequency","Frequency of Management Guidance","Rəhbərlik yönləndirməsinin tezliyi","opt:freq"] ]},
  { n:6, key:"scope", en:"Scope of Responsibility & Business Impact", az:"Məsuliyyət sahəsi və biznesə təsir", fields:[
    ["employeesSupported","Number of Employees Supported / Managed","Dəstəklənən / idarə olunan işçilərin sayı","number"],
    ["departmentsSupported","Departments Supported","Dəstəklənən departamentlər","text"],
    ["operationalImpact","Operational Impact","Əməliyyat təsiri","opt:lmh"],
    ["financialImpact","Financial Impact","Maliyyə təsiri","opt:lmh"],
    ["guestSatisfactionImpact","Impact on Guest Satisfaction","Qonaq məmnuniyyətinə təsir","opt:lmh"],
    ["employeeExperienceImpact","Impact on Employee Experience","İşçi təcrübəsinə təsir","opt:lmh"],
    ["businessPerformanceImpact","Impact on Business Performance","Biznes nəticələrinə təsir","opt:lmh"],
    ["assetsResponsibility","Responsibility for Company Assets / Resources","Şirkət aktivləri / resursları üzrə məsuliyyət","opt:lmh"],
    ["externalInteraction","External Stakeholder Interaction","Xarici tərəflərlə əlaqə","textarea"],
    ["internalInteraction","Internal Stakeholder Interaction","Daxili tərəflərlə əlaqə","textarea"] ]},
  { n:7, key:"problemSolving", en:"Problem-Solving & Complexity", az:"Problemlərin həlli və mürəkkəblik", fields:[
    ["problemNature","Nature of Problems Encountered","Rastlaşılan problemlərin xarakteri","textarea"],
    ["problemFrequency","Frequency of Problem-Solving Activities","Problem həlli fəaliyyətlərinin tezliyi","opt:freq"],
    ["complexity","Level of Problem Complexity","Problemlərin mürəkkəblik səviyyəsi","opt:lmh"],
    ["analyticalThinking","Analytical Thinking Requirements","Analitik düşüncə tələbi","opt:lmh"],
    ["independentResolution","Requirement for Independent Problem Resolution","Problemlərin müstəqil həlli tələbi","opt:lmh"],
    ["strategicPlanning","Requirement for Strategic Planning","Strateji planlaşdırma tələbi","opt:lmh"],
    ["innovation","Level of Innovation and Process Improvement","İnnovasiya və proseslərin təkmilləşdirilməsi səviyyəsi","opt:lmh"],
    ["errorImpact","Impact of Errors or Incorrect Decisions","Səhv və ya yanlış qərarların təsiri","opt:lmh"] ]},
  { n:8, key:"communication", en:"Communication & Working Relationships", az:"Kommunikasiya və iş əlaqələri", fields:[
    ["internalStakeholders","Key Internal Stakeholders","Əsas daxili tərəflər","textarea"],
    ["externalStakeholders","Key External Stakeholders","Əsas xarici tərəflər","textarea"],
    ["communicationPurpose","Purpose of Communication","Kommunikasiyanın məqsədi","textarea"],
    ["communicationLevel","Level of Communication","Kommunikasiya səviyyəsi","opt:commLevel"],
    ["interactionFrequency","Frequency of Interaction","Qarşılıqlı əlaqənin tezliyi","opt:freq"],
    ["confidentiality","Confidentiality Requirements","Məxfilik tələbləri","opt:lmh"],
    ["representation","Representation of the Organization","Təşkilatın təmsil edilməsi","yesno"] ]},
  { n:9, key:"people", en:"People Management & Leadership", az:"Komandanın idarə edilməsi və liderlik", fields:[
    ["recruitment","Recruitment / Selection Responsibilities","İşə qəbul / seçim məsuliyyəti","yesno"],
    ["performanceManagement","Performance Management Responsibilities","Fəaliyyətin idarə edilməsi","yesno"],
    ["trainingDevelopment","Training and Development Responsibilities","Təlim və inkişaf","yesno"],
    ["coaching","Coaching and Mentoring","Kouçinq və mentorluq","yesno"],
    ["disciplinary","Disciplinary Responsibilities","İntizam məsələləri","yesno"],
    ["workforcePlanning","Workforce Planning","İşçi qüvvəsinin planlaşdırılması","yesno"],
    ["teamAccountability","Team Performance Accountability","Komandanın nəticələrinə görə məsuliyyət","yesno"] ]},
  { n:10, key:"environment", en:"Working Environment & Conditions", az:"İş mühiti və şəraiti", fields:[
    ["workingSchedule","Working Schedule","İş qrafiki","text"],
    ["shiftWork","Shift Work Requirements","Növbəli iş tələbi","yesno"],
    ["physicalRequirements","Physical Requirements","Fiziki tələblər","opt:lmh"],
    ["mentalDemands","Mental / Emotional Demands","Psixoloji / emosional yük","opt:lmh"],
    ["healthSafetyRisks","Occupational Health & Safety Risks","Əməyin mühafizəsi və təhlükəsizlik riskləri","opt:lmh"],
    ["challengingConditions","Exposure to Challenging Working Conditions","Çətin iş şəraitinə məruz qalma","opt:lmh"],
    ["weekendsHolidays","Work During Weekends / Public Holidays","Həftəsonu / bayram günlərində iş","yesno"],
    ["travel","Travel Requirements","Ezamiyyət tələbləri","opt:travel"] ]},
  { n:11, key:"financial", en:"Financial & Resource Responsibility", az:"Maliyyə və resurs məsuliyyəti", fields:[
    ["budgetResponsibility","Budget Responsibility","Büdcə məsuliyyəti","yesno"],
    ["budgetSize","Budget Size (AZN, if applicable)","Büdcənin həcmi (AZN, tətbiq olunarsa)","number"],
    ["financialApprovalLimit","Financial Approval Authority (AZN)","Maliyyə təsdiq səlahiyyəti (AZN)","number"],
    ["revenueGeneration","Revenue Generation Responsibility","Gəlir yaratma məsuliyyəti","yesno"],
    ["costControl","Cost Control Responsibility","Xərclərə nəzarət məsuliyyəti","yesno"],
    ["equipmentAssets","Responsibility for Equipment and Assets","Avadanlıq və aktivlər üzrə məsuliyyət","yesno"],
    ["inventoryStock","Responsibility for Inventory / Stock","İnventar / anbar üzrə məsuliyyət","yesno"] ]}
];
// Section 13 — the incumbent's own qualifications (compared with the job requirements in section 4)
const QUAL = { n:13, key:"qualifications", en:"Employee qualifications", az:"İşçinin ixtisası (fərdi profil)", fields:[
  ["education","Highest education","Ən yüksək təhsil","opt:education",1],
  ["fieldOfStudy","Field of study","İxtisas sahəsi","text"],
  ["experienceYears","Total professional experience (years)","Ümumi iş təcrübəsi (il)","number",1],
  ["hospitalityYears","Hospitality experience (years)","Qonaqpərvərlik sahəsində təcrübə (il)","number"],
  ["certificationsHeld","Certifications / licenses held","Mövcud sertifikatlar / lisenziyalar","text"],
  ["languagesSpoken","Languages spoken","Bildiyi dillər","text"],
  ["notes","Notes","Qeydlər","textarea"] ]};
const SEC12 = { n:12, key:"evaluation", en:"Job Evaluation & Grading Assessment", az:"Vəzifənin qiymətləndirilməsi və dərəcələndirilməsi" };
const EVAL_FIELDS = [
  ...FACTORS.map(f => ["scores." + f.key, f.en + " Score", f.az + " balı", "score"]),
  ["totalScore","Total Evaluation Score","Ümumi qiymətləndirmə balı","number"],
  ["recommendedGrade","Recommended Job Grade","Tövsiyə olunan dərəcə","grade"],
  ["finalGrade","Final Approved Job Grade","Yekun təsdiqlənmiş dərəcə","grade"],
  ["comments","Evaluator Comments","Qiymətləndiricinin şərhləri","textarea"],
  ["approvalStatus","Approval Status","Təsdiq statusu","status"],
  ["evaluationDate","Evaluation Date","Qiymətləndirmə tarixi","date"],
  ["evaluatorName","Evaluator","Qiymətləndirici","text"]
];
const PERSIST_KEYS = ["employeeCode","fullName","hireDate","employeeEmail","departmentId","status","returnComment","managerEvaluation","standard","kpiExtra","qualifications", ...SECTIONS.map(s => s.key), "evaluation"];

/* =====================================================================
   5) i18n — { az:{...}, en:{...} }
   ===================================================================== */
const STR = {
  appName:["Grading System","Dərəcələndirmə Sistemi"], appSub:["Job grading","Vəzifə dərəcələndirməsi"],
  tagline:["Fair, consistent job grading for hospitality teams","Qonaqpərvərlik komandaları üçün ədalətli və vahid vəzifə dərəcələndirməsi"],
  signInGoogle:["Sign in with Google","Google ilə daxil ol"], signOut:["Sign out","Çıxış"], refresh:["Refresh","Yenilə"],
  loading:["Loading…","Yüklənir…"], skipToContent:["Skip to content","Məzmuna keç"], menu:["Menu","Menyu"], close:["Close","Bağla"],
  pendingTitle:["Waiting for role","Rol gözlənilir"],
  pendingText:["Your account is waiting for role assignment. Please contact the administrator.","Hesabınız rol təyinatını gözləyir. Zəhmət olmasa, administratorla əlaqə saxlayın."],
  navDashboard:["Dashboard","İdarə paneli"], navPositions:["Positions","Vəzifələr"], navLibrary:["Library","Kitabxana"], navReports:["Reports","Hesabatlar"], navAdmin:["Admin","Admin"],
  themeToggle:["Toggle light / dark mode","İşıqlı / qaranlıq rejim"], langLabel:["Language","Dil"], role:["Role","Rol"],
  totalPositions:["Total positions","Cəmi vəzifələr"], gradeDist:["Grade distribution","Dərəcələr üzrə bölgü"], gradeDistSub:["Final approved grades","Yekun təsdiqlənmiş dərəcələr"],
  recent:["Recently updated","Son yenilənənlər"], quickActions:["Quick actions","Sürətli əməliyyatlar"],
  newPosition:["New position","Yeni vəzifə"], waitingEval:["Waiting for my evaluation","Qiymətləndirməmi gözləyənlər"],
  myDeptOnly:["Showing your department only","Yalnız sizin departament göstərilir"], allStatuses:["Status counts","Status üzrə say"],
  search:["Search","Axtarış"], searchPh:["Name, title or Position ID","Ad, vəzifə və ya Vəzifə ID-si"], all:["All","Hamısı"],
  department:["Department","Departament"], status:["Status","Status"], grade:["Grade","Dərəcə"], level:["Level","Səviyyə"],
  cards:["Cards","Kartlar"], list:["List","Siyahı"], exportExcel:["Export to Excel","Excel-ə ixrac"], exportXlsx:["Export .xlsx","Excel (.xlsx) ixrac"],
  noPositions:["No positions yet","Hələ vəzifə yoxdur"], noResults:["No positions match the filters","Filtrlərə uyğun vəzifə tapılmadı"],
  loadSample:["Load sample data","Nümunə məlumatları yüklə"], lastUpdated:["Last updated","Son yenilənmə"],
  name:["Name","Ad"], jobTitle:["Job Title","Vəzifənin adı"], currentGrade:["Current Grade","Hazırkı dərəcə"], finalGrade:["Final Grade","Yekun dərəcə"], updated:["Updated","Yenilənib"],
  results:["results","nəticə"],
  editPosition:["Edit position","Vəzifəni redaktə et"], employee:["Employee","İşçi"],
  sectionsComplete:["sections complete","bölmə tamamlanıb"], cancel:["Cancel","Ləğv et"], saveDraft:["Save draft","Qaralamanı saxla"], save:["Save","Yadda saxla"],
  submitEval:["Submit for evaluation","Qiymətləndirməyə göndər"], chooseDept:["Choose a department","Departament seçin"], chooseTitle:["Choose a job title","Vəzifə seçin"],
  otherTitle:["Other (type title)","Digər (adı yazın)"], typeTitle:["Type the job title","Vəzifənin adını yazın"], filterTitles:["Search titles","Vəzifələrdə axtar"],
  suggestedRange:["Suggested grade range","Tövsiyə olunan dərəcə aralığı"], addResp:["+ Add responsibility","+ Öhdəlik əlavə et"], removeResp:["Remove","Sil"],
  responsibility:["Responsibility","Öhdəlik"], sec9Hidden:["This section appears when the number of direct reports is greater than 0.","Bu bölmə birbaşa tabeliyində olanların sayı 0-dan çox olduqda görünür."],
  readOnlyHR:["Filled in by HR. Read-only.","HR tərəfindən doldurulur. Yalnız oxumaq üçün."], noScores:["Not evaluated yet","Hələ qiymətləndirilməyib"],
  returnedBanner:["Returned by HR — please update and resubmit","HR tərəfindən qaytarılıb — düzəliş edib yenidən göndərin"],
  yes:["Yes","Bəli"], no:["No","Xeyr"], select:["— Select —","— Seçin —"], prefilled:["Template text was pre-filled — please make it specific.","Şablon mətni əlavə olundu — zəhmət olmasa dəqiqləşdirin."],
  levelAuto:["Auto-set from the job title (editable)","Vəzifə adına görə avtomatik təyin edilir (dəyişə bilərsiniz)"],
  edit:["Edit","Redaktə et"], evaluate:["Evaluate","Qiymətləndir"], exportPos:["Export this position (.xlsx)","Bu vəzifəni ixrac et (.xlsx)"], del:["Delete","Sil"], print:["Print","Çap et"], duplicate:["Duplicate","Surətini çıxar"],
  back:["Back","Geri"], notApplicable:["Not applicable (no direct reports)","Tətbiq olunmur (birbaşa tabeçilik yoxdur)"], positionId:["Position ID","Vəzifə ID-si"],
  viewFull:["View full profile","Tam profilə bax"], profileSummary:["Job profile summary","Vəzifə profilinin xülasəsi"],
  totalScore:["Total score","Ümumi bal"], recommended:["Recommended grade","Tövsiyə olunan dərəcə"], suggestedForLevel:["Suggested range for this level","Bu səviyyə üçün tövsiyə olunan aralıq"],
  finalApproved:["Final approved grade","Yekun təsdiqlənmiş dərəcə"], comments:["Evaluator comments","Qiymətləndiricinin şərhləri"], evalDate:["Evaluation date","Qiymətləndirmə tarixi"], evaluator:["Evaluator","Qiymətləndirici"],
  saveScores:["Save scores","Balları yadda saxla"], approve:["Approve","Təsdiqlə"], returnChanges:["Return for changes","Düzəliş üçün qaytar"],
  explainDiff:["Explain why the grade differs","Dərəcənin fərqlənmə səbəbini izah edin"], scoreAll:["Score all 9 factors to get a recommendation","Tövsiyə üçün 9 faktorun hamısını qiymətləndirin"],
  outOfRange:["The final grade is outside the suggested range for this job level.","Yekun dərəcə bu vəzifə səviyyəsi üçün tövsiyə olunan aralıqdan kənardadır."],
  scored:["scored","qiymətləndirilib"],
  libTitle:["Job Title Library","Vəzifə adları kitabxanası"], libSub:["Departments, job titles, suggested levels and grade ranges.","Departamentlər, vəzifə adları, tövsiyə olunan səviyyələr və dərəcə aralıqları."], titlesCount:["titles","vəzifə"],
  reportsTitle:["Reports","Hesabatlar"], reportsSub:["Download Excel (.xlsx) reports. Headers follow the current language.","Excel (.xlsx) hesabatlarını yükləyin. Başlıqlar cari dildədir."],
  repA:["A. Grading Summary","A. Dərəcələndirmə xülasəsi"], repADesc:["One row per position: factor scores, total, recommended and final grade.","Hər vəzifə üçün bir sətir: faktor balları, ümumi bal, tövsiyə olunan və yekun dərəcə."],
  repB:["B. Full Job Profiles","B. Tam vəzifə profilləri"], repBDesc:["All profile fields in 3 sheets: Positions, Responsibilities, Evaluations.","Bütün profil sahələri 3 vərəqdə: Vəzifələr, Öhdəliklər, Qiymətləndirmələr."],
  repC:["C. Single position","C. Tək vəzifə"], repCDesc:["Open a position and click “Export this position (.xlsx)” on its detail page.","Vəzifəni açın və detal səhifəsində “Bu vəzifəni ixrac et (.xlsx)” düyməsini basın."],
  goPositions:["Go to positions","Vəzifələrə keç"], rows:["rows","sətir"],
  usersTitle:["Users & roles","İstifadəçilər və rollar"], usersSub:["Changes save immediately.","Dəyişikliklər dərhal yadda saxlanılır."], lastSignIn:["Last sign-in","Son giriş"],
  noDept:["— No department —","— Departament yoxdur —"], deptRequired:["A department is required for managers","Menecerlər üçün departament mütləqdir"], you:["you","siz"],
  cannotOwnRole:["You cannot change your own role","Öz rolunuzu dəyişə bilməzsiniz"], sampleTitle:["Sample data","Nümunə məlumatlar"],
  sampleDesc:["Adds 5 sample employee records (EMP-001 … EMP-005). Existing employee codes are skipped.","5 nümunə işçi qeydi əlavə edir (EMP-001 … EMP-005). Mövcud işçi kodları ötürülür."],
  // toasts & dialogs
  tSaved:["Saved","Yadda saxlanıldı"], tSubmitted:["Submitted for evaluation","Qiymətləndirməyə göndərildi"], tApproved:["Approved","Təsdiqləndi"], tReturned:["Returned for changes","Düzəliş üçün qaytarıldı"],
  tError:["Something went wrong","Xəta baş verdi"], tDeleted:["Deleted","Silindi"], tPermission:["You do not have permission for this action","Bu əməliyyat üçün icazəniz yoxdur"],
  tMissing:["Please fill in the required fields","Zəhmət olmasa, mütləq sahələri doldurun"], tNeedResp:["Add at least 1 responsibility with task, frequency and level","Ən azı 1 öhdəlik (tapşırıq, tezlik və səviyyə) əlavə edin"],
  tDupCode:["This employee code already exists","Bu işçi kodu artıq mövcuddur"], tNeedAll:["Score all 9 factors and choose a final grade","9 faktorun hamısını qiymətləndirin və yekun dərəcə seçin"],
  tNeedComment:["A comment is required","Şərh mütləqdir"], tNoAccessEval:["Only HR and Admin can evaluate positions","Vəzifələri yalnız HR və Admin qiymətləndirə bilər"],
  tCannotEdit:["This position can't be edited in its current status","Bu vəzifəni cari statusda redaktə etmək olmaz"], tNotFound:["Position not found","Vəzifə tapılmadı"],
  tSampleAdded:["Sample data loaded: {n} added, {s} skipped","Nümunə məlumatlar yükləndi: {n} əlavə edildi, {s} ötürüldü"], tExported:["Excel file downloaded","Excel faylı yükləndi"],
  tBadEmail:["Enter a valid e-mail address","Düzgün e-poçt ünvanı daxil edin"], tXlsxMissing:["Excel library is still loading — try again","Excel kitabxanası hələ yüklənir — yenidən cəhd edin"], tSignInFailed:["Sign-in failed","Daxil olmaq alınmadı"],
  tAdminOnly:["This page is for admins only","Bu səhifə yalnız adminlər üçündür"], tNoDept:["Your account has no department assigned yet","Hesabınıza hələ departament təyin edilməyib"],
  tCopy:["Copy created — review and save","Surət yaradıldı — yoxlayıb yadda saxlayın"],
  confirmTitle:["Are you sure?","Əminsiniz?"], ok:["Yes","Bəli"], confirmDelete:["This position will be deleted permanently.","Bu vəzifə həmişəlik silinəcək."],
  confirmApprovedEdit:["Edit an approved position?","Təsdiqlənmiş vəzifə redaktə edilsin?"], confirmApprovedEditText:["The position is already approved. Changes will be saved without a new approval.","Vəzifə artıq təsdiqlənib. Dəyişikliklər yeni təsdiq olmadan yadda saxlanılacaq."],
  confirmSample:["Load 5 sample employee records into Firestore?","5 nümunə işçi qeydi Firestore-a yüklənsin?"], confirmLeave:["Leave without saving?","Yadda saxlamadan çıxılsın?"],
  confirmApprove:["Approve this position with grade {g}?","Bu vəzifə {g} dərəcəsi ilə təsdiqlənsin?"], confirmReturn:["Return this position to the manager for changes?","Bu vəzifə düzəliş üçün menecerə qaytarılsın?"],
  hrComment:["HR Comment","HR şərhi"], created:["Created","Yaradılıb"],
  sheetSummary:["Summary","Xülasə"], sheetPositions:["Positions","Vəzifələr"], sheetResp:["Responsibilities","Öhdəliklər"], sheetEval:["Evaluations","Qiymətləndirmələr"], sheetJD:["Job Description","Vəzifə təlimatı"],
  sendToManager:["Send to manager for approval","Menecerin təsdiqinə göndər"], approveDirect:["Approve directly (Admin)","Birbaşa təsdiqlə (Admin)"],
  tSentToManager:["Sent to the department manager for approval","Departament menecerinin təsdiqinə göndərildi"],
  confirmSend:["Send grade {g} to the {d} manager for approval?","{g} dərəcəsi “{d}” menecerinin təsdiqinə göndərilsin?"],
  mgrPanelTitle:["Your approval is required","Təsdiqiniz tələb olunur"],
  mgrPanelText:["HR proposed grade {g} for this position. Approve it, or return it to HR with a comment.","HR bu vəzifə üçün {g} dərəcəsini təklif edib. Təsdiqləyin və ya şərhlə HR-a qaytarın."],
  mgrComment:["Manager comment","Menecerin şərhi"], mgrApprove:["Approve grade","Dərəcəni təsdiqlə"], mgrReturn:["Return to HR","HR-a qaytar"],
  tMgrReturned:["Returned to HR","HR-a qaytarıldı"], waitingMgr:["Waiting for approval by the {d} manager","“{d}” menecerinin təsdiqini gözləyir"],
  waitingMine:["Waiting for my approval","Təsdiqimi gözləyənlər"], pendingMineBanner:["{n} position(s) are waiting for your approval","{n} vəzifə təsdiqinizi gözləyir"],
  mgrReturnedBanner:["Returned by the manager","Menecer tərəfindən qaytarılıb"], managerApproval:["Manager approval","Menecer təsdiqi"],
  mgrDecision:["Manager decision","Menecerin qərarı"], mgrBy:["Manager","Menecer"], mgrDate:["Decision date","Qərar tarixi"],
  dec_pending:["Pending","Gözləyir"], dec_approved:["Approved","Təsdiqləndi"], dec_returned:["Returned to HR","HR-a qaytarıldı"],
  confirmMgrApprove:["Approve grade {g} for this position?","Bu vəzifə üçün {g} dərəcəsi təsdiqlənsin?"],
  deptsNoManager:["Departments without a manager — approvals there can only be done by an Admin:","Meneceri olmayan departamentlər — oradakı təsdiqləri yalnız Admin edə bilər:"],
  libEdit:["Edit library","Kitabxananı redaktə et"], libSave:["Save library","Kitabxananı yadda saxla"], addTitle:["+ Add title","+ Vəzifə əlavə et"],
  newTitle:["New job title","Yeni vəzifə adı"], addDept:["+ New department","+ Yeni departament"], delDept:["Delete department","Departamenti sil"],
  deptCode:["Code","Kod"], nameAz:["Name (AZ)","Ad (AZ)"], nameEn:["Name (EN)","Ad (EN)"], descAzL:["Description (AZ)","Təsvir (AZ)"], descEnL:["Description (EN)","Təsvir (EN)"],
  levelAutoOpt:["Auto ({l})","Avto ({l})"], titleName:["Job title","Vəzifə adı"], delTitle:["Delete title","Vəzifəni sil"],
  libEditHint:["Changes apply to new positions. Existing positions keep their title and department until they are edited.","Dəyişikliklər yeni vəzifələrə tətbiq olunur. Mövcud vəzifələr redaktə edilənə qədər öz adını və departamentini saxlayır."],
  deptInUse:["{n} position(s) use this department — move them first","{n} vəzifə bu departamentdən istifadə edir — əvvəlcə onları köçürün"],
  tCodeInvalid:["Department code must be 2–5 Latin capital letters and unique","Departament kodu 2–5 böyük latın hərfi olmalı və təkrarlanmamalıdır"],
  tNameRequired:["Department names (AZ and EN) are required","Departament adları (AZ və EN) mütləqdir"],
  tDupTitle:["Duplicate title in the same department: {t}","Eyni departamentdə təkrar vəzifə: {t}"], tLibSaved:["Library saved","Kitabxana yadda saxlanıldı"],
  tMoved:["Moved to {d}","“{d}” departamentinə köçürüldü"], titlesHead:["Job titles","Vəzifə adları"],
  openDemo:["Open demo — no sign-in needed","Demo-ya bax — giriş tələb olunmur"],
  demoHint:["Explore every screen with sample data. Changes stay only in your browser.","Bütün ekranlara nümunə məlumatlarla baxın. Dəyişikliklər yalnız sizin brauzerinizdə qalır."],
  demoBar:["DEMO — sample data, changes are not saved to the real database","DEMO — nümunə məlumatlar, dəyişikliklər real bazaya yazılmır"],
  demoRole:["View as","Kim kimi baxmaq"], shareDemo:["Copy share link","Paylaşım linkini kopyala"], exitDemo:["Exit demo","Demodan çıx"],
  resetDemo:["Reset demo","Demonu sıfırla"], tLinkCopied:["Link copied — send it to your colleagues","Link kopyalandı — həmkarlarınıza göndərin"], or:["or","və ya"],
  sendToDirector:["Send to HR Director for approval","HR direktorunun təsdiqinə göndər"],
  tSentToDirector:["Sent to the HR Director for final approval","Yekun təsdiq üçün HR direktoruna göndərildi"],
  confirmSendDir:["Send grade {g} to the HR Director for final approval?","{g} dərəcəsi yekun təsdiq üçün HR direktoruna göndərilsin?"],
  finalApproval:["Final approval","Yekun təsdiq"], dirPanelTitle:["Your final approval is required","Yekun təsdiqiniz tələb olunur"],
  dirPanelText:["HR proposed grade {g}. Review both evaluations, then approve or return to HR with a comment.","HR {g} dərəcəsini təklif edib. Hər iki qiymətləndirməyə baxın, sonra təsdiqləyin və ya şərhlə HR-a qaytarın."],
  dirComment:["Comment","Şərh"], dirApprove:["Approve grade","Dərəcəni təsdiqlə"], dirReturn:["Return to HR","HR-a qaytar"], tReturnedHR:["Returned to HR","HR-a qaytarıldı"],
  dirReturnedBanner:["Returned by the HR Director","HR direktoru tərəfindən qaytarılıb"], finalDecision:["Final decision","Yekun qərar"],
  waitingDirector:["Waiting for final approval by the HR Director","HR direktorunun yekun təsdiqini gözləyir"],
  pendingDirBanner:["{n} position(s) are waiting for your final approval","{n} vəzifə yekun təsdiqinizi gözləyir"], waitingMyApproval:["Waiting for my approval","Təsdiqimi gözləyənlər"],
  pendingEvalBanner:["{n} position(s) are waiting for HR evaluation","{n} vəzifə HR qiymətləndirməsini gözləyir"],
  pendingFixBanner:["{n} position(s) were returned to you for changes","{n} vəzifə düzəliş üçün sizə qaytarılıb"], returnedToMe:["Returned to me","Mənə qaytarılanlar"],
  notDirector:["Only the HR Director / HR Manager can give the final approval","Yekun təsdiqi yalnız HR direktoru / HR meneceri verə bilər"],
  conflictSelf:["Conflict of interest: you cannot score or approve your own position","Maraqlar toqquşması: öz vəzifənizi qiymətləndirə və ya təsdiqləyə bilməzsiniz"],
  fourEyes:["Four-eyes rule: the person who scored the position cannot approve it","4 göz prinsipi: vəzifəni qiymətləndirən şəxs onu təsdiqləyə bilməz"],
  mgrEvaluation:["Manager evaluation","Menecerin qiymətləndirməsi"], hrEvaluation:["HR evaluation","HR qiymətləndirməsi"],
  mgrEvalSub:["Step 1 — the department manager scores the 9 factors before sending to HR","1-ci addım — departament meneceri HR-a göndərməzdən əvvəl 9 faktoru ballayır"],
  hrEvalSub:["Step 2 — HR scores independently; Step 3 — HR Director approves","2-ci addım — HR müstəqil ballayır; 3-cü addım — HR direktoru təsdiqləyir"],
  mgrScore:["Manager","Menecer"], hrScore:["HR","HR"], gap:["Gap (HR−M)","Fərq (HR−M)"], factor:["Factor","Faktor"],
  profileHint:["Profile","Profil"], hintTitle:["Score suggested by the facts in the job profile","Vəzifə profilindəki faktlara əsasən tövsiyə olunan bal"],
  pickScore:["Choose a score — each level has a definition","Bal seçin — hər səviyyənin tərifi var"], scaleGuide:["Scoring guide","Bal şkalası"],
  justify:["Justification","Əsaslandırma"], justifyHint:["Your score ({v}) differs from the profile ({h}) by 2+ points — explain why","Balınız ({v}) profildən ({h}) 2+ bal fərqlənir — səbəbini izah edin"],
  tNeedJust:["Add a justification where your score differs from the profile by 2+ points","Balı profildən 2+ fərqlənən faktorlar üçün əsaslandırma yazın"],
  tNeedMgrScores:["Score all 9 factors in “Manager evaluation” before sending","Göndərməzdən əvvəl “Menecerin qiymətləndirməsi” bölməsində 9 faktorun hamısını ballayın"],
  mgrOnlySubmit:["Only the department manager scores and sends the position to HR","Vəzifəni yalnız departament meneceri ballayıb HR-a göndərir"],
  noMgrScores:["The manager has not scored this position","Menecer bu vəzifəni ballamayıb"],
  blindInfo:["Hidden so your scoring stays independent. Score all 9 factors first.","Qiymətləndirməniz müstəqil qalsın deyə gizlədilib. Əvvəlcə 9 faktorun hamısını ballayın."],
  revealMgr:["Compare with the manager's scores","Menecerin balları ilə müqayisə et"], tRevealFirst:["Compare with the manager's scores before sending","Göndərməzdən əvvəl menecerin balları ilə müqayisə edin"],
  calibration:["Calibration","Kalibrasiya"], calFlag:["Calibration needed: max factor gap {m}, total gap {tg}","Kalibrasiya tələb olunur: faktor üzrə maks. fərq {m}, ümumi fərq {tg}"],
  calOk:["Manager and HR scores are consistent","Menecer və HR balları uyğundur"], calNote:["Calibration note","Kalibrasiya qeydi"],
  calHint:["Explain how the difference with the manager was resolved","Menecerlə fərqin necə həll olunduğunu izah edin"], tNeedCal:["A calibration note is required","Kalibrasiya qeydi mütləqdir"],
  changedAfterReveal:["HR changed scores after seeing the manager's","HR menecerin ballarını gördükdən sonra dəyişdi"],
  mgrHiddenUntil:["Manager scores are shown after you complete your own evaluation","Menecerin balları öz qiymətləndirmənizi tamamladıqdan sonra göstərilir"],
  hrHiddenUntil:["HR scores are shown after final approval","HR balları yekun təsdiqdən sonra göstərilir"],
  mgrJust:["Manager's justifications","Menecerin əsaslandırmaları"], hrJust:["HR justifications","HR əsaslandırmaları"],
  nameHidden:["The employee's name is hidden — the job is evaluated, not the person","İşçinin adı gizlədilib — şəxs deyil, vəzifə qiymətləndirilir"],
  consistency:["Similar positions","Oxşar vəzifələr"], noSimilar:["No graded positions with the same title yet","Eyni adlı qiymətləndirilmiş vəzifə hələ yoxdur"],
  outlierWarn:["This grade differs by 2+ grades from the same title elsewhere","Bu dərəcə digər eyni adlı vəzifələrdən 2+ dərəcə fərqlənir"],
  history:["History","Tarixçə"], h_created:["Created","Yaradıldı"], h_saved:["Saved","Yadda saxlanıldı"], h_submitted:["Manager scored and sent to HR","Menecer balladı və HR-a göndərdi"],
  h_returned_to_manager:["Returned to manager","Menecerə qaytarıldı"], h_hr_saved:["HR saved scores","HR balları yadda saxladı"], h_sent_to_director:["Sent to HR Director","HR direktoruna göndərildi"],
  h_approved:["Approved","Təsdiqləndi"], h_returned_to_hr:["Returned to HR","HR-a qaytarıldı"], h_edited:["Profile edited","Profil redaktə edildi"],
  dec_approved:["Approved","Təsdiqləndi"], dec_returned:["Returned to HR","HR-a qaytarıldı"], dec_pending:["Pending","Gözləyir"],
  confirmMgrApprove:["Approve grade {g} for this position?","Bu vəzifə üçün {g} dərəcəsi təsdiqlənsin?"],
  evalStats:["Evaluator statistics","Qiymətləndirici statistikası"],
  evalStatsDesc:["Spot evaluators who score consistently higher or lower than the profile or their counterpart.","Profilə və ya qarşı tərəfə nisbətən davamlı yüksək və ya aşağı bal verənləri görün."],
  stEvaluator:["Evaluator","Qiymətləndirici"], stType:["Type","Növ"], stCount:["Positions","Vəzifə"], stAvg:["Avg total","Orta cəm"],
  stDev:["Avg vs profile","Profilə nisbətən orta"], stGap:["Avg vs other side","Qarşı tərəfə nisbətən orta"], stFlag:["Calibration flags","Kalibrasiya xəbərdarlığı"],
  notifyEmail:["Outlook e-mail (notifications)","Outlook e-poçtu (bildirişlər)"], mailTitle:["E-mail notifications (Outlook)","E-poçt bildirişləri (Outlook)"],
  mailDesc:["Each workflow step queues an e-mail to the next person's Outlook address. The Firebase “Trigger Email” extension sends them through Microsoft 365.","Hər addımda növbəti şəxsin Outlook ünvanına e-poçt növbəyə qoyulur. Firebase “Trigger Email” genişlənməsi onları Microsoft 365 vasitəsilə göndərir."],
  mailInstall:["Install / update e-mail templates","E-poçt şablonlarını quraşdır / yenilə"], tTemplates:["E-mail templates saved","E-poçt şablonları yadda saxlanıldı"],
  mailQueued:["{n} e-mail(s) queued","{n} e-poçt növbəyə qoyuldu"], mailNone:["No e-mails yet","Hələ e-poçt yoxdur"],
  mailTo:["To","Kimə"], mailTpl:["Template","Şablon"], mailState:["State","Vəziyyət"], mailDate:["Date","Tarix"],
  mailPending:["Queued — the e-mail extension is not active yet","Növbədə — e-poçt genişlənməsi hələ aktiv deyil"],
  jdTemplate:["Job description template","Vəzifə təlimatı şablonu"], jdTemplates:["Job description templates","Vəzifə təlimatı şablonları"],
  jdOpen:["Job description","Təlimat"], jdCustom:["Custom template","Xüsusi şablon"], jdDefault:["Default (from level)","Standart (səviyyəyə görə)"],
  jdIntro:["This template pre-fills purpose, responsibilities, KPIs and requirements when this title is chosen for a new position. Edit it to match how the job is done in your hotel.","Bu şablon yeni vəzifə üçün bu ad seçiləndə məqsədi, öhdəlikləri, KPI-ları və tələbləri avtomatik doldurur. Onu otelinizdəki işə uyğun redaktə edin."],
  jdSave:["Save template","Şablonu yadda saxla"], jdReset:["Reset to default","Standarta qaytar"], tJdSaved:["Template saved","Şablon yadda saxlanıldı"], tJdReset:["Template reset to default","Şablon standarta qaytarıldı"],
  jdApply:["Apply job description template","Vəzifə təlimatı şablonunu tətbiq et"],
  jdApplyConfirm:["Replace purpose, responsibilities, KPIs and requirements with the template?","Məqsəd, öhdəliklər, KPI-lar və tələblər şablonla əvəz olunsun?"], tJdApplied:["Template applied — review and save","Şablon tətbiq olundu — yoxlayıb yadda saxlayın"],
  jdHas:["Template: custom","Şablon: xüsusi"], jdReqs:["Requirements","Tələblər"], jdReadOnly:["Read-only — you can edit templates of your own department","Yalnız oxumaq üçün — öz departamentinizin şablonlarını redaktə edə bilərsiniz"],
  editAnyStatusInfo:["You can update the job description at any time. Scores and the grade are not changed.","Vəzifə təlimatını istənilən vaxt yeniləyə bilərsiniz. Ballar və dərəcə dəyişmir."],
  changedAfterApproval:["Job description changed after approval — consider re-evaluation","Vəzifə təlimatı təsdiqdən sonra dəyişdirilib — yenidən qiymətləndirməni nəzərdən keçirin"],
  watchTour:["▶ Watch the 5-minute video tour (English)","▶ 5 dəqiqəlik video-tura bax (ingiliscə)"], videoShort:["▶ Video tour","▶ Video-tur"],
  stdTitle:["Fixed job standard","Vəzifənin sabit standartı"], stdInfo:["Defined by HR for this job title. It is the same for every position with this title and cannot be changed here. You can add position-specific KPI targets below each item.","HR tərəfindən bu vəzifə adı üçün müəyyən edilib. Bu adlı bütün vəzifələrdə eynidir və burada dəyişdirilə bilməz. Hər bəndin altına vəzifəyə xas KPI hədəfi əlavə edə bilərsiniz."],
  stdUpdate:["Update to standard v{v}","Standart v{v}-ə yenilə"], stdUpdated:["A newer job standard exists","Vəzifə standartının yeni versiyası var"], tStdUpdated:["Job standard updated — review and save","Vəzifə standartı yeniləndi — yoxlayıb yadda saxlayın"],
  kpiExtra:["Position-specific KPI target","Vəzifəyə xas KPI hədəfi"], kpiExtraHint:["Optional — adds to the fixed KPI, does not replace it","İstəyə bağlı — sabit KPI-ı əvəz etmir, ona əlavə olunur"],
  customResp:["Position-specific responsibilities","Vəzifəyə xas əlavə öhdəliklər"], stdCol:["Fixed standard","Sabit standart"], fixedItem:["Fixed standard (same for every position with this title)","Sabit standart (bu adlı bütün vəzifələrdə eyni)"],
  jdFixedHint:["Mark the items that form the fixed standard. Positions get them locked; managers can only add their own KPI targets and extra responsibilities.","Sabit standartı təşkil edən bəndləri işarələyin. Vəzifələrdə onlar kilidli olur; menecerlər yalnız öz KPI hədəflərini və əlavə öhdəlikləri əlavə edə bilər."],
  jdReadOnlyHR:["Read-only — the job standard is maintained by HR","Yalnız oxumaq üçün — vəzifə standartını HR idarə edir"],
  qualTitle:["Employee qualifications","İşçinin ixtisası (fərdi profil)"], qualSub:["The person's actual education and experience — compared with the job requirements","İşçinin faktiki təhsili və təcrübəsi — vəzifə tələbləri ilə müqayisə olunur"],
  tNeedQual:["Fill in the employee's education and years of experience","İşçinin təhsilini və iş təcrübəsini (il) doldurun"],
  fitTitle:["Individual fit & grade","Fərdi uyğunluq və dərəcə"], fit_below:["Below requirements","Tələbdən aşağı"], fit_meets:["Meets requirements","Tələbə uyğun"], fit_exceeds:["Above requirements","Tələbdən yuxarı"], fit_unknown:["Not enough data","Məlumat kifayət deyil"],
  jobGrade:["Job grade","Vəzifə dərəcəsi"], personalGrade:["Individual grade","Fərdi dərəcə"], required:["Required","Tələb olunan"], actual:["Actual","Faktiki"],
  fitRule:["Rule: below requirements → one grade lower (development stage) until requirements are met · meets → job grade · above requirements → job grade, upper step (+). The job grade itself never changes.","Qayda: tələbdən aşağı → tələblər ödənənədək bir dərəcə aşağı (inkişaf mərhələsi) · tələbə uyğun → vəzifə dərəcəsi · tələbdən yuxarı → vəzifə dərəcəsi, yuxarı pillə (+). Vəzifə dərəcəsinin özü dəyişmir."],
  fitEduLow:["Education below the requirement","Təhsil tələbdən aşağıdır"], fitExpLow:["Experience below the requirement","Təcrübə tələbdən azdır"], fitEduHigh:["Education above the requirement","Təhsil tələbdən yuxarıdır"], fitExpHigh:["5+ years more experience than required","Tələbdən 5+ il çox təcrübə"],
  pgOverride:["HR decision (override)","HR qərarı (dəyişiklik)"], pgAuto:["Automatic (by rule)","Avtomatik (qaydaya görə)"], pgReason:["Reason","Səbəb"], pgSave:["Save individual grade","Fərdi dərəcəni yadda saxla"],
  tPgSaved:["Individual grade saved","Fərdi dərəcə yadda saxlanıldı"], tNeedReason:["A reason is required for an override","Dəyişiklik üçün səbəb mütləqdir"], h_personal_grade:["Individual grade set","Fərdi dərəcə təyin edildi"],
  noJobGrade:["The individual grade is calculated after the job grade is approved","Fərdi dərəcə vəzifə dərəcəsi təsdiqləndikdən sonra hesablanır"],
  preview:["Preview","Önizləmə"], previewBtn:["👁 Preview","👁 Önizlə"], download:["Download .xlsx","Excel-i yüklə"],
  colSection:["Section","Bölmə"], colField:["Field","Sahə"], colValue:["Value","Dəyər"], general:["General","Ümumi"], no_:["No.","№"]
};
const I18N = { az:{}, en:{} };
for (const [k, [en, az]] of Object.entries(STR)) { I18N.en[k] = en; I18N.az[k] = az; }

/* =====================================================================
   6) Sample data — 5 employee records (spec 5F)
   ===================================================================== */
const SAMPLE_DATA = [
 { employeeCode:"EMP-001", fullName:"Aysel Məmmədova", hireDate:"2023-04-10", departmentId:"FO", status:"approved", returnComment:"",
   position:{ jobTitle:"Front Desk Agent", department:"FO", division:"Rooms Division", currentGrade:"G3", jobLevel:"L6", positionId:"POS-FO-005", employmentType:"full_time",
     location:"Bakı, Azərbaycan", reportsTo:"Front Desk Supervisor", directReports:0, indirectReports:0, lastEvaluationDate:"2026-10-15" },
   purpose:{ primaryPurpose:"Welcomes guests, completes fast and accurate check-in and check-out, and solves guest requests at the front desk to brand standard.",
     mainObjectives:"Short queue times, accurate billing, high guest satisfaction scores.",
     departmentContribution:"First and last guest contact; drives Front Office service scores.",
     strategyContribution:"Supports guest loyalty, upselling and online review ratings." },
   responsibilities:[
     { task:"Guest check-in and check-out", description:"Register guests in the PMS, verify ID and payment, issue keys, settle bills.", frequency:"daily", level:"execute", outcomes:"Accurate folios, check-in under 5 minutes", kpis:"Check-in time, billing errors = 0", accountability:"medium" },
     { task:"Handle guest requests and complaints", description:"Respond to requests and resolve simple complaints; escalate complex cases.", frequency:"daily", level:"execute", outcomes:"Requests closed on the same shift", kpis:"Guest satisfaction score, complaints resolved", accountability:"medium" },
     { task:"Upsell rooms and services", description:"Offer room upgrades, breakfast and late check-out at check-in.", frequency:"daily", level:"support", outcomes:"Extra room revenue", kpis:"Upsell revenue per month", accountability:"low" } ],
   knowledge:{ minEducation:"secondary", preferredEducation:"Hospitality or tourism diploma", experienceYears:1, industryExperience:"Hotel front office or guest service",
     technicalKnowledge:"Check-in and check-out procedures, cash handling, guest privacy rules", technicalSkills:"Fast, accurate data entry; calm complaint handling",
     softwareSystems:"Opera PMS, MS Office", languages:"Azerbaijani, English (good), Russian (good)", certifications:"—", leadershipSkills:"—" },
   decisions:{ independentDecisions:"Room assignment within category, small goodwill gestures up to 30 AZN", approvalDecisions:"Rate overrides, refunds, upgrades above category",
     authorityLevel:"low", budgetaryAuthority:"None", expenditureApproval:"Up to 30 AZN goodwill", operationalChanges:"low", supervisionReceived:"close", guidanceFrequency:"daily" },
   scope:{ employeesSupported:0, departmentsSupported:"Housekeeping, Reservations, F&B", operationalImpact:"medium", financialImpact:"low", guestSatisfactionImpact:"high",
     employeeExperienceImpact:"low", businessPerformanceImpact:"medium", assetsResponsibility:"low", externalInteraction:"Hotel guests, travel agents, taxi companies",
     internalInteraction:"Housekeeping, Reservations, Engineering, Security" },
   problemSolving:{ problemNature:"Room not ready, billing questions, guest complaints", problemFrequency:"daily", complexity:"low", analyticalThinking:"low", independentResolution:"medium",
     strategicPlanning:"low", innovation:"low", errorImpact:"medium" },
   communication:{ internalStakeholders:"Front Desk Supervisor, Housekeeping, Reservations", externalStakeholders:"Guests, travel agents", communicationPurpose:"Inform and serve guests; coordinate room status",
     communicationLevel:"coordinate", interactionFrequency:"daily", confidentiality:"medium", representation:true },
   people:{ recruitment:false, performanceManagement:false, trainingDevelopment:false, coaching:false, disciplinary:false, workforcePlanning:false, teamAccountability:false },
   environment:{ workingSchedule:"3 shifts, 8 hours, 5 days a week", shiftWork:true, physicalRequirements:"medium", mentalDemands:"medium", healthSafetyRisks:"low",
     challengingConditions:"low", weekendsHolidays:true, travel:"none" },
   financial:{ budgetResponsibility:false, budgetSize:0, financialApprovalLimit:30, revenueGeneration:true, costControl:false, equipmentAssets:true, inventoryStock:false },
   evaluation:{ scores:{ knowledge:2, experience:2, problemSolving:2, decisionMaking:1, accountability:2, businessImpact:2, leadership:1, communication:3, workingConditions:3 },
     totalScore:18, recommendedGrade:"G3", finalGrade:"G3", comments:"Grade matches entry-level guest-facing role with high guest contact.",
     approvalStatus:"approved", evaluationDate:"2026-10-15", evaluatorName:"Leyla Həsənova" } },

 { employeeCode:"EMP-002", fullName:"Elvin Quliyev", hireDate:"2021-09-01", departmentId:"HK", status:"submitted", returnComment:"",
   position:{ jobTitle:"Housekeeping Supervisor", department:"HK", division:"Rooms Division", currentGrade:"G4", jobLevel:"L4", positionId:"POS-HK-004", employmentType:"full_time",
     location:"Bakı, Azərbaycan", reportsTo:"Housekeeping Manager", directReports:8, indirectReports:0, lastEvaluationDate:"" },
   purpose:{ primaryPurpose:"Supervises room attendants on the floor so that rooms are cleaned, inspected and released on time to brand standard.",
     mainObjectives:"Rooms ready on time, consistent cleanliness scores, a trained and motivated floor team.",
     departmentContribution:"Delivers daily room readiness and inspection quality for the Housekeeping department.",
     strategyContribution:"Supports guest satisfaction and online cleanliness ratings." },
   responsibilities:[
     { task:"Inspect cleaned rooms and release them to Front Office", description:"Check every cleaned room against the inspection checklist and update room status in the PMS.", frequency:"daily", level:"supervise", outcomes:"Clean, inspected rooms released on time", kpis:"Rooms inspected per shift, defects < 2%", accountability:"high" },
     { task:"Assign room sections and brief the shift team", description:"Plan room allocation by occupancy and VIP list; run the morning briefing.", frequency:"daily", level:"supervise", outcomes:"Balanced workload, VIP rooms prioritised", kpis:"Rooms ready by 14:00", accountability:"medium" },
     { task:"Train new room attendants and check linen and amenity stock", description:"On-the-job training for new staff; weekly floor-pantry stock checks.", frequency:"weekly", level:"supervise", outcomes:"Trained attendants, no stock-outs", kpis:"Training hours, stock variance", accountability:"medium" } ],
   knowledge:{ minEducation:"vocational", preferredEducation:"Hospitality vocational certificate", experienceYears:3, industryExperience:"Hotel housekeeping, at least 1 year as team leader",
     technicalKnowledge:"Room cleaning standards, chemical safety, lost and found procedures", technicalSkills:"Room inspection, team scheduling, stock control",
     softwareSystems:"Opera PMS (HK module)", languages:"Azerbaijani, basic English", certifications:"—", leadershipSkills:"Shift supervision, on-the-job coaching" },
   decisions:{ independentDecisions:"Room section allocation, re-cleaning of rooms, shift task changes", approvalDecisions:"Overtime, staff disciplinary actions, extra stock orders",
     authorityLevel:"medium", budgetaryAuthority:"None", expenditureApproval:"None", operationalChanges:"medium", supervisionReceived:"general", guidanceFrequency:"daily" },
   scope:{ employeesSupported:8, departmentsSupported:"Front Office, Engineering, Laundry", operationalImpact:"high", financialImpact:"low", guestSatisfactionImpact:"high",
     employeeExperienceImpact:"medium", businessPerformanceImpact:"medium", assetsResponsibility:"medium", externalInteraction:"Occasional guest contact on floors",
     internalInteraction:"Front Office, Engineering, Laundry, Minibar" },
   problemSolving:{ problemNature:"Late check-outs, room defects, staff absence", problemFrequency:"daily", complexity:"medium", analyticalThinking:"low", independentResolution:"medium",
     strategicPlanning:"low", innovation:"low", errorImpact:"medium" },
   communication:{ internalStakeholders:"Housekeeping Manager, Front Office, Engineering", externalStakeholders:"Guests", communicationPurpose:"Coordinate room status and repairs; brief the team",
     communicationLevel:"coordinate", interactionFrequency:"daily", confidentiality:"low", representation:false },
   people:{ recruitment:false, performanceManagement:true, trainingDevelopment:true, coaching:true, disciplinary:false, workforcePlanning:false, teamAccountability:false },
   environment:{ workingSchedule:"Morning and evening shifts, 8 hours, 5 days a week", shiftWork:true, physicalRequirements:"high", mentalDemands:"medium", healthSafetyRisks:"medium",
     challengingConditions:"medium", weekendsHolidays:true, travel:"none" },
   financial:{ budgetResponsibility:false, budgetSize:0, financialApprovalLimit:0, revenueGeneration:false, costControl:true, equipmentAssets:true, inventoryStock:true },
   evaluation:null },

 { employeeCode:"EMP-003", fullName:"Nigar Hüseynova", hireDate:"2022-02-14", departmentId:"REV", status:"under_evaluation", returnComment:"",
   position:{ jobTitle:"Revenue Manager", department:"REV", division:"Commercial", currentGrade:"G6", jobLevel:"L3", positionId:"POS-REV-002", employmentType:"full_time",
     location:"Bakı, Azərbaycan", reportsTo:"Director of Revenue Management", directReports:1, indirectReports:0, lastEvaluationDate:"" },
   purpose:{ primaryPurpose:"Sets daily room rates and controls inventory across all channels to maximise room revenue, RevPAR and market share.",
     mainObjectives:"Grow RevPAR index, accurate forecasts, optimal channel mix.",
     departmentContribution:"Owns pricing and forecasting for the Revenue department.",
     strategyContribution:"Drives top-line room revenue and supports the hotel's commercial strategy." },
   responsibilities:[
     { task:"Analyse demand, pick-up and competitor rates; update prices", description:"Daily review of pick-up, compset rates and events; adjust BAR and restrictions in the RMS.", frequency:"daily", level:"manage", outcomes:"Optimal daily rates", kpis:"RevPAR index", accountability:"high" },
     { task:"Prepare weekly forecast and monthly revenue report", description:"Build 90-day forecast and monthly performance report for the leadership team.", frequency:"weekly", level:"manage", outcomes:"Reliable forecast for staffing and budgeting", kpis:"Forecast accuracy ±5%", accountability:"high" },
     { task:"Manage OTA and channel-manager rates and restrictions", description:"Keep rates and availability in sync across OTAs, GDS and brand website.", frequency:"daily", level:"manage", outcomes:"Rate parity, lower distribution cost", kpis:"Channel parity, cost of sale", accountability:"medium" } ],
   knowledge:{ minEducation:"bachelor", preferredEducation:"Finance, Economics or Hospitality", experienceYears:4, industryExperience:"Hotel revenue management or reservations",
     technicalKnowledge:"Pricing strategy, forecasting, distribution channels, market segmentation", technicalSkills:"Data analysis, advanced Excel, presentation of results",
     softwareSystems:"IDeaS or Duetto RMS, Opera, Excel (advanced)", languages:"Azerbaijani, English (fluent), Russian (good)", certifications:"Revenue management certificate (preferred)", leadershipSkills:"Leads one analyst; influences commercial team" },
   decisions:{ independentDecisions:"Daily rate changes within agreed strategy, stay restrictions, channel availability", approvalDecisions:"Strategy changes, group rate exceptions, new channels",
     authorityLevel:"high", budgetaryAuthority:"None", expenditureApproval:"None", operationalChanges:"medium", supervisionReceived:"general", guidanceFrequency:"weekly" },
   scope:{ employeesSupported:1, departmentsSupported:"Sales, Reservations, Front Office, Finance", operationalImpact:"medium", financialImpact:"high", guestSatisfactionImpact:"medium",
     employeeExperienceImpact:"low", businessPerformanceImpact:"high", assetsResponsibility:"low", externalInteraction:"OTA market managers, channel-manager vendors",
     internalInteraction:"Sales, Reservations, Front Office, Finance, General Manager" },
   problemSolving:{ problemNature:"Demand shifts, rate disparity, forecast gaps", problemFrequency:"daily", complexity:"high", analyticalThinking:"high", independentResolution:"high",
     strategicPlanning:"medium", innovation:"medium", errorImpact:"high" },
   communication:{ internalStakeholders:"Director of Revenue Management, Sales, Reservations, Finance", externalStakeholders:"OTAs, channel partners", communicationPurpose:"Agree pricing strategy; report results",
     communicationLevel:"negotiate", interactionFrequency:"daily", confidentiality:"high", representation:true },
   people:{ recruitment:false, performanceManagement:true, trainingDevelopment:true, coaching:true, disciplinary:false, workforcePlanning:false, teamAccountability:true },
   environment:{ workingSchedule:"Office hours, 5 days a week", shiftWork:false, physicalRequirements:"low", mentalDemands:"high", healthSafetyRisks:"low",
     challengingConditions:"low", weekendsHolidays:false, travel:"occasional" },
   financial:{ budgetResponsibility:false, budgetSize:0, financialApprovalLimit:0, revenueGeneration:true, costControl:false, equipmentAssets:false, inventoryStock:false },
   evaluation:{ scores:{ knowledge:4, experience:4, problemSolving:4, decisionMaking:3, accountability:4, businessImpact:4, leadership:3, communication:4, workingConditions:2 },
     totalScore:32, recommendedGrade:"G6", finalGrade:"", comments:"", approvalStatus:"under_evaluation", evaluationDate:"2026-11-05", evaluatorName:"Leyla Həsənova" } },

 { employeeCode:"EMP-004", fullName:"Rəşad Əliyev", hireDate:"2019-06-03", departmentId:"KIT", status:"approved", returnComment:"",
   position:{ jobTitle:"Executive Chef", department:"KIT", division:"Food & Beverage", currentGrade:"G8", jobLevel:"L2", positionId:"POS-KIT-001", employmentType:"full_time",
     location:"Bakı, Azərbaycan", reportsTo:"Director of Food & Beverage", directReports:4, indirectReports:38, lastEvaluationDate:"2026-09-30" },
   purpose:{ primaryPurpose:"Leads all hotel kitchens, creates menus and delivers safe, high-quality food within food-cost targets.",
     mainObjectives:"Food cost within target, top food-quality scores, full HACCP compliance.",
     departmentContribution:"Owns culinary quality, kitchen budget and brigade development.",
     strategyContribution:"Builds the hotel's F&B reputation and drives restaurant and banquet revenue." },
   responsibilities:[
     { task:"Design and cost menus for all outlets and banquets", description:"Create seasonal menus, recipe cards and costings with outlet managers.", frequency:"monthly", level:"lead", outcomes:"Profitable, attractive menus", kpis:"Food cost % ≤ 28%", accountability:"high" },
     { task:"Lead, hire and develop the culinary brigade", description:"Recruit chefs, set training plans and run performance reviews.", frequency:"weekly", level:"lead", outcomes:"Skilled, stable brigade", kpis:"Staff turnover, training plan done", accountability:"high" },
     { task:"Ensure food safety and hygiene (HACCP) in all kitchens", description:"Daily checks, temperature logs, supplier audits and corrective actions.", frequency:"daily", level:"manage", outcomes:"Safe food, audit-ready kitchens", kpis:"Audit score ≥ 90%", accountability:"high" } ],
   knowledge:{ minEducation:"vocational", preferredEducation:"Culinary arts diploma", experienceYears:10, industryExperience:"5-star hotel kitchens, at least 3 years as Executive Sous Chef or above",
     technicalKnowledge:"International and Azerbaijani cuisine, menu engineering, HACCP", technicalSkills:"Menu costing, kitchen planning, food presentation",
     softwareSystems:"Recipe costing software, MS Office", languages:"Azerbaijani, English", certifications:"HACCP certificate", leadershipSkills:"Leads a brigade of 40+, develops chefs" },
   decisions:{ independentDecisions:"Menus, recipes, kitchen staffing and suppliers within budget", approvalDecisions:"Capital equipment, budget changes, senior hires",
     authorityLevel:"high", budgetaryAuthority:"Kitchen operating budget", expenditureApproval:"Up to 5,000 AZN", operationalChanges:"high", supervisionReceived:"minimal", guidanceFrequency:"weekly" },
   scope:{ employeesSupported:42, departmentsSupported:"F&B Service, Events, Purchasing, Stewarding", operationalImpact:"high", financialImpact:"high", guestSatisfactionImpact:"high",
     employeeExperienceImpact:"high", businessPerformanceImpact:"high", assetsResponsibility:"high", externalInteraction:"Suppliers, food-safety inspectors, VIP guests",
     internalInteraction:"F&B, Events, Purchasing, Finance, Engineering" },
   problemSolving:{ problemNature:"Cost pressure, supply issues, staffing peaks, food-safety risks", problemFrequency:"daily", complexity:"high", analyticalThinking:"medium", independentResolution:"high",
     strategicPlanning:"high", innovation:"high", errorImpact:"high" },
   communication:{ internalStakeholders:"Director of F&B, outlet managers, Events, Purchasing", externalStakeholders:"Suppliers, inspectors, guests", communicationPurpose:"Agree menus and costs; lead the brigade",
     communicationLevel:"influence", interactionFrequency:"daily", confidentiality:"medium", representation:true },
   people:{ recruitment:true, performanceManagement:true, trainingDevelopment:true, coaching:true, disciplinary:true, workforcePlanning:true, teamAccountability:true },
   environment:{ workingSchedule:"Split shifts, 6 days a week during peaks", shiftWork:true, physicalRequirements:"high", mentalDemands:"high", healthSafetyRisks:"high",
     challengingConditions:"high", weekendsHolidays:true, travel:"occasional" },
   financial:{ budgetResponsibility:true, budgetSize:1800000, financialApprovalLimit:5000, revenueGeneration:true, costControl:true, equipmentAssets:true, inventoryStock:true },
   evaluation:{ scores:{ knowledge:4, experience:5, problemSolving:4, decisionMaking:4, accountability:4, businessImpact:5, leadership:5, communication:4, workingConditions:4 },
     totalScore:39, recommendedGrade:"G8", finalGrade:"G8", comments:"Department-head role with large brigade and full food-cost accountability.",
     approvalStatus:"approved", evaluationDate:"2026-09-30", evaluatorName:"Leyla Həsənova" } },

 { employeeCode:"EMP-005", fullName:"Leyla Həsənova", hireDate:"2018-01-15", departmentId:"HR", status:"approved", returnComment:"",
   position:{ jobTitle:"Human Resources Director", department:"HR", division:"Administration", currentGrade:"G9", jobLevel:"L1", positionId:"POS-HR-001", employmentType:"full_time",
     location:"Bakı, Azərbaycan", reportsTo:"General Manager", directReports:3, indirectReports:6, lastEvaluationDate:"2026-09-20" },
   purpose:{ primaryPurpose:"Leads the people strategy of the hotel — talent, culture, pay and labour-law compliance — to support service quality and business results.",
     mainObjectives:"Engaged, well-trained teams; fair and consistent pay; zero compliance issues.",
     departmentContribution:"Sets HR policies, grading and talent processes for all departments.",
     strategyContribution:"Member of the executive committee; aligns people plans with hotel strategy." },
   responsibilities:[
     { task:"Set annual HR strategy, headcount plan and HR budget", description:"Agree people priorities and headcount with the General Manager and department heads.", frequency:"monthly", level:"lead", outcomes:"Approved HR plan and budget", kpis:"Plan approved, budget variance", accountability:"high" },
     { task:"Lead job grading, pay structure and performance reviews", description:"Own the job evaluation process and the annual performance and pay review cycle.", frequency:"monthly", level:"lead", outcomes:"Fair, defensible grades and pay", kpis:"100% roles graded", accountability:"high" },
     { task:"Ensure compliance with the Labour Code of Azerbaijan and handle key employee relations cases", description:"Review contracts and policies; advise managers; manage sensitive cases.", frequency:"weekly", level:"lead", outcomes:"Compliant HR practice", kpis:"Zero labour fines", accountability:"high" } ],
   knowledge:{ minEducation:"master", preferredEducation:"HR Management or Business Administration", experienceYears:10, industryExperience:"HR leadership in hotels or service industry",
     technicalKnowledge:"Labour Code of Azerbaijan, job evaluation, compensation, talent management", technicalSkills:"Policy design, negotiation, HR analytics",
     softwareSystems:"HRIS, MS Office", languages:"Azerbaijani, English, Russian", certifications:"CIPD or SHRM (preferred)", leadershipSkills:"Leads the HR team; coaches the leadership team" },
   decisions:{ independentDecisions:"HR policies, recruitment decisions below department head, training plans", approvalDecisions:"Pay structure changes, senior hires, HR budget increases",
     authorityLevel:"high", budgetaryAuthority:"HR and training budget", expenditureApproval:"Up to 10,000 AZN", operationalChanges:"high", supervisionReceived:"minimal", guidanceFrequency:"monthly" },
   scope:{ employeesSupported:350, departmentsSupported:"All departments", operationalImpact:"high", financialImpact:"high", guestSatisfactionImpact:"medium",
     employeeExperienceImpact:"high", businessPerformanceImpact:"high", assetsResponsibility:"medium", externalInteraction:"Labour inspectorate, universities, recruitment agencies, lawyers",
     internalInteraction:"Executive committee, all department heads, employees" },
   problemSolving:{ problemNature:"Talent shortages, pay disputes, legal and employee-relations cases", problemFrequency:"weekly", complexity:"high", analyticalThinking:"high", independentResolution:"high",
     strategicPlanning:"high", innovation:"high", errorImpact:"high" },
   communication:{ internalStakeholders:"General Manager, executive committee, department heads", externalStakeholders:"Authorities, universities, agencies", communicationPurpose:"Advise, negotiate and influence people decisions",
     communicationLevel:"influence", interactionFrequency:"daily", confidentiality:"high", representation:true },
   people:{ recruitment:true, performanceManagement:true, trainingDevelopment:true, coaching:true, disciplinary:true, workforcePlanning:true, teamAccountability:true },
   environment:{ workingSchedule:"Office hours, 5 days a week", shiftWork:false, physicalRequirements:"low", mentalDemands:"high", healthSafetyRisks:"low",
     challengingConditions:"low", weekendsHolidays:false, travel:"occasional" },
   financial:{ budgetResponsibility:true, budgetSize:250000, financialApprovalLimit:10000, revenueGeneration:false, costControl:true, equipmentAssets:false, inventoryStock:false },
   evaluation:{ scores:{ knowledge:5, experience:5, problemSolving:5, decisionMaking:5, accountability:5, businessImpact:4, leadership:5, communication:5, workingConditions:2 },
     totalScore:41, recommendedGrade:"G9", finalGrade:"G9", comments:"Executive role leading people strategy for the whole hotel.",
     approvalStatus:"approved", evaluationDate:"2026-09-20", evaluatorName:"General Manager" } }
];

const DEMO_USERS = [
  ["demo-admin", "Demo Admin", "admin", null],
  ["demo-hrd", "Leyla Həsənova (HR direktoru)", "hr_director", null],
  ["demo-hr", "Aynur Rzayeva (HR)", "hr", null],
  ["demo-fo", "Front Office meneceri", "manager", "FO"],
  ["demo-hk", "Housekeeping meneceri", "manager", "HK"],
  ["demo-rev", "Revenue meneceri", "manager", "REV"],
  ["demo-kit", "Mətbəx meneceri", "manager", "KIT"],
  ["demo-hrm", "HR departament meneceri", "manager", "HR"]
];
function demoSeed() {
  const now = Date.now(), db = { users:{}, employees:{} };
  DEMO_USERS.forEach(([uid, name, role, dep], i) => {
    const email = uid === "demo-hrd" ? "leyla.hasanova@hotel-demo.az" : `${uid.replace("demo-", "")}@hotel-demo.az`;
    db.users[uid] = { uid, email, notifyEmail:email, displayName:name, photoURL:"", role, departmentId:dep, lang:S.lang, theme:S.theme,
      createdAt:new DTS(now - 86400000 * 30), lastLogin:new DTS(now - 3600000 * (i + 1)) };
  });
  const fdaFixed = [
    { task:"Guest check-in and check-out to brand standard", description:"Register guests in the PMS, verify ID and payment, issue keys, settle bills.", frequency:"daily", level:"execute", outcomes:"Accurate folios, fast check-in", kpis:"Check-in under 5 minutes; billing errors = 0", accountability:"medium" },
    { task:"Handle guest requests and complaints", description:"Resolve simple cases on the spot; escalate complex ones to the supervisor.", frequency:"daily", level:"execute", outcomes:"Requests closed on the same shift", kpis:"Guest satisfaction ≥ 90%", accountability:"medium" }];
  db.jobTemplates = { "FO__front-desk-agent":{ dept:"FO", title:"Front Desk Agent", version:1,
    primaryPurpose:"Welcomes guests, completes fast and accurate check-in and check-out, and solves guest requests at the front desk to brand standard.",
    mainObjectives:"Short queue times, accurate billing, high guest satisfaction.",
    responsibilities:[...fdaFixed.map(r => ({ ...r, fixed:true })), { task:"Upsell rooms and services", description:"Offer upgrades, breakfast and late check-out.", frequency:"daily", level:"support", outcomes:"Extra room revenue", kpis:"Upsell revenue per month", accountability:"low", fixed:false }],
    fixedItems:fdaFixed, knowledge:{ minEducation:"vocational", experienceYears:1, languages:"Azerbaijani, English", softwareSystems:"Opera PMS" }, updatedByName:"Leyla Həsənova" } };
  db.directory = Object.fromEntries(Object.values(db.users).map(u => [u.uid, { uid:u.uid, displayName:u.displayName, email:u.email, notifyEmail:u.notifyEmail, role:u.role, departmentId:u.departmentId }]));
  db.mail = {};
  sampleRecords().forEach((e, i) => {
    // Demo shows the full flow: EMP-003 was scored by both sides (with a calibration flag) and waits for the HR Director
    if (e.employeeCode === "EMP-003") {
      e.status = "director_approval"; e.evaluation.finalGrade = "G6"; e.evaluation.approvalStatus = "director_approval";
      e.evaluation.evaluatorUid = "demo-hr"; e.evaluation.evaluatorName = "Aynur Rzayeva (HR)"; e.evaluation.blindScores = { ...e.evaluation.scores }; e.evaluation.changedAfterReveal = [];
      e.managerEvaluation.evaluatorUid = "demo-rev"; e.managerEvaluation.evaluatorName = "Revenue meneceri";
      e.history.push({ at:"2026-11-03T10:00:00.000Z", byName:"Revenue meneceri", role:"manager", action:"submitted", note:"35/45" },
                     { at:"2026-11-10T15:30:00.000Z", byName:"Aynur Rzayeva (HR)", role:"hr", action:"sent_to_director", note:"32/45 · G6 · ⚠" });
    }
    if (e.employeeCode === "EMP-002") { e.managerEvaluation.evaluatorUid = "demo-hk"; e.managerEvaluation.evaluatorName = "Housekeeping meneceri";
      e.history.push({ at:"2026-11-08T11:00:00.000Z", byName:"Housekeeping meneceri", role:"manager", action:"submitted", note:"24/45" }); }
    db.employees["demo-" + e.employeeCode] = { ...e, createdBy:"demo-admin", updatedBy:"demo-admin", createdAt:new DTS(now - 86400000 * (10 - i)), updatedAt:new DTS(now - 3600000 * (10 - i)) };
  });
  return db;
}
function demoUser(uid) {
  const u = DEMO.db.users[uid] || DEMO.db.users["demo-admin"];
  return { uid:u.uid, email:u.email, displayName:u.displayName, photoURL:"" };
}
async function startDemo(resume = false) {
  if (!resume || !demoLoad()) { DEMO.db = demoSeed(); DEMO.uid = "demo-admin"; }
  DEMO.on = true; demoSave();
  S.user = demoUser(DEMO.uid); S.profile = dclone(DEMO.db.users[S.user.uid]); S.employees = null; S.users = null;
  await loadLibrary(); await loadJobTemplates();
  S.authReady = true;
}
async function switchDemoRole(uid) {
  DEMO.uid = uid; demoSave();
  S.user = demoUser(uid); S.profile = dclone(DEMO.db.users[uid]); S.employees = null; S.users = null; S.form = null; S.evalState = null; S.libEdit = null;
  toast(`${t("demoRole")}: ${S.profile.displayName}`, "ok");
  location.hash = "#/dashboard"; render();
}
function exitDemo() {
  DEMO.on = false; DEMO.db = null; try { sessionStorage.removeItem("gs.demo"); } catch {}
  S.user = auth.currentUser || null; S.profile = null; S.employees = null; S.users = null;
  applyLibrary(clone(DEFAULT_DEPARTMENTS));
  location.hash = "#/login"; if (S.user) ensureProfile(S.user).then(() => render()); else render();
}
const shareLink = () => `${location.origin}${location.pathname}#/demo`;
async function copyShareLink() {
  const url = shareLink();
  try { await navigator.clipboard.writeText(url); toast(t("tLinkCopied"), "ok"); }
  catch { window.prompt(t("shareDemo"), url); }
}

const M = (a) => Object.fromEntries(["knowledge","experience","problemSolving","decisionMaking","accountability","businessImpact","leadership","communication","workingConditions"].map((k, i) => [k, a[i]]));
const SAMPLE_EXTRA = {
  "EMP-001":{ managerEvaluation:{ scores:M([2,2,2,1,2,3,1,3,3]), totalScore:19, recommendedGrade:"G3", justifications:{}, comments:"Guest-facing entry role.", evaluatorName:"Front Office Manager", date:"2026-10-01" },
    finalApproval:{ decision:"approved", comment:"", byName:"Leyla Həsənova", date:"2026-10-15" } },
  "EMP-002":{ managerEvaluation:{ scores:M([2,3,2,2,3,3,3,2,4]), totalScore:24, recommendedGrade:"G4", justifications:{}, comments:"Supervises 8 room attendants per shift.", evaluatorName:"Housekeeping Manager", date:"2026-11-08" } },
  "EMP-003":{ managerEvaluation:{ scores:M([4,4,4,3,4,5,5,4,2]), totalScore:35, recommendedGrade:"G7",
      justifications:{ leadership:"Leads the commercial pricing meetings and guides the reservations team functionally." }, comments:"Key commercial role.", evaluatorName:"Director of Revenue Management", date:"2026-11-03" } },
  "EMP-004":{ managerEvaluation:{ scores:M([5,5,4,4,4,5,5,4,4]), totalScore:40, recommendedGrade:"G9",
      justifications:{ knowledge:"Vocational diploma, but 10+ years of expert culinary knowledge across international cuisines." }, comments:"", evaluatorName:"Director of Food & Beverage", date:"2026-09-20" },
    evaluationExtra:{ justifications:{ knowledge:"Formal education is vocational; expertise level justifies 4." } },
    finalApproval:{ decision:"approved", comment:"", byName:"Leyla Həsənova", date:"2026-09-30" } },
  "EMP-005":{ managerEvaluation:{ scores:M([5,5,5,5,5,4,5,5,2]), totalScore:41, recommendedGrade:"G9", justifications:{}, comments:"", evaluatorName:"General Manager", date:"2026-09-15" },
    employeeEmail:"leyla.hasanova@hotel-demo.az", finalApproval:{ decision:"approved", comment:"", byName:"General Manager", date:"2026-09-20" } }
};
const SAMPLE_QUAL = {
  "EMP-001":{ education:"bachelor", fieldOfStudy:"Tourism", experienceYears:3, hospitalityYears:3, certificationsHeld:"—", languagesSpoken:"Azerbaijani, English, Russian" },
  "EMP-002":{ education:"secondary", fieldOfStudy:"—", experienceYears:6, hospitalityYears:6, certificationsHeld:"—", languagesSpoken:"Azerbaijani, Russian" },
  "EMP-003":{ education:"master", fieldOfStudy:"Finance", experienceYears:5, hospitalityYears:4, certificationsHeld:"Revenue management certificate", languagesSpoken:"Azerbaijani, English, Russian" },
  "EMP-004":{ education:"vocational", fieldOfStudy:"Culinary arts", experienceYears:16, hospitalityYears:16, certificationsHeld:"HACCP", languagesSpoken:"Azerbaijani, English" },
  "EMP-005":{ education:"master", fieldOfStudy:"Human Resource Management", experienceYears:12, hospitalityYears:9, certificationsHeld:"CIPD Level 7", languagesSpoken:"Azerbaijani, English, Russian" }
};
function sampleRecords() {
  return SAMPLE_DATA.map(r => {
    const e = JSON.parse(JSON.stringify(r)), x = SAMPLE_EXTRA[e.employeeCode] || {};
    if (x.managerEvaluation) e.managerEvaluation = JSON.parse(JSON.stringify(x.managerEvaluation));
    if (SAMPLE_QUAL[e.employeeCode]) e.qualifications = { ...SAMPLE_QUAL[e.employeeCode], notes:"" };
    if (x.finalApproval) e.finalApproval = { ...x.finalApproval };
    if (x.employeeEmail) e.employeeEmail = x.employeeEmail;
    if (e.evaluation && x.evaluationExtra) Object.assign(e.evaluation, x.evaluationExtra);
    if (e.evaluation && e.managerEvaluation) { const c = calibration(e.managerEvaluation.scores, e.evaluation.scores); if (c) Object.assign(e.evaluation, { calibrationFlagged:c.flagged, maxGap:c.maxGap, totalGap:c.totalGap }); }
    if (e.employeeCode === "EMP-003") e.evaluation.calibrationNote = "Leadership: 1 direct report — 3 matches the profile. Business impact kept at 4 after discussion with the manager.";
    e.history = [{ at:"2026-09-01T09:00:00.000Z", byUid:"", byName:"Sample data", role:"admin", action:"created", note:"" }];
    return e;
  });
}

/* =====================================================================
   7) State & helpers
   ===================================================================== */
const store = { get(k, d) { try { const v = localStorage.getItem("gs." + k); return v == null ? d : v; } catch { return d; } },
                set(k, v) { try { localStorage.setItem("gs." + k, v); } catch {} } };
const S = {
  user:null, profile:null, authReady:false, loginError:"",
  lang: store.get("lang", "az") === "en" ? "en" : "az",
  theme: store.get("theme", "system"),
  employees:null,
  filters:{ q:"", dept:"", status:"", grade:"" },
  view: store.get("view", "cards"), sort:{ key:"updated", dir:-1 },
  form:null, open:new Set([1]), evalState:null, users:null,
  repA:{ dept:"", status:"", grade:"" }, repB:{ dept:"", status:"" },
  libQ:"", libDept:"", dirty:false
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const t = (k, vars) => { let s = I18N[S.lang][k] ?? I18N.en[k] ?? k; if (vars) for (const [a, b] of Object.entries(vars)) s = s.replace("{" + a + "}", b); return s; };
const L = o => Array.isArray(o) ? (S.lang === "en" ? o[0] : o[1]) : (S.lang === "en" ? o.en : o.az);
const fl = def => S.lang === "en" ? def[1] : def[2];  // field label
const getP = (o, p) => p.split(".").reduce((a, k) => a == null ? undefined : a[k], o);
const setP = (o, p, v) => { const ks = p.split("."); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null || typeof a[k] !== "object") a[k] = {}; a = a[k]; }); a[ks[ks.length - 1]] = v; };
const clone = o => JSON.parse(JSON.stringify(o ?? null));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const tsMs = v => v?.toMillis ? v.toMillis() : (v?.seconds ? v.seconds * 1000 : (typeof v === "string" ? Date.parse(v) || 0 : 0));
const fmtDate = v => { const ms = tsMs(v); if (!ms) return ""; const d = new Date(ms); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const deptName = c => DEPT[c] ? L(DEPT[c]) : (c || "");
const levelName = l => LEVELS[l] ? `${l} — ${L(LEVELS[l])}` : (l || "");
const statusLabel = s => STATUSES[s] ? L(STATUSES[s]) : (s || "");
const optLabel = (list, v) => OPTS[list]?.[v] ? L(OPTS[list][v]) : (v ?? "");
const role = () => S.profile?.role || "pending";
const isAdmin = () => role() === "admin";
const isHR = () => ["admin", "hr_director", "hr"].includes(role());
const isMgr = () => role() === "manager";
const myDept = () => S.profile?.departmentId || "";
const badge = s => `<span class="badge st-${esc(s)}">${esc(statusLabel(s))}</span>`;
const pill = g => g ? `<span class="pill">${esc(g)}</span>` : `<span class="pill empty">—</span>`;
const finalOf = e => e.evaluation?.finalGrade || "";
const icon = n => ({ total:"▤", submitted:"➤", under_evaluation:"✎", director_approval:"⏳", approved:"✓", plus:"+", list:"☰", cards:"▦", export:"⤓" }[n] || "•");

function toast(msg, type = "") {
  const el = document.createElement("div");
  el.className = "toast " + type; el.textContent = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => el.remove(), 3600);
}
function confirmDlg(title, text = "", okLabel) {
  return new Promise(res => {
    const d = $("#dlg");
    $("#dlgTitle").textContent = title; $("#dlgText").textContent = text; $("#dlgText").hidden = !text;
    $("#dlgCancel").textContent = t("cancel"); $("#dlgOk").textContent = okLabel || t("ok");
    d.returnValue = "";
    d.addEventListener("close", () => res(d.returnValue === "ok"), { once:true });
    if (typeof d.showModal === "function") d.showModal(); else res(window.confirm(title + "\n" + text));
  });
}
function errMsg(e) {
  console.error(e);
  if (e?.code === "permission-denied") return t("tPermission");
  return t("tError") + (e?.message ? ": " + e.message : "");
}

/* ---------- Language & theme ---------- */
function applyStatic() {
  document.documentElement.lang = S.lang;
  $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.title = `${t("appName")} · ${S.lang === "en" ? "Dərəcələndirmə Sistemi" : "Grading System"}`;
}
function setLang(l, persist = true) {
  if (l !== "az" && l !== "en") return;
  const changed = S.lang !== l;
  S.lang = l; store.set("lang", l); applyStatic();
  if (persist && S.user && S.profile) updateDoc(doc(db, "users", S.user.uid), { lang:l }).catch(e => console.warn(e));
  if (changed) render();
}
function effectiveTheme() { return S.theme === "light" || S.theme === "dark" ? S.theme : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); }
function applyTheme() {
  if (S.theme === "light" || S.theme === "dark") document.documentElement.setAttribute("data-theme", S.theme);
  else document.documentElement.removeAttribute("data-theme");
}
function toggleTheme() {
  S.theme = effectiveTheme() === "dark" ? "light" : "dark";
  store.set("theme", S.theme); applyTheme(); renderHeader();
  if (S.user && S.profile) updateDoc(doc(db, "users", S.user.uid), { theme:S.theme }).catch(e => console.warn(e));
}
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => { if (S.theme === "system") renderHeader(); });

/* =====================================================================
   8) Auth & data
   ===================================================================== */
async function ensureProfile(u) {
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const data = { uid:u.uid, email:u.email || "", displayName:u.displayName || "", photoURL:u.photoURL || "", role:"pending", departmentId:null,
      lang:S.lang, theme:S.theme, createdAt:serverTimestamp(), lastLogin:serverTimestamp() };
    await setDoc(ref, data);
    S.profile = { ...data };
  } else {
    S.profile = snap.data();
    updateDoc(ref, { lastLogin:serverTimestamp(), displayName:u.displayName || S.profile.displayName || "", photoURL:u.photoURL || S.profile.photoURL || "" }).catch(e => console.warn(e));
    if (S.profile.lang && S.profile.lang !== S.lang) { S.lang = S.profile.lang; store.set("lang", S.lang); applyStatic(); }
    if (S.profile.theme && S.profile.theme !== S.theme) { S.theme = S.profile.theme; store.set("theme", S.theme); applyTheme(); }
  }
}
async function signIn() {
  S.loginError = "";
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt:"select_account" });
  try { await signInWithPopup(auth, provider); }
  catch (e) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/web-storage-unsupported"].includes(e.code)) {
      try { await signInWithRedirect(auth, provider); return; } catch (e2) { e = e2; }
    }
    if (e.code === "auth/popup-closed-by-user" || e.code === "auth/cancelled-popup-request") return;
    S.loginError = `${t("tSignInFailed")}: ${e.code || e.message}`;
    render();
  }
}
async function doSignOut() { if (DEMO.on) { exitDemo(); return; } await signOut(auth); S.profile = null; S.employees = null; S.users = null; location.hash = "#/login"; }

// Fixed standard items (from the job template) + position-specific responsibilities
function allResps(e) {
  const std = (e.standard?.items || []).map((r, i) => ({ ...r, fixed:true, kpisExtra:e.kpiExtra?.[i] || "" }));
  return [...std, ...(e.responsibilities || [])];
}
const EDU_RANK = { secondary:1, vocational:2, bachelor:3, master:4, doctorate:5 };
// Individual fit: the person's qualifications vs the job requirements (section 4)
function personalFit(e) {
  const req = e.knowledge || {}, q = e.qualifications || {};
  const rEdu = EDU_RANK[req.minEducation], aEdu = EDU_RANK[q.education];
  const rExp = req.experienceYears === "" || req.experienceYears == null ? null : Number(req.experienceYears);
  const aExp = q.experienceYears === "" || q.experienceYears == null ? null : Number(q.experienceYears);
  const reasons = [];
  if (!aEdu || aExp == null || (!rEdu && rExp == null)) return { state:"unknown", reasons };
  const eduLow = rEdu && aEdu < rEdu, expLow = rExp != null && aExp < rExp;
  const eduHigh = rEdu && aEdu > rEdu, expHigh = rExp != null && aExp >= rExp + 5;
  if (eduLow) reasons.push("fitEduLow"); if (expLow) reasons.push("fitExpLow");
  if (eduLow || expLow) return { state:"below", reasons };
  if (eduHigh) reasons.push("fitEduHigh"); if (expHigh) reasons.push("fitExpHigh");
  return { state:eduHigh || expHigh ? "exceeds" : "meets", reasons };
}
const jobGradeOf = e => e.status === "approved" ? (e.evaluation?.finalGrade || e.position?.currentGrade || "") : "";
function suggestedPersonalGrade(e) {
  const g = jobGradeOf(e), f = personalFit(e);
  if (!g || f.state === "unknown") return "";
  if (f.state === "below") return GRADES[Math.max(0, gradeIdx(g) - 1)];
  return f.state === "exceeds" ? g + "+" : g;
}
const personalGradeOf = e => e.personalGrade?.grade || suggestedPersonalGrade(e);
function personalFitHTML(e) {
  const f = personalFit(e), req = e.knowledge || {}, q = e.qualifications || {}, jg = jobGradeOf(e), auto = suggestedPersonalGrade(e), pg = e.personalGrade;
  const cls = { below:"fit-below", meets:"fit-meets", exceeds:"fit-exceeds", unknown:"" }[f.state];
  const row = (lbl, r, a) => `<tr><td>${lbl}</td><td>${esc(r || "—")}</td><td>${esc(a || "—")}</td></tr>`;
  const grades = GRADES.flatMap(g => [g, g + "+"]);
  return `<section class="card" id="fitCard" style="margin-bottom:16px"><div class="row" style="justify-content:space-between">
      <div><div class="label-caps">${t("fitTitle")}</div><h2 style="margin:4px 0 0">${t(`fit_${f.state}`)}</h2></div>
      <div class="row" style="gap:18px"><div style="text-align:center"><div class="small muted">${t("jobGrade")}</div>${pill(jg)}</div>
        <div style="text-align:center"><div class="small muted">${t("personalGrade")}</div><span class="pill lg ${cls}">${esc(personalGradeOf(e) || "—")}</span></div></div></div>
    <div class="table-wrap-always" style="margin-top:12px"><table class="tbl cmp"><thead><tr><th></th><th>${t("required")}</th><th>${t("actual")}</th></tr></thead><tbody>
      ${row(esc(fl(SECTIONS[3].fields[0])), optLabel("education", req.minEducation), optLabel("education", q.education))}
      ${row(esc(fl(SECTIONS[3].fields[2])), req.experienceYears ?? "", q.experienceYears ?? "")}
      ${row(esc(fl(SECTIONS[3].fields[8])), req.certifications, q.certificationsHeld)}
      ${row(esc(fl(SECTIONS[3].fields[7])), req.languages, q.languagesSpoken)}</tbody></table></div>
    ${f.reasons.length ? `<p class="small" style="margin-top:8px">${f.reasons.map(r => "• " + t(r)).join("<br>")}</p>` : ""}
    <p class="small muted">${jg ? t("fitRule") : t("noJobGrade")}</p>
    ${pg?.grade ? `<p class="small"><b>${t("pgOverride")}:</b> ${esc(pg.grade)} — ${esc(pg.reason || "")} <span class="muted">(${esc(pg.byName || "")}, ${esc(pg.date || "")})</span></p>` : ""}
    ${isHR() && jg ? `<div class="row" style="align-items:flex-end;margin-top:10px">
      <div class="field" style="flex:0 1 200px"><label for="pgSel">${t("personalGrade")}</label><select id="pgSel"><option value="">${t("pgAuto")}: ${esc(auto || "—")}</option>${grades.map(g => `<option ${pg?.grade === g ? "selected" : ""}>${g}</option>`).join("")}</select></div>
      <div class="field" style="flex:1 1 240px"><label for="pgReason">${t("pgReason")}</label><input type="text" id="pgReason" value="${esc(pg?.reason || "")}"></div>
      <button class="btn btn-secondary" data-act="pgsave" data-id="${esc(e.id)}">${t("pgSave")}</button></div>` : ""}
  </section>`;
}
async function savePersonalGrade(id) {
  const g = $("#pgSel").value, reason = $("#pgReason").value.trim();
  if (g && !reason) { toast(t("tNeedReason"), "err"); $("#pgReason").focus(); return; }
  try {
    await updateDoc(doc(db, "employees", id), { personalGrade:g ? { grade:g, reason, byUid:S.user.uid, byName:S.profile?.displayName || S.user.email || "", date:today() } : null,
      history:arrayUnion(histEntry("personal_grade", g ? `${g} — ${reason}` : t("pgAuto"))), updatedAt:serverTimestamp(), updatedBy:S.user.uid });
    S.employees = null; toast(t("tPgSaved"), "ok"); render();
  } catch (e) { toast(errMsg(e), "err"); }
}
// Fixed job standard block inside section 3 of the form
function standardHTML(d) {
  const st = d.standard; if (!st?.items?.length) return "";
  const cur = S.jdt?.[st.templateId], newer = cur && (cur.version || 0) > (st.version || 0) && cur.fixedItems?.length;
  return `<div class="std-box"><div class="row" style="justify-content:space-between"><span class="label-caps">🔒 ${t("stdTitle")} · v${st.version || 1}</span>
      ${newer ? `<button type="button" class="btn btn-secondary" data-act="stdupdate">${t("stdUpdate", { v:cur.version })}</button>` : ""}</div>
    <p class="small muted" style="margin:6px 0 12px">${t("stdInfo")}</p>
    ${st.items.map((r, i) => `<div class="resp std"><div class="resp-h"><b>${i + 1}. ${esc(r.task)}</b><span class="row">
        ${r.frequency ? `<span class="chip">${esc(optLabel("freq", r.frequency))}</span>` : ""}${r.level ? `<span class="chip navy">${esc(optLabel("respLevel", r.level))}</span>` : ""}</span></div>
      ${r.description ? `<p class="small" style="margin:0 0 8px">${esc(r.description)}</p>` : ""}
      <div class="kv"><div><div class="k">${esc(fl(SECTIONS[2].fields[4]))}</div><div class="v">${esc(r.outcomes || "—")}</div></div>
        <div><div class="k">🔒 ${esc(fl(SECTIONS[2].fields[5]))}</div><div class="v">${esc(r.kpis || "—")}</div></div></div>
      <div class="field" style="margin-top:10px"><label for="f-kpiExtra-${i}">${t("kpiExtra")}</label><textarea id="f-kpiExtra-${i}" data-kpiextra="${i}">${esc(d.kpiExtra?.[i] || "")}</textarea>
        <span class="hint">${t("kpiExtraHint")}</span></div></div>`).join("")}</div>
    <div class="label-caps" style="margin:16px 0 8px">${t("customResp")}</div>`;
}

// Job description templates per (department, title) — Firestore `jobTemplates`, editable by HR / Admin and the department's manager
const JD_REQ_FIELDS = ["minEducation", "experienceYears", "technicalSkills", "softwareSystems", "languages", "certifications"];
const jdId = (dept, title) => `${dept}__${String(title).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
async function loadJobTemplates() {
  try { S.jdt = Object.fromEntries((await getDocs(collection(db, "jobTemplates"))).docs.map(d => [d.id, d.data()])); } catch (e) { console.warn("jobTemplates", e); S.jdt = {}; }
}
// Template for a title: the custom one if saved, otherwise built from the level template
function jdFor(dept, title) {
  const custom = S.jdt?.[jdId(dept, title)];
  if (custom) return { ...clone(custom), custom:true };
  const lvl = levelFor(title, dept), tpl = LEVEL_TEMPLATES[lvl];
  return { dept, title, custom:false, primaryPurpose:tpl ? L(tpl).replace("{dept}", deptName(dept)) : "", mainObjectives:"",
    responsibilities:tpl ? tpl.resp.map(([en, az, fq, lv]) => ({ ...blankResp(), task:S.lang === "en" ? en : az, frequency:fq, level:lv })) : [blankResp()], knowledge:{} };
}
function applyJd(d, jd, overwrite) {
  let changed = false;
  const fixed = jd.custom ? (jd.fixedItems || []) : [];
  if (fixed.length && (overwrite || !d.standard?.items?.length || d.standard.templateId !== jdId(d.position.department, d.position.jobTitle))) {
    d.standard = { templateId:jdId(d.position.department, d.position.jobTitle), title:d.position.jobTitle, version:jd.version || 1, items:clone(fixed) }; d.kpiExtra = {}; changed = true;
  } else if (overwrite && !fixed.length) { d.standard = null; d.kpiExtra = {}; }
  jd = { ...jd, responsibilities:(jd.responsibilities || []).filter(r => !r.fixed).map(({ fixed:_, ...r }) => r) };
  if (overwrite || !(d.purpose.primaryPurpose || "").trim()) { d.purpose.primaryPurpose = jd.primaryPurpose || ""; changed = true; }
  if (jd.mainObjectives && (overwrite || !(d.purpose.mainObjectives || "").trim())) { d.purpose.mainObjectives = jd.mainObjectives; changed = true; }
  const empty = !(d.responsibilities || []).some(r => (r.task || "").trim() || (r.description || "").trim());
  if ((overwrite || empty) && (jd.responsibilities?.length || d.standard?.items?.length)) { d.responsibilities = clone(jd.responsibilities).map(r => ({ ...blankResp(), ...r })); changed = true; }
  d.knowledge = d.knowledge || {};
  JD_REQ_FIELDS.forEach(k => { const v = jd.knowledge?.[k]; if (v !== undefined && v !== "" && v !== null && (overwrite || d.knowledge[k] === undefined || d.knowledge[k] === "" || d.knowledge[k] === null)) { d.knowledge[k] = v; changed = true; } });
  return changed;
}
const canEditJd = () => isHR();   // the job standard is maintained by HR
async function loadLibrary() {
  try {
    const snap = await getDocs(collection(db, "departments"));
    S.libDocIds = new Set(snap.docs.map(d => d.id));
    if (snap.docs.length) applyLibrary(snap.docs.map(d => ({ code:d.id, ...d.data() })).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)));
    else applyLibrary(clone(DEFAULT_DEPARTMENTS));
  } catch (e) { console.warn("library", e); }
}
// Records from the previous version used "manager_approval" for the final step
function normalizeEmp(e) { if (e.status === "manager_approval") e.status = "director_approval"; return e; }
async function loadEmployees(force = false) {
  if (S.employees && !force) return S.employees;
  let snap;
  if (isHR()) snap = await getDocs(collection(db, "employees"));
  else if (isMgr() && myDept()) snap = await getDocs(query(collection(db, "employees"), where("departmentId", "==", myDept())));
  else { S.employees = []; return S.employees; }
  S.employees = snap.docs.map(d => normalizeEmp({ id:d.id, ...d.data() }));
  return S.employees;
}
async function loadOne(id) {
  const list = await loadEmployees();
  let e = list.find(x => x.id === id);
  if (!e) {
    try { const s = await getDoc(doc(db, "employees", id)); if (s.exists()) e = normalizeEmp({ id:s.id, ...s.data() }); } catch (err) { console.warn(err); }
  }
  return e || null;
}
const sortByUpdated = list => list.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt));

/* =====================================================================
   9) Router & shell
   ===================================================================== */
const ROUTES = [
  [/^#\/login$/, scrLogin, "public"],
  [/^#\/pending$/, scrPending, "pending"],
  [/^#\/dashboard$/, scrDashboard],
  [/^#\/positions$/, scrPositions],
  [/^#\/positions\/new$/, scrForm],
  [/^#\/positions\/([^/]+)\/edit$/, scrForm],
  [/^#\/positions\/([^/]+)\/evaluate$/, scrEvaluate],
  [/^#\/positions\/([^/]+)$/, scrDetail],
  [/^#\/library$/, scrLibrary],
  [/^#\/library\/jd\/([^/]+)\/(.+)$/, scrJd],
  [/^#\/reports$/, scrReports],
  [/^#\/admin\/users$/, scrAdmin, "admin"]
];
let renderSeq = 0;
function parseHash() {
  const raw = location.hash || "#/dashboard";
  const [path, qs] = raw.split("?");
  return { path, params:new URLSearchParams(qs || "") };
}
async function render() {
  const seq = ++renderSeq;
  closeDrawer();
  renderHeader();
  const main = $("#main");
  if (!S.authReady) { main.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t("loading")}</p></div>`; return; }
  const { path, params } = parseHash();
  if (path === "#/demo") {
    if (!DEMO.on) { main.innerHTML = `<div class="loading"><div class="spinner"></div><p>${t("loading")}</p></div>`; await startDemo(true); }
    location.replace("#/dashboard"); return;
  }
  if (!S.user) { if (path !== "#/login") { location.replace("#/login"); return; } }
  else if (role() === "pending") { if (path !== "#/pending") { location.replace("#/pending"); return; } }
  else if (path === "#/login" || path === "#/pending" || path === "#/" || path === "#") { location.replace("#/dashboard"); return; }
  let hit = null, m = null;
  for (const r of ROUTES) { m = path.match(r[0]); if (m) { hit = r; break; } }
  if (!hit) { location.replace(S.user ? "#/dashboard" : "#/login"); return; }
  if (hit[2] === "admin" && !isAdmin()) { toast(t("tAdminOnly"), "warn"); location.replace("#/dashboard"); return; }
  try {
    const html = await hit[1]({ id:m[1] ? decodeURIComponent(m[1]) : null, id2:m[2] ? decodeURIComponent(m[2]) : null, params, path, seq });
    if (seq !== renderSeq || html == null) return;
    main.innerHTML = html;
    afterRender(hit[1]);
  } catch (e) {
    if (seq !== renderSeq) return;
    main.innerHTML = `<div class="card"><h2>${t("tError")}</h2><p class="muted">${esc(errMsg(e))}</p><button class="btn btn-ghost" data-act="reload">${t("refresh")}</button></div>`;
  }
}
const afterHooks = new Map();
function afterRender(fn) { const h = afterHooks.get(fn); if (h) h(); $$("textarea").forEach(autoGrow); }
function autoGrow(el) { el.style.height = "auto"; el.style.height = Math.max(72, el.scrollHeight + 2) + "px"; }

function navItems() {
  if (!S.user || role() === "pending") return [];
  const items = [["#/dashboard","navDashboard"],["#/positions","navPositions"],["#/library","navLibrary"],["#/reports","navReports"]];
  if (isAdmin()) items.push(["#/admin/users","navAdmin"]);
  return items;
}
function renderHeader() {
  const { path } = parseHash();
  const items = navItems();
  const isActive = h => path === h || (h !== "#/dashboard" && path.startsWith(h + "/")) || (h !== "#/dashboard" && path.startsWith(h + "?"));
  const dark = effectiveTheme() === "dark";
  const p = S.profile, u = S.user;
  const initials = (p?.displayName || u?.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const avatar = (p?.photoURL || u?.photoURL) ? `<img class="avatar" src="${esc(p?.photoURL || u?.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initials)}</span>`;
  $("#hdr").innerHTML = `
  <div class="hdr-in">
    ${items.length ? `<button class="icon-btn menu-btn" data-act="drawer" aria-label="${t("menu")}" aria-expanded="false">☰</button>` : ""}
    <a class="brand" href="${u ? "#/dashboard" : "#/login"}" aria-label="${esc(t("appName"))}">
      <span class="mono" aria-hidden="true">GS</span>
      <span class="brand-name">${esc(t("appName"))}<small>${S.lang === "en" ? "Dərəcələndirmə Sistemi" : "Grading System"}</small></span>
    </a>
    <nav class="nav" aria-label="Main">${items.map(([h, k]) => `<a href="${h}" class="${isActive(h) ? "active" : ""}" ${isActive(h) ? 'aria-current="page"' : ""}>${t(k)}</a>`).join("")}</nav>
    <div class="hdr-tools">
      <div class="seg-lang" role="group" aria-label="${t("langLabel")}">
        <button data-act="lang" data-v="az" aria-pressed="${S.lang === "az"}">AZ</button>
        <button data-act="lang" data-v="en" aria-pressed="${S.lang === "en"}">EN</button>
      </div>
      <button class="icon-btn" data-act="theme" aria-label="${t("themeToggle")}" title="${t("themeToggle")}">${dark ? "☀" : "☾"}</button>
      ${u ? `<div class="user-menu">
        <button class="user-btn" data-act="usermenu" aria-haspopup="true" aria-expanded="false" aria-label="${esc(p?.displayName || u.email || "")}">${avatar}</button>
        <div class="user-pop" id="userPop" hidden>
          <div class="nm">${esc(p?.displayName || u.displayName || "")}</div>
          <div class="em">${esc(u.email || "")}</div>
          <div class="row" style="margin-bottom:12px"><span class="chip navy">${esc(L(ROLES[role()] || ROLES.pending))}</span>${myDept() ? `<span class="chip">${esc(deptName(myDept()))}</span>` : ""}</div>
          <button class="btn btn-ghost btn-block" data-act="sharelink" style="margin-bottom:8px">🔗 ${t("shareDemo")}</button>
          <button class="btn btn-ghost btn-block" data-act="signout">${DEMO.on ? t("exitDemo") : t("signOut")}</button>
        </div></div>` : ""}
    </div>
  </div>`;
  renderDemoBar();
  $("#drawer").innerHTML = `<div class="drawer-head"><span class="brand"><span class="mono">GS</span><span class="brand-name">${esc(t("appName"))}</span></span>
    <button class="icon-btn" data-act="drawerclose" aria-label="${t("close")}">✕</button></div>
    ${items.map(([h, k]) => `<a href="${h}" class="${isActive(h) ? "active" : ""}">${t(k)}</a>`).join("")}
    ${u ? `<hr style="border:0;border-top:1px solid var(--border);width:100%"><a href="#" data-act="signout">${t("signOut")}</a>` : ""}`;
}
function renderDemoBar() {
  const bar = $("#demoBar"); if (!bar) return;
  if (!DEMO.on) { bar.hidden = true; bar.innerHTML = ""; return; }
  bar.hidden = false;
  bar.innerHTML = `<div class="demo-in"><b>${t("demoBar")}</b>
    <label class="demo-role"><span>${t("demoRole")}:</span>
      <select data-demorole="1" aria-label="${t("demoRole")}">${DEMO_USERS.map(([uid, name, r, dep]) => `<option value="${uid}" ${uid === DEMO.uid ? "selected" : ""}>${esc(L(ROLES[r]))}${dep ? " · " + esc(dep) : ""} — ${esc(name)}</option>`).join("")}</select></label>
    <button class="btn btn-ghost" data-act="sharelink">🔗 ${t("shareDemo")}</button>
    <a class="btn btn-ghost" href="media/grading-system-tour.mp4" target="_blank" rel="noopener">${t("videoShort")}</a>
    <button class="btn btn-ghost" data-act="demoreset">${t("resetDemo")}</button>
    <button class="btn btn-ghost" data-act="signout">${t("exitDemo")}</button></div>`;
}
function openDrawer() { $("#drawer").hidden = false; $("#drawerBackdrop").hidden = false; $(".menu-btn")?.setAttribute("aria-expanded", "true"); $("#drawer a")?.focus(); }
function closeDrawer() { $("#drawer").hidden = true; $("#drawerBackdrop").hidden = true; $(".menu-btn")?.setAttribute("aria-expanded", "false"); }

/* =====================================================================
   10) Screens
   ===================================================================== */
// S1 — Login
function scrLogin() {
  return `<div class="login-wrap"><div class="card login-card">
    <div class="mono" aria-hidden="true">GS</div>
    <h1>${esc(t("appName"))}</h1>
    <p class="muted" style="margin-bottom:24px">${esc(t("tagline"))}</p>
    <button class="btn btn-google" data-act="signin">
      <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
      ${t("signInGoogle")}</button>
    <div role="alert" aria-live="assertive">${S.loginError ? `<div class="err">${esc(S.loginError)}</div>` : ""}</div>
    <div class="or-line"><span>${t("or")}</span></div>
    <a class="btn btn-secondary btn-block" href="#/demo">${t("openDemo")}</a>
    <p class="small muted" style="margin-top:8px">${t("demoHint")}</p>
    <a class="btn btn-ghost btn-block" href="media/grading-system-tour.mp4" target="_blank" rel="noopener" style="margin-top:8px">${t("watchTour")}</a>
    <button class="btn btn-ghost btn-block" data-act="sharelink" style="margin-top:8px">🔗 ${t("shareDemo")}</button>
  </div></div>`;
}
// S2 — Pending
function scrPending() {
  return `<div class="login-wrap"><div class="card login-card">
    <div class="mono" aria-hidden="true">GS</div>
    <h1 style="font-size:22px">${t("pendingTitle")}</h1>
    <p class="muted">${esc(t("pendingText"))}</p>
    <p class="small muted" style="margin-top:12px">${esc(S.user?.email || "")}</p>
    <div class="row" style="justify-content:center;margin-top:20px">
      <button class="btn btn-ghost" data-act="signout">${t("signOut")}</button>
      <button class="btn btn-primary" data-act="refreshProfile">${t("refresh")}</button>
    </div></div></div>`;
}

// S3 — Dashboard
async function scrDashboard() {
  const list = await loadEmployees(true);
  const count = s => list.filter(e => e.status === s).length;
  const stats = [["total", t("totalPositions"), list.length], ["submitted", statusLabel("submitted"), count("submitted")], ["under_evaluation", statusLabel("under_evaluation"), count("under_evaluation")],
                 ["director_approval", statusLabel("director_approval"), count("director_approval")], ["approved", statusLabel("approved"), count("approved")]];
  const byGrade = GRADES.map(g => [g, list.filter(e => finalOf(e) === g).length]);
  const max = Math.max(1, ...byGrade.map(x => x[1]));
  const recent = sortByUpdated(list).slice(0, 5);
  const noDept = isMgr() && !myDept();
  return `
  <div class="page-head"><div><h1>${t("navDashboard")}</h1>
    <p class="sub">${esc(S.profile?.displayName || "")} · ${esc(L(ROLES[role()]))}${isMgr() ? " · " + esc(deptName(myDept())) : ""}</p></div>
    <div class="row">
      <a class="btn btn-primary" href="#/positions/new">${icon("plus")} ${t("newPosition")}</a>
      ${isHR() ? `<a class="btn btn-secondary" href="#/positions?status=submitted">${t("waitingEval")} (${count("submitted")})</a>` : ""}
    </div></div>
  ${noDept ? `<div class="banner warn"><b>${t("tNoDept")}</b></div>` : ""}
  ${isDirector() && count("director_approval") ? `<div class="banner info row" style="justify-content:space-between"><b style="margin:0">${t("pendingDirBanner", { n:count("director_approval") })}</b>
    <a class="btn btn-primary" href="#/positions?status=director_approval">${t("waitingMyApproval")}</a></div>` : ""}
  ${role() === "hr" && count("submitted") ? `<div class="banner info row" style="justify-content:space-between"><b style="margin:0">${t("pendingEvalBanner", { n:count("submitted") })}</b>
    <a class="btn btn-primary" href="#/positions?status=submitted">${t("waitingEval")}</a></div>` : ""}
  ${isMgr() && count("returned") ? `<div class="banner warn row" style="justify-content:space-between"><b style="margin:0">${t("pendingFixBanner", { n:count("returned") })}</b>
    <a class="btn btn-primary" href="#/positions?status=returned">${t("returnedToMe")}</a></div>` : ""}
  ${isMgr() ? `<p class="small muted" style="margin-bottom:12px">${t("myDeptOnly")}</p>` : ""}
  <div class="stats">${stats.map(([k, lbl, n]) => `
    <div class="card stat"><span class="ic" aria-hidden="true">${icon(k)}</span><div><div class="num">${n}</div><div class="lbl">${esc(lbl)}</div></div></div>`).join("")}</div>
  <div class="two-col">
    <section class="card"><div class="label-caps">${t("gradeDistSub")}</div><h2>${t("gradeDist")}</h2>
      <div class="bars">${byGrade.map(([g, n]) => `<div class="bar-row"><span><b>${g}</b></span>
        <div class="bar-track" role="img" aria-label="${g}: ${n}"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div><span class="v">${n}</span></div>`).join("")}</div>
    </section>
    <section class="card"><div class="label-caps">${t("allStatuses")}</div><h2>${t("recent")}</h2>
      ${recent.length ? `<div class="rows">${recent.map(e => `
        <button class="rowlink" data-go="#/positions/${esc(e.id)}">
          <div class="info"><div class="t1">${esc(e.fullName)}</div><div class="t2">${esc(e.position?.jobTitle)} · ${esc(deptName(e.departmentId))}</div></div>
          ${badge(e.status)} ${pill(finalOf(e))}</button>`).join("")}</div>`
        : emptyState()}
    </section>
  </div>
  <section class="card" style="margin-top:16px"><h2>${t("quickActions")}</h2><div class="row">
    <a class="btn btn-primary" href="#/positions/new">${t("newPosition")}</a>
    ${isHR() ? `<a class="btn btn-secondary" href="#/positions?status=submitted">${t("waitingEval")}</a>` : ""}
    ${isDirector() ? `<a class="btn btn-secondary" href="#/positions?status=director_approval">${t("waitingMyApproval")} (${count("director_approval")})</a>` : ""}
    ${isMgr() ? `<a class="btn btn-secondary" href="#/positions?status=returned">${t("returnedToMe")} (${count("returned")})</a>` : ""}
    <a class="btn btn-ghost" href="#/library">${t("navLibrary")}</a>
    <a class="btn btn-ghost" href="#/reports">${t("navReports")}</a>
    ${isAdmin() && !list.length ? `<button class="btn btn-ghost" data-act="sample">${t("loadSample")}</button>` : ""}
  </div></section>`;
}
function emptyState(msg) {
  return `<div class="empty"><p><b>${esc(msg || t("noPositions"))}</b></p><div class="row">
    <a class="btn btn-primary" href="#/positions/new">${t("newPosition")}</a>
    ${isAdmin() && !msg ? `<button class="btn btn-secondary" data-act="sample">${t("loadSample")}</button>` : ""}</div></div>`;
}

// S4 — Positions list
function filterList(list, f) {
  const q = (f.q || "").trim().toLowerCase();
  return list.filter(e => {
    if (f.dept && e.departmentId !== f.dept) return false;
    if (f.status && e.status !== f.status) return false;
    if (f.grade && (finalOf(e) || e.position?.currentGrade) !== f.grade) return false;
    if (q) {
      const hay = [e.fullName, e.position?.jobTitle, e.position?.positionId, e.employeeCode].join(" ").toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
function deptOptions(sel, allLabel = t("all")) {
  const ds = isMgr() ? DEPARTMENTS.filter(d => d.code === myDept()) : DEPARTMENTS;
  return `${allLabel != null ? `<option value="">${esc(allLabel)}</option>` : ""}${ds.map(d => `<option value="${d.code}" ${sel === d.code ? "selected" : ""}>${esc(L(d))}</option>`).join("")}`;
}
const statusOptions = sel => `<option value="">${t("all")}</option>` + Object.keys(STATUSES).map(s => `<option value="${s}" ${sel === s ? "selected" : ""}>${esc(statusLabel(s))}</option>`).join("");
const gradeOptions = (sel, first = t("all")) => `<option value="">${esc(first)}</option>` + GRADES.map(g => `<option ${sel === g ? "selected" : ""}>${g}</option>`).join("");

async function scrPositions({ params }) {
  if (params.has("status")) S.filters.status = params.get("status") || "";
  await loadEmployees(true);
  return `
  <div class="page-head"><div><h1>${t("navPositions")}</h1><p class="sub" id="posCount"></p></div>
    <div class="row"><a class="btn btn-primary" href="#/positions/new">${icon("plus")} ${t("newPosition")}</a>
    <button class="btn btn-secondary" data-act="exportA-list">${icon("export")} ${t("exportExcel")}</button></div></div>
  <div class="card" style="padding:16px;margin-bottom:16px">
  <div class="toolbar" style="margin:0">
    <div class="field search"><label for="fq">${t("search")}</label><input id="fq" type="search" value="${esc(S.filters.q)}" placeholder="${esc(t("searchPh"))}" data-filter="q" autocomplete="off"></div>
    <div class="field"><label for="fd">${t("department")}</label><select id="fd" data-filter="dept">${deptOptions(S.filters.dept)}</select></div>
    <div class="field"><label for="fs">${t("status")}</label><select id="fs" data-filter="status">${statusOptions(S.filters.status)}</select></div>
    <div class="field"><label for="fg">${t("grade")}</label><select id="fg" data-filter="grade">${gradeOptions(S.filters.grade)}</select></div>
    <div class="viewtoggle" role="group" aria-label="View">
      <button data-act="view" data-v="cards" aria-pressed="${S.view === "cards"}" title="${t("cards")}">▦ <span class="small">${t("cards")}</span></button>
      <button data-act="view" data-v="list" aria-pressed="${S.view === "list"}" title="${t("list")}">☰ <span class="small">${t("list")}</span></button>
    </div>
  </div></div>
  <div id="posResults"></div>`;
}
function posCard(e) {
  return `<button class="card clickable pcard" data-go="#/positions/${esc(e.id)}">
    <div class="top"><div style="min-width:0"><div class="name">${esc(e.fullName)}</div><div class="title">${esc(e.position?.jobTitle)}</div></div>${pill(finalOf(e))}</div>
    <div class="meta">${esc(deptName(e.departmentId))} · ${esc(e.position?.positionId || "—")} · ${esc(e.position?.jobLevel || "—")}</div>
    <div class="foot">${badge(e.status)}<span>${t("lastUpdated")}: ${esc(fmtDate(e.updatedAt) || "—")}</span></div></button>`;
}
const SORTS = {
  name:e => e.fullName || "", title:e => e.position?.jobTitle || "", dept:e => deptName(e.departmentId), level:e => e.position?.jobLevel || "",
  current:e => gradeIdx(e.position?.currentGrade), final:e => gradeIdx(finalOf(e)), status:e => Object.keys(STATUSES).indexOf(e.status), updated:e => tsMs(e.updatedAt)
};
function renderPosResults() {
  const box = $("#posResults"); if (!box) return;
  const all = S.employees || [];
  let list = filterList(all, S.filters);
  const fn = SORTS[S.sort.key] || SORTS.updated;
  list = list.slice().sort((a, b) => { const x = fn(a), y = fn(b); return (x > y ? 1 : x < y ? -1 : 0) * S.sort.dir; });
  $("#posCount").textContent = `${list.length} ${t("results")}`;
  if (!all.length) { box.innerHTML = `<div class="card">${emptyState()}</div>`; return; }
  if (!list.length) { box.innerHTML = `<div class="card"><div class="empty"><p><b>${t("noResults")}</b></p></div></div>`; return; }
  if (S.view === "cards") { box.innerHTML = `<div class="grid">${list.map(posCard).join("")}</div>`; return; }
  const cols = [["name","name"],["title","jobTitle"],["dept","department"],["level","level"],["current","currentGrade"],["final","finalGrade"],["status","status"],["updated","updated"]];
  box.innerHTML = `<div class="card table-wrap" style="padding:0"><table class="tbl"><thead><tr>${cols.map(([k, lbl]) => `
    <th aria-sort="${S.sort.key === k ? (S.sort.dir > 0 ? "ascending" : "descending") : "none"}"><button data-sort="${k}">${t(lbl)} ${S.sort.key === k ? (S.sort.dir > 0 ? "▲" : "▼") : ""}</button></th>`).join("")}</tr></thead>
    <tbody>${list.map(e => `<tr data-go="#/positions/${esc(e.id)}" tabindex="0">
      <td><b>${esc(e.fullName)}</b><div class="small muted">${esc(e.employeeCode)}</div></td><td>${esc(e.position?.jobTitle)}</td><td>${esc(deptName(e.departmentId))}</td>
      <td>${esc(e.position?.jobLevel || "—")}</td><td>${pill(e.position?.currentGrade)}</td><td>${pill(finalOf(e))}</td><td>${badge(e.status)}</td><td class="small">${esc(fmtDate(e.updatedAt))}</td></tr>`).join("")}</tbody></table></div>
    <div class="list-compact card" style="padding:4px 16px"><div class="rows">${list.map(e => `
      <button class="rowlink" data-go="#/positions/${esc(e.id)}"><div class="info"><div class="t1">${esc(e.fullName)}</div>
      <div class="t2">${esc(e.position?.jobTitle)} · ${esc(deptName(e.departmentId))} · ${esc(e.position?.jobLevel || "")}</div></div>${badge(e.status)} ${pill(finalOf(e))}</button>`).join("")}</div></div>`;
}
afterHooks.set(scrPositions, renderPosResults);

// S5 — Job Profile form
function blankResp() { return { task:"", description:"", frequency:"", level:"", outcomes:"", kpis:"", accountability:"" }; }
function blankEmployee() {
  const dept = isMgr() ? myDept() : "";
  const e = { employeeCode:"", fullName:"", hireDate:"", departmentId:dept, status:"draft", returnComment:"", responsibilities:[blankResp()], evaluation:null };
  SECTIONS.forEach(s => { if (!s.array) e[s.key] = {}; });
  Object.assign(e.position, { department:dept, employmentType:"full_time", directReports:0, indirectReports:0 });
  return e;
}
function pickPersist(e) { const o = {}; PERSIST_KEYS.forEach(k => { if (e[k] !== undefined) o[k] = clone(e[k]); }); return o; }
function nextPositionId(dept, exceptId) {
  const used = new Set((S.employees || []).filter(e => e.id !== exceptId).map(e => e.position?.positionId));
  for (let i = 1; i < 1000; i++) { const id = `POS-${dept}-${String(i).padStart(3, "0")}`; if (!used.has(id)) return id; }
  return `POS-${dept}-999`;
}
// Job description (sections 1–11) is editable at any status; scores and grade follow the workflow
function canEdit(e) {
  if (isHR()) return true;
  if (isMgr()) return e.departmentId === myDept();
  return false;
}
const workflowOpen = st => !st || ["draft", "returned"].includes(st);   // manager scoring + submit allowed

async function scrForm({ id, params, seq }) {
  await loadEmployees();
  const formKey = (id || "new") + (params.get("dup") || "");
  if (S.form && S.form.key === formKey) return formHTML();  // re-render (e.g. language switch) keeps unsaved edits
  let data, origStatus = "draft";
  if (id) {
    const e = await loadOne(id);
    if (seq !== renderSeq) return null;
    if (!e) { toast(t("tNotFound"), "err"); location.replace("#/positions"); return null; }
    if (!canEdit(e)) { toast(t("tCannotEdit"), "warn"); location.replace(`#/positions/${id}`); return null; }
    if (e.status === "approved" && !(S.form && S.form.id === id && S.form.approvedOk)) {
      const ok = await confirmDlg(t("confirmApprovedEdit"), t("confirmApprovedEditText"));
      if (seq !== renderSeq) return null;
      if (!ok) { location.replace(`#/positions/${id}`); return null; }
    }
    data = pickPersist(e); origStatus = e.status;
    if (!Array.isArray(data.responsibilities)) data.responsibilities = [];
    if (!data.responsibilities.length && !data.standard?.items?.length) data.responsibilities = [blankResp()];
    SECTIONS.forEach(s => { if (!s.array && !data[s.key]) data[s.key] = {}; });
  } else if (params.get("dup")) {
    const src = await loadOne(params.get("dup"));
    data = src ? pickPersist(src) : blankEmployee();
    if (src) {
      Object.assign(data, { employeeCode:"", fullName:"", hireDate:"", status:"draft", returnComment:"", evaluation:null });
      data.position.positionId = nextPositionId(data.position.department);
      data.position.currentGrade = ""; data.position.lastEvaluationDate = "";
      if (isMgr() && data.departmentId !== myDept()) data = blankEmployee();
      toast(t("tCopy"));
    }
  } else data = blankEmployee();
  S.open = new Set([1]);
  S.form = { key:formKey, id, data, origStatus, approvedOk:true, titleSearch:"", other:false };
  const title = data.position?.jobTitle;
  const dept = data.position?.department;
  S.form.other = !!(title && !(DEPT[dept]?.titles || []).includes(title));
  S.dirty = false;
  return formHTML();
}
function sectionComplete(s, d) {
  if (s.n === 1) return !!(d.position?.jobTitle && d.position?.department);
  if (s.n === 2) return !!(d.purpose?.primaryPurpose || "").trim();
  if (s.n === 3) return allResps(d).some(r => (r.task || "").trim() && r.frequency && r.level);
  if (s.n === 9 && !(Number(d.position?.directReports) > 0)) return true;
  const obj = d[s.key] || {};
  const filled = s.fields.filter(f => { const v = obj[f[0]]; return v !== undefined && v !== null && v !== ""; }).length;
  return filled >= Math.ceil(s.fields.length / 2);
}
function progressHTML(d) {
  const n = SECTIONS.filter(s => sectionComplete(s, d)).length;
  return `<div class="progress"><div class="track"><div class="fill" style="width:${(n / 11) * 100}%"></div></div><b>${n} / 11</b><span class="muted small">${t("sectionsComplete")}</span></div>`;
}
const fid = path => "f-" + path.replace(/\./g, "-");
function fieldHTML(path, def, value, opts = {}) {
  const [, , , type, req] = def;
  const id = fid(path), lab = esc(fl(def)) + (req ? ` <span class="req" aria-hidden="true">*</span>` : "");
  const dis = opts.disabled ? "disabled" : "";
  const full = type === "textarea" || opts.full ? " full" : "";
  let input;
  if (type === "textarea") input = `<textarea id="${id}" data-path="${path}" ${dis} ${req ? "required" : ""}>${esc(value)}</textarea>`;
  else if (type === "number") input = `<input id="${id}" type="number" min="0" inputmode="numeric" data-path="${path}" data-num="1" value="${esc(value ?? "")}" ${dis}>`;
  else if (type === "date") input = `<input id="${id}" type="date" data-path="${path}" value="${esc(value)}" ${dis}>`;
  else if (type === "grade") input = `<select id="${id}" data-path="${path}" ${dis}>${gradeOptions(value, t("select"))}</select>`;
  else if (type === "jobLevel") input = `<select id="${id}" data-path="${path}" ${dis}><option value="">${t("select")}</option>${Object.keys(LEVELS).map(l => `<option value="${l}" ${value === l ? "selected" : ""}>${esc(levelName(l))}</option>`).join("")}</select>`;
  else if (type.startsWith("opt:")) {
    const list = type.slice(4);
    return `<div class="field${full}" id="${id}"><span class="flabel" id="${id}-l">${lab}</span>
      <div class="chips" role="group" aria-labelledby="${id}-l">${Object.keys(OPTS[list]).map(k => `<button type="button" data-chip="${path}" data-v="${k}" aria-pressed="${value === k}" ${dis}>${esc(optLabel(list, k))}</button>`).join("")}</div></div>`;
  }
  else if (type === "yesno") {
    return `<div class="field${full}"><span class="flabel">${lab}</span><label class="toggle"><input type="checkbox" id="${id}" data-path="${path}" data-bool="1" ${value === true ? "checked" : ""} ${dis}>
      <span class="track" aria-hidden="true"></span><span data-yn>${value === true ? t("yes") : t("no")}</span></label></div>`;
  }
  else input = `<input id="${id}" type="text" data-path="${path}" value="${esc(value)}" ${dis} ${req ? "required" : ""}>`;
  return `<div class="field${full}"><label for="${id}">${lab}</label>${input}${opts.hint ? `<span class="hint">${opts.hint}</span>` : ""}</div>`;
}
function accHTML(s, body, d, extraTitle = "") {
  const open = S.open.has(s.n);
  const done = s.n <= 11 ? sectionComplete(s, d) : s.n === 13 ? !!(d.qualifications?.education && d.qualifications?.experienceYears != null && d.qualifications?.experienceYears !== "") : false;
  return `<section class="acc ${open ? "open" : ""}" id="sec-${s.n}">
    <button type="button" class="acc-h" data-acc="${s.n}" aria-expanded="${open}" aria-controls="secb-${s.n}">
      <span class="num">${s.n}</span><span class="tt"><b>${esc(L(s))}</b><span>${esc(S.lang === "en" ? s.az : s.en)}${extraTitle}</span></span>
      <span class="ok" data-ok="${s.n}" aria-label="${done ? "✓" : ""}">${done ? "✓" : ""}</span><span class="chev" aria-hidden="true">▾</span></button>
    <div class="acc-b" id="secb-${s.n}" ${open ? "" : "hidden"}>${body}</div></section>`;
}
function section1HTML(d) {
  const p = d.position || {};
  const dept = p.department || "";
  const titles = DEPT[dept]?.titles || [];
  const q = (S.form.titleSearch || "").toLowerCase();
  const shown = titles.filter(x => !q || x.toLowerCase().includes(q));
  const sel = S.form.other ? "__other" : (p.jobTitle || "");
  const lvl = p.jobLevel;
  const f = SECTIONS[0].fields, byKey = k => f.find(x => x[0] === k);
  return `<div class="fields">
    <div class="field"><label for="f-position-department">${esc(fl(byKey("department")))} <span class="req">*</span></label>
      <select id="f-position-department" data-dept="1" ${isMgr() ? "disabled" : ""}>${deptOptions(dept, isMgr() ? null : t("chooseDept"))}</select></div>
    <div class="field"><label for="f-position-jobTitle">${esc(fl(byKey("jobTitle")))} <span class="req">*</span></label>
      ${titles.length > 8 ? `<input type="search" id="titleSearch" aria-label="${t("filterTitles")}" placeholder="${t("filterTitles")}" value="${esc(S.form.titleSearch)}" ${dept ? "" : "disabled"}>` : ""}
      <select id="f-position-jobTitle" data-title="1" ${dept ? "" : "disabled"}>
        <option value="">${t("chooseTitle")}</option>
        ${shown.map(x => `<option ${sel === x ? "selected" : ""}>${esc(x)}</option>`).join("")}
        ${sel && sel !== "__other" && !shown.includes(sel) ? `<option selected>${esc(sel)}</option>` : ""}
        <option value="__other" ${sel === "__other" ? "selected" : ""}>${t("otherTitle")}</option></select>
      ${S.form.other ? `<label for="f-otherTitle" class="small muted" style="margin-top:4px">${t("typeTitle")}</label><input type="text" id="f-otherTitle" data-othertitle="1" value="${esc(p.jobTitle)}">` : ""}
    </div>
    ${p.jobTitle && dept ? `<div class="full row" style="justify-content:space-between"><span class="small muted">📄 ${jdFor(dept, p.jobTitle).custom ? t("jdHas") : t("jdDefault")}</span>
      <button type="button" class="btn btn-ghost" data-act="jdapply">${t("jdApply")}</button></div>` : ""}
    <div class="full"><div class="banner info" style="margin:0" id="rangeInfo">${lvl ? `<b>${t("suggestedRange")}: ${rangeText(lvl)}</b><span class="small">${esc(levelName(lvl))}</span>` : `<span class="small muted">${t("levelAuto")}</span>`}</div></div>
    ${f.filter(x => !["department", "jobTitle"].includes(x[0])).map(x => fieldHTML("position." + x[0], x, p[x[0]], {
      hint: x[0] === "jobLevel" ? t("levelAuto") : x[0] === "positionId" ? "POS-{DEPT}-###" : "",
      disabled: x[0] === "currentGrade" && !isHR() })).join("")}
  </div>`;
}
function respHTML(d) {
  const list = d.responsibilities || [];
  const fs = SECTIONS[2].fields, hasStd = !!d.standard?.items?.length;
  return `${standardHTML(d)}${list.map((r, i) => `<div class="resp" id="resp-${i}">
      <div class="resp-h"><span class="label-caps">${t("responsibility")} ${i + 1}</span>
      <button type="button" class="btn btn-danger" data-delresp="${i}" aria-label="${t("removeResp")} ${i + 1}" ${list.length <= 1 && !hasStd ? "disabled" : ""}>🗑 ${t("removeResp")}</button></div>
      <div class="fields">${fs.map(f => fieldHTML(`responsibilities.${i}.${f[0]}`, f, r[f[0]], { full: f[0] === "task" })).join("")}</div></div>`).join("")}
    <button type="button" class="btn btn-secondary" data-act="addresp" style="margin-top:12px">${t("addResp")}</button>`;
}
function formHTML() {
  const { data:d, id } = S.form;
  const showPeople = Number(d.position?.directReports) > 0;
  const body = s => {
    if (s.n === 1) return section1HTML(d);
    if (s.n === 3) return respHTML(d);
    if (s.n === 9) {
      if (!showPeople) return `<p class="muted">${t("sec9Hidden")}</p>`;
      const ro = [["directReports","Number of Direct Reports","Birbaşa tabeliyində olanların sayı","number"],["indirectReports","Number of Indirect Reports","Dolayı tabeliyində olanların sayı","number"]];
      return `<div class="fields">${ro.map(f => fieldHTML("_ro." + f[0], f, d.position?.[f[0]], { disabled:true })).join("")}${s.fields.map(f => fieldHTML(`${s.key}.${f[0]}`, f, d[s.key]?.[f[0]])).join("")}</div>`;
    }
    return `<div class="fields">${s.fields.map(f => fieldHTML(`${s.key}.${f[0]}`, f, d[s.key]?.[f[0]])).join("")}</div>`;
  };
  const isNewOrMgr = !id || isMgr() || S.form.origStatus === "draft";
  return `
  <div class="page-head"><div><div class="label-caps">${id ? esc(d.position?.positionId || "") : ""}</div><h1>${id ? t("editPosition") : t("newPosition")}</h1>
    ${id ? `<p class="sub">${badge(S.form.origStatus)}</p>` : ""}</div></div>
  ${S.form.origStatus === "returned" && d.returnComment ? `<div class="banner warn" role="note"><b>${t("returnedBanner")}</b>${t("hrComment")}: ${esc(d.returnComment)}</div>` : ""}
  ${id && !workflowOpen(S.form.origStatus) ? `<div class="banner info" role="note"><span class="small">${t("editAnyStatusInfo")}</span></div>` : ""}
  <section class="card" style="margin-bottom:16px"><div class="label-caps" style="margin-bottom:12px">${t("employee")}</div>
    <div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${TOP_FIELDS.map(f => fieldHTML(f[0], f, d[f[0]])).join("")}</div>
    <div style="margin-top:16px" id="progressBox">${progressHTML(d)}</div></section>
  <form id="jobForm" novalidate onsubmit="return false">
    ${SECTIONS.map(s => accHTML(s, body(s), d)).join("")}
    ${accHTML(SECMGR, mgrScoringHTML(d), d)}
    ${accHTML(SEC12, d.evaluation?.scores || d.managerEvaluation?.scores ? evaluationSectionHTML({ ...d, id:S.form.id, status:S.form.origStatus, history:[] }) : `<p class="muted">${t("noScores")}</p>`, d)}
    ${accHTML(QUAL, `<p class="small muted">${t("qualSub")}</p><div class="fields">${QUAL.fields.map(f => fieldHTML(`qualifications.${f[0]}`, f, d.qualifications?.[f[0]])).join("")}</div>`, d)}
  </form>
  <div class="actionbar">
    <button type="button" class="btn btn-ghost" data-act="formcancel">${t("cancel")}</button>
    <button type="button" class="btn btn-secondary" data-act="savedraft">${isNewOrMgr ? t("saveDraft") : t("save")}</button>
    ${canMgrScore(d) && workflowOpen(S.form.origStatus) ? `<button type="button" class="btn btn-primary" data-act="submitform">${t("submitEval")}</button>` : ""}
  </div>`;
}
// Section 12A — the manager's own scoring (step 1)
const SECMGR = { n:"12A", key:"managerEvaluation", en:"Manager evaluation", az:"Menecerin qiymətləndirməsi" };
function mgrScoringHTML(d) {
  const me = d.managerEvaluation || (d.managerEvaluation = { scores:{}, justifications:{}, comments:"" });
  if (!canMgrScore(d) || !workflowOpen(S.form.origStatus)) {
    if (isSelf(d)) return `<p class="small" style="color:var(--danger)">${t("conflictSelf")}</p>`;
    if (!me.scores || !Object.keys(me.scores).length) return `<p class="small muted">${t("mgrOnlySubmit")}</p>`;
    return visibility({ ...d, status:S.form.origStatus }).mgr ? scoresTable(d, true, false) : `<p class="small muted">🔒 ${t("mgrHiddenUntil")}</p>`;
  }
  const st = scoreTotal(me.scores), rec = st.complete ? recommendGrade(st.total) : null;
  return `<p class="small muted">${t("mgrEvalSub")}</p>
    <div class="row" style="margin:8px 0 12px"><span class="chip navy">${t("totalScore")}: ${st.total} / 45</span><span class="chip">${st.count} / 9 ${t("scored")}</span>${rec ? `<span class="pill">${rec}</span>` : ""}</div>
    <div class="stack">${factorCardsHTML({ target:"mgr", scores:me.scores, just:me.justifications || (me.justifications = {}), hints:profileHints(d) })}</div>
    <div class="field" style="margin-top:12px"><label for="f-mgrComments">${t("mgrComment")}</label><textarea id="f-mgrComments" data-mgrcomment="1">${esc(me.comments || "")}</textarea></div>`;
}
function refreshFormBits() {
  if (!S.form) return;
  const d = S.form.data;
  const pb = $("#progressBox"); if (pb) pb.innerHTML = progressHTML(d);
  SECTIONS.forEach(s => { const el = $(`[data-ok="${s.n}"]`); if (el) el.textContent = sectionComplete(s, d) ? "✓" : ""; });
  const q13 = $('[data-ok="13"]'); if (q13) q13.textContent = d.qualifications?.education && d.qualifications?.experienceYears != null && d.qualifications?.experienceYears !== "" ? "✓" : "";
}
function rerenderForm() {
  const y = window.scrollY, active = document.activeElement?.id;
  $("#main").innerHTML = formHTML();
  $$("textarea").forEach(autoGrow);
  window.scrollTo(0, y);
  if (active) { const el = document.getElementById(active); if (el) { el.focus({ preventScroll:true }); if (el.setSelectionRange && el.type === "search") el.setSelectionRange(el.value.length, el.value.length); } }
}
function applyTitle(title) {
  const d = S.form.data, p = d.position;
  p.jobTitle = title;
  if (!title) return;
  const lvl = levelFor(title, p.department);
  p.jobLevel = lvl;
  if (!p.positionId || /^POS-[A-Z]+-\d{3}$/.test(p.positionId) && !p.positionId.startsWith(`POS-${p.department}-`)) p.positionId = nextPositionId(p.department, S.form.id);
  const prefilled = applyJd(d, jdFor(p.department, title), false);
  if (prefilled) { S.open.add(2); S.open.add(3); toast(t("prefilled")); }
}
function validate(d) {
  const miss = [];
  if (!(d.fullName || "").trim()) miss.push(["f-fullName", 0]);
  if (!d.position?.department) miss.push(["f-position-department", 1]);
  if (!(d.position?.jobTitle || "").trim()) miss.push([S.form.other ? "f-otherTitle" : "f-position-jobTitle", 1]);
  if (!(d.purpose?.primaryPurpose || "").trim()) miss.push(["f-purpose-primaryPurpose", 2]);
  const rs = d.responsibilities || [];
  const okResp = allResps(d).filter(r => (r.task || "").trim() && r.frequency && r.level);
  if (!okResp.length) {
    const i = Math.max(0, rs.findIndex(r => !((r.task || "").trim() && r.frequency && r.level)));
    const r = rs[i] || {};
    const k = !(r.task || "").trim() ? "task" : !r.frequency ? "frequency" : "level";
    miss.push([rs.length ? fid(`responsibilities.${i}.${k}`) : "sec-3", 3, "resp"]);
  }
  const q = d.qualifications || {};
  if (!q.education) miss.push(["f-qualifications-education", 13, "qual"]);
  else if (q.experienceYears === "" || q.experienceYears == null) miss.push(["f-qualifications-experienceYears", 13, "qual"]);
  const me = d.managerEvaluation || {};
  const missF = FACTORS.find(f => !me.scores?.[f.key]);
  if (missF) miss.push([`fc-mgr-${missF.key}`, "12A", "mgr"]);
  else { const mj = missingJustifications(me.scores, me.justifications, profileHints(d)); if (mj.length) miss.push([`just-mgr-${mj[0]}`, "12A", "just"]); }
  return miss;
}
async function saveForm(submit) {
  const f = S.form, d = f.data;
  d.departmentId = d.position.department || d.departmentId || "";
  if (isMgr()) d.departmentId = d.position.department = myDept();
  $$(".invalid").forEach(el => el.classList.remove("invalid"));
  if (submit && !canMgrScore(d)) { toast(isSelf(d) ? t("conflictSelf") : t("mgrOnlySubmit"), "err"); return; }
  if (submit) {
    const miss = validate(d);
    if (miss.length) {
      miss.forEach(([, n]) => n != null && S.open.add(n));
      rerenderForm();
      miss.forEach(([elId]) => { const el = document.getElementById(elId); (el?.closest(".field") || el)?.classList.add("invalid"); });
      const first = document.getElementById(miss[0][0]);
      first?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center" });
      setTimeout(() => (first?.querySelector?.("button, input, select, textarea") || first)?.focus?.({ preventScroll:true }), 250);
      toast(miss[0][2] === "resp" && miss.length === 1 ? t("tNeedResp") : miss[0][2] === "mgr" ? t("tNeedMgrScores") : miss[0][2] === "just" ? t("tNeedJust") : miss[0][2] === "qual" ? t("tNeedQual") : t("tMissing"), "err");
      return;
    }
  }
  const code = (d.employeeCode || "").trim();
  d.employeeCode = code;
  if (code && (S.employees || []).some(e => e.id !== f.id && (e.employeeCode || "").trim().toLowerCase() === code.toLowerCase())) {
    S.open.add(0); const el = $("#f-employeeCode"); el?.closest(".field")?.classList.add("invalid"); el?.scrollIntoView({ block:"center" }); el?.focus();
    toast(t("tDupCode"), "err"); return;
  }
  let status;
  if (submit) status = "submitted";
  else if (!f.id || (isMgr() && workflowOpen(f.origStatus))) status = "draft";
  else status = f.origStatus;
  d.status = status;
  // Manager evaluation (step 1): only the department manager (or Admin as fallback) writes it
  const mgrScoring = canMgrScore(d) && workflowOpen(f.origStatus && f.id ? f.origStatus : null);
  if (mgrScoring && d.managerEvaluation) {
    const me = d.managerEvaluation, st = scoreTotal(me.scores);
    me.scores = Object.fromEntries(FACTORS.filter(f => me.scores?.[f.key]).map(f => [f.key, Number(me.scores[f.key])]));
    me.justifications = Object.fromEntries(Object.entries(me.justifications || {}).filter(([, v]) => (v || "").trim()));
    Object.assign(me, { totalScore:st.total, recommendedGrade:st.complete ? recommendGrade(st.total) : null,
      evaluatorUid:S.user.uid, evaluatorName:S.profile?.displayName || S.user.email || "", date:today() });
  }
  const payload = pickPersist(d);
  payload.responsibilities = (payload.responsibilities || []).filter(r => (r.task || "").trim() || (r.description || "").trim() || (r.kpis || "").trim());
  if (!mgrScoring) delete payload.managerEvaluation;
  if (f.id && f.origStatus === "approved") payload.profileChangedAfterApproval = { at:new Date().toISOString(), byName:S.profile?.displayName || S.user.email || "" };
  payload.updatedBy = S.user.uid; payload.updatedAt = serverTimestamp();
  const hAction = submit ? "submitted" : !f.id ? "created" : "edited";
  const hNote = submit ? `${scoreTotal(d.managerEvaluation?.scores).total}/45` : "";
  const btns = $$(".actionbar .btn"); btns.forEach(b => b.disabled = true);
  try {
    let newId = f.id;
    if (!f.id) {
      if (isMgr()) payload.evaluation = null;
      payload.createdBy = S.user.uid; payload.createdAt = serverTimestamp();
      payload.history = [histEntry("created"), ...(submit ? [histEntry("submitted", hNote)] : [])];
      newId = (await addDoc(collection(db, "employees"), payload)).id;
    } else {
      if (isMgr()) delete payload.evaluation;
      payload.history = arrayUnion(histEntry(hAction, hNote));
      await updateDoc(doc(db, "employees", f.id), payload);
    }
    const eRef = { ...d, id:newId };
    let n = 0;
    if (submit) n = await notify("evaluation_request", eRef, { roles:["hr"] });
    else if (!f.id && !isMgr()) n = await notify("profile_request", eRef, { roles:["manager"], dept:d.departmentId, fallback:false });
    S.employees = null; S.dirty = false; S.form = null;
    toast((submit ? t("tSubmitted") : t("tSaved")) + mailNote(n), "ok");
    location.hash = `#/positions/${newId}`;
  } catch (e) { toast(errMsg(e), "err"); btns.forEach(b => b.disabled = false); }
}

// S6 — Position detail
function valueText(def, v) {
  const type = def[3];
  if (type.startsWith("opt:")) return optLabel(type.slice(4), v);
  if (type === "yesno") return v === true ? t("yes") : v === false ? t("no") : "";
  if (type === "dept") return deptName(v);
  if (type === "jobLevel") return levelName(v);
  if (type === "status") return statusLabel(v);
  if (type === "number" && typeof v === "number" && v >= 1000) return v.toLocaleString("en-US").replace(/,/g, " ");
  return v ?? "";
}
function kvHTML(fields, obj) {
  return `<div class="kv">${fields.map(f => {
    const v = valueText(f, obj?.[f[0]]);
    return `<div class="${f[3] === "textarea" ? "full" : ""}"><div class="k">${esc(fl(f))}</div><div class="v">${["grade"].includes(f[3]) ? pill(obj?.[f[0]]) : esc(v === "" ? "—" : v)}</div></div>`;
  }).join("")}</div>`;
}
async function scrDetail({ id, seq }) {
  await loadEmployees();
  const e = await loadOne(id);
  if (seq !== renderSeq) return null;
  if (!e) { toast(t("tNotFound"), "err"); location.replace("#/positions"); return null; }
  const p = e.position || {};
  const showPeople = Number(p.directReports) > 0;
  const card = (n, title, sub, body) => `<section class="card"><div class="row" style="margin-bottom:12px"><span class="acc-h" style="padding:0;min-height:0;width:auto"><span class="num">${n}</span></span>
    <div><h2 style="margin:0">${esc(title)}</h2><div class="small muted">${esc(sub)}</div></div></div>${body}</section>`;
  const secs = SECTIONS.map(s => {
    let body;
    if (s.n === 3) body = allResps(e).map((r, i) => `<div class="mini ${r.fixed ? "std" : ""}"><div class="row" style="justify-content:space-between"><b>${r.fixed ? "🔒 " : ""}${i + 1}. ${esc(r.task)}</b>
        <span class="row">${r.frequency ? `<span class="chip">${esc(optLabel("freq", r.frequency))}</span>` : ""}${r.level ? `<span class="chip navy">${esc(optLabel("respLevel", r.level))}</span>` : ""}</span></div>
        ${r.description ? `<p style="margin:8px 0 0">${esc(r.description)}</p>` : ""}
        <div class="kv" style="margin-top:10px">${SECTIONS[2].fields.filter(f => ["outcomes", "kpis", "accountability"].includes(f[0])).map(f => `<div><div class="k">${esc(fl(f))}</div><div class="v">${esc(valueText(f, r[f[0]]) || "—")}</div></div>`).join("")}
        ${r.kpisExtra ? `<div class="full"><div class="k">${t("kpiExtra")}</div><div class="v">${esc(r.kpisExtra)}</div></div>` : ""}</div>
        ${r.fixed ? `<p class="small muted" style="margin:8px 0 0">🔒 ${t("fixedItem")}${e.standard?.version ? " · v" + e.standard.version : ""}</p>` : ""}</div>`).join("") || `<p class="muted">—</p>`;
    else if (s.n === 9 && !showPeople) body = `<p class="muted">${t("notApplicable")}</p>`;
    else if (s.n === 9) body = kvHTML([["directReports","Number of Direct Reports","Birbaşa tabeliyində olanların sayı","number"],["indirectReports","Number of Indirect Reports","Dolayı tabeliyində olanların sayı","number"]], p) + `<div style="height:14px"></div>` + kvHTML(s.fields, e[s.key]);
    else body = kvHTML(s.fields, e[s.key]);
    return card(s.n, L(s), S.lang === "en" ? s.az : s.en, body);
  }).join("");
  const edit = canEdit(e);
  return `
  <div class="no-print" style="margin-bottom:12px"><a href="#/positions" class="small">← ${t("navPositions")}</a></div>
  <section class="card" style="margin-bottom:16px"><div class="dhead">
    <div style="min-width:0"><div class="label-caps">${esc(e.employeeCode)} · ${esc(p.positionId || "")}</div>
      <h1>${esc(e.fullName)}</h1><div style="font-size:17px">${esc(p.jobTitle)}</div>
      <div class="muted small" style="margin-top:4px">${esc(deptName(e.departmentId))} · ${esc(levelName(p.jobLevel) || "—")} · ${esc(p.positionId || "—")}</div>
      <div class="row" style="margin-top:10px">${badge(e.status)}<span class="small muted">${t("lastUpdated")}: ${esc(fmtDate(e.updatedAt) || "—")}</span></div></div>
    <div style="text-align:center"><div class="label-caps" style="margin-bottom:6px">${t("grade")}</div><span class="pill lg ${finalOf(e) || p.currentGrade ? "" : "empty"}">${esc(finalOf(e) || p.currentGrade || "—")}</span>
      <div class="small muted" style="margin-top:6px">${t("suggestedRange")}: ${rangeText(p.jobLevel)}</div></div></div>
    ${e.status === "returned" && e.returnComment ? `<div class="banner warn" style="margin:16px 0 0"><b>${t("hrComment")}</b>${esc(e.returnComment)}</div>` : ""}
    ${e.profileChangedAfterApproval && e.status === "approved" && !isMgr() ? `<div class="banner warn" style="margin:16px 0 0"><b>✎ ${t("changedAfterApproval")}</b><span class="small">${esc(e.profileChangedAfterApproval.byName || "")} · ${esc(String(e.profileChangedAfterApproval.at || "").slice(0, 10))}</span></div>` : ""}
    ${e.status === "director_approval" && !canFinalApprove(e) ? `<div class="banner info" style="margin:16px 0 0"><b>⏳ ${t("waitingDirector")}</b>${isDirector() ? `<span class="small">${t(finalApproveBlock(e))}</span>` : ""}</div>` : ""}
  </section>
  ${e.status === "director_approval" && canFinalApprove(e) ? directorPanelHTML(e) : ""}
  ${personalFitHTML(e)}
  <div class="row no-print" style="margin-bottom:16px" id="detailActions">
    ${edit ? `<a class="btn btn-primary" href="#/positions/${esc(e.id)}/edit">${t("edit")}</a>` : ""}
    ${canHREvaluate() && !isSelf(e) && e.status !== "draft" ? `<a class="btn btn-secondary" href="#/positions/${esc(e.id)}/evaluate">${t("evaluate")}</a>` : ""}
    <button class="btn btn-ghost" data-act="exportC-pv" data-id="${esc(e.id)}">${t("previewBtn")}</button>
    <button class="btn btn-ghost" data-act="exportC" data-id="${esc(e.id)}">${icon("export")} ${t("exportPos")}</button>
    <a class="btn btn-ghost" href="#/positions/new?dup=${esc(e.id)}">${t("duplicate")}</a>
    <button class="btn btn-ghost" data-act="print">${t("print")}</button>
    ${isAdmin() ? `<button class="btn btn-danger" data-act="delete" data-id="${esc(e.id)}">${t("del")}</button>` : ""}
  </div>
  <div class="stack">
    ${card("·", t("employee"), "", kvHTML(TOP_FIELDS, e))}
    ${secs}
    ${card(12, L(SEC12), t("hrEvalSub"), evaluationSectionHTML(e))}
    ${card(13, L(QUAL), t("qualSub"), kvHTML(QUAL.fields, e.qualifications))}
    ${card("⏱", t("history"), "", historyHTML(e))}
  </div>`;
}

/* =====================================================================
   Grading workflow v2
   Manager scores → HR scores independently (blind) → calibration →
   HR Director / HR Manager final approval (four-eyes) + history + e-mail
   ===================================================================== */
const FACTOR_ANCHORS = {
  knowledge:[["Basic schooling; the job is learned in a few days","Orta təhsil; iş bir neçə günə öyrənilir"],
    ["Vocational training or certificate; standard procedures","Peşə təhsili və ya sertifikat; standart prosedurlar"],
    ["Bachelor's or equivalent; solid specialist knowledge in one area","Bakalavr və ya ekvivalenti; bir sahədə möhkəm ixtisas bilikləri"],
    ["Advanced degree or deep expertise across several areas","Magistr və ya bir neçə sahədə dərin ekspertiza"],
    ["Recognised expert; sets professional standards for the hotel","Tanınmış ekspert; otel üçün peşə standartlarını müəyyən edir"]],
  experience:[["Less than 1 year","1 ildən az"],["1–2 years in a similar role","Oxşar vəzifədə 1–2 il"],
    ["3–5 years, including some responsibility","3–5 il, müəyyən məsuliyyətlə"],["6–9 years, including leading others","6–9 il, başqalarına rəhbərlik daxil"],
    ["10+ years, including senior leadership","10+ il, yüksək rəhbər təcrübəsi daxil"]],
  problemSolving:[["Routine tasks with clear instructions","Aydın təlimatlı rutin işlər"],
    ["Simple problems solved with known procedures","Sadə problemlər məlum prosedurlarla həll olunur"],
    ["Varied problems needing analysis and judgement","Təhlil və mülahizə tələb edən müxtəlif problemlər"],
    ["Complex, non-standard problems across functions","Funksiyalararası mürəkkəb, qeyri-standart problemlər"],
    ["Strategic, new problems with no precedent","Presedenti olmayan strateji, yeni problemlər"]],
  decisionMaking:[["Follows instructions; almost every decision is approved","Göstərişlərə əməl edir; demək olar bütün qərarlar təsdiqlənir"],
    ["Decides routine matters within clear rules","Aydın qaydalar çərçivəsində rutin məsələləri həll edir"],
    ["Decides the day-to-day operations of own area","Öz sahəsinin gündəlik əməliyyatları üzrə qərar verir"],
    ["Decides for a department, including budget and staff","Departament üzrə, büdcə və kadr daxil olmaqla qərar verir"],
    ["Sets direction for the hotel or a division","Otel və ya bölmə üçün istiqaməti müəyyən edir"]],
  accountability:[["Own tasks only; errors are easy to fix","Yalnız öz tapşırıqları; səhvlər asan düzəlir"],
    ["Own results; errors affect a few guests or colleagues","Öz nəticələri; səhvlər bir neçə qonaq və ya həmkara təsir edir"],
    ["Results of a team or process; errors cost money or reputation","Komanda və ya proses nəticələri; səhvlər pul və ya nüfuz itkisinə səbəb olur"],
    ["Results of a department; significant financial risk","Departamentin nəticələri; ciddi maliyyə riski"],
    ["Results of the hotel or a division; major business risk","Otelin və ya bölmənin nəticələri; böyük biznes riski"]],
  businessImpact:[["Little direct effect on guests or revenue","Qonaqlara və gəlirə birbaşa təsiri azdır"],
    ["Affects individual guest experiences","Ayrı-ayrı qonaqların təcrübəsinə təsir edir"],
    ["Affects a unit's service quality or costs","Bölmənin xidmət keyfiyyətinə və ya xərclərinə təsir edir"],
    ["Affects department revenue, costs or guest scores","Departamentin gəlirinə, xərclərinə və ya qonaq reytinqinə təsir edir"],
    ["Affects hotel-wide results and strategy","Bütün otelin nəticələrinə və strategiyasına təsir edir"]],
  leadership:[["No responsibility for people","İnsanlara görə məsuliyyət yoxdur"],
    ["Guides or trains colleagues informally","Həmkarlara qeyri-rəsmi yol göstərir və ya öyrədir"],
    ["Supervises a small team (1–10 people)","Kiçik komandaya (1–10 nəfər) nəzarət edir"],
    ["Manages a team of 11–40 or several supervisors","11–40 nəfərlik komandanı və ya supervayzerləri idarə edir"],
    ["Leads managers or more than 40 people","Menecerlərə və ya 40+ nəfərə rəhbərlik edir"]],
  communication:[["Exchanges routine information","Rutin məlumat mübadiləsi"],
    ["Serves guests and coordinates with colleagues","Qonaqlara xidmət və həmkarlarla koordinasiya"],
    ["Explains and persuades; handles complaints","İzah edir və inandırır; şikayətlərlə işləyir"],
    ["Negotiates with partners, suppliers or key clients","Tərəfdaşlar, təchizatçılar və ya əsas müştərilərlə danışıqlar aparır"],
    ["Represents the hotel; influences senior stakeholders","Oteli təmsil edir; yüksək səviyyəli tərəflərə təsir edir"]],
  workingConditions:[["Office, regular hours, low strain","Ofis, normal iş saatları, az yük"],
    ["Some standing or walking; occasional extra hours","Bəzən ayaq üstə və ya hərəkətdə; arabir əlavə saatlar"],
    ["Shift work or regular physical / emotional strain","Növbəli iş və ya müntəzəm fiziki / emosional yük"],
    ["Heavy physical work, heat or high-pressure guest contact","Ağır fiziki iş, isti mühit və ya gərgin qonaq təması"],
    ["Hazardous conditions or constant high pressure","Təhlükəli şərait və ya daimi yüksək gərginlik"]]
};
const LMH = { low:1, medium:3, high:5 };
const avgOf = arr => { const v = arr.filter(x => typeof x === "number" && !isNaN(x)); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const to5 = x => x == null ? null : Math.min(5, Math.max(1, Math.round(x)));
// (3) Score suggested by the facts in the profile — a neutral reference point for both evaluators
function profileHints(e) {
  const k = e.knowledge || {}, d = e.decisions || {}, sc = e.scope || {}, ps = e.problemSolving || {}, c = e.communication || {}, env = e.environment || {}, p = e.position || {};
  const m = v => LMH[v] ?? null;
  const yrs = k.experienceYears === "" || k.experienceYears == null ? null : Number(k.experienceYears);
  const heads = (Number(p.directReports) || 0) + (Number(p.indirectReports) || 0);
  const anyPeople = Object.values(e.people || {}).some(Boolean);
  const wc = avgOf([m(env.physicalRequirements), m(env.mentalDemands), m(env.healthSafetyRisks), m(env.challengingConditions)]);
  return {
    knowledge:{ secondary:1, vocational:2, bachelor:3, master:4, doctorate:5 }[k.minEducation] ?? null,
    experience:yrs == null || isNaN(yrs) ? null : yrs < 1 ? 1 : yrs < 3 ? 2 : yrs < 6 ? 3 : yrs < 10 ? 4 : 5,
    problemSolving:to5(avgOf([ps.complexity, ps.analyticalThinking, ps.independentResolution, ps.strategicPlanning, ps.innovation].map(m))),
    decisionMaking:to5(avgOf([m(d.authorityLevel), m(d.operationalChanges), { close:1, general:3, minimal:5 }[d.supervisionReceived] ?? null])),
    accountability:to5(avgOf([m(ps.errorImpact), avgOf(allResps(e).map(r => m(r.accountability))), m(sc.assetsResponsibility)])),
    businessImpact:to5(avgOf([sc.operationalImpact, sc.financialImpact, sc.guestSatisfactionImpact, sc.businessPerformanceImpact].map(m))),
    leadership:heads === 0 ? (anyPeople ? 2 : 1) : heads <= 10 ? 3 : heads <= 40 ? 4 : 5,
    communication:to5(avgOf([{ inform:1, coordinate:2, negotiate:4, influence:5 }[c.communicationLevel] ?? null, m(c.confidentiality)])),
    workingConditions:wc == null ? null : to5(wc + ((env.shiftWork || env.weekendsHolidays) ? 0.5 : 0))
  };
}
// A score 2+ points away from the profile hint must be justified
const needsJustification = (score, hint) => !!(score && hint && Math.abs(score - hint) >= 2);
function missingJustifications(scores, just, hints) {
  return FACTORS.filter(f => needsJustification(Number(scores?.[f.key]), hints[f.key]) && !(just?.[f.key] || "").trim()).map(f => f.key);
}
// (1) Calibration between the two independent evaluations
function calibration(mgr, hr) {
  if (!mgr || !hr || !scoreTotal(mgr).complete || !scoreTotal(hr).complete) return null;
  const gaps = Object.fromEntries(FACTORS.map(f => [f.key, Number(hr[f.key]) - Number(mgr[f.key])]));
  const maxGap = Math.max(...Object.values(gaps).map(Math.abs));
  const totalGap = scoreTotal(hr).total - scoreTotal(mgr).total;
  return { gaps, maxGap, totalGap, flagged:maxGap >= 2 || Math.abs(totalGap) >= 4 };
}
// (5) Conflict of interest: nobody scores or approves their own position
const normTxt = s => String(s || "").trim().toLowerCase();
function isSelf(e) {
  const em = normTxt(e?.employeeEmail);
  const mine = [normTxt(S.user?.email), normTxt(S.profile?.notifyEmail)].filter(Boolean);
  if (em && mine.includes(em)) return true;
  return !!normTxt(e?.fullName) && normTxt(e.fullName) === normTxt(S.profile?.displayName);
}
const isDirector = () => ["hr_director", "admin"].includes(role());
const canHREvaluate = () => ["hr", "hr_director", "admin"].includes(role());
const canMgrScore = e => !isSelf(e) && (isAdmin() || (isMgr() && e.departmentId === myDept()));
function finalApproveBlock(e) {
  if (!isDirector()) return "notDirector";
  if (isSelf(e)) return "conflictSelf";
  if (e.evaluation?.evaluatorUid && e.evaluation.evaluatorUid === S.user.uid) return "fourEyes";
  return "";
}
const canFinalApprove = e => !finalApproveBlock(e);
// (6) Consistency: what did similar positions get?
function similarPositions(e) {
  const others = (S.employees || []).filter(x => x.id !== e.id);
  const gradeOf = x => x.evaluation?.finalGrade || x.position?.currentGrade || "";
  const sameTitle = others.filter(x => x.position?.jobTitle && x.position.jobTitle === e.position?.jobTitle && gradeOf(x)).map(x => ({ x, g:gradeOf(x) }));
  const sameLevel = others.filter(x => x.position?.jobLevel && x.position.jobLevel === e.position?.jobLevel && gradeOf(x)).map(x => gradeOf(x));
  const levelCounts = {}; sameLevel.forEach(g => levelCounts[g] = (levelCounts[g] || 0) + 1);
  let outlier = false;
  const proposed = e.evaluation?.finalGrade || (S.evalState?.id === e.id ? S.evalState.finalGrade : "");
  if (proposed && sameTitle.length) {
    const idx = sameTitle.map(s => gradeIdx(s.g)).sort((a, b) => a - b), med = idx[Math.floor(idx.length / 2)];
    outlier = Math.abs(gradeIdx(proposed) - med) >= 2;
  }
  return { sameTitle, levelCounts, outlier, proposed };
}
function consistencyHTML(e) {
  const s = similarPositions(e);
  const lv = Object.entries(s.levelCounts).sort((a, b) => gradeIdx(a[0]) - gradeIdx(b[0]));
  return `<div><div class="label-caps">${t("consistency")}</div>
    ${s.sameTitle.length ? `<ul class="small" style="padding-left:18px;margin:6px 0">${s.sameTitle.slice(0, 6).map(({ x, g }) => `<li>${esc(x.position.jobTitle)} · ${esc(deptName(x.departmentId))} — <b>${esc(g)}</b></li>`).join("")}</ul>` : `<p class="small muted" style="margin:6px 0">${t("noSimilar")}</p>`}
    ${lv.length ? `<p class="small muted" style="margin:0">${esc(e.position?.jobLevel || "")}: ${lv.map(([g, n]) => `${g}×${n}`).join(", ")}</p>` : ""}
    ${s.outlier ? `<p class="small" style="color:var(--warn);margin-top:6px">⚠ ${t("outlierWarn")}</p>` : ""}</div>`;
}
// (8) Audit history
const histEntry = (action, note = "") => ({ at:new Date().toISOString(), byUid:S.user?.uid || "", byName:S.profile?.displayName || S.user?.email || "", role:role(), action, note:String(note || "").slice(0, 300) });
function historyHTML(e) {
  const h = (e.history || []).slice().sort((a, b) => String(b.at).localeCompare(String(a.at)));
  if (!h.length) return `<p class="muted small">—</p>`;
  return `<ol class="timeline">${h.map(x => `<li><div class="small"><b>${esc(t("h_" + x.action) || x.action)}</b> · ${esc(x.byName || "")}${x.role ? ` <span class="muted">(${esc(L(ROLES[x.role] || ["", ""]))})</span>` : ""}</div>
    <div class="small muted">${esc(String(x.at || "").replace("T", " ").slice(0, 16))}${x.note ? " — " + esc(x.note) : ""}</div></li>`).join("")}</ol>`;
}

/* ---------- Factor score cards (shared by manager & HR) ---------- */
function factorCardsHTML(o) {
  // o: { target:"mgr"|"hr", scores, just, hints, compare?, compareLabel?, disabled? }
  return FACTORS.map(f => {
    const v = Number(o.scores?.[f.key]) || 0, h = o.hints?.[f.key], cmp = o.compare ? Number(o.compare[f.key]) || 0 : 0;
    const needJ = needsJustification(v, h), gap = cmp && v ? Math.abs(v - cmp) : 0;
    const anchors = FACTOR_ANCHORS[f.key];
    return `<section class="card factor ${needJ && !(o.just?.[f.key] || "").trim() ? "needs" : ""}" id="fc-${o.target}-${f.key}" aria-labelledby="fac-${o.target}-${f.key}">
      <div class="row" style="justify-content:space-between"><h3 id="fac-${o.target}-${f.key}" style="margin:0">${esc(L(f))}</h3>
        <span class="row">${h ? `<span class="chip" title="${esc(t("hintTitle"))}">${t("profileHint")}: ${h}</span>` : ""}
          ${cmp ? `<span class="chip ${gap >= 2 ? "chip-warn" : "navy"}">${esc(o.compareLabel)}: ${cmp}</span>` : ""}
          <span class="chip navy">${v ? v + " / 5" : "—"}</span></span></div>
      <div class="small muted">${esc(S.lang === "en" ? f.dEn : f.dAz)}</div>
      <div class="scale" role="group" aria-labelledby="fac-${o.target}-${f.key}">${SCALE.map((s, i) => `<button type="button" data-score="${f.key}" data-target="${o.target}" data-v="${i + 1}"
        aria-pressed="${v === i + 1}" title="${esc(L(anchors[i]))}" ${o.disabled ? "disabled" : ""}><b>${i + 1}</b><span>${esc(L(s))}</span></button>`).join("")}</div>
      <p class="anchor small">${v ? `<b>${v} — ${esc(L(SCALE[v - 1]))}:</b> ${esc(L(anchors[v - 1]))}` : `<span class="muted">${t("pickScore")}</span>`}</p>
      <details class="small"><summary>${t("scaleGuide")}</summary><ol class="anchors">${anchors.map((a, i) => `<li class="${v === i + 1 ? "on" : ""}">${esc(L(a))}</li>`).join("")}</ol></details>
      ${needJ ? `<div class="field" style="margin-top:10px"><label for="just-${o.target}-${f.key}">${t("justify")} <span class="req">*</span></label>
        <textarea id="just-${o.target}-${f.key}" data-just="${f.key}" data-target="${o.target}" ${o.disabled ? "disabled" : ""}>${esc(o.just?.[f.key] || "")}</textarea>
        <span class="hint">${esc(t("justifyHint", { h, v }))}</span></div>` : ""}
    </section>`;
  }).join("");
}

/* ---------- Read-only evaluation views ---------- */
function scoresTable(e, showMgr, showHR) {
  const me = e.managerEvaluation, ev = e.evaluation, hints = profileHints(e), cal = calibration(me?.scores, ev?.scores);
  const cols = [[t("profileHint"), f => hints[f.key] ?? "—"]];
  if (showMgr) cols.push([t("mgrScore"), f => me?.scores?.[f.key] ?? "—"]);
  if (showHR) cols.push([t("hrScore"), f => ev?.scores?.[f.key] ?? "—"]);
  if (showMgr && showHR && cal) cols.push([t("gap"), f => { const g = cal.gaps[f.key]; return `<span class="${Math.abs(g) >= 2 ? "gapwarn" : ""}">${g > 0 ? "+" : ""}${g}</span>`; }]);
  const tot = (sc) => sc ? scoreTotal(sc).total : "—";
  return `<div class="table-wrap-always"><table class="tbl cmp"><thead><tr><th>${t("factor")}</th>${cols.map(c => `<th>${c[0]}</th>`).join("")}</tr></thead><tbody>
    ${FACTORS.map(f => `<tr><td>${esc(L(f))}</td>${cols.map(c => `<td>${c[1](f)}</td>`).join("")}</tr>`).join("")}
    <tr class="tot"><td><b>${t("totalScore")}</b></td><td>—</td>${showMgr ? `<td><b>${tot(me?.scores)}</b></td>` : ""}${showHR ? `<td><b>${tot(ev?.scores)}</b></td>` : ""}${showMgr && showHR && cal ? `<td><b>${cal.totalGap > 0 ? "+" : ""}${cal.totalGap}</b></td>` : ""}</tr>
    </tbody></table></div>`;
}
function justList(just) {
  const items = FACTORS.filter(f => (just?.[f.key] || "").trim());
  return items.length ? `<ul class="small" style="padding-left:18px">${items.map(f => `<li><b>${esc(L(f))}:</b> ${esc(just[f.key])}</li>`).join("")}</ul>` : "";
}
// Who may see which scores (blindness): manager sees HR scores only after approval; HR sees manager scores after scoring
function visibility(e) {
  const hrDone = scoreTotal(e.evaluation?.scores).complete;
  if (isMgr()) return { mgr:true, hr:e.status === "approved" };
  if (role() === "hr") return { mgr:hrDone || e.status === "approved", hr:true };
  return { mgr:true, hr:true };   // HR Director, Admin
}
function evaluationSectionHTML(e) {
  const me = e.managerEvaluation, ev = e.evaluation, vis = visibility(e), cal = calibration(me?.scores, ev?.scores), fa = e.finalApproval || (e.managerApproval?.decision && e.managerApproval.decision !== "pending" ? e.managerApproval : null);
  const parts = [];
  if (!me?.scores && !ev?.scores) return `<p class="muted">${t("noScores")}</p>`;
  parts.push(scoresTable(e, vis.mgr && !!me?.scores, vis.hr && !!ev?.scores));
  if (!vis.mgr && me?.scores) parts.push(`<p class="small muted">🔒 ${t("mgrHiddenUntil")}</p>`);
  if (!vis.hr && ev?.scores) parts.push(`<p class="small muted">🔒 ${t("hrHiddenUntil")}</p>`);
  const kv = [];
  if (vis.mgr && me?.scores) kv.push([t("mgrEvaluation"), `${esc(me.evaluatorName || "—")} · ${esc(me.date || "")} · ${pill(me.recommendedGrade)}`], ...(me.comments ? [[t("mgrComment"), esc(me.comments)]] : []));
  if (vis.hr && ev?.scores) {
    kv.push([t("hrEvaluation"), `${esc(ev.evaluatorName || "—")} · ${esc(ev.evaluationDate || "")}`], [t("recommended"), pill(ev.recommendedGrade)], [t("finalApproved"), pill(ev.finalGrade)]);
    if (ev.comments) kv.push([t("comments"), esc(ev.comments)]);
    if (cal && vis.mgr) kv.push([t("calibration"), cal.flagged ? `<span style="color:var(--warn)">⚠ ${esc(t("calFlag", { m:cal.maxGap, tg:cal.totalGap }))}</span>` : `✓ ${t("calOk")}`]);
    if (ev.calibrationNote) kv.push([t("calNote"), esc(ev.calibrationNote)]);
    if (ev.changedAfterReveal?.length) kv.push([t("changedAfterReveal"), `<span style="color:var(--warn)">${esc(ev.changedAfterReveal.map(k => L(FACTORS.find(f => f.key === k) || { en:k, az:k })).join(", "))}</span>`]);
  }
  kv.push([t("status"), badge(e.status)]);
  if (fa?.decision) kv.push([t("finalDecision"), `${esc(t("dec_" + fa.decision))}${fa.byName ? " · " + esc(fa.byName) : ""}${fa.date ? " · " + esc(fa.date) : ""}${fa.comment ? `<br><span class="small">${esc(fa.comment)}</span>` : ""}`]);
  parts.push(`<div class="kv" style="margin-top:14px">${kv.map(([k, v]) => `<div><div class="k">${k}</div><div class="v">${v}</div></div>`).join("")}</div>`);
  const js = [vis.mgr && me?.justifications && justList(me.justifications) ? `<p class="small" style="margin:12px 0 0"><b>${t("mgrJust")}</b></p>${justList(me.justifications)}` : "",
              vis.hr && ev?.justifications && justList(ev.justifications) ? `<p class="small" style="margin:12px 0 0"><b>${t("hrJust")}</b></p>${justList(ev.justifications)}` : ""].join("");
  return parts.join("") + js;
}

/* ---------- Final approval panel (HR Director / HR Manager) ---------- */
function directorPanelHTML(e) {
  const ev = e.evaluation || {}, cal = calibration(e.managerEvaluation?.scores, ev.scores);
  return `<section class="card no-print" id="dirPanel" style="margin-bottom:16px;border-color:var(--accent)">
    <div class="label-caps">${t("finalApproval")}</div><h2 style="margin:4px 0 6px">${t("dirPanelTitle")}</h2>
    <p>${esc(t("dirPanelText", { g:ev.finalGrade || "—" }))}</p>
    <p class="small muted">👁 ${t("nameHidden")}</p>
    ${scoresTable(e, !!e.managerEvaluation?.scores, true)}
    ${cal?.flagged ? `<div class="banner warn" style="margin-top:12px"><b>⚠ ${esc(t("calFlag", { m:cal.maxGap, tg:cal.totalGap }))}</b>${esc(ev.calibrationNote || "")}</div>` : ""}
    ${ev.changedAfterReveal?.length ? `<div class="banner warn"><b>${t("changedAfterReveal")}</b>${esc(ev.changedAfterReveal.map(k => L(FACTORS.find(f => f.key === k))).join(", "))}</div>` : ""}
    ${ev.comments ? `<p class="small"><b>${t("comments")}:</b> ${esc(ev.comments)}</p>` : ""}
    <div style="margin:12px 0">${consistencyHTML(e)}</div>
    <div class="field"><label for="dirComment">${t("dirComment")}</label><textarea id="dirComment"></textarea>
      <span class="hint">${t("tNeedComment")} — ${t("dirReturn")}</span></div>
    <div class="row" style="margin-top:12px">
      <button class="btn btn-primary" data-act="dirapprove" data-id="${esc(e.id)}">✓ ${t("dirApprove")}</button>
      <button class="btn btn-warn" data-act="dirreturn" data-id="${esc(e.id)}">${t("dirReturn")}</button></div></section>`;
}
async function directorDecide(id, decision) {
  const e = await loadOne(id); if (!e) return;
  const block = finalApproveBlock(e); if (block) { toast(t(block), "err"); return; }
  const comment = ($("#dirComment")?.value || "").trim();
  if (decision === "returned" && !comment) { toast(t("tNeedComment"), "err"); $("#dirComment")?.closest(".field")?.classList.add("invalid"); $("#dirComment")?.focus(); return; }
  const g = e.evaluation?.finalGrade;
  if (decision === "approved" && !(await confirmDlg(t("confirmMgrApprove", { g }), "", t("dirApprove")))) return;
  if (decision === "returned" && !(await confirmDlg(t("confirmTitle"), "", t("dirReturn")))) return;
  const upd = { status:decision === "approved" ? "approved" : "under_evaluation",
    finalApproval:{ decision, comment, byUid:S.user.uid, byName:S.profile?.displayName || S.user.email || "", date:today() },
    history:arrayUnion(histEntry(decision === "approved" ? "approved" : "returned_to_hr", decision === "approved" ? g : comment)),
    updatedAt:serverTimestamp(), updatedBy:S.user.uid };
  if (decision === "approved") { upd["position.currentGrade"] = g; upd["position.lastEvaluationDate"] = today(); }
  try {
    await updateDoc(doc(db, "employees", id), upd);
    const n = decision === "approved"
      ? await notify("approved", e, { roles:["manager"], dept:e.departmentId, uids:[e.evaluation?.evaluatorUid].filter(Boolean), grade:g })
      : await notify("approval_returned", e, { uids:[e.evaluation?.evaluatorUid].filter(Boolean), roles:e.evaluation?.evaluatorUid ? [] : ["hr"], comment });
    S.employees = null; toast((decision === "approved" ? t("tApproved") : t("tReturnedHR")) + mailNote(n), "ok"); render();
  } catch (err) { toast(errMsg(err), "err"); }
}

/* ---------- E-mail notifications (Outlook) via Firestore `mail` queue ---------- */
// The "Trigger Email from Firestore" extension (SMTP: smtp.office365.com) sends each queued document.
const MAIL_TEMPLATES = {
  evaluation_request:{ subject:"Qiymətləndirmə gözləyir: {{positionTitle}} ({{positionId}})",
    lead:"{{actorName}} vəzifə profilini və menecer qiymətləndirməsini HR-a göndərdi. Zəhmət olmasa, müstəqil qiymətləndirmənizi aparın.",
    leadEn:"A position profile and the manager's scores were sent to HR. Please complete your independent evaluation." },
  evaluation_returned:{ subject:"Düzəliş tələb olunur: {{positionTitle}} ({{positionId}})",
    lead:"HR vəzifə profilini düzəliş üçün qaytardı. Şərh: {{comment}}", leadEn:"HR returned the position profile for changes. Comment: {{comment}}" },
  approval_request:{ subject:"Yekun təsdiq gözləyir: {{positionTitle}} — {{grade}}",
    lead:"HR {{grade}} dərəcəsini təklif etdi. Yekun təsdiqiniz gözlənilir.", leadEn:"HR proposed grade {{grade}}. Your final approval is required." },
  approved:{ subject:"Təsdiqləndi: {{positionTitle}} — {{grade}}",
    lead:"Vəzifənin dərəcəsi {{grade}} olaraq təsdiqləndi ({{actorName}}).", leadEn:"The position's grade was approved as {{grade}}." },
  approval_returned:{ subject:"Yenidən baxış: {{positionTitle}} ({{positionId}})",
    lead:"HR direktoru təklifi yenidən baxış üçün qaytardı. Şərh: {{comment}}", leadEn:"The HR Director returned the proposal for review. Comment: {{comment}}" },
  profile_request:{ subject:"Vəzifə profili və qiymətləndirməniz gözlənilir: {{positionTitle}}",
    lead:"HR {{department}} üçün yeni vəzifə qaralaması yaratdı. Zəhmət olmasa profili tamamlayın, 9 faktoru ballayın və HR-a göndərin.",
    leadEn:"HR created a draft position for your department. Please complete the profile, score the 9 factors and send it to HR." }
};
function mailTemplateDoc(name) {
  const m = MAIL_TEMPLATES[name];
  const html = `<div style="font-family:Segoe UI,Arial,sans-serif;font-size:15px;color:#1B1F24;max-width:560px">
<div style="background:#14376F;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:700">GS · Dərəcələndirmə Sistemi</div>
<div style="border:1px solid #E3E8EF;border-top:0;padding:18px;border-radius:0 0 10px 10px">
<p>Hörmətli {{recipientName}},</p><p>${m.lead}</p>
<table style="font-size:14px;margin:12px 0"><tr><td style="color:#5B6672;padding-right:12px">Vəzifə</td><td><b>{{positionTitle}}</b></td></tr>
<tr><td style="color:#5B6672;padding-right:12px">Vəzifə ID</td><td>{{positionId}}</td></tr><tr><td style="color:#5B6672;padding-right:12px">Departament</td><td>{{department}}</td></tr>
{{#if grade}}<tr><td style="color:#5B6672;padding-right:12px">Dərəcə</td><td><b>{{grade}}</b></td></tr>{{/if}}</table>
<p><a href="{{link}}" style="display:inline-block;background:#14376F;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Sistemdə aç</a></p>
<p style="color:#5B6672;font-size:13px">${m.leadEn}</p></div></div>`;
  return { subject:m.subject, html, text:`${m.lead}\n{{positionTitle}} ({{positionId}}) — {{department}}\n{{link}}` };
}
const mailNote = n => n > 0 ? ` · ✉ ${t("mailQueued", { n })}` : "";
async function notify(name, e, o = {}) {
  try {
    const snap = await getDocs(collection(db, "directory"));
    const all = snap.docs.map(d => ({ id:d.id, ...d.data() })).filter(u => u.notifyEmail && u.role && u.role !== "pending");
    const pick = list => list.filter(u => u.id !== S.user.uid)
      .filter(u => (o.uids || []).includes(u.id) || ((o.roles || []).includes(u.role) && (u.role !== "manager" || !o.dept || u.departmentId === o.dept)))
      .filter(u => !normTxt(e.employeeEmail) || ![normTxt(u.notifyEmail), normTxt(u.email)].includes(normTxt(e.employeeEmail)));
    let recips = pick(all);
    if (!recips.length && o.fallback !== false) recips = all.filter(u => u.role === "admin" && u.id !== S.user.uid);
    const data = { positionTitle:e.position?.jobTitle || "", positionId:e.position?.positionId || "", department:deptName(e.departmentId || e.position?.department),
      grade:o.grade || e.evaluation?.finalGrade || "", actorName:S.profile?.displayName || S.user.email || "", comment:o.comment || "",
      link:`${location.origin}${location.pathname}#/positions/${e.id}`, appUrl:`${location.origin}${location.pathname}` };
    for (const u of recips) {
      await addDoc(collection(db, "mail"), { to:u.notifyEmail, toUid:u.id, template:{ name, data:{ ...data, recipientName:u.displayName || "" } },
        createdAt:serverTimestamp(), createdBy:S.user.uid, positionDocId:e.id || "" });
    }
    return recips.length;
  } catch (err) { console.warn("notify", err); return 0; }
}

// S7 — HR evaluation (independent & blind to the manager's scores until HR has scored)
async function scrEvaluate({ id, seq }) {
  if (!canHREvaluate()) { toast(t("tNoAccessEval"), "warn"); location.replace(`#/positions/${id}`); return null; }
  await loadEmployees();
  const e = await loadOne(id);
  if (seq !== renderSeq) return null;
  if (!e) { toast(t("tNotFound"), "err"); location.replace("#/positions"); return null; }
  if (isSelf(e)) { toast(t("conflictSelf"), "err"); location.replace(`#/positions/${id}`); return null; }
  const ev = clone(e.evaluation) || {};
  if (!S.evalState || S.evalState.id !== id) {
    const hrDone = scoreTotal(ev.scores).complete && ev.evaluatorUid === S.user.uid;
    S.evalState = { id, e, scores:{ ...(ev.scores || {}) }, just:{ ...(ev.justifications || {}) }, finalGrade:ev.finalGrade || "", finalTouched:!!ev.finalGrade,
      comments:ev.comments || "", calibrationNote:ev.calibrationNote || "", evaluationDate:ev.evaluationDate || today(),
      revealed:hrDone || !e.managerEvaluation?.scores, blind:ev.blindScores ? { ...ev.blindScores } : (hrDone ? { ...ev.scores } : null) };
  } else S.evalState.e = e;
  return evalHTML();
}
function evalHTML() {
  const es = S.evalState, e = es.e, p = e.position || {}, me = e.managerEvaluation;
  const st = scoreTotal(es.scores), rec = st.complete ? recommendGrade(st.total) : null, hints = profileHints(e);
  if (!es.finalTouched) es.finalGrade = rec || es.finalGrade || "";
  const differs = rec && es.finalGrade && es.finalGrade !== rec;
  const outRange = es.finalGrade && p.jobLevel && !inRange(es.finalGrade, p.jobLevel);
  const cal = es.revealed ? calibration(me?.scores, es.scores) : null;
  const fa = e.finalApproval;
  return `
  <div class="page-head"><div><div class="label-caps">${esc(L(SEC12))}</div><h1>${t("evaluate")}: ${esc(p.jobTitle)}</h1>
    <p class="sub">${esc(p.positionId || "")} · ${esc(deptName(e.departmentId))} · ${badge(e.status)}</p>
    <p class="small muted">👁 ${t("nameHidden")}</p></div></div>
  ${fa?.decision === "returned" && e.status === "under_evaluation" ? `<div class="banner warn"><b>${t("dirReturnedBanner")}${fa.byName ? " — " + esc(fa.byName) : ""}</b>${esc(fa.comment || "")}</div>` : ""}
  <div class="eval-layout">
    <aside class="summary"><div class="card sticky stack">
      <div><div class="label-caps">${t("profileSummary")}</div>
      <h3 style="margin-top:6px">${esc(p.jobTitle)}</h3>
      <div class="small muted">${esc(levelName(p.jobLevel))} · ${esc(p.positionId || "")}</div>
      <details style="margin-top:10px"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center">${esc(L(SECTIONS[1]))}</summary>
        <p class="small">${esc(e.purpose?.primaryPurpose || "—")}</p>
        <ul class="small" style="padding-left:18px">${allResps(e).map(r => `<li>${r.fixed ? "🔒 " : ""}${esc(r.task)}</li>`).join("")}</ul>
        <p class="small muted">${esc(fl(SECTIONS[3].fields[0]))}: ${esc(optLabel("education", e.knowledge?.minEducation) || "—")} · ${esc(e.knowledge?.experienceYears ?? "—")} ${S.lang === "en" ? "yrs" : "il"}</p>
        <p class="small muted">${esc(fl(SECTIONS[0].fields[9]))}: ${esc(p.directReports ?? 0)} · ${esc(fl(SECTIONS[0].fields[10]))}: ${esc(p.indirectReports ?? 0)}</p>
      </details>
      <a href="#/positions/${esc(e.id)}" class="small">${t("viewFull")} →</a></div>
      <div><div class="label-caps">${t("mgrEvaluation")}</div>
        ${!me?.scores ? `<p class="small muted">${t("noMgrScores")}</p>`
          : es.revealed ? `<p class="small">${esc(me.evaluatorName || "")} · <b>${scoreTotal(me.scores).total} / 45</b> · ${pill(me.recommendedGrade)}</p>${me.comments ? `<p class="small">${esc(me.comments)}</p>` : ""}${justList(me.justifications)}`
          : `<p class="small muted">🔒 ${t("blindInfo")}</p><button class="btn btn-secondary btn-block" data-act="evreveal" ${st.complete ? "" : "disabled"}>${t("revealMgr")}</button>`}
      </div></div></aside>
    <div class="factors">${factorCardsHTML({ target:"hr", scores:es.scores, just:es.just, hints, compare:es.revealed ? me?.scores : null, compareLabel:t("mgrScore") })}</div>
    <aside class="result"><div class="card sticky stack">
      <div><div class="label-caps">${t("totalScore")}</div><div class="big">${st.total}<span class="muted" style="font-size:16px"> / 45</span></div>
        <div class="small muted">${st.count} / 9 ${t("scored")}${es.revealed && me?.scores ? ` · ${t("mgrScore")}: ${scoreTotal(me.scores).total}` : ""}</div></div>
      <div><div class="label-caps">${t("recommended")}</div><div style="margin-top:6px">${rec ? `<span class="pill lg">${rec}</span>` : `<span class="small muted">${t("scoreAll")}</span>`}</div></div>
      <div><div class="label-caps">${t("suggestedForLevel")}</div><div><b>${rangeText(p.jobLevel)}</b> <span class="small muted">${esc(p.jobLevel ? L(LEVELS[p.jobLevel]) : "")}</span></div></div>
      ${cal ? `<div class="${cal.flagged ? "banner warn" : "banner info"}" style="margin:0"><b>${cal.flagged ? "⚠ " + esc(t("calFlag", { m:cal.maxGap, tg:cal.totalGap })) : "✓ " + t("calOk")}</b></div>
        ${cal.flagged ? `<div class="field ${!es.calibrationNote.trim() ? "invalid" : ""}"><label for="evCal">${t("calNote")} <span class="req">*</span></label><textarea id="evCal" data-ev="calibrationNote">${esc(es.calibrationNote)}</textarea><span class="hint">${t("calHint")}</span></div>` : ""}` : ""}
      <div class="field"><label for="evFinal">${t("finalApproved")}</label><select id="evFinal" data-ev="finalGrade">${gradeOptions(es.finalGrade, t("select"))}</select>
        ${outRange ? `<span class="hint" style="color:var(--warn)">⚠ ${t("outOfRange")}</span>` : ""}</div>
      ${consistencyHTML({ ...e, evaluation:{ ...(e.evaluation || {}), finalGrade:es.finalGrade } })}
      <div class="field ${differs && !es.comments.trim() ? "invalid" : ""}"><label for="evComments">${t("comments")}${differs ? ` <span class="req">*</span>` : ""}</label>
        <textarea id="evComments" data-ev="comments">${esc(es.comments)}</textarea>${differs ? `<span class="hint">${t("explainDiff")}</span>` : ""}</div>
      <div class="field"><label for="evDate">${t("evalDate")}</label><input type="date" id="evDate" data-ev="evaluationDate" value="${esc(es.evaluationDate)}"></div>
      <div class="field"><label for="evName">${t("evaluator")}</label><input type="text" id="evName" value="${esc(S.profile?.displayName || S.user?.email || "")}" disabled></div>
    </div></aside>
  </div>
  <div class="actionbar">
    <a class="btn btn-ghost" href="#/positions/${esc(e.id)}">${t("cancel")}</a>
    <button type="button" class="btn btn-warn" data-act="evreturn">${t("returnChanges")}</button>
    <button type="button" class="btn btn-secondary" data-act="evsave">${t("saveScores")}</button>
    <button type="button" class="btn btn-primary" data-act="evsend">${t("sendToDirector")}</button>
  </div>`;
}
function rerenderEval() {
  const y = window.scrollY, active = document.activeElement;
  const aid = active?.id, ds = active?.dataset?.score, dv = active?.dataset?.v;
  $("#main").innerHTML = evalHTML(); $$("textarea").forEach(autoGrow); window.scrollTo(0, y);
  const el = aid ? document.getElementById(aid) : ds ? $(`[data-score="${ds}"][data-target="hr"][data-v="${dv}"]`) : null;
  if (el) { el.focus({ preventScroll:true }); if (el.tagName === "TEXTAREA") el.setSelectionRange(el.value.length, el.value.length); }
}
function focusInvalid(id) { const el = document.getElementById(id); el?.closest(".field")?.classList.add("invalid"); el?.scrollIntoView({ block:"center" }); el?.focus({ preventScroll:true }); }
async function saveEval(mode) {
  const es = S.evalState, e = es.e, me = e.managerEvaluation;
  const st = scoreTotal(es.scores), rec = st.complete ? recommendGrade(st.total) : null, hints = profileHints(e);
  const differs = rec && es.finalGrade && es.finalGrade !== rec;
  const comment = es.comments.trim();
  const cal = calibration(me?.scores, es.scores);
  if (mode === "send") {
    if (!st.complete || !es.finalGrade) { toast(t("tNeedAll"), "err"); return; }
    const mj = missingJustifications(es.scores, es.just, hints);
    if (mj.length) { toast(t("tNeedJust"), "err"); focusInvalid(`just-hr-${mj[0]}`); return; }
    if (me?.scores && !es.revealed) { toast(t("tRevealFirst"), "err"); $("[data-act=evreveal]")?.focus(); return; }
    if (cal?.flagged && !es.calibrationNote.trim()) { toast(t("tNeedCal"), "err"); focusInvalid("evCal"); return; }
    if (differs && !comment) { toast(`${t("tNeedComment")} — ${t("explainDiff")}`, "err"); focusInvalid("evComments"); return; }
    if (!(await confirmDlg(t("confirmSendDir", { g:es.finalGrade }), "", t("sendToDirector")))) return;
  }
  if (mode === "return") {
    if (!comment) { toast(t("tNeedComment"), "err"); focusInvalid("evComments"); return; }
    if (!(await confirmDlg(t("confirmReturn"), "", t("returnChanges")))) return;
  }
  if (mode === "save" && differs && !comment) { toast(`${t("tNeedComment")} — ${t("explainDiff")}`, "err"); focusInvalid("evComments"); return; }
  const status = mode === "send" ? "director_approval" : mode === "return" ? "returned" : "under_evaluation";
  const scores = Object.fromEntries(FACTORS.filter(f => es.scores[f.key]).map(f => [f.key, Number(es.scores[f.key])]));
  const changed = es.blind ? FACTORS.filter(f => Number(es.blind[f.key]) !== Number(scores[f.key])).map(f => f.key) : [];
  const evaluation = {
    scores, totalScore:st.total, recommendedGrade:rec, finalGrade:es.finalGrade || "", comments:comment, approvalStatus:status,
    justifications:Object.fromEntries(Object.entries(es.just).filter(([, v]) => (v || "").trim())),
    calibrationNote:(es.calibrationNote || "").trim(), calibrationFlagged:!!cal?.flagged, maxGap:cal?.maxGap ?? null, totalGap:cal?.totalGap ?? null,
    blindScores:es.blind || null, changedAfterReveal:changed,
    evaluationDate:es.evaluationDate || today(), evaluatorName:S.profile?.displayName || S.user.email || "", evaluatorUid:S.user.uid
  };
  const action = mode === "send" ? "sent_to_director" : mode === "return" ? "returned_to_manager" : "hr_saved";
  const upd = { status, evaluation, updatedAt:serverTimestamp(), updatedBy:S.user.uid, profileChangedAfterApproval:null,
    history:arrayUnion(histEntry(action, mode === "return" ? comment : `${st.total}/45${es.finalGrade ? " · " + es.finalGrade : ""}${cal?.flagged ? " · ⚠" : ""}`)) };
  if (mode === "return") upd.returnComment = comment;
  $$(".actionbar .btn").forEach(b => b.disabled = true);
  try {
    await updateDoc(doc(db, "employees", e.id), upd);
    let n = 0;
    if (mode === "send") n = await notify("approval_request", e, { roles:["hr_director"], grade:es.finalGrade });
    if (mode === "return") n = await notify("evaluation_returned", e, { roles:["manager"], dept:e.departmentId, comment });
    S.employees = null; S.evalState = null;
    toast((mode === "send" ? t("tSentToDirector") : mode === "return" ? t("tReturned") : t("tSaved")) + mailNote(n), "ok");
    location.hash = `#/positions/${e.id}`;
  } catch (err) { toast(errMsg(err), "err"); $$(".actionbar .btn").forEach(b => b.disabled = false); }
}

// S8 — Library (read-only for everyone; Admin can edit: titles, levels, departments)
async function scrLibrary() {
  if (isAdmin()) await loadEmployees();
  const editing = !!S.libEdit;
  const chipsFrom = editing ? S.libEdit : DEPARTMENTS;
  return `<div class="page-head"><div><h1>${t("libTitle")}</h1><p class="sub">${t("libSub")}</p></div>
      ${isAdmin() && !editing ? `<button class="btn btn-secondary" data-act="libedit">✎ ${t("libEdit")}</button>` : ""}
      ${editing ? `<button class="btn btn-secondary" data-act="libadddept">${t("addDept")}</button>` : ""}</div>
    ${editing ? `<div class="banner info"><span class="small">${t("libEditHint")}</span></div>` : `
    <div class="card" style="padding:16px;margin-bottom:16px"><div class="field"><label for="libq">${t("search")}</label>
      <input id="libq" type="search" value="${esc(S.libQ)}" data-lib="q" autocomplete="off"></div></div>`}
    <div class="dept-chips" role="group" aria-label="${t("department")}">
      <button data-libdept="" aria-pressed="${!S.libDept}">${t("all")}</button>
      ${chipsFrom.filter(d => d.code).map(d => `<button data-libdept="${esc(d.code)}" aria-pressed="${S.libDept === d.code}">${esc(d.code)} · ${esc(L(d))}</button>`).join("")}</div>
    <div id="libResults"></div>
    ${editing ? `<div class="actionbar"><button class="btn btn-ghost" data-act="libcancel">${t("cancel")}</button>
      <button class="btn btn-primary" data-act="libsave">${t("libSave")}</button></div>` : ""}`;
}
function renderLib() {
  const box = $("#libResults"); if (!box) return;
  if (S.libEdit) { box.innerHTML = libEditHTML(); $$("#libResults textarea").forEach(autoGrow); return; }
  const q = S.libQ.trim().toLowerCase();
  const cards = DEPARTMENTS.filter(d => !S.libDept || d.code === S.libDept).map(d => {
    const deptHit = q && [d.en, d.az, d.code, d.descEn, d.descAz].join(" ").toLowerCase().includes(q);
    const titles = d.titles.filter(x => !q || deptHit || x.toLowerCase().includes(q));
    if (q && !titles.length) return "";
    return `<section class="card"><div class="label-caps">${esc(d.code)} · ${d.titles.length} ${t("titlesCount")}</div>
      <h2 style="margin:4px 0 2px">${esc(L(d))}</h2><div class="small muted" style="margin-bottom:8px">${esc(S.lang === "en" ? d.az : d.en)}</div>
      <p class="small">${esc(S.lang === "en" ? d.descEn : d.descAz)}</p>
      <ul class="titles">${titles.map(x => { const l = levelFor(x, d.code), has = !!S.jdt?.[jdId(d.code, x)]; return `<li><span class="n">${esc(x)}</span><span class="chip navy" title="${esc(L(LEVELS[l]))}">${l}</span><span class="chip">${rangeText(l)}</span>
        <a class="btn btn-ghost jd-link ${has ? "has" : ""}" href="#/library/jd/${encodeURIComponent(d.code)}/${encodeURIComponent(x)}" title="${esc(t("jdTemplate"))}">📄 ${t("jdOpen")}${has ? " ✓" : ""}</a></li>`; }).join("")}</ul></section>`;
  }).join("");
  box.innerHTML = cards ? `<div class="grid">${cards}</div>` : `<div class="card"><div class="empty"><p>${t("noResults")}</p></div></div>`;
}
// Job description template editor (#/library/jd/:dept/:title)
async function scrJd({ id:dept, id2:title }) {
  if (!DEPT[dept]) { location.replace("#/library"); return null; }
  if (!S.jdEdit || S.jdEdit.key !== jdId(dept, title)) {
    await loadJobTemplates();
    const jd = jdFor(dept, title);
    S.jdEdit = { key:jdId(dept, title), dept, title, custom:jd.custom, data:{ primaryPurpose:jd.primaryPurpose || "", mainObjectives:jd.mainObjectives || "",
      responsibilities:(jd.responsibilities?.length ? jd.responsibilities : [blankResp()]).map(r => ({ ...blankResp(), ...r })), knowledge:{ ...(jd.knowledge || {}) } } };
  }
  return jdHTML();
}
function jdHTML() {
  const j = S.jdEdit, d = j.data, ro = !canEditJd(j.dept), lvl = levelFor(j.title, j.dept);
  const P = SECTIONS[1].fields, R = SECTIONS[2].fields, K = SECTIONS[3].fields.filter(f => JD_REQ_FIELDS.includes(f[0]));
  return `<div class="no-print" style="margin-bottom:12px"><a href="#/library" class="small">← ${t("libTitle")}</a></div>
  <div class="page-head"><div><div class="label-caps">${t("jdTemplate")} · ${esc(j.dept)} · ${esc(deptName(j.dept))}</div><h1>${esc(j.title)}</h1>
    <p class="sub"><span class="chip navy">${esc(levelName(lvl))}</span> <span class="chip">${rangeText(lvl)}</span> <span class="chip">${j.custom ? t("jdCustom") : t("jdDefault")}</span></p></div></div>
  <div class="banner info"><span class="small">${ro ? t("jdReadOnlyHR") : t("jdIntro") + " " + t("jdFixedHint")}</span></div>
  <section class="card" style="margin-bottom:16px"><h2>${esc(L(SECTIONS[1]))}</h2><div class="fields">
    ${P.filter(f => ["primaryPurpose", "mainObjectives"].includes(f[0])).map(f => fieldHTML("jd." + f[0], f, d[f[0]], { disabled:ro })).join("")}</div></section>
  <section class="card" style="margin-bottom:16px"><h2>${esc(L(SECTIONS[2]))}</h2>
    ${d.responsibilities.map((r, i) => `<div class="resp ${r.fixed ? "std" : ""}" id="jdresp-${i}"><div class="resp-h"><span class="label-caps">${r.fixed ? "🔒 " : ""}${t("responsibility")} ${i + 1}</span>
      ${ro ? "" : `<button type="button" class="btn btn-danger" data-act="jddelresp" data-i="${i}" ${d.responsibilities.length <= 1 ? "disabled" : ""}>🗑 ${t("removeResp")}</button>`}</div>
      <div class="fields">${fieldHTML(`jd.responsibilities.${i}.fixed`, ["fixed", "Fixed standard (same for every position with this title)", "Sabit standart (bu adlı bütün vəzifələrdə eyni)", "yesno"], r.fixed === true, { disabled:ro, full:true })}
        ${R.map(f => fieldHTML(`jd.responsibilities.${i}.${f[0]}`, f, r[f[0]], { disabled:ro, full:f[0] === "task" })).join("")}</div></div>`).join("")}
    ${ro ? "" : `<button type="button" class="btn btn-secondary" data-act="jdaddresp" style="margin-top:12px">${t("addResp")}</button>`}</section>
  <section class="card"><h2>${t("jdReqs")}</h2><div class="fields">${K.map(f => fieldHTML("jd.knowledge." + f[0], f, d.knowledge[f[0]], { disabled:ro })).join("")}</div></section>
  ${ro ? "" : `<div class="actionbar">
    <a class="btn btn-ghost" href="#/library">${t("cancel")}</a>
    ${j.custom ? `<button type="button" class="btn btn-warn" data-act="jdreset">${t("jdReset")}</button>` : ""}
    <button type="button" class="btn btn-primary" data-act="jdsave">${t("jdSave")}</button></div>`}`;
}
function rerenderJd() { const y = window.scrollY; $("#main").innerHTML = jdHTML(); $$("textarea").forEach(autoGrow); window.scrollTo(0, y); }
async function saveJd(reset) {
  const j = S.jdEdit;
  try {
    if (reset) {
      if (!(await confirmDlg(t("jdReset") + "?"))) return;
      await deleteDoc(doc(db, "jobTemplates", j.key)); delete S.jdt[j.key]; S.jdEdit = null; toast(t("tJdReset"), "ok"); render(); return;
    }
    const d = j.data;
    const resp = d.responsibilities.filter(r => (r.task || "").trim()).map(r => Object.fromEntries(Object.entries({ ...blankResp(), ...r }).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])));
    resp.forEach(r => { r.fixed = r.fixed === true; });
    const fixedItems = resp.filter(r => r.fixed).map(({ fixed:_, ...r }) => r);
    const prev = S.jdt?.[j.key];
    const version = !prev ? 1 : JSON.stringify(prev.fixedItems || []) === JSON.stringify(fixedItems) ? (prev.version || 1) : (prev.version || 1) + 1;
    const knowledge = Object.fromEntries(JD_REQ_FIELDS.filter(k => d.knowledge[k] !== undefined && d.knowledge[k] !== "" && d.knowledge[k] !== null).map(k => [k, d.knowledge[k]]));
    const data = { dept:j.dept, title:j.title, primaryPurpose:(d.primaryPurpose || "").trim(), mainObjectives:(d.mainObjectives || "").trim(), responsibilities:resp, fixedItems, version, knowledge,
      updatedBy:S.user.uid, updatedByName:S.profile?.displayName || "", updatedAt:serverTimestamp() };
    await setDoc(doc(db, "jobTemplates", j.key), data);
    S.jdt[j.key] = data; S.jdEdit = null; toast(t("tJdSaved"), "ok"); location.hash = "#/library";
  } catch (e) { toast(errMsg(e), "err"); }
}
function startLibEdit() {
  S.libEdit = DEPARTMENTS.map(d => ({ code:d.code, en:d.en, az:d.az, descEn:d.descEn || "", descAz:d.descAz || "", isNew:false,
    rows:d.titles.map(n => ({ name:n, level:d.levels?.[n] || "" })) }));
  S.libDept = ""; render();
}
const deptUseCount = code => (S.employees || []).filter(e => e.departmentId === code).length;
function libEditHTML() {
  const E = S.libEdit;
  return `<div class="stack">${E.map((d, ci) => {
    if (S.libDept && d.code !== S.libDept && !d.isNew) return "";
    const used = d.isNew ? 0 : deptUseCount(d.code);
    return `<section class="card" id="lib-${ci}">
      <div class="row" style="justify-content:space-between;margin-bottom:12px"><span class="label-caps">${esc(d.code || "—")} · ${d.rows.length} ${t("titlesCount")}</span>
        <button class="btn btn-danger" data-act="libdeldept" data-ci="${ci}" ${used || d.rows.length ? "disabled" : ""}
          title="${used ? esc(t("deptInUse", { n:used })) : ""}">🗑 ${t("delDept")}</button></div>
      ${used && d.rows.length === 0 ? `<p class="small" style="color:var(--warn)">${esc(t("deptInUse", { n:used }))}</p>` : ""}
      <div class="fields">
        <div class="field"><label for="le-${ci}-code">${t("deptCode")}</label><input id="le-${ci}-code" type="text" maxlength="5" data-le="${ci}.code" value="${esc(d.code)}" ${d.isNew ? "" : "disabled"} style="text-transform:uppercase"></div>
        <div></div>
        <div class="field"><label for="le-${ci}-az">${t("nameAz")}</label><input id="le-${ci}-az" type="text" data-le="${ci}.az" value="${esc(d.az)}"></div>
        <div class="field"><label for="le-${ci}-en">${t("nameEn")}</label><input id="le-${ci}-en" type="text" data-le="${ci}.en" value="${esc(d.en)}"></div>
        <div class="field"><label for="le-${ci}-descAz">${t("descAzL")}</label><textarea id="le-${ci}-descAz" data-le="${ci}.descAz">${esc(d.descAz)}</textarea></div>
        <div class="field"><label for="le-${ci}-descEn">${t("descEnL")}</label><textarea id="le-${ci}-descEn" data-le="${ci}.descEn">${esc(d.descEn)}</textarea></div>
      </div>
      <div class="label-caps" style="margin:16px 0 4px">${t("titlesHead")}</div>
      <div class="lt-head small muted"><span>${t("titleName")}</span><span>${t("level")}</span><span>${t("department")}</span><span></span></div>
      ${d.rows.map((r, ti) => `<div class="lt-row">
        <input type="text" id="lt-${ci}-${ti}" aria-label="${t("titleName")}" data-lt="${ci}.${ti}" value="${esc(r.name)}">
        <select id="ll-${ci}-${ti}" aria-label="${t("level")}" data-ll="${ci}.${ti}"><option value="">${esc(t("levelAutoOpt", { l:suggestLevel(r.name) || "—" }))}</option>
          ${Object.keys(LEVELS).map(l => `<option value="${l}" ${r.level === l ? "selected" : ""}>${l} · ${esc(L(LEVELS[l]))}</option>`).join("")}</select>
        <select id="lm-${ci}-${ti}" aria-label="${t("department")}" data-lm="${ci}.${ti}">${E.map((x, xi) => x.code ? `<option value="${xi}" ${xi === ci ? "selected" : ""}>${esc(x.code)} · ${esc(L(x))}</option>` : "").join("")}</select>
        <button class="icon-btn" data-act="libdeltitle" data-ci="${ci}" data-ti="${ti}" aria-label="${t("delTitle")}: ${esc(r.name)}" title="${t("delTitle")}">🗑</button></div>`).join("")}
      <div class="row" style="margin-top:12px"><input type="text" id="lnew-${ci}" aria-label="${t("newTitle")}" placeholder="${t("newTitle")}" style="flex:1 1 220px;width:auto">
        <button class="btn btn-secondary" data-act="libaddtitle" data-ci="${ci}">${t("addTitle")}</button></div>
    </section>`; }).join("")}</div>`;
}
function rerenderLibEdit(focusId) {
  const y = window.scrollY; renderLib(); window.scrollTo(0, y);
  syncLibChips();
  if (focusId) document.getElementById(focusId)?.focus({ preventScroll:true });
}
// keep the department chips in sync with edited names/codes
function syncLibChips() {
  const chips = $(".dept-chips"); if (chips) chips.innerHTML = `<button data-libdept="" aria-pressed="${!S.libDept}">${t("all")}</button>` +
    S.libEdit.filter(d => d.code).map(d => `<button data-libdept="${esc(d.code)}" aria-pressed="${S.libDept === d.code}">${esc(d.code)} · ${esc(L(d))}</button>`).join("");
}
async function saveLibrary() {
  const E = S.libEdit, codes = new Set();
  for (const d of E) {
    d.code = (d.code || "").trim().toUpperCase();
    if (!/^[A-Z]{2,5}$/.test(d.code) || codes.has(d.code)) { toast(t("tCodeInvalid"), "err"); return; }
    codes.add(d.code);
    if (!(d.az || "").trim() || !(d.en || "").trim()) { toast(t("tNameRequired"), "err"); return; }
    const seen = new Set();
    for (const r of d.rows) { const n = r.name.trim(); if (!n) continue; if (seen.has(n.toLowerCase())) { toast(t("tDupTitle", { t:n }), "err"); return; } seen.add(n.toLowerCase()); }
  }
  const list = E.map((d, i) => {
    const rows = d.rows.map(r => ({ name:r.name.trim(), level:r.level })).filter(r => r.name);
    return { code:d.code, en:d.en.trim(), az:d.az.trim(), descEn:(d.descEn || "").trim(), descAz:(d.descAz || "").trim(), order:i,
      titles:rows.map(r => r.name), levels:Object.fromEntries(rows.filter(r => r.level).map(r => [r.name, r.level])) };
  });
  try {
    const batch = writeBatch(db);
    list.forEach(d => batch.set(doc(db, "departments", d.code), { ...d, updatedAt:serverTimestamp(), updatedBy:S.user.uid }));
    (S.libDocIds || new Set()).forEach(id => { if (!codes.has(id)) batch.delete(doc(db, "departments", id)); });
    $$(".actionbar .btn").forEach(b => b.disabled = true);
    await batch.commit();
    S.libDocIds = codes; applyLibrary(list); S.libEdit = null;
    toast(t("tLibSaved"), "ok"); render();
  } catch (e) { toast(errMsg(e), "err"); $$(".actionbar .btn").forEach(b => b.disabled = false); }
}
afterHooks.set(scrLibrary, renderLib);

// S9 — Reports
async function scrReports() {
  await loadEmployees(true);
  const a = S.repA, b = S.repB;
  return `<div class="page-head"><div><h1>${t("reportsTitle")}</h1><p class="sub">${t("reportsSub")}</p>${isMgr() ? `<p class="small muted">${t("myDeptOnly")}</p>` : ""}</div></div>
  <div class="grid">
    <section class="card stack"><div><h2>${t("repA")}</h2><p class="small muted">${t("repADesc")}</p></div>
      <div class="field"><label for="ra-d">${t("department")}</label><select id="ra-d" data-rep="A.dept">${deptOptions(a.dept)}</select></div>
      <div class="field"><label for="ra-s">${t("status")}</label><select id="ra-s" data-rep="A.status">${statusOptions(a.status)}</select></div>
      <div class="field"><label for="ra-g">${t("grade")}</label><select id="ra-g" data-rep="A.grade">${gradeOptions(a.grade)}</select></div>
      <p class="small muted" id="ra-n">${filterList(S.employees, a).length} ${t("rows")}</p>
      <div class="row"><button class="btn btn-secondary" data-act="exportA-pv">${t("previewBtn")}</button><button class="btn btn-primary" style="flex:1" data-act="exportA">${icon("export")} ${t("exportXlsx")}</button></div></section>
    <section class="card stack"><div><h2>${t("repB")}</h2><p class="small muted">${t("repBDesc")}</p></div>
      <div class="field"><label for="rb-d">${t("department")}</label><select id="rb-d" data-rep="B.dept">${deptOptions(b.dept)}</select></div>
      <div class="field"><label for="rb-s">${t("status")}</label><select id="rb-s" data-rep="B.status">${statusOptions(b.status)}</select></div>
      <p class="small muted" id="rb-n">${filterList(S.employees, b).length} ${t("rows")}</p>
      <div class="row"><button class="btn btn-secondary" data-act="exportB-pv">${t("previewBtn")}</button><button class="btn btn-primary" style="flex:1" data-act="exportB">${icon("export")} ${t("exportXlsx")}</button></div></section>
    <section class="card stack"><div><h2>${t("repC")}</h2><p class="small muted">${t("repCDesc")}</p></div>
      <a class="btn btn-secondary btn-block" href="#/positions">${t("goPositions")}</a></section>
  </div>
  ${isDirector() ? evaluatorStatsHTML(S.employees || []) : ""}`;
}

// (7) Evaluator statistics — who scores consistently higher / lower
function evaluatorStatsHTML(list) {
  const rows = {};
  const add = (name, type, sc, other, hints, flagged) => {
    if (!sc || !scoreTotal(sc).complete) return;
    const k = type + "|" + (name || "—"), r = rows[k] ??= { name:name || "—", type, n:0, tot:0, dev:0, devN:0, gap:0, gapN:0, flags:0 };
    r.n++; r.tot += scoreTotal(sc).total;
    FACTORS.forEach(f => { if (hints[f.key]) { r.dev += Number(sc[f.key]) - hints[f.key]; r.devN++; } });
    if (other && scoreTotal(other).complete) { r.gap += scoreTotal(sc).total - scoreTotal(other).total; r.gapN++; }
    if (flagged) r.flags++;
  };
  list.forEach(e => {
    const h = profileHints(e), cal = calibration(e.managerEvaluation?.scores, e.evaluation?.scores);
    add(e.managerEvaluation?.evaluatorName, "mgr", e.managerEvaluation?.scores, e.evaluation?.scores, h, cal?.flagged);
    add(e.evaluation?.evaluatorName, "hr", e.evaluation?.scores, e.managerEvaluation?.scores, h, cal?.flagged);
  });
  const fmt = x => (x > 0 ? "+" : "") + x.toFixed(1);
  const data = Object.values(rows).sort((a, b) => b.n - a.n);
  return `<section class="card" style="margin-top:16px"><h2>${t("evalStats")}</h2><p class="small muted">${t("evalStatsDesc")}</p>
    ${data.length ? `<div class="table-wrap-always"><table class="tbl cmp"><thead><tr><th>${t("stEvaluator")}</th><th>${t("stType")}</th><th>${t("stCount")}</th><th>${t("stAvg")}</th><th>${t("stDev")}</th><th>${t("stGap")}</th><th>${t("stFlag")}</th></tr></thead><tbody>
    ${data.map(r => { const dev = r.devN ? r.dev / r.devN : 0, gap = r.gapN ? r.gap / r.gapN : 0;
      return `<tr><td>${esc(r.name)}</td><td>${r.type === "mgr" ? t("mgrScore") : "HR"}</td><td>${r.n}</td><td>${(r.tot / r.n).toFixed(1)}</td>
      <td class="${Math.abs(dev) >= 0.75 ? "gapwarn" : ""}">${r.devN ? fmt(dev) + "/" + (S.lang === "en" ? "factor" : "faktor") : "—"}</td><td class="${Math.abs(gap) >= 3 ? "gapwarn" : ""}">${r.gapN ? fmt(gap) : "—"}</td><td>${r.flags}</td></tr>`; }).join("")}
    </tbody></table></div>` : `<p class="muted">${t("noScores")}</p>`}</section>`;
}

// S10 — Admin → Users
async function scrAdmin() {
  const snap = await getDocs(collection(db, "users"));
  S.users = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
  await syncDirectory(S.users);
  let mails = [];
  try { mails = (await getDocs(collection(db, "mail"))).docs.map(d => ({ id:d.id, ...d.data() })).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)); } catch (e) { console.warn(e); }
  const managed = new Set(S.users.filter(u => u.role === "manager" && u.departmentId).map(u => u.departmentId));
  const noMgr = DEPARTMENTS.filter(d => !managed.has(d.code));
  return `<div class="page-head"><div><h1>${t("usersTitle")}</h1><p class="sub">${t("usersSub")}</p></div></div>
  ${noMgr.length ? `<div class="banner warn"><b>${t("deptsNoManager")}</b><span class="small">${noMgr.map(d => esc(`${d.code} · ${L(d)}`)).join(", ")}</span></div>` : ""}
  <section class="card" style="margin-bottom:16px"><div class="rows">${S.users.map(u => {
    const me = u.id === S.user.uid;
    const initials = (u.displayName || u.email || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    const needDept = u.role === "manager" && !u.departmentId;
    return `<div class="urow">
      ${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : `<span class="avatar">${esc(initials)}</span>`}
      <div class="who"><b>${esc(u.displayName || "—")}${me ? ` <span class="chip navy">${t("you")}</span>` : ""}</b><span>${esc(u.email)}</span></div>
      <div class="field sel"><label for="ur-${esc(u.id)}" class="small">${t("role")}</label>
        <select id="ur-${esc(u.id)}" data-urole="${esc(u.id)}" ${me ? `disabled title="${esc(t("cannotOwnRole"))}"` : ""}>${Object.keys(ROLES).map(r => `<option value="${r}" ${u.role === r ? "selected" : ""}>${esc(L(ROLES[r]))}</option>`).join("")}</select>
        ${me ? `<span class="hint">${t("cannotOwnRole")}</span>` : ""}</div>
      <div class="field sel ${needDept ? "invalid" : ""}"><label for="ud-${esc(u.id)}" class="small">${t("department")}</label>
        <select id="ud-${esc(u.id)}" data-udept="${esc(u.id)}"><option value="">${t("noDept")}</option>${DEPARTMENTS.map(d => `<option value="${d.code}" ${u.departmentId === d.code ? "selected" : ""}>${esc(d.code)} · ${esc(L(d))}</option>`).join("")}</select>
        ${needDept ? `<span class="hint" style="color:var(--danger)">${t("deptRequired")}</span>` : ""}</div>
      <div class="field sel"><label for="un-${esc(u.id)}" class="small">${t("notifyEmail")}</label>
        <input type="text" inputmode="email" id="un-${esc(u.id)}" data-unotify="${esc(u.id)}" value="${esc(u.notifyEmail || u.email || "")}"></div>
      <div class="last small muted">${t("lastSignIn")}<br>${esc(fmtDate(u.lastLogin) || "—")}</div></div>`;
  }).join("")}</div></section>
  <section class="card" style="margin-bottom:16px"><h2>${t("mailTitle")}</h2><p class="small muted">${t("mailDesc")}</p>
    <button class="btn btn-secondary" data-act="mailtpl">${t("mailInstall")}</button>
    ${mails.length ? `<div class="table-wrap-always" style="margin-top:12px"><table class="tbl cmp"><thead><tr><th>${t("mailDate")}</th><th>${t("mailTo")}</th><th>${t("mailTpl")}</th><th>${t("mailState")}</th></tr></thead><tbody>
      ${mails.slice(0, 20).map(m => `<tr><td class="small">${esc(fmtDate(m.createdAt))}</td><td class="small">${esc(m.to)}</td><td class="small">${esc(m.template?.name || "")}</td>
      <td class="small">${m.delivery?.state ? esc(m.delivery.state) + (m.delivery.error ? " — " + esc(m.delivery.error) : "") : `<span class="muted">${t("mailPending")}</span>`}</td></tr>`).join("")}</tbody></table></div>`
      : `<p class="small muted" style="margin-top:12px">${t("mailNone")}</p>`}</section>
  <section class="card"><h2>${t("sampleTitle")}</h2><p class="muted">${t("sampleDesc")}</p>
    <button class="btn btn-secondary" data-act="sample">${t("loadSample")}</button></section>`;
}
// Directory = the part of each user that others need for routing e-mails (role, department, Outlook address)
const dirEntry = u => ({ uid:u.id || u.uid, displayName:u.displayName || "", email:u.email || "", notifyEmail:(u.notifyEmail || u.email || "").trim(), role:u.role || "pending", departmentId:u.departmentId || null });
async function syncDirectory(users) {
  try {
    const cur = Object.fromEntries((await getDocs(collection(db, "directory"))).docs.map(d => [d.id, d.data()]));
    for (const u of users) {
      const want = dirEntry(u), have = cur[want.uid];
      if (!have || ["displayName", "email", "notifyEmail", "role", "departmentId"].some(k => (have[k] ?? null) !== (want[k] ?? null))) await setDoc(doc(db, "directory", want.uid), want);
    }
  } catch (e) { console.warn("directory", e); }
}
async function installMailTemplates() {
  try {
    const b = writeBatch(db);
    Object.keys(MAIL_TEMPLATES).forEach(n => b.set(doc(db, "mailTemplates", n), mailTemplateDoc(n)));
    await b.commit(); toast(t("tTemplates"), "ok");
  } catch (e) { toast(errMsg(e), "err"); }
}
async function saveUser(uid, changes) {
  try {
    if ("notifyEmail" in changes) { const v = changes.notifyEmail.trim(); if (v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast(t("tBadEmail"), "err"); return; } changes.notifyEmail = v; }
    await updateDoc(doc(db, "users", uid), changes);
    const u = S.users?.find(x => x.id === uid); if (u) Object.assign(u, changes);
    if (u) await setDoc(doc(db, "directory", uid), dirEntry(u));
    toast(t("tSaved"), "ok");
    if (u && u.role === "manager" && !u.departmentId) toast(t("deptRequired"), "warn");
    render();
  } catch (e) { toast(errMsg(e), "err"); render(); }
}
async function loadSample() {
  if (!isAdmin()) { toast(t("tAdminOnly"), "warn"); return; }
  if (!(await confirmDlg(t("confirmSample"), t("sampleDesc"), t("loadSample")))) return;
  try {
    const list = await loadEmployees(true);
    const codes = new Set(list.map(e => (e.employeeCode || "").trim()));
    let added = 0, skipped = 0;
    for (const rec of sampleRecords()) {
      if (codes.has(rec.employeeCode)) { skipped++; continue; }
      await addDoc(collection(db, "employees"), { ...clone(rec), createdBy:S.user.uid, updatedBy:S.user.uid, createdAt:serverTimestamp(), updatedAt:serverTimestamp() });
      codes.add(rec.employeeCode); added++;
    }
    S.employees = null;
    toast(t("tSampleAdded", { n:added, s:skipped }), "ok");
    render();
  } catch (e) { toast(errMsg(e), "err"); }
}

/* =====================================================================
   11) Excel export (SheetJS) — Reports A, B, C
   ===================================================================== */
function xlsxReady() { if (!window.XLSX) { toast(t("tXlsxMissing"), "warn"); return false; } return true; }
function makeSheet(rows, headers) {
  const ws = XLSX.utils.json_to_sheet(rows, { header:headers });
  ws["!freeze"] = { xSplit:0, ySplit:1, topLeftCell:"A2", activePane:"bottomLeft", state:"frozen" };
  ws["!views"] = [{ state:"frozen", ySplit:1, xSplit:0, topLeftCell:"A2" }];
  ws["!cols"] = headers.map(h => ({ wch: Math.min(60, Math.max(String(h).length, ...rows.map(r => String(r[h] ?? "").split("\n")[0].length)) + 2) }));
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s:{ r:0, c:0 }, e:{ r:Math.max(rows.length, 1), c:headers.length - 1 } }) };
  return ws;
}
const xv = (def, v) => { const s = valueText(def, v); return s === undefined || s === null ? "" : (typeof v === "number" && def[3] === "number" ? v : s); };
function uniqHeader(used, h) { let x = h, i = 2; while (used.has(x)) x = `${h} (${i++})`; used.add(x); return x; }
function scopeList(list) { return isMgr() ? list.filter(e => e.departmentId === myDept()) : list; }
const stamp = () => today();
// File names: transliterate Azerbaijani letters (some browsers drop non-ASCII download names); file contents keep them.
const TRANSLIT = { "ə":"e","Ə":"E","ş":"s","Ş":"S","ç":"c","Ç":"C","ğ":"g","Ğ":"G","ı":"i","İ":"I","ö":"o","Ö":"O","ü":"u","Ü":"U" };
function sanitizeFile(s) { return String(s || "").replace(/[əƏşŞçÇğĞıİöÖüÜ]/g, c => TRANSLIT[c]).normalize("NFKD").replace(/[^\x20-\x7E]/g, "").replace(/[\\/:*?"<>|]+/g, "").trim() || "position"; }
const H = (en, az) => S.lang === "en" ? en : az;

function finishExport(wb, name, preview) {
  if (!preview) { XLSX.writeFile(wb, name); toast(t("tExported"), "ok"); return; }
  $("#pv")?.remove();
  const ov = document.createElement("div"); ov.className = "pv"; ov.id = "pv";
  ov.innerHTML = `<div class="pv-box" role="dialog" aria-modal="true" aria-label="${esc(name)}">
    <div class="pv-h"><div style="min-width:0"><div class="label-caps">${t("preview")}</div><b class="pv-name">${esc(name)}</b></div>
      <div class="row"><button class="btn btn-primary" data-act="pvdl">⤓ ${t("download")}</button><button class="btn btn-ghost" data-act="pvclose">${t("close")}</button></div></div>
    <div class="pv-tabs" role="tablist">${wb.SheetNames.map((n, i) => `<button role="tab" data-pvtab="${i}" aria-pressed="${i === 0}">${esc(n)}</button>`).join("")}</div>
    <div class="pv-body" id="pvBody"></div></div>`;
  document.body.appendChild(ov); S.pv = { wb, name }; pvShow(0); ov.querySelector("[data-act=pvdl]").focus();
}
function pvShow(i) {
  if (!S.pv) return;
  const ws = S.pv.wb.Sheets[S.pv.wb.SheetNames[i]];
  $("#pvBody").innerHTML = XLSX.utils.sheet_to_html(ws, { header:"", footer:"" });
  $("#pvBody table")?.classList.add("pv-table");
  $$("[data-pvtab]").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.pvtab) === i)));
}
function exportA(filters, preview) {
  if (!xlsxReady()) return;
  const list = sortByUpdated(filterList(scopeList(S.employees || []), filters));
  const c = { code:fl(TOP_FIELDS[0]), name:fl(TOP_FIELDS[1]), pid:fl(SECTIONS[0].fields[5]), title:fl(SECTIONS[0].fields[1]), dept:fl(SECTIONS[0].fields[0]),
    level:fl(SECTIONS[0].fields[4]), cur:fl(SECTIONS[0].fields[3]), total:H("Total Score","Ümumi bal"), rec:H("Recommended Grade","Tövsiyə olunan dərəcə"),
    fin:H("Final Grade","Yekun dərəcə"), st:t("status"), date:H("Evaluation Date","Qiymətləndirmə tarixi"), ev:H("Evaluator","Qiymətləndirici") };
  const fh = FACTORS.map(f => L(f));
  const headers = [c.code, c.name, c.pid, c.title, c.dept, c.level, c.cur, ...fh, H("Manager Total","Menecer cəmi"), c.total, H("Gap (HR − Manager)","Fərq (HR − Menecer)"), H("Calibration flag","Kalibrasiya"), c.rec, c.fin, t("fitTitle"), t("personalGrade"), c.st, c.date, c.ev];
  const rows = list.map(e => {
    const ev = e.evaluation || {}, p = e.position || {};
    const r = { [c.code]:e.employeeCode || "", [c.name]:e.fullName || "", [c.pid]:p.positionId || "", [c.title]:p.jobTitle || "", [c.dept]:deptName(e.departmentId),
      [c.level]:levelName(p.jobLevel), [c.cur]:p.currentGrade || "" };
    FACTORS.forEach((f, i) => r[fh[i]] = ev.scores?.[f.key] ?? "");
    const st = scoreTotal(ev.scores);
    const ms = e.managerEvaluation?.scores, cal = calibration(ms, ev.scores);
    r[H("Manager Total","Menecer cəmi")] = ms && scoreTotal(ms).complete ? scoreTotal(ms).total : "";
    r[H("Gap (HR − Manager)","Fərq (HR − Menecer)")] = cal ? cal.totalGap : "";
    r[H("Calibration flag","Kalibrasiya")] = cal ? (cal.flagged ? H("Yes","Bəli") : H("No","Xeyr")) : "";
    const pf = personalFit(e); r[t("fitTitle")] = pf.state === "unknown" ? "" : t("fit_" + pf.state); r[t("personalGrade")] = personalGradeOf(e) || "";
    Object.assign(r, { [c.total]:ev.scores ? (ev.totalScore ?? st.total) : "", [c.rec]:ev.recommendedGrade || "", [c.fin]:ev.finalGrade || "", [c.st]:statusLabel(e.status),
      [c.date]:ev.evaluationDate || "", [c.ev]:ev.evaluatorName || "" });
    return r;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(rows, headers), t("sheetSummary"));
  finishExport(wb, `grading-summary-${stamp()}.xlsx`, preview);
}
function positionRow(e) {
  const used = new Set(), r = {}, headers = [];
  const put = (h, v) => { const k = uniqHeader(used, h); headers.push(k); r[k] = v ?? ""; };
  TOP_FIELDS.forEach(f => put(fl(f), xv(f, e[f[0]])));
  put(t("status"), statusLabel(e.status));
  SECTIONS.filter(s => s.n !== 3).forEach(s => s.fields.forEach(f => put(fl(f), xv(f, e[s.key]?.[f[0]]))));
  QUAL.fields.forEach(f => put(`${t("actual")}: ${fl(f)}`, xv(f, e.qualifications?.[f[0]])));
  put(t("personalGrade"), personalGradeOf(e) || "");
  put(H("HR Comment","HR şərhi"), e.returnComment || "");
  put(H("Updated","Yenilənib"), fmtDate(e.updatedAt));
  return { r, headers };
}
function respRows(e) {
  return allResps(e).map((x, i) => {
    const o = { [fl(SECTIONS[0].fields[5])]:e.position?.positionId || "", [fl(TOP_FIELDS[0])]:e.employeeCode || "", [t("no_")]:i + 1, [t("stdCol")]:x.fixed ? t("yes") : t("no") };
    SECTIONS[2].fields.forEach(f => o[fl(f)] = xv(f, x[f[0]]));
    o[t("kpiExtra")] = x.kpisExtra || "";
    return o;
  });
}
const respHeaders = () => [fl(SECTIONS[0].fields[5]), fl(TOP_FIELDS[0]), t("no_"), t("stdCol"), ...SECTIONS[2].fields.map(fl), t("kpiExtra")];
function evalRow(e) {
  const ev = e.evaluation || {};
  const o = { [fl(SECTIONS[0].fields[5])]:e.position?.positionId || "", [fl(TOP_FIELDS[0])]:e.employeeCode || "", [fl(TOP_FIELDS[1])]:e.fullName || "" };
  EVAL_FIELDS.forEach(f => { const v = getP(ev, f[0]); o[fl(f)] = f[3] === "status" ? (e.evaluation ? statusLabel(e.status) : "") : (v ?? ""); });
  const fa = e.finalApproval || {}, me = e.managerEvaluation || {}, cal = calibration(me.scores, ev.scores);
  FACTORS.forEach(f => o[`${t("mgrScore")}: ${L(f)}`] = me.scores?.[f.key] ?? "");
  o[t("mgrEvaluation")] = me.scores ? scoreTotal(me.scores).total : ""; o[`${t("mgrScore")} — ${t("evaluator")}`] = me.evaluatorName || "";
  o[t("calibration")] = cal ? (cal.flagged ? t("yes") : t("no")) : ""; o[t("calNote")] = ev.calibrationNote || "";
  o[t("finalDecision")] = fa.decision ? t("dec_" + fa.decision) : ""; o[t("finalApproval")] = fa.byName || ""; o[t("mgrDate")] = fa.date || ""; o[t("dirComment")] = fa.comment || "";
  return o;
}
const evalHeaders = () => [fl(SECTIONS[0].fields[5]), fl(TOP_FIELDS[0]), fl(TOP_FIELDS[1]), ...EVAL_FIELDS.map(fl), ...FACTORS.map(f => `${t("mgrScore")}: ${L(f)}`), t("mgrEvaluation"), `${t("mgrScore")} — ${t("evaluator")}`, t("calibration"), t("calNote"), t("finalDecision"), t("finalApproval"), t("mgrDate"), t("dirComment")];
function exportB(filters, preview) {
  if (!xlsxReady()) return;
  const list = sortByUpdated(filterList(scopeList(S.employees || []), filters));
  const pos = list.map(positionRow);
  const headers = pos[0]?.headers || positionRow(blankEmployee()).headers;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(pos.map(x => x.r), headers), t("sheetPositions"));
  XLSX.utils.book_append_sheet(wb, makeSheet(list.flatMap(respRows), respHeaders()), t("sheetResp"));
  XLSX.utils.book_append_sheet(wb, makeSheet(list.map(evalRow), evalHeaders()), t("sheetEval"));
  finishExport(wb, `job-profiles-${stamp()}.xlsx`, preview);
}
async function exportC(id, preview) {
  if (!xlsxReady()) return;
  const e = await loadOne(id); if (!e) return;
  const [cs, cf, cv] = [t("colSection"), t("colField"), t("colValue")];
  const rows = [];
  const add = (sec, f, v) => rows.push({ [cs]:sec, [cf]:f, [cv]:v ?? "" });
  TOP_FIELDS.forEach(f => add(t("general"), fl(f), xv(f, e[f[0]])));
  add(t("general"), t("status"), statusLabel(e.status));
  if (e.returnComment) add(t("general"), t("hrComment"), e.returnComment);
  SECTIONS.forEach(s => {
    const sec = `${s.n}. ${L(s)}`;
    if (s.n === 3) { allResps(e).forEach((r, i) => add(sec, `${r.fixed ? "🔒 " : ""}${t("responsibility")} ${i + 1}`, `${r.task || ""} (${optLabel("freq", r.frequency)}, ${optLabel("respLevel", r.level)})`)); return; }
    if (s.n === 9 && !(Number(e.position?.directReports) > 0)) { add(sec, "—", t("notApplicable")); return; }
    s.fields.forEach(f => add(sec, fl(f), xv(f, e[s.key]?.[f[0]])));
  });
  QUAL.fields.forEach(f => add(`13. ${L(QUAL)}`, fl(f), xv(f, e.qualifications?.[f[0]])));
  { const pf = personalFit(e); add(`13. ${L(QUAL)}`, t("fitTitle"), pf.state === "unknown" ? "" : t("fit_" + pf.state)); add(`13. ${L(QUAL)}`, t("personalGrade"), personalGradeOf(e)); }
  const sec12 = `12. ${L(SEC12)}`;
  EVAL_FIELDS.forEach(f => { const v = getP(e.evaluation || {}, f[0]); add(sec12, fl(f), f[3] === "status" ? (e.evaluation ? statusLabel(e.status) : "") : v); });
  const me = e.managerEvaluation || {}, fa = e.finalApproval || {};
  const s12a = `12A. ${t("mgrEvaluation")}`;
  FACTORS.forEach(f => add(s12a, L(f), me.scores?.[f.key] ?? ""));
  if (me.scores) { add(s12a, t("totalScore"), scoreTotal(me.scores).total); add(s12a, t("evaluator"), me.evaluatorName); add(s12a, t("mgrComment"), me.comments); }
  if (e.evaluation?.calibrationNote) add(sec12, t("calNote"), e.evaluation.calibrationNote);
  if (fa.decision) { add(sec12, t("finalDecision"), t("dec_" + fa.decision)); add(sec12, t("finalApproval"), fa.byName); add(sec12, t("mgrDate"), fa.date); add(sec12, t("dirComment"), fa.comment); }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(rows, [cs, cf, cv]), t("sheetJD"));
  const rh = [t("no_"), t("stdCol"), ...SECTIONS[2].fields.map(fl), t("kpiExtra")];
  XLSX.utils.book_append_sheet(wb, makeSheet(allResps(e).map((r, i) => {
    const o = { [t("no_")]:i + 1, [t("stdCol")]:r.fixed ? t("yes") : t("no") }; SECTIONS[2].fields.forEach(f => o[fl(f)] = xv(f, r[f[0]])); o[t("kpiExtra")] = r.kpisExtra || ""; return o; }), rh), t("sheetResp"));
  const hh = [t("mailDate"), t("history"), t("evaluator"), t("dirComment")];
  XLSX.utils.book_append_sheet(wb, makeSheet((e.history || []).map(x => ({ [hh[0]]:String(x.at || "").replace("T", " ").slice(0, 16), [hh[1]]:t("h_" + x.action), [hh[2]]:x.byName || "", [hh[3]]:x.note || "" })), hh), t("history"));
  finishExport(wb, `${sanitizeFile(e.position?.positionId)}-${sanitizeFile(e.fullName)}.xlsx`, preview);
}

/* =====================================================================
   12) Global event delegation
   ===================================================================== */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-act],[data-go],[data-chip],[data-acc],[data-delresp],[data-score],[data-sort],[data-libdept],[data-pvtab]");
  if (!ev.target.closest(".user-menu")) $("#userPop")?.setAttribute("hidden", "");
  if (!el) return;
  if (el.dataset.go) { location.hash = el.dataset.go; return; }
  if (el.dataset.acc) {
    const n = isNaN(el.dataset.acc) ? el.dataset.acc : Number(el.dataset.acc), sec = el.closest(".acc"), body = sec.querySelector(".acc-b");
    const open = !S.open.has(n); open ? S.open.add(n) : S.open.delete(n);
    sec.classList.toggle("open", open); el.setAttribute("aria-expanded", open); body.hidden = !open;
    if (open) body.querySelectorAll("textarea").forEach(autoGrow);
    return;
  }
  if (el.dataset.chip && el.dataset.chip.startsWith("jd.") && S.jdEdit) {
    const path = el.dataset.chip.slice(3), v = el.dataset.v, cur = getP(S.jdEdit.data, path);
    setP(S.jdEdit.data, path, cur === v ? "" : v);
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === getP(S.jdEdit.data, path)));
    return;
  }
  if (el.dataset.chip && S.form) {
    const path = el.dataset.chip, v = el.dataset.v;
    const cur = getP(S.form.data, path); setP(S.form.data, path, cur === v ? "" : v); S.dirty = true;
    el.parentElement.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === getP(S.form.data, path)));
    el.closest(".field")?.classList.remove("invalid");
    refreshFormBits(); return;
  }
  if (el.dataset.delresp !== undefined && S.form) {
    const i = Number(el.dataset.delresp);
    if (S.form.data.responsibilities.length <= 1) return;
    S.form.data.responsibilities.splice(i, 1); S.dirty = true; rerenderForm(); return;
  }
  if (el.dataset.score) {
    const k = el.dataset.score, v = Number(el.dataset.v);
    const target = el.dataset.target === "mgr" ? S.form?.data?.managerEvaluation?.scores : S.evalState?.scores;
    if (!target) return;
    if (Number(target[k]) === v) delete target[k]; else target[k] = v;
    if (el.dataset.target === "mgr") { S.dirty = true; rerenderForm(); } else rerenderEval();
    return;
  }
  if (el.dataset.sort) { const k = el.dataset.sort; S.sort = { key:k, dir:S.sort.key === k ? -S.sort.dir : 1 }; renderPosResults(); return; }
  if (el.dataset.pvtab !== undefined) { pvShow(Number(el.dataset.pvtab)); return; }
  if (el.dataset.libdept !== undefined) { S.libDept = el.dataset.libdept; $$("[data-libdept]").forEach(b => b.setAttribute("aria-pressed", b.dataset.libdept === S.libDept)); renderLib(); return; }
  const act = el.dataset.act;
  switch (act) {
    case "lang": setLang(el.dataset.v); break;
    case "theme": toggleTheme(); break;
    case "drawer": openDrawer(); break;
    case "drawerclose": closeDrawer(); break;
    case "usermenu": { const p = $("#userPop"); const open = p.hidden; p.hidden = !open; el.setAttribute("aria-expanded", open); break; }
    case "signin": signIn(); break;
    case "signout": ev.preventDefault(); doSignOut(); break;
    case "reload": render(); break;
    case "refreshProfile": try { await ensureProfile(S.user); S.employees = null; if (role() !== "pending") location.hash = "#/dashboard"; else { toast(t("pendingText")); } render(); } catch (e) { toast(errMsg(e), "err"); } break;
    case "view": S.view = el.dataset.v; store.set("view", S.view); $$("[data-act=view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === S.view)); renderPosResults(); break;
    case "exportA-list": exportA(S.filters); break;
    case "exportA": exportA(S.repA); break;
    case "exportB": exportB(S.repB); break;
    case "exportC": exportC(el.dataset.id); break;
    case "print": window.print(); break;
    case "sample": loadSample(); break;
    case "delete":
      if (await confirmDlg(t("confirmTitle"), t("confirmDelete"), t("del"))) {
        try { await deleteDoc(doc(db, "employees", el.dataset.id)); S.employees = null; toast(t("tDeleted"), "ok"); location.hash = "#/positions"; } catch (e) { toast(errMsg(e), "err"); }
      } break;
    case "addresp": S.form.data.responsibilities.push(blankResp()); S.dirty = true; rerenderForm();
      setTimeout(() => { const i = S.form.data.responsibilities.length - 1; document.getElementById(fid(`responsibilities.${i}.task`))?.focus(); }, 0); break;
    case "formcancel": {
      if (S.dirty && !(await confirmDlg(t("confirmLeave")))) break;
      const id = S.form?.id; S.form = null; S.dirty = false; location.hash = id ? `#/positions/${id}` : "#/positions"; break;
    }
    case "savedraft": saveForm(false); break;
    case "submitform": saveForm(true); break;
    case "evsave": saveEval("save"); break;
    case "evsend": saveEval("send"); break;
    case "libedit": startLibEdit(); break;
    case "sharelink": copyShareLink(); break;
    case "demoreset": if (await confirmDlg(t("resetDemo") + "?")) { await startDemo(false); location.hash = "#/dashboard"; render(); } break;
    case "libcancel": S.libEdit = null; render(); break;
    case "libsave": saveLibrary(); break;
    case "libadddept": S.libEdit.push({ code:"", en:"", az:"", descEn:"", descAz:"", isNew:true, rows:[] }); S.libDept = "";
      rerenderLibEdit(`le-${S.libEdit.length - 1}-code`); document.getElementById(`lib-${S.libEdit.length - 1}`)?.scrollIntoView({ block:"center" }); break;
    case "libdeldept": S.libEdit.splice(Number(el.dataset.ci), 1); rerenderLibEdit(); break;
    case "libdeltitle": S.libEdit[Number(el.dataset.ci)].rows.splice(Number(el.dataset.ti), 1); rerenderLibEdit(); break;
    case "libaddtitle": {
      const ci = Number(el.dataset.ci), inp = $(`#lnew-${ci}`), v = (inp?.value || "").trim();
      if (!v) { inp?.focus(); break; }
      if (S.libEdit[ci].rows.some(r => r.name.trim().toLowerCase() === v.toLowerCase())) { toast(t("tDupTitle", { t:v }), "err"); break; }
      S.libEdit[ci].rows.push({ name:v, level:"" }); rerenderLibEdit(`lnew-${ci}`); break;
    }

    case "evreveal": if (scoreTotal(S.evalState.scores).complete) { S.evalState.revealed = true; S.evalState.blind = { ...S.evalState.scores }; rerenderEval(); } break;
    case "dirapprove": directorDecide(el.dataset.id, "approved"); break;
    case "dirreturn": directorDecide(el.dataset.id, "returned"); break;
    case "mailtpl": installMailTemplates(); break;
    case "jdsave": saveJd(false); break;
    case "pgsave": savePersonalGrade(el.dataset.id); break;
    case "stdupdate": {
      const d = S.form.data, cur = S.jdt?.[d.standard.templateId];
      if (cur) { d.standard = { ...d.standard, version:cur.version || 1, items:clone(cur.fixedItems || []) }; d.kpiExtra = {}; S.dirty = true; rerenderForm(); toast(t("tStdUpdated"), "ok"); }
      break;
    }
    case "exportA-pv": exportA(S.repA, true); break;
    case "exportB-pv": exportB(S.repB, true); break;
    case "exportC-pv": exportC(el.dataset.id, true); break;
    case "pvclose": $("#pv")?.remove(); S.pv = null; break;
    case "pvdl": if (S.pv) { XLSX.writeFile(S.pv.wb, S.pv.name); toast(t("tExported"), "ok"); } break;
    case "jdreset": saveJd(true); break;
    case "jdaddresp": S.jdEdit.data.responsibilities.push(blankResp()); rerenderJd(); break;
    case "jddelresp": S.jdEdit.data.responsibilities.splice(Number(el.dataset.i), 1); rerenderJd(); break;
    case "jdapply": {
      const d = S.form.data;
      if (!(await confirmDlg(t("jdApply"), t("jdApplyConfirm")))) break;
      applyJd(d, jdFor(d.position.department, d.position.jobTitle), true); S.dirty = true; S.open.add(2); S.open.add(3); S.open.add(4);
      rerenderForm(); toast(t("tJdApplied"), "ok"); break;
    }
    case "evreturn": saveEval("return"); break;
  }
});
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { $("#pv")?.remove(); S.pv = null; closeDrawer(); $("#userPop")?.setAttribute("hidden", ""); }
  if (e.key === "Enter" && e.target.matches("tr[data-go]")) location.hash = e.target.dataset.go;
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.tagName === "TEXTAREA") autoGrow(el);
  if (el.dataset.filter) { S.filters[el.dataset.filter] = el.value; renderPosResults(); return; }
  if (el.dataset.lib) { S.libQ = el.value; renderLib(); return; }
  if (S.libEdit && el.dataset.le) { const [ci, k] = el.dataset.le.split("."); S.libEdit[ci][k] = k === "code" ? el.value.toUpperCase() : el.value; return; }
  if (S.libEdit && el.dataset.lt) { const [ci, ti] = el.dataset.lt.split(".").map(Number); S.libEdit[ci].rows[ti].name = el.value; return; }
  if (el.id === "titleSearch" && S.form) { S.form.titleSearch = el.value; rerenderForm(); return; }
  if (el.dataset.just) {
    const tgt = el.dataset.target === "mgr" ? S.form?.data?.managerEvaluation : S.evalState;
    if (tgt) { const j = el.dataset.target === "mgr" ? (tgt.justifications ??= {}) : (tgt.just ??= {}); j[el.dataset.just] = el.value; if (el.dataset.target === "mgr") S.dirty = true; }
    el.closest(".factor")?.classList.toggle("needs", !el.value.trim()); el.closest(".field")?.classList.remove("invalid");
    return;
  }
  if (el.dataset.kpiextra !== undefined && S.form) { (S.form.data.kpiExtra ??= {})[el.dataset.kpiextra] = el.value; S.dirty = true; return; }
  if (el.dataset.mgrcomment && S.form) { S.form.data.managerEvaluation.comments = el.value; S.dirty = true; return; }
  if (el.dataset.ev && S.evalState) {
    S.evalState[el.dataset.ev] = el.value;
    if (el.dataset.ev === "comments") {
      const st = scoreTotal(S.evalState.scores), rec = st.complete ? recommendGrade(st.total) : null;
      el.closest(".field").classList.toggle("invalid", !!(rec && S.evalState.finalGrade && S.evalState.finalGrade !== rec && !el.value.trim()));
    }
    if (el.dataset.ev === "calibrationNote") el.closest(".field").classList.toggle("invalid", !el.value.trim());
    return;
  }
  if (S.jdEdit && el.dataset.path?.startsWith("jd.")) {
    let v = el.value; if (el.dataset.num) v = v === "" ? null : Math.max(0, Number(v));
    if (el.dataset.bool) { v = el.checked; setP(S.jdEdit.data, el.dataset.path.slice(3), v); rerenderJd(); return; }
    setP(S.jdEdit.data, el.dataset.path.slice(3), v); return;
  }
  if (!S.form) return;
  if (el.dataset.othertitle) { S.form.data.position.jobTitle = el.value; S.dirty = true; refreshFormBits(); return; }
  if (el.dataset.path && !el.dataset.bool && el.tagName !== "SELECT") {
    let v = el.value;
    if (el.dataset.num) v = v === "" ? null : Math.max(0, Number(v));
    setP(S.form.data, el.dataset.path, v); S.dirty = true;
    el.closest(".field")?.classList.remove("invalid");
    refreshFormBits();
  }
});
document.addEventListener("change", e => {
  const el = e.target;
  if (el.dataset.filter) { S.filters[el.dataset.filter] = el.value; renderPosResults(); return; }
  if (el.dataset.rep) {
    const [r, k] = el.dataset.rep.split("."); S["rep" + r][k] = el.value;
    const n = $(`#r${r.toLowerCase()}-n`); if (n) n.textContent = `${filterList(S.employees || [], S["rep" + r]).length} ${t("rows")}`;
    return;
  }
  if (el.dataset.ev === "finalGrade" && S.evalState) { S.evalState.finalGrade = el.value; S.evalState.finalTouched = true; rerenderEval(); return; }
  if (el.dataset.ev === "evaluationDate" && S.evalState) { S.evalState.evaluationDate = el.value; return; }
  if (S.libEdit && el.dataset.ll) { const [ci, ti] = el.dataset.ll.split(".").map(Number); S.libEdit[ci].rows[ti].level = el.value; return; }
  if (S.libEdit && el.dataset.lm) {
    const [ci, ti] = el.dataset.lm.split(".").map(Number), to = Number(el.value);
    if (to !== ci) { const [row] = S.libEdit[ci].rows.splice(ti, 1); S.libEdit[to].rows.push(row); toast(t("tMoved", { d:L(S.libEdit[to]) })); rerenderLibEdit(); }
    return;
  }
  if (S.libEdit && el.dataset.le) { syncLibChips(); return; }
  if (el.dataset.demorole) { switchDemoRole(el.value); return; }
  if (el.dataset.urole) { saveUser(el.dataset.urole, { role:el.value }); return; }
  if (el.dataset.udept) { saveUser(el.dataset.udept, { departmentId:el.value || null }); return; }
  if (el.dataset.unotify) { saveUser(el.dataset.unotify, { notifyEmail:el.value }); return; }
  if (!S.form) return;
  const d = S.form.data;
  if (el.dataset.dept) {
    const dept = el.value; d.position.department = dept; d.departmentId = dept;
    const titles = DEPT[dept]?.titles || [];
    if (d.position.jobTitle && !titles.includes(d.position.jobTitle) && !S.form.other) d.position.jobTitle = "";
    if (dept && (!d.position.positionId || !d.position.positionId.startsWith(`POS-${dept}-`))) d.position.positionId = d.position.jobTitle ? nextPositionId(dept, S.form.id) : d.position.positionId;
    S.form.titleSearch = ""; S.dirty = true; rerenderForm(); return;
  }
  if (el.dataset.title) {
    if (el.value === "__other") { S.form.other = true; d.position.jobTitle = ""; }
    else { S.form.other = false; applyTitle(el.value); }
    S.dirty = true; rerenderForm();
    if (S.form.other) setTimeout(() => $("#f-otherTitle")?.focus(), 0);
    return;
  }
  if (el.dataset.othertitle) {
    const v = el.value.trim();
    if (v) { applyTitle(v); rerenderForm(); }
    return;
  }
  if (el.dataset.bool) {
    setP(d, el.dataset.path, el.checked); S.dirty = true;
    const yn = el.parentElement.querySelector("[data-yn]"); if (yn) yn.textContent = el.checked ? t("yes") : t("no");
    refreshFormBits(); return;
  }
  if (el.dataset.path && el.tagName === "SELECT") {
    setP(d, el.dataset.path, el.value); S.dirty = true;
    if (el.dataset.path === "position.jobLevel") { const ri = $("#rangeInfo"); if (ri) ri.innerHTML = el.value ? `<b>${t("suggestedRange")}: ${rangeText(el.value)}</b><span class="small">${esc(levelName(el.value))}</span>` : ""; }
    refreshFormBits(); return;
  }
  if (el.dataset.path === "position.directReports") {
    const had = $("#secb-9 [data-path^='people.']") != null, has = Number(d.position.directReports) > 0;
    if (had !== has) rerenderForm();
  }
});
window.addEventListener("beforeunload", e => { if (S.dirty && S.form) { e.preventDefault(); e.returnValue = ""; } });
window.addEventListener("hashchange", () => {
  const { path } = parseHash();
  if (S.form && !/^#\/positions\/(new|[^/]+\/edit)$/.test(path)) { S.form = null; S.dirty = false; }
  if (S.evalState && !/\/evaluate$/.test(path)) S.evalState = null;
  if (S.libEdit && path !== "#/library") S.libEdit = null;
  if (S.jdEdit && !path.startsWith("#/library/jd/")) S.jdEdit = null;
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll:true });
});

/* =====================================================================
   13) Boot
   ===================================================================== */
applyTheme(); applyStatic();
let hasDemo = false; try { hasDemo = !!sessionStorage.getItem("gs.demo"); } catch {}
if (hasDemo) { startDemo(true).then(() => render()); } else render();
getRedirectResult(auth).catch(e => { if (e?.code) { S.loginError = `${t("tSignInFailed")}: ${e.code}`; render(); } });
onAuthStateChanged(auth, async u => {
  if (DEMO.on) return;  // demo session has its own user
  S.user = u; S.employees = null; S.users = null;
  if (u) {
    try { await ensureProfile(u); if (role() !== "pending") { await loadLibrary(); await loadJobTemplates(); } }
    catch (e) { console.error(e); S.profile = { role:"pending" }; toast(errMsg(e), "err"); }
  } else S.profile = null;
  S.authReady = true;
  render();
});

// Exposed for quick checks in the browser console
window.GS = { recommendGrade, suggestLevel, levelFor, LEVELS, FACTORS, DEPARTMENTS, I18N };
