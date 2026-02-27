# Transcript — Prezentare Settlement Schedule Reflow

> Script pentru demo video (~7 minute). Fiecare sectiune are un heading orientativ de timp.

---

## [0:00 – 0:15] Introducere

Buna! Voi prezenta solutia mea pentru *Settlement Schedule Reflow* — un motor care recalculeaza programul task-urilor de settlement cand apar disruptii, respectand toate constrangerile.

---

## [0:15 – 1:30] Intelegerea problemei

Am primit un snapshot cu trei tipuri de date:

1. **Settlement Tasks** — task-uri concrete (margin check, fund transfer, disbursement etc.), fiecare cu o durata in minute, un canal pe care ruleaza si o lista de dependente.
2. **Settlement Channels** — canalele de procesare (Domestic Wire, SWIFT, ACH). Fiecare are ore de operare saptamanale (de exemplu luni-vineri 8-16) si ferestre de blackout absolute (mentenanta Fedwire, de exemplu).
3. **Trade Orders** — comenzile de tranzactionare, cu o data-tinta de settlement (T+1, T+2). Le folosesc pentru detectia de SLA breach.

Constrangerile dure sunt patru:
- **Dependente** — un task nu poate incepe pana cand toate dependentele lui sunt complete.
- **Conflicte pe canal** — un singur task pe canal la un moment dat, fara suprapuneri.
- **Ore de operare** — procesarea se opreste in afara ferestrei si se reia in urmatoarea.
- **Blackout windows** — intervale interzise, nu se poate procesa deloc.

Un exemplu din specificatie care surprinde esenta: un task de 120 de minute incepe luni la 15:00, canalul se inchide la 16:00. Proceseaza 60 de minute luni, se opreste, reia marti la 8:00 si termina la 9:00. Durata de procesare este diferita de durata wall-clock.

---

## [1:30 – 2:45] Algoritmul

Trei faze: **sortare topologica**, **planificare greedy**, **validare post-reflow**.

### Faza 1: DAG + Sortare Topologica (dag.ts)

Construiesc un **DAG** din dependente. Folosesc **algoritmul lui Kahn** — pornesc de la nodurile cu in-degree 0, le procesez, le scot, repet. Daca raman noduri neprocesate — ciclu, arunc `CycleError`. Tie-break dupa `startDate` pentru ordine determinista.

**Structuri de date:** `adjacency` (lista de adiacenta) + `inDegree` (contor dependente). Complexitate: O(V + E).

### Faza 2: Planificare Greedy (scheduler.ts)

Pentru fiecare task ne-fixat, in ordine topologica:

```
effectiveStart = max(depsComplete, channelAvailable, nextOperatingSlot)
```

Calculez `endDate` consumand durata (prepTime + duration) prin ferestrele de operare. Regulatory hold-urile sunt fixe — nu le mut, dar le validez si le folosesc ca surse de dependenta.

**Structuri de date:** `channelNextAvailable` si `taskEndTimes` — doua Map-uri.

### Faza 3: Date Engine (date-utils.ts) — cea mai dificila parte

Functia `computeEndDate`: construiesc ferestre concrete de operare din pattern-ul saptamanal, scad blackout-urile (interval subtraction), si consum minute din ferestrele ramase zi cu zi. Toate datele in UTC, cu Luxon (`DateTime` + `Interval`).

### Validare si Metrici

Dupa planificare, un **constraint checker** verifica independent: suprapuneri canal, dependente, ore de operare, blackout-uri. Modulul de **metrici** calculeaza: delay total, task-uri afectate, utilizare canal, idle time, SLA breaches.

---

## [2:45 – 3:30] Scenarii

7 sub-scenarii:

1. **Delay Cascade** — fund transfer +3h, intregul lant se deplaseaza.
2. **Market Hours + Blackout** — task 120 min, luni 15:00, canal 8-16, blackout marti 8-9. Termina marti 10:00.
3. **Multi-Constraint** — dependente + conflict canal + blackout simultan.
4. **Channel Contention** — 3 task-uri independente pe un canal.
5. **Imposibil** — 5a: ciclu (eroare), 5b: hold in blackout (eroare), 5c: cascada depaseste T+1 (SLA breach).

---

## [3:30 – 3:45] Teste

98 teste Vitest, scrise TDD: date-utils (32), dag (9), scheduler (10), constraint-checker (9), metrics (6), integration (22), edge cases (10).

---

