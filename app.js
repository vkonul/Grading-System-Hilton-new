// Grading System — Vəzifə Dərəcələndirmə Sistemi
// Plain ES module, no build step. Firebase v10 modular SDK from the CDN, SheetJS as global XLSX.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =====================================================================
   1) Firebase config (project: grade-system-new)
   ===================================================================== */
const firebaseConfig = {
  apiKey: "__API_KEY__",
  authDomain: "grade-system-new.firebaseapp.com",
  projectId: "grade-system-new",
  storageBucket: "grade-system-new.appspot.com",
  messagingSenderId: "__SENDER_ID__",
  appId: "__APP_ID__"
};
const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

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
const STATUSES = { draft:["Draft","Qaralama"], submitted:["Submitted","Göndərilib"], under_evaluation:["Under evaluation","Qiymətləndirilir"], returned:["Returned","Qaytarılıb"], approved:["Approved","Təsdiqlənib"] };
const ROLES = { admin:["Admin","Administrator"], hr:["HR Evaluator","HR qiymətləndirici"], manager:["Department Manager","Departament meneceri"], pending:["Pending","Gözləmədə"] };

// [key, EN, AZ, type, required?]  types: text | textarea | number | date | grade | jobLevel | dept | jobTitle | opt:<list> | yesno
const TOP_FIELDS = [
  ["employeeCode","Employee Code","İşçi kodu","text",1],
  ["fullName","Full Name","Ad, soyad","text",1],
  ["hireDate","Hire Date","İşə qəbul tarixi","date"]
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
const PERSIST_KEYS = ["employeeCode","fullName","hireDate","departmentId","status","returnComment", ...SECTIONS.map(s => s.key), "evaluation"];

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
  libTitle:["Job Title Library","Vəzifə adları kitabxanası"], libSub:["15 departments with suggested levels and grade ranges. Read-only.","Tövsiyə olunan səviyyə və dərəcə aralıqları ilə 15 departament. Yalnız oxumaq üçün."], titlesCount:["titles","vəzifə"],
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
  tXlsxMissing:["Excel library is still loading — try again","Excel kitabxanası hələ yüklənir — yenidən cəhd edin"], tSignInFailed:["Sign-in failed","Daxil olmaq alınmadı"],
  tAdminOnly:["This page is for admins only","Bu səhifə yalnız adminlər üçündür"], tNoDept:["Your account has no department assigned yet","Hesabınıza hələ departament təyin edilməyib"],
  tCopy:["Copy created — review and save","Surət yaradıldı — yoxlayıb yadda saxlayın"],
  confirmTitle:["Are you sure?","Əminsiniz?"], ok:["Yes","Bəli"], confirmDelete:["This position will be deleted permanently.","Bu vəzifə həmişəlik silinəcək."],
  confirmApprovedEdit:["Edit an approved position?","Təsdiqlənmiş vəzifə redaktə edilsin?"], confirmApprovedEditText:["The position is already approved. Changes will be saved without a new approval.","Vəzifə artıq təsdiqlənib. Dəyişikliklər yeni təsdiq olmadan yadda saxlanılacaq."],
  confirmSample:["Load 5 sample employee records into Firestore?","5 nümunə işçi qeydi Firestore-a yüklənsin?"], confirmLeave:["Leave without saving?","Yadda saxlamadan çıxılsın?"],
  confirmApprove:["Approve this position with grade {g}?","Bu vəzifə {g} dərəcəsi ilə təsdiqlənsin?"], confirmReturn:["Return this position to the manager for changes?","Bu vəzifə düzəliş üçün menecerə qaytarılsın?"],
  hrComment:["HR Comment","HR şərhi"], created:["Created","Yaradılıb"],
  sheetSummary:["Summary","Xülasə"], sheetPositions:["Positions","Vəzifələr"], sheetResp:["Responsibilities","Öhdəliklər"], sheetEval:["Evaluations","Qiymətləndirmələr"], sheetJD:["Job Description","Vəzifə təlimatı"],
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
const isHR = () => ["admin", "hr"].includes(role());
const isMgr = () => role() === "manager";
const myDept = () => S.profile?.departmentId || "";
const badge = s => `<span class="badge st-${esc(s)}">${esc(statusLabel(s))}</span>`;
const pill = g => g ? `<span class="pill">${esc(g)}</span>` : `<span class="pill empty">—</span>`;
const finalOf = e => e.evaluation?.finalGrade || "";
const icon = n => ({ total:"▤", submitted:"➤", under_evaluation:"✎", approved:"✓", plus:"+", list:"☰", cards:"▦", export:"⤓" }[n] || "•");

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
async function doSignOut() { await signOut(auth); S.profile = null; S.employees = null; S.users = null; location.hash = "#/login"; }

async function loadEmployees(force = false) {
  if (S.employees && !force) return S.employees;
  let snap;
  if (isHR()) snap = await getDocs(collection(db, "employees"));
  else if (isMgr() && myDept()) snap = await getDocs(query(collection(db, "employees"), where("departmentId", "==", myDept())));
  else { S.employees = []; return S.employees; }
  S.employees = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  return S.employees;
}
async function loadOne(id) {
  const list = await loadEmployees();
  let e = list.find(x => x.id === id);
  if (!e) {
    try { const s = await getDoc(doc(db, "employees", id)); if (s.exists()) e = { id:s.id, ...s.data() }; } catch (err) { console.warn(err); }
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
  if (!S.user) { if (path !== "#/login") { location.replace("#/login"); return; } }
  else if (role() === "pending") { if (path !== "#/pending") { location.replace("#/pending"); return; } }
  else if (path === "#/login" || path === "#/pending" || path === "#/" || path === "#") { location.replace("#/dashboard"); return; }
  let hit = null, m = null;
  for (const r of ROUTES) { m = path.match(r[0]); if (m) { hit = r; break; } }
  if (!hit) { location.replace(S.user ? "#/dashboard" : "#/login"); return; }
  if (hit[2] === "admin" && !isAdmin()) { toast(t("tAdminOnly"), "warn"); location.replace("#/dashboard"); return; }
  try {
    const html = await hit[1]({ id:m[1] ? decodeURIComponent(m[1]) : null, params, path, seq });
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
  const isActive = h => path === h || (h !== "#/dashboard" && path.startsWith(h));
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
          <button class="btn btn-ghost btn-block" data-act="signout">${t("signOut")}</button>
        </div></div>` : ""}
    </div>
  </div>`;
  $("#drawer").innerHTML = `<div class="drawer-head"><span class="brand"><span class="mono">GS</span><span class="brand-name">${esc(t("appName"))}</span></span>
    <button class="icon-btn" data-act="drawerclose" aria-label="${t("close")}">✕</button></div>
    ${items.map(([h, k]) => `<a href="${h}" class="${isActive(h) ? "active" : ""}">${t(k)}</a>`).join("")}
    ${u ? `<hr style="border:0;border-top:1px solid var(--border);width:100%"><a href="#" data-act="signout">${t("signOut")}</a>` : ""}`;
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
  const stats = [["total", t("totalPositions"), list.length], ["submitted", statusLabel("submitted"), count("submitted")],
                 ["under_evaluation", statusLabel("under_evaluation"), count("under_evaluation")], ["approved", statusLabel("approved"), count("approved")]];
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
function canEdit(e) {
  if (isHR()) return true;
  if (isMgr()) return e.departmentId === myDept() && ["draft", "returned"].includes(e.status);
  return false;
}

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
    if (!Array.isArray(data.responsibilities) || !data.responsibilities.length) data.responsibilities = [blankResp()];
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
  if (s.n === 3) return (d.responsibilities || []).some(r => (r.task || "").trim() && r.frequency && r.level);
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
  const done = s.n <= 11 ? sectionComplete(s, d) : false;
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
    <div class="full"><div class="banner info" style="margin:0" id="rangeInfo">${lvl ? `<b>${t("suggestedRange")}: ${rangeText(lvl)}</b><span class="small">${esc(levelName(lvl))}</span>` : `<span class="small muted">${t("levelAuto")}</span>`}</div></div>
    ${f.filter(x => !["department", "jobTitle"].includes(x[0])).map(x => fieldHTML("position." + x[0], x, p[x[0]], {
      hint: x[0] === "jobLevel" ? t("levelAuto") : x[0] === "positionId" ? "POS-{DEPT}-###" : "",
      disabled: x[0] === "currentGrade" && !isHR() })).join("")}
  </div>`;
}
function respHTML(d) {
  const list = d.responsibilities || [];
  const fs = SECTIONS[2].fields;
  return `${list.map((r, i) => `<div class="resp" id="resp-${i}">
      <div class="resp-h"><span class="label-caps">${t("responsibility")} ${i + 1}</span>
      <button type="button" class="btn btn-danger" data-delresp="${i}" aria-label="${t("removeResp")} ${i + 1}" ${list.length <= 1 ? "disabled" : ""}>🗑 ${t("removeResp")}</button></div>
      <div class="fields">${fs.map(f => fieldHTML(`responsibilities.${i}.${f[0]}`, f, r[f[0]], { full: f[0] === "task" })).join("")}</div></div>`).join("")}
    <button type="button" class="btn btn-secondary" data-act="addresp" style="margin-top:12px">${t("addResp")}</button>`;
}
function sec12ReadOnly(ev, compact) {
  if (!ev || !ev.scores) return `<p class="muted">${t("noScores")}</p>`;
  const st = scoreTotal(ev.scores);
  return `<p class="small muted">${t("readOnlyHR")}</p><div class="kv">
    ${FACTORS.map(f => `<div><div class="k">${esc(L(f))}</div><div class="v">${ev.scores[f.key] ?? "—"} / 5</div></div>`).join("")}
    <div><div class="k">${esc(L(["Total Evaluation Score","Ümumi qiymətləndirmə balı"]))}</div><div class="v"><b>${ev.totalScore ?? st.total}</b> / 45</div></div>
    <div><div class="k">${esc(L(["Recommended Job Grade","Tövsiyə olunan dərəcə"]))}</div><div class="v">${pill(ev.recommendedGrade)}</div></div>
    <div><div class="k">${esc(L(["Final Approved Job Grade","Yekun təsdiqlənmiş dərəcə"]))}</div><div class="v">${pill(ev.finalGrade)}</div></div>
    <div><div class="k">${esc(L(["Approval Status","Təsdiq statusu"]))}</div><div class="v">${ev.approvalStatus ? badge(ev.approvalStatus) : "—"}</div></div>
    <div><div class="k">${esc(L(["Evaluation Date","Qiymətləndirmə tarixi"]))}</div><div class="v">${esc(ev.evaluationDate || "—")}</div></div>
    <div><div class="k">${esc(L(["Evaluator","Qiymətləndirici"]))}</div><div class="v">${esc(ev.evaluatorName || "—")}</div></div>
    ${compact ? "" : `<div class="full"><div class="k">${esc(L(["Evaluator Comments","Qiymətləndiricinin şərhləri"]))}</div><div class="v">${esc(ev.comments || "—")}</div></div>`}
  </div>`;
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
  <section class="card" style="margin-bottom:16px"><div class="label-caps" style="margin-bottom:12px">${t("employee")}</div>
    <div class="fields" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">${TOP_FIELDS.map(f => fieldHTML(f[0], f, d[f[0]])).join("")}</div>
    <div style="margin-top:16px" id="progressBox">${progressHTML(d)}</div></section>
  <form id="jobForm" novalidate onsubmit="return false">
    ${SECTIONS.map(s => accHTML(s, body(s), d)).join("")}
    ${accHTML(SEC12, sec12ReadOnly(d.evaluation), d)}
  </form>
  <div class="actionbar">
    <button type="button" class="btn btn-ghost" data-act="formcancel">${t("cancel")}</button>
    <button type="button" class="btn btn-secondary" data-act="savedraft">${isNewOrMgr ? t("saveDraft") : t("save")}</button>
    <button type="button" class="btn btn-primary" data-act="submitform">${t("submitEval")}</button>
  </div>`;
}
function refreshFormBits() {
  if (!S.form) return;
  const d = S.form.data;
  const pb = $("#progressBox"); if (pb) pb.innerHTML = progressHTML(d);
  SECTIONS.forEach(s => { const el = $(`[data-ok="${s.n}"]`); if (el) el.textContent = sectionComplete(s, d) ? "✓" : ""; });
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
  const lvl = suggestLevel(title);
  p.jobLevel = lvl;
  if (!p.positionId || /^POS-[A-Z]+-\d{3}$/.test(p.positionId) && !p.positionId.startsWith(`POS-${p.department}-`)) p.positionId = nextPositionId(p.department, S.form.id);
  const tpl = LEVEL_TEMPLATES[lvl];
  let prefilled = false;
  if (tpl) {
    const dn = deptName(p.department);
    if (!(d.purpose.primaryPurpose || "").trim()) { d.purpose.primaryPurpose = L(tpl).replace("{dept}", dn); prefilled = true; }
    const empty = !(d.responsibilities || []).some(r => (r.task || "").trim() || (r.description || "").trim());
    if (empty) { d.responsibilities = tpl.resp.map(([en, az, fq, lv]) => ({ ...blankResp(), task:S.lang === "en" ? en : az, frequency:fq, level:lv })); prefilled = true; }
  }
  if (prefilled) { S.open.add(2); S.open.add(3); toast(t("prefilled")); }
}
function validate(d) {
  const miss = [];
  if (!(d.fullName || "").trim()) miss.push(["f-fullName", 0]);
  if (!d.position?.department) miss.push(["f-position-department", 1]);
  if (!(d.position?.jobTitle || "").trim()) miss.push([S.form.other ? "f-otherTitle" : "f-position-jobTitle", 1]);
  if (!(d.purpose?.primaryPurpose || "").trim()) miss.push(["f-purpose-primaryPurpose", 2]);
  const rs = d.responsibilities || [];
  const okResp = rs.filter(r => (r.task || "").trim() && r.frequency && r.level);
  if (!okResp.length) {
    const i = Math.max(0, rs.findIndex(r => !((r.task || "").trim() && r.frequency && r.level)));
    const r = rs[i] || {};
    const k = !(r.task || "").trim() ? "task" : !r.frequency ? "frequency" : "level";
    miss.push([rs.length ? fid(`responsibilities.${i}.${k}`) : "sec-3", 3, "resp"]);
  }
  return miss;
}
async function saveForm(submit) {
  const f = S.form, d = f.data;
  d.departmentId = d.position.department || d.departmentId || "";
  if (isMgr()) d.departmentId = d.position.department = myDept();
  $$(".invalid").forEach(el => el.classList.remove("invalid"));
  if (submit) {
    const miss = validate(d);
    if (miss.length) {
      miss.forEach(([, n]) => n && S.open.add(n));
      rerenderForm();
      miss.forEach(([elId]) => { const el = document.getElementById(elId); (el?.closest(".field") || el)?.classList.add("invalid"); });
      const first = document.getElementById(miss[0][0]);
      first?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"center" });
      setTimeout(() => (first?.querySelector?.("button, input, select, textarea") || first)?.focus?.({ preventScroll:true }), 250);
      toast(miss[0][2] === "resp" && miss.length === 1 ? t("tNeedResp") : t("tMissing"), "err");
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
  else if (!f.id || isMgr()) status = "draft";
  else status = f.origStatus;
  d.status = status;
  if (d.evaluation && isHR()) d.evaluation.approvalStatus = status;
  const payload = pickPersist(d);
  payload.updatedBy = S.user.uid; payload.updatedAt = serverTimestamp();
  const btns = $$(".actionbar .btn"); btns.forEach(b => b.disabled = true);
  try {
    let newId = f.id;
    if (!f.id) {
      if (isMgr()) payload.evaluation = null;
      payload.createdBy = S.user.uid; payload.createdAt = serverTimestamp();
      newId = (await addDoc(collection(db, "employees"), payload)).id;
    } else {
      if (isMgr()) delete payload.evaluation;
      await updateDoc(doc(db, "employees", f.id), payload);
    }
    S.employees = null; S.dirty = false; S.form = null;
    toast(submit ? t("tSubmitted") : t("tSaved"), "ok");
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
    if (s.n === 3) body = (e.responsibilities || []).map((r, i) => `<div class="mini"><div class="row" style="justify-content:space-between"><b>${i + 1}. ${esc(r.task)}</b>
        <span class="row">${r.frequency ? `<span class="chip">${esc(optLabel("freq", r.frequency))}</span>` : ""}${r.level ? `<span class="chip navy">${esc(optLabel("respLevel", r.level))}</span>` : ""}</span></div>
        ${r.description ? `<p style="margin:8px 0 0">${esc(r.description)}</p>` : ""}
        <div class="kv" style="margin-top:10px">${SECTIONS[2].fields.filter(f => ["outcomes", "kpis", "accountability"].includes(f[0])).map(f => `<div><div class="k">${esc(fl(f))}</div><div class="v">${esc(valueText(f, r[f[0]]) || "—")}</div></div>`).join("")}</div></div>`).join("") || `<p class="muted">—</p>`;
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
  </section>
  <div class="row no-print" style="margin-bottom:16px" id="detailActions">
    ${edit ? `<a class="btn btn-primary" href="#/positions/${esc(e.id)}/edit">${t("edit")}</a>` : ""}
    ${isHR() ? `<a class="btn btn-secondary" href="#/positions/${esc(e.id)}/evaluate">${t("evaluate")}</a>` : ""}
    <button class="btn btn-ghost" data-act="exportC" data-id="${esc(e.id)}">${icon("export")} ${t("exportPos")}</button>
    <a class="btn btn-ghost" href="#/positions/new?dup=${esc(e.id)}">${t("duplicate")}</a>
    <button class="btn btn-ghost" data-act="print">${t("print")}</button>
    ${isAdmin() ? `<button class="btn btn-danger" data-act="delete" data-id="${esc(e.id)}">${t("del")}</button>` : ""}
  </div>
  <div class="stack">
    ${card("·", t("employee"), "", kvHTML(TOP_FIELDS, e))}
    ${secs}
    ${card(12, L(SEC12), S.lang === "en" ? SEC12.az : SEC12.en, sec12ReadOnly(e.evaluation))}
  </div>`;
}

// S7 — Evaluation
async function scrEvaluate({ id, seq }) {
  if (!isHR()) { toast(t("tNoAccessEval"), "warn"); location.replace(`#/positions/${id}`); return null; }
  await loadEmployees();
  const e = await loadOne(id);
  if (seq !== renderSeq) return null;
  if (!e) { toast(t("tNotFound"), "err"); location.replace("#/positions"); return null; }
  const ev = clone(e.evaluation) || {};
  if (!S.evalState || S.evalState.id !== id) {
    S.evalState = { id, e, scores:{ ...(ev.scores || {}) }, finalGrade:ev.finalGrade || "", finalTouched:!!ev.finalGrade, comments:ev.comments || "",
      evaluationDate:ev.evaluationDate || today() };
  } else S.evalState.e = e;
  return evalHTML();
}
function evalHTML() {
  const es = S.evalState, e = es.e, p = e.position || {};
  const st = scoreTotal(es.scores), rec = st.complete ? recommendGrade(st.total) : null;
  if (!es.finalTouched) es.finalGrade = rec || es.finalGrade || "";
  const differs = rec && es.finalGrade && es.finalGrade !== rec;
  const outRange = es.finalGrade && p.jobLevel && !inRange(es.finalGrade, p.jobLevel);
  return `
  <div class="page-head"><div><div class="label-caps">${esc(L(SEC12))}</div><h1>${t("evaluate")}: ${esc(e.fullName)}</h1>
    <p class="sub">${esc(p.jobTitle)} · ${esc(deptName(e.departmentId))} · ${badge(e.status)}</p></div></div>
  <div class="eval-layout">
    <aside class="summary"><div class="card sticky"><div class="label-caps">${t("profileSummary")}</div>
      <h3 style="margin-top:6px">${esc(p.jobTitle)}</h3>
      <div class="small muted">${esc(levelName(p.jobLevel))} · ${esc(p.positionId || "")}</div>
      <details style="margin-top:10px"><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center">${esc(L(SECTIONS[1]))}</summary>
        <p class="small">${esc(e.purpose?.primaryPurpose || "—")}</p>
        <ul class="small" style="padding-left:18px">${(e.responsibilities || []).map(r => `<li>${esc(r.task)}</li>`).join("")}</ul>
        <p class="small muted">${esc(fl(SECTIONS[3].fields[0]))}: ${esc(optLabel("education", e.knowledge?.minEducation) || "—")} · ${esc(e.knowledge?.experienceYears ?? "—")} ${S.lang === "en" ? "yrs" : "il"}</p>
        <p class="small muted">${esc(fl(SECTIONS[0].fields[9]))}: ${esc(p.directReports ?? 0)} · ${esc(fl(SECTIONS[0].fields[10]))}: ${esc(p.indirectReports ?? 0)}</p>
      </details>
      <a href="#/positions/${esc(e.id)}" class="small">${t("viewFull")} →</a></div></aside>
    <div class="factors">${FACTORS.map(f => `
      <section class="card factor" aria-labelledby="fac-${f.key}">
        <div class="row" style="justify-content:space-between"><h3 id="fac-${f.key}" style="margin:0">${esc(L(f))}</h3><span class="chip navy">${es.scores[f.key] ? es.scores[f.key] + " / 5" : "—"}</span></div>
        <div class="small muted">${esc(S.lang === "en" ? f.dEn : f.dAz)}</div><div class="small muted" style="opacity:.8">${esc(S.lang === "en" ? f.dAz : f.dEn)}</div>
        <div class="scale" role="group" aria-labelledby="fac-${f.key}">${SCALE.map((s, i) => `<button type="button" data-score="${f.key}" data-v="${i + 1}" aria-pressed="${Number(es.scores[f.key]) === i + 1}">
          <b>${i + 1}</b><span>${esc(L(s))}</span></button>`).join("")}</div></section>`).join("")}</div>
    <aside class="result"><div class="card sticky stack">
      <div><div class="label-caps">${t("totalScore")}</div><div class="big">${st.total}<span class="muted" style="font-size:16px"> / 45</span></div>
        <div class="small muted">${st.count} / 9 ${t("scored")}</div></div>
      <div><div class="label-caps">${t("recommended")}</div><div style="margin-top:6px">${rec ? `<span class="pill lg">${rec}</span>` : `<span class="small muted">${t("scoreAll")}</span>`}</div></div>
      <div><div class="label-caps">${t("suggestedForLevel")}</div><div><b>${rangeText(p.jobLevel)}</b> <span class="small muted">${esc(p.jobLevel ? L(LEVELS[p.jobLevel]) : "")}</span></div></div>
      <div class="field"><label for="evFinal">${t("finalApproved")}</label><select id="evFinal" data-ev="finalGrade">${gradeOptions(es.finalGrade, t("select"))}</select>
        ${outRange ? `<span class="hint" style="color:var(--warn)">⚠ ${t("outOfRange")}</span>` : ""}</div>
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
    <button type="button" class="btn btn-primary" data-act="evapprove">${t("approve")}</button>
  </div>`;
}
function rerenderEval() {
  const y = window.scrollY, active = document.activeElement;
  const aid = active?.id, ds = active?.dataset?.score, dv = active?.dataset?.v;
  $("#main").innerHTML = evalHTML(); $$("textarea").forEach(autoGrow); window.scrollTo(0, y);
  const el = aid ? document.getElementById(aid) : ds ? $(`[data-score="${ds}"][data-v="${dv}"]`) : null;
  if (el) { el.focus({ preventScroll:true }); if (el.tagName === "TEXTAREA") el.setSelectionRange(el.value.length, el.value.length); }
}
async function saveEval(mode) {
  const es = S.evalState, e = es.e;
  const st = scoreTotal(es.scores), rec = st.complete ? recommendGrade(st.total) : null;
  const differs = rec && es.finalGrade && es.finalGrade !== rec;
  const comment = es.comments.trim();
  if (mode === "approve") {
    if (!st.complete || !es.finalGrade) { toast(t("tNeedAll"), "err"); return; }
    if (differs && !comment) { toast(`${t("tNeedComment")} — ${t("explainDiff")}`, "err"); $("#evComments")?.focus(); return; }
    if (!(await confirmDlg(t("confirmApprove", { g:es.finalGrade }), "", t("approve")))) return;
  }
  if (mode === "return") {
    if (!comment) { toast(t("tNeedComment"), "err"); $("#evComments")?.closest(".field")?.classList.add("invalid"); $("#evComments")?.focus(); return; }
    if (!(await confirmDlg(t("confirmReturn"), "", t("returnChanges")))) return;
  }
  if (mode === "save" && differs && !comment) { toast(`${t("tNeedComment")} — ${t("explainDiff")}`, "err"); $("#evComments")?.focus(); return; }
  const status = mode === "approve" ? "approved" : mode === "return" ? "returned" : "under_evaluation";
  const evaluation = {
    scores:Object.fromEntries(FACTORS.filter(f => es.scores[f.key]).map(f => [f.key, Number(es.scores[f.key])])),
    totalScore:st.total, recommendedGrade:rec, finalGrade:es.finalGrade || "", comments:comment, approvalStatus:status,
    evaluationDate:es.evaluationDate || today(), evaluatorName:S.profile?.displayName || S.user.email || "", evaluatorUid:S.user.uid
  };
  const upd = { status, evaluation, updatedAt:serverTimestamp(), updatedBy:S.user.uid };
  if (mode === "approve") { upd["position.currentGrade"] = es.finalGrade; upd["position.lastEvaluationDate"] = today(); upd.returnComment = ""; }
  if (mode === "return") upd.returnComment = comment;
  $$(".actionbar .btn").forEach(b => b.disabled = true);
  try {
    await updateDoc(doc(db, "employees", e.id), upd);
    S.employees = null; S.evalState = null;
    toast(mode === "approve" ? t("tApproved") : mode === "return" ? t("tReturned") : t("tSaved"), "ok");
    location.hash = `#/positions/${e.id}`;
  } catch (err) { toast(errMsg(err), "err"); $$(".actionbar .btn").forEach(b => b.disabled = false); }
}

// S8 — Library
function scrLibrary() {
  return `<div class="page-head"><div><h1>${t("libTitle")}</h1><p class="sub">${t("libSub")}</p></div></div>
    <div class="card" style="padding:16px;margin-bottom:16px"><div class="field"><label for="libq">${t("search")}</label>
      <input id="libq" type="search" value="${esc(S.libQ)}" data-lib="q" autocomplete="off"></div></div>
    <div class="dept-chips" role="group" aria-label="${t("department")}">
      <button data-libdept="" aria-pressed="${!S.libDept}">${t("all")}</button>
      ${DEPARTMENTS.map(d => `<button data-libdept="${d.code}" aria-pressed="${S.libDept === d.code}">${esc(d.code)} · ${esc(L(d))}</button>`).join("")}</div>
    <div id="libResults"></div>`;
}
function renderLib() {
  const box = $("#libResults"); if (!box) return;
  const q = S.libQ.trim().toLowerCase();
  const cards = DEPARTMENTS.filter(d => !S.libDept || d.code === S.libDept).map(d => {
    const deptHit = q && [d.en, d.az, d.code, d.descEn, d.descAz].join(" ").toLowerCase().includes(q);
    const titles = d.titles.filter(x => !q || deptHit || x.toLowerCase().includes(q));
    if (q && !titles.length) return "";
    return `<section class="card"><div class="label-caps">${esc(d.code)} · ${d.titles.length} ${t("titlesCount")}</div>
      <h2 style="margin:4px 0 2px">${esc(L(d))}</h2><div class="small muted" style="margin-bottom:8px">${esc(S.lang === "en" ? d.az : d.en)}</div>
      <p class="small">${esc(S.lang === "en" ? d.descEn : d.descAz)}</p>
      <ul class="titles">${titles.map(x => { const l = suggestLevel(x); return `<li><span class="n">${esc(x)}</span><span class="chip navy" title="${esc(L(LEVELS[l]))}">${l}</span><span class="chip">${rangeText(l)}</span></li>`; }).join("")}</ul></section>`;
  }).join("");
  box.innerHTML = cards ? `<div class="grid">${cards}</div>` : `<div class="card"><div class="empty"><p>${t("noResults")}</p></div></div>`;
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
      <button class="btn btn-primary btn-block" data-act="exportA">${icon("export")} ${t("exportXlsx")}</button></section>
    <section class="card stack"><div><h2>${t("repB")}</h2><p class="small muted">${t("repBDesc")}</p></div>
      <div class="field"><label for="rb-d">${t("department")}</label><select id="rb-d" data-rep="B.dept">${deptOptions(b.dept)}</select></div>
      <div class="field"><label for="rb-s">${t("status")}</label><select id="rb-s" data-rep="B.status">${statusOptions(b.status)}</select></div>
      <p class="small muted" id="rb-n">${filterList(S.employees, b).length} ${t("rows")}</p>
      <button class="btn btn-primary btn-block" data-act="exportB">${icon("export")} ${t("exportXlsx")}</button></section>
    <section class="card stack"><div><h2>${t("repC")}</h2><p class="small muted">${t("repCDesc")}</p></div>
      <a class="btn btn-secondary btn-block" href="#/positions">${t("goPositions")}</a></section>
  </div>`;
}

// S10 — Admin → Users
async function scrAdmin() {
  const snap = await getDocs(collection(db, "users"));
  S.users = snap.docs.map(d => ({ id:d.id, ...d.data() })).sort((a, b) => (a.displayName || a.email || "").localeCompare(b.displayName || b.email || ""));
  return `<div class="page-head"><div><h1>${t("usersTitle")}</h1><p class="sub">${t("usersSub")}</p></div></div>
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
      <div class="last small muted">${t("lastSignIn")}<br>${esc(fmtDate(u.lastLogin) || "—")}</div></div>`;
  }).join("")}</div></section>
  <section class="card"><h2>${t("sampleTitle")}</h2><p class="muted">${t("sampleDesc")}</p>
    <button class="btn btn-secondary" data-act="sample">${t("loadSample")}</button></section>`;
}
async function saveUser(uid, changes) {
  try {
    await updateDoc(doc(db, "users", uid), changes);
    const u = S.users?.find(x => x.id === uid); if (u) Object.assign(u, changes);
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
    for (const rec of SAMPLE_DATA) {
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
function sanitizeFile(s) { return String(s || "").replace(/[\\/:*?"<>|]+/g, "").trim() || "position"; }
const H = (en, az) => S.lang === "en" ? en : az;

function exportA(filters) {
  if (!xlsxReady()) return;
  const list = sortByUpdated(filterList(scopeList(S.employees || []), filters));
  const c = { code:fl(TOP_FIELDS[0]), name:fl(TOP_FIELDS[1]), pid:fl(SECTIONS[0].fields[5]), title:fl(SECTIONS[0].fields[1]), dept:fl(SECTIONS[0].fields[0]),
    level:fl(SECTIONS[0].fields[4]), cur:fl(SECTIONS[0].fields[3]), total:H("Total Score","Ümumi bal"), rec:H("Recommended Grade","Tövsiyə olunan dərəcə"),
    fin:H("Final Grade","Yekun dərəcə"), st:t("status"), date:H("Evaluation Date","Qiymətləndirmə tarixi"), ev:H("Evaluator","Qiymətləndirici") };
  const fh = FACTORS.map(f => L(f));
  const headers = [c.code, c.name, c.pid, c.title, c.dept, c.level, c.cur, ...fh, c.total, c.rec, c.fin, c.st, c.date, c.ev];
  const rows = list.map(e => {
    const ev = e.evaluation || {}, p = e.position || {};
    const r = { [c.code]:e.employeeCode || "", [c.name]:e.fullName || "", [c.pid]:p.positionId || "", [c.title]:p.jobTitle || "", [c.dept]:deptName(e.departmentId),
      [c.level]:levelName(p.jobLevel), [c.cur]:p.currentGrade || "" };
    FACTORS.forEach((f, i) => r[fh[i]] = ev.scores?.[f.key] ?? "");
    const st = scoreTotal(ev.scores);
    Object.assign(r, { [c.total]:ev.scores ? (ev.totalScore ?? st.total) : "", [c.rec]:ev.recommendedGrade || "", [c.fin]:ev.finalGrade || "", [c.st]:statusLabel(e.status),
      [c.date]:ev.evaluationDate || "", [c.ev]:ev.evaluatorName || "" });
    return r;
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(rows, headers), t("sheetSummary"));
  XLSX.writeFile(wb, `grading-summary-${stamp()}.xlsx`);
  toast(t("tExported"), "ok");
}
function positionRow(e) {
  const used = new Set(), r = {}, headers = [];
  const put = (h, v) => { const k = uniqHeader(used, h); headers.push(k); r[k] = v ?? ""; };
  TOP_FIELDS.forEach(f => put(fl(f), xv(f, e[f[0]])));
  put(t("status"), statusLabel(e.status));
  SECTIONS.filter(s => s.n !== 3).forEach(s => s.fields.forEach(f => put(fl(f), xv(f, e[s.key]?.[f[0]]))));
  put(H("HR Comment","HR şərhi"), e.returnComment || "");
  put(H("Updated","Yenilənib"), fmtDate(e.updatedAt));
  return { r, headers };
}
function respRows(e) {
  return (e.responsibilities || []).map((x, i) => {
    const o = { [fl(SECTIONS[0].fields[5])]:e.position?.positionId || "", [fl(TOP_FIELDS[0])]:e.employeeCode || "", [t("no_")]:i + 1 };
    SECTIONS[2].fields.forEach(f => o[fl(f)] = xv(f, x[f[0]]));
    return o;
  });
}
const respHeaders = () => [fl(SECTIONS[0].fields[5]), fl(TOP_FIELDS[0]), t("no_"), ...SECTIONS[2].fields.map(fl)];
function evalRow(e) {
  const ev = e.evaluation || {};
  const o = { [fl(SECTIONS[0].fields[5])]:e.position?.positionId || "", [fl(TOP_FIELDS[0])]:e.employeeCode || "", [fl(TOP_FIELDS[1])]:e.fullName || "" };
  EVAL_FIELDS.forEach(f => { const v = getP(ev, f[0]); o[fl(f)] = f[3] === "status" ? statusLabel(v) : (v ?? ""); });
  return o;
}
const evalHeaders = () => [fl(SECTIONS[0].fields[5]), fl(TOP_FIELDS[0]), fl(TOP_FIELDS[1]), ...EVAL_FIELDS.map(fl)];
function exportB(filters) {
  if (!xlsxReady()) return;
  const list = sortByUpdated(filterList(scopeList(S.employees || []), filters));
  const pos = list.map(positionRow);
  const headers = pos[0]?.headers || positionRow(blankEmployee()).headers;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(pos.map(x => x.r), headers), t("sheetPositions"));
  XLSX.utils.book_append_sheet(wb, makeSheet(list.flatMap(respRows), respHeaders()), t("sheetResp"));
  XLSX.utils.book_append_sheet(wb, makeSheet(list.map(evalRow), evalHeaders()), t("sheetEval"));
  XLSX.writeFile(wb, `job-profiles-${stamp()}.xlsx`);
  toast(t("tExported"), "ok");
}
async function exportC(id) {
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
    if (s.n === 3) { (e.responsibilities || []).forEach((r, i) => add(sec, `${t("responsibility")} ${i + 1}`, `${r.task || ""} (${optLabel("freq", r.frequency)}, ${optLabel("respLevel", r.level)})`)); return; }
    if (s.n === 9 && !(Number(e.position?.directReports) > 0)) { add(sec, "—", t("notApplicable")); return; }
    s.fields.forEach(f => add(sec, fl(f), xv(f, e[s.key]?.[f[0]])));
  });
  const sec12 = `12. ${L(SEC12)}`;
  EVAL_FIELDS.forEach(f => { const v = getP(e.evaluation || {}, f[0]); add(sec12, fl(f), f[3] === "status" ? statusLabel(v) : v); });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, makeSheet(rows, [cs, cf, cv]), t("sheetJD"));
  const rh = [t("no_"), ...SECTIONS[2].fields.map(fl)];
  XLSX.utils.book_append_sheet(wb, makeSheet((e.responsibilities || []).map((r, i) => {
    const o = { [t("no_")]:i + 1 }; SECTIONS[2].fields.forEach(f => o[fl(f)] = xv(f, r[f[0]])); return o; }), rh), t("sheetResp"));
  XLSX.writeFile(wb, `${sanitizeFile(e.position?.positionId)}-${sanitizeFile(e.fullName)}.xlsx`);
  toast(t("tExported"), "ok");
}

/* =====================================================================
   12) Global event delegation
   ===================================================================== */
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-act],[data-go],[data-chip],[data-acc],[data-delresp],[data-score],[data-sort],[data-libdept]");
  if (!ev.target.closest(".user-menu")) $("#userPop")?.setAttribute("hidden", "");
  if (!el) return;
  if (el.dataset.go) { location.hash = el.dataset.go; return; }
  if (el.dataset.acc) {
    const n = Number(el.dataset.acc), sec = el.closest(".acc"), body = sec.querySelector(".acc-b");
    const open = !S.open.has(n); open ? S.open.add(n) : S.open.delete(n);
    sec.classList.toggle("open", open); el.setAttribute("aria-expanded", open); body.hidden = !open;
    if (open) body.querySelectorAll("textarea").forEach(autoGrow);
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
  if (el.dataset.score && S.evalState) {
    const k = el.dataset.score, v = Number(el.dataset.v);
    S.evalState.scores[k] = Number(S.evalState.scores[k]) === v ? undefined : v;
    if (S.evalState.scores[k] === undefined) delete S.evalState.scores[k];
    rerenderEval(); return;
  }
  if (el.dataset.sort) { const k = el.dataset.sort; S.sort = { key:k, dir:S.sort.key === k ? -S.sort.dir : 1 }; renderPosResults(); return; }
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
    case "evapprove": saveEval("approve"); break;
    case "evreturn": saveEval("return"); break;
  }
});
$("#drawerBackdrop").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeDrawer(); $("#userPop")?.setAttribute("hidden", ""); }
  if (e.key === "Enter" && e.target.matches("tr[data-go]")) location.hash = e.target.dataset.go;
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.tagName === "TEXTAREA") autoGrow(el);
  if (el.dataset.filter) { S.filters[el.dataset.filter] = el.value; renderPosResults(); return; }
  if (el.dataset.lib) { S.libQ = el.value; renderLib(); return; }
  if (el.id === "titleSearch" && S.form) { S.form.titleSearch = el.value; rerenderForm(); return; }
  if (el.dataset.ev && S.evalState) {
    S.evalState[el.dataset.ev] = el.value;
    if (el.dataset.ev === "comments") {
      const st = scoreTotal(S.evalState.scores), rec = st.complete ? recommendGrade(st.total) : null;
      el.closest(".field").classList.toggle("invalid", !!(rec && S.evalState.finalGrade && S.evalState.finalGrade !== rec && !el.value.trim()));
    }
    return;
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
  if (el.dataset.urole) { saveUser(el.dataset.urole, { role:el.value }); return; }
  if (el.dataset.udept) { saveUser(el.dataset.udept, { departmentId:el.value || null }); return; }
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
  render();
  window.scrollTo(0, 0);
  $("#main").focus({ preventScroll:true });
});

/* =====================================================================
   13) Boot
   ===================================================================== */
applyTheme(); applyStatic(); render();
getRedirectResult(auth).catch(e => { if (e?.code) { S.loginError = `${t("tSignInFailed")}: ${e.code}`; render(); } });
onAuthStateChanged(auth, async u => {
  S.user = u; S.employees = null; S.users = null;
  if (u) {
    try { await ensureProfile(u); }
    catch (e) { console.error(e); S.profile = { role:"pending" }; toast(errMsg(e), "err"); }
  } else S.profile = null;
  S.authReady = true;
  render();
});

// Exposed for quick checks in the browser console
window.GS = { recommendGrade, suggestLevel, LEVELS, FACTORS, DEPARTMENTS, I18N };
