Original prompt: bu uygulama bilgisayarda açılıyor ama raspberry pi üzerinde Kamera bulunamadı hatası veriyor. Oysa https://hakanatas.github.io/alan_cevre/ uygulama aynı raspberry pi de açılıyor. Kontrol edip çözüm üret

2026-03-09
- Kamera açılışı tek seferlik `createCapture` + 4 saniye timeout yerine çoklu `getUserMedia` denemeleriyle asenkron akışa taşındı.
- Raspberry Pi yavaş başlasa bile yalancı "Kamera bulunamadı" hatası oluşmaması için sabit timeout kaldırıldı.
- Hata ekranına cihaz taraması ve gerçek tanı metni eklendi.
- El takibi kamera akışı hazır olduktan sonra başlatılıyor.
- `baslat.sh` artık GitHub Pages yerine mevcut klasörü yerelden servis ediyor; Pi üzerinde deploy beklemeden güncel kod test edilebilir.
- Yerel smoke test yapıldı: sayfa açıldı, kamera olmayan ortamda yeni tanı ekranı düzgün render edildi.
- Raspberry Pi acilisinda otomatik kiosk icin `camera-bridge.sh`, `kiosk.sh` ve `install-kiosk.sh` eklendi.
- Yeni kurulum, kamera koprusunu root systemd servisi olarak baslatip Chromium kiosk acilisini kullanici autostart ile yapiyor.
- `install-kiosk.sh` kullaniciyi `video` grubuna ekleyecek sekilde guncellendi; Chromium'un `/dev/video10` goruntulemesi icin gerekli.
- `baslat.sh` icindeki temizlik adimlari `|| true` ile guvenli hale getirildi; Pi'de daha once process yoksa script artik ilk satirda dusmeyecek.
- `sketch.js` icinde kamera acilisi ilk `NotFoundError` sonrasinda kalici hata vermek yerine 90 saniyeye kadar otomatik tekrar deneyecek sekilde guncellendi.
- Tarayicida `mediaDevices.devicechange` dinleyicisi eklendi; loopback kamera gec gorunurse sayfa kendini otomatik toparlayacak.
- `kiosk.sh` ve `baslat.sh` Chromium'u acmadan once `KesirSefiKamera` dugumunu ve kisa stabilizasyon beklemesini kontrol edecek sekilde guncellendi.
- `baslat.sh` icinde `camera-bridge.sh` artik `sudo` ile cagriliyor; manuel Pi baslatmasinda yetki yuzunden sessiz dusme ihtimali kapatildi.
- Cache kirilmasi icin `index.html` ve asset callback surumu `v=4.4` oldu.

TODO
- Raspberry Pi uzerinde yeni retry akisinin `KesirSefiKamera` gec gorundugunde toparlayip toparlamadigi dogrulanmali.
- Gerekirse Chromium tarafinda dogrudan `navigator.mediaDevices.enumerateDevices()` ciktilari loga yazdirilacak ek tanilama eklenebilir.
- `./install-kiosk.sh` Raspberry Pi uzerinde calistirilip reboot sonrasi davranis dogrulanmali.
