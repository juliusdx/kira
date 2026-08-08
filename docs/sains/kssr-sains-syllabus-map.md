I have enough verified material. Here is the deliverable.

---

# Malaysian KSSR **Sains** Syllabus Map, Years 1–6
### Content backbone for an SJKC (Chinese-medium) primary tuition app — Sabah
**Compiled:** 7 August 2026 · **Curriculum in force:** KSSR Semakan 2017

---

## 0. How to read this document (accuracy flags)

| Flag | Meaning |
|---|---|
| ✅ **SOURCED** | Taken directly from a DSKP document (or official KPM PDF) fetched during this research. Source URL given. |
| 🟡 **PARTIAL** | Structure sourced, but one or more sub-items were not visible in the extract; noted per item. |
| 🔶 **TRANSLATED** | Malay/English sourced; the Chinese rendering is my translation, *not* lifted from the official DSKP SJKC edition. Needs a native/textbook check before shipping. |
| ⚠️ **INFERRED** | My judgement, not from a source. Treat as a hypothesis. |

**One overarching caveat:** `bpk.moe.gov.my` (the primary BPK portal) was **blocked at the network layer** throughout this research (HTTP 403 at the proxy on every attempt). Every topic list below therefore comes from **mirrors of the official DSKP PDFs** (AnyFlip/FlipHTML5/SlideShare uploads of the KPM-issued documents, plus two PDFs served directly from `moe.gov.my`). These mirrors are the genuine DSKP files, but they have not been byte-compared against the BPK originals. **Before locking the app's content schema, re-download the six DSKP PDFs from `bpk.moe.gov.my` on an unrestricted connection and diff against this map.**

---

## 1. Currency check — is KSSR Semakan 2017 still the syllabus in 2026?

**Yes, for Years 1–6 in 2026.** ✅ SOURCED

But a full national curriculum replacement is already in motion, and it matters for app roadmap planning:

| Item | Status |
|---|---|
| **KSSR Semakan 2017** | Current and in force for **all of Years 1–6 in 2026**. This is what you build against today. |
| **KP2026 (Kurikulum Prasekolah 2026)** | Preschool only. Rolled out **2026**. Does not affect Years 1–6. |
| **KP2027 (Kurikulum Persekolahan 2027)** | Replaces KSSR/KSSM. Starts with **Year 1 and Form 1 in 2027**, then advances one cohort per year. |
| **KSSR Semakan 2017 sunset** | Continues for the cohorts already inside it — reported as remaining in use **"until at least 2031"** as KP2027 works its way up. |

**Critical planning point for a Science app:** under KP2027, **Sains is reported to no longer be taught as a standalone subject in Year 1**. It is folded into a new integrated subject provisionally named **"Alam dan Manusia"** (Science + Health + Music + Art + Digital + TVET), taught thematically/project-based. Science reportedly returns as a standalone subject at upper primary (Years 5–6).

⚠️ **INFERRED implication:** your Year 1 Science content has a shelf life ending roughly **January 2027**; Years 2–6 content remains valid for several more years, sliding out one year at a time (Year 2 content valid to ~2028, Year 3 to ~2029, etc.). Build the year-level content as independently versioned modules rather than one monolith.

🟡 **PARTIAL / needs confirmation:** the KP2027 details (especially the Year-1 Science removal and the "Alam dan Manusia" subject name) come from Malaysian education news sites and a well-regarded teacher blog, **not** from a KPM primary document — because BPK was unreachable. The *provisional* status of the subject name is stated in the sources themselves. **Verify against the KPM "Kerangka Kurikulum Persekolahan 2027" document before making product decisions on it.**

