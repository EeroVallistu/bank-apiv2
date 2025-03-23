### Töö eesmärk
 
1. **Kujundada ja realiseerida** relatsiooniline andmebaas, mis vastab internetipanga rakenduse andmemudeli nõuetele.
2. **Dokumenteerida töö** kirjalikus vormis (nt Google Docs), nii et selgelt tuleks välja andmebaasi struktuur, projekteerimise käik, kasutatud SQL-laused ja vajalikud andmete lisamise/muutmise päringud.
3. **Rakendada** töö käigus erinevaid andmebaasitehnikaid (transaktsioonide kasutamine, õiguste jagamine, eksport-import jne).
 
---
 
### Nõuded andmebaasi koostamisele ja dokumenteerimisele
 
Allpool on toodud iga nõue koos **lühikese näitega**, mis aitab täpsustada ootusi.
 
1. **Andmebaasi struktuur**
- **Nõue**: Andmebaasis peab olema vähemalt viis omavahel seostatud tabelit (nt kasutajad, kontod, tehingud, rollid jm).
- **Näide**: Tabelid `kasutajad`, `kontod`, `tehingud`, `rollid`, `logid` on seotud primaarvõtmete ja välisvõtmete kaudu.
- **Nõue**: Iga tabeli puhul tuleb määrata sobivad andmetüübid ja väljade suurused.
- **Näide**: Väljal `kasutajanimi` on andmetüübiks VARCHAR(50), väljal `konto_saldo` on DECIMAL(10,2).
- **Nõue**: Seosed tuleb kirjeldada ER-diagrammil (olemi-seose mudel).
- **Näide**: ER-diagramm MySQL Workbenchis, kus `kasutaja`-tabel on seoses `konto`-tabeliga üks-mitmele.
- **Nõue**: Andmebaasi disainimiseks soovitatakse kasutada CASE vahendeid (nt MySQL Workbench).
- **Näide**: Projekti faile (erk, mwb vms) lisatakse dokumentatsiooni juurde või ekraanipiltidena.
 
2. **Planeerimise ja kujundamise dokumentatsioon**
- **Nõue**: Selgita, millist andmemudeli kujundamise metoodikat (UML-diagrammid, ER-mudeli loomine vms) kasutasid.
- **Näide**: Töödes kasutatakse UML klassidiagramme, mille järgi koostatakse ER-diagramm.
- **Nõue**: Lisa skeemid, joonised, selgitused, mis kirjeldavad andmebaasi projekteerimise protsessi.
- **Näide**: Dokumendis on peatükk „Andmebaasi projekteerimine“, kus on joonised andmevoost, ER-diagramm jm.
- **Nõue**: Too välja, kuidas jõudsid konkreetsete tabelite ja väljade valikuni (lähtudes internetipanga projektis seatud nõuetest).
- **Näide**: „Väljade valik ja seosed lähtuvad funktsionaalsusest, kus kasutajal on mitu kontot ja igal kontol mitu tehingut.“
 
3. **SQL-päringute loomine**
- **Nõue**: Lisa kõikide tabelite loomisel kasutatud SQL-laused (CREATE TABLE …).
- **Näide**: Dokumendis on peatükk „Tabelite loomine“, kus on täpsed SQL-lõigud koos väljade ja võtmetega.
- **Nõue**: Too välja näidislaused andmete sisestamiseks (INSERT), muutmiseks (UPDATE) ja kustutamiseks (DELETE).
- **Näide**: „INSERT INTO kasutajad (nimi, email) VALUES ('Mari', 'mari@näide.ee');“
- **Nõue**: Näita, kuidas Sa kasutad transaktsioone (BEGIN/COMMIT/ROLLBACK).
- **Näide**: Rahaliste tehingute puhul teostatakse SQL-lauseid BEGIN abil, lõpuks COMMIT või vajadusel ROLLBACK.
 
