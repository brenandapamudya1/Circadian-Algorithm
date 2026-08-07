export interface EduArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  sourceName: string;
  sourceUrl: string;
  thumbnail: any;
}

export const EDU_ARTICLES: EduArticle[] = [
  {
    id: '1',
    title: 'Fase Manik pada Bipolar, Inilah Ciri-Cirinya',
    excerpt: 'Fase manik adalah salah satu episode pada gangguan bipolar yang ditandai dengan lonjakan suasana hati secara ekstrem dan peningkatan energi. Pada fase ini, penderitanya bisa merasa sangat percaya diri, terlalu bersemangat, hingga bertindak impulsif.',
    content: `Fase manik merupakan episode dalam gangguan bipolar yang membuat suasana hati penderitanya meningkat secara ekstrem, sering kali disalahpahami hanya sebagai perasaan gembira atau sangat produktif. Pada fase ini, terjadi lonjakan emosi disertai peningkatan aktivitas dan energi yang signifikan, sehingga perilaku penderita bisa menjadi sulit dikendalikan dan cenderung mengambil keputusan yang berisiko.

Ada beberapa gejala khas yang umumnya muncul selama fase manik, di antaranya:

1. Suasana hati yang sangat tinggi (euforia berlebihan) atau menjadi sangat mudah marah secara tiba-tiba terhadap hal sepele.
2. Berbicara dengan sangat cepat, terus-menerus, dan topiknya meloncat-loncat sehingga sulit diikuti atau dihentikan.
3. Pikiran yang terlalu aktif dan penuh ide, namun penderita menjadi sulit fokus dan konsentrasinya menurun.
4. Kebutuhan tidur yang berkurang, di mana penderita tetap merasa segar dan sangat aktif meski hanya tidur beberapa jam saja.
5. Rasa percaya diri yang berlebihan di luar kewajaran, bahkan merasa memiliki kekuatan atau talenta khusus.
6. Bertindak impulsif tanpa memikirkan risiko, seperti berbelanja berlebihan hingga menguras tabungan, mengemudi ugal-ugalan, atau berjudi.
7. Mudah tersulut emosi sehingga sering terlibat dalam perdebatan atau pertengkaran tanpa sebab yang jelas.
8. Mengalami perubahan libido (dorongan seksual meningkat tajam) serta perubahan nafsu makan yang tidak teratur.

Meskipun penyebab pasti fase manik belum diketahui, ada beberapa faktor risiko yang memicunya, seperti riwayat keluarga, stres berat, jadwal tidur tidak teratur, penyalahgunaan alkohol/obat terlarang, serta penghentian obat tanpa pengawasan dokter.

Penanganan untuk fase manik harus dilakukan secara menyeluruh melalui kombinasi konsultasi dengan psikiater, pemberian obat-obatan (seperti penstabil mood dan antipsikotik), psikoterapi (terapi perilaku kognitif), penyesuaian pola hidup sehat, serta dukungan penuh dari keluarga.`,
    sourceName: 'Alodokter',
    sourceUrl: 'https://www.alodokter.com/fase-manik-pada-bipolar-inilah-ciri-cirinya',
    thumbnail: require('../../assets/edu/artikel_1.png'),
  },
  {
    id: '2',
    title: '5 Langkah Sederhana untuk Mengatasi Depresi bagi Orang Dewasa',
    excerpt: 'Depresi dapat membuat seseorang merasa tidak bersemangat dan cenderung menarik diri dari lingkungan. Melalui langkah sederhana seperti tetap terhubung dengan orang terdekat, aktif bergerak, dan menjaga pola makan, gejala depresi dapat diredakan secara bertahap.',
    content: `Depresi merupakan gangguan kesehatan mental yang dapat menguras energi, membuat seseorang merasa sedih berkepanjangan, hingga kehilangan minat pada aktivitas sehari-hari. Walaupun terasa berat, terdapat beberapa langkah sederhana yang bisa dilakukan oleh orang dewasa untuk membantu mengatasi dan memulihkan kondisi dari depresi:

1. Tetap berhubungan dengan orang lain: Saat mengalami depresi, seseorang cenderung mengisolasi diri karena merasa malu atau terlalu lelah untuk bersosialisasi. Padahal, dukungan dari keluarga dan teman terdekat sangat krusial dalam menjaga perspektif yang sehat serta meningkatkan suasana hati.

2. Lakukan hal-hal yang menyenangkan: Dorong diri sendiri untuk meluangkan waktu melakukan hobi atau aktivitas yang disukai sebelumnya, seperti mendengarkan musik atau pergi bersama teman. Langkah ini membantu memicu emosi positif dan mengembalikan energi secara bertahap.

3. Aktif bergerak: Meskipun bangun dari tempat tidur terasa sulit, olahraga teratur terbukti efektif meredakan gejala depresi setara dengan efektivitas obat-obatan tertentu. Cukup mulai dengan aktivitas ringan seperti berjalan kaki selama 10 menit per hari untuk membantu meningkatkan suasana hati.

4. Konsumsi makanan sehat anti depresi: Kurangi konsumsi kafein, alkohol, makanan berlemak, atau makanan dengan pengawet tinggi yang dapat memengaruhi otak. Sebaliknya, tingkatkan suasana hati dengan mengonsumsi makanan yang kaya asam lemak omega-3 (seperti tuna dan salmon) serta makanan tinggi vitamin B yang berperan penting dalam menstabilkan mood.

5. Hubungi profesional jika diperlukan: Jika langkah-langkah mandiri tersebut dirasa belum cukup membantu mengontrol gejala yang dirasakan, segera hubungi profesional kesehatan mental seperti psikolog atau psikiater untuk mendapatkan penanganan dan terapi yang tepat.`,
    sourceName: 'Halodoc',
    sourceUrl: 'https://www.halodoc.com/artikel/5-langkah-sederhana-untuk-mengatasi-depresi-bagi-orang-dewasa',
    thumbnail: require('../../assets/edu/artikel_2.png'),
  },
  {
    id: '3',
    title: 'Bagaimana Sleep Hygiene Dapat Membantu Menstabilkan Suasana Hati pada Gangguan Bipolar',
    excerpt: 'Gangguan tidur erat kaitannya dengan perubahan suasana hati yang ekstrem pada penderita bipolar. Menerapkan sleep hygiene atau kebiasaan tidur yang sehat terbukti efektif membantu menjaga stabilitas emosi dan mencegah kekambuhan fase manik maupun depresi.',
    content: `Bagi penderita gangguan bipolar, tidur bukan sekadar waktu untuk beristirahat, melainkan pilar krusial dalam menjaga stabilitas kesehatan mental. Gangguan pada ritme sirkadian (jam biologis tubuh) sering kali menjadi pemicu utama terjadinya transisi suasana hati yang ekstrem. Kurang tidur dapat memicu munculnya fase manik (episode gembira/aktif berlebihan), sementara tidur berlebihan atau pola tidur yang kacau sering kali menyertai fase depresi.

Untuk meminimalkan risiko fluktuasi suasana hati tersebut, penerapan sleep hygiene (kebiasaan tidur yang bersih dan sehat) sangat direkomendasikan sebagai bagian dari manajemen mandiri:

1. Menjaga jadwal tidur yang konsisten: Pergi tidur dan bangun pada jam yang sama setiap hari—termasuk pada akhir pekan—membantu melatih jam biologis tubuh agar tetap sinkron dan stabil.

2. Menciptakan lingkungan kamar yang ideal: Kondisikan ruang tidur agar tetap sejuk, tenang, dan gelap. Penggunaan tirai gelap (blackout curtains) atau masker mata dapat membantu meningkatkan kualitas tidur yang lebih nyenyak.

3. Membatasi paparan layar sebelum tidur: Pancaran sinar biru (blue light) dari ponsel, laptop, atau televisi dapat menghambat produksi melatonin, yaitu hormon yang memicu rasa kantuk. Matikan perangkat elektronik setidaknya 30 hingga 60 menit sebelum tidur.

4. Memperhatikan konsumsi menjelang malam: Hindari makanan berat, kafein, dan alkohol di malam hari. Meskipun alkohol terkadang membuat cepat mengantuk, zat ini justru merusak struktur tidur dan sering kali memicu terbangun di tengah malam.

5. Membangun ritual santai sebelum tidur: Lakukan aktivitas yang menenangkan sebelum berbaring, seperti membaca buku fisik, mandi air hangat, atau melakukan teknik pernapasan dan meditasi ringan untuk memberi sinyal pada tubuh bahwa waktu istirahat telah tiba.

Meskipun sleep hygiene sangat membantu menjaga kestabilan mood, langkah ini merupakan pendukung dan bukan pengganti pengobatan medis utama. Penanganan gangguan bipolar tetap memerlukan pengawasan dokter dan penggunaan obat-obatan yang sesuai.`,
    sourceName: 'The Supportive Care',
    sourceUrl: 'https://www-thesupportivecare-com.translate.goog/blog/how-sleep-hygiene-can-help-stabilize-mood-in-bipolar-disorder',
    thumbnail: require('../../assets/edu/artikel_3.png'),
  },
];