Sources: [ecentral.my — Kurikulum Persekolahan 2027](https://ecentral.my/kurikulum-persekolahan-2027/) · [Cikgu Hijau — Rumusan KP2027](https://www.cikguhijau.com/2025/02/rumusan-kurikulum-persekolahan-2027.html) · [Cikgu Hijau — Kerangka KP2027](https://www.cikguhijau.com/2025/02/kerangka-kurikulum-persekolahan-2027.html)

---

## 2. Curriculum architecture

KSSR Sains organises **every** year level into the same **six Tema (themes)**. This is stable across Years 1–6 and is the correct top-level nav for the app. ✅ SOURCED (all six DSKP editions)

| # | Bahasa Melayu | English | 中文 |
|---|---|---|---|
| 1 | **Inkuiri dalam Sains** | Scientific Inquiry | **科学探究** |
| 2 | **Sains Hayat** | Life Science | **生命科学** |
| 3 | **Sains Fizikal** | Physical Science | **物理科学** |
| 4 | **Sains Bahan** | Material Science | **材料科学** |
| 5 | **Bumi dan Angkasa** | Earth and Space | **地球与宇宙** |
| 6 | **Teknologi dan Kehidupan Lestari** | Technology and Sustainable Living | **工艺与优质生活** |

**Document hierarchy** (use this as your data model):

```
Tema (theme, 6 fixed)
└── Tajuk (topic, numbered 1.0, 2.0, …)     ← the "unit" a worksheet targets
    └── Standard Kandungan (SK, e.g. 5.2)   ← content standard
        └── Standard Pembelajaran (SP, e.g. 5.2.1)  ← the assessable statement
            └── Tahap Penguasaan TP1–TP6    ← PBD performance level
```

Chinese equivalents used in the SJKC DSKP: **主题/领域** (Tema) · **课题** (Tajuk) · **内容标准** (Standard Kandungan) · **学习标准** (Standard Pembelajaran) · **掌握程度** (Tahap Penguasaan). ✅ SOURCED

**Note on the SJKC editions:** KPM publishes a **separate, fully-Chinese DSKP Sains edition for SJKC** for every year level (alongside SK and SJKT editions). This is direct confirmation that Sains in SJKC is taught and assessed **in Mandarin**. The Chinese terms below marked ✅ are lifted from those official SJKC editions. The Dual Language Programme (DLP), which teaches Sains in English, is primarily an SK-stream option and is **not** the SJKC default. ✅ SOURCED (existence of official SJKC DSKP editions)

**Structural pattern worth knowing:** Years 1, 2 and 3 (Tahap 1) each open with **two** inquiry topics — `1.0 Kemahiran Saintifik` and `2.0 Peraturan Bilik Sains`. Years 4, 5 and 6 (Tahap 2) open with **one** — `1.0 Kemahiran Saintifik` only; lab rules are assumed mastered. ✅ SOURCED

---

## 3. TAHUN 1 (一年级)

✅ **SOURCED.** Malay topic list and Standard Kandungan wording verified across three independent mirrors; Chinese verified against the official SJKC edition.

Sources: [DSKP Sains Tahun 1, pp.51–66](https://anyflip.com/gcmje/tqim/basic/51-66) · [DSKP KSSR Sains Tahun 1, pp.1–50](https://anyflip.com/ittl/ckao/basic) · [Penjajaran KSSR Sains Tahun 1 (SK list)](https://anyflip.com/ljsk/kghk/basic) · [DSKP KSSR Semakan 2017 Sains Tahun 1 **SJKC**](https://www.slideshare.net/slideshow/dskp-kssr-semakan-2017-sains-tahun-1-sjkc/238141332)

### Tema 1 — Inkuiri dalam Sains 科学探究

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** ✅ | Observe using the senses and communicate findings; handle basic apparatus correctly. (SK 1.1 Kemahiran Proses Sains **科学程序技能**; SK 1.2 Kemahiran Manipulatif **操纵性技能**) ✅ |
| **2.0** | Peraturan Bilik Sains | Science Room Rules | **科学室的规则** ✅ | Follow science-room safety rules. (SK 2.1) ✅ |

### Tema 2 — Sains Hayat 生命科学

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **3.0** | Benda Hidup dan Benda Bukan Hidup | Living and Non-living Things | **生物和非生物** ✅ | Distinguish living from non-living things, and state the basic needs of living things (food, water, air, shelter). (SK 3.1 *Benda hidup dan benda bukan hidup* **生物和非生物**; SK 3.2 *Keperluan asas benda hidup* **生物的基本需求**) ✅ |
| **4.0** | Manusia | Humans | **人类** ✅ | Name the five sense organs and the sense each performs; relate senses to daily life. (SK 4.1 *Deria manusia* **人类的感觉官能**) ✅ |
| **5.0** | Haiwan | Animals | **动物** ✅ | Name external body parts of animals and their functions. (SK 5.1 *Bahagian tubuh haiwan* **动物的身体部位**) ✅ |
| **6.0** | Tumbuhan | Plants | **植物** ✅ | Name the parts of a plant (root, stem, leaf, flower, fruit) and their functions. (SK 6.1 *Bahagian tumbuhan* **植物的部位**) ✅ |

### Tema 3 — Sains Fizikal 物理科学

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **7.0** | Magnet | Magnets | **磁铁** ✅ | Identify magnetic vs non-magnetic materials; state that magnets attract/repel and name everyday uses. (SK 7.1 *Magnet* **磁铁**) ✅ |

### Tema 4 — Sains Bahan 材料科学

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **8.0** | Penyerapan | Absorption | **吸水力** 🔶 | Compare the water-absorbing ability of different materials and choose suitable materials. (SK 8.1 *Keupayaan bahan menyerap air* **材料的吸水力** ✅) |

🔶 The **SK-level** Chinese `材料的吸水力` is sourced; the *topic-level* heading `吸水力` is my compression of it.

### Tema 5 — Bumi dan Angkasa 地球与宇宙

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **9.0** | Bumi | Earth | **地球** ✅ | Identify Earth's surface features (hill, valley, river, sea, plain) and describe types/uses of soil. (SK 9.1 *Bentuk muka Bumi* **地球表面的形状**; SK 9.2 *Tanah* **土壤**) ✅ |

### Tema 6 — Teknologi dan Kehidupan Lestari 工艺与优质生活

| Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|
| **10.0** | Asas Binaan | Basic Construction | **基本建构** 🔶 | Build a model from basic solid shapes and explain the choice of shapes. (SK 10.1 *Binaan daripada bongkah bentuk asas* **以基本立体形状创作模型** ✅) |

**Key vocabulary (Year 1)** 🔶 *Compiled by me from DSKP terminology; the Chinese terms marked ✅ above are official, the rest are my renderings — have an SJKC teacher verify.*
benda hidup 生物 living thing · benda bukan hidup 非生物 non-living thing · deria 感官 sense · penglihatan 视觉 sight · pendengaran 听觉 hearing · bau 嗅觉 smell · rasa 味觉 taste · sentuhan 触觉 touch · akar 根 root · batang 茎 stem · daun 叶 leaf · bunga 花 flower · buah 果实 fruit · magnet 磁铁 magnet · menarik 吸引 attract · menolak 排斥 repel · menyerap 吸收 absorb · tanah 土壤 soil · bukit 山丘 hill · lembah 山谷 valley

---

## 4. TAHUN 2 (二年级)

✅ **SOURCED.** Malay list from the DSKP; Chinese topic names independently confirmed from a Year 2 SJKC science textbook table of contents — the two match exactly, topic for topic.

Sources: [DSKP KSSR Sains Tahun 2, pp.51–80](https://anyflip.com/ittl/pkii/basic/51-80) · [DSKP KSSR Semakan 2017 Sains Tahun 2 **SJKC**](https://anyflip.com/zkumo/lggx/basic) · [二年级科学 (SJKC Year 2 Science, TOC)](https://anyflip.com/fnvvi/sfvd/basic)

| Tema | Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|---|
| 科学探究 | **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** ✅ | Observe, classify, measure & use numbers, and communicate; handle, sketch, clean and store apparatus. (SK 1.1 KPS; SK 1.2 Kemahiran Manipulatif) ✅ |
| 科学探究 | **2.0** | Peraturan Bilik Sains | Science Room Rules | **科学室规则** ✅ | Comply with science-room rules. (SK 2.1) ✅ |
| 生命科学 | **3.0** | Manusia | Humans | **人类** ✅ | Describe human reproduction and growth, and the stages of human growth. (SK 3.1 *Pembiakan dan tumbesaran manusia*) ✅ |
| 生命科学 | **4.0** | Haiwan | Animals | **动物** ✅ | Describe how animals reproduce and grow; compare young and adult animals. (SK 4.1 *Pembiakan dan tumbesaran haiwan*) ✅ |
| 生命科学 | **5.0** | Tumbuhan | Plants | **植物** ✅ | Describe plant growth and the conditions plants need to grow. (SK 5.1 *Tumbesaran tumbuhan*) ✅ |
| 物理科学 | **6.0** | Terang dan Gelap | Light and Dark | **光和暗** ✅ | Identify light sources; explain that darkness is the absence of light; relate to shadows. (SK 6.1 *Terang dan gelap*) ✅ |
| 物理科学 | **7.0** | Elektrik | Electricity | **电** ✅ | Identify electrical sources and build/complete a simple electric circuit. (SK 7.1 *Litar elektrik*) ✅ |
| 材料科学 | **8.0** | Campuran | Mixtures | **混合物** ✅ | Make mixtures and separate them by suitable methods. (SK 8.1 *Campuran*) ✅ |
| 地球与宇宙 | **9.0** | Bumi | Earth | **地球** ✅ | Describe water sources and their importance; show that air occupies space and has mass. (SK 9.1 *Air*; SK 9.2 *Udara*) ✅ |
| 工艺与优质生活 | **10.0** | Teknologi | Technology | **工艺** ✅ | Build a model using a construction set and explain its function. (SK 10.1 *Set binaan*) ✅ |

🔶 SK-level Chinese wordings for Year 2 were **not** captured verbatim from the SJKC DSKP (the fetched extract only reached topic level). Topic-level Chinese is ✅ SOURCED from two independent documents; treat SK-level Chinese as still to be transcribed.

**Key vocabulary (Year 2)** 🔶 pembiakan 繁殖 reproduction · tumbesaran 成长 growth · bayi 婴儿 baby · dewasa 成人 adult · sumber cahaya 光源 light source · bayang-bayang 影子 shadow · litar 电路 circuit · mentol 灯泡 bulb · bateri 电池 battery · suis 开关 switch · wayar 电线 wire · campuran 混合物 mixture · menapis 过滤 filter · udara 空气 air · isi padu 体积 volume

---

## 5. TAHUN 3 (三年级)

✅ **SOURCED.** Malay and Chinese both verified from the respective official editions.

Sources: [DSKP Sains Tahun 3, pp.51–88](https://anyflip.com/gcmje/aphd/basic/51-88) · [DSKP Sains Tahun 3, pp.1–50](https://anyflip.com/gcmje/aphd/basic) · [DSKP KSSR Semakan 2017 Sains Tahun 3 **SJKC** v2](https://www.slideshare.net/slideshow/dskp-kssr-semakan-2017-tahun-3-sains-sjkc-pdf/270039629) · [DSKP Sains Tahun 3 SJKC (AnyFlip)](https://anyflip.com/ceydd/ytcw/basic)

| Tema | Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|---|
| 科学探究 | **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** ✅ | Apply the six basic science process skills and the five manipulative skills. (SK 1.1 **科学程序技能**; SK 1.2 **操纵性技能**) ✅ |
| 科学探究 | **2.0** | Peraturan Bilik Sains | Science Room Rules | **科学室的规则** ✅ | Comply with science-room rules. (SK 2.1) ✅ |
| 生命科学 | **3.0** | Manusia | Humans | **人类** ✅ | Name types of teeth and their functions and care; classify food into food classes; sequence the human digestive process. (SK 3.1 *Gigi* **牙齿**; SK 3.2 *Kelas makanan* **营养素**; SK 3.3 *Pencernaan* **消化**) ✅ |
| 生命科学 | **4.0** | Haiwan | Animals | **动物** ✅ | Classify animals by feeding habit (herbivore / carnivore / omnivore) and relate to mouth structure. (SK 4.1 *Tabiat pemakanan* **进食习性**) ✅ |
| 生命科学 | **5.0** | Tumbuhan | Plants | **植物** ✅ | Identify how plants reproduce (seeds, spores, vegetative parts). (SK 5.1 *Pembiakan tumbuhan* **植物的繁殖**) ✅ |
| 物理科学 | **6.0** | Pengukuran | Measurement | **测量** ✅ | Measure area and volume using standard units and appropriate tools. (SK 6.1 *Pengukuran luas dan isi padu* **测量面积和体积**) ✅ |
| 物理科学 | **7.0** | Ketumpatan | Density | **密度** ✅ | Determine whether an object/material is denser or less dense than water (sink/float). (SK 7.1 *Objek atau bahan yang lebih tumpat atau kurang tumpat daripada air* **密度比水大或比水小的物体或材料**) ✅ |
| 材料科学 | **8.0** | Asid dan Alkali | Acids and Alkalis | **酸与碱** ✅ | Identify acidic, alkaline and neutral substances by taste/texture and litmus test. (SK 8.1 *Asid dan alkali* **酸与碱**) ✅ |
| 地球与宇宙 | **9.0** | Sistem Suria | Solar System | **太阳系** 🔶 | Name the members of the Solar System and describe the sequence/relative sizes of the planets. (SK 9.1 *Sistem Suria*) ✅ |
| 工艺与优质生活 | **10.0** | Mesin | Machines | **机械** 🔶 | Explain how a pulley works and build a device using a pulley to lift a load. (SK 10.1 *Takal* — pulley, **滑轮**) ✅ |

🔶 Chinese headings for topics **9.0** and **10.0**: the SJKC extract confirmed the *content* (Solar System / pulleys, and `滑轮` for Takal) but the exact Chinese topic headings `太阳系` / `机械` were not read off verbatim. `机械` is strongly supported because it is the confirmed Chinese heading for the identically-named `Mesin` topic in Years 4 and 5. ✅ for Years 4/5 `机械`.

**Key vocabulary (Year 3)** 🔶 gigi kacip 门牙 incisor · gigi taring 犬齿 canine · gigi geraham 臼齿 molar · karbohidrat 碳水化合物 carbohydrate · protein 蛋白质 protein · lemak 脂肪 fat · vitamin 维生素 vitamin · mineral 矿物质 mineral · pencernaan 消化 digestion · herbivor 草食动物 herbivore · karnivor 肉食动物 carnivore · omnivor 杂食动物 omnivore · luas 面积 area · isi padu 体积 volume · ketumpatan 密度 density · timbul 浮 float · tenggelam 沉 sink · asid 酸 acid · alkali 碱 alkali · neutral 中性 neutral · kertas litmus 石蕊试纸 litmus paper · takal 滑轮 pulley · planet 行星 planet

---

## 6. TAHUN 4 (四年级)

✅ **SOURCED.** Malay list verified; Chinese verified from the official SJKC edition **for topics 4.0–10.0 only**.

Sources: [DSKP Sains Tahun 4, pp.51–94](https://anyflip.com/gcmje/zxee/basic/51-94) · [DSKP KSSR Semakan 2017 Sains Tahun 4, pp.1–50](https://anyflip.com/awis/ndqq/basic) · [DSKP KSSR Semakan 2017 Sains Tahun 4 **SJKC**, pp.51–74](https://anyflip.com/zkumo/wfmr/basic/51-74)

| Tema | Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|---|
| 科学探究 | **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** 🔶 | Apply science process skills, now including interpreting data and controlling variables. (SK 1.1) ✅ |
| 生命科学 | **2.0** | Manusia | Humans | **人类** 🔶 | Describe the human breathing process and organs; describe excretion and defecation; describe how humans respond to stimuli. (SK 2.1 *Pernafasan manusia*; 2.2 *Perkumuhan dan penyahtinjaan*; 2.3 *Manusia bergerak balas terhadap rangsangan*) ✅ |
| 生命科学 | **3.0** | Haiwan | Animals | **动物** 🔶 | Identify animal breathing organs (lungs, gills, skin, spiracles); classify vertebrates into the five groups. (SK 3.1 *Organ pernafasan haiwan*; 3.2 *Haiwan vertebrata*) ✅ |
| 生命科学 | **4.0** | Tumbuhan | Plants | **植物** ✅ | Describe plant responses to stimuli (light, water, touch, gravity); explain photosynthesis and its requirements/products. (SK 4.1 **植物对外来刺激作出的反应**; 4.2 *Fotosintesis* **光合作用**) ✅ |
| 物理科学 | **5.0** | Sifat Cahaya | Properties of Light | **光的特性** ✅ | Show that light travels in a straight line; explain reflection and refraction of light. (SK 5.1 **光沿着直线传播**; 5.2 *Pantulan cahaya* **光的反射**; 5.3 *Pembiasan cahaya* **光的折射**) ✅ |
| 物理科学 | **6.0** | Bunyi | Sound | **声音** ✅ | Explain that sound is produced by vibration, travels through media, and can be reflected/absorbed. (SK 6.1 *Bunyi*) ✅ |
| 物理科学 | **7.0** | Tenaga | Energy | **能** ✅ | Identify sources and forms of energy and energy transformations; distinguish renewable from non-renewable sources. (SK 7.1 **能的来源和能的形式**; 7.2 **可更新能源和不可更新能源**) ✅ |
| 材料科学 | **8.0** | Bahan | Materials | **材料** ✅ | Identify the natural/man-made sources of materials; investigate material properties and match material to use. (SK 8.1 *Sumber asas bahan* **材料的来源**; 8.2 *Sifat bahan* **材料的性质**) ✅ |
| 地球与宇宙 | **9.0** | Bumi | Earth | **地球** ✅ | Explain Earth's gravity and its effects; explain Earth's rotation and revolution, and day/night. (SK 9.1 *Graviti Bumi* **地球的地心引力**; 9.2 *Putaran dan peredaran Bumi* **地球的自转与公转**) ✅ |
| 工艺与优质生活 | **10.0** | Mesin | Machines | **机械** ✅ | Identify the three classes of levers and their parts; distinguish simple from complex machines. (SK 10.1 *Tuas* **杠杆**; 10.2 **简单机械和复杂机械**) ✅ |

🔶 Chinese for topics **1.0, 2.0, 3.0** (and their SKs) was not in the fetched SJKC page range (which began at 4.0). `人类` and `动物` are ✅ SOURCED as headings in the Year 1, 2, 3, 5 and 6 SJKC editions, so their use here is near-certain, but the Year-4 SK-level Chinese (e.g. for *Pernafasan manusia*, *Haiwan vertebrata*) is **not yet transcribed** — pull it from [DSKP Sains Tahun 4 SJKC pp.1–50](https://anyflip.com/zkumo/wfmr/basic).

**Key vocabulary (Year 4)** 🔶 pernafasan 呼吸 respiration · peparu 肺 lungs · insang 鳃 gills · spirakel 气门 spiracle · perkumuhan 排泄 excretion · penyahtinjaan 排便 defecation · rangsangan 刺激 stimulus · gerak balas 反应 response · vertebrata 脊椎动物 vertebrate · fotosintesis 光合作用 photosynthesis · klorofil 叶绿素 chlorophyll · glukosa 葡萄糖 glucose · pantulan 反射 reflection · pembiasan 折射 refraction · getaran 振动 vibration · tenaga 能量 energy · boleh dibaharui 可更新 renewable · graviti 地心引力 gravity · putaran 自转 rotation · peredaran 公转 revolution · tuas 杠杆 lever · fulkrum 支点 fulcrum · beban 负载 load · daya 力 force

---

## 7. TAHUN 5 (五年级)

✅ **SOURCED.** Both Malay and Chinese verified from their respective official editions.

Sources: [DSKP Sains Tahun 5, pp.51–88](https://anyflip.com/gcmje/zbvz/basic/51-88) · [DSKP KSSR Semakan 2017 Sains Tahun 5 **SJKC**, pp.51–76](https://anyflip.com/rocat/zjwp/basic/51-76) · [DSKP Sains Tahun 5 SJKC, pp.1–50](https://anyflip.com/rocat/zjwp/basic)

| Tema | Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|---|
| 科学探究 | **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** ✅ | Apply science process skills including hypothesising and experimenting. (SK 1.1 **科学程序技能**) ✅ |
| 生命科学 | **2.0** | Manusia | Humans | **人类** ✅ | Describe the human skeletal system and its functions; describe the blood circulatory system; explain how body systems are interrelated. (SK 2.1 **人体的骨骼系统**; 2.2 **人体的血液循环系统**; 2.3 **人体系统之间的关联**) ✅ |
| 生命科学 | **3.0** | Haiwan | Animals | **动物** ✅ | Explain how animals survive as a species (protection of self and young); design and build an animal model; describe food chains and food webs. (SK 3.1 *Kemandirian spesies haiwan* **动物的物种生存**; 3.2 *Mereka cipta model haiwan* **设计与制作动物模型**; 3.3 *Hubungan makanan antara hidupan* **生物之间食与被食的关系**) ✅ |
| 生命科学 | **4.0** | Tumbuhan | Plants | **植物** ✅ | Explain how plants survive as a species; describe the methods of seed/fruit dispersal. (SK 4.1 *Kemandirian spesies tumbuhan* **植物物种的生存**; 4.2 *Pencaran biji benih* **种子或果实的传播**) ✅ |
| 物理科学 | **5.0** | Elektrik | Electricity | **电** ✅ | Identify sources of electrical energy; build and compare series and parallel circuits; practise electrical safety and energy saving. (SK 5.1 *Sumber tenaga elektrik* **电源**; 5.2 *Litar bersiri dan litar selari* **串联电路和并联电路**; 5.3 **安全使用电器和节省电源**) ✅ |
| 物理科学 | **6.0** | Haba | Heat | **热** ✅ | Distinguish heat from temperature; explain expansion and contraction of matter when heated/cooled. (SK 6.1 *Haba dan suhu* **热和温度**) ✅ |
| 材料科学 | **7.0** | Pengaratan | Rusting | **生锈** ✅ | Identify the conditions that cause rusting and ways to prevent it. (SK 7.1 *Pengaratan bahan*) ✅ |
| 材料科学 | **8.0** | Jirim | Matter | **物质** ✅ | Describe the three states of matter; explain the changes of state of water (melting, freezing, boiling, evaporation, condensation) and the water cycle. (SK 8.1 *Keadaan jirim* **物质的形态**; 8.2 *Perubahan keadaan jirim bagi air* **水的形态变化**) ✅ |
| 地球与宇宙 | **9.0** | Fasa Bulan dan Buruj | Phases of the Moon and Constellations | **月相与星座** ✅ | Describe and sequence the phases of the Moon; identify constellations and their uses. (SK 9.1 *Fasa bulan* **月相**; 9.2 *Buruj* **星座**) ✅ |
| 工艺与优质生活 | **10.0** | Mesin | Machines | **机械** ✅ | Identify simple machines in tools used in daily life and choose the right tool for a task. (SK 10.1 *Penggunaan alat dalam kehidupan* **生活中所使用的工具**) ✅ |

⚠️ One inconsistency to be aware of: the SJKC extract appeared to place *水的形态变化* (changes of state of water) under topic **6.0 热** as well as under **8.0 物质**. The Malay DSKP places it unambiguously under **8.2** only. I have followed the Malay DSKP. This is likely an extraction artefact rather than a real difference between editions, but worth a 30-second check against the SJKC PDF.

**Key vocabulary (Year 5)** 🔶 rangka 骨骼 skeleton · tengkorak 头骨 skull · tulang rusuk 肋骨 ribs · sistem peredaran darah 血液循环系统 circulatory system · jantung 心脏 heart · salur darah 血管 blood vessel · kemandirian 生存 survival · rantai makanan 食物链 food chain · siratan makanan 食物网 food web · pengeluar 生产者 producer · pengguna 消费者 consumer · pencaran 传播 dispersal · litar bersiri 串联电路 series circuit · litar selari 并联电路 parallel circuit · haba 热 heat · suhu 温度 temperature · pengembangan 膨胀 expansion · pengecutan 收缩 contraction · pengaratan 生锈 rusting · jirim 物质 matter · pepejal 固体 solid · cecair 液体 liquid · gas 气体 gas · peleburan 熔化 melting · pemeluwapan 凝结 condensation · penyejatan 蒸发 evaporation · kitaran air 水循环 water cycle · fasa bulan 月相 moon phase · buruj 星座 constellation

---

## 8. TAHUN 6 (六年级)

✅ **SOURCED.** Both Malay and Chinese verified. Note Year 6 has **13 topics** — the heaviest year by a wide margin, and both independent sources agree on all 13.

Sources: [DSKP Sains Tahun 6, pp.51–94](https://anyflip.com/gcmje/iumj/basic/51-94) · [DSKP KSSR Semakan 2017 Sains Tahun 6 **SJKC** (direct PDF)](https://asiemodel.net/wp-content/uploads/2022/08/8.-DSKP-KSSR-Semakan-2017-Sains-Tahun-6_SJKC_ISBN.pdf) · [DSKP KSSR Sains Tahun 6, pp.51–94 (2nd mirror)](https://anyflip.com/ittl/eguz/basic/51-94)

| Tema | Tajuk | BM | English | 中文 | Pupils must be able to… |
|---|---|---|---|---|---|
| 科学探究 | **1.0** | Kemahiran Saintifik | Scientific Skills | **科学技能** ✅ | Apply the full set of basic and integrated science process skills. (SK 1.1 **科学程序技能**) ✅ |
| 生命科学 | **2.0** | Manusia | Humans | **人类** ✅ | Describe human reproduction (male/female reproductive systems, menstruation, fertilisation); describe the nervous system and its role in responding to stimuli. (SK 2.1 *Pembiakan manusia* **人类的繁殖**; 2.2 *Sistem saraf* **神经系统**) ✅ |
| 生命科学 | **3.0** | Mikroorganisma | Microorganisms | **微生物** ✅ | Describe the life processes of microorganisms and their beneficial and harmful effects. (SK 3.1 **微生物的生命过程与其影响**) ✅ |
| 生命科学 | **4.0** | Interaksi antara Hidupan | Interaction Between Living Things | **生物之间的相互关系** ✅ | Explain interactions among animals and among plants (competition, prey–predator, symbiosis). (SK 4.1 *Interaksi antara haiwan* **动物之间的相互关系**; 4.2 *Interaksi antara tumbuhan* **植物之间的相互关系**) ✅ |
| 生命科学 | **5.0** | Pemeliharaan dan Pemuliharaan | Preservation and Conservation | **保护和复育** ✅ | Justify the need for preservation and conservation to maintain the balance of nature. (SK 5.1 **保护与复育以维持自然界平衡**) ✅ |
| 物理科学 | **6.0** | Daya | Force | **力** ✅ | Describe force and its effects; explain friction and its advantages/disadvantages; explain air pressure and its applications. (SK 6.1 *Daya dan kesannya* **力和力的效应**; 6.2 *Daya geseran* **摩擦力**; 6.3 *Tekanan udara* **气压**) ✅ |
| 物理科学 | **7.0** | Kelajuan | Speed | **速度** ✅ | Calculate the speed of an object using speed = distance ÷ time and compare speeds. (SK 7.1 *Kelajuan objek* **速度**) ✅ |
| 材料科学 | **8.0** | Teknologi Pengawetan Makanan | Food Preservation Technology | **食物保存科技** ✅ | Explain the causes of food spoilage; describe and apply food preservation methods. (SK 8.1 *Kerosakan makanan* **食物的变质**; 8.2 *Pengawetan makanan* **食物保存**) ✅ |
| 材料科学 | **9.0** | Bahan Buangan | Waste Materials | **废物** ✅ | Classify waste and justify proper waste management (reduce, reuse, recycle). (SK 9.1 *Pengurusan bahan buangan* **废物处理**) ✅ |
| 地球与宇宙 | **10.0** | Gerhana | Eclipses | **日食与月食** ✅ | Explain the natural phenomena of lunar and solar eclipses using the positions of Sun, Earth and Moon. (SK 10.1 **月食和日食的自然现象**) ✅ |
| 地球与宇宙 | **11.0** | Galaksi | Galaxy | **星系** ✅ | Describe the Milky Way galaxy and the position of the Solar System within it. (SK 11.1 *Galaksi Bima Sakti* **银河系**) ✅ |
| 工艺与优质生活 | **12.0** | Kestabilan dan Kekuatan | Stability and Strength | **平稳性和坚固性** ✅ | Investigate the factors affecting the stability and strength of objects and structures. (SK 12.1 **物体和建筑的平稳性和坚固性**) ✅ |
| 工艺与优质生活 | **13.0** | Teknologi | Technology | **工艺** ✅ | Evaluate the advantages and disadvantages of technology. (SK 13.1 *Kebaikan dan keburukan teknologi* **工艺的利与弊**) ✅ |

**Key vocabulary (Year 6)** 🔶 pembiakan 繁殖 reproduction · persenyawaan 受精 fertilisation · haid 月经 menstruation · sistem saraf 神经系统 nervous system · otak 大脑 brain · saraf tunjang 脊髓 spinal cord · mikroorganisma 微生物 microorganism · bakteria 细菌 bacteria · kulat 真菌 fungi · virus 病毒 virus · protozoa 原生动物 protozoa · alga 藻类 algae · persaingan 竞争 competition · mangsa 猎物 prey · pemangsa 捕食者 predator · simbiosis 共生 symbiosis · pemeliharaan 保护 preservation · pemuliharaan 复育 conservation · daya 力 force · geseran 摩擦力 friction · tekanan udara 气压 air pressure · kelajuan 速度 speed · jarak 距离 distance · masa 时间 time · pengawetan 保存 preservation (food) · pengeringan 干燥 drying · penyejukbekuan 冷冻 freezing · kitar semula 回收 recycle · gerhana bulan 月食 lunar eclipse · gerhana matahari 日食 solar eclipse · umbra 本影 umbra · penumbra 半影 penumbra · galaksi 星系 galaxy · Bima Sakti 银河系 Milky Way · kestabilan 平稳性 stability · kekuatan 坚固性 strength

---

## 9. Kemahiran Proses Sains (Science Process Skills) 科学程序技能

✅ **SOURCED** from the Malay DSKP Sains Tahun 3 (pp.1–50) and the SJKC editions. These run through **every** year as topic `1.0`.

### 9.1 Kemahiran Proses Sains Asas (Basic) 基础科学程序技能

| BM | English | 中文 🔶 |
|---|---|---|
| Memerhati | Observing | 观察 ✅ |
| Mengelas | Classifying | 分类 ✅ |
| Mengukur dan menggunakan nombor | Measuring and using numbers | 测量与使用数字 ✅ |
| Membuat inferens | Inferring | 推断 ✅ |
| Meramal | Predicting | 预测 ✅ |
| Berkomunikasi | Communicating | 沟通 ✅ |
| Menggunakan perhubungan ruang dan masa | Using space–time relationships | 使用时空关系 🔶 |

The DSKP explicitly identifies the **first six** as the set emphasised in **Tahap 1 (Years 1–3)**. ✅ SOURCED

### 9.2 Kemahiran Proses Sains Bersepadu (Integrated) 综合科学程序技能

| BM | English | 中文 🔶 |
|---|---|---|
| Mentafsir data | Interpreting data | 诠释数据 🔶 |
| Mendefinisi secara operasi | Defining operationally | 操作性定义 🔶 |
| Mengawal pemboleh ubah | Controlling variables | 控制变因 🔶 |
| Membuat hipotesis | Hypothesising | 假设 🔶 |
| Mengeksperimen | Experimenting | 实验 🔶 |

These appear progressively from **Tahap 2 (Years 4–6)**. ⚠️ INFERRED as to exact year-by-year introduction — the DSKP lists them as the integrated set without my having verified the per-year phase-in table.

### 9.3 Kemahiran Manipulatif (Manipulative Skills) 操纵性技能

✅ **SOURCED verbatim** (DSKP Sains Tahun 3). Five statements, identical across years:

1. *Menggunakan dan mengendalikan peralatan dan bahan sains dengan betul* — Use and handle science apparatus and substances correctly — 正确使用和操作科学器材与物质
2. *Mengendalikan spesimen dengan betul dan cermat* — Handle specimens correctly and carefully — 正确且小心地处理标本
3. *Melakar spesimen, peralatan dan bahan sains dengan betul* — Sketch specimens, apparatus and substances correctly — 正确绘画标本、器材和物质
4. *Membersihkan peralatan sains dengan cara yang betul* — Clean science apparatus in the correct way — 以正确的方式清洗科学器材
5. *Menyimpan peralatan dan bahan sains dengan betul dan selamat* — Store apparatus and substances correctly and safely — 正确且安全地收存科学器材与物质

🔶 Chinese renderings above are mine; the strand name **操纵性技能** is ✅ SOURCED.

**App implication:** these five are assessable SPs under SK 1.2 in Years 1–3. Worksheets can legitimately carry TP markers against them, so don't model them as "non-assessable admin content."

---

## 10. PBD — Pentaksiran Bilik Darjah 课堂评估 · Tahap Penguasaan TP1–TP6

✅ **SOURCED.** Malay descriptors verbatim from DSKP Sains Tahun 3; Chinese verbatim from DSKP Sains Tahun 3 SJKC. This is the **Science-specific** version of the TP scale — note the Malay includes affective/scientific-attitude riders (*menunjukkan minat*, *jujur*, *berani mencuba*, *bekerjasama*, *bertanggungjawab*) that the generic KPM scale does not.

| TP | Bahasa Melayu (verbatim ✅) | English 🔶 | 中文 (verbatim ✅) |
|---|---|---|---|
| **TP1** | *Mengingat kembali pengetahuan dan kemahiran asas sains serta menunjukkan minat* | Recalls basic science knowledge and skills, and shows interest | 忆起科学的基本知识和技能 |
| **TP2** | *Memahami pengetahuan dan kemahiran sains serta dapat menjelaskan kefahaman tersebut di samping menunjukkan sifat ingin tahu* | Understands science knowledge and skills and can explain that understanding, while showing curiosity | 明白科学的知识和技能以及能够解释所明白的事项 |
| **TP3** | *Mengaplikasikan pengetahuan dan kemahiran sains untuk melaksanakan tugasan mudah dengan jujur serta merekod data dengan tepat* | Applies science knowledge and skills to carry out simple tasks honestly and records data accurately | 应用科学的知识和技能来实践简单的任务 |
| **TP4** | *Menganalisis pengetahuan dan kemahiran sains dalam konteks penyelesaian masalah secara bersistematik serta berani mencuba* | Analyses science knowledge and skills systematically in problem-solving contexts, and is willing to try | 分析科学知识和技能，以解决在某种情况下的问题 |
| **TP5** | *Menilai pengetahuan dan kemahiran sains dalam konteks penyelesaian masalah dan membuat keputusan untuk melaksanakan satu tugasan secara bekerjasama, rajin dan tabah* | Evaluates science knowledge and skills in problem-solving and decision-making to complete a task, working cooperatively, diligently and persistently | 评估科学知识和技能，以在进行一项任务时能解决问题并作出决定 |
| **TP6** | *Mereka cipta menggunakan pengetahuan dan kemahiran sains dalam konteks penyelesaian masalah secara kreatif dan inovatif serta bertanggungjawab* | Creates/invents using science knowledge and skills in problem-solving, creatively, innovatively and responsibly | 应用科学知识和技能来创造，以解决问题并作出决定或在创意和创新的情境下 |

### How PBD actually works — practical notes for the app

- PBD is **formative and continuous**, carried out by the classroom teacher throughout the year. It is **not** an exam. ✅ SOURCED
- A pupil is awarded a TP **per Standard Kandungan**, not one global TP. The DSKP gives a **topic-specific TP1–TP6 descriptor table for every single SK** — so, for example, TP4 for *Fotosintesis* has different wording from TP4 for *Litar bersiri*. The table above is the **general** Science scale.
  - ⚠️ **This is the single biggest content-authoring implication.** If your worksheets carry TP markers, they should ideally map to the *per-SK* descriptor, not the generic one. Those per-SK tables occupy the bulk of every DSKP (they're why the documents run 66–94 pages). I have **not** extracted them here — that is a much larger transcription job, and I'd recommend doing it directly from the PDFs rather than via web extraction.
- TP is reported to parents via the school system (SAPS / the PBD reporting template), typically at mid-year and year-end.
- **Design guidance** ⚠️ INFERRED: a sensible worksheet ladder is TP1–TP2 = recall/identify/label; TP3 = apply, record, complete a table; TP4 = analyse, compare, explain why, interpret a graph; TP5 = evaluate, justify, decide between options; TP6 = design/invent/create. This maps cleanly onto the verbs in the official descriptors, but the mapping is my construction.

Sources: [DSKP Sains Tahun 3, pp.1–50 (BM descriptors)](https://anyflip.com/gcmje/aphd/basic) · [DSKP Sains Tahun 3 SJKC (Chinese descriptors)](https://anyflip.com/ceydd/ytcw/basic)

---

## 11. What replaced UPSR — and what Year 6 pupils actually face in 2026

✅ **SOURCED**, including from two official `moe.gov.my` PDFs.

### 11.1 The abolition

- **UPSR** (Ujian Pencapaian Sekolah Rendah) was **abolished in 2021**.
- **PT3** followed, **abolished in 2022**.
- Both were replaced by **PBS — Pentaksiran Berasaskan Sekolah** (School-Based Assessment).

### 11.2 What PBS consists of

| Component | What it is |
|---|---|
| **PBD** — Pentaksiran Bilik Darjah | Continuous classroom assessment against TP1–TP6. The main mechanism. |
| **PPsi** — Pentaksiran Psikometrik | Psychometric/aptitude assessment. |
| **PAJSK** — Pentaksiran Aktiviti Jasmani, Sukan dan Kokurikulum | Physical, sports and co-curricular assessment. |
| **UASA** — Ujian Akhir Sesi Akademik | End-of-academic-session summative written test. |

### 11.3 UASA — the exam Year 6 pupils sit ✅ SOURCED

This is the answer to "what does Year 6 actually face."

- **Who sits it:** *"murid Tahun 4 hingga Tahun 6 di sekolah rendah dan murid Tingkatan 1 hingga Tingkatan 3"* — Years 4, 5, 6 and Forms 1–3.
- **When:** end of the academic session; UASA 2025 ran **13 October – 10 November 2025**.
- **Subjects (Tahap 2 primary):** Bahasa Melayu, Bahasa Inggeris, Matematik, **Sains**, Sejarah, **Bahasa Cina**, Bahasa Tamil.
- **Crucially:** UASA is **school-administered and school-marked**, but the **format and instrument specification are issued by KPM**. It is *not* a national public exam like UPSR was — no national ranking, no placement consequence.

**Official UASA Sains format, Tahap 2 (Years 4–6), 2025 specification:** ✅ SOURCED

| Attribute | Value |
|---|---|
| Number of papers | **1** |
| Duration | **1 jam 15 minit** (75 minutes) |
| Total marks | **50** |
| Bahagian A | 10 questions — 10 marks |
| Bahagian B | 2 questions — 8 marks |
| Bahagian C | 4 questions — 32 marks |
| Item types | Objektif Aneka Pilihan (MCQ), Objektif Pelbagai Bentuk, Subjektif Respons Terhad |
| Constructs assessed | Remembering, understanding, applying, analysing, evaluating, creating — **plus Kemahiran Proses Sains** |
| Difficulty ratio | **Rendah : Sederhana : Tinggi = 5 : 3 : 2** |
| Scoring | Dichotomous and analytical |

**Grading scale (UASA):** A = 82–100% (Cemerlang) · B = 66–81% · C = 50–65% · D = 35–49% · E = 20–34% · F = 0–19% (Belum Mencapai Tahap Minimum). Minimum pass threshold is **20%**.

> **This format table is the most directly actionable finding in this document for app design.** Section C carries **32 of 50 marks across only 4 questions** — i.e. ~64% of the paper is extended structured response, not MCQ. And the 5:3:2 difficulty ratio means **20% of items are deliberately high-difficulty**. An app that drills only MCQ recall will systematically under-prepare pupils for the paper they actually sit.

### 11.4 Is UASA still running in 2026? — **Yes** ✅ SOURCED

Confirmed by multiple 2025/2026-dated sources including KPM's own PBD/quality-assurance management materials for 2026 and UASA 2026/2027 session result-checking schedules. UASA is live.

### 11.5 Live policy risk — UPSR/PT3 may return ⚠️ **WATCH THIS**

✅ **SOURCED** (Malay Mail, 15 January 2026): the Education Ministry has set an **end-of-2026 deadline** for completing a policy review on **whether to reinstate UPSR and PT3**. Education Minister Fadhlina Sidek stated the review is expected to be completed within 2026, commencing once the National Education Advisory Council members are appointed. The review responds to parent and educator pressure.

**Product implication:** there is a genuine, officially-acknowledged possibility that a national Year 6 exam returns within the app's first years of life. Build the assessment layer so the "target exam" is a swappable configuration (blueprint: item counts, marks, durations, difficulty ratio) rather than hard-coded to UASA.

Sources: [Malay Mail, 15 Jan 2026 — UPSR/PT3 policy review](https://malaymail.com/news/malaysia/2026/01/15/will-upsr-and-pt3-return-education-ministry-sets-end-2026-deadline-for-policy-review/205526) · [KPM — Format Instrumen UASA Tahap Dua Sekolah Rendah 2025 (PDF)](https://www.moe.gov.my/storage/files/shares/pentaksiran-berasaskan-sekolah/7.%20Format%20Instrumen%20UASA%20Tahap%20Dua%20Sekolah%20Rendah%202025.pdf) · [KPM — Panduan Pengurusan dan Pentadbiran UASA & FAQ (PDF)](https://www.moe.gov.my/storage/files/shares/pentaksiran-berasaskan-sekolah/5.%20Panduan%20Pengurusan%20dan%20Pentadbiran%20UASA%20&%20FAQ%20UASA.pdf) · [Malaysia Gazette — PBS ganti UPSR](https://malaysiagazette.com/2024/12/12/pbs-ganti-upsr-pt3-lebih-sesuai-untuk-murid-hari-ini-masa-depan-kpm/) · [ecentral.my — UASA](https://ecentral.my/uasa-ujian-akhir-sesi-akademik/)

---

## 12. Hardest and most commonly assessed topics

I want to be careful here, because this is where it would be easiest to invent. I'll separate what I could actually source from what is reasoned judgement.

### 12.1 What is genuinely SOURCED ✅

Peer-reviewed research on Malaysian primary Science learning difficulties (n=98, rural primary pupils) found the difficulties are **skill- and language-based more than topic-based**:

| Difficulty | Figure |
|---|---|
| Cannot obtain predicted experimental results | **44 of 98 (45%)** |
| Cannot link science facts to everyday life | **42 of 98 (43%)** |
| Struggle to understand scientific terminology | **37 of 98 (38%)** |
| Cannot control variables during experiments | **36 of 98 (37%)** |
| Difficulty grasping animal characteristics | **38 of 98 (39%)** |
| Consistently achieve expected experimental outcomes | **only 8 of 98 (8%)** |

The study's explicit conclusion is that **scientific vocabulary, process skills (especially *mengawal pemboleh ubah* and *meramal*), and transferring science to real-life contexts** are the primary obstacles — ahead of any specific content topic. The authors also flag negative attitude toward Science as the single largest barrier.

Separately, published Malaysian action research specifically targets **Fasa Bulan (moon phases, Year 5)** as a topic requiring special intervention (the "Oreo model" and song-based teaching study), which is direct evidence that this topic is a recognised pain point.

> **The strongest sourced conclusion for your app:** the highest-leverage content is **not** more topic recall drills. It is (a) **trilingual scientific vocabulary** support, (b) **explicit process-skill training** — especially controlling variables, predicting, and interpreting data, and (c) **everyday-context transfer questions**. This aligns exactly with the UASA blueprint, which names Kemahiran Proses Sains as an assessed construct in its own right and weights 64% of marks to extended response.

For an **SJKC Sabah** cohort specifically, the vocabulary finding compounds: these pupils learn Science in **Mandarin**, sit UASA Sains in **Mandarin**, but will meet **Malay** Science terminology at secondary school. ⚠️ INFERRED — but this is why the trilingual glossary is arguably the app's most defensible feature, and why BM terms should be surfaced alongside Chinese from Year 4 onward rather than only in Year 6.

Sources: [Masalah Pembelajaran Murid Sekolah Rendah Luar Bandar dalam Mata Pelajaran Sains (UMP, PDF)](https://umpir.ump.edu.my/id/eprint/37807/1/Masalah%20pembelajaran%20murid%20sekolah%20rendah%20luar%20bandar.pdf) · [IJHTC journal version](https://journal.ump.edu.my/index.php/ijhtc/article/download/9400/2792/34809) · [Nyanyian dan Model Oreo Membantu Murid Tahun 5 Memahami Fasa Bulan](https://www.researchgate.net/publication/367519643_Nyanyian_dan_Model_Oreo_Membantu_Murid_Tahun_5_Memahami_Fasa_Bulan)

### 12.2 What is my judgement, NOT sourced ⚠️ INFERRED

I could **not** find a published, authoritative topic-difficulty ranking or an item-analysis of UASA Sains. The following is **reasoned inference** from the structure of the DSKP (abstraction level, spatial reasoning demand, calculation demand, volume of terminology). **Treat as a prioritisation hypothesis to validate against your own pupils' data, not as fact.**

| Topic | Year | Why likely hard |
|---|---|---|
| **Gerhana** 日食与月食 | 6 | Requires 3-D spatial reasoning about Sun–Earth–Moon geometry; umbra/penumbra terminology; commonly confused with moon phases. |
| **Fasa Bulan** 月相 | 5 | Same spatial-reasoning demand; ✅ *this one has sourced supporting evidence* (see 12.1). |
| **Fotosintesis** 光合作用 | 4 | Abstract invisible process; heavy terminology load (chlorophyll, glucose, carbon dioxide); inputs/outputs commonly reversed. |
| **Daya geseran & Tekanan udara** 摩擦力/气压 | 6 | Forces are counter-intuitive; air pressure is invisible; strong conflict with everyday intuition. |
| **Kelajuan** 速度 | 6 | The only topic requiring genuine formula manipulation and unit handling; overlaps Mathematics. |
| **Ketumpatan** 密度 | 3 | Introduced early but conceptually abstract; pupils reduce it to "heavy = sinks", which fails immediately. |
| **Litar bersiri vs litar selari** 串联/并联电路 | 5 | Requires reading and drawing circuit diagrams — a distinct representational skill. |
| **Sistem badan manusia** 人体系统 | 5 | Highest terminology density in the primary syllabus; SK 2.3 (interrelation between systems) is genuinely integrative and a natural TP4–TP5 target. |
| **Interaksi antara hidupan** 生物之间的相互关系 | 6 | Symbiosis categories (commensalism/mutualism/parasitism) are subtle and easily conflated. |
| **Mengawal pemboleh ubah** 控制变因 | 4–6 | ✅ *sourced as a difficulty* (37% of pupils); cross-cutting, appears in every experimental question. |

⚠️ On "most commonly assessed": I found **no** published item-frequency analysis. However, two things are structurally certain and worth acting on: **(1)** Kemahiran Proses Sains is a named UASA construct and therefore assessed **every year, in every paper** ✅ SOURCED; **(2)** UASA is a **whole-year-syllabus** paper, so for Year 6 the assessable surface is all 13 topics — a materially heavier revision load than Years 4 or 5 (10 topics each). ⚠️ The inference that examiners favour particular topics within that is unverified.

---

## 13. Summary of what is NOT verified

Stating these plainly, per your instruction to prefer accuracy over completeness:

1. **No year's topic list was read from `bpk.moe.gov.my` directly** — the domain was blocked at the proxy for the entire session. All lists come from mirrors of the KPM PDFs. Confidence is nonetheless **high** for all six years: every year was cross-checked against **at least two independent mirrors**, and Years 1, 2, 3, 5 and 6 were additionally cross-checked against the **Chinese SJKC edition**, which agreed structurally in every case.
2. **Standard Pembelajaran (SP) level detail** — the individually numbered assessable statements (e.g. 5.2.1, 5.2.2) — is **not** in this document. Only Tema, Tajuk and Standard Kandungan are. The SPs are the level your worksheets ultimately map to and must be transcribed from the PDFs.
3. **Per-SK TP1–TP6 descriptor tables** are **not** in this document (see §10). Only the general Science TP scale is captured. This is the largest remaining transcription job.
4. **Year 4 Chinese** for topics 1.0, 2.0 and 3.0 (and all their SK wordings) is untranscribed — the fetched SJKC page range began at topic 4.0.
5. **Year 2 SK-level Chinese** is untranscribed (topic-level Chinese is confirmed from two sources).
6. **Year 3 Chinese topic headings** for 9.0 and 10.0 are my renderings, not read verbatim.
7. **All "key vocabulary" trilingual lists** are compiled by me. Chinese terms explicitly quoted from the SJKC DSKP in the topic tables are official; the glossary rows are my translations and need an SJKC-teacher review before shipping.
8. **KP2027 details** (Year-1 Science removal, "Alam dan Manusia", the 2031 sunset) come from education news and a teacher blog, not KPM primary documents.
9. **§12.2 topic-difficulty ranking** is inference, not evidence.

### Recommended verification pass (in priority order)

1. Download the six DSKP Sains PDFs (**SJKC editions**) from `bpk.moe.gov.my` on an unrestricted connection; diff Tema/Tajuk/SK against §3–§8.
2. Transcribe all **SP** statements and all **per-SK TP1–TP6** tables from those PDFs — this is the real content backbone and it is a PDF-parsing job, not a web-research job.
3. Have an SJKC Science teacher (ideally Sabah-based) review the trilingual glossaries.
4. Re-check the UPSR/PT3 policy review outcome **after December 2026**.

---

## 14. Consolidated source list

**Official KPM (`moe.gov.my`)**
- [Format Instrumen Pentaksiran UASA Tahap Dua Sekolah Rendah 2025 (PDF)](https://www.moe.gov.my/storage/files/shares/pentaksiran-berasaskan-sekolah/7.%20Format%20Instrumen%20UASA%20Tahap%20Dua%20Sekolah%20Rendah%202025.pdf)
- [Panduan Pengurusan dan Pentadbiran UASA & FAQ UASA (PDF)](https://www.moe.gov.my/storage/files/shares/pentaksiran-berasaskan-sekolah/5.%20Panduan%20Pengurusan%20dan%20Pentadbiran%20UASA%20&%20FAQ%20UASA.pdf)
- [MOE — DSKP KSSR downloads index](https://www.moe.gov.my/en/muat-turun/penerbitan-dan-jurnal/dskp-kssr)
- [BPK — KSSR Semakan 2017 index](http://bpk.moe.gov.my/index.php/terbitan-bpk/kurikulum-sekolah-rendah/category/9-kssr-semakan-2017) *(blocked during this session)*

**DSKP mirrors — Malay editions**
- [Tahun 1, pp.51–66](https://anyflip.com/gcmje/tqim/basic/51-66) · [Tahun 1, pp.1–50](https://anyflip.com/ittl/ckao/basic) · [Penjajaran KSSR Sains Tahun 1](https://anyflip.com/ljsk/kghk/basic)
- [Tahun 2, pp.51–80](https://anyflip.com/ittl/pkii/basic/51-80) · [Tahun 2, pp.1–50](https://anyflip.com/gcmje/sbln/basic)
- [Tahun 3, pp.51–88](https://anyflip.com/gcmje/aphd/basic/51-88) · [Tahun 3, pp.1–50](https://anyflip.com/gcmje/aphd/basic)
- [Tahun 4, pp.51–94](https://anyflip.com/gcmje/zxee/basic/51-94) · [Tahun 4, pp.1–50](https://anyflip.com/awis/ndqq/basic)
- [Tahun 5, pp.51–88](https://anyflip.com/gcmje/zbvz/basic/51-88)
- [Tahun 6, pp.51–94](https://anyflip.com/gcmje/iumj/basic/51-94) · [Tahun 6, 2nd mirror](https://anyflip.com/ittl/eguz/basic/51-94)

**DSKP mirrors — SJKC (Chinese) editions**
- [Tahun 1 SJKC](https://www.slideshare.net/slideshow/dskp-kssr-semakan-2017-sains-tahun-1-sjkc/238141332)
- [Tahun 2 SJKC](https://anyflip.com/zkumo/lggx/basic) · [二年级科学 textbook TOC](https://anyflip.com/fnvvi/sfvd/basic)
- [Tahun 3 SJKC v2](https://www.slideshare.net/slideshow/dskp-kssr-semakan-2017-tahun-3-sains-sjkc-pdf/270039629) · [Tahun 3 SJKC (AnyFlip)](https://anyflip.com/ceydd/ytcw/basic)
- [Tahun 4 SJKC, pp.51–74](https://anyflip.com/zkumo/wfmr/basic/51-74) · [Tahun 4 SJKC, pp.1–50](https://anyflip.com/zkumo/wfmr/basic)
- [Tahun 5 SJKC, pp.51–76](https://anyflip.com/rocat/zjwp/basic/51-76) · [Tahun 5 SJKC, pp.1–50](https://anyflip.com/rocat/zjwp/basic)
- [Tahun 6 SJKC (direct PDF)](https://asiemodel.net/wp-content/uploads/2022/08/8.-DSKP-KSSR-Semakan-2017-Sains-Tahun-6_SJKC_ISBN.pdf)

**Assessment policy**
- [Malay Mail, 15 Jan 2026 — UPSR/PT3 review, end-2026 deadline](https://malaymail.com/news/malaysia/2026/01/15/will-upsr-and-pt3-return-education-ministry-sets-end-2026-deadline-for-policy-review/205526)
- [Malaysia Gazette — PBS ganti UPSR, PT3](https://malaysiagazette.com/2024/12/12/pbs-ganti-upsr-pt3-lebih-sesuai-untuk-murid-hari-ini-masa-depan-kpm/)
- [ms.wikipedia — Ujian Akhir Sesi Akademik](https://ms.wikipedia.org/wiki/Ujian_Akhir_Sesi_Akademik) · [ecentral.my — UASA](https://ecentral.my/uasa-ujian-akhir-sesi-akademik/) · [ecentral.my — Pelaporan PBD](https://ecentral.my/pelaporan-pentaksiran-bilik-darjah-pbd/)

**Curriculum reform (KP2026 / KP2027)**
- [Cikgu Hijau — Rumusan KP2027](https://www.cikguhijau.com/2025/02/rumusan-kurikulum-persekolahan-2027.html) · [Cikgu Hijau — Kerangka KP2027](https://www.cikguhijau.com/2025/02/kerangka-kurikulum-persekolahan-2027.html)
- [ecentral.my — Kurikulum Persekolahan 2027](https://ecentral.my/kurikulum-persekolahan-2027/) · [Sinar Bestari — 30 fakta KP2027](https://sinarbestari.sinarharian.com.my/buletin/30-fakta-penting-tentang-kurikulum-persekolahan-2027-yang-wajib-diketahui-guru-ibu-bapa) *(502 at fetch time)*

**Research**
- [Masalah Pembelajaran Murid Sekolah Rendah Luar Bandar dalam Mata Pelajaran Sains (UMP PDF)](https://umpir.ump.edu.my/id/eprint/37807/1/Masalah%20pembelajaran%20murid%20sekolah%20rendah%20luar%20bandar.pdf) · [IJHTC version](https://journal.ump.edu.my/ijhtc/article/view/9400)
- [Nyanyian dan Model Oreo Membantu Murid Tahun 5 Memahami Fasa Bulan](https://www.researchgate.net/publication/367519643_Nyanyian_dan_Model_Oreo_Membantu_Murid_Tahun_5_Memahami_Fasa_Bulan)
