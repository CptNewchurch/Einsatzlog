/**
 * Nachschlageliste: Welches Krankheitsbild oder welche Verletzung passt zu welchem NACA-Wert?
 *
 * Es gibt keine amtliche Zuordnung. Der NACA-Wert beschreibt den Zustand des Patienten (schlechtester Zustand
 * vor der Übergabe), nicht die Diagnose allein. Darum steht bei vielen Einträgen, wann der Wert passt
 * („wach, Kreislauf stabil“), und dasselbe Krankheitsbild kann bei verschiedenen Werten auftauchen.
 *
 * Herkunft der Einträge:
 *  - `lit: true` – als Beispiel für diesen Wert in der Fachliteratur genannt (DocCheck Flexikon, NACA-Tabelle;
 *    Wikipedia „NACA-Score“, auch auf bionity.com). Wo beide Quellen abweichen (schwerer Asthmaanfall: IV bzw. V),
 *    stehen beide Einträge.
 *  - sonst: abgeleitet aus den Definitionen der Stufen und aus Einstufungen nach Schwere, die ähnlich vorgehen:
 *    Notarztindikationen „kritisch / vital stabil“ (Zusatzmaterial Troppmair et al., Der Anaesthesist 2021,
 *    Innsbruck), Notarztindikationskatalog Hessen 2024, Einteilung leicht / mittelschwer / schwer von Schutz und
 *    Rettung Zürich, NACA-Auswertungen zu Hypoglykämie, Intoxikation und ACS (Notfall + Rettungsmedizin 2010,
 *    DOI 10.1007/s10049-010-1386-8) und zur Einordnung von Notarzteinsätzen (Anästhesiologie & Intensivmedizin
 *    3/2006, S. 124–132). Diese Einträge sind Richtwerte, keine belegte Zuordnung.
 */

export type NacaFach = 'verletzung' | 'herz' | 'atmung' | 'neuro' | 'intern' | 'vergiftung' | 'psych' | 'sonstiges';

/** Reihenfolge = Reihenfolge der Filter und der Einträge innerhalb eines Werts. */
export const NACA_FAECHER: readonly { fach: NacaFach; label: string }[] = [
  { fach: 'verletzung', label: 'Verletzung' },
  { fach: 'herz', label: 'Herz-Kreislauf' },
  { fach: 'atmung', label: 'Atmung' },
  { fach: 'neuro', label: 'Neurologie' },
  { fach: 'intern', label: 'Internistisch' },
  { fach: 'vergiftung', label: 'Vergiftung' },
  { fach: 'psych', label: 'Psychiatrie' },
  { fach: 'sonstiges', label: 'Sonstiges' },
];

export interface NacaBeispiel {
  /** Krankheitsbild oder Verletzung. */
  text: string;
  /** NACA-Wert 1–7. */
  naca: number;
  fach: NacaFach;
  /** Wann dieser Wert passt (Zustand, Ausmaß). */
  bedingung?: string;
  /** Zusätzliche Suchbegriffe: Abkürzungen, Synonyme, Umgangssprache. */
  auch?: string;
  /** In der Fachliteratur als Beispiel für diesen Wert genannt. */
  lit?: boolean;
}