4. **Õiguste haldus, eksport-import**
- **Nõue**: Lisa andmebaasile kasutajaid ja jaga neile sobivaid õiguseid (nt read, write, admin jne), lähtudes projektis seatud tingimustest.
- **Näide**: „CREATE USER 'kasutaja_nimi'@'%' IDENTIFIED BY 'parool'; GRANT SELECT, INSERT, UPDATE ON panga_andmebaas.* TO 'kasutaja_nimi'@'%';“
- **Nõue**: Näita, kuidas teostad andmebaasi andmete eksporti (varukoopiad) ja importi (varukoopiast taastamine).
- **Näide**: „mysqldump -u root -p panga_andmebaas > varukoopia.sql“ ja „mysql -u root -p panga_andmebaas < varukoopia.sql“.
 
5. **Seotus veebirakendusega**
- **Nõue**: Kirjelda lühidalt, kuidas Sinu loodud veebirakendus andmebaasiga suhtleb (milliseid päringuid rakendus teeb, kuidas kasutab REST API-t, milliseid andmeid vahetatakse).
- **Näide**: „Rakendus küsib kontode nimekirja `GET /kontod` päringuga, lisab uue tehingu `POST /tehing` päringuga.“
- **Nõue**: Võimalusel lisa näide, kuidas rakenduses tehakse tehing või kontodevaheline ülekanne, mis kajastub andmebaasis.
- **Näide**: „Kontolt nr 1 kantakse kontole nr 2 summa 100. SQL-is tekib rida tabelisse `tehingud`, saldode uuendused logitakse transaktsiooniga.“
 
6. **Dokumentatsiooni vormistamise juhised**
- **Nõue**: Töö esitatakse tervikuna ühes kirjalikus dokumendis (nt Google Docs), mis sisaldab kõiki nõutud osi.
- **Näide**: Ühte dokumenti on koondatud pildid, skeemid, SQL-lõigud ja juhised importimiseks-eksportimiseks.
- **Nõue**: Töö sisaldab lühikirjeldust andmebaasi eesmärgist ja seotusest internetipanga projektiga.
- **Näide**: „Andmebaasi eesmärk on hallata kasutajakontosid, tehinguid ja logisid, et rakendus saaks teha turvalisi rahaülekandeid.“
- **Nõue**: Dokument sisaldab andmebaasi tehnilist kirjeldust (tabelite struktuur, väljade tüübid, seosed, indeksid, triggerid, transaktsioonid).
- **Näide**: Üks peatükk, kus on tabelid koos väljade täieliku loeteluga ja SQL-põhised näited.
- **Nõue**: Töö lisab kokkuvõtte (mida õppisid, millised olid väljakutsed, mida teeksid teisiti).
- **Näide**: „Suurimaks väljakutseks osutus andmemudeli normaliseerimine; edaspidi teeksin varajase analüüsi täpsemini.“
 
---
 
### Töö maht ja esitamine
 
- Töö on **iseseisev projekt**, mille **hindeks** on nii andmebaasi tehniline lahendus kui ka kirjeldav dokumentatsioon.
- Töö tuleb esitada **ühes kirjalikus dokumendis** (nt Google Docs), mis sisaldab kõiki nõutud osi (diagramme, seletusi, SQL-lõike, näiteid jne).
- Vajadusel võib õppejõud küsida lisaselgitusi, mis puudutavad loodud andmemudeli otstarvet, tehnilisi lahendusi ning andmebaasi turva- või õigusteküsimusi.
 
**Edukat andmebaasiprojekti loomist!**
 
---
 
## HINDAMISKRITEERIUMID (JAH/ EI)
 
Hindamise alus on, kas iga allpool loetletud kriteerium on **täidetud** (jah) või **täitmata** (ei). Kriteeriumid kordavad eespool toodud nõudeid üks-ühele.
 
