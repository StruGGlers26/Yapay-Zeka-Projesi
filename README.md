# Rutin Değerlendirme ve Öneri Sistemi

Yapay zeka dersi projesi: kullanıcı günlük veya haftalık rutinini web arayüzünden girer; sistem yerel yapay zeka yöntemleriyle değerlendirme skoru ve iyileştirme önerileri üretir.

**Harici API kullanılmaz** (OpenAI, Google vb. yok). Tüm işlem bilgisayarınızda çalışır.

## Özellikler

- **Kullanıcı girişi** — kayıt ol, giriş yap; rutininiz size özel saklanır
- **Kayıtlı rutin şablonu** — günlük ve haftalık program ayrı kaydedilir, otomatik yüklenir
- **Kişisel öneriler** — değerlendirme, kayıtlı rutininize göre sapmaları da yorumlar
- Günlük program veya 7 günlük haftalık program (Pzt–Paz)
- Başlangıç / bitiş saati ile süre hesabı, elle seçilen kategoriler
- Kosinüs benzerliği, kural tabanlı uzman sistemi, 0–100 skor
- Kullanıcıya özel değerlendirme geçmişi (`data/rutin.db`)

## Kullanılan yapay zeka yöntemleri

| Yöntem | Açıklama |
|--------|----------|
| Metin sınıflandırma | Anahtar kelime eşleştirmesi ile aktivite kategorisi |
| Özellik vektörü | Kategori başına saat sürelerinden sayısal vektör |
| Kosinüs benzerliği | `sklearn.metrics.pairwise.cosine_similarity` |
| Uzman sistemi | Uyku, iş yükü, egzersiz için IF-THEN kuralları |
| Çok kriterli skorlama | Benzerlik + denge + ceza/bonus birleşimi |

## Kurulum

```bash
cd "Yapay Zeka Projesi"
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Tarayıcıda: **http://127.0.0.1:5000**

## Rutin giriş formatı

Her satır bir aktivite:

```
Ders çalışma | 3 saat
Yürüyüş | 45 dk
Uyku | 8
```

Ayırıcı: `|`, `-` veya `:`. Süre yazılmazsa varsayılan saat kullanılır.

## Proje yapısı

```
├── app.py              # Flask web sunucusu
├── database.py         # SQLite kullanıcı / rutin / geçmiş
├── analyzer.py         # Analiz motoru (ML + kurallar)
├── requirements.txt
├── templates/index.html
├── static/css/style.css
├── static/js/app.js
└── data/rutin.db       # Otomatik oluşur (kullanıcılar ve rutinler)
```

## Sunum için notlar

1. **Girdi → özellik**: Metin satırları sayısal vektöre dönüşür.
2. **Karar**: Kurallar + benzerlik skoru birleşir.
3. **Çıktı**: Skor, grafikler, öneri listesi.
4. Dış bağımlılık olmadığı için offline demo yapılabilir.

## Gereksinimler

- Python 3.10+
- İnternet yalnızca Chart.js CDN için (isteğe bağlı; grafikler için). Tamamen offline isterseniz Chart.js dosyasını `static/` altına indirip `index.html` içinde yerel yola çevirebilirsiniz.