export const NACA_BEISPIELE: readonly NacaBeispiel[] = [
  /* ---------- I: geringfügige Störung, keine ärztliche Intervention nötig ---------- */
  { naca: 1, fach: 'verletzung', text: 'Prellung', lit: true, auch: 'Kontusion Hämatom blauer Fleck Stoß' },
  { naca: 1, fach: 'verletzung', text: 'Leichte Hautabschürfung', lit: true, auch: 'Schürfwunde Abschürfung Kratzer' },
  { naca: 1, fach: 'verletzung', text: 'Kleine Schnittwunde', bedingung: 'Pflaster oder Verband genügt', auch: 'Schnitt Wunde' },
  { naca: 1, fach: 'verletzung', text: 'Riss-Quetsch-Wunde', bedingung: 'klein und oberflächlich', lit: true, auch: 'RQW Wunde' },
  { naca: 1, fach: 'verletzung', text: 'Verbrennung I. Grades', bedingung: 'kleinflächig', lit: true, auch: 'Sonnenbrand Verbrühung Rötung' },
  { naca: 1, fach: 'verletzung', text: 'Leichte Verstauchung', bedingung: 'voll belastbar, keine Fehlstellung', auch: 'Distorsion Umknicken Zerrung' },
  { naca: 1, fach: 'atmung', text: 'Bekannte Hyperventilation', bedingung: 'beruhigt sich vor Ort', auch: 'Panik psychogene Atemnot' },
  { naca: 1, fach: 'neuro', text: 'Bekannte Kopfschmerzen oder Migräne', bedingung: 'Neurostatus unauffällig, keine Warnzeichen', auch: 'Spannungskopfschmerz' },
  { naca: 1, fach: 'intern', text: 'Unwohlsein ohne Befund', bedingung: 'Vitalwerte und Blutzucker unauffällig', auch: 'unklare Beschwerden' },
  { naca: 1, fach: 'intern', text: 'Erkältung oder grippaler Infekt', bedingung: 'kein hohes Fieber, keine Atemnot', auch: 'Husten Schnupfen Halsschmerzen' },
  { naca: 1, fach: 'vergiftung', text: 'Alkoholisierung ohne Behandlungsbedarf', bedingung: 'wach, orientiert, nur Betreuung', auch: 'betrunken Rausch Ethanol' },
  { naca: 1, fach: 'sonstiges', text: 'Sturz ohne Verletzung', bedingung: 'Aufstehhilfe, keine Beschwerden', auch: 'Hilfeleistung Tragehilfe gestürzt' },
  { naca: 1, fach: 'sonstiges', text: 'Rückenschmerzen seit Tagen oder Wochen', bedingung: 'keine Ausfälle, keine Warnzeichen', auch: 'Lumbago Kreuzschmerzen Ischias LWS' },
  { naca: 1, fach: 'sonstiges', text: 'Insektenstich, örtliche Reaktion', bedingung: 'keine Allergiezeichen', auch: 'Wespe Biene Mücke Zecke Stich' },
  { naca: 1, fach: 'sonstiges', text: 'Nasenbluten', bedingung: 'stillt sich von selbst oder mit Kompression', auch: 'Epistaxis' },
  { naca: 1, fach: 'sonstiges', text: 'Zahnschmerzen', auch: 'zahnärztlicher Notfall Zahn' },

  /* ---------- II: leichte bis mäßige Störung, ambulante Abklärung, meist ohne Notarzt ---------- */
  { naca: 2, fach: 'verletzung', text: 'Fingerfraktur', lit: true, auch: 'Fingerknochen Bruch Finger gebrochen' },
  { naca: 2, fach: 'verletzung', text: 'Zehenfraktur', lit: true, auch: 'Zeh Bruch gebrochen' },
  { naca: 2, fach: 'verletzung', text: 'Nasenbeinfraktur', lit: true, auch: 'Nasenbruch Nase gebrochen' },
  { naca: 2, fach: 'verletzung', text: 'Schulterluxation', lit: true, auch: 'Schulter ausgekugelt luxiert' },
  { naca: 2, fach: 'verletzung', text: 'Verbrennung II. Grades', bedingung: 'kleinflächig', lit: true, auch: 'Verbrühung Blasen' },
  { naca: 2, fach: 'verletzung', text: 'Mäßige Schnittverletzung', bedingung: 'Naht nötig', lit: true, auch: 'Schnittwunde Platzwunde nähen' },
  { naca: 2, fach: 'verletzung', text: 'Fraktur an Unterarm, Hand, Fuß oder Schlüsselbein', bedingung: 'einfach, geschlossen, durchblutet', auch: 'Bruch Speiche Elle Handgelenk Klavikula Mittelfuß' },
  { naca: 2, fach: 'verletzung', text: 'Verstauchung oder Prellung mit Schwellung', bedingung: 'nicht belastbar, Röntgen nötig', auch: 'Distorsion Sprunggelenk Knie Umknicken' },
  { naca: 2, fach: 'verletzung', text: 'Platzwunde am Kopf', bedingung: 'wach, GCS 15, keine Neurologie, Blutung steht', auch: 'Kopfplatzwunde Sturz Kopfverletzung' },
  { naca: 2, fach: 'verletzung', text: 'Rippenprellung oder einzelne Rippenfraktur', bedingung: 'Atmung nicht beeinträchtigt', auch: 'Rippe Thorax Brustkorb' },
  { naca: 2, fach: 'verletzung', text: 'HWS-Distorsion', bedingung: 'keine Ausfälle, schmerzbedingt eingeschränkt', auch: 'Schleudertrauma Halswirbelsäule Nacken Verkehrsunfall' },
  { naca: 2, fach: 'herz', text: 'Kurzer Kollaps (Orthostase)', bedingung: 'erholt, Vitalwerte, EKG und Blutzucker unauffällig', auch: 'Synkope Ohnmacht Kreislaufkollaps Schwindel' },
  { naca: 2, fach: 'herz', text: 'Hypertensive Krise ohne Beschwerden', bedingung: 'kein Brustschmerz, keine Neurologie, keine Atemnot', auch: 'Bluthochdruck RR hoch Hypertonie' },
  { naca: 2, fach: 'herz', text: 'Bekanntes Vorhofflimmern', bedingung: 'frequenzkontrolliert, keine Beschwerden', auch: 'VHF Arrhythmie Herzrasen Palpitationen' },
  { naca: 2, fach: 'atmung', text: 'Hyperventilationssyndrom', bedingung: 'Erstereignis, beruhigt sich nach Anleitung', auch: 'Hyperventilationstetanie Panik Atemnot psychogen' },
  { naca: 2, fach: 'neuro', text: 'Krampfanfall bei bekannter Epilepsie', bedingung: 'abgeklungen, wach, Vitalwerte stabil', auch: 'Epilepsie Anfall Krampf' },
  { naca: 2, fach: 'neuro', text: 'Schwindel', bedingung: 'Vitalwerte und Neurostatus unauffällig', auch: 'Vertigo Lagerungsschwindel' },
  { naca: 2, fach: 'intern', text: 'Exsikkose', bedingung: 'ansprechbar, Kreislauf stabil', lit: true, auch: 'Dehydratation Flüssigkeitsmangel Austrocknung' },
  { naca: 2, fach: 'intern', text: 'Hypoglykämie', bedingung: 'wach, orientiert, orale Glukose wirkt', auch: 'Unterzucker Blutzucker niedrig Diabetes BZ' },
  { naca: 2, fach: 'intern', text: 'Gastroenteritis', bedingung: 'kreislaufstabil, trinkt', auch: 'Durchfall Erbrechen Magen-Darm' },
  { naca: 2, fach: 'intern', text: 'Harnwegsinfekt oder fieberhafter Infekt', bedingung: 'kreislaufstabil, keine Sepsiszeichen', auch: 'HWI Blasenentzündung Fieber' },
  { naca: 2, fach: 'intern', text: 'Nierenkolik', bedingung: 'transportfähig, Schmerz mit Analgesie beherrschbar', auch: 'Nierenstein Kolik Flankenschmerz' },
  { naca: 2, fach: 'intern', text: 'Bauchschmerzen ohne Warnzeichen', bedingung: 'Bauch weich, kreislaufstabil', auch: 'Abdomen Obstipation Verstopfung' },
  { naca: 2, fach: 'intern', text: 'Allergische Hautreaktion', bedingung: 'Quaddeln, keine Atem- oder Kreislaufbeteiligung', auch: 'Urtikaria Nesselsucht Allergie Ausschlag' },
  { naca: 2, fach: 'vergiftung', text: 'Alkoholintoxikation', bedingung: 'ansprechbar, Atmung und Kreislauf stabil', auch: 'betrunken Rausch Ethanol' },
  { naca: 2, fach: 'psych', text: 'Panikattacke oder akute Belastungsreaktion', bedingung: 'körperlich unauffällig, keine Selbst- oder Fremdgefährdung', auch: 'Angst Angststörung Stress' },
  { naca: 2, fach: 'sonstiges', text: 'Hitzeerschöpfung', bedingung: 'wach, orientiert, trinkt, Kreislauf stabil', auch: 'Hitze Sonnenstich Sonne Kollaps' },

  /* ---------- III: mäßig bis schwer, nicht lebensbedrohlich, stationäre Behandlung ---------- */
  { naca: 3, fach: 'verletzung', text: 'Oberschenkelfraktur', lit: true, auch: 'Femur Femurfraktur Bruch Oberschenkelschaft' },
  { naca: 3, fach: 'verletzung', text: 'Schenkelhalsfraktur', bedingung: 'Kreislauf stabil, Durchblutung der Extremität intakt', auch: 'Hüftfraktur Hüfte proximale Femurfraktur Oberschenkelhals' },
  { naca: 3, fach: 'verletzung', text: 'Oberarmfraktur', bedingung: 'geschlossen, durchblutet', auch: 'Humerus Humeruskopf Bruch' },
  { naca: 3, fach: 'verletzung', text: 'Unterschenkelfraktur', bedingung: 'geschlossen, DMS intakt (Operation nötig)', auch: 'Tibia Fibula Bruch' },
  { naca: 3, fach: 'verletzung', text: 'Sprunggelenksfraktur', bedingung: 'DMS intakt, ggf. Luxationsfraktur', auch: 'OSG Knöchel Malleolus Bruch' },
  { naca: 3, fach: 'verletzung', text: 'Offene Fraktur eines Röhrenknochens', bedingung: 'ohne wesentliche Blutung', auch: 'offener Bruch Oberarm Unterschenkel Splitter' },
  { naca: 3, fach: 'verletzung', text: 'Offene Wunden', bedingung: 'groß oder tief, Operation nötig', lit: true, auch: 'Weichteilverletzung Riss Platzwunde Rissquetschwunde' },
  { naca: 3, fach: 'verletzung', text: 'Amputation von Finger oder Hand', bedingung: 'Blutung kontrolliert', lit: true, auch: 'Abriss Fingerkuppe Amputat Replantation' },
  { naca: 3, fach: 'verletzung', text: 'Commotio cerebri', bedingung: 'GCS 15, Erbrechen oder Amnesie, Beobachtung nötig', auch: 'Gehirnerschütterung SHT leicht Kopfverletzung Kopfstoß' },
  { naca: 3, fach: 'verletzung', text: 'Mehrere Rippenfrakturen', bedingung: 'Atmung stabil, SpO₂ normal', auch: 'Rippenfraktur Rippen Thorax Brustkorb' },
  { naca: 3, fach: 'verletzung', text: 'Wirbelkörperfraktur ohne Ausfälle', bedingung: 'keine Neurologie, Vitalwerte stabil', auch: 'Wirbelsäule BWK LWK HWK Osteoporose Sturz Rücken' },
  { naca: 3, fach: 'verletzung', text: 'Verbrennung II. Grades, größere Fläche', bedingung: 'unterhalb der Kriterien des Verbrennungszentrums', auch: 'Verbrühung Flamme heiß' },
  { naca: 3, fach: 'verletzung', text: 'Komplikation einer Endoprothese', bedingung: 'z. B. Luxation, DMS intakt, Kreislauf stabil', auch: 'Hüft-TEP Knie-TEP Prothese ausgekugelt' },
  { naca: 3, fach: 'herz', text: 'Brustschmerz oder stabile Angina pectoris', bedingung: 'EKG ohne Infarktzeichen, Beschwerden gebessert', auch: 'Thoraxschmerz AP pektanginös ACS unwahrscheinlich' },
  { naca: 3, fach: 'herz', text: 'Synkope mit möglicher kardialer Ursache', bedingung: 'Überwachung nötig, aktuell stabil', auch: 'Ohnmacht Bewusstlosigkeit Rhythmusstörung' },
  { naca: 3, fach: 'herz', text: 'Neu aufgetretenes Vorhofflimmern', bedingung: 'mit Beschwerden, kreislaufstabil', auch: 'VHF Tachyarrhythmie Herzrasen' },
  { naca: 3, fach: 'atmung', text: 'Pneumonie', bedingung: 'SpO₂ stabil, keine ausgeprägte Atemnot', auch: 'Lungenentzündung Fieber Husten' },
  { naca: 3, fach: 'atmung', text: 'COPD-Exazerbation, mäßig', bedingung: 'bessert sich auf Inhalation, SpO₂ stabil', auch: 'COPD Emphysem Bronchitis Atemnot' },
  { naca: 3, fach: 'atmung', text: 'Asthmaanfall, mittelschwer', bedingung: 'bessert sich auf Inhalation', auch: 'Asthma bronchiale Atemnot' },
  { naca: 3, fach: 'atmung', text: 'Pseudokrupp, leicht', bedingung: 'Kind, bellender Husten, kein Stridor in Ruhe', auch: 'Krupp Kind Husten Heiserkeit' },
  { naca: 3, fach: 'neuro', text: 'Leichter Schlaganfall', lit: true, auch: 'Apoplex Insult Hirninfarkt Halbseitensymptomatik' },
  { naca: 3, fach: 'neuro', text: 'TIA', bedingung: 'Symptome zurückgebildet', auch: 'transitorische ischämische Attacke Mini-Schlaganfall' },
  { naca: 3, fach: 'neuro', text: 'Erster Krampfanfall', bedingung: 'abgeklungen, wach, Vitalwerte stabil', auch: 'Epilepsie Anfall Krampf erstmals' },
  { naca: 3, fach: 'neuro', text: 'Fieberkrampf beim Kind', bedingung: 'abgeklungen, Kind wach', auch: 'Säugling Kleinkind Fieber Krampf' },
  { naca: 3, fach: 'neuro', text: 'Somnolenz unklarer Ursache', bedingung: 'Vitalwerte stabil, Atemweg frei', auch: 'Bewusstseinsstörung Verwirrtheit Delir benommen' },
  { naca: 3, fach: 'intern', text: 'Akutes Abdomen', bedingung: 'Abwehrspannung oder Kolik, Kreislauf stabil', auch: 'Appendizitis Blinddarm Ileus Gallenkolik Pankreatitis Bauchschmerz' },
  { naca: 3, fach: 'intern', text: 'Gastrointestinale Blutung', bedingung: 'ohne Schockzeichen', auch: 'GI-Blutung Teerstuhl Bluterbrechen Magenblutung Melaena' },
  { naca: 3, fach: 'intern', text: 'Entgleister Blutzucker (Hyperglykämie)', bedingung: 'wach, Aufnahme zur Einstellung nötig', auch: 'Diabetes BZ hoch' },
  { naca: 3, fach: 'intern', text: 'Sepsisverdacht', bedingung: 'reduzierter Allgemeinzustand, qSOFA unter 2', auch: 'Infekt Fieber Urosepsis Schüttelfrost' },
  { naca: 3, fach: 'intern', text: 'Anaphylaxie, mittelschwer', bedingung: 'Haut plus leichte Atem- oder Kreislaufsymptome, nach Therapie gebessert', auch: 'allergische Reaktion Adrenalin Bienenstich Wespenstich' },
  { naca: 3, fach: 'vergiftung', text: 'Rauchgasvergiftung', bedingung: 'wach, geringe Beschwerden (Husten, Kopfschmerz)', lit: true, auch: 'Rauchgasinhalation CO Kohlenmonoxid Brand Rauch' },
  { naca: 3, fach: 'vergiftung', text: 'Intoxikation ohne Bewusstseinsstörung', bedingung: 'Überwachung nötig, Vitalwerte stabil', auch: 'Vergiftung Medikamente Tabletten Drogen Pilze Überdosis' },
  { naca: 3, fach: 'psych', text: 'Psychose oder akuter Erregungszustand', bedingung: 'körperlich unauffällig, psychiatrische Aufnahme nötig', auch: 'Wahn Manie Agitation' },
  { naca: 3, fach: 'psych', text: 'Akute Suizidalität', bedingung: 'körperlich unversehrt, psychiatrische Aufnahme nötig', auch: 'Suizid Suizidgedanken Selbstgefährdung' },
  { naca: 3, fach: 'sonstiges', text: 'Geburt, regelrecht', bedingung: 'Mutter und Kind stabil', auch: 'Entbindung Wehen Hausgeburt Geburt im RTW Schwangerschaft' },
  { naca: 3, fach: 'sonstiges', text: 'Vaginale Blutung in der Schwangerschaft', bedingung: 'kreislaufstabil', auch: 'Schwangerschaft Blutung Fehlgeburt Abort gynäkologisch' },
  { naca: 3, fach: 'sonstiges', text: 'Anhaltendes Nasenbluten', bedingung: 'z. B. unter Gerinnungshemmung', auch: 'Epistaxis Marcumar Antikoagulation Blutung' },
  { naca: 3, fach: 'sonstiges', text: 'Mäßige Unterkühlung', bedingung: 'wach, Kältezittern', auch: 'Hypothermie Kälte Auskühlung' },

  /* ---------- IV: schwere Störung, Lebensgefahr kurzfristig nicht auszuschließen ---------- */
  { naca: 4, fach: 'verletzung', text: 'Offene Schädelfraktur', lit: true, auch: 'Schädelbruch Schädel offen SHT' },
  { naca: 4, fach: 'verletzung', text: 'Mehrfache Rippenfraktur', bedingung: 'Schmerzen, Atemexkursion eingeschränkt', lit: true, auch: 'Rippenfrakturen Thorax Brustkorb' },
  { naca: 4, fach: 'verletzung', text: 'Wirbelverletzung mit neurologischen Ausfällen', lit: true, auch: 'Wirbelsäule Querschnitt Lähmung Rückenmark HWS BWS LWS' },
  { naca: 4, fach: 'verletzung', text: 'Schädel-Hirn-Trauma II. Grades', bedingung: 'GCS 9–12, Amnesie, Erbrechen, Bewusstlosigkeit', auch: 'SHT Kopfverletzung Contusio mittelschwer' },
  { naca: 4, fach: 'verletzung', text: 'Beckenringfraktur, geschlossen', bedingung: 'kreislaufstabil, Blutverlust möglich', auch: 'Becken Bruch Beckenverletzung instabil' },
  { naca: 4, fach: 'verletzung', text: 'Mehrere große Röhrenknochenfrakturen', auch: 'Oberschenkel Unterschenkel Oberarm Bruch mehrfach' },
  { naca: 4, fach: 'verletzung', text: 'Offene Fraktur mit relevanter Blutung', bedingung: 'Druckverband oder Tourniquet nötig', auch: 'offener Bruch Blutung' },
  { naca: 4, fach: 'verletzung', text: 'Verdacht auf Leber- oder Milzverletzung', bedingung: 'Bauchtrauma, Schmerz, kreislaufstabil', auch: 'stumpfes Bauchtrauma Milzruptur Leberruptur innere Blutung Abdominaltrauma' },
  { naca: 4, fach: 'verletzung', text: 'Traumatischer Pneumothorax', bedingung: 'Atemnot, kreislaufstabil', auch: 'Thoraxtrauma Hämatothorax Brustkorbverletzung' },
  { naca: 4, fach: 'verletzung', text: 'Große Amputationsverletzung', bedingung: 'Arm oder Bein, Blutung kontrolliert', auch: 'Abriss Amputat Gliedmaße Tourniquet' },
  { naca: 4, fach: 'verletzung', text: 'Ausgedehnte Verbrennung', bedingung: 'Kriterien Verbrennungszentrum, Gesicht, Hände oder Genitalien', auch: 'Verbrühung Flamme Verbrennungszentrum' },
  { naca: 4, fach: 'verletzung', text: 'Hochrasanztrauma oder Einklemmung', bedingung: 'Verletzungsmuster unklar, Patient wach und stabil', auch: 'Verkehrsunfall VU Sturz Höhe Motorrad Helmverlust Überrollen' },
  { naca: 4, fach: 'herz', text: 'Verdacht auf Myokardinfarkt', bedingung: 'ACS, kreislaufstabil, keine Rhythmusstörung', lit: true, auch: 'Herzinfarkt ACS AKS STEMI NSTEMI Koronarsyndrom Brustschmerz' },
  { naca: 4, fach: 'herz', text: 'Verdacht auf Lungenembolie', bedingung: 'Atemnot, Tachykardie, kreislaufstabil', auch: 'LAE Lungenarterienembolie Thrombose' },
  { naca: 4, fach: 'herz', text: 'Akutes kardiales Lungenödem', bedingung: 'Atemnot, Rasselgeräusche, SpO₂ erniedrigt, Blutdruck ausreichend', auch: 'Linksherzinsuffizienz Dekompensation Atemnot' },
  { naca: 4, fach: 'herz', text: 'Hypertensiver Notfall', bedingung: 'RR stark erhöht mit Brustschmerz, Neurologie oder Atemnot', auch: 'hypertensive Krise Bluthochdruck' },
  { naca: 4, fach: 'herz', text: 'Instabile Tachykardie oder Bradykardie', bedingung: 'Schwindel, Hypotonie, Brustschmerz oder Herzinsuffizienz', auch: 'Rhythmusstörung Herzrasen AV-Block Kammertachykardie SVT' },
  { naca: 4, fach: 'herz', text: 'Verdacht auf akutes Aortensyndrom', bedingung: 'plötzlicher, heftiger Schmerz, kreislaufstabil', auch: 'Aortendissektion Aortenaneurysma' },
  { naca: 4, fach: 'atmung', text: 'Schwerer Asthmaanfall', bedingung: 'nur Wortfetzen, SpO₂ erniedrigt; bei Erschöpfung eher V', lit: true, auch: 'Asthma Atemnot Status asthmaticus' },
  { naca: 4, fach: 'atmung', text: 'COPD-Exazerbation, schwer', bedingung: 'ausgeprägte Atemnot, SpO₂ trotz Sauerstoff niedrig', auch: 'COPD Emphysem respiratorische Insuffizienz' },
  { naca: 4, fach: 'atmung', text: 'Spontanpneumothorax', bedingung: 'Atemnot, kreislaufstabil', auch: 'Pneumothorax Lunge kollabiert' },
  { naca: 4, fach: 'atmung', text: 'Pseudokrupp mit Stridor in Ruhe', bedingung: 'Kind, Einziehungen, Atemnot', auch: 'Krupp Kind Stridor bellender Husten' },
  { naca: 4, fach: 'atmung', text: 'Atemnot beim Säugling (z. B. Bronchiolitis)', bedingung: 'Nasenflügeln, Einziehungen, Trinkschwäche', auch: 'Kleinkind RSV Bronchiolitis Atemnot' },
  { naca: 4, fach: 'atmung', text: 'Fremdkörperaspiration mit Atemnot', bedingung: 'Atemweg teilweise frei, Husten möglich', auch: 'Verschlucken Bolus Aspiration Erstickung' },
  { naca: 4, fach: 'neuro', text: 'Schlaganfall mit ausgeprägten Ausfällen', bedingung: 'Halbseitenlähmung oder Sprachstörung, wach', auch: 'Apoplex Insult Hemiparese Aphasie Lyse' },
  { naca: 4, fach: 'neuro', text: 'Krampfanfall mit anhaltender Bewusstseinsstörung', bedingung: 'Grand-mal, verlängerte Nachschlafphase, Anfallsserie', auch: 'Epilepsie Krampf' },
  { naca: 4, fach: 'neuro', text: 'Mehrere oder anhaltende Fieberkrämpfe', bedingung: 'Kind, Krampf länger als 5 Minuten oder wiederholt', auch: 'Säugling Kleinkind Fieber Krampf' },
  { naca: 4, fach: 'neuro', text: 'Verdacht auf Meningitis oder Enzephalitis', bedingung: 'Fieber, Nackensteifigkeit, Bewusstseinsstörung', auch: 'Hirnhautentzündung Petechien' },
  { naca: 4, fach: 'neuro', text: 'Verdacht auf Subarachnoidalblutung', bedingung: 'plötzlicher Vernichtungskopfschmerz, wach', auch: 'SAB Hirnblutung Kopfschmerz' },
  { naca: 4, fach: 'intern', text: 'Hypoglykämie mit Bewusstseinsstörung', bedingung: 'i.v.-Glukose nötig', auch: 'Unterzucker Diabetes BZ Koma Glukose' },
  { naca: 4, fach: 'intern', text: 'Sepsis', bedingung: 'qSOFA ab 2 oder NEWS2 ab 5', auch: 'Urosepsis Blutvergiftung Fieber Schüttelfrost' },
  { naca: 4, fach: 'intern', text: 'Gastrointestinale Blutung mit Schockzeichen', bedingung: 'Tachykardie, Blässe, Blutdruckabfall', auch: 'Magenblutung Bluterbrechen Teerstuhl Varizenblutung' },
  { naca: 4, fach: 'intern', text: 'Anaphylaxie mit Atemnot oder Kreislaufbeteiligung', bedingung: 'Stridor, Bronchospasmus oder Blutdruckabfall', auch: 'allergische Reaktion Adrenalin Bienenstich' },
  { naca: 4, fach: 'vergiftung', text: 'Medikamentenvergiftung', bedingung: 'Bewusstseinstrübung oder auffällige Vitalwerte', lit: true, auch: 'Intoxikation Tabletten Überdosierung Suizidversuch' },
  { naca: 4, fach: 'vergiftung', text: 'Opiat- oder Benzodiazepinintoxikation', bedingung: 'Bewusstseinsstörung, Atmung noch ausreichend', auch: 'Heroin Fentanyl Opioid Morphin Valium Überdosis Naloxon Flumazenil Drogen' },
  { naca: 4, fach: 'vergiftung', text: 'Alkoholintoxikation mit Bewusstseinsstörung', bedingung: 'somnolent bis soporös, Atemweg gefährdet', auch: 'betrunken Rausch Ethanol' },
  { naca: 4, fach: 'vergiftung', text: 'Rauchgasvergiftung mit Bewusstseinsstörung oder Atemnot', bedingung: 'auch Verdacht auf CO- oder Zyanidvergiftung', auch: 'Rauchgasinhalation Kohlenmonoxid Brand Inhalationstrauma' },
  { naca: 4, fach: 'sonstiges', text: 'Hitzschlag', bedingung: 'Bewusstseinsstörung, Körpertemperatur sehr hoch', auch: 'Sonnenstich Hyperthermie Hitze' },
  { naca: 4, fach: 'sonstiges', text: 'Starke Unterkühlung', bedingung: 'Bewusstseinsstörung, Zittern lässt nach', auch: 'Hypothermie Kälte Auskühlung Erfrierung' },
  { naca: 4, fach: 'sonstiges', text: 'Beinahe-Ertrinken', bedingung: 'ansprechbar, Husten oder Atemnot nach Wasseraspiration', auch: 'Ertrinken Wasser Eiseinbruch Tauchunfall' },
  { naca: 4, fach: 'sonstiges', text: 'Stromunfall', bedingung: 'Hochspannung, Blitz, Bewusstseinsverlust oder EKG-Auffälligkeit', auch: 'Elektrounfall Blitzschlag Stromschlag' },
  { naca: 4, fach: 'sonstiges', text: 'Geburt mit Komplikationen', bedingung: 'starke Blutung, Frühgeburt, Beckenendlage', auch: 'Entbindung Atonie Nabelschnur Schwangerschaft' },
  { naca: 4, fach: 'sonstiges', text: 'Präeklampsie', bedingung: 'Kopfschmerz, Sehstörung, Blutdruck stark erhöht', auch: 'Schwangerschaft Hypertonie HELLP' },

  /* ---------- V: akute Lebensgefahr, Transport in Reanimationsbereitschaft ---------- */
  { naca: 5, fach: 'verletzung', text: 'Schädel-Hirn-Trauma III. Grades', bedingung: 'GCS 8 oder weniger', lit: true, auch: 'SHT schwer Kopfverletzung Contusio Compressio' },
  { naca: 5, fach: 'verletzung', text: 'Rippenserienfraktur', bedingung: 'instabiler Thorax, Atemnot', lit: true, auch: 'Rippenserie Thoraxwand Flail chest' },
  { naca: 5, fach: 'verletzung', text: 'Offene Beckenfraktur', lit: true, auch: 'Becken Beckenringverletzung offener Bruch' },
  { naca: 5, fach: 'verletzung', text: 'Polytrauma', bedingung: 'mindestens V', auch: 'Mehrfachverletzung Schwerverletzter Verkehrsunfall Schockraum' },
  { naca: 5, fach: 'verletzung', text: 'Spannungspneumothorax', bedingung: 'Atemnot, Kreislaufinstabilität, Halsvenenstauung', auch: 'Pneumothorax Thorax Entlastung' },
  { naca: 5, fach: 'verletzung', text: 'Penetrierende Verletzung an Thorax, Hals oder Bauch', auch: 'Stich Schuss Messerstich Schussverletzung' },
  { naca: 5, fach: 'verletzung', text: 'Blutungsschock', bedingung: 'Tachykardie, Hypotonie, kaltschweißig', auch: 'Hypovolämischer Schock massive Blutung Trauma GI-Blutung' },
  { naca: 5, fach: 'verletzung', text: 'Verbrennung mit Inhalationstrauma', bedingung: 'Ruß in Mund oder Rachen, Heiserkeit, Stridor', auch: 'Rauchgas Brand Atemwege Gesicht' },
  { naca: 5, fach: 'herz', text: 'Myokardinfarkt mit Rhythmusstörungen', lit: true, auch: 'Herzinfarkt STEMI Kammerflimmern VT AV-Block' },
  { naca: 5, fach: 'herz', text: 'Schwerer Herzinfarkt', bedingung: 'z. B. mit Schock oder Lungenödem', lit: true, auch: 'Infarkt STEMI ACS kardiogener Schock' },
  { naca: 5, fach: 'herz', text: 'Kardiogener Schock', bedingung: 'Hypotonie, Zeichen der Minderperfusion', auch: 'Schock Pumpversagen' },
  { naca: 5, fach: 'herz', text: 'Lungenödem mit Schock oder Erschöpfung', auch: 'Linksherzinsuffizienz Atemnot Schock' },
  { naca: 5, fach: 'herz', text: 'Lungenembolie mit Schock', bedingung: 'Kreislaufinstabilität oder Synkope', auch: 'LAE Lungenarterienembolie' },
  { naca: 5, fach: 'herz', text: 'Rhythmusstörung mit Schock oder Bewusstlosigkeit', bedingung: 'Brady- oder Tachykardie', auch: 'AV-Block Kammertachykardie Asystoliegefahr' },
  { naca: 5, fach: 'herz', text: 'Rupturiertes Aortenaneurysma', bedingung: 'Schock', auch: 'Aortenruptur Aortendissektion Bauchaortenaneurysma' },
  { naca: 5, fach: 'atmung', text: 'Verlegung der Atemwege', bedingung: 'vollständig oder fast vollständig', lit: true, auch: 'Atemwegsverlegung Bolus Erstickung Fremdkörper Aspiration Schwellung' },
  { naca: 5, fach: 'atmung', text: 'Schwerer Asthmaanfall', bedingung: 'Erschöpfung, Zyanose, stille Lunge', lit: true, auch: 'Status asthmaticus Asthma Atemnot' },
  { naca: 5, fach: 'atmung', text: 'Epiglottitis', bedingung: 'Kind, Speichelfluss, Stridor, sitzende Haltung', auch: 'Kehldeckelentzündung Atemwegsverlegung' },
  { naca: 5, fach: 'neuro', text: 'Apoplex', bedingung: 'z. B. mit Bewusstseinsstörung oder Hirnblutung', lit: true, auch: 'Schlaganfall Insult ICB Hirninfarkt' },
  { naca: 5, fach: 'neuro', text: 'Bewusstlosigkeit unklarer Ursache', bedingung: 'GCS 8 oder weniger, Atmung vorhanden, Atemweg gefährdet', auch: 'Koma soporös Bewusstseinsverlust' },
  { naca: 5, fach: 'neuro', text: 'Status epilepticus', bedingung: 'Krampf länger als 5 Minuten oder Serie ohne Erholung', auch: 'Krampfanfall Epilepsie Dauerkrampf' },
  { naca: 5, fach: 'neuro', text: 'Hirnblutung oder SHT mit Einklemmungszeichen', bedingung: 'Pupillendifferenz, Bewusstseinsverlust', auch: 'ICB SAB Hämatom Hirndruck' },
  { naca: 5, fach: 'intern', text: 'Anaphylaktischer Schock', auch: 'Anaphylaxie Schock allergisch Adrenalin Bienenstich' },
  { naca: 5, fach: 'intern', text: 'Septischer Schock', bedingung: 'Hypotonie, Organversagen', auch: 'Sepsis Schock Blutvergiftung' },
  { naca: 5, fach: 'intern', text: 'Hypoglykämisches Koma', bedingung: 'bewusstlos oder krampfend', auch: 'Unterzucker Diabetes Glukose BZ' },
  { naca: 5, fach: 'vergiftung', text: 'Erhebliche Opioidvergiftung', bedingung: 'Atemdepression, Bewusstlosigkeit', lit: true, auch: 'Heroin Fentanyl Opiat Überdosis Naloxon Atemstillstand' },
  { naca: 5, fach: 'vergiftung', text: 'Intoxikation mit Atemdepression', bedingung: 'z. B. Benzodiazepine, GHB, Alkohol', auch: 'GBL GHB Barbiturate Überdosis' },
  { naca: 5, fach: 'vergiftung', text: 'Rauchgas- oder CO-Vergiftung mit Bewusstlosigkeit', auch: 'Kohlenmonoxid Zyanid Brand Rauch' },
  { naca: 5, fach: 'sonstiges', text: 'Ertrinkungsunfall mit Bewusstlosigkeit', bedingung: 'Atmung noch vorhanden', auch: 'Ertrinken Wasser Eiseinbruch' },
  { naca: 5, fach: 'sonstiges', text: 'Tiefe Unterkühlung', bedingung: 'bewusstlos, Kreislauf noch vorhanden', auch: 'Hypothermie Kälte Lawine Erfrierung' },
  { naca: 5, fach: 'sonstiges', text: 'Eklampsie', bedingung: 'Krampfanfall in Schwangerschaft oder Wochenbett', auch: 'Präeklampsie HELLP Schwangerschaft' },
  { naca: 5, fach: 'sonstiges', text: 'Schwere Blutung nach der Geburt', bedingung: 'Schockzeichen', auch: 'postpartale Blutung Uterusatonie Nachgeburt' },

  /* ---------- VI: Atem- und/oder Kreislaufstillstand, Reanimation ---------- */
  { naca: 6, fach: 'verletzung', text: 'Traumatischer Kreislaufstillstand', auch: 'Trauma Reanimation Polytrauma Blutverlust' },
  { naca: 6, fach: 'herz', text: 'Herzstillstand', bedingung: 'Reanimation', lit: true, auch: 'Herz-Kreislauf-Stillstand CPR Asystolie PEA Herzdruckmassage Wiederbelebung' },
  { naca: 6, fach: 'herz', text: 'Kammerflimmern', bedingung: 'Defibrillation', lit: true, auch: 'VF pulslose VT Schock Defibrillator' },
  { naca: 6, fach: 'herz', text: 'Reanimation mit Spontankreislauf (ROSC)', bedingung: 'Transport nach erfolgreicher Reanimation', auch: 'Wiederbelebung Post-Reanimation Return of spontaneous circulation' },
  { naca: 6, fach: 'atmung', text: 'Atemstillstand', bedingung: 'Beatmung nötig, Kreislauf noch vorhanden', auch: 'Apnoe Atemdepression' },
  { naca: 6, fach: 'sonstiges', text: 'Kreislaufstillstand durch besondere Ursache', bedingung: 'z. B. Ertrinken, Unterkühlung, Intoxikation, Anaphylaxie', auch: 'Reanimation Hypothermie Ertrinken Vergiftung' },
  { naca: 6, fach: 'sonstiges', text: 'Reanimation eines Kindes', bedingung: 'z. B. nach Ertrinken, Verschlucken, plötzlichem Kindstod', auch: 'Säugling Neugeborenes SIDS Kleinkind' },

  /* ---------- VII: Tod ---------- */
  { naca: 7, fach: 'verletzung', text: 'Tödliche Verletzung', bedingung: 'z. B. Unfall, Brand, Sturz', auch: 'verstorben Unfall tot Exitus' },
  { naca: 7, fach: 'herz', text: 'Tod nach erfolgloser Reanimation', bedingung: 'Reanimation beendet', lit: true, auch: 'Reanimation abgebrochen Exitus verstorben Todesfeststellung' },
  { naca: 7, fach: 'sonstiges', text: 'Sichere Todeszeichen bei Eintreffen', bedingung: 'Totenflecken, Leichenstarre, mit dem Leben nicht vereinbare Verletzung', auch: 'Leichenschau tot aufgefunden verstorben' },
  { naca: 7, fach: 'sonstiges', text: 'Tod bei Therapiebegrenzung', bedingung: 'z. B. Patientenverfügung, Palliativsituation, keine Reanimation', auch: 'Palliativ Patientenverfügung DNR verstorben Sterbebegleitung' },
];