### 1. Kirjaliku töö üldine vormistus ja ulatus
1.1 Töö on esitatud tervikuna ühes kirjalikus dokumendis (nt Google Docs).
1.2 Töö hõlmab kõiki ülesandes nõutud osi (andmebaasi kujundus, dokumentatsioon, SQL, õiguste haldus, eksport-import, seotus veebirakendusega).
 
### 2. Töö eesmärk
2.1 Eesmärgina on kujundatud ja realiseeritud relatsiooniline andmebaas, mis vastab internetipanga rakenduse nõuetele.
2.2 Dokumendis on kirjeldatud kõik olulised aspektid (struktuur, SQL-laused, kasutusjuhised).
2.3 Õpilane on näidanud, kuidas rakendada andmebaasitehnikaid (transaktsioonid, õiguste haldus, import-eksport).
 
### 3. Nõuded andmebaasi struktuurile
3.1 Andmebaasis on vähemalt viis omavahel seostatud tabelit.
3.2 Iga tabeli väljade andmetüübid ja suurused on määratud.
3.3 Tabelitevahelised seosed on kirjeldatud ER-diagrammil.
3.4 Kasutatud on mõnd CASE-vahendit (nt MySQL Workbench).
 
### 4. Planeerimise ja kujundamise dokumentatsioon
4.1 Kasutatud andmemudeli kujundamise metoodika (UML, ER) on nimetatud.
4.2 Skeemid/joonised ja selgitused illustreerivad andmebaasi projekteerimise protsessi.
4.3 On põhjendatud, miks just sellised tabelid ja väljad valiti (lähtudes internetipanga nõuetest).
 
### 5. SQL-päringute loomine
5.1 Dokumentatsioon sisaldab CREATE TABLE lauseid kõigi tabelite loomiseks.
5.2 On lisatud INSERT, UPDATE ja DELETE näited.
5.3 Kui vaja, on mainitud või näidatud indeksite, trigger'ite jms kasutamine.
 
### 6. Transaktsioonide kasutamine
6.1 On kirjeldatud, kuidas projekti raames transaktsioone kasutatakse (BEGIN/COMMIT/ROLLBACK).
6.2 Vähemalt üks näide illustreerib transaktsiooni kasutamist (nt rahaülekande puhul).
 
### 7. Õiguste haldus
7.1 Andmebaasile on loodud erinevaid kasutajaid ja määratud neile õigused (read, write, admin vms).
7.2 On selgitatud, millistel põhimõtetel õigused jagati (turvalisus, rollijaotus jne).
 
### 8. Andmete eksport ja import
8.1 Dokumendis on selgitatud, kuidas andmebaasi eksportida (varukoopia).
8.2 On näidatud, kuidas andmebaasi importida (varukoopiast taastamine).
 
### 9. Seotus veebirakendusega
9.1 Dokumentatsioonis on ära toodud, kuidas loodud andmebaas veebirakendusega (internetipank) suhtleb (REST API, päringud).
9.2 On vähemalt üks näide, kus veebirakendus teeb tehingu või kontodevahelise ülekande, mis salvestub andmebaasi.
 
### 10. Dokumentatsiooni vormistamise juhised
10.1 Töö sisaldab lühikirjeldust andmebaasi eesmärgist ja seotusest internetipanga projektiga.
10.2 Dokumendis on andmebaasi tehniline kirjeldus (tabelite struktuur, väljade tüübid, seosed, indeksid, triggerid, transaktsioonid).
10.3 SQL-laused katavad tabelite loomise, kasutajate lisamise, õiguste halduse ning import-eksport operatsioonid.
10.4 Töö sisaldab kokkuvõtet (mida õppisid, millised olid väljakutsed, mida teeksid teisiti).
 
### 11. Töö maht ja esitamine
11.1 Töö on iseseisev projekt, mille raames on nii lahendus kui ka dokumentatsioon valminud nõuetekohaselt.
11.2 Töö on esitatud tähtajaks ning vastab keele- ja vormistusnõuetele.