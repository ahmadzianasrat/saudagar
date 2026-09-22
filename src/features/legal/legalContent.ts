import type { Language } from "../../contexts/LanguageContext";

// ============================================================
// About / Terms / Privacy content.
// ------------------------------------------------------------
// Plain first-draft copy, not reviewed by a lawyer — written to be
// honest and specific about what the app actually does (offline-first
// ledger/inventory, Supabase-hosted, phone-based login) rather than
// generic boilerplate. Expect this to need real review before it
// carries legal weight, same caveat the existing
// content/policies/terms.*.md files already noted for their Dari/
// Pashto drafts. The Terms section below folds those files' existing
// subscription/pricing terms in rather than duplicating them
// separately — if those .md files are edited, mirror the change here
// too (or replace this with a proper markdown-loading setup later).
// ============================================================

export type LegalDoc = "about" | "terms" | "privacy";

export interface LegalSection {
  heading: string;
  body: string;
}

export interface LegalContent {
  title: string;
  updated: string;
  intro?: string;
  sections: LegalSection[];
}

export const LEGAL_CONTENT: Record<Language, Record<LegalDoc, LegalContent>> = {
  en: {
    about: {
      title: "About Saudagar",
      updated: "Last updated: 2026",
      intro:
        "Saudagar is an offline-first app for grain, cotton, and fertilizer traders — built to run a shop's customer ledger, stock, and market prices from a phone, with or without a signal.",
      sections: [
        {
          heading: "What it does",
          body:
            "Saudagar combines three things a trader normally tracks separately: a credit ledger for what customers owe and are owed, an inventory tracker that compares landed cost against live market price, and a multi-market price feed. It works in Pashto, Dari, and English.",
        },
        {
          heading: "Built for spotty connections",
          body:
            "Every entry is saved to the phone first and syncs to the server when a connection is available — adding a ledger entry or a purchase never has to wait for signal.",
        },
        {
          heading: "Who it's for",
          body:
            "Shop owners and traders in Afghanistan who currently keep this information in a paper notebook, a memory, or scattered WhatsApp messages, and want it in one place they can search, total, and share.",
        },
        {
          heading: "Get in touch",
          body:
            "Questions, problems, or feedback about the app — reach out through the same channel you used to get your account set up, or via the contact details on the shop profile screen.",
        },
      ],
    },
    terms: {
      title: "Terms of Use",
      updated: "Last updated: 2026",
      intro: "By using Saudagar, you agree to the terms below.",
      sections: [
        {
          heading: "Your account",
          body:
            "Your account is tied to your registered phone number and a password set for you when your account was approved. Keep your password private — anyone who has it can view and edit your shop's ledger and inventory. If you suspect someone else has access, change your password immediately from Settings.",
        },
        {
          heading: "Your data is yours",
          body:
            "The ledger entries, inventory records, and contact details you enter belong to you. Saudagar stores them to provide the service and does not sell them or use them for anything beyond running the app.",
        },
        {
          heading: "Accuracy is your responsibility",
          body:
            "Saudagar is a record-keeping tool. Ledger entries reflect what you record and are not independently verified. We do not mediate disagreements between you and a trading partner about an amount or a transaction's terms — if a disagreement comes up, confirm the transaction directly with them; sharing your WhatsApp balance summary can help settle most of these quickly.",
        },
        {
          heading: "Market prices",
          body:
            "Prices shown in the app are uploaded by market representatives for reference and are not guaranteed to exactly match every transaction available in a market at a given moment. Confirm current terms directly with a buyer or seller before relying on a price shown here for a specific trade.",
        },
        {
          heading: "Subscription plans",
          body:
            "Free Trial — 30 days, full access, no payment required, starts automatically when your account is approved. Monthly — 250 AFN per month. 6 Months — 1,250 AFN (about 17% less than paying monthly).",
        },
        {
          heading: "If your subscription expires",
          body:
            "You can always view your existing records, with no time limit. Adding new entries requires an active subscription. Renew any time to resume — nothing you've recorded is ever hidden or deleted because a subscription lapsed.",
        },
        {
          heading: "Refunds & cancellation",
          body:
            "Subscription payments are not refundable, including for unused time. If you cancel or don't renew, your access to add new entries continues until the end of the period you already paid for.",
        },
        {
          heading: "Changes to these terms",
          body:
            "These terms may be updated as the app changes. Continuing to use Saudagar after an update means you accept the revised terms.",
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      updated: "Last updated: 2026",
      intro: "This explains what information Saudagar collects and how it's used.",
      sections: [
        {
          heading: "What we collect",
          body:
            "Your phone number, owner and shop name, and shop address (from account setup and your shop profile); the ledger entries, contacts, inventory items, and prices you enter; and, if you contact us for support, whatever you share with us then.",
        },
        {
          heading: "How it's used",
          body:
            "Solely to run the app for you: to log you in, show your ledger and inventory, sync your entries across sessions, and generate the receipts/statements you choose to create. We don't sell your data or share it with advertisers.",
        },
        {
          heading: "Where it's stored",
          body:
            "Your data is stored in a Supabase-hosted database (PostgreSQL). A working copy is also kept on your phone (in the browser's local storage) so the app works offline and can sync once you're back online — that local copy stays on your device.",
        },
        {
          heading: "Who can see it",
          body:
            "Your shop's data is visible to your account and to anyone you've shared your login with. Saudagar's administrators can access account data as needed to provide support, approve accounts, and process subscription payments — not for any other purpose.",
        },
        {
          heading: "Other people's information",
          body:
            "The ledger contacts and counterparties you add (names, phone numbers, addresses) are stored the same way as the rest of your shop's data. Please only add people you have a legitimate business reason to keep records about.",
        },
        {
          heading: "Your choices",
          body:
            "You can update your shop profile and WhatsApp number from Settings at any time. To request a correction or deletion of your account data, contact us through the same channel used for account setup.",
        },
        {
          heading: "Changes to this policy",
          body:
            "If this policy changes, the update will be reflected here with a new date at the top.",
        },
      ],
    },
  },
  ps: {
    about: {
      title: "د سوداګر په اړه",
      updated: "وروستی نوي کول: ۲۰۲۶",
      intro:
        "سوداګر د غنم، پنبې او کیمیاوي سرو د سوداګرو لپاره جوړه شوې آفلاین-لومړۍ اپلیکیشن ده — چې د یوې دوکان د پیرودونکو کاته، ذخیره، او د بازار بیو اداره کول د موبایل له لارې، له سیګنال سره یا پرته لدې، ممکنه کوي.",
      sections: [
        {
          heading: "دا څه کوي",
          body:
            "سوداګر درې هغه شیان یوځای کوي چې یو سوداګر معمولاً جلا جلا ساتي: د پیرودونکو د پور/بردو کاته، د ذخيرې تعقیب چې د راوړلو لګښت د بازار اوسنۍ بیې سره پرتله کوي، او د څو بازارونو د بیو فيډ. دا په پښتو، دري او انګلیسي کې کار کوي.",
        },
        {
          heading: "د کمزوري انټرنیټ لپاره جوړه شوې",
          body:
            "هره ليکنه لومړی په موبایل کې خوندي کیږي او کله چې انټرنیټ موجود وي سرور ته لیږدول کیږي — د کاته ليکنې یا پیرود اضافه کول هیڅکله د سیګنال انتظار ته اړتیا نه لري.",
        },
        {
          heading: "دا د چا لپاره ده",
          body:
            "د افغانستان دوکاندار او سوداګر چې اوس دا معلومات په کاغذي کتاب کې، په یاد کې، یا خواره واره WhatsApp پیغامونو کې ساتي، او غواړي دا په یو ځای کې ولري چې ولټوي، جمع کړي، او شریک یې کړي.",
        },
        {
          heading: "اړیکه ونیسئ",
          body:
            "د اپلیکیشن په اړه پوښتنې، ستونزې، یا نظرونه — له همغه لارې چې ستاسو حساب یې جوړ کړی و اړیکه ونیسئ، یا د دوکان پروفایل پاڼې کې د اړیکې تفصیلاتو له لارې.",
        },
      ],
    },
    terms: {
      title: "د کارونې شرایط",
      updated: "وروستی نوي کول: ۲۰۲۶",
      intro: "د سوداګر په کارولو سره، تاسو لاندې شرایط منئ.",
      sections: [
        {
          heading: "ستاسو حساب",
          body:
            "ستاسو حساب ستاسو د ثبت شوي موبایل شمېرې او هغه پاسورډ سره تړلی دی چې ستاسو د حساب د تصویب پر مهال درکړل شوی و. خپل پاسورډ محرم وساتئ — هر څوک چې یې ولري کولی شي ستاسو د دوکان کاته او ذخيره وګوري او بدل یې کړي. که تاسو شک لرئ چې بل چا لاسرسی لري، سملاسي له تنظیماتو خپل پاسورډ بدل کړئ.",
        },
        {
          heading: "ستاسو معلومات ستاسو دي",
          body:
            "هغه د کاته ليکنې، د ذخيرې ریکارډونه، او د اړیکو تفصیلات چې تاسو یې ورکوئ ستاسو دي. سوداګر یې د خدمت وړاندې کولو لپاره ساتي او نه یې پلوري او نه د اپلیکیشن له چلولو پرته د بل هدف لپاره کاروي.",
        },
        {
          heading: "دقت ستاسو مسئولیت دی",
          body:
            "سوداګر د ریکارډ ساتنې وسیله ده. د کاته ليکنې هغه څه منعکسوي چې تاسو یې ثبت کوئ او په خپلواک ډول تصدیق نه کیږي. موږ ستاسو او یو سوداګریز ملګري ترمنځ د اندازې یا شرایطو په اړه شخړې حل نه کوو — که شخړه پیدا شي، مستقیم له هغوی سره معامله تایید کړئ؛ ستاسو د WhatsApp د بېلانس لنډیز شریکول کولی شي ډیری داسې شخړې ژر حل کړي.",
        },
        {
          heading: "د بازار بیې",
          body:
            "په اپلیکیشن کې ښودل شوې بیې د معلوماتو لپاره د بازار استازو لخوا اپلوډ کیږي او تضمین نه کیږي چې په یوه بازار کې په یوه ورکړل شوې شیبه کې د هرې معاملې سره سمې مطابقت ولري. مخکې له دې چې د یوې ځانګړې معاملې لپاره پرې تکیه وکړئ، اوسني شرایط مستقیم له پیرودونکي یا پلورونکي سره تایید کړئ.",
        },
        {
          heading: "د اشتراک پلانونه",
          body:
            "وړیا ازموینه — ۳۰ ورځې، بشپړ لاسرسی، پرته له تادیې، ستاسو د حساب له تصویب سره سم پیل کیږي. میاشتنی — ۲۵۰ افغانۍ په میاشت کې. ۶ میاشتې — ۱۲۵۰ افغانۍ (د میاشتني تادیې په پرتله شاوخوا ۱۷٪ لږ).",
        },
        {
          heading: "که ستاسو اشتراک پای ته ورسیږي",
          body:
            "تاسو تل کولی شئ خپل موجود ریکارډونه وګورئ، پرته له وخت محدودیت. د نویو ليکنو اضافه کول فعال اشتراک ته اړتیا لري. هر وخت نوي کول وکړئ ترڅو بیا پیل شي — هغه څه چې ثبت شوي هیڅکله د اشتراک پای ته رسیدو له امله نه پټیږي او نه له منځه ځي.",
        },
        {
          heading: "بیرته ورکړه او لغوه کول",
          body:
            "د اشتراک تادیې بیرته نه ورکول کیږي، پشمول د ناکارول شوي وخت لپاره. که لغوه کړئ یا نوي نه کړئ، ستاسو د نویو ليکنو اضافه کولو لاسرسی د هغې دورې تر پایه دوام کوي چې مخکې مو تادیه کړې.",
        },
        {
          heading: "پدې شرایطو کې بدلونونه",
          body:
            "دا شرایط ممکن د اپلیکیشن د بدلون سره سم نوي شي. د نوي کیدو وروسته د سوداګر دوامداره کارول پدې معنی ده چې تاسو بدل شوي شرایط منئ.",
        },
      ],
    },
    privacy: {
      title: "د محرمیت تګلاره",
      updated: "وروستی نوي کول: ۲۰۲۶",
      intro: "دا تشریح کوي چې سوداګر کوم معلومات راټولوي او څنګه یې کاروي.",
      sections: [
        {
          heading: "موږ څه راټولوو",
          body:
            "ستاسو د موبایل شمېره، د مالک او دوکان نوم، او د دوکان پته (د حساب جوړولو او ستاسو د دوکان پروفایل څخه)؛ هغه د کاته ليکنې، اړیکې، د ذخيرې توکي، او بیې چې تاسو یې ورکوئ؛ او که تاسو د مرستې لپاره زموږ سره اړیکه ونیسئ، هغه څه چې پر مهال یې شریکوئ.",
        },
        {
          heading: "دا څنګه کارول کیږي",
          body:
            "یوازې ستاسو لپاره د اپلیکیشن چلولو لپاره: تاسو ننوتل، ستاسو کاته او ذخيره ښودل، ستاسو ليکنې د ناستو په اوږدو کې همغږي کول، او هغه رسیدونه/بیانیې جوړول چې تاسو یې غواړئ. موږ ستاسو معلومات نه پلوروو او نه یې له اعلاناتو سره شریکوو.",
        },
        {
          heading: "دا چیرته ساتل کیږي",
          body:
            "ستاسو معلومات په Supabase-میزبانۍ شوي ډیټابیس (PostgreSQL) کې ساتل کیږي. یوه کاري کاپي ستاسو په موبایل کې هم ساتل کیږي (د براوزر په محلي زیرمه کې) ترڅو اپلیکیشن آفلاین کار وکړي او بیا له انټرنیټ سره وصل کیدو وروسته همغږی شي — هغه محلي کاپي ستاسو په وسیله کې پاتې کیږي.",
        },
        {
          heading: "دا څوک لیدلی شي",
          body:
            "ستاسو د دوکان معلومات ستاسو حساب ته او هر چا ته چې تاسو خپل حساب ورسره شریک کړی وي ښکاره دي. د سوداګر مدیران کولی شي د مرستې وړاندې کولو، د حسابونو تصویب، او د اشتراک تادیاتو پروسس کولو لپاره اړتیا په صورت کې حساب معلوماتو ته لاسرسی ولري — نه د بل هدف لپاره.",
        },
        {
          heading: "د نورو کسانو معلومات",
          body:
            "هغه د کاته اړیکې او سوداګریز ملګري چې تاسو یې اضافه کوئ (نومونه، د موبایل شمېرې، پتې) لکه ستاسو د دوکان د پاتې معلوماتو په څیر ساتل کیږي. مهرباني وکړئ یوازې هغه کسان اضافه کړئ چې تاسو یو حقیقي سوداګریز دلیل لرئ چې د هغوی ریکارډ وساتئ.",
        },
        {
          heading: "ستاسو اختیارونه",
          body:
            "تاسو کولی شئ هر وخت خپل د دوکان پروفایل او د WhatsApp شمېره له تنظیماتو نوي کړئ. د خپل حساب معلوماتو د سمون یا ړنګولو غوښتنې لپاره، له همغه لارې چې ستاسو حساب یې جوړ کړی و زموږ سره اړیکه ونیسئ.",
        },
        {
          heading: "پدې تګلاره کې بدلونونه",
          body:
            "که دا تګلاره بدله شي، بدلون به دلته د پورتني نوي نیټې سره منعکس شي.",
        },
      ],
    },
  },
  da: {
    about: {
      title: "درباره سوداگر",
      updated: "آخرین بروزرسانی: ۲۰۲۶",
      intro:
        "سوداگر یک اپلیکیشن آفلاین-محور برای تاجران گندم، پنبه و کود است — برای اداره دفتر حساب مشتریان، ذخیره و قیمت‌های بازار یک دکان از طریق موبایل، با یا بدون سیگنال.",
      sections: [
        {
          heading: "این چه کاری انجام می‌دهد",
          body:
            "سوداگر سه چیزی را که یک تاجر معمولاً جداگانه پیگیری می‌کند یکجا می‌کند: دفتر حساب قرض مشتریان، ردیاب ذخیره که قیمت تمام‌شده را با قیمت فعلی بازار مقایسه می‌کند، و فید قیمت چند بازار. این به پشتو، دری و انگلیسی کار می‌کند.",
        },
        {
          heading: "برای اتصالات ضعیف ساخته شده",
          body:
            "هر ورودی ابتدا در موبایل ذخیره می‌شود و هنگامی که اتصال موجود باشد با سرور همگام‌سازی می‌شود — افزودن یک ورودی دفتر حساب یا خرید هرگز نیاز به انتظار برای سیگنال ندارد.",
        },
        {
          heading: "این برای چه کسانی است",
          body:
            "صاحبان دکان و تاجران در افغانستان که در حال حاضر این اطلاعات را در یک دفترچه کاغذی، در حافظه، یا پیام‌های پراکنده واتساپ نگه می‌دارند و می‌خواهند آن را در یک مکان داشته باشند که بتوانند جستجو، جمع و به اشتراک بگذارند.",
        },
        {
          heading: "تماس با ما",
          body:
            "سوالات، مشکلات، یا نظرات درباره اپلیکیشن — از همان طریقی که حساب شما تنظیم شد تماس بگیرید، یا از طریق جزئیات تماس در صفحه پروفایل دکان.",
        },
      ],
    },
    terms: {
      title: "شرایط استفاده",
      updated: "آخرین بروزرسانی: ۲۰۲۶",
      intro: "با استفاده از سوداگر، شما شرایط زیر را می‌پذیرید.",
      sections: [
        {
          heading: "حساب شما",
          body:
            "حساب شما به شماره موبایل ثبت‌شده و رمز عبوری که هنگام تایید حساب برایتان تنظیم شد وابسته است. رمز عبور خود را محرم نگه دارید — هر کسی که آن را داشته باشد می‌تواند دفتر حساب و ذخیره دکان شما را ببیند و ویرایش کند. اگر گمان می‌کنید شخص دیگری به آن دسترسی دارد، بلافاصله از تنظیمات رمز عبور خود را تغییر دهید.",
        },
        {
          heading: "اطلاعات شما متعلق به شماست",
          body:
            "ورودی‌های دفتر حساب، سوابق ذخیره، و جزئیات مخاطبینی که وارد می‌کنید متعلق به شماست. سوداگر آن‌ها را برای ارائه خدمت نگه می‌دارد و آن‌ها را نمی‌فروشد یا برای چیزی فراتر از اجرای اپلیکیشن استفاده نمی‌کند.",
        },
        {
          heading: "دقت مسئولیت شماست",
          body:
            "سوداگر یک ابزار نگهداری سوابق است. ورودی‌های دفتر حساب منعکس‌کننده چیزی است که شما ثبت می‌کنید و به‌طور مستقل تایید نمی‌شود. ما اختلافات میان شما و یک طرف تجاری در مورد مبلغ یا شرایط یک معامله را حل نمی‌کنیم — اگر اختلافی پیش آمد، معامله را مستقیماً با آن‌ها تایید کنید؛ به اشتراک‌گذاری خلاصه بیلانس واتساپ شما می‌تواند به حل سریع بیشتر این موارد کمک کند.",
        },
        {
          heading: "قیمت‌های بازار",
          body:
            "قیمت‌های نمایش داده شده در اپلیکیشن توسط نمایندگان بازار جهت مرجع آپلود می‌شوند و تضمین نمی‌شود که دقیقاً با هر معامله موجود در یک بازار در یک لحظه مشخص مطابقت داشته باشد. پیش از اتکا به قیمت نمایش داده شده برای یک معامله خاص، شرایط فعلی را مستقیماً با خریدار یا فروشنده تایید کنید.",
        },
        {
          heading: "پلان‌های اشتراک",
          body:
            "آزمایش رایگان — ۳۰ روز، دسترسی کامل، بدون نیاز به پرداخت، به محض تایید حساب شما به صورت خودکار آغاز می‌شود. ماهانه — ۲۵۰ افغانی در ماه. ۶ ماهه — ۱۲۵۰ افغانی (حدود ۱۷٪ کمتر از پرداخت ماهانه).",
        },
        {
          heading: "اگر اشتراک شما به پایان برسد",
          body:
            "شما همیشه می‌توانید سوابق موجود خود را بدون محدودیت زمانی مشاهده کنید. افزودن ورودی‌های جدید نیاز به اشتراک فعال دارد. هر زمان تمدید کنید تا دوباره آغاز شود — هیچ‌چیزی که ثبت کرده‌اید به دلیل پایان اشتراک هرگز پنهان یا حذف نمی‌شود.",
        },
        {
          heading: "بازپرداخت و لغو",
          body:
            "پرداخت‌های اشتراک قابل بازگشت نیستند، از جمله برای زمان استفاده‌نشده. اگر لغو کنید یا تمدید نکنید، دسترسی شما برای افزودن ورودی‌های جدید تا پایان دوره‌ای که قبلاً پرداخت کرده‌اید ادامه می‌یابد.",
        },
        {
          heading: "تغییرات در این شرایط",
          body:
            "این شرایط ممکن است با تغییر اپلیکیشن بروزرسانی شود. ادامه استفاده از سوداگر پس از بروزرسانی به معنای پذیرش شرایط تجدیدنظر شده است.",
        },
      ],
    },
    privacy: {
      title: "سیاست حریم خصوصی",
      updated: "آخرین بروزرسانی: ۲۰۲۶",
      intro: "این توضیح می‌دهد که سوداگر چه اطلاعاتی را جمع‌آوری می‌کند و چگونه از آن استفاده می‌شود.",
      sections: [
        {
          heading: "ما چه چیزی را جمع‌آوری می‌کنیم",
          body:
            "شماره موبایل، نام مالک و دکان، و آدرس دکان شما (از تنظیم حساب و پروفایل دکان شما)؛ ورودی‌های دفتر حساب، مخاطبین، اقلام ذخیره، و قیمت‌هایی که وارد می‌کنید؛ و اگر برای پشتیبانی با ما تماس بگیرید، هر آنچه در آن زمان به اشتراک می‌گذارید.",
        },
        {
          heading: "چگونه استفاده می‌شود",
          body:
            "صرفاً برای اجرای اپلیکیشن برای شما: ورود شما، نمایش دفتر حساب و ذخیره شما، همگام‌سازی ورودی‌های شما بین نشست‌ها، و تولید رسید/صورت‌حساب‌هایی که انتخاب می‌کنید. ما اطلاعات شما را نمی‌فروشیم یا با تبلیغ‌کنندگان به اشتراک نمی‌گذاریم.",
        },
        {
          heading: "کجا ذخیره می‌شود",
          body:
            "اطلاعات شما در یک پایگاه داده میزبانی‌شده توسط Supabase (PostgreSQL) ذخیره می‌شود. یک نسخه کاری نیز در موبایل شما نگه داشته می‌شود (در حافظه محلی مرورگر) تا اپلیکیشن به صورت آفلاین کار کند و پس از اتصال دوباره همگام‌سازی شود — آن نسخه محلی در دستگاه شما باقی می‌ماند.",
        },
        {
          heading: "چه کسی می‌تواند آن را ببیند",
          body:
            "اطلاعات دکان شما برای حساب شما و هر کسی که ورود خود را با او به اشتراک گذاشته‌اید قابل مشاهده است. مدیران سوداگر می‌توانند در صورت نیاز برای ارائه پشتیبانی، تایید حساب‌ها، و پردازش پرداخت‌های اشتراک به اطلاعات حساب دسترسی داشته باشند — نه برای هدف دیگری.",
        },
        {
          heading: "اطلاعات دیگران",
          body:
            "مخاطبین دفتر حساب و طرف‌های تجاری که اضافه می‌کنید (نام‌ها، شماره‌های موبایل، آدرس‌ها) به همان شکل بقیه اطلاعات دکان شما ذخیره می‌شوند. لطفاً فقط افرادی را اضافه کنید که دلیل تجاری واقعی برای نگهداری سوابق آن‌ها دارید.",
        },
        {
          heading: "انتخاب‌های شما",
          body:
            "شما می‌توانید هر زمان پروفایل دکان و شماره واتساپ خود را از تنظیمات بروزرسانی کنید. برای درخواست اصلاح یا حذف اطلاعات حساب خود، از همان طریقی که حساب شما تنظیم شد با ما تماس بگیرید.",
        },
        {
          heading: "تغییرات در این سیاست",
          body: "اگر این سیاست تغییر کند، بروزرسانی با یک تاریخ جدید در بالا در اینجا منعکس خواهد شد.",
        },
      ],
    },
  },
};