/** Vergleichsform für die Suche: ohne Umlaut-Striche, Groß-/Kleinschreibung und Mehrfach-Leerzeichen. */
export function suchKey(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/ß/g, 'ss')
    .toLocaleLowerCase('de-DE')
    .replace(/\s+/g, ' ')
    .trim();
}

const HEUHAUFEN = new WeakMap<NacaBeispiel, string>();
function heuhaufen(b: NacaBeispiel): string {
  let h = HEUHAUFEN.get(b);
  if (h === undefined) {
    h = suchKey(`${b.text} ${b.bedingung ?? ''} ${b.auch ?? ''}`);
    HEUHAUFEN.set(b, h);
  }
  return h;
}

/**
 * Filtert die Beispiele: Jedes Wort der Suche muss vorkommen (in Text, Bedingung oder Suchbegriffen),
 * optional nur ein Fachgebiet. Die Reihenfolge bleibt erhalten.
 */
export function filtereNacaBeispiele(
  suche: string,
  fach: NacaFach | null = null,
  liste: readonly NacaBeispiel[] = NACA_BEISPIELE,
): NacaBeispiel[] {
  const woerter = suchKey(suche).split(' ').filter(Boolean);
  return liste.filter((b) => (fach == null || b.fach === fach) && woerter.every((w) => heuhaufen(b).includes(w)));
}

export interface NacaGruppeListe {
  naca: number;
  eintraege: NacaBeispiel[];
}

const FACH_INDEX = new Map(NACA_FAECHER.map((f, i) => [f.fach, i]));

/** Gruppiert nach NACA-Wert (aufsteigend); innerhalb eines Werts nach Fachgebiet, sonst in Listenreihenfolge. */
export function gruppiereNacaBeispiele(liste: readonly NacaBeispiel[]): NacaGruppeListe[] {
  const nachWert = new Map<number, NacaBeispiel[]>();
  for (const b of liste) {
    const l = nachWert.get(b.naca);
    if (l) l.push(b);
    else nachWert.set(b.naca, [b]);
  }
  return [...nachWert.entries()]
    .sort(([a], [b]) => a - b)
    .map(([naca, eintraege]) => ({
      naca,
      // Array.prototype.sort ist stabil: gleiche Fachgebiete behalten die Reihenfolge der Liste.
      eintraege: [...eintraege].sort((x, y) => (FACH_INDEX.get(x.fach) ?? 0) - (FACH_INDEX.get(y.fach) ?? 0)),
    }));
}