## [3:45 – 5:30] Constatari arhitecturale si Code Review

Dupa implementare am facut o sesiune de validare — un "grilling session" pe propriul cod.

### Diagrama de nivel inalt

Motorul de reflow e o **functie pura, fara stare**. Primeste un snapshot (`ReflowInput` — task-uri, canale, ordine) si returneaza un `ReflowResult`. Nu stie cine l-a apelat, nu tine minte rulari anterioare. Upstream poate fi un sistem de orchestrare a tranzactiilor, un monitor de sanatate al canalelor, sau o configuratie regulatorie. Downstream, rezultatul e consumat de dashboard-uri operationale, echipe de compliance si sisteme de notificare.

### Granita de responsabilitate

Motorul are incredere oarba in `dependsOnTaskIds`. Daca platforma creeaza un lant in care `fundTransfer` ruleaza inaintea `complianceScreen` (verificare de sanctiuni), banii se muta inainte de compliance — dar asta e un bug al platformei, nu al motorului nostru. Motorul e un scheduler pur, nu un enforcer de reguli de business.

### Model stateless

Fiecare apel primeste un snapshot proaspat si recalculeaza de la zero. Motorul nu are memorie intre rulari. Platforma e cea care gestioneaza starea reala (ce e in progres, ce s-a terminat, ce s-a stricat). Motorul e o functie pura: snapshot intrare -> program iesire.

### Validatorul raporteaza, nu reincerca

Daca validarea post-reflow gaseste violari, le pune in `errors[]`. Motorul NU reruleaza scheduler-ul (ar produce acelasi bug si risca bucle infinite). Oamenii revizuiesc si escaleaza.

### Human-in-the-loop

Motorul produce un program + erori, dar NU actioneaza automat. Echipele de operatiuni si compliance revizuiesc output-ul, actioneaza pe SLA breach-uri si escaleaza daca e nevoie. Motorul e un instrument consultativ, nu un decision-maker autonom.

### Cele 4 tipuri de disruptie

1. Transfer de fonduri intarziat de la contrapartida
2. Canal offline (cadere rail de plati, ex: Fedwire down)
3. Fereastra de blackout noua declarata de regulator
4. Mentenanta neplanificata

### Constatari din code review

Am identificat cateva probleme in codul propriu:

- **BUG (Medium):** Regulatory hold-urile puteau suprapune task-uri non-hold pe acelasi canal daca nu existau dependente intre ele. Fix: pre-scanez toate hold-urile si seed-uiesc `channelNextAvailable` inainte de bucla principala de planificare. *Rezolvat.*

- **LOW:** Ordinea de validare in constraint checker nu se potrivea cu specificatia (spec: Dependencies -> Channel -> Operating Hours -> Blackouts; codul avea alta ordine). *Rezolvat — reordonat.*

- **LOW:** Lipsea validarea `regulatory_hold_moved` — tipul exista in `ConstraintViolation` dar niciun check nu verifica ca hold-urile nu au fost mutate. *Rezolvat — adaugat check.*

- **LOW:** Cod mort — `isWithinOperatingHours` exportat dar nefolosit in productie, inlocuit de abordarea duration-matching. *Rezolvat — sters.*

- **Sugestie:** Teste lipsa pentru cazuri de nisa — task spanning weekend cu blackout vineri, blackout-uri multiple intr-o singura zi de operare, regulatory hold ca dependenta upstream, ore de operare split prin tot pipeline-ul scheduler.

---

## [5:30 – 6:00] Structura proiectului si demo playground

**Monorepo npm workspaces** cu trei pachete: **@reflow/engine** (motor pur), **@reflow/server** (API Express pe :3001), **@reflow/demo-playground** (React + Gantt SVG interactiv).

In playground selectezi scenariu, aplici disruptie, si vezi before/after pe Gantt cu metrici, schimbari si explicatii. Webpack 5 in loc de Vite (esbuild >= 0.18 nu merge pe macOS Big Sur).

---

## [6:00 – 6:15] Concluzii

Recapituland — **Kahn's topo sort -> greedy earliest-fit -> validare post-reflow**. Structuri de date: DAG cu lista de adiacenta, Map-uri pentru disponibilitate canal si timpi de terminare, Interval-uri Luxon. Complexitate: O(V + E) pentru DAG, O(V * W) pentru planificare. Toate bonus-urile implementate: DAG cu cycle detection, 98 teste, prep time, metrici, SLA breach, demo vizual.

Multumesc!
